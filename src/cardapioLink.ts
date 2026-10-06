// O cardápio público precisa funcionar no celular do cliente, que não tem os dados do Thiago.
// Sem servidor, a saída é levar o cardápio dentro do próprio link (parte depois do #).
// O link é dado não confiável: tudo é validado e exibido como texto puro.

import { CATEGORIAS, type ItemCardapio } from './estado';

type Compacto = [number, string, number | null]; // [índice da categoria, nome, preço em centavos]

const LIMITE_ITENS = 120;
const LIMITE_NOME = 80;

function paraBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function codificarCardapio(itens: ItemCardapio[]): string {
  const compacto: Compacto[] = itens.map((i) => [CATEGORIAS.indexOf(i.categoria), i.nome, i.preco]);
  return paraBase64Url(JSON.stringify(compacto));
}

export type ItemPublico = Pick<ItemCardapio, 'categoria' | 'nome' | 'preco'>;

/** Devolve null se o link estiver quebrado ou adulterado. */
export function decodificarCardapio(codigo: string): ItemPublico[] | null {
  try {
    if (codigo.length > 20000) return null;
    const dados: unknown = JSON.parse(deBase64Url(codigo));
    if (!Array.isArray(dados) || dados.length > LIMITE_ITENS) return null;
    const itens: ItemPublico[] = [];
    for (const d of dados) {
      if (!Array.isArray(d) || d.length !== 3) return null;
      const [cat, nome, preco] = d;
      if (!Number.isInteger(cat) || cat < 0 || cat >= CATEGORIAS.length) return null;
      if (typeof nome !== 'string' || !nome.trim() || nome.length > LIMITE_NOME) return null;
      if (preco !== null && (!Number.isInteger(preco) || preco < 0 || preco > 10_000_000)) return null;
      itens.push({ categoria: CATEGORIAS[cat], nome, preco });
    }
    return itens;
  } catch {
    return null;
  }
}
