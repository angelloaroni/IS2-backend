BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.residuo
    WHERE tipo IS NULL OR tipo NOT IN ('plastico', 'papel/carton', 'vidrio')
  ) THEN
    RAISE EXCEPTION 'Migración de materiales: clasificar manualmente los residuos históricos no permitidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.producto
    WHERE tipo IS NULL
       OR tipo NOT IN ('plastico', 'papel/carton', 'vidrio', 'pet', 'papel', 'carton')
  ) THEN
    RAISE EXCEPTION 'Migración de materiales: clasificar manualmente los productos históricos no permitidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tachointeligente
    WHERE tipo IS NOT NULL AND tipo NOT IN ('plastico', 'papel/carton', 'vidrio')
  ) THEN
    RAISE EXCEPTION 'Migración de materiales: clasificar manualmente los tachos históricos no permitidos';
  END IF;
END
$$;

UPDATE public.producto
SET tipo = CASE
  WHEN tipo = 'pet' THEN 'plastico'
  WHEN tipo IN ('papel', 'carton') THEN 'papel/carton'
  ELSE tipo
END
WHERE tipo IN ('pet', 'papel', 'carton');

ALTER TABLE public.residuo
  DROP CONSTRAINT IF EXISTS residuo_tipo_valido;
ALTER TABLE public.residuo
  ADD CONSTRAINT residuo_tipo_valido
  CHECK (tipo IN ('plastico', 'papel/carton', 'vidrio'));

ALTER TABLE public.producto
  DROP CONSTRAINT IF EXISTS producto_tipo_valido;
ALTER TABLE public.producto
  ADD CONSTRAINT producto_tipo_valido
  CHECK (tipo IN ('plastico', 'papel/carton', 'vidrio'));

ALTER TABLE public.tachointeligente
  DROP CONSTRAINT IF EXISTS tachointeligente_tipo_valido;
ALTER TABLE public.tachointeligente
  ADD CONSTRAINT tachointeligente_tipo_valido
  CHECK (tipo IS NULL OR tipo IN ('plastico', 'papel/carton', 'vidrio'));

CREATE OR REPLACE VIEW public.actividad_reciclaje AS
SELECT r.id_residuo, r.id_user, r.id_tacho, r.tipo, r.peso, r.puntos_ganados,
       MIN(h.fecha) AS fecha, MIN(h.fecha_instante) AS fecha_instante,
       (COUNT(DISTINCT h.fecha) = 1
        AND NOT BOOL_OR(h.id_user <> r.id_user OR h.id_tacho <> r.id_tacho)
        AND COUNT(DISTINCT h.fecha_instante) <= 1
        AND NOT BOOL_OR(h.fecha_instante IS NOT NULL
                        AND (h.fecha_instante AT TIME ZONE 'America/Lima')::DATE <> h.fecha)
        AND r.tipo IN ('plastico', 'papel/carton', 'vidrio')
        AND r.peso > 0 AND r.peso < 'Infinity'::DOUBLE PRECISION) AS consistente
FROM public.residuo r
JOIN public.historialreciclaje h ON h.id_residuo = r.id_residuo
GROUP BY r.id_residuo;

COMMIT;
