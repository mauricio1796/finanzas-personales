-- ============================================================
-- BUG-10 — La relación transacción → categoría se guardaba por NOMBRE
--
-- Al renombrar una categoría, las transacciones históricas quedaban apuntando
-- a un nombre inexistente y dejaban de contar para su presupuesto: el gasto
-- "desaparecía" de los informes.
--
-- Esta migración añade `category_id`, un identificador estable que sobrevive a
-- los cambios de nombre. La columna `category` se conserva (es el nombre
-- visible, y el histórico de categorías ya eliminadas vive ahí), de modo que
-- nada de lo existente se pierde.
--
-- Idempotente y no destructiva.
-- ============================================================

alter table public.transactions
  add column if not exists category_id text;

create index if not exists transactions_category_id_idx
  on public.transactions (user_id, category_id)
  where category_id is not null;

-- ─── RPC de upsert con category_id ───────────────────────────────────────────
-- Se elimina primero la firma anterior (9 parámetros). Sin este DROP, añadir un
-- parámetro con DEFAULT crearía una SOBRECARGA y las llamadas existentes
-- fallarían con "function is not unique".
drop function if exists public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz, text
);

-- También la firma original de 001_robustness (8 parámetros), por si el
-- proyecto la conserva.
drop function if exists public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz
);

create or replace function public.upsert_transaction_safe(
  p_id          text,
  p_user_id     uuid,
  p_amount      numeric,
  p_category    text,
  p_date        text,
  p_type        text,
  p_description text,
  p_updated_at  timestamptz,
  p_subcategory text default null,
  p_category_id text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.transactions (
    id, user_id, amount, category, date, type, description, subcategory, category_id, updated_at
  )
  values (
    p_id, p_user_id, p_amount, p_category, p_date, p_type, p_description, p_subcategory, p_category_id, p_updated_at
  )
  on conflict (id) do update
    set amount      = excluded.amount,
        category    = excluded.category,
        date        = excluded.date,
        type        = excluded.type,
        description = excluded.description,
        subcategory = excluded.subcategory,
        -- Nunca degrada un category_id ya asignado a NULL: si el cliente aún no
        -- migró esa transacción, se conserva el identificador que ya existía.
        category_id = coalesce(excluded.category_id, transactions.category_id),
        updated_at  = excluded.updated_at
    where transactions.updated_at is null
       or excluded.updated_at > transactions.updated_at;
end;
$$;

grant execute on function public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz, text, text
) to authenticated;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Rellena category_id para las transacciones existentes cuyo `category` coincide
-- con el nombre (o el id) de una categoría del mismo usuario. La comparación
-- ignora mayúsculas y espacios (BUG-21). Las transacciones cuya categoría ya no
-- existe se quedan con category_id NULL y conservan su nombre histórico.
update public.transactions t
set category_id = c.id
from public.categories c
where c.user_id = t.user_id
  and t.category_id is null
  and (
    c.id = t.category
    or lower(btrim(c.name)) = lower(btrim(t.category))
  );
