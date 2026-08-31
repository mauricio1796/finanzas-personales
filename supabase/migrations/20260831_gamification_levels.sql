-- ─────────────────────────────────────────────────────────────────────────────
-- Gamificación: ampliar niveles de 1..5 a 1..10
--
-- El motor unificado (src/services/GamificacionService.ts › NIVELES) usa 10
-- niveles. `experience` es la fuente de verdad y `level`/`title` se re-derivan
-- en el cliente al leer, pero conviene que la columna `level` pueda almacenar
-- el valor real para el panel de administración.
--
-- Aplicar con: supabase db push   (o el editor SQL del dashboard)
-- APLICADA: 2026-08-31 vía SQL Editor (proyecto diijivlpcuqxjpyvfavu)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_levels
  drop constraint if exists user_levels_level_check;

alter table public.user_levels
  add constraint user_levels_level_check
  check (level between 1 and 10);


-- Recalcular título de filas existentes según los umbrales de XP del motor.
update public.user_levels set
  level = case
    when experience >= 30000 then 10
    when experience >= 20000 then 9
    when experience >= 14000 then 8
    when experience >= 9500  then 7
    when experience >= 6000  then 6
    when experience >= 3500  then 5
    when experience >= 1800  then 4
    when experience >= 800   then 3
    when experience >= 300   then 2
    else 1
  end,
  title = case
    when experience >= 30000 then 'Gurú Financiero'
    when experience >= 20000 then 'Inversionista'
    when experience >= 14000 then 'Asesor'
    when experience >= 9500  then 'Maestro'
    when experience >= 6000  then 'Experto'
    when experience >= 3500  then 'Analista'
    when experience >= 1800  then 'Estratega'
    when experience >= 800   then 'Gestor'
    when experience >= 300   then 'Aprendiz'
    else 'Principiante'
  end;
