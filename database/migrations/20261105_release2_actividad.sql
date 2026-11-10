BEGIN;

ALTER TABLE public.residuo ADD COLUMN IF NOT EXISTS puntos_ganados DOUBLE PRECISION;
ALTER TABLE public.historialreciclaje ADD COLUMN IF NOT EXISTS fecha_instante TIMESTAMPTZ;

-- No reinterpretar históricos inválidos ni elegir silenciosamente una fecha.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.residuo
             WHERE tipo NOT IN ('plastico', 'papel/carton', 'vidrio')
                OR NOT (peso > 0 AND peso < 'Infinity'::DOUBLE PRECISION)) THEN
    RAISE EXCEPTION 'R2: hay residuos históricos con material o peso inválido; revisar antes de migrar';
  END IF;
  IF EXISTS (
    SELECT h.id_residuo FROM public.historialreciclaje h
    JOIN public.residuo r ON r.id_residuo = h.id_residuo
    GROUP BY h.id_residuo
    HAVING COUNT(DISTINCT h.fecha) > 1
        OR BOOL_OR(h.id_user <> r.id_user OR h.id_tacho <> r.id_tacho)
        OR COUNT(DISTINCT h.fecha_instante) > 1
        OR BOOL_OR(h.fecha_instante IS NOT NULL
                   AND (h.fecha_instante AT TIME ZONE 'America/Lima')::DATE <> h.fecha)
  ) THEN
    RAISE EXCEPTION 'R2: historial contradictorio; revisar usuario, tacho, fecha e instante antes de migrar';
  END IF;
END
$$;

-- Tarifa histórica confirmada por el usuario. No modificar saldos ni DATE.
UPDATE public.residuo SET puntos_ganados = peso * 10 WHERE puntos_ganados IS NULL;
ALTER TABLE public.residuo ALTER COLUMN puntos_ganados SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'residuo_puntos_ganados_validos'
                   AND conrelid = 'public.residuo'::regclass) THEN
    ALTER TABLE public.residuo ADD CONSTRAINT residuo_puntos_ganados_validos
      CHECK (puntos_ganados >= 0 AND puntos_ganados < 'Infinity'::DOUBLE PRECISION);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS historialreciclaje_residuo_idx ON public.historialreciclaje (id_residuo);
CREATE INDEX IF NOT EXISTS historialreciclaje_fecha_usuario_idx ON public.historialreciclaje (fecha, id_user);
CREATE INDEX IF NOT EXISTS historialreciclaje_instante_idx ON public.historialreciclaje (fecha_instante)
  WHERE fecha_instante IS NOT NULL;

-- Una fila por residuo. Repeticiones idénticas del historial no multiplican sumas.
-- 'consistente' permite rechazar también contradicciones introducidas después
-- de migrar, sin inventar cuál fila representa la actividad.
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
