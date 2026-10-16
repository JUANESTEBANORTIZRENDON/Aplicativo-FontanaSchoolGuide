-- Lectura del estado de formación de un asesor en una sola llamada a la base de datos.
-- Antes el servidor hacía ocho consultas seguidas (catálogo, progreso, sellos, excepciones, evaluaciones,
-- intentos y cupos); con la latencia de Neon cada ida y vuelta sumaba. Solo lee: no modifica datos.
-- Las reglas de negocio (disponibilidad, bloqueos) siguen en el servidor; la función solo entrega los datos.
CREATE OR REPLACE FUNCTION "induccion"."fn_estado_formacion"(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH mods AS (
    SELECT m.* FROM "induccion"."modulos_formacion" m WHERE m."status" IN ('ACTIVE', 'INACTIVE')
  ),
  acts AS (
    SELECT a.* FROM "induccion"."actividades" a
    JOIN mods m ON m."id" = a."module_id"
    WHERE a."status" IN ('ACTIVE', 'INACTIVE')
  ),
  evs AS (
    SELECT DISTINCT ON (e."activity_id") e.*
    FROM "induccion"."evaluaciones" e
    JOIN acts a ON a."id" = e."activity_id"
    WHERE e."status" = 'ACTIVE'
    ORDER BY e."activity_id", e."version" DESC
  )
  SELECT jsonb_build_object(
    'modules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m."id", 'slug', m."slug", 'name', m."name", 'description', m."description", 'order', m."order",
        'status', m."status", 'isRequired', m."is_required", 'route', m."route",
        'createdAt', m."created_at", 'updatedAt', m."updated_at",
        'prerequisites', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('prerequisite', jsonb_build_object('id', p."id", 'name', p."name", 'slug', p."slug")))
          FROM "induccion"."prerrequisitos_modulo" pr
          JOIN "induccion"."modulos_formacion" p ON p."id" = pr."prerequisite_module_id"
          WHERE pr."module_id" = m."id"
        ), '[]'::jsonb),
        'activities', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', a."id", 'moduleId', a."module_id", 'type', a."type", 'order', a."order", 'status', a."status",
            'title', a."title", 'isRequired', a."is_required", 'route', a."route", 'version', a."version",
            'createdAt', a."created_at", 'updatedAt', a."updated_at"
          ) ORDER BY a."order")
          FROM acts a WHERE a."module_id" = m."id"
        ), '[]'::jsonb)
      ) ORDER BY m."order")
      FROM mods m
    ), '[]'::jsonb),
    'moduleProgress', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('moduleId', pm."module_id", 'status', pm."status", 'lastActivityAt', pm."last_activity_at"))
      FROM "induccion"."progreso_modulo" pm WHERE pm."user_id" = p_user
    ), '[]'::jsonb),
    'activityProgress', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('activityId', pa."activity_id", 'status', pa."status"))
      FROM "induccion"."progreso_actividad" pa WHERE pa."user_id" = p_user
    ), '[]'::jsonb),
    'seals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('moduleId', s."module_id"))
      FROM "induccion"."sellos" s WHERE s."user_id" = p_user AND s."status" = 'ACTIVE'
    ), '[]'::jsonb),
    'overrides', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o."id", 'activityId', o."activity_id", 'action', o."action", 'extraAttempts', o."extra_attempts",
        'expiresAt', o."expires_at", 'revokedAt', o."revoked_at", 'consumedAt', o."consumed_at", 'createdAt', o."created_at"
      ) ORDER BY o."created_at")
      FROM "induccion"."excepciones_actividad" o WHERE o."user_id" = p_user
    ), '[]'::jsonb),
    'evaluations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e."id", 'activityId', e."activity_id", 'version', e."version", 'title', e."title",
        'minimumScore', e."minimum_score"::text, 'maxAttempts', e."max_attempts", 'waitMinutes', e."wait_minutes",
        'status', e."status", 'createdAt', e."created_at"
      ))
      FROM evs e
    ), '[]'::jsonb),
    'attempts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i."id", 'number', i."number", 'status', i."status", 'overrideId', i."override_id",
        'submittedAt', i."submitted_at", 'startedAt', i."started_at", 'evaluationId', i."evaluation_id", 'activityId', ev."activity_id"
      ))
      FROM "induccion"."intentos" i
      JOIN "induccion"."evaluaciones" ev ON ev."id" = i."evaluation_id"
      WHERE i."user_id" = p_user AND ev."activity_id" IN (SELECT e."activity_id" FROM evs e)
    ), '[]'::jsonb),
    'attemptLimits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('activityId', l."activity_id", 'maxAttempts', l."max_attempts"))
      FROM "induccion"."limites_intento_usuario" l WHERE l."user_id" = p_user
    ), '[]'::jsonb)
  );
$$;
