import './styles.css';
import './practice.css';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

// Solo define el destino del módulo 02. Los ejercicios se agregarán después.
export function mostrarPractica(nombre: string, experienced: boolean): void {
  const title = experienced ? 'Práctica para asesores con experiencia' : 'Práctica para asesores nuevos';
  document.body.className = 'practice-screen';
  document.querySelector<HTMLElement>('#app-content')!.innerHTML = `
    <div class="training-session"><span>${escapeHtml(nombre)} · Práctica Fontana</span><button id="practice-logout" type="button">Cerrar sesión</button></div>
    <header><a class="brand" href="${experienced ? '/practica/experiencia' : '/practica/nuevo'}" aria-label="Fontana, módulo de práctica"><span class="brand-image"><img src="/imagenes/fontana-logo.png" alt=""><strong class="brand-name">FONTANA</strong></span></a><span class="header-divider"></span><span class="platform">AULA DE FORMACIÓN</span></header>
    <main>
      <nav class="learning-path" aria-label="Ruta de aprendizaje"><span class="path-label">Tu camino en <strong>Fontana</strong></span><ol>
        <li data-status="completed"><span class="path-number">✓</span><span>Conoce la empresa<small>Completado</small></span></li>
        <li class="path-current" aria-current="step" data-status="pending"><span class="path-number">02</span><span>Practica<small>Estás aquí</small></span></li>
        <li class="path-upcoming" data-status="pending"><span class="path-number">03</span><span>Evalúate<small>Próximamente</small></span></li>
      </ol></nav>
      <section class="practice-shell" aria-labelledby="practice-title">
        <p class="eyebrow">MÓDULO 02 · TU RUTA DE PRÁCTICA</p>
        <h1 id="practice-title">${title}</h1>
        <p>Guardamos tu respuesta. Los ejercicios de esta ruta estarán disponibles próximamente.</p>
        <a class="primary" href="/induccion">Volver a la inducción</a>
      </section>
      <footer><span>Fontana · Aula de formación</span><span>Módulo 02</span></footer>
    </main>`;
  const logout = document.querySelector<HTMLButtonElement>('#practice-logout')!;
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
      location.assign('/login');
    } catch { logout.disabled = false; logout.textContent = 'Reintentar cerrar sesión'; }
  });
}
