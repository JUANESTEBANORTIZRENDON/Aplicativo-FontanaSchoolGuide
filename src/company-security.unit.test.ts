import { describe, expect, it } from 'vitest';
import { createSecurityReading } from './company-security';
describe('menu secuencial de seguridad', () => {
  it('habilita el siguiente tema sin permitir saltar los posteriores', () => {
    const reading = createSecurityReading(6);
    expect(reading.select(2)).toBe(false);
    expect(reading.select(1)).toBe(true);
    expect(reading.select(3)).toBe(false);
    expect(reading.select(2)).toBe(true);
  });
  it('permite repasar sin perder los temas habilitados', () => {
    const reading = createSecurityReading(6);
    reading.select(1); reading.select(2); reading.select(0);
    expect(reading.state()).toMatchObject({current:0,unlocked:3,visited:[true,true,true,false,false,false]});
    expect(reading.select(3)).toBe(true);
  });
  it('recorre los seis temas y rechaza indices invalidos', () => {
    const reading = createSecurityReading(6);
    for(let i=0;i<6;i++) expect(reading.select(i)).toBe(true);
    expect(reading.state().visited.every(Boolean)).toBe(true);
    for(const i of [-1,6,1.5]) expect(reading.select(i)).toBe(false);
  });
});
