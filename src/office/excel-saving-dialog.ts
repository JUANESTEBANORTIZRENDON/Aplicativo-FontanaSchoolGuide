import { escapar } from '../http';
import './excel-saving-dialog.css';

// Se abre durante la petición real; la confirmación solo la solicita quien recibió la respuesta del servidor.
export function showExcelSavingDialog(host: HTMLElement, destination: string, options: { mode?: 'save' | 'start' | 'analyze' } = {}) {
  const starting = options.mode === 'start';
  const analyzing = options.mode === 'analyze';
  const dialog = document.createElement('dialog');
  const busy = host.getAttribute('aria-busy');
  const started = performance.now();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settle: (() => void) | undefined;
  dialog.className = 'xl-saving-dialog';
  dialog.setAttribute('aria-labelledby', 'xl-saving-title');
  dialog.setAttribute('aria-describedby', 'xl-saving-detail xl-saving-reminder');
  dialog.innerHTML = `<img src="/imagenes/fontana-logo.webp" alt="Fontana" width="64" height="64"><p class="xl-saving-brand">FONTANA SCHOOL</p>
    <span class="xl-saving-indicator" aria-hidden="true"></span><h2 id="xl-saving-title" tabindex="-1" autofocus>${starting ? 'Preparando tu evaluación' : analyzing ? 'Analizando tus resultados' : 'Guardando resultados'}</h2>
    <p id="xl-saving-detail" role="status">${starting ? 'Estamos abriendo tus cinco casos. Espera un momento.' : analyzing ? 'Estamos analizando tus respuestas. No cierres esta ventana.' : `Conservamos tu avance antes de pasar a ${escapar(destination)}.`}</p>
    <p id="xl-saving-reminder">${analyzing ? '<strong>Un momento.</strong> Tu resultado aparecerá en cuanto termine el análisis.' : '<strong>Lee con atención.</strong> Revisa las indicaciones de la siguiente parte antes de comenzar.'}</p>`;
  dialog.addEventListener('cancel', event => event.preventDefault());
  host.append(dialog); host.setAttribute('aria-busy', 'true'); dialog.showModal();
  function close() {
    if (closed) return;
    closed = true; clearTimeout(timer); settle?.();
    if (dialog.open) dialog.close();
    dialog.remove();
    if (busy === null) host.removeAttribute('aria-busy'); else host.setAttribute('aria-busy', busy);
  }
  return {
    async confirm() {
      if (closed) return;
      dialog.classList.add('is-confirmed');
      dialog.querySelector('#xl-saving-title')!.textContent = starting ? '¡Todo listo!' : analyzing ? 'Análisis completado' : 'Resultados guardados';
      dialog.querySelector('#xl-saving-detail')!.textContent = starting ? 'Abriendo tus cinco casos…' : analyzing ? 'Mostrando tu resultado…' : `Preparando ${destination}…`;
      await new Promise<void>(resolve => { settle = resolve; timer = setTimeout(resolve, Math.max(0, 1000 - (performance.now() - started))); });
    },
    close,
  };
}
