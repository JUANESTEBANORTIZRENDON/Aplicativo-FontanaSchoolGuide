// El indicador se dibuja desde el HTML para evitar destellos sin estilos.
export function showAppLoading(message = 'Preparando tu aula…'): void {
  document.documentElement.classList.add('app-loading');
  document.querySelector<HTMLElement>('#app-loader')!.hidden = false;
  document.querySelector<HTMLElement>('#app-loader-message')!.textContent = message;
  document.querySelector<HTMLElement>('#app-content')!.inert = true;
}

export async function revealApp(): Promise<void> {
  const images = [...document.querySelectorAll<HTMLImageElement>('.auth-brand img, .login-photo img, .brand-image img, .slide.is-active')];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // Un recurso de imagen lento o fallido no debe bloquear el acceso.
  try {
    await Promise.race([
      Promise.all(images.map((image) => image.decode().catch(() => undefined))),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, 5000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  document.querySelector<HTMLElement>('#app-content')!.inert = false;
  document.documentElement.classList.remove('app-loading');
  document.querySelector<HTMLElement>('#app-loader')!.hidden = true;
}

export function showAppLoadingError(): void {
  showAppLoading('No pudimos cargar el aula. Intenta nuevamente.');
  document.querySelector<HTMLElement>('.app-loader-ring')!.hidden = true;
  const retry = document.querySelector<HTMLButtonElement>('#app-loader-retry')!;
  retry.hidden = false;
  retry.onclick = () => location.reload();
  retry.focus();
}
