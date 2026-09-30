-- ═══════════════════════════════════════════════════════════════════════════
-- Captura automática — Fase 2: consentimiento para leer notificaciones
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (2026-09-30): en Android, Finn puede leer las notificaciones de las
-- apps que el usuario elija (SMS, bancos, correo) para registrar compras.
-- Es una finalidad nueva y específica (Ley 1581 de 2012, art. 9; Decreto
-- 1377 de 2013, art. 5): se pide una autorización propia, previa, expresa e
-- informada, y queda registrada aquí como prueba (art. 7 del Decreto 1377).
-- Google Play exige además una divulgación destacada antes de pedir el acceso.
--
-- Idempotente y no destructiva.

alter table public.user_consents
  drop constraint if exists user_consents_consent_type_check;
alter table public.user_consents
  add constraint user_consents_consent_type_check check (consent_type in
    ('privacy', 'terms', 'ai_processing', 'marketing', 'age_confirmation', 'capture_notifications'));
