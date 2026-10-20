-- El módulo 04 «Tipificación de llamadas» pasa a llamarse «Tipifica»: practica la tipificación en el clon de Control Next.
-- Se conserva el slug técnico (tipificacion-llamadas), la ruta, el progreso, los sellos y la dependencia del certificado.
-- Solo cambian el nombre visible y el título de su actividad. Idempotente.
UPDATE "induccion"."modulos_formacion"
SET "name" = 'Tipifica', "updated_at" = now()
WHERE "slug" = 'tipificacion-llamadas'
  AND "name" <> 'Tipifica';

UPDATE "induccion"."actividades"
SET "title" = 'Tipifica: práctica en Control Next', "updated_at" = now()
WHERE "module_id" IN (SELECT "id" FROM "induccion"."modulos_formacion" WHERE "slug" = 'tipificacion-llamadas')
  AND "order" = 1
  AND "title" = 'Tipificación de llamadas: contenido en preparación';
