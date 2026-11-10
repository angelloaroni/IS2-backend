BEGIN;

ALTER TABLE public.producto
  ADD COLUMN IF NOT EXISTS peso_gramos INTEGER;

UPDATE public.producto
SET peso_gramos = CASE tipo
  WHEN 'plastico' THEN 25
  WHEN 'papel/carton' THEN 300
  WHEN 'vidrio' THEN 400
END
WHERE peso_gramos IS NULL;

ALTER TABLE public.producto
  ALTER COLUMN peso_gramos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producto_peso_gramos_positivo'
      AND conrelid = 'public.producto'::regclass
  ) THEN
    ALTER TABLE public.producto
      ADD CONSTRAINT producto_peso_gramos_positivo CHECK (peso_gramos > 0);
  END IF;
END
$$;

COMMIT;
