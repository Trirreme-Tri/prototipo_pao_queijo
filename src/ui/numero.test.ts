import { describe, expect, it } from 'vitest';
import { lerNumero } from './componentes';

describe('lerNumero', () => {
  it('aceita vírgula e ponto como decimal', () => {
    expect(lerNumero('0,350')).toBe(0.35);
    expect(lerNumero('0.350')).toBe(0.35);
    expect(lerNumero('2.5')).toBe(2.5);
    expect(lerNumero('abc')).toBeNull();
  });
});
