// Confere a forma dos dados lidos do navegador ou de arquivo importado.
// Dados salvos são tratados como não confiáveis: qualquer coisa fora do formato é recusada.

import type { Estado } from './tipos';
import { FORMAS_PAGAMENTO, TIPOS_PRODUTO, UNIDADES, VERSAO } from './tipos';

type Obj = Record<string, unknown>;

function erro(onde: string): never {
  throw new Error('Dados inválidos: ' + onde);
}

const obj = (v: unknown, onde: string): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : erro(onde));
const lista = (v: unknown, onde: string): unknown[] => (Array.isArray(v) ? v : erro(onde));
const texto = (v: unknown, onde: string, max = 500) => (typeof v === 'string' && v.length <= max ? v : erro(onde));
const textoOuNulo = (v: unknown, onde: string) => (v === null ? null : texto(v, onde));
const num = (v: unknown, onde: string) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9 ? v : erro(onde));
const centavos = (v: unknown, onde: string) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1e9 ? (v as number) : erro(onde));
const centavosOuNulo = (v: unknown, onde: string) => (v === null ? null : centavos(v, onde));
const bool = (v: unknown, onde: string) => (typeof v === 'boolean' ? v : erro(onde));
const um = <T,>(v: unknown, opcoes: readonly T[], onde: string): T => (opcoes.includes(v as T) ? (v as T) : erro(onde));
const dia = (v: unknown, onde: string) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : erro(onde));
/** Data e hora ISO que o navegador consegue ler. */
const iso = (v: unknown, onde: string) => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : erro(onde));
const isoOuNulo = (v: unknown, onde: string) => (v === null ? null : iso(v, onde));
const positivo = (v: unknown, onde: string) => (num(v, onde) > 0 ? (v as number) : erro(onde));
/** Id único dentro da coleção. */
const unico = (vistos: Set<string>, v: unknown, onde: string) => {
  const id = texto(v, onde, 60);
  if (vistos.has(id)) erro(onde + ' repetido');
  vistos.add(id);
  return id;
};

