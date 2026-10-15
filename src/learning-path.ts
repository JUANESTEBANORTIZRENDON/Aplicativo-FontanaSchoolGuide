// "Tu camino en Fontana": la misma barra en la bienvenida y en la práctica. Los pasos ya
// desbloqueados son enlaces para ir y volver sin perder el avance.
export type PasoCamino = 'empresa' | 'practica';

type Paso = { numero: string; titulo: string; detalle: string; estado: 'current' | 'completed' | 'available' | 'upcoming'; href?: string };

function paso({ numero, titulo, detalle, estado, href }: Paso): string {
  const clase = estado === 'current' ? ' class="path-current" aria-current="step"' : estado === 'upcoming' ? ' class="path-upcoming"' : '';
  const status = estado === 'completed' ? 'completed' : estado === 'available' ? 'available' : 'pending';
  const contenido = `<span class="path-number">${estado === 'completed' ? '✓' : numero}</span><span>${titulo}<small>${detalle}</small></span>`;
  return `<li${clase} data-status="${status}">${href && estado !== 'current' ? `<a class="path-link" href="${href}">${contenido}</a>` : contenido}</li>`;
}

// rutaPractica es null mientras el asesor no responda la pregunta de experiencia.
export function pasosCamino(actual: PasoCamino, rutaPractica: string | null): string {
  return `<ol>${[
    paso(actual === 'empresa'
      ? { numero: '01', titulo: 'Conoce la empresa', detalle: 'Estás aquí', estado: 'current' }
      : { numero: '01', titulo: 'Conoce la empresa', detalle: 'Completado · Repasar', estado: 'completed', href: '/induccion' }),
    paso(actual === 'practica'
      ? { numero: '02', titulo: 'Practica', detalle: 'Estás aquí', estado: 'current' }
      : rutaPractica
        ? { numero: '02', titulo: 'Practica', detalle: 'Disponible · Ir a la práctica', estado: 'available', href: rutaPractica }
        : { numero: '02', titulo: 'Practica', detalle: 'Próximamente', estado: 'upcoming' }),
    paso({ numero: '03', titulo: 'Evalúate', detalle: 'Próximamente', estado: 'upcoming' }),
  ].join('')}</ol>`;
}
