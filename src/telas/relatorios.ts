// Relatórios: vendas, produtos, formas de pagamento, produção e perdas.

import type { Ctx } from '../app';
import { perdasNoPeriodo, producaoNoPeriodo, relatorioVendas } from '../dominio/financeiro';
import { FORMAS_PAGAMENTO, NOME_FORMA } from '../dominio/tipos';
import { chaveDoDia, dataCurta, formatarQuantidade, somarDias } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { aviso, barras, botao, cabecalhoPagina, campoData, cartao, colunas, kpi, tabela } from '../ui/componentes';

type Periodo = 'hoje' | '7d' | 'mes' | 'livre';

export function relatorios(ctx: Ctx): Node[] {
  const hoje = chaveDoDia(ctx.agora());
  const f = ctx.tela('relatorios', () => ({ periodo: '7d' as Periodo, de: somarDias(hoje, -6), ate: hoje }));
  const definir = (p: Periodo) => {
    f.periodo = p;
    if (p === 'hoje') [f.de, f.ate] = [hoje, hoje];
    if (p === '7d') [f.de, f.ate] = [somarDias(hoje, -6), hoje];
    if (p === 'mes') [f.de, f.ate] = [hoje.slice(0, 8) + '01', hoje];
    ctx.redesenhar();
  };
  const r = relatorioVendas(ctx.estado, f.de, f.ate);
  const producao = producaoNoPeriodo(ctx.estado, f.de, f.ate);
  const perdas = perdasNoPeriodo(ctx.estado, f.de, f.ate);
  const unidade = (id: string) => ctx.estado.produtos.find((p) => p.id === id)?.unidade ?? '';

  return [
    cabecalhoPagina('Relatórios', `${dataCurta(f.de)} a ${dataCurta(f.ate)}`, botao('Imprimir', () => window.print(), { variante: 'secundario', icone: 'imprimir' })),
    el('div', { class: 'filtros' },
      el('div', { class: 'chips' }, ...([['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Este mês'], ['livre', 'Escolher datas']] as [Periodo, string][]).map(([v, t]) =>
        el('button', { type: 'button', class: 'chip', 'aria-pressed': f.periodo === v ? 'true' : 'false', onclick: () => definir(v) }, t))),
      f.periodo === 'livre' ? campoData('De', f.de, { aoMudar: (v) => { f.de = v || hoje; ctx.redesenhar(); } }).bloco : null,
      f.periodo === 'livre' ? campoData('Até', f.ate, { aoMudar: (v) => { f.ate = v || hoje; ctx.redesenhar(); } }).bloco : null),
    el('div', { class: 'kpis' },
      kpi('Faturamento', R(r.total)),
      kpi('Vendas', String(r.quantidade)),
      kpi('Ticket médio', R(r.ticketMedio)),
      kpi('Descontos dados', R(r.descontos)),
      kpi('Lucro bruto estimado', r.lucroBrutoEstimado == null ? '—' : R(r.lucroBrutoEstimado), r.lucroBrutoEstimado == null ? 'falta custo em algum produto' : 'venda − custo dos produtos', r.lucroBrutoEstimado == null ? 'alerta' : 'sucesso')),
    el('div', { class: 'grade-painel' },
      cartao('Vendas por dia', colunas(r.porDia.map((d) => ({ rotulo: dataCurta(d.dia).slice(0, 5), valor: d.total, texto: R(d.total) })))),
      cartao('Formas de pagamento', barras(FORMAS_PAGAMENTO.map((fp) => ({ rotulo: NOME_FORMA[fp], valor: r.porForma[fp], texto: R(r.porForma[fp]) })))),
      cartao('Movimento por hora', colunas(r.porHora.map((v, i) => ({ rotulo: String(i), valor: v, texto: R(v) })).slice(5, 22)))),
    cartao('Produtos mais vendidos', tabela([
      { titulo: '#', valor: (l) => String(r.porProduto.indexOf(l) + 1) },
      { titulo: 'Produto', valor: (l) => l.nome },
      { titulo: 'Quantidade', valor: (l) => formatarQuantidade(l.quantidade, unidade(l.produtoId)), classe: 'num' },
      { titulo: 'Faturamento', valor: (l) => R(l.valor), classe: 'num' },
      { titulo: '% do total', valor: (l) => (r.total ? ((l.valor / r.total) * 100).toFixed(1).replace('.', ',') + '%' : '—'), classe: 'num' },
      { titulo: 'Lucro estimado', valor: (l) => (l.custo == null ? '—' : R(l.valor - l.custo)), classe: 'num' },
    ], r.porProduto, { vazio: 'Nenhuma venda no período.' })),
    el('div', { class: 'grade-2' },
      cartao('Produção', tabela([
        { titulo: 'Produto', valor: (l) => l.nome },
        { titulo: 'Produzido', valor: (l) => formatarQuantidade(l.quantidade, unidade(l.produtoId)), classe: 'num' },
        { titulo: 'Fornadas/ordens', valor: (l) => String(l.ordens), classe: 'num' },
      ], producao, { vazio: 'Nada produzido no período.' })),
      cartao('Perdas', tabela([
        { titulo: 'Produto', valor: (l) => l.nome },
        { titulo: 'Quantidade', valor: (l) => formatarQuantidade(l.quantidade, unidade(l.produtoId)), classe: 'num' },
        { titulo: 'Custo perdido', valor: (l) => (l.valor == null ? '—' : R(l.valor)), classe: 'num' },
      ], perdas, { vazio: 'Nenhuma perda registrada no período.' }))),
    aviso('Lucro estimado usa o custo de hoje dos produtos (não o da data da venda). É uma referência, não contabilidade.'),
  ];
}
