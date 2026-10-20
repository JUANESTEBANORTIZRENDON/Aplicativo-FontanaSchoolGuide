import './tipifica.css';
import { api, escapar } from '../http';
import { TYPIFICATION_MINIMUM } from '../simulador/domain/expert/minimum';

// Módulo 04 «Tipifica»: el clon de práctica de Control Next se muestra en una pantalla dentro de la página
// (iframe /simulador/), con pantalla completa como un video para que la práctica sea inmersiva.

const SECTIONS: { title: string; text: string }[] = [
  { title: 'Dashboard y campañas', text: 'Tu perfil (nombre, cédula, extensión, teléfono) y las campañas que tienes asignadas. Cada tarjeta es una cartera: al pulsarla entras a sus clientes.' },
  { title: 'Encabezado', text: 'Reloj con la hora de Bogotá, tu extensión y tu estado (CONECTADO o EN PAUSA), la lista de tareas, los avisos, los pagos, la lupa de búsqueda y tu avatar (Mi Perfil, Pausa, Logout).' },
  { title: 'Menú lateral', text: 'Solo usamos cuatro opciones: Main (tu perfil y campañas), Dashboard (cifras de la campaña), Productividad y Clientes. «Adm. Pausas» es una opción adicional que no es de nuestro uso: ignórala.' },
  { title: 'Clientes y filtros', text: 'Filtra por fechas de promesa y de gestión, ciudad, asesor, mejor y último perfil. La tabla muestra identificación, nombre, perfiles, asesor, fecha de gestión y promesas.' },
  { title: 'Estado de Gestión de Cartera', text: 'El semáforo: cian sin gestión, amarillo menos de 5 días sin gestión, rojo más de 5 días y verde gestionado hoy. Pulsa un color para filtrar.' },
  { title: 'Buscar por cédula', text: 'La lupa abre el panel «Buscar». Escribes la cédula, pulsas Buscar, Control Next confirma campaña, nombre e identificación y con OK abres la ficha.' },
  { title: 'Pausas', text: 'Si estás en llamada, termínala primero y guarda la gestión. Luego avatar → Pausa → elige el tipo (BREAK AM, ALMUERZO, BAÑO…) → Enviar. Al volver pulsa Continuar.' },
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
  { name: 'Pausa / Continuar', text: 'Pausa (en tu avatar) detiene tus llamadas mientras te levantas; Continuar te deja otra vez CONECTADO.' },
  { name: 'Micrófono / Audio', text: 'Las llamadas se graban y se escuchan desde el histórico.' },
];

const TERMS: [string, string][] = [
  ['Acción', '«Hacer Llamada» si marcaste tú; «Recibir Llamada» si el cliente te llamó.'],
  ['Contacto', 'Depende de la acción: Directo (titular), Indirecto (un tercero) o Sin Contacto. Si te llamaron no existe «Sin Contacto».'],
  ['Canal', 'Telefonico, Whatsapp o Correo.'],
  ['Perfil', 'Depende del contacto. Con el titular: acuerdo de pago total o abono, recordar, volver a llamar, no hubo acuerdo, PQR, paz y salvo… Con un tercero nunca hay acuerdo de pago.'],
  ['Motivo No Pago', 'Por qué no ha pagado o qué queda por confirmar: confirmar pago, con recibo, no cuenta con el dinero, ocupado, tercero encargado…'],
  ['TT', 'Titular de la obligación. La gestión se escribe «3001234567 // TT INDICA QUE…».'],
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

      <section class="tipifica-minimum" aria-labelledby="tipifica-minimum-title">
        <div class="tipifica-minimum__head">
          <h3 id="tipifica-minimum-title">Lo mínimo que debe tener una tipificación</h3>
          <p>La prueba de tipificación revisa estos puntos en cada llamada.</p>
        </div>
        <ol class="tipifica-minimum__list">
          ${TYPIFICATION_MINIMUM.map((m) => `<li><span class="tipifica-tick" aria-hidden="true">✓</span><div><strong>${escapar(m.title)}</strong><p>${escapar(m.text)}</p></div></li>`).join('')}
        </ol>
        <p class="tipifica-result" id="tipifica-result" aria-live="polite" hidden></p>
      </section>

      <div class="tipifica-screen" id="tipifica-screen">
        <div class="tipifica-screen__bar" aria-hidden="true">
          <span class="tipifica-dots"><i></i><i></i><i></i></span>
          <span class="tipifica-url">controlnext · práctica</span>
        </div>
        <div class="tipifica-screen__frame">
          <iframe id="tipifica-frame" title="Control Next (práctica)" src="${escapar(src)}" allow="fullscreen" loading="lazy"></iframe>
        </div>
        <div class="tipifica-screen__controls" role="toolbar" aria-label="Controles de la pantalla de práctica">
          <button type="button" class="tipifica-ctl tipifica-ctl--test" data-tip="prueba">Iniciar prueba de tipificación</button>
          <button type="button" class="tipifica-ctl" data-tip="guia">Guía de esta pantalla</button>
          <button type="button" class="tipifica-ctl" data-tip="demo">Ver cómo se ingresa una cédula</button>
          <button type="button" class="tipifica-ctl" data-tip="pausa">Ver cómo se hace una pausa</button>
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
          <p class="tipifica-note">Los perfiles y motivos con titular son los de Control Next; los de contacto con tercero y sin contacto son una propuesta de entrenamiento que tu supervisor confirmará.</p>
        </section>
      </div>

      <a class="secondary-link" href="${escapar(backHref)}">← Volver a tu ruta</a>
    </section>`;

  const screen = container.querySelector<HTMLElement>('#tipifica-screen')!;
  const frame = container.querySelector<HTMLIFrameElement>('#tipifica-frame')!;
  const fullBtn = container.querySelector<HTMLButtonElement>('[data-tip="full"]')!;
  const counter = container.querySelector<HTMLElement>('#tipifica-count')!;
  const resultBox = container.querySelector<HTMLElement>('#tipifica-result')!;

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
    const data = event.data as { type?: string; total?: number; approved?: number; average?: number } | null;
    // Resultado de la prueba de tipificación (lo envía el clon al terminar los 6 ejercicios).
    if (data?.type === 'tipifica:prueba' && typeof data.approved === 'number' && typeof data.total === 'number') {
      resultBox.hidden = false;
      resultBox.classList.toggle('is-ok', data.approved === data.total);
      resultBox.textContent = `Tu prueba de tipificación: ${data.approved} de ${data.total} llamadas correctas · puntaje promedio ${data.average ?? 0} %.`;
    }
    if (data?.type === 'tipifica:gestion' && typeof data.total === 'number') {
      counter.textContent = `${data.total} ${data.total === 1 ? 'gestión guardada' : 'gestiones guardadas'} en tu práctica`;
    }
  });

  container.querySelector('.tipifica-screen__controls')!.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]')?.dataset.tip;
    if (action === 'full') void toggleFull();
    else if (action === 'guia') send('tipifica:guia');
    else if (action === 'demo') send('tipifica:demo');
    else if (action === 'pausa') send('tipifica:pausa');
    else if (action === 'prueba') send('tipifica:prueba');
    else if (action === 'reload') frame.contentWindow?.location.reload();
  });
}
