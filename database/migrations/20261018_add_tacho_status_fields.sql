BEGIN;

ALTER TABLE public.tachointeligente
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(32),
  ADD COLUMN IF NOT EXISTS porcentaje FLOAT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tachointeligente_porcentaje_rango'
      AND conrelid = 'public.tachointeligente'::regclass
  ) THEN
    ALTER TABLE public.tachointeligente
      ADD CONSTRAINT tachointeligente_porcentaje_rango
      CHECK (porcentaje IS NULL OR (porcentaje >= 0 AND porcentaje <= 100));
  END IF;
END
$$;

COMMIT;
