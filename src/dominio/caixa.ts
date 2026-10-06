// Caixa (frente de loja): sessões, vendas, pagamentos, fiado e pedidos da cozinha.
// Controle interno: não emite documento fiscal.

import { baixarVendido, devolverVenda, exigirProduto } from './catalogo';
import type { Cliente, Estado, FormaPagamento, ItemVenda, LancamentoFiado, MovCaixa, Pagamento, Pedido, SessaoCaixa, StatusPedido, Venda } from './tipos';
import { FORMAS_PAGAMENTO } from './tipos';
import { exigirCentavos, exigirQuantidade, exigirTexto, falha, novoId, valorItem } from './util';

// ---------- Sessão ----------

export function caixaAberto(estado: Estado): SessaoCaixa | undefined {
  return estado.caixas.find((c) => c.fechadaEm == null);
}

export function abrirCaixa(estado: Estado, operador: string, valorInicial: number, agora: Date): Estado {
  if (caixaAberto(estado)) falha('Já existe um caixa aberto.');
  const nome = exigirTexto(operador, 'o nome de quem está no caixa', 40);
  exigirCentavos(valorInicial);
  const numero = estado.seq.caixa + 1;
  const sessao: SessaoCaixa = { id: novoId(), numero, operador: nome, abertaEm: agora.toISOString(), fechadaEm: null, valorInicial, movimentos: [], contado: null };
  return { ...estado, caixas: [...estado.caixas, sessao], seq: { ...estado.seq, caixa: numero } };
}

function exigirCaixa(estado: Estado): SessaoCaixa {
  return caixaAberto(estado) ?? falha('Abra o caixa primeiro.');
}

function comMovCaixa(estado: Estado, sessao: SessaoCaixa, mov: MovCaixa): Estado {
  return { ...estado, caixas: estado.caixas.map((c) => (c.id === sessao.id ? { ...c, movimentos: [...c.movimentos, mov] } : c)) };
}

export function sangria(estado: Estado, valor: number, obs: string, agora: Date): Estado {
  const s = exigirCaixa(estado);
  exigirCentavos(valor, false);
  const r = resumoSessao(estado, s);
  if (valor > r.dinheiroEsperado) falha('Não há esse valor em dinheiro na gaveta.');
  return comMovCaixa(estado, s, { id: novoId(), quando: agora.toISOString(), tipo: 'sangria', valor, forma: null, obs: obs.trim().slice(0, 80) });
}

export function suprimento(estado: Estado, valor: number, obs: string, agora: Date): Estado {
  const s = exigirCaixa(estado);
  exigirCentavos(valor, false);
  return comMovCaixa(estado, s, { id: novoId(), quando: agora.toISOString(), tipo: 'suprimento', valor, forma: null, obs: obs.trim().slice(0, 80) });
}

export interface ResumoSessao {
  vendas: number;
  canceladas: number;
  bruto: number;
  descontos: number;
  total: number;
  porForma: Record<FormaPagamento, number>;
  sangrias: number;
  suprimentos: number;
  recebimentos: Record<FormaPagamento, number>;
  /** Dinheiro que deveria estar na gaveta. */
  dinheiroEsperado: number;
}

export function resumoSessao(estado: Estado, s: SessaoCaixa): ResumoSessao {
  const zero = () => Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0])) as Record<FormaPagamento, number>;
  const porForma = zero();
  const recebimentos = zero();
  let vendas = 0, canceladas = 0, bruto = 0, descontos = 0, total = 0, sangrias = 0, suprimentos = 0;
  for (const v of estado.vendas) {
    if (v.sessaoId !== s.id) continue;
    if (v.status === 'cancelada') {
      canceladas += 1;
      continue;
    }
    vendas += 1;
    bruto += v.subtotal;
    descontos += v.desconto;
    total += v.total;
    for (const p of v.pagamentos) porForma[p.forma] += p.valor;
    porForma.dinheiro -= v.troco;
  }
  for (const m of s.movimentos) {
    if (m.tipo === 'sangria') sangrias += m.valor;
    else if (m.tipo === 'suprimento') suprimentos += m.valor;
    else if (m.forma) recebimentos[m.forma] += m.valor;
  }
  const dinheiroEsperado = s.valorInicial + suprimentos - sangrias + porForma.dinheiro + recebimentos.dinheiro;
  return { vendas, canceladas, bruto, descontos, total, porForma, sangrias, suprimentos, recebimentos, dinheiroEsperado };
}

