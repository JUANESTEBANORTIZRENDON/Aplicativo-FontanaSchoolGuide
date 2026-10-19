-- Módulo 03: «Simulador de cobranzas» pasa a ser «Enfréntate a la objeción».
-- Se conservan el registro, el slug (`simulador-cobranzas`), la ruta, el orden y los prerrequisitos para no romper
-- progreso, sellos ni la dependencia de «Tipificación de llamadas» y del certificado. Solo cambian el nombre visible y
-- la actividad obligatoria: el marcador de posición se convierte en una lección activa (mismo registro, sin borrar
-- historial). Es idempotente: se puede ejecutar varias veces sin efectos adicionales.
DO $$
DECLARE
  v_module uuid;
  v_activity uuid;
BEGIN
  SELECT "id" INTO v_module FROM "induccion"."modulos_formacion" WHERE "slug" = 'simulador-cobranzas';
  IF v_module IS NULL THEN
    RETURN; -- instalación sin catálogo: lo crea el seed
  END IF;

  UPDATE "induccion"."modulos_formacion"
  SET "name" = 'Enfréntate a la objeción', "updated_at" = now()
  WHERE "id" = v_module AND "name" <> 'Enfréntate a la objeción';

  SELECT "id" INTO v_activity FROM "induccion"."actividades" WHERE "module_id" = v_module AND "order" = 1;
  IF v_activity IS NULL THEN
    INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
    VALUES (v_module, 'LESSON', 1, 'ACTIVE', 'Enfréntate a la objeción: teoría y examen final', true, '/induccion/modulos/simulador-cobranzas', now());
  ELSE
    UPDATE "induccion"."actividades"
    SET "type" = 'LESSON', "status" = 'ACTIVE', "is_required" = true,
        "title" = 'Enfréntate a la objeción: teoría y examen final',
        "route" = '/induccion/modulos/simulador-cobranzas', "updated_at" = now()
    WHERE "id" = v_activity
      AND ("type" <> 'LESSON' OR "status" <> 'ACTIVE' OR "is_required" = false OR "title" <> 'Enfréntate a la objeción: teoría y examen final');
  END IF;
END
$$;
