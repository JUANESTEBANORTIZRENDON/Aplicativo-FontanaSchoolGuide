// Solo presentación: permite leer la opción completa cuando el select nativo
// la recorta en una pantalla pequeña. No cambia valores ni valida respuestas.
export function showSelectedCollectionOptions(root: HTMLElement): void {
  root.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    const display = document.createElement('span');
    display.className = 'collections-select-value';
    display.id = `${select.id}-selected-display`;
    const check = document.createElement('span');
    check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
    const text = document.createElement('span');
    display.append(check, text); select.after(display);
    const describedBy = select.getAttribute('aria-describedby');
    select.setAttribute('aria-describedby', [describedBy, display.id].filter(Boolean).join(' '));
    const update = () => {
      display.hidden = !select.value;
      text.textContent = select.value ? `Seleccionado: ${select.selectedOptions[0]?.textContent ?? ''}` : '';
    };
    select.addEventListener('input', update); select.addEventListener('change', update); update();
  });
}
