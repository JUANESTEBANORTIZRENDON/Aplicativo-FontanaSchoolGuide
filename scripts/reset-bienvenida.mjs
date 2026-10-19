// Reinicia SOLO el panel de bienvenida/inducción de la cuenta de pruebas 1021803088 para poder recorrerlo de nuevo.
//   node scripts/reset-bienvenida.mjs          → muestra el estado actual y lo reinicia
//   node scripts/reset-bienvenida.mjs --dry    → solo muestra el estado actual
// Es idempotente y no toca resultados, intentos, sellos ni progreso de ningún módulo, ni a otras personas.
// Campos que gobiernan la bienvenida (server/domain/usuario.ts · rutaUsuario):
//   fechaHistoriaCompletada / fechaMetodoCompletado → avance de «Nuestra historia» y «Método de trabajo»
//   fechaInduccionCompletada                         → inducción inicial terminada (ruta /practica)
//   tieneExperienciaCobranzasDigitales (+ fecha)     → mientras tenga valor, la ruta es /practica/* y no /induccion
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DOCUMENT = '1021803088';
const FIELDS = ['fechaHistoriaCompletada', 'fechaMetodoCompletado', 'fechaInduccionCompletada', 'fechaRespuestaExperiencia', 'tieneExperienciaCobranzasDigitales'];
const prisma = new PrismaClient();
try {
  const select = Object.fromEntries([...FIELDS, 'id', 'rol', 'numeroDocumento'].map((field) => [field, true]));
  const user = await prisma.usuario.findUnique({ where: { numeroDocumento: DOCUMENT }, select });
  if (!user || user.rol !== 'asesor') throw new Error(`No existe un asesor con documento ${DOCUMENT}.`);
  console.log('antes  :', JSON.stringify(Object.fromEntries(FIELDS.map((field) => [field, user[field]]))));
  if (!process.argv.includes('--dry')) {
    await prisma.usuario.update({ where: { id: user.id }, data: Object.fromEntries(FIELDS.map((field) => [field, null])) });
    const after = await prisma.usuario.findUnique({ where: { id: user.id }, select });
    console.log('después:', JSON.stringify(Object.fromEntries(FIELDS.map((field) => [field, after[field]]))));
  }
} finally {
  await prisma.$disconnect();
}
