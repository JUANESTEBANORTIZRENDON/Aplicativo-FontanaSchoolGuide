import 'dotenv/config';
import { app } from './app.js';
import { databaseModel } from './models/database.model.js';
import { asegurarAdministrador } from './services/bootstrap-admin.service.js';

const parsedPort = Number.parseInt(process.env.PORT ?? '3000', 10);
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

const created = await asegurarAdministrador();
if (created) console.log(`Administrador inicial creado. Documento: ${created.documento} | Contraseña temporal: ${created.password}`);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Fontana School disponible en http://localhost:${port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Cerrando servidor (${signal})...`);
  server.close(async () => {
    await databaseModel.disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
