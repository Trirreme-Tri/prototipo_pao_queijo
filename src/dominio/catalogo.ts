// Produtos, estoque, fichas técnicas e produção. Funções puras: estado entra, estado novo sai.

import type { Estado, FichaTecnica, ItemFicha, Movimento, OrdemProducao, Produto, TipoMovimento } from './tipos';
import { exigirCentavos, exigirQuantidade, exigirTexto, falha, novoId, q3 } from './util';

export function produtoPorId(estado: Estado, id: string): Produto | undefined {
  return estado.produtos.find((p) => p.id === id);
}

export function exigirProduto(estado: Estado, id: string): Produto {
  return produtoPorId(estado, id) ?? falha('Produto não encontrado.');
}

/** Acha pelo código (exato, sem diferenciar maiúsculas) entre os ativos. */
export function produtoPorCodigo(estado: Estado, codigo: string): Produto | undefined {
  const c = codigo.trim().toLowerCase();
  if (!c) return undefined;
  return estado.produtos.find((p) => p.ativo && p.codigo.toLowerCase() === c);
}

export function vendaveis(estado: Estado): Produto[] {
  return estado.produtos.filter((p) => p.ativo && p.tipo !== 'insumo' && p.preco != null);
}

// ---------- Cadastro ----------

export function novoProduto(parcial: Partial<Produto> = {}): Produto {
  return {
    id: novoId(),
    codigo: '',
    nome: '',
    categoria: '',
    tipo: 'fabricado',
    unidade: 'un',
    preco: null,
    custo: null,
    estoque: 0,
    estoqueMinimo: 0,
    noCardapio: true,
    preparoNaCozinha: false,
    controlaEstoque: true,
    ativo: true,
    ...parcial,
  };
}

export function salvarProduto(estado: Estado, p: Produto): Estado {
  const nome = exigirTexto(p.nome, 'o nome');
  const codigo = p.codigo.trim();
  if (codigo.length > 20) falha('Código pode ter no máximo 20 letras.');
  if (codigo && /\s/.test(codigo)) falha('Código não pode ter espaço.');
  if (codigo && estado.produtos.some((o) => o.id !== p.id && o.ativo && o.codigo.toLowerCase() === codigo.toLowerCase())) {
    falha(`Já existe outro produto com o código ${codigo}.`);
  }
  const categoria = p.categoria.trim();
  if (p.tipo !== 'insumo' && !categoria) falha('Escolha a categoria.');
  if (p.preco != null) exigirCentavos(p.preco);
  if (p.custo != null) exigirCentavos(p.custo);
  exigirQuantidade(p.estoqueMinimo, p.unidade, true);
  const limpo: Produto = {
    ...p,
    nome,
    codigo,
    categoria: p.tipo === 'insumo' ? categoria || 'Insumos' : categoria,
    preco: p.tipo === 'insumo' ? null : p.preco,
    noCardapio: p.tipo === 'insumo' ? false : p.noCardapio,
    preparoNaCozinha: p.tipo === 'insumo' ? false : p.preparoNaCozinha,
    controlaEstoque: p.tipo === 'fabricado' ? p.controlaEstoque : true,
  };
  const existe = estado.produtos.find((o) => o.id === p.id);
  if (existe && existe.unidade !== p.unidade && existe.estoque !== 0) {
    falha('Para mudar a unidade, zere o estoque antes (ajuste de contagem).');
  }
  // Estoque só muda por movimento; o cadastro preserva o saldo atual.
  const final = existe ? { ...limpo, estoque: existe.estoque } : { ...limpo, estoque: 0 };
  return {
    ...estado,
    produtos: existe ? estado.produtos.map((o) => (o.id === p.id ? final : o)) : [...estado.produtos, final],
  };
}