export function fecharCaixa(estado: Estado, contado: number, agora: Date): Estado {
  const s = exigirCaixa(estado);
  exigirCentavos(contado);
  return { ...estado, caixas: estado.caixas.map((c) => (c.id === s.id ? { ...c, fechadaEm: agora.toISOString(), contado } : c)) };
}

// ---------- Venda ----------

export interface NovaVenda {
  itens: { produtoId: string; quantidade: number }[];
  desconto: number;
  pagamentos: Pagamento[];
  clienteId: string | null;
  /** Nome ou senha para chamar o cliente quando o pedido da cozinha ficar pronto. */
  identificacao?: string;
}

export function subtotalItens(estado: Estado, itens: { produtoId: string; quantidade: number }[]): number {
  return itens.reduce((s, i) => s + valorItem(exigirProduto(estado, i.produtoId).preco ?? 0, i.quantidade), 0);
}

/** Calcula o que falta pagar e o troco, para a tela de pagamento. */
export function calcularPagamento(total: number, pagamentos: Pagamento[]): { pago: number; falta: number; troco: number } {
  const pago = pagamentos.reduce((s, p) => s + p.valor, 0);
  return { pago, falta: Math.max(0, total - pago), troco: Math.max(0, pago - total) };
}

/** Quanto o cliente deve. Negativo = crédito a favor dele (ex.: pagou e a venda foi cancelada). */
export function saldoFiado(estado: Estado, clienteId: string): number {
  return estado.fiado.reduce((s, l) => (l.clienteId !== clienteId ? s : l.tipo === 'compra' ? s + l.valor : s - l.valor), 0);
}

export function registrarVenda(estado: Estado, nv: NovaVenda, agora: Date): { estado: Estado; venda: Venda } {
  const sessao = exigirCaixa(estado);
  if (nv.itens.length === 0) falha('A venda está vazia.');
  const itens: ItemVenda[] = nv.itens.map((i) => {
    const p = exigirProduto(estado, i.produtoId);
    if (!p.ativo || p.tipo === 'insumo') falha(`${p.nome} não está à venda.`);
    if (p.preco == null) falha(`${p.nome} está sem preço. Cadastre o preço antes.`);
    return { produtoId: p.id, nome: p.nome, precoUnit: p.preco, quantidade: exigirQuantidade(i.quantidade, p.unidade) };
  });
  const subtotal = itens.reduce((s, i) => s + valorItem(i.precoUnit, i.quantidade), 0);
  const desconto = exigirCentavos(nv.desconto);
  if (desconto > subtotal) falha('Desconto maior que a venda.');
  const total = subtotal - desconto;

  const pagamentos = nv.pagamentos.filter((p) => p.valor > 0);
  for (const p of pagamentos) {
    if (!FORMAS_PAGAMENTO.includes(p.forma)) falha('Forma de pagamento inválida.');
    exigirCentavos(p.valor);
  }
  const { pago, troco } = calcularPagamento(total, pagamentos);
  if (pago < total) falha('O pagamento não cobre o total.');
  const dinheiro = pagamentos.filter((p) => p.forma === 'dinheiro').reduce((s, p) => s + p.valor, 0);
  if (troco > dinheiro) falha('Troco só sai de pagamento em dinheiro. Confira os valores do cartão/Pix/fiado.');

  const fiado = pagamentos.filter((p) => p.forma === 'fiado').reduce((s, p) => s + p.valor, 0);
  let cliente: Cliente | undefined;
  if (fiado > 0 || nv.clienteId) {
    cliente = estado.clientes.find((c) => c.id === nv.clienteId && c.ativo);
    if (fiado > 0 && !cliente) falha('Venda no fiado precisa de um cliente.');
  }
  if (cliente && fiado > 0 && cliente.limite != null && Math.max(0, saldoFiado(estado, cliente.id) + fiado) > cliente.limite) {
    falha(`Passa do limite de fiado de ${cliente.nome}.`);
  }

  const numero = estado.seq.venda + 1;
  const quando = agora.toISOString();
  const venda: Venda = { id: novoId(), numero, sessaoId: sessao.id, quando, itens, subtotal, desconto, total, pagamentos, troco, clienteId: cliente?.id ?? null, status: 'concluida', canceladaEm: null, motivoCancelamento: '' };

  let novo: Estado = { ...estado, vendas: [...estado.vendas, venda], seq: { ...estado.seq, venda: numero } };
  for (const i of itens) novo = baixarVendido(novo, i.produtoId, i.quantidade, quando, `Venda nº ${numero}`, venda.id);
  if (cliente && fiado > 0) {
    const l: LancamentoFiado = { id: novoId(), clienteId: cliente.id, quando, tipo: 'compra', valor: fiado, vendaId: venda.id, obs: `Venda nº ${numero}` };
    novo = { ...novo, fiado: [...novo.fiado, l] };
  }
  const daCozinha = itens.filter((i) => exigirProduto(novo, i.produtoId).preparoNaCozinha);
  if (daCozinha.length > 0) {
    novo = criarPedido(novo, {
      origem: 'caixa',
      vendaId: venda.id,
      identificacao: (nv.identificacao ?? '').trim() || cliente?.nome || `Venda ${numero}`,
      itens: daCozinha.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
      obs: '',
      paraQuando: null,
    }, agora);
  }
  return { estado: novo, venda };
}

