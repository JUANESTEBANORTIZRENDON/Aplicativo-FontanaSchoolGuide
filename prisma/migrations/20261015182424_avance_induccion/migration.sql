-- Avance del asesor en "Conoce la empresa": una vez terminada la historia o el método de trabajo,
-- sus bloqueos no vuelven a activarse. Solo agrega columnas opcionales; no modifica datos existentes
-- salvo marcar como completados a quienes ya respondieron la pregunta de experiencia.
-- AlterTable
ALTER TABLE "induccion"."usuarios" ADD COLUMN     "fecha_historia_completada" TIMESTAMPTZ(6),
ADD COLUMN     "fecha_metodo_completado" TIMESTAMPTZ(6);

-- Responder la experiencia exige haber terminado la historia y el método.
UPDATE "induccion"."usuarios"
SET "fecha_historia_completada" = "fecha_respuesta_experiencia",
    "fecha_metodo_completado" = "fecha_respuesta_experiencia"
WHERE "tiene_experiencia_cobranzas_digitales" IS NOT NULL
  AND "fecha_respuesta_experiencia" IS NOT NULL;
