-- ============================================================
-- Cumplimiento de privacidad y seguridad (auditoría 2026-09-24)
--
-- 1. SEGURIDAD — IDOR en RPCs SECURITY DEFINER:
--    `get_or_create_alert_preferences(p_user_id)` e `insert_finn_alerta(p_usuario_id, …)`
--    aceptaban cualquier UUID sin compararlo con auth.uid(). Un usuario autenticado
--    podía leer/crear las preferencias de otro e inyectar mensajes en el registro
--    de alertas de otro usuario (vector de phishing dentro de la app).
-- 2. Consentimientos versionados (Ley 1581 de 2012, art. 9; Decreto 1074 de 2015,
--    arts. 2.2.2.25.2.2 y ss.: prueba de la autorización). Registro append-only.
-- 3. Solicitudes de derechos del titular (consultas y reclamos, arts. 14 y 15
--    Ley 1581) con trazabilidad de estado.
-- 4. Libro de pagos idempotente (evita renovar Premium reutilizando un pago y
--    conserva soporte de la transacción).
-- 5. Eliminación de cuenta por el propio usuario y exportación de datos.
--
-- Idempotente y aditiva: no borra datos existentes.
-- ============================================================

-- ─── 1. Cierre de IDOR en RPCs ──────────────────────────────────────────────

create or replace function public.get_or_create_alert_preferences(p_user_id uuid)
returns public.finn_alert_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.finn_alert_preferences;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (p_user_id is null or p_user_id is distinct from (select auth.uid())) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  insert into public.finn_alert_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.get_or_create_alert_preferences(uuid) from public, anon;
grant execute on function public.get_or_create_alert_preferences(uuid) to authenticated;

create or replace function public.insert_finn_alerta(
  p_usuario_id    uuid,
  p_tipo_alerta   text,
  p_referencia_id text,
  p_mensaje       text,
  p_canal         text default 'inapp'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (p_usuario_id is null or p_usuario_id is distinct from (select auth.uid())) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  insert into public.finn_alertas_log (usuario_id, tipo_alerta, referencia_id, mensaje, canal)
  values (p_usuario_id, p_tipo_alerta, p_referencia_id, left(p_mensaje, 1000), p_canal)
  on conflict (usuario_id, tipo_alerta, referencia_id, (date_trunc('day', enviado_at at time zone 'America/Bogota')))
  do nothing;

  get diagnostics inserted = row_count;
  return (inserted);
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.insert_finn_alerta(uuid, text, text, text, text) from public, anon;
grant execute on function public.insert_finn_alerta(uuid, text, text, text, text) to authenticated;

-- Funciones de trigger / internas que no deben quedar como RPC pública.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'handle_new_user_level') then
    execute 'revoke all on function public.handle_new_user_level() from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'soft_delete_transaction') then
    execute 'revoke all on function public.soft_delete_transaction(text, uuid) from public, anon';
    execute 'grant execute on function public.soft_delete_transaction(text, uuid) to authenticated';
  end if;
end $$;

-- ─── 2. Versiones de documentos legales ─────────────────────────────────────

create table if not exists public.legal_document_versions (
  document     text        not null check (document in ('privacy', 'terms', 'ai', 'cookies')),
  version      text        not null,
  published_at timestamptz not null default now(),
  summary      text,
  created_at   timestamptz not null default now(),
  primary key (document, version)
);

alter table public.legal_document_versions enable row level security;

drop policy if exists "legal_document_versions: lectura pública" on public.legal_document_versions;
create policy "legal_document_versions: lectura pública"
  on public.legal_document_versions for select
  to anon, authenticated
  using (true);

insert into public.legal_document_versions (document, version, summary) values
  ('privacy', '1.0.0', 'Política de Tratamiento de Datos Personales — versión inicial'),
  ('terms',   '1.0.0', 'Términos y Condiciones — versión inicial'),
  ('ai',      '1.0.0', 'Aviso sobre Finn e inteligencia artificial — versión inicial'),
  ('cookies', '1.0.0', 'Política de cookies de la landing — versión inicial')
on conflict (document, version) do nothing;

-- ─── 3. Consentimientos (append-only) ───────────────────────────────────────
-- Cada aceptación o revocación es una fila nueva: el historial completo es la
-- prueba de la autorización. El estado vigente es la fila más reciente por tipo.

create table if not exists public.user_consents (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users on delete cascade,
  consent_type     text        not null check (consent_type in
                     ('privacy', 'terms', 'ai_processing', 'marketing', 'age_confirmation')),
  document_version text        not null check (char_length(document_version) <= 20),
  granted          boolean     not null,
  source           text        not null default 'app' check (source in
                     ('registration', 'consent_gate', 'privacy_center', 'finn', 'app')),
  app_version      text        check (char_length(app_version) <= 20),
  platform         text        check (char_length(platform) <= 20),
  created_at       timestamptz not null default now()
);

create index if not exists user_consents_user_type_idx
  on public.user_consents (user_id, consent_type, created_at desc);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents: insertar propio" on public.user_consents;
create policy "user_consents: insertar propio"
  on public.user_consents for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_consents: leer propio" on public.user_consents;
create policy "user_consents: leer propio"
  on public.user_consents for select
  to authenticated
  using (user_id = (select auth.uid()));
