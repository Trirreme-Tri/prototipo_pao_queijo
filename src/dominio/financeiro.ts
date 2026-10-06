// Contas a pagar/receber, relatórios e números do painel.

import { abaixoDoMinimo, custoUnitario, produtoPorId } from './catalogo';
import { caixaAberto, totalFiado } from './caixa';
import type { Conta, Estado, FormaPagamento, Venda } from './tipos';
import { FORMAS_PAGAMENTO } from './tipos';
import { chaveDoDia, diaDoIso, exigirCentavos, exigirTexto, falha, valorItem } from './util';

// ---------- Contas ----------

export function salvarConta(estado: Estado, c: Conta): Estado {
  const descricao = exigirTexto(c.descricao, 'a descrição', 80);
  exigirCentavos(c.valor, false);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.vencimento)) falha('Data de vencimento inválida.');
  if (c.tipo !== 'pagar' && c.tipo !== 'receber') falha('Tipo de conta inválido.');
  const limpo = { ...c, descricao, categoria: c.categoria.trim().slice(0, 40) || 'Outros' };
  const existe = estado.contas.some((x) => x.id === c.id);
  return { ...estado, contas: existe ? estado.contas.map((x) => (x.id === c.id ? limpo : x)) : [...estado.contas, limpo] };
}

export function baixarConta(estado: Estado, id: string, agora: Date): Estado {
  const c = estado.contas.find((x) => x.id === id) ?? falha('Conta não encontrada.');
  if (c.pagaEm) falha('Essa conta já foi baixada.');
  return { ...estado, contas: estado.contas.map((x) => (x.id === id ? { ...x, pagaEm: agora.toISOString() } : x)) };
}

export function estornarConta(estado: Estado, id: string): Estado {
  return { ...estado, contas: estado.contas.map((x) => (x.id === id ? { ...x, pagaEm: null } : x)) };
}

export function removerConta(estado: Estado, id: string): Estado {
  return { ...estado, contas: estado.contas.filter((x) => x.id !== id) };
}

export type SituacaoConta = 'paga' | 'vencida' | 'vence-hoje' | 'aberta';

export function situacaoConta(c: Conta, hoje: string): SituacaoConta {
  if (c.pagaEm) return 'paga';
  if (c.vencimento < hoje) return 'vencida';
  if (c.vencimento === hoje) return 'vence-hoje';
  return 'aberta';
}

// ---------- Relatórios ----------

/** Vendas concluídas cujo dia (local) está entre de e ate, inclusive. Datas AAAA-MM-DD. */
export function vendasNoPeriodo(estado: Estado, de: string, ate: string): Venda[] {
  return estado.vendas.filter((v) => {
    if (v.status !== 'concluida') return false;
    const d = diaDoIso(v.quando);
    return d >= de && d <= ate;
  });
}

export interface RelatorioVendas {
  total: number;
  quantidade: number;
  ticketMedio: number;
  descontos: number;
  porForma: Record<FormaPagamento, number>;
  porProduto: { produtoId: string; nome: string; quantidade: number; valor: number; custo: number | null }[];
  porDia: { dia: string; total: number; quantidade: number }[];
  porHora: number[];
  lucroBrutoEstimado: number | null;
}

export function relatorioVendas(estado: Estado, de: string, ate: string): RelatorioVendas {
  const vendas = vendasNoPeriodo(estado, de, ate);
  const porForma = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0])) as Record<FormaPagamento, number>;
  const prod = new Map<string, { produtoId: string; nome: string; quantidade: number; valor: number; custo: number | null }>();
  const dias = new Map<string, { dia: string; total: number; quantidade: number }>();
  const porHora = Array<number>(24).fill(0);
  let total = 0, descontos = 0, custoTotal = 0, custoCompleto = true;
  for (const v of vendas) {
    total += v.total;
    descontos += v.desconto;
    for (const p of v.pagamentos) porForma[p.forma] += p.valor;
    porForma.dinheiro -= v.troco;
    porHora[new Date(v.quando).getHours()] += v.total;
    const d = diaDoIso(v.quando);
    const dd = dias.get(d) ?? { dia: d, total: 0, quantidade: 0 };
    dd.total += v.total;
    dd.quantidade += 1;
    dias.set(d, dd);
    for (const i of v.itens) {
      const linha = prod.get(i.produtoId) ?? { produtoId: i.produtoId, nome: i.nome, quantidade: 0, valor: 0, custo: 0 };
      linha.quantidade = Math.round((linha.quantidade + i.quantidade) * 1000) / 1000;
      linha.valor += valorItem(i.precoUnit, i.quantidade);
      const p = produtoPorId(estado, i.produtoId);
      const cu = p ? custoUnitario(estado, p) : null;
      if (cu == null) {
        linha.custo = null;
        custoCompleto = false;
      } else {
        if (linha.custo != null) linha.custo += Math.round(cu * i.quantidade);
        custoTotal += Math.round(cu * i.quantidade);
      }
      prod.set(i.produtoId, linha);
    }
  }
  const quantidade = vendas.length;
  return {
    total,
    quantidade,
    ticketMedio: quantidade ? Math.round(total / quantidade) : 0,
    descontos,
    porForma,
    porProduto: [...prod.values()].sort((a, b) => b.valor - a.valor),
    porDia: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
    porHora,
    // Estimativa: usa o custo atual (não o da época) e ignora descontos por item.
    lucroBrutoEstimado: custoCompleto && quantidade ? total - custoTotal : null,
  };
}

