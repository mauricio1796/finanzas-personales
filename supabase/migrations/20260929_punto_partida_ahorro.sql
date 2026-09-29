-- Punto de partida del ahorro: cuánto ahorraba el usuario al mes antes de
-- usar Finn. Es la línea base contra la que la app muestra el cambio
-- ("ahorras $X más desde que usas Finn").
--
-- jsonb: { "ahorroMensual": number, "fuente": "declarado" | "calculado", "fecha": ISO }
--
-- Privacidad: vive en la fila de financial_profiles, así que reset_my_data
-- (delete de la fila) y la exportación de datos (to_jsonb de la fila) ya la
-- cubren sin cambios. La app la escribe con un UPDATE aparte y tolera que la
-- columna aún no exista, para no romper la sincronización del perfil.

alter table public.financial_profiles
  add column if not exists punto_partida jsonb;

comment on column public.financial_profiles.punto_partida is
  'Línea base de ahorro mensual antes de Finn: {ahorroMensual, fuente, fecha}.';
