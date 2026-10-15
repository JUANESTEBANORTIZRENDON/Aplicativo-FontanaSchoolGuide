-- CreateEnum
CREATE TYPE "induccion"."CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "induccion"."ProgressStatus" AS ENUM ('NOT_STARTED', 'AVAILABLE', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "induccion"."AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "induccion"."CertificateStatus" AS ENUM ('ACTIVE', 'REVOKED', 'REISSUED');

-- CreateEnum
CREATE TYPE "induccion"."SealStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "induccion"."OverrideAction" AS ENUM ('REACTIVATE', 'UNLOCK', 'EXTRA_ATTEMPT', 'RESET_WAIT', 'REOPEN_MODULE');

-- CreateEnum
CREATE TYPE "induccion"."ActivityType" AS ENUM ('PLACEHOLDER', 'LESSON', 'QUIZ', 'TYPING', 'SIMULATOR', 'TYPIFICATION');

-- CreateEnum
CREATE TYPE "induccion"."WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "induccion"."ExperienceLevel" AS ENUM ('NONE', 'BASIC', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "induccion"."usuarios" ADD COLUMN     "version_sesion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "induccion"."perfiles_asesor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "experience_level" "induccion"."ExperienceLevel",
    "area" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfiles_asesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."modulos_formacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "route" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modulos_formacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."prerrequisitos_modulo" (
    "module_id" UUID NOT NULL,
    "prerequisite_module_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prerrequisitos_modulo_pkey" PRIMARY KEY ("module_id","prerequisite_module_id")
);

-- CreateTable
CREATE TABLE "induccion"."actividades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "type" "induccion"."ActivityType" NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(150) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "route" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."progreso_modulo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "status" "induccion"."ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progreso_modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."progreso_actividad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "status" "induccion"."ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts_used" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progreso_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."evaluaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(150),
    "minimum_score" DECIMAL(5,2) NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "wait_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "induccion"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."intentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "score" DECIMAL(5,2),
    "status" "induccion"."AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "override_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."respuestas_intento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" VARCHAR(100) NOT NULL,
    "option_id" VARCHAR(100),
    "is_correct" BOOLEAN,
    "awarded_score" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_intento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_mecanografia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "attempt_id" UUID,
    "provider_event_id" VARCHAR(150) NOT NULL,
    "wpm" INTEGER NOT NULL,
    "accuracy" DECIMAL(5,2) NOT NULL,
    "errors" INTEGER NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_mecanografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_simulador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "scenario_version" VARCHAR(50) NOT NULL,
    "errors" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_simulador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."resultados_tipificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "catalog_version" VARCHAR(50) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "subcategory" VARCHAR(100),
    "observation" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_tipificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."sellos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "induccion"."SealStatus" NOT NULL DEFAULT 'ACTIVE',
    "evidence_attempt_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sellos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."certificados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "status" "induccion"."CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "file_url" TEXT,
    "previous_certificate_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."excepciones_actividad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "action" "induccion"."OverrideAction" NOT NULL,
    "extra_attempts" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "consumed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."auditoria_admin" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "reason" TEXT,
    "request_id" VARCHAR(100),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "induccion"."eventos_webhook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(50) NOT NULL,
    "provider_event_id" VARCHAR(150) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "status" "induccion"."WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,

    CONSTRAINT "eventos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_asesor_user_id_key" ON "induccion"."perfiles_asesor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_formacion_slug_key" ON "induccion"."modulos_formacion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_formacion_order_key" ON "induccion"."modulos_formacion"("order");

-- CreateIndex
CREATE INDEX "prerrequisitos_modulo_prerequisite_module_id_idx" ON "induccion"."prerrequisitos_modulo"("prerequisite_module_id");

