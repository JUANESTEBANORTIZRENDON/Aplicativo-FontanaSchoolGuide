import { z } from 'zod';
import { COLLECTIONS_EXAM } from './collections-exam.js';

// El historial se lee desde el resultado guardado, sin volver a calificar con un
// examen o una rúbrica que puedan haber cambiado desde el envío.
const resultSchema = z.object({
  version: z.number().int().positive(), passed: z.boolean(), verdict: z.enum(['Apto', 'Requiere refuerzo']),
  score: z.number().min(0).max(100), maxScore: z.number().positive(), minScore: z.number().min(0).max(100),
  criticalErrors: z.array(z.object({ key: z.string(), section: z.string(), reason: z.string() })),
  sections: z.array(z.object({
    key: z.string(), title: z.string(), score: z.number().nonnegative(), maxScore: z.number().positive(),
    results: z.array(z.object({
      key: z.string(), prompt: z.string().optional(), kind: z.string().optional(),
      selected: z.string(), selectedText: z.string().optional(), points: z.number().nonnegative(), maxPoints: z.number().positive(), correct: z.boolean(),
      feedback: z.string(), expected: z.string(), criteria: z.array(z.object({ label: z.string(), met: z.boolean() })),
    })),
  })).length(7),
});
export type StoredExamResult = z.infer<typeof resultSchema>;
export function readExamResult(value: unknown): StoredExamResult | null {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (result.maxScore !== 100 || result.verdict !== (result.passed ? 'Apto' : 'Requiere refuerzo') || result.sections.some((s) => s.score > s.maxScore || s.results.some((q) => q.points > q.maxPoints)) || result.sections.reduce((sum, s) => sum + s.score, 0) !== result.score) return null;
  return result;
}

const practice: Record<string, { skill: string; action: string }> = {
  'inicio-accion': { skill: 'Abre el contacto y verifica identidad antes de informar la deuda.', action: 'Ensayar una apertura breve con el líder: saludo, presentación y verificación de identidad antes de hablar de la obligación.' },
  'inicio-guion': { skill: 'Incluye los elementos básicos de presentación y aviso de calidad.', action: 'Reescribir y practicar en voz alta el saludo, el nombre del asesor, la entidad, la cartera y el aviso de grabación y monitoreo por calidad.' },
  'escenario-saldo': { skill: 'Identifica el saldo actualizado después del abono aplicado.', action: 'Revisar de nuevo la ficha: $480.000 menos $80.000 aplicados. Explicar por qué el saldo a informar es $400.000.' },
  'escenario-accion': { skill: 'Distingue intención de pago de un compromiso concreto.', action: 'Practicar tres registros distintos: voluntad de pago, compromiso con monto y fecha y pago verificado. Indicar qué evidencia falta en cada caso.' },
  'negociacion-total': { skill: 'Reconoce la posibilidad de pago total inmediato.', action: 'Comparar un pago total hoy con un acuerdo para una fecha futura y registrar qué queda pendiente de verificar.' },
  'negociacion-abono': { skill: 'Reconoce un abono y las fechas del saldo restante.', action: 'Resolver un ejemplo de abono: indicar el monto parcial, el saldo restante y sus fechas, según las condiciones autorizadas.' },
  'negociacion-fecha': { skill: 'Identifica el acuerdo de pago total con fecha.', action: 'Redactar un acuerdo futuro con monto y fecha, dejando explícito que aún no hay pago confirmado.' },
  'negociacion-descuento': { skill: 'Consulta el descuento antes de prometer condiciones.', action: 'Simular una solicitud de descuento y explicar que se consultará al líder sin prometer aprobación, porcentaje ni recargo.' },
  'objeciones-accion': { skill: 'Responde a la dificultad del cliente con escucha y respeto.', action: 'Repetir la conversación sobre falta de ingresos: reconocer la dificultad y explorar posibilidades sin amenazas ni presión.' },
  'objeciones-respuesta': { skill: 'Redacta una respuesta con empatía y exploración de alternativas.', action: 'Escribir dos frases: una que reconozca la dificultad y otra que pregunte por monto o fecha para revisar opciones autorizadas.' },
  'cierre-registro': { skill: 'Diferencia el acuerdo de un pago confirmado al cerrar.', action: 'Registrar el acuerdo como pendiente de cumplimiento y explicar qué fuente confirmará el pago.' },
  'cierre-guion': { skill: 'Resume montos, fechas y seguimiento en el cierre.', action: 'Practicar el cierre: $100.000 el 20/11/2026 y $300.000 el 30/11/2026; pedir confirmación y explicar la verificación de cada pago.' },
  'seguimiento-reporte': { skill: 'Registra un pago reportado como pendiente de verificar.', action: 'Resolver un caso en que el cliente dice que pagó y el pago no aparece: registrar el reporte y consultar la fuente autorizada.' },
  'seguimiento-sin-respuesta': { skill: 'Define seguimiento según el protocolo interno.', action: 'Registrar un intento sin respuesta y consultar el canal y la próxima acción autorizados, sin inventar frecuencias de contacto.' },
  'tipificacion-no-acuerdo': { skill: 'Tipifica correctamente una conversación sin acuerdo.', action: 'Contrastar no acuerdo con voluntad de pago usando dos casos cortos y explicar la diferencia antes de tipificar.' },
  'tipificacion-voluntad': { skill: 'Reconoce voluntad de pago sin monto ni fecha.', action: 'Practicar un caso donde el cliente quiere pagar pero no define monto ni fecha: clasificar voluntad de pago sin inventar un compromiso.' },
  'tipificacion-tercero': { skill: 'Distingue contacto con tercero de contacto con titular.', action: 'Simular una respuesta de un familiar: proteger los datos de la deuda y registrar contacto con tercero.' },
  'tipificacion-no-contesta': { skill: 'Distingue un intento sin respuesta de un contacto.', action: 'Comparar un intento sin respuesta con uno atendido por un tercero y elegir la tipificación correcta en cada uno.' },
};