/** Só cancela venda do caixa que ainda está aberto. Devolve estoque e estorna o fiado. */
export function cancelarVenda(estado: Estado, vendaId: string, motivo: string, agora: Date): Estado {
  const v = estado.vendas.find((x) => x.id === vendaId) ?? falha('Venda não encontrada.');
  if (v.status === 'cancelada') falha('Essa venda já está cancelada.');
  const s = caixaAberto(estado);
  if (!s || s.id !== v.sessaoId) falha('Só dá para cancelar venda do caixa que está aberto.');
  const m = exigirTexto(motivo, 'o motivo', 120);
  const quando = agora.toISOString();
  let novo: Estado = { ...estado, vendas: estado.vendas.map((x) => (x.id === vendaId ? { ...x, status: 'cancelada', canceladaEm: quando, motivoCancelamento: m } : x)) };
  novo = devolverVenda(novo, v.id, quando, `Venda nº ${v.numero} cancelada`);
  const fiado = estado.fiado.filter((l) => l.vendaId === vendaId && l.tipo === 'compra').reduce((x, l) => x + l.valor, 0);
  if (fiado > 0 && v.clienteId) {
    novo = { ...novo, fiado: [...novo.fiado, { id: novoId(), clienteId: v.clienteId, quando, tipo: 'estorno', valor: fiado, vendaId, obs: `Venda nº ${v.numero} cancelada` }] };
  }
  novo = { ...novo, pedidos: novo.pedidos.map((p) => (p.vendaId === vendaId && p.status !== 'entregue' ? { ...p, status: 'cancelado', atualizadoEm: quando } : p)) };
  return novo;
}

// ---------- Fiado ----------

export function salvarCliente(estado: Estado, c: Cliente): Estado {
  const nome = exigirTexto(c.nome, 'o nome', 60);
  const telefone = c.telefone.replace(/\D/g, '');
  if (telefone && (telefone.length < 10 || telefone.length > 13)) falha('Telefone com DDD: de 10 a 13 números.');
  if (c.limite != null) exigirCentavos(c.limite);
  const limpo = { ...c, nome, telefone };
  const existe = estado.clientes.some((x) => x.id === c.id);
  return { ...estado, clientes: existe ? estado.clientes.map((x) => (x.id === c.id ? limpo : x)) : [...estado.clientes, limpo] };
}

