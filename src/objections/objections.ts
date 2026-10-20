import '../collections/collections.css';
import { playSeal } from '../seal-animation';
import './objections.css';
import { api, escapar } from '../http';
import { OBJECTION_DECKS, type DeckSlide } from './content';

type Block = { key: string; title: string; objective: string; enabled: boolean; completed: boolean };
type State = { name: string; percent: number; complete: boolean; completedCount: number; currentBlock: string; blocks: Block[]; nextRoute: string | null; nextName: string | null };
type Item = { cover: true; title: string; objective: string } | ({ cover?: false } & DeckSlide);
const BASE = '/training/objections';
const NAME = 'Enfréntate a la objeción';
const NEXT_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="22"/><path d="M22 32h20M34 24l8 8-8 8"/></svg>';
const FULL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

// Módulo formativo presentado como diapositivas grandes. Sin evaluaciones: terminar el cuarto bloque lo completa.
export async function mountObjections(container: HTMLElement, backHref: string): Promise<void> {
  container.innerHTML = `<p role="status" aria-live="polite">Cargando el módulo ${NAME}…</p>`;
  container.classList.add('objections-host');
  let state: State;
  let selected: string;
  let saving = false;
  let error = '';
  let direction: 'next' | 'previous' | '' = '';
  const positions = new Map<string, number>();
  try {
    state = (await api<{ data: State }>(`${BASE}/module`)).data;
    selected = state.currentBlock;
    render();
  } catch (cause) {
    container.innerHTML = `<section class="auth-card collections-error"><h2>No pudimos abrir el módulo</h2><p role="alert">${escapar((cause as Error).message)}</p><a href="${escapar(backHref)}">Volver a tu ruta</a></section>`;
  }

  function block(): Block { return state.blocks.find((item) => item.key === selected)!; }
  function itemsOf(entry: Block): Item[] {
    const items: Item[] = [{ cover: true, title: entry.title, objective: entry.objective }, ...(OBJECTION_DECKS[entry.key] ?? [])];
    // El último bloque cierra con el siguiente paso de la ruta.
    if (state.blocks.indexOf(entry) === state.blocks.length - 1) items.push(nextStepSlide());
    return items;
  }
  function nextStepSlide(): DeckSlide {
    const nextName = state.nextName ?? 'Tipifica';
    return {
      eyebrow: 'Siguiente paso', title: nextName, icon: NEXT_ICON, tone: 'highlight',
      lead: state.complete
        ? `¡Módulo completado! Ya tienes tu sello de ${NAME}. Continúa con ${nextName}.`
        : `Ya conoces cómo comprender y responder una objeción. Finaliza este módulo para obtener tu sello y continuar con ${nextName}.`,
      reminder: 'Tu avance queda guardado en el aula.',
    };
  }
  function focus(selector: string): void { container.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }); }

  function slideHtml(entry: Block, item: Item, index: number, total: number): string {
    const blockNumber = state.blocks.indexOf(entry) + 1;
    if (item.cover) {
      return `<article class="deck-slide deck-slide--cover" role="group" aria-roledescription="diapositiva" aria-label="${index + 1} de ${total}">
        <div class="deck-cover">
          <p class="deck-eyebrow">BLOQUE ${blockNumber} DE ${state.blocks.length}</p>
          <h2 class="deck-title" id="deck-title" tabindex="-1">${escapar(item.title)}</h2>
          <p class="deck-cover-goal"><strong>Objetivo:</strong> ${escapar(item.objective)}</p>
          <p class="deck-cover-hint">Avanza con las flechas del teclado o con los botones.</p>
        </div></article>`;
    }
    const body = item.html ?? `<p class="deck-lead">${escapar(item.lead)}</p>
      ${item.example ? `<figure class="deck-example"><figcaption>Ejemplo ficticio</figcaption><blockquote>${escapar(item.example)}</blockquote></figure>` : ''}
      ${item.reminder ? `<p class="deck-reminder">${escapar(item.reminder)}</p>` : ''}`;
    return `<article class="deck-slide${item.tone ? ` deck-slide--${item.tone}` : ''}" role="group" aria-roledescription="diapositiva" aria-label="${index + 1} de ${total}">
      <aside class="deck-side"><span class="deck-num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div class="deck-icon">${item.icon}</div><p class="deck-block">Bloque ${blockNumber} · ${escapar(entry.title)}</p></aside>
      <div class="deck-body">
        ${item.eyebrow ? `<p class="deck-eyebrow">${escapar(item.eyebrow)}</p>` : ''}
        <h2 class="deck-title" id="deck-title" tabindex="-1">${escapar(item.title)}</h2>
        ${body}
      </div></article>`;
  }

  // Cambia de diapositiva sin recargar la página: solo se vuelve a dibujar la presentación.
  function go(target: number): void {
    const entry = block();
    const total = itemsOf(entry).length;
    const next = Math.max(0, Math.min(total - 1, target));
    const current = positions.get(entry.key) ?? 0;
    if (next === current) return;
    direction = next > current ? 'next' : 'previous';
    positions.set(entry.key, next);
    renderDeck();
    focus('#deck-title');
  }

  async function finishBlock(): Promise<void> {
    if (saving) return;
    const entry = block();
    saving = true; error = ''; renderDeck();
    try {
      const wasComplete = state.complete;
      state = (await api<{ data: State }>(`${BASE}/blocks/${entry.key}/complete`, { method: 'POST', body: JSON.stringify({}) })).data;
      // Terminar el cuarto bloque completa el módulo: aparece el sello antes de mostrar el resultado.
      if (!wasComplete && state.complete) await playSeal({ moduleName: NAME, moduleNumber: 3, label: 'COMPLETADO', nextName: state.nextName });
      const next = state.blocks[state.blocks.findIndex((item) => item.key === entry.key) + 1];
      saving = false;
      if (next?.enabled) { selected = next.key; direction = 'next'; }
      render();
      focus(next?.enabled ? '#deck-title' : '.deck-nav--primary');
    } catch (cause) {
      saving = false; error = (cause as Error).message; renderDeck(); focus('#deck-error');
    }
  }

  function renderDeck(): void {
    const host = container.querySelector<HTMLElement>('#objections-deck');
    if (!host) return;
    const entry = block();
    const items = itemsOf(entry);
    const index = positions.get(entry.key) ?? 0;
    const last = index === items.length - 1;
    const isLastBlock = state.blocks.indexOf(entry) === state.blocks.length - 1;
    host.innerHTML = `<div class="deck-stage" data-motion="${direction}">${slideHtml(entry, items[index]!, index, items.length)}</div>
      ${error ? `<p id="deck-error" class="collections-submit-error" role="alert" tabindex="-1">${escapar(error)}</p>` : ''}
      <div class="deck-bar">
        <button type="button" class="deck-nav" data-prev${index === 0 ? ' disabled' : ''}><span aria-hidden="true">←</span> Anterior</button>
        <div class="deck-track" role="progressbar" aria-label="Diapositivas del bloque" aria-valuemin="1" aria-valuemax="${items.length}" aria-valuenow="${index + 1}"><span style="width:${Math.round((index + 1) / items.length * 100)}%"></span></div>
        <span class="deck-count" aria-live="polite">${index + 1} de ${items.length}</span>
        ${last
          ? (isLastBlock && state.complete && state.nextRoute
            ? `<a class="deck-nav deck-nav--primary" href="${escapar(state.nextRoute)}">Ir a ${escapar(state.nextName ?? 'Tipifica')} →</a>`
            : `<button type="button" class="deck-nav deck-nav--primary" data-finish${saving ? ' disabled' : ''}>${saving ? 'Guardando…' : isLastBlock ? 'Finalizar módulo ✓' : 'Continuar al siguiente bloque →'}</button>`)
          : '<button type="button" class="deck-nav deck-nav--primary" data-next>Siguiente <span aria-hidden="true">→</span></button>'}
        <button type="button" class="deck-full" data-full aria-label="Pantalla completa" title="Pantalla completa">${FULL_ICON}</button>
      </div>`;
    host.querySelector('[data-prev]')?.addEventListener('click', () => go(index - 1));
    host.querySelector('[data-next]')?.addEventListener('click', () => go(index + 1));
    host.querySelector('[data-finish]')?.addEventListener('click', () => { void finishBlock(); });
    host.querySelector('[data-full]')?.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void container.requestFullscreen?.().catch(() => undefined);
    });
  }

  function render(): void {
    container.innerHTML = `<section class="collections-course objections-course" aria-labelledby="collections-title"><header class="collections-heading"><div><p class="collections-kicker">MÓDULO 03</p><h1 id="collections-title">${NAME}</h1><p>Aprende a comprender cada objeción y a responder con criterio, sin prometer lo que no está autorizado.</p></div><a href="${escapar(backHref)}" class="collections-back">Ver mi progreso del aula →</a></header>
      <div class="collections-progress"><div><strong>${state.complete ? 'Módulo completado' : `${state.completedCount} de ${state.blocks.length} bloques completados`}</strong><span>${state.percent} %</span></div><progress max="100" value="${state.percent}" aria-label="Avance del módulo ${NAME}">${state.percent} %</progress></div>
      <nav class="deck-blocks" aria-label="Bloques del módulo"><ol>${state.blocks.map((item, position) => `<li><button type="button" data-block="${item.key}"${item.enabled ? '' : ' disabled'}${item.key === selected ? ' aria-current="step"' : ''}><span class="deck-blocks-num">${item.completed ? '✓' : position + 1}</span><span class="deck-blocks-name">${escapar(item.title)}</span></button></li>`).join('')}</ol></nav>
      <div id="objections-deck" class="deck" role="region" aria-roledescription="presentación" aria-label="${escapar(block().title)}"></div></section>`;
    renderDeck();
    container.querySelectorAll<HTMLButtonElement>('[data-block]').forEach((button) => button.addEventListener('click', () => {
      if (saving) return;
      const target = state.blocks.find((item) => item.key === button.dataset.block)!;
      if (!target.enabled) return;
      selected = target.key; error = ''; direction = '';
      render(); focus('#deck-title');
    }));
  }

  // Flechas del teclado para presentar; se ignoran al escribir o con teclas modificadoras.
  container.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !container.querySelector('#objections-deck')) return;
    const index = positions.get(selected) ?? 0;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
  });
}
