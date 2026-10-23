-- Evaluación controlada y certificación: solicitudes de reactivación, decisiones de certificación, resumen
-- consolidado del ciclo formativo, resultado detallado de Tipifica y versión de contenido del examen general.
-- Además ajusta el catálogo: un intento por evaluación oficial, teoría obligatoria en la inducción (examen
-- diagnóstico solo para asesores con experiencia), seis ejercicios de Tipifica y el módulo «Examen general».
-- No borra datos: las versiones anteriores de evaluaciones y configuración se archivan. Idempotente en los datos.

-- CreateEnum
CREATE TYPE "induccion"."ReactivationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "induccion"."CertificationDecisionType" AS ENUM ('APPROVED', 'RETURNED');

-- AlterTable
ALTER TABLE "induccion"."evaluaciones" ADD COLUMN     "content_version" INTEGER,
ADD COLUMN     "question_count" INTEGER;

-- AlterTable
ALTER TABLE "induccion"."respuestas_intento" ADD COLUMN "position" INTEGER;

-- AlterTable
ALTER TABLE "induccion"."certificados" ADD COLUMN "celebrated_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "induccion"."resultados_tipificacion" ADD COLUMN     "checks" JSONB,
ADD COLUMN     "exercise_key" VARCHAR(40),
ADD COLUMN     "fields" JSONB,
ADD COLUMN     "met_count" INTEGER,
ADD COLUMN     "rules_version" INTEGER,
ADD COLUMN     "scenario_version" INTEGER,
ADD COLUMN     "unmet_count" INTEGER;

-- CreateTable
CREATE TABLE "induccion"."solicitudes_reactivacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "attempt_id" UUID,
    "status" "induccion"."ReactivationStatus" NOT NULL DEFAULT 'PENDING',
    "advisor_note" VARCHAR(500),
    "decision_reason" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "override_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_reactivacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."decisiones_certificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "decision" "induccion"."CertificationDecisionType" NOT NULL,
    "reason" TEXT,
    "activity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificate_id" UUID,
    "decided_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisiones_certificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resumen_formacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "training_profile" VARCHAR(20) NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'CERTIFICADO',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "certified_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "certificate_code" VARCHAR(40) NOT NULL,
    "modules" JSONB NOT NULL,
    "activity_scores" JSONB NOT NULL,
    "typification_passed" INTEGER NOT NULL,
    "typification_total" INTEGER NOT NULL,
    "final_exam_score" DECIMAL(5,2),
    "diagnostic_score" DECIMAL(5,2),
    "total_attempts" INTEGER NOT NULL,
    "reactivations" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumen_formacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_reactivacion_override_id_key" ON "induccion"."solicitudes_reactivacion"("override_id");