export function removerCliente(estado: Estado, id: string): Estado {
  if (saldoFiado(estado, id) !== 0) falha('Cliente ainda tem saldo no fiado.');
  const usado = estado.fiado.some((l) => l.clienteId === id) || estado.vendas.some((v) => v.clienteId === id);
  if (usado) return { ...estado, clientes: estado.clientes.map((c) => (c.id === id ? { ...c, ativo: false } : c)) };
  return { ...estado, clientes: estado.clientes.filter((c) => c.id !== id) };
}

/** Cliente paga o fiado no caixa. O dinheiro entra na sessão aberta. */
/** Soma do que os clientes devem (créditos a favor não abatem a dívida de outros). */
export function totalFiado(estado: Estado): number {
  return estado.clientes.reduce((s, c) => s + Math.max(0, saldoFiado(estado, c.id)), 0);
}

export function receberFiado(estado: Estado, clienteId: string, valor: number, forma: FormaPagamento, agora: Date): Estado {
  const s = exigirCaixa(estado);
  const c = estado.clientes.find((x) => x.id === clienteId) ?? falha('Cliente não encontrado.');
  exigirCentavos(valor, false);
  if (forma === 'fiado') falha('Escolha como o cliente pagou.');
  const saldo = saldoFiado(estado, clienteId);
  if (valor > saldo) falha(`${c.nome} deve só ${(saldo / 100).toFixed(2).replace('.', ',')}.`);
  const quando = agora.toISOString();
  const novo = comMovCaixa(estado, s, { id: novoId(), quando, tipo: 'recebimento', valor, forma, obs: `Fiado: ${c.nome}` });
  return { ...novo, fiado: [...novo.fiado, { id: novoId(), clienteId, quando, tipo: 'pagamento', valor, vendaId: null, obs: forma }] };
}

// ---------- Pedidos (cozinha / encomendas) ----------

export function criarPedido(estado: Estado, p: Omit<Pedido, 'id' | 'numero' | 'status' | 'criadoEm' | 'atualizadoEm'>, agora: Date): Estado {
  if (p.itens.length === 0) falha('O pedido está vazio.');
  for (const i of p.itens) {
    exigirTexto(i.nome, 'o item', 80);
    if (!(i.quantidade > 0)) falha('Quantidade inválida no pedido.');
  }
  const numero = estado.seq.pedido + 1;
  const quando = agora.toISOString();
  const pedido: Pedido = { ...p, identificacao: p.identificacao.trim().slice(0, 40), obs: p.obs.trim().slice(0, 200), id: novoId(), numero, status: 'novo', criadoEm: quando, atualizadoEm: quando };
  return { ...estado, pedidos: [...estado.pedidos, pedido], seq: { ...estado.seq, pedido: numero } };
}

const PROXIMO: Partial<Record<StatusPedido, StatusPedido>> = { novo: 'preparando', preparando: 'pronto', pronto: 'entregue' };

export function avancarPedido(estado: Estado, id: string, agora: Date): Estado {
  const p = estado.pedidos.find((x) => x.id === id) ?? falha('Pedido não encontrado.');
  const prox = PROXIMO[p.status] ?? falha('Esse pedido já foi encerrado.');
  return { ...estado, pedidos: estado.pedidos.map((x) => (x.id === id ? { ...x, status: prox, atualizadoEm: agora.toISOString() } : x)) };
}

export function voltarPedido(estado: Estado, id: string, agora: Date): Estado {
  const p = estado.pedidos.find((x) => x.id === id) ?? falha('Pedido não encontrado.');
  const anterior = (Object.entries(PROXIMO).find(([, v]) => v === p.status)?.[0] as StatusPedido | undefined) ?? falha('Não dá para voltar esse pedido.');
  return { ...estado, pedidos: estado.pedidos.map((x) => (x.id === id ? { ...x, status: anterior, atualizadoEm: agora.toISOString() } : x)) };
}

export function cancelarPedido(estado: Estado, id: string, agora: Date): Estado {
  const p = estado.pedidos.find((x) => x.id === id) ?? falha('Pedido não encontrado.');
  if (p.status === 'entregue' || p.status === 'cancelado') falha('Esse pedido já foi encerrado.');
  return { ...estado, pedidos: estado.pedidos.map((x) => (x.id === id ? { ...x, status: 'cancelado', atualizadoEm: agora.toISOString() } : x)) };
}