export function perdasNoPeriodo(estado: Estado, de: string, ate: string): { produtoId: string; nome: string; quantidade: number; valor: number | null }[] {
  const mapa = new Map<string, { produtoId: string; nome: string; quantidade: number; valor: number | null }>();
  for (const m of estado.movimentos) {
    if (m.tipo !== 'perda') continue;
    const d = diaDoIso(m.quando);
    if (d < de || d > ate) continue;
    const p = produtoPorId(estado, m.produtoId);
    const linha = mapa.get(m.produtoId) ?? { produtoId: m.produtoId, nome: p?.nome ?? '?', quantidade: 0, valor: 0 };
    linha.quantidade = Math.round((linha.quantidade - m.quantidade) * 1000) / 1000;
    const cu = p ? custoUnitario(estado, p) : null;
    linha.valor = cu == null || linha.valor == null ? null : linha.valor + Math.round(cu * -m.quantidade);
    mapa.set(m.produtoId, linha);
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
}

export function producaoNoPeriodo(estado: Estado, de: string, ate: string): { produtoId: string; nome: string; quantidade: number; ordens: number }[] {
  const mapa = new Map<string, { produtoId: string; nome: string; quantidade: number; ordens: number }>();
  for (const o of estado.ordens) {
    if (o.status !== 'concluida' || !o.concluidaEm) continue;
    const d = diaDoIso(o.concluidaEm);
    if (d < de || d > ate) continue;
    const linha = mapa.get(o.produtoId) ?? { produtoId: o.produtoId, nome: produtoPorId(estado, o.produtoId)?.nome ?? '?', quantidade: 0, ordens: 0 };
    linha.quantidade = Math.round((linha.quantidade + o.quantidade) * 1000) / 1000;
    linha.ordens += 1;
    mapa.set(o.produtoId, linha);
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
}

/** Fluxo de caixa realizado: entradas (vendas sem fiado + fiado recebido + contas a receber baixadas) e saídas (contas pagas). */
export function fluxoDeCaixa(estado: Estado, de: string, ate: string): { entradas: number; saidas: number; saldo: number; linhas: { dia: string; entradas: number; saidas: number }[] } {
  const dias = new Map<string, { dia: string; entradas: number; saidas: number }>();
  const add = (dia: string, e: number, s: number) => {
    if (dia < de || dia > ate) return;
    const l = dias.get(dia) ?? { dia, entradas: 0, saidas: 0 };
    l.entradas += e;
    l.saidas += s;
    dias.set(dia, l);
  };
  for (const v of estado.vendas) {
    if (v.status !== 'concluida') continue;
    const semFiado = v.total - v.pagamentos.filter((p) => p.forma === 'fiado').reduce((s, p) => s + p.valor, 0);
    add(diaDoIso(v.quando), Math.max(0, semFiado), 0);
  }
  for (const l of estado.fiado) if (l.tipo === 'pagamento') add(diaDoIso(l.quando), l.valor, 0);
  for (const c of estado.contas) {
    if (!c.pagaEm) continue;
    if (c.tipo === 'receber') add(diaDoIso(c.pagaEm), c.valor, 0);
    else add(diaDoIso(c.pagaEm), 0, c.valor);
  }
  const linhas = [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  const entradas = linhas.reduce((s, l) => s + l.entradas, 0);
  const saidas = linhas.reduce((s, l) => s + l.saidas, 0);
  return { entradas, saidas, saldo: entradas - saidas, linhas };
}

// ---------- Painel ----------

export function painel(estado: Estado, agora: Date) {
  const hoje = chaveDoDia(agora);
  const rel = relatorioVendas(estado, hoje, hoje);
  const pedidosAbertos = estado.pedidos.filter((p) => p.status === 'novo' || p.status === 'preparando' || p.status === 'pronto');
  const ordensAbertas = estado.ordens.filter((o) => o.status === 'planejada' || o.status === 'produzindo');
  const contasHoje = estado.contas.filter((c) => !c.pagaEm && c.vencimento <= hoje);
  const fiadoTotal = totalFiado(estado);
  const fornadasHoje = estado.ordens.filter((o) => o.status === 'concluida' && o.concluidaEm && diaDoIso(o.concluidaEm) === hoje).length;
  return {
    hoje,
    vendasHoje: rel.total,
    quantidadeHoje: rel.quantidade,
    ticketHoje: rel.ticketMedio,
    maisVendidosHoje: rel.porProduto.slice(0, 5),
    porHoraHoje: rel.porHora,
    caixa: caixaAberto(estado) ?? null,
    pedidosAbertos,
    ordensAbertas,
    producoesHoje: fornadasHoje,
    estoqueBaixo: abaixoDoMinimo(estado),
    contasVencendo: contasHoje,
    fiadoTotal,
  };
}
