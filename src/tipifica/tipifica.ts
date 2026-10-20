import './tipifica.css';
import { api, escapar } from '../http';

// Módulo 04 «Tipifica»: el clon de práctica de Control Next se muestra en una pantalla dentro de la página
// (iframe /simulador/), con pantalla completa como un video para que la práctica sea inmersiva.

const SECTIONS: { title: string; text: string }[] = [
  { title: 'Dashboard y campañas', text: 'Tu perfil (nombre, cédula, extensión, teléfono) y las campañas que tienes asignadas. Cada tarjeta es una cartera: al pulsarla entras a sus clientes.' },
  { title: 'Encabezado', text: 'Reloj con la hora de Bogotá, tu extensión y tu estado (CONECTADO o en pausa), la lista de tareas, los avisos, los pagos, la lupa de búsqueda y tu avatar.' },
  { title: 'Clientes y filtros', text: 'Filtra por fechas de promesa y de gestión, ciudad, asesor, mejor y último perfil. La tabla muestra identificación, nombre, perfiles, asesor, fecha de gestión y promesas.' },
  { title: 'Estado de Gestión de Cartera', text: 'El semáforo: cian sin gestión, amarillo menos de 5 días sin gestión, rojo más de 5 días y verde gestionado hoy. Pulsa un color para filtrar.' },
  { title: 'Buscar por cédula', text: 'La lupa abre el panel «Buscar». Escribes la cédula, pulsas Buscar, Control Next confirma campaña, nombre e identificación y con OK abres la ficha.' },
  { title: 'Ficha del cliente (G.C)', text: 'Información personal, datos de la obligación (valor vencido, intereses, saldo total, honorarios), el registro de la gestión y el histórico completo.' },
];

const BUTTONS: { name: string; text: string }[] = [
  { name: 'Restablecer / Buscar', text: 'Limpian o aplican los filtros de la lista de clientes.' },
  { name: 'Lupa', text: 'Abre el panel Buscar (cédula, nombre, obligación, teléfono, email o codeudor).' },
  { name: 'Anterior / Siguiente', text: 'Pasan al cliente anterior o siguiente de tu lista sin volver a la tabla.' },
  { name: 'ⓘ Referencias', text: 'Muestra las referencias del titular (solo para ubicarlo).' },
  { name: 'Demográficos', text: 'Datos de contacto del cliente para consultarlos o actualizarlos.' },
  { name: 'Pagos', text: 'Pagos que el cliente ya hizo: revísalos antes de cobrar.' },
  { name: 'Remarcar', text: 'Vuelve a llamar al titular (en la práctica la llamada es simulada).' },
  { name: 'Buzón', text: 'Registra al instante que la llamada cayó a buzón de voz.' },
  { name: 'Cancelar', text: 'Limpia el formulario de la gestión sin guardar.' },
  { name: 'Guardar', text: 'Registra la gestión con su tipificación. Si no guardas, la llamada no existió.' },
  { name: 'Micrófono / Audio', text: 'Las llamadas se graban y se escuchan desde el histórico.' },
];

const TERMS: [string, string][] = [
  ['Acción', 'Qué hiciste: hacer o recibir llamada, WhatsApp, correo o SMS.'],
  ['Efecto', 'El resultado de la gestión: acuerdo de pago, no hubo acuerdo, volver a llamar, no contesta…'],
  ['Contacto', 'Con quién hablaste: directo (titular), indirecto (un tercero) o sin contacto.'],
  ['Motivo N.P.', 'Motivo de no pago o lo que queda por confirmar (p. ej. «NO CUENTA CON EL DINERO», «CONFIRMAR PAGO»).'],
  ['TT', 'Titular de la obligación. En la gestión se escribe «3001234567 // TT INDICA QUE…».'],
  ['Mejor / Último perfil', 'El mejor resultado logrado con el cliente y el resultado de su última gestión.'],
];

const FULL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const EXIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