/** Não apaga histórico: produto com movimento ou venda vira inativo. */
export function removerProduto(estado: Estado, id: string): Estado {
  const usado =
    estado.movimentos.some((m) => m.produtoId === id) ||
    estado.vendas.some((v) => v.itens.some((i) => i.produtoId === id)) ||
    estado.fichas.some((f) => f.itens.some((i) => i.insumoId === id)) ||
    estado.ordens.some((o) => o.produtoId === id);
  if (usado) return { ...estado, produtos: estado.produtos.map((p) => (p.id === id ? { ...p, ativo: false } : p)) };
  return {
    ...estado,
    produtos: estado.produtos.filter((p) => p.id !== id),
    fichas: estado.fichas.filter((f) => f.produtoId !== id),
  };
}

// ---------- Estoque ----------

/** Aplica um movimento e atualiza o saldo. Saldo pode ficar negativo (venda sem estoque lançado). */
export function movimentar(estado: Estado, produtoId: string, tipo: TipoMovimento, quantidade: number, quando: string, obs = '', ref = ''): Estado {
  const p = exigirProduto(estado, produtoId);
  const saldo = q3(p.estoque + quantidade);
  if (Math.abs(saldo) > 1_000_000) falha('Quantidade grande demais.');
  const mov: Movimento = { id: novoId(), quando, produtoId, tipo, quantidade: q3(quantidade), saldo, obs: obs.slice(0, 160), ref };
  return {
    ...estado,
    produtos: estado.produtos.map((o) => (o.id === produtoId ? { ...o, estoque: saldo } : o)),
    movimentos: [...estado.movimentos, mov],
  };
}

export interface EntradaMercadoria {
  produtoId: string;
  quantidade: number;
  /** Custo por unidade nesta compra (centavos). Atualiza o custo do produto. */
  custoUnit: number | null;
  obs: string;
  /** Lança conta a pagar com este vencimento (AAAA-MM-DD). */
  contaVencimento: string | null;
}

