-- La emisión automática no atribuye la aprobación a un administrador ficticio.
-- Los resúmenes y aprobadores históricos se conservan.
ALTER TABLE "induccion"."resumen_formacion" ALTER COLUMN "approved_by_id" DROP NOT NULL;
