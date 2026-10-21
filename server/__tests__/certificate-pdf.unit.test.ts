import { describe, expect, it } from 'vitest';
import { certificatePdf } from '../utils/certificate-pdf.js';

describe('certificado en PDF', () => {
  it('genera un PDF válido con el nombre, la formación y el código (tildes en WinAnsi)', () => {
    const pdf = certificatePdf({
      holder: 'María José Peña Ñañez', trainingName: 'Formación de asesores de cobranzas digitales',
      issuedAt: new Date('2026-10-21T15:00:00Z'), code: 'FSG-2026-ABC234', verifyUrl: 'https://fontana.test/verificar/FSG-2026-ABC234', timeZone: 'America/Bogota',
    });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('FSG-2026-ABC234');
    expect(text).toContain('Mar\\355a Jos\\351 Pe\\361a \\321a\\361ez');
    expect(text).toContain('Firma institucional');
    // La tabla xref apunta al inicio de cada objeto.
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const first = /0000000000 65535 f \n(\d{10})/.exec(text)![1]!;
    expect(text.slice(Number(first), Number(first) + 7)).toBe('1 0 obj');
  });
});
