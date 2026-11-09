BEGIN;

ALTER TABLE public.producto
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);

UPDATE public.producto
SET nombre = 'Producto ' || cod_producto
WHERE nombre IS NULL;

ALTER TABLE public.producto
  ALTER COLUMN nombre SET NOT NULL;

COMMIT;