const coachingSchema = z.object({
  version: z.literal(1),
  strengths: z.array(z.object({ key: z.string(), section: z.string(), description: z.string(), evidence: z.string() })),
  improvements: z.array(z.object({ key: z.string(), section: z.string(), priority: z.enum(['critical', 'practice']), description: z.string(), evidence: z.string(), recommendation: z.string(), missingCriteria: z.array(z.string()) })),
});
export type ExamCoaching = z.infer<typeof coachingSchema>;
export function readExamCoaching(value: unknown): ExamCoaching | null {
  const parsed = coachingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildExamCoaching(result: StoredExamResult): ExamCoaching {
  const strengths: ExamCoaching['strengths'] = [];
  const improvements: ExamCoaching['improvements'] = [];
  for (const section of result.sections) for (const response of section.results) {
    // Compatibilidad con los primeros registros v2 sin texto visible guardado.
    const bank = result.version === 2 ? COLLECTIONS_EXAM.find((q) => q.key === response.key) : undefined;
    const evidence = response.selectedText ?? (bank?.kind !== 'text' ? bank?.options.find((o) => o.id === response.selected)?.text : undefined) ?? response.selected;
    const critical = result.criticalErrors.filter((e) => e.key === response.key);
    const item = result.version === 2 ? practice[response.key] : undefined;
    if (response.correct && !critical.length) {
      strengths.push({ key: response.key, section: section.title, description: item?.skill ?? `Resolvió correctamente: ${response.prompt ?? response.key}`, evidence });
    } else {
      const missingCriteria = response.criteria.filter((c) => !c.met).map((c) => c.label);
      const metCriteria = response.criteria.filter((c) => c.met).map((c) => c.label);
      if (!critical.length && response.points > 0 && metCriteria.length) strengths.push({ key: response.key, section: section.title, description: `Elementos logrados en la redacción: ${metCriteria.join('; ')}.`, evidence });
      improvements.push({
        key: response.key, section: section.title, priority: critical.length ? 'critical' : 'practice',
        description: critical.length ? critical.map((c) => c.reason).join(' ') : missingCriteria.length ? `Elementos por reforzar: ${missingCriteria.join('; ')}.` : response.feedback,
        evidence, recommendation: (item?.action ?? `Practicar de nuevo el caso y contrastarlo con esta referencia: ${response.expected}`) + (missingCriteria.length ? ` Revisar específicamente: ${missingCriteria.join('; ')}.` : ''),
        missingCriteria,
      });
    }
  }
  improvements.sort((a, b) => Number(b.priority === 'critical') - Number(a.priority === 'critical'));
  return { version: 1, strengths, improvements };
}
