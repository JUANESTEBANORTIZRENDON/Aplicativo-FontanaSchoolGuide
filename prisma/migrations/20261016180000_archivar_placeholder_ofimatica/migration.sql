-- El marcador de posición original de «Ofimática para tus cobranzas» seguía ACTIVO y obligatorio: contaba como
-- una cuarta actividad imposible de aprobar y el módulo se quedaba en 75 % sin sello. Se archiva (no se borra:
-- conserva su historial). Las actividades reales del módulo no se tocan.
UPDATE "induccion"."actividades"
SET "status" = 'ARCHIVED', "updated_at" = now()
WHERE "type" = 'PLACEHOLDER'
  AND "status" <> 'ARCHIVED'
  AND "module_id" IN (SELECT "id" FROM "induccion"."modulos_formacion" WHERE "slug" = 'ofimatica-mecanografia');
