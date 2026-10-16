-- Cupo de intentos por asesor y actividad (panel de administración).
-- Solo agrega una tabla; no elimina ni modifica columnas, tablas ni valores.
-- CreateTable
CREATE TABLE "induccion"."limites_intento_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "limites_intento_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "limites_intento_usuario_user_id_activity_id_key" ON "induccion"."limites_intento_usuario"("user_id", "activity_id");

-- AddForeignKey
ALTER TABLE "induccion"."limites_intento_usuario" ADD CONSTRAINT "limites_intento_usuario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."limites_intento_usuario" ADD CONSTRAINT "limites_intento_usuario_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "induccion"."actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "induccion"."limites_intento_usuario" ADD CONSTRAINT "limites_intento_usuario_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "induccion"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check
ALTER TABLE "induccion"."limites_intento_usuario" ADD CONSTRAINT "chk_limites_intento_max" CHECK ("max_attempts" >= 1 AND "max_attempts" <= 50);
