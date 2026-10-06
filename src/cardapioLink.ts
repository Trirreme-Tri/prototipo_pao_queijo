// O cardápio público precisa abrir no celular do cliente, que não tem os dados da loja.
// Sem servidor, o cardápio vai dentro do próprio link (parte depois do #).
// O link é dado não confiável: tudo é validado e exibido como texto puro.

import { formatarReais } from './dinheiro';

export interface ItemPublico {
  categoria: string;
  nome: string;
  preco: number | null;
}

export interface CardapioPublico {
  loja: string;
  whatsapp: string;
  itens: ItemPublico[];
}

const LIMITE_ITENS = 150;
const LIMITE_NOME = 80;
const LIMITE_CATEGORIAS = 30;
const CATEGORIAS_V1 = ['Pão de queijo', 'Salgados', 'Bebidas', 'Cafés'];

function paraBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function codificarCardapio(c: CardapioPublico): string {
  const categorias = [...new Set(c.itens.map((i) => i.categoria))];
  return paraBase64Url(
    JSON.stringify({ v: 2, l: c.loja, w: c.whatsapp, c: categorias, i: c.itens.map((i) => [categorias.indexOf(i.categoria), i.nome, i.preco]) }),
  );
}

function itensValidos(brutos: unknown, categorias: string[]): ItemPublico[] | null {
  if (!Array.isArray(brutos) || brutos.length > LIMITE_ITENS) return null;
  const itens: ItemPublico[] = [];
  for (const d of brutos) {
    if (!Array.isArray(d) || d.length !== 3) return null;
    const [cat, nome, preco] = d;
    if (!Number.isInteger(cat) || cat < 0 || cat >= categorias.length) return null;
    if (typeof nome !== 'string' || !nome.trim() || nome.length > LIMITE_NOME) return null;
    if (preco !== null && (!Number.isInteger(preco) || preco < 0 || preco > 10_000_000)) return null;
    itens.push({ categoria: categorias[cat], nome, preco });
  }
  return itens;
}

/** Devolve null se o link estiver quebrado ou adulterado. Aceita também o formato do protótipo antigo (QR já impresso). */
export function decodificarCardapio(codigo: string): CardapioPublico | null {
  try {
    if (codigo.length > 30000) return null;
    const dados: unknown = JSON.parse(deBase64Url(codigo));
    if (Array.isArray(dados)) {
      const itens = itensValidos(dados, CATEGORIAS_V1);
      return itens ? { loja: 'Casa do Pão de Queijo', whatsapp: '', itens } : null;
    }
    if (!dados || typeof dados !== 'object') return null;
    const d = dados as Record<string, unknown>;
    if (d.v !== 2) return null;
    if (typeof d.l !== 'string' || !d.l.trim() || d.l.length > 80) return null;
    if (typeof d.w !== 'string' || !/^(\d{10,13})?$/.test(d.w)) return null;
    if (!Array.isArray(d.c) || d.c.length > LIMITE_CATEGORIAS || !d.c.every((x) => typeof x === 'string' && x.trim() && x.length <= 40)) return null;
    const itens = itensValidos(d.i, d.c as string[]);
    return itens ? { loja: d.l, whatsapp: d.w, itens } : null;
  } catch {
    return null;
  }
}

/** Número com DDD → formato internacional do wa.me (Brasil = 55). */
export function numeroWhatsApp(digitos: string): string | null {
  const d = digitos.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export function linkPedidoWhatsApp(numero: string, loja: string, itens: { nome: string; preco: number; quantidade: number }[], nomeCliente: string, obs: string): string | null {
  const n = numeroWhatsApp(numero);
  if (!n || itens.length === 0) return null;
  const linhas = itens.map((i) => `${i.quantidade}x ${i.nome} — ${formatarReais(i.preco * i.quantidade)}`);
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const texto = [
    `Olá, ${loja}! Quero fazer um pedido:`,
    '',
    ...linhas,
    '',
    `Total: ${formatarReais(total)}`,
    nomeCliente.trim() ? `Nome: ${nomeCliente.trim().slice(0, 40)}` : '',
    obs.trim() ? `Obs.: ${obs.trim().slice(0, 200)}` : '',
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
