import type { ObjectionCaseKey } from '../../server/domain/objections-expert';

// Ilustraciones de práctica: no representan pagos, acuerdos ni fechas confirmadas.
const visuals: Record<ObjectionCaseKey, { caption: string; description: string; drawing: string; steps: [string, string, string] }> = {
  'sin-dinero': {
    caption: 'Explora posibilidades', description: 'Una billetera y varias opciones de apoyo para reunir el dinero.',
    drawing: `<rect x="67" y="56" width="112" height="82" rx="14" fill="#1f2a37" stroke="#b58a21" stroke-width="3"/>
      <path d="M83 58V36l67-10 7 32" fill="#fffaf0" stroke="#b58a21" stroke-width="3"/>
      <path d="M94 47l43-7m-40 17 43-7" stroke="#d4af37" stroke-width="4"/>
      <rect x="145" y="82" width="43" height="30" rx="8" fill="#8b1538" stroke="#d4af37" stroke-width="2"/><circle cx="159" cy="97" r="4" fill="#efd38b"/>
      <circle cx="53" cy="126" r="22" fill="#efd38b" stroke="#b58a21" stroke-width="2"/><path d="M53 114v24m-12-12h24" stroke="#8b1538" stroke-width="3"/>
      <circle cx="190" cy="45" r="20" fill="#fffaf0" stroke="#d4af37" stroke-width="2"/><path d="M181 45h18m-5-5 5 5-5 5" stroke="#8b1538" stroke-width="3"/>`,
    steps: ['Escucha', 'Explora apoyos', 'Define el siguiente paso'],
  },
  'no-reconoce': {
    caption: 'Aclara el origen', description: 'Un documento con una pregunta y una lupa para revisar el origen de la deuda.',
    drawing: `<path d="M60 24h76l26 26v102H60z" fill="#fffaf0" stroke="#b58a21" stroke-width="3"/><path d="M136 24v27h26" fill="#f0dfae" stroke="#b58a21" stroke-width="3"/>
      <path d="M85 94h45m-45 15h33m-33 15h23" stroke="#aeb8c2" stroke-width="5"/>
      <path d="M93 60c0-14 25-14 25 0 0 9-13 8-13 18" fill="none" stroke="#8b1538" stroke-width="5"/><circle cx="105" cy="86" r="3" fill="#8b1538"/>
      <circle cx="161" cy="116" r="30" fill="#f5ecd9" fill-opacity=".9" stroke="#1f2a37" stroke-width="7"/><path d="m183 138 22 22" stroke="#8b1538" stroke-width="12"/>
      <path d="m149 117 8 8 15-18" fill="none" stroke="#b58a21" stroke-width="3"/>`,
    steps: ['Escucha la duda', 'Revisa los soportes', 'Orienta la revisión'],
  },
  'ya-pague': {
    caption: 'Valida el comprobante', description: 'Un comprobante y un reloj que indican que el pago reportado necesita revisión.',
    drawing: `<path d="M58 24h92v132l-12-7-11 7-12-7-11 7-12-7-11 7-11-7-12 7z" fill="#fffaf0" stroke="#b58a21" stroke-width="3"/>
      <rect x="76" y="41" width="56" height="16" rx="4" fill="#8b1538"/><path d="M77 75h54m-54 16h38m-38 16h48m-48 17h30" stroke="#9ca8b5" stroke-width="5"/>
      <circle cx="164" cy="121" r="35" fill="#1f2a37" stroke="#d4af37" stroke-width="3"/><circle cx="164" cy="121" r="25" fill="#f5ecd9"/>
      <path d="M164 105v17l12 8" fill="none" stroke="#8b1538" stroke-width="4" stroke-linecap="round"/>`,
    steps: ['Recibe el reporte', 'Pide fecha y soporte', 'Verifica la aplicación'],
  },
  'contacto-excesivo': {
    caption: 'Recupera el diálogo', description: 'Un teléfono con mensajes y un globo de conversación para acordar un mejor contacto.',
    drawing: `<rect x="81" y="22" width="78" height="135" rx="16" fill="#1f2a37" stroke="#b58a21" stroke-width="3"/><rect x="89" y="39" width="62" height="96" rx="6" fill="#fffaf0"/>
      <path d="M109 30h22" stroke="#efd38b" stroke-width="3"/><circle cx="120" cy="146" r="4" fill="#efd38b"/>
      <path d="M42 52h70v36H71l-13 12V88H42z" fill="#8b1538" stroke="#d4af37" stroke-width="2"/>
      <path d="M55 65h42m-42 11h27" stroke="#fffaf0" stroke-width="3"/>
      <path d="M128 96h67v35h-15l-12 11v-11h-40z" fill="#f0dfae" stroke="#b58a21" stroke-width="2"/>
      <path d="m142 114 8 7 15-16" fill="none" stroke="#8b1538" stroke-width="3"/><circle cx="182" cy="56" r="11" fill="#f0dfae"/>`,
    steps: ['Reconoce la molestia', 'Consulta su preferencia', 'Solicita la revisión'],
  },
  'salario-pendiente': {
    caption: 'Consulta una fecha posible', description: 'Un calendario con una fecha por confirmar y una moneda que representa el sueldo pendiente.',
    drawing: `<rect x="42" y="37" width="147" height="116" rx="13" fill="#fffaf0" stroke="#b58a21" stroke-width="3"/><path d="M43 66h145V50a12 12 0 0 0-12-12H55a12 12 0 0 0-12 12z" fill="#8b1538"/>
      <path d="M76 27v24m77-24v24" stroke="#d4af37" stroke-width="7" stroke-linecap="round"/>
      <path d="M62 86h12m21 0h12m21 0h12M62 106h12m21 0h12m21 0h12M62 126h12m21 0h12" stroke="#b7bdc3" stroke-width="6"/>
      <rect x="147" y="77" width="26" height="35" rx="6" fill="#f0dfae"/><path d="M155 87c0-7 11-7 11 0 0 5-6 4-6 9" fill="none" stroke="#8b1538" stroke-width="2.5"/><circle cx="160" cy="103" r="1.5" fill="#8b1538"/>
      <circle cx="185" cy="139" r="26" fill="#efd38b" stroke="#b58a21" stroke-width="3"/><path d="M185 122v33m8-26h-12c-8 0-8 10 0 10h7c8 0 8 10 0 10h-12" fill="none" stroke="#8b1538" stroke-width="3"/>`,
    steps: ['Comprende el atraso', 'Consulta la fecha', 'Acuerda seguimiento'],
  },
};

