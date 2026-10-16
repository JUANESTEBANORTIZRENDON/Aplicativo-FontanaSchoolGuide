-- Módulo Ofimática para tus cobranzas: configuración, mecanografía interna, Excel, dictado y avance de secciones.
-- Solo agrega estructuras y datos; no elimina columnas, tablas ni valores.
-- CreateEnum
CREATE TYPE "induccion"."TypingCloseReason" AS ENUM ('COMPLETED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "induccion"."SpellingCategory" AS ENUM ('HOMOFONA', 'TILDE_DIACRITICA', 'FORMA_VERBAL', 'PUNTUACION', 'MAYUSCULA');

-- CreateEnum
CREATE TYPE "induccion"."SpellingSeverity" AS ENUM ('CRITICAL', 'MINOR');

-- CreateEnum
CREATE TYPE "induccion"."RecommendationSource" AS ENUM ('OLLAMA', 'TEMPLATE');

ALTER TABLE "induccion"."progreso_actividad" ADD COLUMN     "last_practice_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "induccion"."config_modulo_ofimatica" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_key" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "typing_duration_seconds" INTEGER NOT NULL DEFAULT 60,
    "typing_min_correct_cpm" INTEGER NOT NULL DEFAULT 150,
    "typing_min_accuracy" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "typing_max_attempts" INTEGER NOT NULL DEFAULT 3,
    "typing_start_window_seconds" INTEGER NOT NULL DEFAULT 15,
    "typing_attempt_ttl_minutes" INTEGER NOT NULL DEFAULT 10,
    "excel_min_score" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "excel_max_attempts" INTEGER NOT NULL DEFAULT 3,
    "dictation_min_score" DECIMAL(5,2) NOT NULL DEFAULT 85,
    "dictation_max_attempts" INTEGER NOT NULL DEFAULT 3,
    "dictation_max_plays" INTEGER NOT NULL DEFAULT 2,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_modulo_ofimatica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."activity_section_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "section_key" VARCHAR(60) NOT NULL,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_section_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."textos_mecanografia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textos_mecanografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_mecanografia_interna" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "text_id" UUID NOT NULL,
    "text_version" INTEGER NOT NULL,
    "nonce_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "started_official_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration_seconds" DECIMAL(6,2),
    "typed_text" TEXT,
    "total_characters" INTEGER NOT NULL DEFAULT 0,
    "correct_characters" INTEGER NOT NULL DEFAULT 0,
    "insertions" INTEGER NOT NULL DEFAULT 0,
    "omissions" INTEGER NOT NULL DEFAULT 0,
    "substitutions" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ppm" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "correct_cpm" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN,
    "close_reason" "induccion"."TypingCloseReason",
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "config_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_mecanografia_interna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."actividades_excel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(150) NOT NULL,
    "scenario_data" JSONB NOT NULL,
    "answer_key" JSONB NOT NULL,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividades_excel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_excel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "excel_activity_id" UUID NOT NULL,
    "excel_version" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "config_snapshot" JSONB NOT NULL,
    "score" DECIMAL(5,2),
    "passed" BOOLEAN,
    "step_results" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "resultados_excel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."ejercicios_dictado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(150) NOT NULL,
    "audio_key" VARCHAR(120),
    "audio_duration_seconds" INTEGER,
    "expected_text" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "critical_rule_keys" TEXT[],
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejercicios_dictado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."reglas_ortografia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" "induccion"."SpellingCategory" NOT NULL,
    "severity" "induccion"."SpellingSeverity" NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "pairs" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglas_ortografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_dictado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "exercise_version" INTEGER NOT NULL,
    "expected_text" TEXT NOT NULL,
    "plays_used" INTEGER NOT NULL DEFAULT 0,
    "typed_text" TEXT,
    "typed_normalized" TEXT,
    "score" DECIMAL(5,2),
    "word_match_percent" DECIMAL(5,2),
    "detected_errors" JSONB,
    "critical_count" INTEGER,
    "passed" BOOLEAN,
    "rules_version" INTEGER,
    "config_snapshot" JSONB NOT NULL,
    "recommendation" JSONB,
    "recommendation_source" "induccion"."RecommendationSource",
    "recommendation_prompt_version" VARCHAR(40),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "resultados_dictado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_modulo_ofimatica_module_key_version_key" ON "induccion"."config_modulo_ofimatica"("module_key", "version");

-- CreateIndex
CREATE INDEX "activity_section_views_activity_id_idx" ON "induccion"."activity_section_views"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_section_views_user_id_activity_id_section_key_key" ON "induccion"."activity_section_views"("user_id", "activity_id", "section_key");

-- CreateIndex
CREATE INDEX "textos_mecanografia_status_idx" ON "induccion"."textos_mecanografia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "textos_mecanografia_key_version_key" ON "induccion"."textos_mecanografia"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_mecanografia_interna_attempt_id_key" ON "induccion"."resultados_mecanografia_interna"("attempt_id");

-- CreateIndex
CREATE INDEX "resultados_mecanografia_interna_text_id_idx" ON "induccion"."resultados_mecanografia_interna"("text_id");

-- CreateIndex
CREATE INDEX "resultados_mecanografia_interna_completed_at_idx" ON "induccion"."resultados_mecanografia_interna"("completed_at");

-- CreateIndex
CREATE INDEX "actividades_excel_status_idx" ON "induccion"."actividades_excel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_excel_key_version_key" ON "induccion"."actividades_excel"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_excel_attempt_id_key" ON "induccion"."resultados_excel"("attempt_id");

-- CreateIndex
CREATE INDEX "resultados_excel_excel_activity_id_idx" ON "induccion"."resultados_excel"("excel_activity_id");

-- CreateIndex
CREATE INDEX "ejercicios_dictado_status_idx" ON "induccion"."ejercicios_dictado"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_dictado_key_version_key" ON "induccion"."ejercicios_dictado"("key", "version");

-- CreateIndex
CREATE INDEX "reglas_ortografia_status_idx" ON "induccion"."reglas_ortografia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reglas_ortografia_key_version_key" ON "induccion"."reglas_ortografia"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_dictado_attempt_id_key" ON "induccion"."resultados_dictado"("attempt_id");

-- CreateIndex
CREATE INDEX "resultados_dictado_exercise_id_idx" ON "induccion"."resultados_dictado"("exercise_id");

-- CreateIndex
CREATE INDEX "resultados_dictado_completed_at_idx" ON "induccion"."resultados_dictado"("completed_at");

-- AddForeignKey
ALTER TABLE "induccion"."config_modulo_ofimatica" ADD CONSTRAINT "config_modulo_ofimatica_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."activity_section_views" ADD CONSTRAINT "activity_section_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."activity_section_views" ADD CONSTRAINT "activity_section_views_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."textos_mecanografia" ADD CONSTRAINT "textos_mecanografia_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_mecanografia_interna" ADD CONSTRAINT "resultados_mecanografia_interna_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_mecanografia_interna" ADD CONSTRAINT "resultados_mecanografia_interna_text_id_fkey" FOREIGN KEY ("text_id") REFERENCES "induccion"."textos_mecanografia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."actividades_excel" ADD CONSTRAINT "actividades_excel_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_excel" ADD CONSTRAINT "resultados_excel_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_excel" ADD CONSTRAINT "resultados_excel_excel_activity_id_fkey" FOREIGN KEY ("excel_activity_id") REFERENCES "induccion"."actividades_excel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."ejercicios_dictado" ADD CONSTRAINT "ejercicios_dictado_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_dictado" ADD CONSTRAINT "resultados_dictado_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_dictado" ADD CONSTRAINT "resultados_dictado_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "induccion"."ejercicios_dictado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Restricciones adicionales que Prisma no modela.
-- ---------------------------------------------------------------------------------------------

-- Una sola configuración vigente por módulo.
CREATE UNIQUE INDEX "uq_config_ofimatica_activa" ON "induccion"."config_modulo_ofimatica" ("module_key") WHERE "status" = 'ACTIVE';

-- Rangos válidos: el servidor también los valida con zod; la base es la última defensa.
ALTER TABLE "induccion"."config_modulo_ofimatica" ADD CONSTRAINT "ck_config_ofimatica_rangos" CHECK (
  "typing_duration_seconds" BETWEEN 10 AND 600
  AND "typing_min_correct_cpm" BETWEEN 1 AND 1200
  AND "typing_min_accuracy" BETWEEN 1 AND 100
  AND "typing_max_attempts" BETWEEN 1 AND 20
  AND "typing_start_window_seconds" BETWEEN 1 AND 120
  AND "typing_attempt_ttl_minutes" BETWEEN 1 AND 120
  AND "excel_min_score" BETWEEN 1 AND 100
  AND "excel_max_attempts" BETWEEN 1 AND 20
  AND "dictation_min_score" BETWEEN 1 AND 100
  AND "dictation_max_attempts" BETWEEN 1 AND 20
  AND "dictation_max_plays" BETWEEN 1 AND 10
);

-- Textos de mecanografía de 650 a 900 caracteres.
ALTER TABLE "induccion"."textos_mecanografia" ADD CONSTRAINT "ck_texto_mecanografia_longitud" CHECK (char_length("content") BETWEEN 650 AND 900);

-- Audio de dictado de 20 a 30 segundos cuando existe.
ALTER TABLE "induccion"."ejercicios_dictado" ADD CONSTRAINT "ck_dictado_audio_duracion" CHECK ("audio_duration_seconds" IS NULL OR "audio_duration_seconds" BETWEEN 20 AND 30);

-- Un ejercicio ACTIVE exige audio (la excepción de desarrollo con DICTATION_DEV_TTS se valida en el servidor,
-- no aquí, para que la base conserve la regla de negocio de producción).

-- ---------------------------------------------------------------------------------------------
-- Migración de datos (idempotente): módulo "Ofimática para tus cobranzas" y sus 5 actividades.
-- No borra nada: el placeholder del orden 1 pasa a ARCHIVED y su historial se conserva.
-- Si el módulo todavía no existe (base nueva), no hace nada: el seed base lo crea.
-- ---------------------------------------------------------------------------------------------

UPDATE "induccion"."modulos_formacion"
SET "name" = 'Ofimática para tus cobranzas', "updated_at" = now()
WHERE "slug" = 'ofimatica-mecanografia' AND "name" <> 'Ofimática para tus cobranzas';

INSERT INTO "induccion"."actividades" ("module_id", "type", "order", "status", "title", "is_required", "route", "version", "updated_at")
SELECT m."id", v."type"::"induccion"."ActivityType", v."order", 'ACTIVE', v."title", v."is_required", m."route" || '/' || v."section", 1, now()
FROM "induccion"."modulos_formacion" m
CROSS JOIN (VALUES
  (10, 'LESSON',         false, 'Bienvenida',           'bienvenida'),
  (20, 'TYPING',         true,  'Mecanografía',         'mecanografia'),
  (30, 'EXCEL_PRACTICE', true,  'Excel para cobranzas', 'excel'),
  (40, 'DICTATION',      true,  'Ortografía aplicada',  'ortografia'),
  (50, 'LESSON',         false, 'Resultado y sello',    'resultado')
) AS v("order", "type", "is_required", "title", "section")
WHERE m."slug" = 'ofimatica-mecanografia'
  AND NOT EXISTS (SELECT 1 FROM "induccion"."actividades" a WHERE a."module_id" = m."id" AND a."order" = v."order");

UPDATE "induccion"."actividades" a
SET "status" = 'ARCHIVED', "updated_at" = now()
FROM "induccion"."modulos_formacion" m
WHERE a."module_id" = m."id" AND m."slug" = 'ofimatica-mecanografia'
  AND a."order" = 1 AND a."type" = 'PLACEHOLDER' AND a."status" <> 'ARCHIVED';

-- Evaluación versión 1 de cada actividad obligatoria. En mecanografía la nota (0 a 100) es informativa:
-- la aprobación sale de caracteres correctos por minuto y precisión (campo passed).
INSERT INTO "induccion"."evaluaciones" ("activity_id", "version", "title", "minimum_score", "max_attempts", "wait_minutes", "status")
SELECT a."id", 1, a."title", v."min_score", 3, 0, 'ACTIVE'
FROM "induccion"."actividades" a
JOIN "induccion"."modulos_formacion" m ON m."id" = a."module_id" AND m."slug" = 'ofimatica-mecanografia'
JOIN (VALUES (20, 100), (30, 80), (40, 85)) AS v("order", "min_score") ON v."order" = a."order"
WHERE NOT EXISTS (SELECT 1 FROM "induccion"."evaluaciones" e WHERE e."activity_id" = a."id");

-- Configuración versión 1 con los valores iniciales del documento.
INSERT INTO "induccion"."config_modulo_ofimatica" ("module_key", "version", "status", "reason")
SELECT 'ofimatica-mecanografia', 1, 'ACTIVE', 'Configuración inicial del módulo'
WHERE NOT EXISTS (SELECT 1 FROM "induccion"."config_modulo_ofimatica" WHERE "module_key" = 'ofimatica-mecanografia');
