import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTutor, type Tutor } from './tutor';

class Classes {
  values = new Set<string>();
  add(...names: string[]) { names.forEach(name => this.values.add(name)); }
  remove(...names: string[]) { names.forEach(name => this.values.delete(name)); }
  contains(name: string) { return this.values.has(name); }
  toggle(name: string, active: boolean) { if (active) this.add(name); else this.remove(name); }
}
class Element {
  classList = new Classes(); dataset: Record<string, string> = {}; style = { setProperty: vi.fn() };
  innerHTML = ''; src = ''; className = ''; alt = ''; draggable = false; decoding = '';
  children: Element[] = []; figure: Element | null = null;
  append(child: Element) { this.children.push(child); }
  setAttribute = vi.fn();
  querySelector() { return this.figure; }
}
const frame = (host: Element) => host.figure?.children.find(child => child.classList.contains('is-visible'))?.src.split('/').at(-1);
let documentEvents: EventTarget & { hidden: boolean };
let motion: EventTarget & { matches: boolean };
let tutors: Tutor[];
function mount(ambient = true) {
  const host = new Element(); host.figure = new Element();
  const tutor = createTutor(host as unknown as HTMLElement, { ambient }); tutors.push(tutor);
  return { host, tutor };
}
describe('ciclo de vida y movimiento del avatar', () => {
  beforeEach(() => {
    vi.useFakeTimers(); tutors = [];
    motion = Object.assign(new EventTarget(), { matches: false });
    documentEvents = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('document', Object.assign(documentEvents, { createElement: () => new Element() }));
    vi.stubGlobal('window', { matchMedia: () => motion, setTimeout, clearTimeout });
    vi.stubGlobal('Image', class { decoding = ''; src = ''; decode() { return Promise.resolve(); } });
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => { tutors.forEach(tutor => tutor.destroy()); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('parpadea y regresa a la pose de reposo sin acumular temporizadores', async () => {
    const { host, tutor } = mount(); await tutor.preload([]);
    expect(frame(host)).toBe('rest.png'); expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(3600); expect(frame(host)).toBe('rest-blink-half.png');
    await vi.advanceTimersByTimeAsync(70); expect(frame(host)).toBe('rest-blink.png');
    await vi.advanceTimersByTimeAsync(160); expect(frame(host)).toBe('rest.png');
    tutor.rest(); tutor.rest(); expect(vi.getTimerCount()).toBe(1);
  });
  it('muestra ánimo al corregir incluso si se solicita antes de terminar de cargar', async () => {
    const { host, tutor } = mount(false); tutor.react('support'); await tutor.preload(['think']);
    expect(frame(host)).toBe('think.png'); expect(host.dataset.expression).toBe('support');
    await vi.advanceTimersByTimeAsync(1500); expect(frame(host)).toBe('rest.png');
    expect(host.dataset.expression).toBeUndefined(); expect(host.classList.contains('is-quiet')).toBe(true);
  });
  it('una nueva pose de narración cancela la reacción anterior', async () => {
    const { host, tutor } = mount(); await tutor.preload([]);
    tutor.react('success'); await tutor.preload(['affirm']);
    tutor.hold('point'); await vi.advanceTimersByTimeAsync(8000);
    expect(frame(host)).toBe('point.png'); expect(vi.getTimerCount()).toBe(0);
  });
  it('se queda quieto al escribir y detiene los temporizadores al ocultarse o desmontarse', async () => {
    const { host, tutor } = mount(false); await tutor.preload([]);
    tutor.pauseAmbient(true); await vi.advanceTimersByTimeAsync(30000);
    expect(frame(host)).toBe('rest.png'); expect(vi.getTimerCount()).toBe(0);
    tutor.pauseAmbient(false); expect(vi.getTimerCount()).toBe(1);
    documentEvents.hidden = true; documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    documentEvents.hidden = false; documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(1);
    tutor.destroy(); expect(vi.getTimerCount()).toBe(0);
  });
  it('respeta movimiento reducido y los cambios de preferencia durante la sesión', async () => {
    motion.matches = true;
    const { host, tutor } = mount(); await tutor.preload([]);
    expect(frame(host)).toBe('rest.png'); expect(vi.getTimerCount()).toBe(0);
    tutor.react('complete'); await tutor.preload(['celebrate-grin']);
    expect(frame(host)).toBe('celebrate-grin.png');
    await vi.advanceTimersByTimeAsync(700); expect(frame(host)).toBe('celebrate-grin.png');
    await vi.advanceTimersByTimeAsync(700); expect(frame(host)).toBe('rest.png'); expect(vi.getTimerCount()).toBe(0);
    motion.matches = false; motion.dispatchEvent(new Event('change')); expect(vi.getTimerCount()).toBe(1);
  });
});
