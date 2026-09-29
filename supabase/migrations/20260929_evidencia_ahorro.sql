-- ═══════════════════════════════════════════════════════════════════════════
-- Evidencia de ahorro: datos que la app necesita en el servidor
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (2026-09-29): la app ahora muestra cuánto más ahorra el usuario
-- desde que usa Finn. Para que eso sobreviva a reinstalar o cambiar de
-- dispositivo, tres datos que vivían solo en el teléfono pasan al servidor:
--   1. financial_profiles.punto_partida  — línea base de ahorro mensual.
--   2. metas.aportes                     — historial de abonos/retiros.
--   3. compras_evitadas                  — "No la compré" del Simulador.
-- Y se corrige un hueco de cumplimiento: export_my_data no exportaba metas,
-- deudas ni gastos recurrentes (derecho de acceso, Ley 1581 art. 8 lit. a).
--
-- Privacidad: todo queda cubierto por reset_my_data (supresión), por
-- export_my_data (acceso/portabilidad) y por delete_my_account (FK en cascada).

-- ─── 1. Punto de partida del ahorro ─────────────────────────────────────────
-- { "ahorroMensual": number >= 0, "fuente": "declarado" | "calculado", "fecha": ISO }
alter table public.financial_profiles
  add column if not exists punto_partida jsonb;

alter table public.financial_profiles
  drop constraint if exists financial_profiles_punto_partida_chk;
alter table public.financial_profiles
  add constraint financial_profiles_punto_partida_chk check (
    punto_partida is null or (
      jsonb_typeof(punto_partida) = 'object'
      and jsonb_typeof(punto_partida -> 'ahorroMensual') = 'number'
      and (punto_partida ->> 'ahorroMensual')::numeric >= 0
      and punto_partida ->> 'fuente' in ('declarado', 'calculado')
    )
  );

comment on column public.financial_profiles.punto_partida is
  'Línea base de ahorro mensual antes de Finn: {ahorroMensual, fuente, fecha}.';

-- ─── 2. Historial de aportes de cada meta ───────────────────────────────────
-- [{ "monto": number (negativo = retiro), "fecha": ISO }]
alter table public.metas
  add column if not exists aportes jsonb not null default '[]'::jsonb;

alter table public.metas
  drop constraint if exists metas_aportes_chk;
alter table public.metas
  add constraint metas_aportes_chk check (
    jsonb_typeof(aportes) = 'array' and jsonb_array_length(aportes) <= 2000
  );

comment on column public.metas.aportes is
  'Historial de abonos (+) y retiros (−) de la meta: [{monto, fecha}].';

-- ─── 3. Compras evitadas (Simulador → "No la compré") ───────────────────────
-- PK compuesta: el id lo genera el cliente (evitada_<timestamp>) y podría
-- repetirse entre usuarios distintos.
create table if not exists public.compras_evitadas (
  user_id     uuid          not null references auth.users(id) on delete cascade,
  id          text          not null check (char_length(id) <= 64),
  monto       numeric(14,2) not null check (monto > 0),
  fecha       timestamptz   not null default now(),
  descripcion text          check (char_length(descripcion) <= 200),
  creada_en   timestamptz   not null default now(),
  primary key (user_id, id)
);

alter table public.compras_evitadas enable row level security;

drop policy if exists "compras_evitadas_owner" on public.compras_evitadas;
create policy "compras_evitadas_owner" on public.compras_evitadas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.compras_evitadas from anon;

comment on table public.compras_evitadas is
  'Compras que el usuario decidió no hacer tras usar el Simulador (evidencia de ahorro).';

-- ─── 4. reset_my_data: también borra las compras evitadas ────────────────────
-- (punto_partida y aportes ya se borran con sus filas: financial_profiles y metas)
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

-- ─── 5. export_my_data: metas, deudas, recurrentes y compras evitadas ───────
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
