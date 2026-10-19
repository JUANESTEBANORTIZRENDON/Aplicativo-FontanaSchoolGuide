-- «Enfréntate a la objeción» pasa a ser un módulo solo formativo (sin evaluaciones): su actividad obligatoria deja
-- de mencionar un examen final. Solo cambia el título; el registro y su historial se conservan. Idempotente.
UPDATE "induccion"."actividades"
SET "title" = 'Enfréntate a la objeción: contenido del módulo', "updated_at" = now()
WHERE "module_id" IN (SELECT "id" FROM "induccion"."modulos_formacion" WHERE "slug" = 'simulador-cobranzas')
  AND "order" = 1
  AND "type" = 'LESSON'
  AND "title" = 'Enfréntate a la objeción: teoría y examen final';