export function caseIllustration(key: ObjectionCaseKey): string {
  const visual = visuals[key];
  return `<figure class="obx-illustration"><svg viewBox="0 0 240 180" role="img" aria-label="${visual.description}" focusable="false"><ellipse cx="120" cy="160" rx="88" ry="10" fill="#1f2a37" opacity=".07"/><circle cx="120" cy="88" r="76" fill="#f5ecd9"/>${visual.drawing}</svg><figcaption>${visual.caption}</figcaption></figure>`;
}

const stepPaths = [
  '<path d="M4 11a8 8 0 0 1 16 0M4 10v7h4v-7zm12 0v7h4v-7M16 20h-4m4-3v3"/>',
  '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
  '<path d="M6 3h12v18H6zM9 7h6m-6 4h6m-6 4 2 2 4-4"/>',
];
export function actionVisual(key: ObjectionCaseKey, step: number): { title: string; icon: string } {
  return { title: visuals[key].steps[step]!, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${stepPaths[step]}</svg>` };
}

// Resumen para la tarjeta introductoria; no modifica las reglas ni los resultados.
const slideCopy: Record<ObjectionCaseKey, { summary: string; example: string; avoid: string }> = {
  'sin-dinero': {
    summary: 'Escucha su situación. Consulta alternativas, apoyo voluntario de terceros y una fecha que realmente pueda asumir.',
    example: 'Comprendo su situación. ¿Podría consultar apoyo voluntario u otra alternativa? Revisemos una fecha posible.',
    avoid: 'Decir «si no tiene dinero, no hay nada que hacer» o presionar hasta cerrar el diálogo.',
  },
  'no-reconoce': {
    summary: 'Primero aclara la duda: revisa el origen de la deuda y sus soportes antes de hablar de pago.',
    example: 'Entiendo su duda. Revisaré el origen y los soportes de la deuda para orientarle.',
    avoid: 'Discutir o exigir un pago sin aclarar la deuda: puedes perder su confianza.',
  },
  'ya-pague': {
    summary: 'Pide fecha, valor y comprobante. El pago reportado queda pendiente de revisión.',
    example: 'Gracias por avisar. ¿En qué fecha y por qué valor pagó? Envíeme el comprobante para revisarlo.',
    avoid: 'Decir «si no aparece, no ha pagado» sin revisar: convierte la aclaración en un conflicto.',
  },
  'contacto-excesivo': {
    summary: 'Reconoce la molestia, consulta su canal y horario preferidos y solicita revisar los contactos.',
    example: 'Lamento la molestia. ¿Qué canal y horario prefiere? Solicitaré la revisión de los contactos.',
    avoid: 'Minimizar la queja o insistir en el pago sin escuchar: aumenta el rechazo.',
  },
  'salario-pendiente': {
    summary: 'Pregunta cuándo espera recibir su sueldo y acuerda un seguimiento, sin asumir un compromiso de pago.',
    example: 'Comprendo el retraso. ¿Cuándo espera recibir su sueldo? Acordemos cuándo volver a conversar.',
    avoid: 'Decir «eso no es mi problema» o imponer una fecha: puedes perder un acuerdo viable.',
  },
};
export const caseSlideCopy = (key: ObjectionCaseKey) => slideCopy[key];
