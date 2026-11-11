BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS residuo_idempotency_key_unique
  ON public.residuo (idempotency_key);

CREATE TABLE IF NOT EXISTS public.mqtt_event_sequence
(
  id_tacho SMALLINT PRIMARY KEY CHECK (id_tacho IN (1, 2, 3)),
  last_event BIGINT NOT NULL DEFAULT 0
    CHECK (last_event >= 0 AND last_event <= 9007199254740991)
);

INSERT INTO public.mqtt_event_sequence (id_tacho, last_event)
VALUES (1, 0), (2, 0), (3, 0)
ON CONFLICT (id_tacho) DO NOTHING;

UPDATE public.mqtt_event_sequence AS secuencia
SET last_event = GREATEST(
  secuencia.last_event,
  COALESCE((
    SELECT MAX(split_part(r.idempotency_key, '-', 4)::NUMERIC)::BIGINT
    FROM public.residuo AS r
    WHERE r.idempotency_key ~ (
      '^tacho-' || secuencia.id_tacho::TEXT || '-(event|evento)-[0-9]+$'
    )
      AND CASE
        WHEN r.idempotency_key ~ (
          '^tacho-' || secuencia.id_tacho::TEXT || '-(event|evento)-[0-9]+$'
        )
        THEN split_part(r.idempotency_key, '-', 4)::NUMERIC <= 9007199254740991
        ELSE FALSE
      END
  ), 0)
);

COMMIT;
