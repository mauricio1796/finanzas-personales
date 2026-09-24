-- ============================================================
-- Endurecimiento de space_invitations + corrección del flujo de unión.
--
-- 1. SEGURIDAD: la política de lectura era `USING (auth.uid() IS NOT NULL)`, lo
--    que permitía a CUALQUIER usuario autenticado leer TODAS las invitaciones
--    del sistema y enumerar códigos ajenos.
--
-- 2. BUG FUNCIONAL (detectado al corregir lo anterior): `aceptarInvitacion()`
--    leía `shared_spaces` ANTES de insertarse como miembro, y la política
--    `is_active_member(id)` lo bloqueaba — así que un invitado nuevo nunca
--    podía completar la unión por código.
--
-- Solución: una RPC SECURITY DEFINER que resuelve la invitación por su código
-- EXACTO (solo si está pendiente y vigente) y devuelve lo mínimo necesario para
-- mostrar a qué espacio se une. Las políticas de la tabla vuelven a exigir
-- membresía (ver 20260923_shared_finances_baseline.sql).
-- ============================================================

create or replace function public.buscar_invitacion_por_codigo(p_code text)
returns table (
  id               uuid,
  space_id         uuid,
  code             text,
  status           text,
  expires_at       timestamptz,
  created_at       timestamptz,
  space_name       text,
  space_type       text,
  created_by       uuid,
  space_created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, i.space_id, i.code, i.status, i.expires_at, i.created_at,
         s.name, s.type, s.created_by, s.created_at
  from public.space_invitations i
  join public.shared_spaces s on s.id = i.space_id
  where i.code = upper(btrim(p_code))
    and i.status = 'pendiente'
    and i.expires_at > now()
    and (select auth.uid()) is not null
  limit 1;
$$;

revoke all on function public.buscar_invitacion_por_codigo(text) from public, anon;
grant execute on function public.buscar_invitacion_por_codigo(text) to authenticated;
