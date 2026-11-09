BEGIN;

ALTER TABLE public.producto
  DROP CONSTRAINT IF EXISTS producto_tipo_valido;

UPDATE public.producto
SET tipo = 'vidrio',
    nombre = 'Producto de vidrio'
WHERE tipo IN ('organico', 'organicos');

ALTER TABLE public.producto
  ADD CONSTRAINT producto_tipo_valido
  CHECK (tipo IN ('plastico', 'pet', 'papel', 'carton', 'papel/carton', 'vidrio'));

COMMIT;
