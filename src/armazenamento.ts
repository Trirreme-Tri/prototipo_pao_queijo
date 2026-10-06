// Guarda o estado no localStorage do navegador. Os dados ficam só neste aparelho.
// Abas abertas no mesmo navegador conversam entre si (evento "storage" em main.ts).

import { dadosDemonstracao, estadoVazio, migrarV1 } from './dominio/inicial';
import type { Estado } from './dominio/tipos';
import { validarEstado } from './dominio/validacao';

export const CHAVE = 'casa-pao-de-queijo:v2';
export const CHAVE_V1 = 'casa-pao-de-queijo:v1';

export interface Armazem {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type AvisoCarga = null | 'sem-armazenamento' | 'dados-corrompidos' | 'migrado-v1';
export type Carga = { estado: Estado; aviso: AvisoCarga };

function lerV1(bruto: string): Estado | null {
  try {
    const v = JSON.parse(bruto);
    if (!v || v.versao !== 1 || !Array.isArray(v.cardapio) || !Array.isArray(v.clientes) || !v.estoque) return null;
    return validarEstado(migrarV1(v));
  } catch {
    return null;
  }
}

export function carregar(armazem: Armazem | null, agora: Date): Carga {
  if (!armazem) return { estado: dadosDemonstracao(agora), aviso: 'sem-armazenamento' };
  let bruto: string | null;
  let v1: string | null;
  try {
    bruto = armazem.getItem(CHAVE);
    v1 = armazem.getItem(CHAVE_V1);
  } catch {
    return { estado: dadosDemonstracao(agora), aviso: 'sem-armazenamento' };
  }
  if (bruto == null) {
    // Primeira vez nesta versão: aproveita o protótipo antigo, se houver; senão, demonstração.
    const migrado = v1 ? lerV1(v1) : null;
    return migrado ? { estado: migrado, aviso: 'migrado-v1' } : { estado: dadosDemonstracao(agora), aviso: null };
  }
  try {
    return { estado: validarEstado(JSON.parse(bruto)), aviso: null };
  } catch {
    // Não apaga o que estava lá: guarda uma cópia para não perder nada.
    try {
      armazem.setItem(CHAVE + ':corrompido:' + Date.now(), bruto);
    } catch {
      /* sem espaço: segue com estado novo */
    }
    return { estado: estadoVazio(), aviso: 'dados-corrompidos' };
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
