-- Línea base de induccion.usuarios.
-- Describe la estructura que ya existe en Neon (creada fuera de Prisma). En la base
-- existente se marca como aplicada con `prisma migrate resolve --applied 0_baseline_usuarios`
-- y NO se ejecuta. En una base vacía (pruebas, desarrollo) reproduce la misma estructura.
-- La parte final agrega los objetos reales que Prisma no modela: CHECK de rol y estado,
-- índice único sobre lower(correo), trigger de fecha_actualizacion y la vista
-- usuarios_ruta_induccion. Todos se verificaron contra pg_catalog el 2026-10-15.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "induccion";

-- CreateTable
CREATE TABLE "induccion"."usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_completo" VARCHAR(150) NOT NULL,
    "tipo_documento" VARCHAR(10) NOT NULL DEFAULT 'CC',
    "numero_documento" VARCHAR(30) NOT NULL,
    "correo" VARCHAR(150),
    "telefono" VARCHAR(30),
    "password_hash" TEXT NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
    "tiene_experiencia_cobranzas_digitales" BOOLEAN,
    "fecha_respuesta_experiencia" TIMESTAMPTZ(6),
    "debe_completar_datos" BOOLEAN NOT NULL DEFAULT true,
    "fecha_datos_completados" TIMESTAMPTZ(6),
    "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false,
    "creado_por" UUID,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso" TIMESTAMPTZ(6),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_numero_documento_key" ON "induccion"."usuarios"("numero_documento");

-- CreateIndex
CREATE INDEX "idx_usuarios_estado" ON "induccion"."usuarios"("estado");

-- CreateIndex
CREATE INDEX "idx_usuarios_rol" ON "induccion"."usuarios"("rol");

-- AddForeignKey
ALTER TABLE "induccion"."usuarios" ADD CONSTRAINT "fk_usuarios_creado_por" FOREIGN KEY ("creado_por") REFERENCES "induccion"."usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;


-- Objetos existentes no representables en schema.prisma
ALTER TABLE "induccion"."usuarios" ADD CONSTRAINT "chk_usuarios_rol" CHECK ((rol)::text = ANY ((ARRAY['administrador'::character varying, 'asesor'::character varying])::text[]));
ALTER TABLE "induccion"."usuarios" ADD CONSTRAINT "chk_usuarios_estado" CHECK ((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'bloqueado'::character varying])::text[]));

CREATE UNIQUE INDEX "uq_usuarios_correo_lower" ON "induccion"."usuarios" USING btree (lower((correo)::text));

CREATE OR REPLACE FUNCTION "induccion"."actualizar_fecha_modificacion"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$function$;

CREATE TRIGGER "trg_usuarios_fecha_actualizacion" BEFORE UPDATE ON "induccion"."usuarios" FOR EACH ROW EXECUTE FUNCTION "induccion"."actualizar_fecha_modificacion"();

CREATE OR REPLACE VIEW "induccion"."usuarios_ruta_induccion" AS
 SELECT id,
    nombre_completo,
    numero_documento,
    correo,
    rol,
    estado,
    tiene_experiencia_cobranzas_digitales,
    debe_completar_datos,
        CASE
            WHEN rol::text <> 'asesor'::text THEN 'no_aplica'::text
            WHEN tiene_experiencia_cobranzas_digitales IS NULL THEN 'pendiente_respuesta'::text
            WHEN tiene_experiencia_cobranzas_digitales = true THEN 'con_experiencia'::text
            ELSE 'sin_experiencia'::text
        END AS ruta_induccion
   FROM induccion.usuarios;
