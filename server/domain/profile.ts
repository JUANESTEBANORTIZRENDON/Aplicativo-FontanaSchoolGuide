// Opciones compartidas por el formulario y la validación del servidor.
export const TIPOS_DOCUMENTO = ['CC', 'TI', 'PPT'] as const;
export const SEXOS = ['Masculino', 'Femenino'] as const;
export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
export const TALLAS_CAMISA = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const BANCOS = ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'Banco de Occidente', 'Banco Popular', 'Banco Caja Social', 'BBVA', 'Otros'] as const;

export type DatosPersonales = {
  nombre: string | null;
  apellidos: string | null;
  fechaNacimiento: Date | null;
  sexo: string | null;
  tipoSangre: string | null;
  tallaCamisa: string | null;
  direccionResidencia: string | null;
  nombreContactoEmergencia: string | null;
  numeroContactoEmergencia: string | null;
  banco: string | null;
  otroBanco: string | null;
  numeroCuenta: string | null;
};
