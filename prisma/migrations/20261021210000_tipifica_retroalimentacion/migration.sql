-- Tipifica deja de aprobarse o reprobarse: cada ejercicio se presenta una vez, el asesor recibe retroalimentación
-- (qué puntos coincidieron con la llamada) y el conocimiento se confirma en el examen general.
-- Los ejercicios ya presentados y no aprobados pasan a «completados». Se conservan el puntaje, la gestión escrita y los
-- criterios; solo cambia el estado. No toca ninguna otra evaluación. Idempotente.

-- Intentos de Tipifica enviados que quedaron como no aprobados: pasan a completados.
UPDATE "induccion"."intentos" i
SET "status" = 'PASSED'
FROM "induccion"."evaluaciones" e
JOIN "induccion"."actividades" a ON a."id" = e."activity_id"
WHERE e."id" = i."evaluation_id" AND a."type" = 'TYPIFICATION' AND i."status" = 'FAILED' AND i."submitted_at" IS NOT NULL;

-- Avance de la actividad: completada si tiene un intento completado.
UPDATE "induccion"."progreso_actividad" p
SET "status" = 'PASSED', "completed_at" = COALESCE(p."completed_at", now()), "updated_at" = now()
FROM "induccion"."actividades" a
WHERE a."id" = p."activity_id" AND a."type" = 'TYPIFICATION' AND p."status" <> 'PASSED'
  AND EXISTS (
    SELECT 1 FROM "induccion"."intentos" i JOIN "induccion"."evaluaciones" e ON e."id" = i."evaluation_id"
    WHERE e."activity_id" = a."id" AND i."user_id" = p."user_id" AND i."status" = 'PASSED'
  );

-- Ya no hay nada que reactivar en Tipifica: las solicitudes pendientes se cierran y las excepciones sin usar se revocan.
UPDATE "induccion"."solicitudes_reactivacion" r
SET "status" = 'REJECTED', "decision_reason" = 'Tipifica ya no se aprueba ni se reprueba: no necesita reactivación.', "decided_at" = now()
FROM "induccion"."actividades" a
WHERE a."id" = r."activity_id" AND a."type" = 'TYPIFICATION' AND r."status" = 'PENDING';

UPDATE "induccion"."excepciones_actividad" o
SET "revoked_at" = now(), "revoke_reason" = 'Tipifica ya no se aprueba ni se reprueba: no necesita reactivación.'
FROM "induccion"."actividades" a
WHERE a."id" = o."activity_id" AND a."type" = 'TYPIFICATION' AND o."action" IN ('REACTIVATE', 'EXTRA_ATTEMPT')
  AND o."revoked_at" IS NULL AND o."consumed_at" IS NULL;
