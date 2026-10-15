import { disconnect } from '../config/prisma.js';
import { crearAdministradorInicial } from '../services/bootstrap-admin.service.js';

try {
  const created = await crearAdministradorInicial();
  if (created) {
    console.log('Administrador inicial creado. Guarda estos datos ahora: no se volverán a mostrar.');
    console.log(`Documento: ${created.documento} | Contraseña temporal: ${created.password}`);
  } else {
    console.log('Ya existe al menos un administrador; no se creó otro.');
  }
} finally {
  await disconnect();
}
