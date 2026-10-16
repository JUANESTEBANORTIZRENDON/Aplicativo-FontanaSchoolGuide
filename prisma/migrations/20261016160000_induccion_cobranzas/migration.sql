-- Reestructura de los módulos 2 y 3 de la ruta de formación.
--   · El antiguo «Simulador de cobranzas» pasa a llamarse «Inducción a las cobranzas» (mismo registro, así que
--     conserva su progreso, intentos y excepciones). Lleva la introducción y el examen de inducción.
--   · Se crea un módulo nuevo «Simulador de cobranzas» (orden 3) que se habilita al aprobar la inducción.
--   · La pregunta de experiencia sale de la inducción inicial: se guarda cuándo terminó esa inducción.
-- No elimina columnas, tablas ni filas. Si el catálogo ya está reestructurado (o es una base nueva, que arma el
-- seed), la parte de módulos no hace nada.

ALTER TABLE "induccion"."usuarios" ADD COLUMN "fecha_induccion_completada" TIMESTAMPTZ(6);
-- Quien ya respondió la experiencia había terminado la inducción inicial.
UPDATE "induccion"."usuarios" SET "fecha_induccion_completada" = "fecha_respuesta_experiencia" WHERE "fecha_respuesta_experiencia" IS NOT NULL;

DO $$
DECLARE
  v_old uuid;
  v_new uuid;
  v_tip uuid;
  v_cert uuid;
  v_ph uuid;
  v_status "induccion"."CatalogStatus";
BEGIN
  SELECT "id", "status" INTO v_old, v_status FROM "induccion"."modulos_formacion" WHERE "slug" = 'simulador-cobranzas';
  IF v_old IS NULL OR EXISTS (SELECT 1 FROM "induccion"."modulos_formacion" WHERE "slug" = 'induccion-cobranzas') THEN
    RETURN;
  END IF;

  -- Deja libre el orden 3 (el índice único obliga a mover en dos pasos).
  UPDATE "induccion"."modulos_formacion" SET "order" = "order" + 1000 WHERE "order" >= 3;
  UPDATE "induccion"."modulos_formacion" SET "order" = "order" - 999 WHERE "order" >= 1003;

  UPDATE "induccion"."modulos_formacion"
  SET "slug" = 'induccion-cobranzas', "name" = 'Inducción a las cobranzas', "route" = '/induccion/modulos/induccion-cobranzas', "updated_at" = now()
  WHERE "id" = v_old;

  INSERT INTO "induccion"."modulos_formacion" ("slug", "name", "order", "status", "is_required", "route", "updated_at")
  VALUES ('simulador-cobranzas', 'Simulador de cobranzas', 3, v_status, true, '/induccion/modulos/simulador-cobranzas', now())
  RETURNING "id" INTO v_new;

  SELECT "id" INTO v_tip FROM "induccion"."modulos_formacion" WHERE "slug" = 'tipificacion-llamadas';
  SELECT "id" INTO v_cert FROM "induccion"."modulos_formacion" WHERE "slug" = 'certificado';

  -- Prerrequisitos: ofimática → inducción → simulador → tipificación; el certificado exige todos.
  INSERT INTO "induccion"."prerrequisitos_modulo" ("module_id", "prerequisite_module_id") VALUES (v_new, v_old);
  UPDATE "induccion"."prerrequisitos_modulo" SET "prerequisite_module_id" = v_new WHERE "module_id" = v_tip AND "prerequisite_module_id" = v_old;
  IF v_cert IS NOT NULL THEN
    INSERT INTO "induccion"."prerrequisitos_modulo" ("module_id", "prerequisite_module_id") VALUES (v_cert, v_new) ON CONFLICT DO NOTHING;
  END IF;

  -- Actividades de la inducción: introducción (orden 1) y examen (orden 2). El marcador de posición que ya existía
  -- pasa a ser el examen para no perder los intentos registrados sobre él.
  SELECT "id" INTO v_ph FROM "induccion"."actividades" WHERE "module_id" = v_old AND "order" = 1;
  IF v_ph IS NOT NULL THEN
    UPDATE "induccion"."actividades"
    SET "order" = 2, "type" = 'QUIZ', "title" = 'Examen de inducción', "route" = '/induccion/modulos/induccion-cobranzas', "updated_at" = now()
    WHERE "id" = v_ph;
  ELSE
    INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
    VALUES (v_old, 'QUIZ', 2, 'ACTIVE', 'Examen de inducción', true, '/induccion/modulos/induccion-cobranzas', now())
    RETURNING "id" INTO v_ph;
  END IF;
  INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
  VALUES (v_old, 'LESSON', 1, 'ACTIVE', 'Introducción a las cobranzas', false, '/induccion/modulos/induccion-cobranzas', now());
  IF NOT EXISTS (SELECT 1 FROM "induccion"."evaluaciones" WHERE "activity_id" = v_ph) THEN
    INSERT INTO "induccion"."evaluaciones" ("activity_id", "version", "title", "minimum_score", "max_attempts", "wait_minutes", "status")
    VALUES (v_ph, 1, 'Examen de inducción', 80, 3, 0, 'ACTIVE');
  END IF;

  -- El módulo nuevo queda «en preparación» como estaban los demás.
  INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
  VALUES (v_new, 'PLACEHOLDER', 1, 'ACTIVE', 'Simulador de cobranzas: contenido en preparación', true, '/induccion/modulos/simulador-cobranzas', now());
END
$$;
