-- ═══════════════════════════════════════════════════════════════════════════
-- Medios de pago (Billetera) — Fase 0 de la captura automática de compras
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (2026-09-30): el usuario registra sus tarjetas, billeteras (Nequi,
-- Daviplata…) y cuentas, y cada gasto puede quedar asociado a un medio. Es la
-- base sobre la que las fases siguientes registrarán compras automáticamente
-- (notificaciones del banco, correos de alerta, Atajos de iOS).
--
-- Seguridad / PCI DSS: NUNCA se guarda el número completo de la tarjeta, el
-- CVV, la fecha de vencimiento ni claves. Solo alias, franquicia y los últimos
-- 4 dígitos. Los CHECK de abajo lo hacen cumplir también en el servidor: un
-- alias con una secuencia larga de dígitos (posible número de tarjeta o de
-- cuenta) se rechaza.
--
-- Privacidad: payment_methods queda en reset_my_data (supresión), en
-- export_my_data (acceso/portabilidad) y en delete_my_account (FK en cascada).
--
-- Idempotente y no destructiva.

-- ─── 1. Tabla payment_methods ───────────────────────────────────────────────
-- PK compuesta: el id lo genera el cliente y podría repetirse entre usuarios.
create table if not exists public.payment_methods (
  user_id         uuid        not null references auth.users(id) on delete cascade,
  id              text        not null check (char_length(id) between 1 and 64),
  tipo            text        not null check (tipo in ('credito', 'debito', 'billetera', 'cuenta', 'efectivo')),
  entidad         text        not null check (char_length(entidad) between 1 and 40),
  alias           text        not null check (
                    char_length(alias) between 1 and 40
                    and alias !~ '[0-9]{6,}'
                  ),
  ultimos4        text        check (ultimos4 ~ '^[0-9]{4}$'),
  franquicia      text        check (franquicia in ('visa', 'mastercard', 'amex', 'diners', 'otra')),
  color           text        not null default '#334155' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  cupo            numeric(14,2) check (cupo is null or cupo >= 0),
  dia_corte       smallint    check (dia_corte between 1 and 31),
  dia_pago        smallint    check (dia_pago between 1 and 31),
  predeterminado  boolean     not null default false,
  archivado       boolean     not null default false,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  primary key (user_id, id),
  -- Solo las tarjetas llevan franquicia; cupo y fechas de corte/pago, solo crédito.
  constraint payment_methods_franquicia_solo_tarjeta
    check (franquicia is null or tipo in ('credito', 'debito')),
  constraint payment_methods_credito_campos
    check (tipo = 'credito' or (cupo is null and dia_corte is null and dia_pago is null))
);

alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_owner" on public.payment_methods;
create policy "payment_methods_owner" on public.payment_methods
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.payment_methods from anon;

comment on table public.payment_methods is
  'Medios de pago del usuario (tarjetas, billeteras, cuentas). Sin PAN/CVV: solo alias, franquicia y últimos 4.';

-- ─── 2. transactions: medio de pago y origen del registro ───────────────────
-- source: de dónde salió el movimiento (manual, recibo escaneado y, en fases
-- siguientes, notificación del banco, correo, Atajo de iOS, texto pegado).
-- dedupe_hash: huella de la compra para no registrarla dos veces cuando llega
-- por varios canales (p. ej. SMS + correo). La usa la fase 1.
alter table public.transactions
  add column if not exists payment_method_id text,
  add column if not exists source            text,
  add column if not exists merchant          text,
  add column if not exists dedupe_hash       text;

alter table public.transactions
  drop constraint if exists transactions_source_chk;
alter table public.transactions
  add constraint transactions_source_chk check (
    source is null or source in ('manual', 'recibo', 'notificacion', 'correo', 'atajo', 'texto', 'open_finance')
  );

alter table public.transactions
  drop constraint if exists transactions_capture_len_chk;
alter table public.transactions
  add constraint transactions_capture_len_chk check (
    (payment_method_id is null or char_length(payment_method_id) <= 64)
    and (merchant is null or char_length(merchant) <= 120)
    and (dedupe_hash is null or char_length(dedupe_hash) <= 128)
  );

