-- ═══════════════════════════════════════════════════════════════
-- TABLA: metas (savings goals locales)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.metas (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL CHECK (char_length(nombre) <= 200),
  monto_objetivo  NUMERIC(14,2) NOT NULL CHECK (monto_objetivo >= 0),
  monto_actual    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monto_actual >= 0),
  emoji           TEXT        NOT NULL DEFAULT '🎯' CHECK (char_length(emoji) <= 10),
  color           TEXT        NOT NULL DEFAULT '#2563eb',
  fecha_limite    DATE,
  completada      BOOLEAN     NOT NULL DEFAULT FALSE,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_owner" ON public.metas
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_metas_user_id ON public.metas (user_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: deudas
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.deudas (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL CHECK (char_length(nombre) <= 200),
  monto_original  NUMERIC(14,2) NOT NULL CHECK (monto_original >= 0),
  saldo           NUMERIC(14,2) NOT NULL CHECK (saldo >= 0),
  tasa_mensual    NUMERIC(8,4)  NOT NULL DEFAULT 0 CHECK (tasa_mensual >= 0),
  cuota_mensual   NUMERIC(14,2) NOT NULL CHECK (cuota_mensual >= 0),
  dia_pago        SMALLINT    CHECK (dia_pago BETWEEN 1 AND 31),
  pagos           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  saldada         BOOLEAN     NOT NULL DEFAULT FALSE,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deudas_owner" ON public.deudas
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_deudas_user_id ON public.deudas (user_id);

-- ═══════════════════════════════════════════════════════════════
-- TABLA: gastos_recurrentes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.gastos_recurrentes (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL CHECK (char_length(nombre) <= 200),
  monto           NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  categoria       TEXT        NOT NULL CHECK (char_length(categoria) <= 100),
  frecuencia      TEXT        NOT NULL CHECK (frecuencia IN ('diario','semanal','quincenal','mensual','anual')),
  dia_pago        SMALLINT    CHECK (dia_pago BETWEEN 1 AND 31),
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  proximo_pago    DATE,
  descripcion     TEXT        CHECK (char_length(descripcion) <= 500),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurrentes_owner" ON public.gastos_recurrentes
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_recurrentes_user_id ON public.gastos_recurrentes (user_id);

-- ═══════════════════════════════════════════════════════════════
-- Trigger updated_at para las 3 tablas
-- ═══════════════════════════════════════════════════════════════
CREATE TRIGGER trg_metas_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_deudas_updated_at
  BEFORE UPDATE ON public.deudas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_recurrentes_updated_at
  BEFORE UPDATE ON public.gastos_recurrentes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