-- Sin UPDATE ni DELETE: el registro es inmutable para el cliente.

create or replace function public.current_consents()
returns table (consent_type text, document_version text, granted boolean, created_at timestamptz)
language sql
security invoker
set search_path = public
stable
as $$
  select distinct on (c.consent_type) c.consent_type, c.document_version, c.granted, c.created_at
  from public.user_consents c
  where c.user_id = (select auth.uid())
  order by c.consent_type, c.created_at desc;
$$;

revoke all on function public.current_consents() from public, anon;
grant execute on function public.current_consents() to authenticated;

-- ─── 4. Solicitudes de derechos del titular ─────────────────────────────────
-- Plazos legales (Ley 1581): consultas 10 días hábiles (art. 14), reclamos 15
-- días hábiles (art. 15). Se guarda el plazo aplicable; el cómputo de días
-- hábiles y la respuesta los gestiona el responsable (panel/soporte).

create table if not exists public.privacy_requests (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users on delete set null,
  request_type        text        not null check (request_type in
                        ('consulta', 'actualizacion', 'rectificacion', 'supresion',
                         'revocatoria', 'reclamo', 'otro')),
  details             text        check (char_length(details) <= 2000),
  status              text        not null default 'recibida' check (status in
                        ('recibida', 'en_tramite', 'respondida', 'cerrada')),
  legal_deadline_days integer     not null default 15,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  responded_at        timestamptz
);

create index if not exists privacy_requests_user_idx on public.privacy_requests (user_id, created_at desc);
create index if not exists privacy_requests_status_idx on public.privacy_requests (status, created_at);

alter table public.privacy_requests enable row level security;

drop policy if exists "privacy_requests: crear propia" on public.privacy_requests;
create policy "privacy_requests: crear propia"
  on public.privacy_requests for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'recibida' and responded_at is null);

drop policy if exists "privacy_requests: leer propias" on public.privacy_requests;
create policy "privacy_requests: leer propias"
  on public.privacy_requests for select
  to authenticated
  using (user_id = (select auth.uid()));
-- El cambio de estado lo hace solo el responsable (service_role).

create or replace function public.privacy_requests_set_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.legal_deadline_days := case when new.request_type = 'consulta' then 10 else 15 end;
  return new;
end;
$$;

revoke all on function public.privacy_requests_set_deadline() from public, anon, authenticated;

drop trigger if exists privacy_requests_deadline on public.privacy_requests;
create trigger privacy_requests_deadline
  before insert on public.privacy_requests
  for each row execute function public.privacy_requests_set_deadline();

drop trigger if exists privacy_requests_updated_at on public.privacy_requests;
create trigger privacy_requests_updated_at
  before update on public.privacy_requests
  for each row execute function public.handle_updated_at();

-- ─── 5. Libro de pagos (lo escribe solo el Worker con service_role) ──────────
-- ON DELETE SET NULL: al eliminar la cuenta se conserva el soporte mínimo del
-- pago (id Wompi, monto, fecha) desvinculado del usuario.
-- REQUIERE VALIDACIÓN JURÍDICA/CONTABLE: plazo de conservación de soportes.

create table if not exists public.payment_transactions (
  wompi_transaction_id text        primary key,
  user_id              uuid        references auth.users on delete set null,
  plan                 text        check (plan in ('mensual', 'anual')),
  amount_in_cents      bigint      not null check (amount_in_cents >= 0),
  currency             text        not null default 'COP',
  status               text        not null,
  reference            text,
  paid_at              timestamptz,
  credited             boolean     not null default false,
  credited_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists payment_transactions_user_idx on public.payment_transactions (user_id);

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions: lectura propia" on public.payment_transactions;
create policy "payment_transactions: lectura propia"
  on public.payment_transactions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.handle_updated_at();

-- ─── 6. Registro de eliminaciones (sin datos personales directos) ───────────

create table if not exists public.account_deletion_log (
  id           bigserial   primary key,
  subject_hash text        not null,
  had_payments boolean     not null default false,
  reason       text        not null default 'user_request',
  deleted_at   timestamptz not null default now()
);

alter table public.account_deletion_log enable row level security;
-- Sin políticas: solo service_role.

-- ─── 7. Eliminación de cuenta por el titular ────────────────────────────────
-- Borra el usuario de auth.users; todas las tablas con FK ON DELETE CASCADE se
-- eliminan con él (perfil, transacciones, categorías, metas, memoria de Finn,
-- alertas, consentimientos, entitlement, membresías). Los espacios compartidos
-- CREADOS por el usuario se eliminan para todos sus miembros (se advierte en la
-- app). Se conservan, desvinculados, los soportes de pago y las solicitudes de
-- derechos (sin su texto libre).

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid   uuid := auth.uid();
  pagos boolean;
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select exists (select 1 from public.payment_transactions where user_id = uid) into pagos;

  insert into public.account_deletion_log (subject_hash, had_payments)
  values (encode(extensions.digest(uid::text, 'sha256'), 'hex'), pagos);

  update public.privacy_requests set details = null where user_id = uid;

  delete from auth.users where id = uid;

  return jsonb_build_object('deleted', true, 'payment_records_retained', pagos);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─── 8. Exportación de datos del titular (portabilidad / derecho de acceso) ──
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