create index if not exists transactions_payment_method_idx
  on public.transactions (user_id, payment_method_id)
  where payment_method_id is not null;

create unique index if not exists transactions_dedupe_uidx
  on public.transactions (user_id, dedupe_hash)
  where dedupe_hash is not null and deleted_at is null;

-- ─── 3. RPC de upsert con los campos nuevos ─────────────────────────────────
-- Se elimina la firma anterior (10 parámetros): añadir parámetros con DEFAULT
-- sin el DROP crearía una sobrecarga ("function is not unique"). Las versiones
-- de la app que aún envían 10 argumentos con nombre siguen funcionando: los
-- nuevos tienen DEFAULT NULL.
drop function if exists public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz, text, text
);

create or replace function public.upsert_transaction_safe(
  p_id                text,
  p_user_id           uuid,
  p_amount            numeric,
  p_category          text,
  p_date              text,
  p_type              text,
  p_description       text,
  p_updated_at        timestamptz,
  p_subcategory       text default null,
  p_category_id       text default null,
  p_payment_method_id text default null,
  p_source            text default null,
  p_merchant          text default null,
  p_dedupe_hash       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> (select auth.uid()) then
    raise exception 'No autorizado';
  end if;

  insert into public.transactions (
    id, user_id, amount, category, date, type, description, subcategory, category_id,
    payment_method_id, source, merchant, dedupe_hash, updated_at
  )
  values (
    p_id, p_user_id, p_amount, p_category, p_date, p_type, p_description, p_subcategory, p_category_id,
    p_payment_method_id, p_source, p_merchant, p_dedupe_hash, p_updated_at
  )
  on conflict (id) do update
    set amount            = excluded.amount,
        category          = excluded.category,
        date              = excluded.date,
        type              = excluded.type,
        description       = excluded.description,
        subcategory       = excluded.subcategory,
        -- Nunca degrada a NULL un category_id ya asignado.
        category_id       = coalesce(excluded.category_id, transactions.category_id),
        -- El medio sí puede quitarse a propósito; una app antigua que no lo
        -- conoce no debe borrarlo, por eso solo cambia si llega el parámetro
        -- de origen (las versiones nuevas siempre lo envían).
        payment_method_id = case when excluded.source is null
                                 then transactions.payment_method_id
                                 else excluded.payment_method_id end,
        source            = coalesce(excluded.source, transactions.source),
        merchant          = coalesce(excluded.merchant, transactions.merchant),
        dedupe_hash       = coalesce(excluded.dedupe_hash, transactions.dedupe_hash),
        updated_at        = excluded.updated_at
    where transactions.user_id = (select auth.uid())
      and (transactions.updated_at is null or excluded.updated_at > transactions.updated_at);
end;
$$;

revoke all on function public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz, text, text, text, text, text, text
) from public, anon;
grant execute on function public.upsert_transaction_safe(
  text, uuid, numeric, text, text, text, text, timestamptz, text, text, text, text, text, text
) to authenticated;

-- ─── 4. reset_my_data: también borra los medios de pago ─────────────────────
create or replace function public.reset_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n_tx  bigint;
  n_cat bigint;
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  delete from public.transactions where user_id = uid;
  get diagnostics n_tx = row_count;

  delete from public.categories where user_id = uid;
  get diagnostics n_cat = row_count;

  delete from public.financial_profiles     where user_id = uid;
  delete from public.financial_goals        where user_id = uid;
  delete from public.finn_memory            where user_id = uid;
  delete from public.finn_alertas_log       where usuario_id = uid;
  delete from public.finn_alert_preferences where user_id = uid;
  delete from public.metas                  where user_id = uid;
  delete from public.deudas                 where user_id = uid;
  delete from public.gastos_recurrentes     where user_id = uid;
  delete from public.compras_evitadas       where user_id = uid;
  delete from public.payment_methods        where user_id = uid;

  -- Nivel: vuelve al estado de un usuario nuevo (mismo valor que handle_new_user_level)
  delete from public.user_levels where user_id = uid;
  insert into public.user_levels (user_id, level, experience, title)
  values (uid, 1, 0, 'Principiante')
  on conflict (user_id) do nothing;

  -- `premium` no se toca: lo protege profiles_protect_premium y es un pago real.
  update public.profiles set
    monthly_salary        = 0,
    is_onboarded          = false,
    paid_tx_ids           = '[]'::jsonb,
    lecciones_completadas = '[]'::jsonb,
    retos_completados     = '[]'::jsonb,
    reto_activo           = null,
    push_token            = null
  where id = uid;

  return jsonb_build_object('reset', true, 'transactions', n_tx, 'categories', n_cat);