-- CreateIndex
CREATE INDEX "actividades_module_id_status_idx" ON "induccion"."actividades"("module_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_module_id_order_key" ON "induccion"."actividades"("module_id", "order");

-- CreateIndex
CREATE INDEX "progreso_modulo_module_id_status_idx" ON "induccion"."progreso_modulo"("module_id", "status");

-- CreateIndex
CREATE INDEX "progreso_modulo_last_activity_at_idx" ON "induccion"."progreso_modulo"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_modulo_user_id_module_id_key" ON "induccion"."progreso_modulo"("user_id", "module_id");

-- CreateIndex
CREATE INDEX "progreso_actividad_activity_id_status_idx" ON "induccion"."progreso_actividad"("activity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_actividad_user_id_activity_id_key" ON "induccion"."progreso_actividad"("user_id", "activity_id");

-- CreateIndex
CREATE INDEX "evaluaciones_activity_id_status_idx" ON "induccion"."evaluaciones"("activity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "evaluaciones_activity_id_version_key" ON "induccion"."evaluaciones"("activity_id", "version");

-- CreateIndex
CREATE INDEX "intentos_user_id_evaluation_id_created_at_idx" ON "induccion"."intentos"("user_id", "evaluation_id", "created_at");

-- CreateIndex
CREATE INDEX "intentos_evaluation_id_status_idx" ON "induccion"."intentos"("evaluation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "intentos_user_id_evaluation_id_number_key" ON "induccion"."intentos"("user_id", "evaluation_id", "number");

-- CreateIndex
CREATE INDEX "respuestas_intento_attempt_id_idx" ON "induccion"."respuestas_intento"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_mecanografia_provider_event_id_key" ON "induccion"."resultados_mecanografia"("provider_event_id");

-- CreateIndex
CREATE INDEX "resultados_mecanografia_user_id_created_at_idx" ON "induccion"."resultados_mecanografia"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "resultados_simulador_attempt_id_idx" ON "induccion"."resultados_simulador"("attempt_id");

-- CreateIndex
CREATE INDEX "resultados_tipificacion_attempt_id_idx" ON "induccion"."resultados_tipificacion"("attempt_id");

-- CreateIndex
CREATE INDEX "sellos_user_id_status_idx" ON "induccion"."sellos"("user_id", "status");

-- CreateIndex
CREATE INDEX "sellos_module_id_status_idx" ON "induccion"."sellos"("module_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_code_key" ON "induccion"."certificados"("code");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_previous_certificate_id_key" ON "induccion"."certificados"("previous_certificate_id");

-- CreateIndex
CREATE INDEX "certificados_user_id_status_idx" ON "induccion"."certificados"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "excepciones_actividad_idempotency_key_key" ON "induccion"."excepciones_actividad"("idempotency_key");

-- CreateIndex
CREATE INDEX "excepciones_actividad_user_id_activity_id_revoked_at_expire_idx" ON "induccion"."excepciones_actividad"("user_id", "activity_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "excepciones_actividad_created_by_id_created_at_idx" ON "induccion"."excepciones_actividad"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_admin_actor_user_id_created_at_idx" ON "induccion"."auditoria_admin"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_admin_entity_type_entity_id_created_at_idx" ON "induccion"."auditoria_admin"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_admin_action_created_at_idx" ON "induccion"."auditoria_admin"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_provider_provider_event_id_key" ON "induccion"."eventos_webhook"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "idx_usuarios_rol_estado" ON "induccion"."usuarios"("rol", "estado");

-- CreateIndex
CREATE INDEX "idx_usuarios_fecha_creacion_id" ON "induccion"."usuarios"("fecha_creacion" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "induccion"."perfiles_asesor" ADD CONSTRAINT "perfiles_asesor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."prerrequisitos_modulo" ADD CONSTRAINT "prerrequisitos_modulo_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."prerrequisitos_modulo" ADD CONSTRAINT "prerrequisitos_modulo_prerequisite_module_id_fkey" FOREIGN KEY ("prerequisite_module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."actividades" ADD CONSTRAINT "actividades_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."progreso_modulo" ADD CONSTRAINT "progreso_modulo_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."progreso_modulo" ADD CONSTRAINT "progreso_modulo_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."progreso_actividad" ADD CONSTRAINT "progreso_actividad_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."progreso_actividad" ADD CONSTRAINT "progreso_actividad_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."evaluaciones" ADD CONSTRAINT "evaluaciones_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."intentos" ADD CONSTRAINT "intentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."intentos" ADD CONSTRAINT "intentos_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "induccion"."evaluaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."intentos" ADD CONSTRAINT "intentos_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "induccion"."excepciones_actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."respuestas_intento" ADD CONSTRAINT "respuestas_intento_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_mecanografia" ADD CONSTRAINT "resultados_mecanografia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_mecanografia" ADD CONSTRAINT "resultados_mecanografia_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_simulador" ADD CONSTRAINT "resultados_simulador_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_simulador" ADD CONSTRAINT "resultados_simulador_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."resultados_tipificacion" ADD CONSTRAINT "resultados_tipificacion_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."sellos" ADD CONSTRAINT "sellos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."sellos" ADD CONSTRAINT "sellos_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."sellos" ADD CONSTRAINT "sellos_evidence_attempt_id_fkey" FOREIGN KEY ("evidence_attempt_id") REFERENCES "induccion"."intentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."certificados" ADD CONSTRAINT "certificados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."certificados" ADD CONSTRAINT "certificados_previous_certificate_id_fkey" FOREIGN KEY ("previous_certificate_id") REFERENCES "induccion"."certificados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."excepciones_actividad" ADD CONSTRAINT "excepciones_actividad_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."excepciones_actividad" ADD CONSTRAINT "excepciones_actividad_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."excepciones_actividad" ADD CONSTRAINT "excepciones_actividad_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."auditoria_admin" ADD CONSTRAINT "auditoria_admin_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SQL agregado a mano (revisado antes de aplicar).
-- Los CHECK de usuarios.rol y usuarios.estado ya existen en la base real
-- (chk_usuarios_rol, chk_usuarios_estado, ver 0_baseline_usuarios); no se duplican.
-- ---------------------------------------------------------------------------

-- Un solo sello ACTIVE por usuario y módulo.
CREATE UNIQUE INDEX "uq_sellos_activo" ON "induccion"."sellos"("user_id", "module_id") WHERE "status" = 'ACTIVE';

-- Un solo certificado ACTIVE por usuario (la reemisión deja el anterior en REISSUED).
CREATE UNIQUE INDEX "uq_certificados_activo" ON "induccion"."certificados"("user_id") WHERE "status" = 'ACTIVE';

-- Integridad básica de valores numéricos.
ALTER TABLE "induccion"."prerrequisitos_modulo" ADD CONSTRAINT "chk_prerrequisito_distinto" CHECK ("module_id" <> "prerequisite_module_id");
ALTER TABLE "induccion"."progreso_modulo" ADD CONSTRAINT "chk_progreso_modulo_percent" CHECK ("percent" >= 0 AND "percent" <= 100);
ALTER TABLE "induccion"."progreso_actividad" ADD CONSTRAINT "chk_progreso_actividad_intentos" CHECK ("attempts_used" >= 0);
ALTER TABLE "induccion"."evaluaciones" ADD CONSTRAINT "chk_evaluaciones_valores" CHECK ("minimum_score" >= 0 AND "minimum_score" <= 100 AND "max_attempts" >= 1 AND "wait_minutes" >= 0 AND "version" >= 1);
ALTER TABLE "induccion"."intentos" ADD CONSTRAINT "chk_intentos_valores" CHECK ("number" >= 1 AND ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)) AND ("duration_seconds" IS NULL OR "duration_seconds" >= 0));
ALTER TABLE "induccion"."excepciones_actividad" ADD CONSTRAINT "chk_excepciones_extra" CHECK ("extra_attempts" >= 0);
ALTER TABLE "induccion"."resultados_mecanografia" ADD CONSTRAINT "chk_mecanografia_valores" CHECK ("wpm" >= 0 AND "errors" >= 0 AND "accuracy" >= 0 AND "accuracy" <= 100);
