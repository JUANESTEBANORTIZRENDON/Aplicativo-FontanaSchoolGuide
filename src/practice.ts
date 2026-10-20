import './styles.css';
import './practice.css';
import { mountHeaderAccount } from './header-account';
import { pasosCamino } from './learning-path';

// Destino del módulo 02: "Tu camino en Fontana" arriba y, debajo, "Tu ruta de formación"
// (la monta auth-ui). Los ejercicios se agregarán después.
export function mostrarPractica(nombre: string, experienced: boolean | null, route: string): void {
  const title = experienced === null ? 'Tu ruta de formación' : experienced ? 'Práctica para asesores con experiencia' : 'Práctica para asesores nuevos';
  document.body.className = 'practice-screen';
  document.querySelector<HTMLElement>('#app-content')!.innerHTML = `
    <header><a class="brand" href="${route}" aria-label="Fontana, módulo de práctica"><span class="brand-image"><img src="/imagenes/fontana-logo.webp" alt=""><strong class="brand-name">FONTANA</strong></span></a><span class="header-divider"></span><span class="platform">AULA DE FORMACIÓN</span></header>
    <main>
      <nav class="learning-path" aria-label="Ruta de aprendizaje"><span class="path-label">Tu camino en <strong>Fontana</strong></span>${pasosCamino('practica', route)}</nav>
      <section class="practice-shell" aria-labelledby="practice-title">
        <p class="eyebrow">MÓDULO 02 · TU RUTA DE PRÁCTICA</p>
        <h1 id="practice-title">${title}</h1>
        <p>Avanza módulo por módulo. Cada uno se desbloquea al aprobar el anterior.</p>
        <a class="primary" href="/induccion">Volver a la inducción</a>
      </section>
      <footer><span>Fontana · Aula de formación</span><span>Módulo 02</span></footer>
    </main>`;
  mountHeaderAccount(nombre, 'Práctica Fontana');
}