export async function mountTipifica(container: HTMLElement, backHref: string, moduleOrder = 4): Promise<void> {
  // El nombre del asesor se muestra en el perfil del clon (solo en su navegador; no se guarda en ningún lado).
  let nombre = '';
  try {
    nombre = (await api<{ usuario: { nombreCompleto: string } }>('/auth/me')).usuario.nombreCompleto;
  } catch {
    nombre = '';
  }
  const src = `/simulador/${nombre ? `?nombre=${encodeURIComponent(nombre)}` : ''}#/login`;

  container.classList.add('tipifica-host');
  container.innerHTML = `
    <section class="tipifica">
      <header class="tipifica-head">
        <p class="auth-kicker">MÓDULO ${String(moduleOrder).padStart(2, '0')}</p>
        <h2>Tipifica</h2>
        <p class="tipifica-lead"><strong>Control Next</strong> es el aplicativo de gestión de cobranzas con el que trabajarás cada día: ahí ves tus campañas, buscas a cada cliente, registras lo que pasó en la llamada (<em>la tipificación</em>) y consultas su histórico. Aquí tienes una copia de práctica: los clientes son ficticios y nada de lo que hagas sale de tu navegador.</p>
      </header>

      <div class="tipifica-screen" id="tipifica-screen">
        <div class="tipifica-screen__bar" aria-hidden="true">
          <span class="tipifica-dots"><i></i><i></i><i></i></span>
          <span class="tipifica-url">controlnext · práctica</span>
        </div>
        <div class="tipifica-screen__frame">
          <iframe id="tipifica-frame" title="Control Next (práctica)" src="${escapar(src)}" allow="fullscreen"></iframe>
        </div>
        <div class="tipifica-screen__controls" role="toolbar" aria-label="Controles de la pantalla de práctica">
          <button type="button" class="tipifica-ctl" data-tip="guia">Guía de esta pantalla</button>
          <button type="button" class="tipifica-ctl" data-tip="demo">Ver cómo se ingresa una cédula</button>
          <span class="tipifica-count" aria-live="polite" id="tipifica-count"></span>
          <button type="button" class="tipifica-ctl tipifica-ctl--icon" data-tip="reload" aria-label="Volver a cargar la pantalla" title="Volver a cargar">↻</button>
          <button type="button" class="tipifica-ctl tipifica-ctl--full" data-tip="full" aria-pressed="false">${FULL_ICON}<span>Pantalla completa</span></button>
        </div>
      </div>
      <p class="tipifica-hint">Consejo: usa <strong>Pantalla completa</strong> para practicar como si estuvieras en tu puesto. Sal con <kbd>Esc</kbd> o con el mismo botón.</p>

      <section class="tipifica-block" aria-labelledby="tipifica-sections">
        <h3 id="tipifica-sections">Los apartados de Control Next</h3>
        <ol class="tipifica-cards">
          ${SECTIONS.map((s, i) => `<li><span class="tipifica-num">${i + 1}</span><strong>${escapar(s.title)}</strong><p>${escapar(s.text)}</p></li>`).join('')}
        </ol>
      </section>

      <div class="tipifica-two">
        <section class="tipifica-block" aria-labelledby="tipifica-buttons">
          <h3 id="tipifica-buttons">Los botones</h3>
          <dl class="tipifica-dl">${BUTTONS.map((b) => `<div><dt>${escapar(b.name)}</dt><dd>${escapar(b.text)}</dd></div>`).join('')}</dl>
        </section>
        <section class="tipifica-block" aria-labelledby="tipifica-terms">
          <h3 id="tipifica-terms">Cómo se tipifica</h3>
          <dl class="tipifica-dl">${TERMS.map(([t, d]) => `<div><dt>${escapar(t)}</dt><dd>${escapar(d)}</dd></div>`).join('')}</dl>
          <p class="tipifica-note">Los efectos y motivos de esta práctica son una propuesta de entrenamiento: tu supervisor te confirmará el catálogo oficial de la operación.</p>
        </section>
      </div>

      <a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>
    </section>`;

  const screen = container.querySelector<HTMLElement>('#tipifica-screen')!;
  const frame = container.querySelector<HTMLIFrameElement>('#tipifica-frame')!;
  const fullBtn = container.querySelector<HTMLButtonElement>('[data-tip="full"]')!;
  const counter = container.querySelector<HTMLElement>('#tipifica-count')!;

  const send = (type: string): void => {
    frame.contentWindow?.postMessage({ type }, location.origin);
    frame.focus();
  };

  const isFull = (): boolean => document.fullscreenElement === screen || screen.classList.contains('is-expanded');
  const syncFull = (): void => {
    const full = isFull();
    fullBtn.setAttribute('aria-pressed', String(full));
    fullBtn.innerHTML = `${full ? EXIT_ICON : FULL_ICON}<span>${full ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>`;
    document.body.classList.toggle('tipifica-locked', screen.classList.contains('is-expanded'));
  };
  const toggleFull = async (): Promise<void> => {
    if (isFull()) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      screen.classList.remove('is-expanded');
    } else if (screen.requestFullscreen) {
      // Si el navegador no permite pantalla completa, se amplía dentro de la ventana.
      await screen.requestFullscreen().catch(() => screen.classList.add('is-expanded'));
    } else {
      screen.classList.add('is-expanded');
    }
    syncFull();
    frame.focus();
  };

  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && screen.classList.contains('is-expanded')) {
      screen.classList.remove('is-expanded');
      syncFull();
    }
  });
  // Cada gestión guardada en el clon llega aquí: se muestra cuántas lleva el asesor en esta práctica.
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; total?: number } | null;
    if (data?.type === 'tipifica:gestion' && typeof data.total === 'number') {
      counter.textContent = `${data.total} ${data.total === 1 ? 'gestión guardada' : 'gestiones guardadas'} en tu práctica`;
    }
  });

  container.querySelector('.tipifica-screen__controls')!.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]')?.dataset.tip;
    if (action === 'full') void toggleFull();
    else if (action === 'guia') send('tipifica:guia');
    else if (action === 'demo') send('tipifica:demo');
    else if (action === 'reload') frame.contentWindow?.location.reload();
  });
}
