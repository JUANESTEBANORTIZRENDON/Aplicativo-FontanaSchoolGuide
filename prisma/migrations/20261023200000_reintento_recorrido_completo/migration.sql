ALTER TABLE "induccion"."solicitudes_reactivacion"
ADD COLUMN "restart_course" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "report" JSONB,
ADD COLUMN "course_archive" JSONB;
