export type Png = { width: number; height: number; data: Buffer };
export function readPng(path: string): Png;
export function writePng(path: string, image: Png): void;
