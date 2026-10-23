/** A reference can replace selected text or follow a formula operator. */
export function referenceSlot(text: string, start: number, end = start, previous?: { start: number; end: number; text: string }) {
  if (!text.startsWith('=')) return null;
  if (previous?.text === text && start === end && start === previous.end) return { start: previous.start, end: previous.end };
  if (/[=(,+\-:;]$/.test(text.slice(0, start).trimEnd())) return { start, end };
  return null;
}

export function referenceRange(a: { r: number; c: number }, b: { r: number; c: number }) {
  const address = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;
  const first = address(Math.min(a.r, b.r), Math.min(a.c, b.c));
  const last = address(Math.max(a.r, b.r), Math.max(a.c, b.c));
  return first === last ? first : `${first}:${last}`;
}

export function closeSumFormula(text: string) {
  return /^=(SUMA|SUM)\([A-F]\d+:[A-F]\d+$/i.test(text.trim()) ? `${text.trim()})` : text;
}
