-- Las grabaciones reales del módulo 01 pueden superar los 30 segundos.
ALTER TABLE "induccion"."ejercicios_dictado"
  DROP CONSTRAINT IF EXISTS "ck_dictado_audio_duracion";

ALTER TABLE "induccion"."ejercicios_dictado"
  ADD CONSTRAINT "ck_dictado_audio_duracion"
  CHECK ("audio_duration_seconds" IS NULL OR "audio_duration_seconds" BETWEEN 20 AND 120);
