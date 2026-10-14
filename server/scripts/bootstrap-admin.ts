import 'dotenv/config';
import { asegurarAdministrador } from '../services/bootstrap-admin.service.js';
import { databaseModel } from '../models/database.model.js';

try {
  const created = await asegurarAdministrador();
  if (created) console.log(`Administrador inicial creado. Documento: ${created.documento} | Contraseña temporal: ${created.password}`);
  else console.log('Ya existe al menos un administrador; no se creó otro.');
} finally {
  await databaseModel.disconnect();
}