export function validarEstado(v: unknown): Estado {
  const e = obj(v, 'formato');
  if (e.versao !== VERSAO) erro('versão');

  const c = obj(e.config, 'configuração');
  texto(c.nomeLoja, 'nome da loja', 80);
  texto(c.whatsapp, 'whatsapp', 20);
  texto(c.endereco, 'endereço', 200);
  lista(c.categorias, 'categorias').forEach((x) => texto(x, 'categoria', 40));
  lista(c.categoriasConta, 'categorias de conta').forEach((x) => texto(x, 'categoria de conta', 40));
  bool(c.demonstracao, 'demonstração');

  const ids = new Set<string>();
  for (const x of lista(e.produtos, 'produtos')) {
    const p = obj(x, 'produto');
    unico(ids, p.id, 'produto');
    texto(p.codigo, 'código', 20);
    texto(p.nome, 'nome do produto', 80);
    texto(p.categoria, 'categoria', 40);
    um(p.tipo, TIPOS_PRODUTO, 'tipo do produto');
    um(p.unidade, UNIDADES, 'unidade');
    centavosOuNulo(p.preco, 'preço');
    centavosOuNulo(p.custo, 'custo');
    num(p.estoque, 'estoque');
    num(p.estoqueMinimo, 'estoque mínimo');
    for (const k of ['noCardapio', 'preparoNaCozinha', 'controlaEstoque', 'ativo']) bool(p[k], k);
  }
  const ref = (id: unknown, onde: string) => (typeof id === 'string' && ids.has(id) ? id : erro(onde));

  for (const x of lista(e.fichas, 'fichas')) {
    const f = obj(x, 'ficha');
    ref(f.produtoId, 'ficha');
    positivo(f.rendimento, 'rendimento');
    for (const y of lista(f.itens, 'ingredientes')) {
      const i = obj(y, 'ingrediente');
      ref(i.insumoId, 'ingrediente');
      positivo(i.quantidade, 'quantidade do ingrediente');
    }
  }
  for (const x of lista(e.movimentos, 'movimentos')) {
    const m = obj(x, 'movimento');
    texto(m.id, 'movimento');
    iso(m.quando, 'data do movimento');
    ref(m.produtoId, 'movimento');
    um(m.tipo, ['entrada', 'venda', 'cancelamento', 'producao', 'consumo', 'perda', 'ajuste'], 'tipo de movimento');
    num(m.quantidade, 'quantidade');
    num(m.saldo, 'saldo');
    texto(m.obs, 'observação');
    texto(m.ref, 'referência', 60);
  }
  for (const x of lista(e.ordens, 'ordens')) {
    const o = obj(x, 'ordem');
    texto(o.id, 'ordem');
    num(o.numero, 'número da ordem');
    ref(o.produtoId, 'ordem');
    positivo(o.quantidade, 'quantidade da ordem');
    um(o.status, ['planejada', 'produzindo', 'concluida', 'cancelada'], 'situação da ordem');
    iso(o.criadaEm, 'data da ordem');
    isoOuNulo(o.concluidaEm, 'conclusão da ordem');
    texto(o.obs, 'observação');
  }
  const sessoes = new Set<string>();
  let abertas = 0;
  for (const x of lista(e.caixas, 'caixas')) {
    const s = obj(x, 'caixa');
    unico(sessoes, s.id, 'caixa');
    num(s.numero, 'número do caixa');
    texto(s.operador, 'operador', 40);
    iso(s.abertaEm, 'abertura');
    if (isoOuNulo(s.fechadaEm, 'fechamento') === null) abertas += 1;
    centavos(s.valorInicial, 'troco inicial');
    centavosOuNulo(s.contado, 'valor contado');
    for (const y of lista(s.movimentos, 'movimentos do caixa')) {
      const m = obj(y, 'movimento do caixa');
      texto(m.id, 'movimento do caixa');
      iso(m.quando, 'data');
      um(m.tipo, ['sangria', 'suprimento', 'recebimento'], 'tipo de movimento do caixa');
      centavos(m.valor, 'valor');
      if (m.forma !== null) um(m.forma, FORMAS_PAGAMENTO, 'forma');
      texto(m.obs, 'observação');
    }
  }
  if (abertas > 1) erro('mais de um caixa aberto');
  const clientes = new Set<string>();
  for (const x of lista(e.clientes, 'clientes')) {
    const cl = obj(x, 'cliente');
    unico(clientes, cl.id, 'cliente');
    texto(cl.nome, 'nome do cliente', 60);
    texto(cl.telefone, 'telefone', 13);
    centavosOuNulo(cl.limite, 'limite');
    bool(cl.ativo, 'ativo');
  }
  for (const x of lista(e.vendas, 'vendas')) {
    const vd = obj(x, 'venda');
    texto(vd.id, 'venda');
    num(vd.numero, 'número da venda');
    if (!sessoes.has(texto(vd.sessaoId, 'caixa da venda'))) erro('caixa da venda');
    iso(vd.quando, 'data da venda');
    for (const y of lista(vd.itens, 'itens')) {
      const i = obj(y, 'item');
      ref(i.produtoId, 'produto da venda');
      texto(i.nome, 'nome do item', 80);
      centavos(i.precoUnit, 'preço do item');
      positivo(i.quantidade, 'quantidade do item');
    }
    for (const k of ['subtotal', 'desconto', 'total', 'troco']) centavos(vd[k], k);
    for (const y of lista(vd.pagamentos, 'pagamentos')) {
      const pg = obj(y, 'pagamento');
      um(pg.forma, FORMAS_PAGAMENTO, 'forma de pagamento');
      centavos(pg.valor, 'valor pago');
    }
    if (vd.clienteId !== null && !clientes.has(vd.clienteId as string)) erro('cliente da venda');
    um(vd.status, ['concluida', 'cancelada'], 'situação da venda');
    isoOuNulo(vd.canceladaEm, 'cancelamento');
    texto(vd.motivoCancelamento, 'motivo');
  }
  for (const x of lista(e.pedidos, 'pedidos')) {
    const p = obj(x, 'pedido');
    texto(p.id, 'pedido');
    num(p.numero, 'número do pedido');
    um(p.origem, ['caixa', 'balcao', 'encomenda'], 'origem do pedido');
    textoOuNulo(p.vendaId, 'venda do pedido');
    texto(p.identificacao, 'identificação', 40);
    for (const y of lista(p.itens, 'itens do pedido')) {
      const i = obj(y, 'item do pedido');
      texto(i.nome, 'item do pedido', 80);
      num(i.quantidade, 'quantidade');
    }
    texto(p.obs, 'observação', 200);
    um(p.status, ['novo', 'preparando', 'pronto', 'entregue', 'cancelado'], 'situação do pedido');
    iso(p.criadoEm, 'data do pedido');
    iso(p.atualizadoEm, 'data do pedido');
    isoOuNulo(p.paraQuando, 'data de retirada');
  }
  for (const x of lista(e.fiado, 'fiado')) {
    const l = obj(x, 'lançamento');
    texto(l.id, 'lançamento');
    if (!clientes.has(texto(l.clienteId, 'cliente do lançamento'))) erro('cliente do lançamento');
    iso(l.quando, 'data');
    um(l.tipo, ['compra', 'pagamento', 'estorno'], 'tipo de lançamento');
    centavos(l.valor, 'valor');
    textoOuNulo(l.vendaId, 'venda');
    texto(l.obs, 'observação');
  }
  for (const x of lista(e.contas, 'contas')) {
    const ct = obj(x, 'conta');
    texto(ct.id, 'conta');
    um(ct.tipo, ['pagar', 'receber'], 'tipo de conta');
    texto(ct.descricao, 'descrição', 80);
    texto(ct.categoria, 'categoria', 40);
    centavos(ct.valor, 'valor');
    dia(ct.vencimento, 'vencimento');
    isoOuNulo(ct.pagaEm, 'pagamento');
  }
  // A numeração não pode ficar para trás (geraria nº de venda repetido).
  const seq = obj(e.seq, 'numeração');
  const maior = (xs: unknown[]) => xs.reduce<number>((m, x) => Math.max(m, (x as { numero: number }).numero), 0);
  const pares: [string, unknown[]][] = [['venda', e.vendas as unknown[]], ['pedido', e.pedidos as unknown[]], ['ordem', e.ordens as unknown[]], ['caixa', e.caixas as unknown[]]];
  for (const [k, xs] of pares) if (num(seq[k], 'numeração') < maior(xs)) erro('numeração');
  return e as unknown as Estado;
}
