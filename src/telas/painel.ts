// Painel: o dia da loja num relance.

import type { Ctx } from '../app';
import { resumoSessao } from '../dominio/caixa';
import { painel as numeros } from '../dominio/financeiro';
import { dataCurta, formatarQuantidade, horaCurta } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { aviso, botao, cabecalhoPagina, cartao, colunas, etiqueta, kpi, tabela, vazio } from '../ui/componentes';

export function painel(ctx: Ctx): Node[] {
  const agora = ctx.agora();
  const n = numeros(ctx.estado, agora);
  const h = agora.getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const caixa = n.caixa ? resumoSessao(ctx.estado, n.caixa) : null;
  const horas = n.porHoraHoje.map((v, i) => ({ rotulo: String(i), valor: v, texto: R(v) })).slice(5, 22);

  return [
    cabecalhoPagina(`${saudacao}!`, `${ctx.estado.config.nomeLoja} · ${dataCurta(n.hoje)}`,
      !ctx.celular ? botao(n.caixa ? 'Ir para o caixa' : 'Abrir caixa', () => ctx.ir('/caixa'), { icone: 'caixa' }) : null),
    el('div', { class: 'kpis' },
      kpi('Vendido hoje', R(n.vendasHoje), `${n.quantidadeHoje} vendas`),
      kpi('Ticket médio', R(n.ticketHoje)),
      kpi('Caixa', n.caixa ? 'Aberto' : 'Fechado', n.caixa ? `${n.caixa.operador} desde ${horaCurta(n.caixa.abertaEm)} · gaveta ${R(caixa!.dinheiroEsperado)}` : 'Abra para vender', n.caixa ? 'sucesso' : 'alerta'),
      kpi('Fiado a receber', R(n.fiadoTotal), null, n.fiadoTotal > 0 ? 'alerta' : '')),
    el('div', { class: 'grade-painel' },
      cartao('Vendas por hora (hoje)', n.quantidadeHoje ? colunas(horas) : vazio('Nenhuma venda hoje ainda.')),
      cartao('Mais vendidos hoje',
        tabela([
          { titulo: 'Produto', valor: (l) => l.nome },
          { titulo: 'Qtd.', valor: (l) => formatarQuantidade(l.quantidade, ''), classe: 'num' },
          { titulo: 'Valor', valor: (l) => R(l.valor), classe: 'num' },
        ], n.maisVendidosHoje, { vazio: 'Nenhuma venda hoje ainda.' })),
      cartao(el('span', {}, 'Cozinha ', n.pedidosAbertos.length ? etiqueta(String(n.pedidosAbertos.length), 'info') : null),
        n.pedidosAbertos.length
          ? el('ul', { class: 'lista-simples' }, ...n.pedidosAbertos.slice(0, 6).map((p) => el('li', {}, el('span', {}, `#${p.numero} ${p.identificacao}`), etiqueta(p.status === 'novo' ? 'novo' : p.status === 'preparando' ? 'preparando' : 'pronto', p.status === 'pronto' ? 'sucesso' : p.status === 'novo' ? 'alerta' : 'info'))))
          : vazio('Nenhum pedido aberto.'),
        botao('Abrir cozinha', () => ctx.ir('/cozinha'), { variante: 'secundario' })),
      cartao('Produção',
        el('p', {}, `${n.producoesHoje} produções concluídas hoje · ${n.ordensAbertas.length} ordens abertas`),
        botao('Registrar fornada', () => ctx.ir('/producao'), { variante: 'secundario', icone: 'producao' })),
      cartao(el('span', {}, 'Estoque baixo ', n.estoqueBaixo.length ? etiqueta(String(n.estoqueBaixo.length), 'perigo') : null),
        n.estoqueBaixo.length
          ? el('ul', { class: 'lista-simples' }, ...n.estoqueBaixo.slice(0, 6).map((p) => el('li', {}, el('span', {}, p.nome), el('span', { class: 'perigo-texto' }, `${formatarQuantidade(p.estoque, p.unidade)} (mín. ${formatarQuantidade(p.estoqueMinimo, p.unidade)})`))))
          : vazio('Tudo acima do mínimo.'),
        botao('Ver estoque', () => ctx.ir('/estoque'), { variante: 'secundario' })),
      cartao(el('span', {}, 'Contas vencendo ', n.contasVencendo.length ? etiqueta(String(n.contasVencendo.length), 'alerta') : null),
        n.contasVencendo.length
          ? el('ul', { class: 'lista-simples' }, ...n.contasVencendo.slice(0, 6).map((c) => el('li', {}, el('span', {}, `${c.tipo === 'pagar' ? 'Pagar' : 'Receber'}: ${c.descricao}`), el('span', { class: c.vencimento < n.hoje ? 'perigo-texto' : '' }, `${R(c.valor)} · ${dataCurta(c.vencimento)}`))))
          : vazio('Nada vencendo hoje.'),
        !ctx.celular ? botao('Ver financeiro', () => ctx.ir('/financeiro'), { variante: 'secundario' }) : null)),
    ctx.celular ? aviso('No celular: Cozinha, Produção, Estoque, Cardápio e Clientes. Caixa, Vendas, Produtos, Financeiro e Relatórios abrem no computador.') : null,
  ].filter(Boolean) as Node[];
}
