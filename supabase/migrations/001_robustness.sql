  -- ============================================================
-- FinancyAI — Migración 001: Robustez de datos
-- Ejecutar en Supabase SQL Editor DESPUÉS del schema.sql base
-- ============================================================

-- ─── 1. updated_at en transactions (para resolución de conflictos) ────────────
alter table public.transactions
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz default null;

create or replace trigger on_transactions_updated
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- Índice para soft-delete queries
create index if not exists transactions_user_active_idx
  on public.transactions (user_id, date desc)
  where deleted_at is null;

-- ─── 2. updated_at en categories (para resolución de conflictos) ──────────────
alter table public.categories
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz default null;

create or replace trigger on_categories_updated
  before update on public.categories
  for each row execute function public.handle_updated_at();

create index if not exists categories_user_active_idx
  on public.categories (user_id)
  where deleted_at is null;

-- ─── 3. Tabla de auditoría (historial inmutable de cambios) ───────────────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete cascade not null,
  tabla       text not null,
  registro_id text not null,
  operacion   text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  datos_antes jsonb,
  datos_desp  jsonb,
  created_at  timestamptz default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log: solo lectura propia"
  on public.audit_log for select
  using (auth.uid() = user_id);

-- Los inserts en audit_log los hace la función de trigger (security definer)
create policy "audit_log: solo sistema puede insertar"
  on public.audit_log for insert
  with check (false);

create index if not exists audit_log_user_tabla_idx on public.audit_log (user_id, tabla, created_at desc);
create index if not exists audit_log_registro_idx   on public.audit_log (registro_id);

-- ─── 4. Función de auditoría automática ──────────────────────────────────────
create or replace function public.registrar_auditoria()
returns trigger as $$
declare
  uid uuid;
begin
  -- Obtener user_id de la fila afectada
  uid := coalesce(
    (new.user_id)::uuid,
    (old.user_id)::uuid
  );

  insert into public.audit_log (user_id, tabla, registro_id, operacion, datos_antes, datos_desp)
  values (
    uid,
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    TG_OP,
    case when TG_OP = 'INSERT' then null else to_jsonb(old) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Activar auditoría en transactions
drop trigger if exists audit_transactions on public.transactions;
create trigger audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.registrar_auditoria();

-- Activar auditoría en categories
drop trigger if exists audit_categories on public.categories;
create trigger audit_categories
  after insert or update or delete on public.categories
  for each row execute function public.registrar_auditoria();

-- ─── 5. Tabla de memoria de Finn (para personalización por usuario) ───────────
create table if not exists public.finn_memory (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null unique,
  patrones    jsonb default '{}'::jsonb,
  preferencias jsonb default '{}'::jsonb,
  alertas     jsonb default '[]'::jsonb,
  resumen_mes_anterior jsonb,
  ultima_actualizacion timestamptz default now(),
  created_at  timestamptz default now()
);

alter table public.finn_memory enable row level security;

create policy "finn_memory: acceso solo propio"
  on public.finn_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── 6. Tabla de cola de sync pendiente (para sync visible) ──────────────────
create table if not exists public.sync_queue (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete cascade not null,
  operacion   text not null,
  tabla       text not null,
  payload     jsonb not null,
  intentos    integer default 0,
  max_intentos integer default 3,
  procesado   boolean default false,
  error       text,
  created_at  timestamptz default now(),
  processed_at timestamptz
);

alter table public.sync_queue enable row level security;

create policy "sync_queue: acceso solo propio"
  on public.sync_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists sync_queue_user_pending_idx
  on public.sync_queue (user_id, created_at)
  where procesado = false;

-- ─── 7. Función de resolución de conflictos (last-writer-wins con timestamp) ──
-- Usado en upsert de transactions: solo actualiza si el registro nuevo es más reciente
create or replace function public.upsert_transaction_safe(
  p_id          text,
  p_user_id     uuid,
  p_amount      numeric,
  p_category    text,
  p_date        text,
  p_type        text,
  p_description text,
  p_updated_at  timestamptz default now()
) returns void as $$
begin
  insert into public.transactions (id, user_id, amount, category, date, type, description, updated_at)
  values (p_id, p_user_id, p_amount, p_category, p_date, p_type, p_description, p_updated_at)
  on conflict (id) do update
    set amount      = excluded.amount,
        category    = excluded.category,
        date        = excluded.date,
        type        = excluded.type,
        description = excluded.description,
        updated_at  = excluded.updated_at
    -- Solo actualiza si el registro entrante es MÁS RECIENTE
    where transactions.updated_at < excluded.updated_at
       or transactions.updated_at is null;
end;
$$ language plpgsql security definer;

-- ─── 8. Función soft-delete de transaction ───────────────────────────────────
create or replace function public.soft_delete_transaction(
  p_id      text,
  p_user_id uuid
) returns void as $$
begin
  update public.transactions
    set deleted_at = now()
  where id = p_id
    and user_id = p_user_id
    and deleted_at is null;
end;
$$ language plpgsql security definer;

-- ─── Verificación ─────────────────────────────────────────────────────────────
-- Tablas nuevas: audit_log, finn_memory, sync_queue
-- Columnas nuevas: transactions.updated_at, transactions.deleted_at,
--                  categories.updated_at, categories.deleted_at
