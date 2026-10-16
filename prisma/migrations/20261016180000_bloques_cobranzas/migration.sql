CREATE TABLE "induccion"."progreso_bloques_cobranzas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "module_id" UUID NOT NULL,
  "block_key" VARCHAR(30) NOT NULL,
  "content_version" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "answers" JSONB NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "progreso_bloques_cobranzas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "progreso_bloques_cobranzas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "progreso_bloques_cobranzas_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "induccion"."modulos_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_cobranzas_bloque_usuario_version"
 ON "induccion"."progreso_bloques_cobranzas"("user_id", "module_id", "block_key", "content_version");

-- El catálogo existente se conserva: inducción (02) y simulador (03) son módulos distintos.
