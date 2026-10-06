// Guarda o estado no localStorage do navegador. Os dados ficam só neste aparelho.

import { estadoInicial, validarEstado, type Estado } from './estado';

export const CHAVE = 'casa-pao-de-queijo:v1';

export interface Armazem {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type Carga = { estado: Estado; aviso: null | 'sem-armazenamento' | 'dados-corrompidos' };

export function carregar(armazem: Armazem | null): Carga {
  if (!armazem) return { estado: estadoInicial(), aviso: 'sem-armazenamento' };
  let bruto: string | null;
  try {
    bruto = armazem.getItem(CHAVE);
  } catch {
    return { estado: estadoInicial(), aviso: 'sem-armazenamento' };
  }
  if (bruto == null) return { estado: estadoInicial(), aviso: null };
  try {
    return { estado: validarEstado(JSON.parse(bruto)), aviso: null };
  } catch {
    // Não apaga o que estava lá: guarda uma cópia para não perder nada.
    try {
      armazem.setItem(CHAVE + ':corrompido:' + Date.now(), bruto);
    } catch {
      /* sem espaço: segue com estado novo */
    }
    return { estado: estadoInicial(), aviso: 'dados-corrompidos' };
  }
}

/** Devolve false se o navegador recusou salvar (modo anônimo, sem espaço). */
export function salvar(armazem: Armazem | null, estado: Estado): boolean {
  if (!armazem) return false;
  try {
    armazem.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

export function apagarTudo(armazem: Armazem | null): void {
  try {
    armazem?.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

export function armazemDoNavegador(): Armazem | null {
  try {
    const s = window.localStorage;
    const teste = CHAVE + ':teste';
    s.setItem(teste, '1');
    s.removeItem(teste);
    return s;
  } catch {
    return null;
  }
}
