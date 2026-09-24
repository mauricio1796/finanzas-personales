-- ============================================================
-- BUG-07 — Premium bypasseable desde el cliente
--
-- Antes: el entitlement Premium vivía en `profiles.premium` (jsonb), y la
-- política RLS "acceso solo propio" permite al usuario hacer UPDATE de su
-- propia fila. Es decir, cualquier usuario podía declararse Premium.
--
-- Ahora: `premium_entitlements` es la fuente de verdad. El cliente SOLO puede
-- leer su propia fila; NO existen políticas de INSERT/UPDATE/DELETE para el rol
-- `authenticated`, por lo que únicamente el Worker —usando la service_role key,
-- que omite RLS— puede escribir aquí, y solo después de verificar el pago
-- contra la API de Wompi.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- ============================================================

create table if not exists public.premium_entitlements (
  user_id              uuid primary key references auth.users on delete cascade,
  is_premium           boolean     not null default false,
  plan                 text        check (plan in ('mensual', 'anual')),
  starts_at            timestamptz,
  expires_at           timestamptz,
  source               text        not null default 'wompi',
  wompi_transaction_id text,
  updated_at           timestamptz not null default now()
);

alter table public.premium_entitlements enable row level security;

-- Lectura de la propia fila. La ausencia de políticas de escritura es
-- deliberada: el cliente nunca puede otorgarse Premium a sí mismo.
drop policy if exists "premium_entitlements: lectura propia" on public.premium_entitlements;
create policy "premium_entitlements: lectura propia"
  on public.premium_entitlements for select
  using ((select auth.uid()) = user_id);

drop trigger if exists premium_entitlements_updated_at on public.premium_entitlements;
create trigger premium_entitlements_updated_at
  before update on public.premium_entitlements
  for each row execute function public.handle_updated_at();

-- ─── Cierre del hueco heredado en profiles.premium ───────────────────────────
-- `profiles.premium` se conserva por compatibilidad con instalaciones
-- existentes (la app lo sigue leyendo como caché degradado si el entitlement
-- aún no se ha sincronizado), pero deja de ser escribible por el cliente:
-- cualquier UPDATE que no venga de service_role conserva el valor anterior.
create or replace function public.protect_premium_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user <> 'service_role' then
    new.premium := old.premium;
  end if;
  return new;
end;
$$;

-- Es una función de TRIGGER: no debe quedar expuesta como RPC.
revoke all on function public.protect_premium_column() from public, anon, authenticated;

drop trigger if exists profiles_protect_premium on public.profiles;
create trigger profiles_protect_premium
  before update on public.profiles
  for each row execute function public.protect_premium_column();

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Los usuarios que ya tenían Premium marcado en profiles.premium conservan su
-- acceso: se migra su estado actual al nuevo entitlement para no romper a
-- quienes ya pagaron. `on conflict do nothing` mantiene la idempotencia y evita
-- pisar un entitlement ya verificado por el Worker.
insert into public.premium_entitlements (user_id, is_premium, plan, starts_at, expires_at, source)
select
  p.id,
  coalesce((p.premium->>'isPremium')::boolean, false),
  nullif(p.premium->>'plan', 'null'),
  nullif(p.premium->>'fechaInicio', 'null')::timestamptz,
  nullif(p.premium->>'fechaVencimiento', 'null')::timestamptz,
  'backfill_profiles'
from public.profiles p
where coalesce((p.premium->>'isPremium')::boolean, false) = true
on conflict (user_id) do nothing;
