-- Valores nuevos de ActivityType. PostgreSQL no permite usar un valor de enum recién agregado dentro
-- de la misma transacción, por eso viven en una migración propia antes de modulo_ofimatica.
-- Cambio aditivo: no toca los valores existentes.
ALTER TYPE "induccion"."ActivityType" ADD VALUE IF NOT EXISTS 'EXCEL_PRACTICE';
ALTER TYPE "induccion"."ActivityType" ADD VALUE IF NOT EXISTS 'DICTATION';
