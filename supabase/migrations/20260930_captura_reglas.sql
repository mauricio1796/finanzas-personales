-- ═══════════════════════════════════════════════════════════════════════════
-- Captura automática — Fase 1: reglas comercio → categoría que Finn aprende
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (2026-09-30): cuando el usuario confirma o corrige la categoría de
-- una compra detectada en un mensaje del banco, Finn guarda la regla
-- ("pexto capital" → Deudas) y la próxima compra en ese comercio se registra
-- sola. Se guarda en el servidor para no perder lo aprendido al cambiar de
-- teléfono.
--
-- Privacidad: solo el nombre normalizado del comercio y la categoría; nunca
-- el texto del mensaje. Cubierta por reset_my_data, export_my_data y
-- delete_my_account (FK en cascada).
--
-- Idempotente y no destructiva.

create table if not exists public.merchant_rules (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  clave          text        not null check (char_length(clave) between 1 and 120),
  category_id    text        not null check (char_length(category_id) between 1 and 200),
  category_name  text        not null check (char_length(category_name) between 1 and 100),
  usos           integer     not null default 1 check (usos >= 1),
  actualizada_en timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.merchant_rules enable row level security;

drop policy if exists "merchant_rules_owner" on public.merchant_rules;
create policy "merchant_rules_owner" on public.merchant_rules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.merchant_rules from anon;

comment on table public.merchant_rules is
  'Reglas comercio → categoría aprendidas por Finn en la captura automática de compras.';

-- ─── reset_my_data: también borra las reglas ────────────────────────────────
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
  delete from public.merchant_rules         where user_id = uid;

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

-- ─── export_my_data: incluye las reglas ─────────────────────────────────────
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
    'merchant_rules',       coalesce((select jsonb_agg(to_jsonb(mr) order by mr.clave) from public.merchant_rules mr where mr.user_id = (select auth.uid())), '[]'::jsonb),
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