end;
$$;

revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

-- ─── 5. export_my_data: incluye los medios de pago ──────────────────────────
-- SECURITY INVOKER: RLS garantiza que solo se lean filas del propio usuario.
create or replace function public.export_my_data()
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'generated_at',         now(),
    'user_id',              (select auth.uid()),
    'email',                (select auth.jwt() ->> 'email'),
    'profile',              (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'financial_profile',    (select to_jsonb(f) from public.financial_profiles f where f.user_id = (select auth.uid())),
    'financial_goal',       (select to_jsonb(g) from public.financial_goals g where g.user_id = (select auth.uid())),
    'level',                (select to_jsonb(l) from public.user_levels l where l.user_id = (select auth.uid())),
    'categories',           coalesce((select jsonb_agg(to_jsonb(c)) from public.categories c where c.user_id = (select auth.uid())), '[]'::jsonb),
    'transactions',         coalesce((select jsonb_agg(to_jsonb(t) order by t.date) from public.transactions t where t.user_id = (select auth.uid())), '[]'::jsonb),
    'payment_methods',      coalesce((select jsonb_agg(to_jsonb(pm) order by pm.creado_en) from public.payment_methods pm where pm.user_id = (select auth.uid())), '[]'::jsonb),
    'metas',                coalesce((select jsonb_agg(to_jsonb(m) order by m.creada_en) from public.metas m where m.user_id = (select auth.uid())), '[]'::jsonb),
    'deudas',               coalesce((select jsonb_agg(to_jsonb(d) order by d.creada_en) from public.deudas d where d.user_id = (select auth.uid())), '[]'::jsonb),
    'gastos_recurrentes',   coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en) from public.gastos_recurrentes r where r.user_id = (select auth.uid())), '[]'::jsonb),
    'compras_evitadas',     coalesce((select jsonb_agg(to_jsonb(ce) order by ce.fecha) from public.compras_evitadas ce where ce.user_id = (select auth.uid())), '[]'::jsonb),
    'finn_memory',          (select to_jsonb(m) from public.finn_memory m where m.user_id = (select auth.uid())),
    'alert_preferences',    (select to_jsonb(a) from public.finn_alert_preferences a where a.user_id = (select auth.uid())),
    'alerts',               coalesce((select jsonb_agg(to_jsonb(a)) from public.finn_alertas_log a where a.usuario_id = (select auth.uid())), '[]'::jsonb),
    'premium_entitlement',  (select to_jsonb(e) from public.premium_entitlements e where e.user_id = (select auth.uid())),
    'payments',             coalesce((select jsonb_agg(to_jsonb(x)) from public.payment_transactions x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'consents',             coalesce((select jsonb_agg(to_jsonb(k) order by k.created_at) from public.user_consents k where k.user_id = (select auth.uid())), '[]'::jsonb),
    'privacy_requests',     coalesce((select jsonb_agg(to_jsonb(r)) from public.privacy_requests r where r.user_id = (select auth.uid())), '[]'::jsonb),
    'shared_memberships',   coalesce((select jsonb_agg(to_jsonb(s)) from public.space_members s where s.user_id = (select auth.uid())), '[]'::jsonb),
    'shared_expenses_paid', coalesce((select jsonb_agg(to_jsonb(se)) from public.shared_expenses se where se.paid_by = (select auth.uid())), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
