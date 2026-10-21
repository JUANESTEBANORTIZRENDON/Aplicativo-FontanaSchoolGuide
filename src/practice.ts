import './styles.css';
import './practice.css';
import { mountHeaderAccount } from './header-account';
import { pasosCamino } from './learning-path';

// La ruta de formación se monta desde auth-ui debajo de la barra de navegación.
export function mostrarPractica(nombre: string, route: string): void {
  document.body.className = 'practice-screen';
  document.querySelector<HTMLElement>('#app-content')!.innerHTML = `
    <header><a class="brand" href="${route}" aria-label="Fontana, módulo de práctica"><span class="brand-image"><img src="/imagenes/fontana-logo.webp" alt=""><strong class="brand-name">FONTANA</strong></span></a><span class="header-divider"></span><span class="platform">AULA DE FORMACIÓN</span></header>
    <main>
      <nav class="learning-path" aria-label="Ruta de aprendizaje"><span class="path-label">Tu camino en <strong>Fontana</strong></span>${pasosCamino('practica', route)}</nav>
      <footer><span>Fontana · Aula de formación</span><span>Módulo 02</span></footer>
    </main>`;
  mountHeaderAccount(nombre, 'Práctica Fontana');
}