-- CreateIndex
CREATE INDEX "solicitudes_reactivacion_status_created_at_idx" ON "induccion"."solicitudes_reactivacion"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "solicitudes_reactivacion_user_id_activity_id_created_at_idx" ON "induccion"."solicitudes_reactivacion"("user_id", "activity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "decisiones_certificacion_certificate_id_key" ON "induccion"."decisiones_certificacion"("certificate_id");

-- CreateIndex
CREATE INDEX "decisiones_certificacion_user_id_created_at_idx" ON "induccion"."decisiones_certificacion"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "decisiones_certificacion_decision_created_at_idx" ON "induccion"."decisiones_certificacion"("decision", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "resumen_formacion_certificate_id_key" ON "induccion"."resumen_formacion"("certificate_id");

-- CreateIndex
CREATE INDEX "resumen_formacion_certified_at_idx" ON "induccion"."resumen_formacion"("certified_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "resumen_formacion_user_id_cycle_key" ON "induccion"."resumen_formacion"("user_id", "cycle");

-- AddForeignKey
ALTER TABLE "induccion"."solicitudes_reactivacion" ADD CONSTRAINT "solicitudes_reactivacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."solicitudes_reactivacion" ADD CONSTRAINT "solicitudes_reactivacion_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."solicitudes_reactivacion" ADD CONSTRAINT "solicitudes_reactivacion_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."solicitudes_reactivacion" ADD CONSTRAINT "solicitudes_reactivacion_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."solicitudes_reactivacion" ADD CONSTRAINT "solicitudes_reactivacion_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "induccion"."excepciones_actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."decisiones_certificacion" ADD CONSTRAINT "decisiones_certificacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."decisiones_certificacion" ADD CONSTRAINT "decisiones_certificacion_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."decisiones_certificacion" ADD CONSTRAINT "decisiones_certificacion_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "induccion"."certificados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resumen_formacion" ADD CONSTRAINT "resumen_formacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resumen_formacion" ADD CONSTRAINT "resumen_formacion_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resumen_formacion" ADD CONSTRAINT "resumen_formacion_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "induccion"."certificados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Restricciones que Prisma no expresa: una solicitud pendiente por asesor y actividad, y un solo
-- certificado activo por asesor (evita emisiones duplicadas por refrescos o peticiones simultáneas).
-- ---------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reactivacion_pendiente"
  ON "induccion"."solicitudes_reactivacion" ("user_id", "activity_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS "uq_certificados_activo"
  ON "induccion"."certificados" ("user_id") WHERE "status" = 'ACTIVE';

-- ---------------------------------------------------------------------------------------------
-- Módulo 02 «Inducción a las cobranzas»: la teoría pasa a ser la actividad obligatoria y el examen
-- inicial queda como diagnóstico exclusivo del asesor con experiencia (no obligatorio, un intento).
-- ---------------------------------------------------------------------------------------------
UPDATE "induccion"."actividades" a
SET "is_required" = true, "title" = 'Teoría de la inducción a las cobranzas', "updated_at" = now()
FROM "induccion"."modulos_formacion" m
WHERE a."module_id" = m."id" AND m."slug" = 'induccion-cobranzas' AND a."order" = 1 AND a."type" = 'LESSON';

UPDATE "induccion"."actividades" a
SET "is_required" = false, "title" = 'Examen diagnóstico (asesores con experiencia)', "updated_at" = now()
FROM "induccion"."modulos_formacion" m
WHERE a."module_id" = m."id" AND m."slug" = 'induccion-cobranzas' AND a."order" = 2 AND a."type" = 'QUIZ';

-- Quien ya tenía el sello del módulo conserva la teoría como aprobada (su sello y su examen no cambian).
INSERT INTO "induccion"."progreso_actividad" ("user_id", "activity_id", "status", "started_at", "completed_at", "last_activity_at", "updated_at")
SELECT s."user_id", a."id", 'PASSED', s."issued_at", s."issued_at", s."issued_at", now()
FROM "induccion"."sellos" s
JOIN "induccion"."modulos_formacion" m ON m."id" = s."module_id" AND m."slug" = 'induccion-cobranzas'
JOIN "induccion"."actividades" a ON a."module_id" = m."id" AND a."order" = 1 AND a."type" = 'LESSON'
WHERE s."status" = 'ACTIVE'
ON CONFLICT ("user_id", "activity_id") DO UPDATE
SET "status" = 'PASSED', "completed_at" = COALESCE("induccion"."progreso_actividad"."completed_at", EXCLUDED."completed_at"), "updated_at" = now();

-- ---------------------------------------------------------------------------------------------
-- Versión nueva de cada evaluación oficial con un único intento. Las versiones anteriores se archivan
-- (nunca se editan) y los intentos ya presentados conservan su versión y su resultado.
-- ---------------------------------------------------------------------------------------------
CREATE TEMP TABLE "tmp_un_intento" AS
SELECT e."id", e."activity_id", e."version", e."title", e."minimum_score", e."wait_minutes"
FROM "induccion"."evaluaciones" e
JOIN "induccion"."actividades" a ON a."id" = e."activity_id"
JOIN "induccion"."modulos_formacion" m ON m."id" = a."module_id"
WHERE e."status" = 'ACTIVE' AND e."max_attempts" <> 1
  AND ((m."slug" = 'induccion-cobranzas' AND a."type" = 'QUIZ')
    OR (m."slug" = 'ofimatica-mecanografia' AND a."type" IN ('TYPING', 'EXCEL_PRACTICE', 'DICTATION')));

UPDATE "induccion"."evaluaciones" SET "status" = 'ARCHIVED' WHERE "id" IN (SELECT "id" FROM "tmp_un_intento");

INSERT INTO "induccion"."evaluaciones" ("activity_id", "version", "title", "minimum_score", "max_attempts", "wait_minutes", "status")
SELECT t."activity_id",
       (SELECT max(v."version") FROM "induccion"."evaluaciones" v WHERE v."activity_id" = t."activity_id") + 1,
       t."title", t."minimum_score", 1, 0, 'ACTIVE'
FROM "tmp_un_intento" t;

DROP TABLE "tmp_un_intento";

-- La configuración de Ofimática dice cuántos intentos hay: versión nueva con un intento por prueba
-- (solo una versión ACTIVE por módulo: primero se archiva la vigente).
CREATE TEMP TABLE "tmp_config_ofimatica" AS
SELECT * FROM "induccion"."config_modulo_ofimatica" c
WHERE c."status" = 'ACTIVE' AND (c."typing_max_attempts" <> 1 OR c."excel_max_attempts" <> 1 OR c."dictation_max_attempts" <> 1);

UPDATE "induccion"."config_modulo_ofimatica" SET "status" = 'ARCHIVED' WHERE "id" IN (SELECT "id" FROM "tmp_config_ofimatica");

INSERT INTO "induccion"."config_modulo_ofimatica" (
  "module_key", "version", "status", "typing_duration_seconds", "typing_min_correct_cpm", "typing_min_accuracy",
  "typing_max_attempts", "typing_start_window_seconds", "typing_attempt_ttl_minutes", "excel_min_score", "excel_max_attempts",
  "dictation_min_score", "dictation_max_attempts", "dictation_max_plays", "reason")
SELECT c."module_key", c."version" + 1, 'ACTIVE', c."typing_duration_seconds", c."typing_min_correct_cpm", c."typing_min_accuracy",
       1, c."typing_start_window_seconds", c."typing_attempt_ttl_minutes", c."excel_min_score", 1,
       c."dictation_min_score", 1, c."dictation_max_plays", 'Política de un intento por evaluación oficial'
FROM "tmp_config_ofimatica" c;

DROP TABLE "tmp_config_ofimatica";

-- ---------------------------------------------------------------------------------------------
-- Módulo 04 «Tipifica»: el marcador de posición se convierte en el ejercicio 1 (conserva su id) y se
-- agregan los ejercicios 2 a 6. Cada uno es evaluable: aprueba con el 100 % de sus requisitos, un intento.
-- ---------------------------------------------------------------------------------------------
UPDATE "induccion"."actividades" a
SET "type" = 'TYPIFICATION', "title" = 'Ejercicio 1: Contacto con el titular', "status" = 'ACTIVE', "is_required" = true, "updated_at" = now()
FROM "induccion"."modulos_formacion" m
WHERE a."module_id" = m."id" AND m."slug" = 'tipificacion-llamadas' AND a."order" = 1 AND a."type" = 'PLACEHOLDER';

INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
SELECT m."id", 'TYPIFICATION', x."order", 'ACTIVE', x."title", true, m."route", now()
FROM "induccion"."modulos_formacion" m
CROSS JOIN (VALUES
  (2, 'Ejercicio 2: Contacto con un tercero'),
  (3, 'Ejercicio 3: Promesa de pago'),
  (4, 'Ejercicio 4: Solicitud de devolución de llamada'),
  (5, 'Ejercicio 5: Pago ya realizado'),
  (6, 'Ejercicio 6: Número equivocado o no contacto')
) AS x("order", "title")
WHERE m."slug" = 'tipificacion-llamadas'
ON CONFLICT ("module_id", "order") DO NOTHING;

INSERT INTO "induccion"."evaluaciones" ("activity_id", "version", "title", "minimum_score", "max_attempts", "wait_minutes", "status", "content_version")
SELECT a."id", 1, a."title", 100, 1, 0, 'ACTIVE', 1
FROM "induccion"."actividades" a
JOIN "induccion"."modulos_formacion" m ON m."id" = a."module_id" AND m."slug" = 'tipificacion-llamadas'
WHERE a."type" = 'TYPIFICATION'
  AND NOT EXISTS (SELECT 1 FROM "induccion"."evaluaciones" e WHERE e."activity_id" = a."id");

-- ---------------------------------------------------------------------------------------------
-- Módulo 05 «Examen general» (ABCD), obligatorio para ambos perfiles después de Tipifica.
-- El certificado pasa al orden 6 y exige también su sello.
-- ---------------------------------------------------------------------------------------------
UPDATE "induccion"."modulos_formacion" SET "order" = 6, "updated_at" = now() WHERE "slug" = 'certificado' AND "order" = 5;

INSERT INTO "induccion"."modulos_formacion" ("slug", "name", "description", "order", "status", "is_required", "route", "updated_at")
VALUES ('examen-general', 'Examen general', 'Evaluación integral de selección múltiple (A, B, C, D) de toda la formación.', 5, 'ACTIVE', true, '/induccion/modulos/examen-general', now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "induccion"."prerrequisitos_modulo" ("module_id", "prerequisite_module_id")
SELECT g."id", t."id"
FROM "induccion"."modulos_formacion" g, "induccion"."modulos_formacion" t
WHERE g."slug" = 'examen-general' AND t."slug" = 'tipificacion-llamadas'
ON CONFLICT DO NOTHING;

INSERT INTO "induccion"."prerrequisitos_modulo" ("module_id", "prerequisite_module_id")
SELECT c."id", g."id"
FROM "induccion"."modulos_formacion" c, "induccion"."modulos_formacion" g
WHERE c."slug" = 'certificado' AND g."slug" = 'examen-general'
ON CONFLICT DO NOTHING;

INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "updated_at")
SELECT m."id", 'QUIZ', 1, 'ACTIVE', 'Examen general ABCD', true, m."route", now()
FROM "induccion"."modulos_formacion" m WHERE m."slug" = 'examen-general'
ON CONFLICT ("module_id", "order") DO NOTHING;

INSERT INTO "induccion"."evaluaciones" ("activity_id", "version", "title", "minimum_score", "max_attempts", "wait_minutes", "status", "question_count", "content_version")
SELECT a."id", 1, 'Examen general ABCD', 80, 1, 0, 'ACTIVE', 30, 1
FROM "induccion"."actividades" a
JOIN "induccion"."modulos_formacion" m ON m."id" = a."module_id" AND m."slug" = 'examen-general'
WHERE a."order" = 1 AND NOT EXISTS (SELECT 1 FROM "induccion"."evaluaciones" e WHERE e."activity_id" = a."id");
