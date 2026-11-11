BEGIN;

ALTER TABLE public.producto
  DROP CONSTRAINT IF EXISTS producto_tipo_valido;

UPDATE public.producto
SET tipo = CASE
  WHEN tipo = 'pet' THEN 'plastico'
  WHEN tipo IN ('papel', 'carton') THEN 'papel/carton'
  ELSE tipo
END
WHERE tipo IN ('pet', 'papel', 'carton');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.producto
    WHERE tipo NOT IN ('plastico', 'papel/carton', 'vidrio')
  ) THEN
    RAISE EXCEPTION 'Clasificar manualmente los productos con tipos de material no permitidos';
  END IF;
END
$$;

ALTER TABLE public.producto
  ADD CONSTRAINT producto_tipo_valido
  CHECK (tipo IN ('plastico', 'papel/carton', 'vidrio'));

COMMIT;