export function entradaEstoque(estado: Estado, e: EntradaMercadoria, agora: Date): Estado {
  const p = exigirProduto(estado, e.produtoId);
  if (p.tipo === 'fabricado') falha('Produto fabricado entra pelo registro de produção.');
  const q = exigirQuantidade(e.quantidade, p.unidade);
  if (e.custoUnit != null) exigirCentavos(e.custoUnit);
  let novo = movimentar(estado, p.id, 'entrada', q, agora.toISOString(), e.obs.trim().slice(0, 120));
  if (e.custoUnit != null) novo = { ...novo, produtos: novo.produtos.map((o) => (o.id === p.id ? { ...o, custo: e.custoUnit } : o)) };
  if (e.contaVencimento) {
    if (e.custoUnit == null) falha('Para lançar a conta a pagar, informe o custo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.contaVencimento)) falha('Data de vencimento inválida.');
    novo = {
      ...novo,
      contas: [
        ...novo.contas,
        { id: novoId(), tipo: 'pagar', descricao: `Compra: ${p.nome} (${q} ${p.unidade})`.slice(0, 80), categoria: 'Fornecedores', valor: exigirCentavos(Math.round(e.custoUnit * q)), vencimento: e.contaVencimento, pagaEm: null },
      ],
    };
  }
  return novo;
}

export function registrarPerda(estado: Estado, produtoId: string, quantidade: number, motivo: string, agora: Date): Estado {
  const p = exigirProduto(estado, produtoId);
  const q = exigirQuantidade(quantidade, p.unidade);
  return movimentar(estado, produtoId, 'perda', -q, agora.toISOString(), exigirTexto(motivo, 'o motivo', 120));
}

/** Contagem física: define o saldo real e registra a diferença. */
export function ajustarEstoque(estado: Estado, produtoId: string, contado: number, agora: Date, obs = 'Contagem'): Estado {
  const p = exigirProduto(estado, produtoId);
  const c = exigirQuantidade(contado, p.unidade, true);
  const dif = q3(c - p.estoque);
  if (dif === 0) return estado;
  return movimentar(estado, produtoId, 'ajuste', dif, agora.toISOString(), obs);
}

export function abaixoDoMinimo(estado: Estado): Produto[] {
  return estado.produtos.filter((p) => p.ativo && p.estoqueMinimo > 0 && p.estoque < p.estoqueMinimo);
}

export function valorEmEstoque(estado: Estado): number {
  return estado.produtos.reduce((s, p) => {
    const custo = custoUnitario(estado, p);
    return p.ativo && custo != null && p.estoque > 0 ? s + Math.round(custo * p.estoque) : s;
  }, 0);
}

// ---------- Ficha técnica ----------

export function fichaDe(estado: Estado, produtoId: string): FichaTecnica | undefined {
  return estado.fichas.find((f) => f.produtoId === produtoId);
}

export function salvarFicha(estado: Estado, produtoId: string, rendimento: number, itens: ItemFicha[]): Estado {
  const p = exigirProduto(estado, produtoId);
  if (p.tipo !== 'fabricado') falha('Ficha técnica é só para produto fabricado.');
  const r = exigirQuantidade(rendimento, p.unidade);
  if (itens.length === 0) falha('Adicione pelo menos um ingrediente.');
  const vistos = new Set<string>();
  const limpos = itens.map((i) => {
    const ins = exigirProduto(estado, i.insumoId);
    if (ins.tipo !== 'insumo') falha(`${ins.nome} não é insumo.`);
    if (vistos.has(ins.id)) falha(`${ins.nome} aparece duas vezes.`);
    vistos.add(ins.id);
    return { insumoId: ins.id, quantidade: exigirQuantidade(i.quantidade, ins.unidade) };
  });
  const ficha: FichaTecnica = { produtoId, rendimento: r, itens: limpos };
  return { ...estado, fichas: [...estado.fichas.filter((f) => f.produtoId !== produtoId), ficha] };
}

/** Custo de 1 unidade. Fabricado: soma da ficha ÷ rendimento. null se faltar custo de algum insumo. */
export function custoUnitario(estado: Estado, p: Produto): number | null {
  if (p.tipo !== 'fabricado') return p.custo;
  const f = fichaDe(estado, p.id);
  if (!f) return p.custo;
  let total = 0;
  for (const i of f.itens) {
    const ins = produtoPorId(estado, i.insumoId);
    if (!ins || ins.custo == null) return null;
    total += ins.custo * i.quantidade;
  }
  return Math.round(total / f.rendimento);
}

/** Margem sobre o preço (0 a 1). null sem preço ou custo. */
export function margem(estado: Estado, p: Produto): number | null {
  const c = custoUnitario(estado, p);
  if (p.preco == null || p.preco === 0 || c == null) return null;
  return (p.preco - c) / p.preco;
}

// ---------- Produção ----------

export function criarOrdem(estado: Estado, produtoId: string, quantidade: number, agora: Date, obs = ''): Estado {
  const p = exigirProduto(estado, produtoId);
  if (p.tipo !== 'fabricado') falha('Só produto fabricado entra em produção.');
  if (!p.controlaEstoque) falha(`${p.nome} é feito na hora: os ingredientes saem do estoque na venda.`);
  const q = exigirQuantidade(quantidade, p.unidade);
  const numero = estado.seq.ordem + 1;
  const ordem: OrdemProducao = { id: novoId(), numero, produtoId, quantidade: q, status: 'planejada', criadaEm: agora.toISOString(), concluidaEm: null, obs: obs.trim().slice(0, 120) };
  return { ...estado, ordens: [...estado.ordens, ordem], seq: { ...estado.seq, ordem: numero } };
}

export function iniciarOrdem(estado: Estado, id: string): Estado {
  const o = estado.ordens.find((x) => x.id === id) ?? falha('Ordem não encontrada.');
  if (o.status !== 'planejada') falha('Só ordem planejada pode começar.');
  return { ...estado, ordens: estado.ordens.map((x) => (x.id === id ? { ...x, status: 'produzindo' } : x)) };
}

export function cancelarOrdem(estado: Estado, id: string): Estado {
  const o = estado.ordens.find((x) => x.id === id) ?? falha('Ordem não encontrada.');
  if (o.status === 'concluida' || o.status === 'cancelada') falha('Essa ordem já foi encerrada.');
  return { ...estado, ordens: estado.ordens.map((x) => (x.id === id ? { ...x, status: 'cancelada' } : x)) };
}

/**
 * Conclui a ordem: dá entrada no produto e baixa os insumos da ficha, na proporção
 * do que foi produzido (quantidadeReal pode diferir do planejado).
 */
export function concluirOrdem(estado: Estado, id: string, agora: Date, quantidadeReal?: number): Estado {
  const o = estado.ordens.find((x) => x.id === id) ?? falha('Ordem não encontrada.');
  if (o.status === 'concluida' || o.status === 'cancelada') falha('Essa ordem já foi encerrada.');
  const p = exigirProduto(estado, o.produtoId);
  const q = exigirQuantidade(quantidadeReal ?? o.quantidade, p.unidade);
  const quando = agora.toISOString();
  const ref = `Ordem nº ${o.numero}`;
  let novo = movimentar(estado, p.id, 'producao', q, quando, ref, o.id);
  const ficha = fichaDe(estado, p.id);
  if (ficha) {
    const fator = q / ficha.rendimento;
    for (const i of ficha.itens) novo = movimentar(novo, i.insumoId, 'consumo', -q3(i.quantidade * fator), quando, ref + ' · ' + p.nome, o.id);
  }
  return { ...novo, ordens: novo.ordens.map((x) => (x.id === id ? { ...x, status: 'concluida', quantidade: q, concluidaEm: quando } : x)) };
}

/** Atalho do dia a dia: "saiu uma fornada" = ordem já concluída com o rendimento da ficha. */
export function registrarFornada(estado: Estado, produtoId: string, agora: Date): Estado {
  const p = exigirProduto(estado, produtoId);
  const ficha = fichaDe(estado, produtoId);
  const qtd = ficha ? ficha.rendimento : 1;
  const comOrdem = criarOrdem(estado, p.id, qtd, agora, 'Fornada');
  const ordem = comOrdem.ordens[comOrdem.ordens.length - 1];
  return concluirOrdem(comOrdem, ordem.id, agora);
}

/** Quanto de cada insumo a ordem vai consumir, e se tem no estoque. */
export function necessidadeDaOrdem(estado: Estado, produtoId: string, quantidade: number): { insumo: Produto; precisa: number; falta: number }[] {
  const ficha = fichaDe(estado, produtoId);
  if (!ficha) return [];
  const fator = quantidade / ficha.rendimento;
  return ficha.itens.flatMap((i) => {
    const insumo = produtoPorId(estado, i.insumoId);
    if (!insumo) return [];
    const precisa = q3(i.quantidade * fator);
    return [{ insumo, precisa, falta: q3(Math.max(0, precisa - Math.max(0, insumo.estoque))) }];
  });
}

/**
 * Baixa o estoque de uma quantidade vendida: produto com saldo próprio mexe no próprio saldo;
 * feito na hora mexe nos ingredientes da ficha. Os movimentos levam o id da venda (ref),
 * para o cancelamento desfazer exatamente o que saiu, mesmo que o cadastro mude depois.
 */
export function baixarVendido(estado: Estado, produtoId: string, quantidade: number, quando: string, obs: string, vendaId: string): Estado {
  const p = exigirProduto(estado, produtoId);
  if (p.controlaEstoque) return movimentar(estado, p.id, 'venda', -quantidade, quando, obs, vendaId);
  const ficha = fichaDe(estado, p.id);
  if (!ficha) return estado;
  let novo = estado;
  const fator = quantidade / ficha.rendimento;
  for (const i of ficha.itens) novo = movimentar(novo, i.insumoId, 'venda', -q3(i.quantidade * fator), quando, obs + ' · ' + p.nome, vendaId);
  return novo;
}

/** Devolve ao estoque tudo o que uma venda tirou (pelos movimentos dela). */
export function devolverVenda(estado: Estado, vendaId: string, quando: string, obs: string): Estado {
  let novo = estado;
  for (const m of estado.movimentos) {
    if (m.ref === vendaId && m.tipo === 'venda') novo = movimentar(novo, m.produtoId, 'cancelamento', -m.quantidade, quando, obs, vendaId);
  }
  return novo;
}
