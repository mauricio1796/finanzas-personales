-- ============================================================
-- FinancyAI — Supabase Schema
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- Dashboard → SQL Editor → New Query → Pegar y Run
-- ============================================================

-- ─── Extensiones ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Función updated_at automático ───────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── 1. profiles (extiende auth.users) ───────────────────────────────────────
create table if not exists public.profiles (
  id                    uuid references auth.users on delete cascade primary key,
  name                  text not null default '',
  monthly_salary        numeric default 0,
  is_onboarded          boolean default false,
  paid_tx_ids           jsonb default '[]'::jsonb,
  lecciones_completadas jsonb default '[]'::jsonb,
  retos_completados     jsonb default '[]'::jsonb,
  reto_activo           jsonb,
  premium               jsonb default '{"isPremium":false,"plan":null,"fechaInicio":null,"fechaVencimiento":null}'::jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: acceso solo propio"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-crear perfil cuando el usuario se registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 2. financial_profiles (datos del onboarding) ────────────────────────────
create table if not exists public.financial_profiles (
  id                      uuid default gen_random_uuid() primary key,
  user_id                 uuid references auth.users on delete cascade not null unique,
  employment_type         text,
  income_type             text,
  monthly_salary          numeric default 0,
  has_debts               boolean default false,
  debt_amount             numeric,
  main_financial_concern  text,
  currency_preference     text default 'COP',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.financial_profiles enable row level security;

create policy "financial_profiles: acceso solo propio"
  on public.financial_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger on_financial_profiles_updated
  before update on public.financial_profiles
  for each row execute function public.handle_updated_at();

-- ─── 3. financial_goals ───────────────────────────────────────────────────────
create table if not exists public.financial_goals (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null unique,
  type           text,
  title          text not null default '',
  description    text,
  target_amount  numeric,
  current_amount numeric default 0,
  deadline       text,
  priority       text default 'medium',
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.financial_goals enable row level security;

create policy "financial_goals: acceso solo propio"
  on public.financial_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger on_financial_goals_updated
  before update on public.financial_goals
  for each row execute function public.handle_updated_at();

-- ─── 4. user_levels (gamificación) ───────────────────────────────────────────
create table if not exists public.user_levels (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null unique,
  level      integer default 1 check (level between 1 and 5),
  experience integer default 0 check (experience >= 0),
  title      text default 'Principiante',
  updated_at timestamptz default now()
);

alter table public.user_levels enable row level security;

create policy "user_levels: acceso solo propio"
  on public.user_levels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger on_user_levels_updated
  before update on public.user_levels
  for each row execute function public.handle_updated_at();

-- ─── 5. categories ────────────────────────────────────────────────────────────
-- Usa text como PK para mantener compatibilidad con los IDs locales
create table if not exists public.categories (
  id             text primary key,
  user_id        uuid references auth.users on delete cascade not null,
  name           text not null,
  icon           text,
  color          text,
  budget         numeric,
  is_selected    boolean default true,
  dia_pago       integer check (dia_pago between 1 and 31),
  pagado         boolean default false,
  tipo           text check (tipo in ('gasto', 'ingreso', 'fijo', 'variable')),
  fecha_creacion text,
  created_at     timestamptz default now()
);

alter table public.categories enable row level security;

create policy "categories: acceso solo propio"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists categories_user_id_idx on public.categories (user_id);

-- ─── 6. transactions ──────────────────────────────────────────────────────────
-- Usa text como PK para compatibilidad con IDs locales (Date.now().toString())
create table if not exists public.transactions (
  id          text primary key,
  user_id     uuid references auth.users on delete cascade not null,
  amount      numeric not null check (amount >= 0),
  category    text not null default '',
  date        text not null,
  type        text not null check (type in ('income', 'expense')),
  description text,
  created_at  timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "transactions: acceso solo propio"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

-- ─── Verificación final ───────────────────────────────────────────────────────
-- Después de ejecutar, deberías ver estas tablas en Database → Tables:
-- profiles, financial_profiles, financial_goals, user_levels, categories, transactions
