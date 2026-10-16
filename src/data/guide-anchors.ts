// Anclas para las futuras pestañas de explicación. Cada zona relevante del DOM lleva
// `data-sim-guide="<vista>.<zona>"`. La interfaz de explicaciones todavía no existe.

export type GuideView = 'login' | 'carteras' | 'panel' | 'clientes' | 'comun';

export interface GuideAnchor {
  id: string;
  view: GuideView;
  description: string;
}

export const GUIDE_ANCHORS: GuideAnchor[] = [
  { id: 'login.marca', view: 'login', description: 'Identidad del centro de formación.' },
  { id: 'login.formulario', view: 'login', description: 'Ingreso con documento y contraseña.' },
  { id: 'login.credenciales', view: 'login', description: 'Credenciales ficticias para practicar.' },
  { id: 'login.aviso', view: 'login', description: 'Leyenda que recuerda que todo es ficticio.' },

  { id: 'carteras.encabezado', view: 'carteras', description: 'Reloj de la operación y acceso al menú.' },
  { id: 'carteras.perfil', view: 'carteras', description: 'Datos del asesor que está practicando.' },
  { id: 'carteras.extension', view: 'carteras', description: 'Aviso de extensión telefónica simulada.' },
  { id: 'carteras.listado', view: 'carteras', description: 'Carteras disponibles para gestionar.' },

  { id: 'comun.barra-lateral', view: 'comun', description: 'Menú de módulos de la cartera.' },
  { id: 'comun.reloj', view: 'comun', description: 'Hora oficial de Bogotá para registrar gestiones.' },
  { id: 'comun.estado-conexion', view: 'comun', description: 'Estado del asesor: conectado, en pausa o desconectado.' },
  { id: 'comun.aviso', view: 'comun', description: 'Franja que identifica el entorno de capacitación.' },

  { id: 'panel.rango', view: 'panel', description: 'Rango de fechas con el que se calculan las cifras.' },
  { id: 'panel.resumen', view: 'panel', description: 'Asesores conectados, compromisos, recaudo y accesos rápidos.' },
  { id: 'panel.clientes', view: 'panel', description: 'Clientes de la cartera y cuántos se gestionaron.' },
  { id: 'panel.obligaciones', view: 'panel', description: 'Obligaciones y capital en mora.' },
  { id: 'panel.proyeccion', view: 'panel', description: 'Valor de las promesas que vencen en el rango.' },
  { id: 'panel.pagos', view: 'panel', description: 'Recaudo simulado frente a lo proyectado.' },
  { id: 'panel.productividad', view: 'panel', description: 'Gestiones por día de la semana según el resultado.' },
  { id: 'panel.llamadas', view: 'panel', description: 'Últimas llamadas registradas.' },
  { id: 'panel.detalle', view: 'panel', description: 'Resumen de gestiones por tipificación.' },

  { id: 'clientes.pestanas', view: 'clientes', description: 'Cambio entre archivos y clientes.' },
  { id: 'clientes.herramientas', view: 'clientes', description: 'Avisos, búsqueda y accesos rápidos.' },
  { id: 'clientes.filtros', view: 'clientes', description: 'Filtros para encontrar a quién gestionar.' },
  { id: 'clientes.semaforo', view: 'clientes', description: 'Estado de gestión de cartera; también filtra.' },
  { id: 'clientes.totales', view: 'clientes', description: 'Totales del resultado filtrado.' },
  { id: 'clientes.tabla', view: 'clientes', description: 'Listado de clientes con su estado.' },
  { id: 'clientes.detalle', view: 'clientes', description: 'Panel con la información del cliente.' },
  { id: 'clientes.detalle.obligaciones', view: 'clientes', description: 'Obligaciones del cliente.' },
  { id: 'clientes.detalle.historial', view: 'clientes', description: 'Historial de interacciones.' },
  { id: 'clientes.detalle.formulario', view: 'clientes', description: 'Registro de una nueva gestión.' },
];
