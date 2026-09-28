-- ═══════════════════════════════════════════════════════════════════════════
-- «Reiniciar app» con supresión real + retención de borrados lógicos
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (auditoría 2026-09-28):
-- * «Reiniciar app» marcaba transacciones y categorías con `deleted_at` y las
--   dejaba en el servidor indefinidamente, aunque el mensaje prometía borrarlas
--   de la nube (Ley 1581, art. 8 lit. e: supresión).
-- * `purge_old_soft_deletes()` existía pero nada la ejecutaba.
-- * Requiere 20260617_create_metas_deudas_recurrentes (aplicada en esta misma
--   fecha; estaba en el repo pero nunca se había desplegado).

-- ─── 1. reset_my_data(): borra los datos financieros, conserva la cuenta ────
-- Se BORRA (físicamente): transacciones, categorías, perfil financiero, meta,
-- nivel (vuelve al inicial), memoria de Finn, alertas y preferencias de alertas,
-- metas, deudas y gastos recurrentes; y se limpia el progreso en `profiles`.
-- Se CONSERVA (la cuenta sigue viva): nombre, consentimientos vigentes,
-- entitlement Premium pagado, soportes de pago, solicitudes de derechos y
-- espacios compartidos (son también de otros miembros).

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

comment on function public.reset_my_data() is
  'Reiniciar app: supresión física de los datos financieros del titular; la cuenta se conserva.';

-- ─── 2. Purga programada de borrados lógicos ────────────────────────────────
-- Borrar un movimiento o categoría individual sigue siendo lógico (`deleted_at`)
-- para que el borrado llegue a los demás dispositivos del usuario. Pasados 30
-- días esas marcas ya no son necesarias y se eliminan físicamente.

revoke all on function public.purge_old_soft_deletes(integer) from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-soft-deletes';
select cron.schedule(
  'purge-soft-deletes',
  '17 3 * * *',                                    -- todos los días, 03:17 UTC
  $$select public.purge_old_soft_deletes(30)$$
);
