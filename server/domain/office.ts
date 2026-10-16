// Constantes y tipos puros del módulo "Ofimática para tus cobranzas".

export const OFFICE_MODULE_SLUG = 'ofimatica-mecanografia';
export const OFFICE_MODULE_NAME = 'Ofimática para tus cobranzas';

export const OFFICE_SECTIONS = ['bienvenida', 'mecanografia', 'excel', 'ortografia', 'resultado'] as const;
export type OfficeSection = (typeof OFFICE_SECTIONS)[number];

// Orden de la actividad de cada sección dentro del módulo (coincide con la migración y el seed).
export const SECTION_ORDER: Record<OfficeSection, number> = { bienvenida: 10, mecanografia: 20, excel: 30, ortografia: 40, resultado: 50 };
export const SECTION_TITLE: Record<OfficeSection, string> = {
  bienvenida: 'Bienvenida',
  mecanografia: 'Mecanografía',
  excel: 'Excel para cobranzas',
  ortografia: 'Ortografía aplicada',
  resultado: 'Resultado y sello',
};
// Secciones que se aprueban con intentos. El resto solo registra apertura.
export const GRADED_SECTIONS = ['mecanografia', 'excel', 'ortografia'] as const;
export type GradedSection = (typeof GRADED_SECTIONS)[number];

// Valores que el administrador puede cambiar (todos numéricos).
export type OfficeConfigValues = {
  typingDurationSeconds: number;
  typingMinCorrectCpm: number;
  typingMinAccuracy: number;
  typingMaxAttempts: number;
  typingStartWindowSeconds: number;
  typingAttemptTtlMinutes: number;
  excelMinScore: number;
  excelMaxAttempts: number;
  dictationMinScore: number;
  dictationMaxAttempts: number;
  dictationMaxPlays: number;
};

export const DEFAULT_OFFICE_CONFIG: OfficeConfigValues = {
  typingDurationSeconds: 60,
  typingMinCorrectCpm: 150,
  typingMinAccuracy: 90,
  typingMaxAttempts: 3,
  typingStartWindowSeconds: 15,
  typingAttemptTtlMinutes: 10,
  excelMinScore: 80,
  excelMaxAttempts: 3,
  dictationMinScore: 85,
  // Un solo intento: el dictado mide la ortografía del asesor; no se repite hasta aprobar.
  dictationMaxAttempts: 1,
  // Seis reproducciones para que el asesor pueda revisar y corregir lo que escribió.
  dictationMaxPlays: 6,
};

// Límites de cada valor (los mismos de la restricción CHECK de la base y del esquema zod).
export const OFFICE_CONFIG_LIMITS: Record<keyof OfficeConfigValues, { min: number; max: number; integer: boolean }> = {
  typingDurationSeconds: { min: 10, max: 600, integer: true },
  typingMinCorrectCpm: { min: 1, max: 1200, integer: true },
  typingMinAccuracy: { min: 1, max: 100, integer: false },
  typingMaxAttempts: { min: 1, max: 20, integer: true },
  typingStartWindowSeconds: { min: 1, max: 120, integer: true },
  typingAttemptTtlMinutes: { min: 1, max: 120, integer: true },
  excelMinScore: { min: 1, max: 100, integer: false },
  excelMaxAttempts: { min: 1, max: 20, integer: true },
  dictationMinScore: { min: 1, max: 100, integer: false },
  dictationMaxAttempts: { min: 1, max: 20, integer: true },
  dictationMaxPlays: { min: 1, max: 10, integer: true },
};

// Configuración tal como se usó en un intento: version + valores. Se guarda en configSnapshot.
export type OfficeConfigSnapshot = OfficeConfigValues & { version: number };

// Segundos extra que se toleran para el viaje de la solicitud de cierre de mecanografía.
export const TYPING_GRACE_SECONDS = 5;
// Velocidad que ningún asesor alcanza escribiendo: marca el intento como sospechoso (no lo rechaza).
export const TYPING_IMPLAUSIBLE_CPM = 1200;
// Límite del texto escrito que acepta el servidor (el texto más largo mide 900 caracteres).
export const TYPING_MAX_TYPED_LENGTH = 2000;
export const TYPING_PRACTICE_TEXTS: readonly string[] = [
  'Buenas tardes. Le confirmo que su acuerdo de pago queda registrado para el viernes.',
  'Gracias por contestar. Le escribo para recordarle el saldo pendiente de su obligación.',
  'Quedamos atentos al soporte del pago para actualizar su estado en el sistema.',
];
