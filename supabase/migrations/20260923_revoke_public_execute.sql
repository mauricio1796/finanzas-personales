-- ============================================================
-- Cierre de funciones SECURITY DEFINER expuestas como RPC pública.
--
-- El linter de seguridad de Supabase detectó 5 funciones SECURITY DEFINER
-- invocables por el rol `anon` vía /rest/v1/rpc/. Entre ellas, funciones de
-- TRIGGER que nunca deberían tener un endpoint.
--
-- Revocar EXECUTE a una función de trigger no afecta su funcionamiento:
-- Postgres no comprueba ese permiso al dispararse el trigger.
--
-- Tras aplicar esto, el linter reporta 0 hallazgos para `anon`.
-- ============================================================

revoke all on function public.protect_premium_column() from public, anon, authenticated;
revoke all on function public.handle_new_user()          from public, anon, authenticated;
revoke all on function public.handle_updated_at()        from public, anon, authenticated;

-- `is_active_member` la evalúan las políticas RLS en nombre del usuario que
-- consulta, así que `authenticated` debe conservar EXECUTE; `anon` no.
revoke all on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

-- RPCs reales de la app: solo para usuarios autenticados.
revoke all on function public.get_or_create_alert_preferences(uuid) from public, anon;
grant execute on function public.get_or_create_alert_preferences(uuid) to authenticated;

revoke all on function public.insert_finn_alerta(uuid, text, text, text, text) from public, anon;
grant execute on function public.insert_finn_alerta(uuid, text, text, text, text) to authenticated;
