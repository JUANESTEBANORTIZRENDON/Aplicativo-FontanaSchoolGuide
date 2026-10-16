-- Campos opcionales en cuentas existentes; obligatorios al completar el formulario.
ALTER TABLE "induccion"."usuarios"
  ADD COLUMN "nombre" VARCHAR(75),
  ADD COLUMN "apellidos" VARCHAR(75),
  ADD COLUMN "fecha_nacimiento" DATE,
  ADD COLUMN "sexo" VARCHAR(10),
  ADD COLUMN "tipo_sangre" VARCHAR(3),
  ADD COLUMN "talla_camisa" VARCHAR(5),
  ADD COLUMN "direccion_residencia" VARCHAR(250),
  ADD COLUMN "nombre_contacto_emergencia" VARCHAR(150),
  ADD COLUMN "numero_contacto_emergencia" VARCHAR(30),
  ADD COLUMN "banco" VARCHAR(50),
  ADD COLUMN "otro_banco" VARCHAR(100),
  ADD COLUMN "numero_cuenta" VARCHAR(30);
