import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeakerEvents } from './speaker';
import { PRINCIPLES } from './principles';

const mocks = vi.hoisted(() => ({
  select: vi.fn(), toggle: vi.fn(), stop: vi.fn(), destroy: vi.fn(),
  events: null as SpeakerEvents | null,
}));
vi.mock('./speaker', () => ({ createSpeaker: (_tutor: unknown, events: SpeakerEvents) => {
  mocks.events = events;
  return mocks;
} }));
vi.mock('./tutor', () => ({ createTutor: () => ({ destroy: vi.fn() }) }));
import { mountPrinciples } from './principles-panel';

function host() {
  const nodes = new Map<string, ReturnType<typeof node>>();
  function node() {
    return { textContent: '', hidden: false, disabled: false, title: '', classList: { toggle: vi.fn() }, setAttribute: vi.fn(), addEventListener: vi.fn() };
  }
  const buttons = PRINCIPLES.map(() => node());
  return {
    innerHTML: '',
    querySelector(selector: string) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector)!;
    },
    querySelectorAll: () => buttons,
  };
}

describe('narración automática de principios', () => {
  beforeEach(() => vi.clearAllMocks());

  it('empieza al mostrarse, avanza los cinco audios en orden y se detiene al final', () => {
    const element = host();
    const panel = mountPrinciples(element as unknown as HTMLElement);
    expect(mocks.toggle).not.toHaveBeenCalled();
    panel.show();
    panel.show();
    expect(mocks.toggle).toHaveBeenCalledTimes(1);
    for (let i = 0; i < PRINCIPLES.length; i++) mocks.events!.ended!();
    expect(mocks.select.mock.calls.map(([principle]) => principle.id)).toEqual(PRINCIPLES.map(p => p.id));
    expect(mocks.toggle).toHaveBeenCalledTimes(PRINCIPLES.length);
    expect(element.querySelector('#principle-play').hidden).toBe(true);
    expect(element.querySelector('#principle-status').textContent).toContain('Terminaste');
    expect(element.innerHTML).not.toContain('principle-progress');
    expect(element.innerHTML).not.toContain('principle-replay');
  });

  it('detiene la voz al salir y no avanza desde una sección oculta', () => {
    const panel = mountPrinciples(host() as unknown as HTMLElement);
    panel.show();
    panel.hide();
    mocks.events!.ended!();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    panel.show();
    expect(mocks.toggle).toHaveBeenCalledTimes(2);
    panel.destroy();
    mocks.events!.ended!();
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it('desbloquea solo el siguiente al terminar y cuenta el último cuando acaba su audio', () => {
    const element = host();
    const progress = vi.fn();
    const panel = mountPrinciples(element as unknown as HTMLElement, { onProgress: progress });
    const buttons = element.querySelectorAll();
    const click = (position: number) => buttons[position]!.addEventListener.mock.calls.find(([name]) => name === 'click')![1]();
    expect(buttons.map(button => button.disabled)).toEqual([false, true, true, true, true]);
    click(3);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith({ reviewed: 0, total: 5 });
    panel.show();
    for (let completed = 1; completed <= 4; completed++) {
      mocks.events!.ended!();
      expect(buttons.map(button => button.disabled)).toEqual(PRINCIPLES.map((_, i) => i > completed));
      expect(progress).toHaveBeenLastCalledWith({ reviewed: completed, total: 5 });
    }
    mocks.events!.ended!();
    expect(progress).toHaveBeenLastCalledWith({ reviewed: 5, total: 5 });
    click(0);
    mocks.events!.ended!();
    expect(progress).toHaveBeenCalledTimes(6);
    expect(buttons.every(button => !button.disabled)).toBe(true);
  });
});
