// Histórico de vendas e de caixas: consultar, reimprimir e cancelar.

import { aplicarNoModal, type Ctx } from '../app';
import { caixaAberto, cancelarVenda, resumoSessao } from '../dominio/caixa';
import type { Venda } from '../dominio/tipos';
import { NOME_FORMA } from '../dominio/tipos';
import { chaveDoDia, dataHora, diaDoIso, formatarQuantidade, horaCurta, valorItem } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { baixarArquivo, el, imprimir } from '../ui/base';
import { abas, botao, cabecalhoPagina, campoData, campoTexto, cartao, etiqueta, kpi, tabela } from '../ui/componentes';
import { abrirModal, erroNoModal } from '../ui/modal';
import { comprovante, relatorioFechamento } from './impressos';

function janelaVenda(ctx: Ctx, v: Venda): void {
  const cliente = v.clienteId ? ctx.estado.clientes.find((c) => c.id === v.clienteId) : null;
  const sessao = caixaAberto(ctx.estado);
  const podeCancelar = v.status === 'concluida' && sessao?.id === v.sessaoId;
  const m = abrirModal(`Venda nº ${v.numero}`, [
    el('p', {}, dataHora(v.quando), ' · ', v.status === 'cancelada' ? etiqueta('cancelada', 'perigo') : etiqueta('concluída', 'sucesso'), cliente ? ` · Cliente: ${cliente.nome}` : ''),
    v.status === 'cancelada' ? el('p', { class: 'ajuda' }, `Motivo: ${v.motivoCancelamento}`) : null,
    tabela([
      { titulo: 'Produto', valor: (i) => i.nome },
      { titulo: 'Qtd.', valor: (i) => formatarQuantidade(i.quantidade, ''), classe: 'num' },
      { titulo: 'Preço', valor: (i) => R(i.precoUnit), classe: 'num' },
      { titulo: 'Total', valor: (i) => R(valorItem(i.precoUnit, i.quantidade)), classe: 'num' },
    ], v.itens),
    el('p', { class: 'direita' }, v.desconto ? `Desconto ${R(v.desconto)} · ` : '', el('strong', {}, `Total ${R(v.total)}`)),
    el('p', { class: 'direita' }, v.pagamentos.map((p) => `${NOME_FORMA[p.forma]} ${R(p.valor)}`).join(' + '), v.troco ? ` · troco ${R(v.troco)}` : ''),
    !podeCancelar && v.status === 'concluida' ? el('p', { class: 'ajuda' }, 'Só dá para cancelar vendas do caixa que está aberto.') : null,
  ], [
    botao('Imprimir comprovante', () => imprimir(comprovante(ctx.estado, v)), { variante: 'secundario', icone: 'imprimir' }),
    podeCancelar ? botao('Cancelar venda', () => { m.fechar(); janelaCancelar(ctx, v); }, { variante: 'perigo' }) : null,
  ]);
}

function janelaCancelar(ctx: Ctx, v: Venda): void {
  const motivo = campoTexto('Motivo do cancelamento', '', { max: 120, placeholder: 'Ex.: lançado errado' });
  const ok = () => {
    if (!motivo.valor().trim()) return erroNoModal(m, 'Escreva o motivo.');
    aplicarNoModal(ctx, m, (e) => cancelarVenda(e, v.id, motivo.valor(), ctx.agora()), `Venda nº ${v.numero} cancelada. Estoque devolvido.`);
  };
  const m = abrirModal(`Cancelar venda nº ${v.numero}?`, [el('p', {}, `O estoque volta e o fiado é estornado. Se foi pago no cartão/Pix, devolva o dinheiro ao cliente pela maquininha/banco.`), motivo.bloco],
    [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Cancelar venda', ok, { variante: 'perigo' })], { largura: 'p' });
}

function csv(vendas: Venda[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const linhas = [['numero', 'data', 'hora', 'status', 'itens', 'subtotal', 'desconto', 'total', 'pagamentos'].join(';')];
  for (const v of vendas) {
    linhas.push([v.numero, diaDoIso(v.quando), horaCurta(v.quando), v.status, esc(v.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')),
      (v.subtotal / 100).toFixed(2).replace('.', ','), (v.desconto / 100).toFixed(2).replace('.', ','), (v.total / 100).toFixed(2).replace('.', ','),
      esc(v.pagamentos.map((p) => `${NOME_FORMA[p.forma]} ${(p.valor / 100).toFixed(2).replace('.', ',')}`).join(' + '))].join(';'));
  }
  return '﻿' + linhas.join('\r\n');
}

export function vendas(ctx: Ctx): Node[] {
  const hoje = chaveDoDia(ctx.agora());
  const f = ctx.tela('vendas', () => ({ aba: 'vendas' as 'vendas' | 'caixas', de: hoje, ate: hoje, status: 'todas' }));
  const lista = ctx.estado.vendas.filter((v) => {
    const d = diaDoIso(v.quando);
    return d >= f.de && d <= f.ate && (f.status === 'todas' || v.status === f.status);
  }).reverse();
  const concluidas = lista.filter((v) => v.status === 'concluida');
  const total = concluidas.reduce((s, v) => s + v.total, 0);

  const filtros = el('div', { class: 'filtros' },
    campoData('De', f.de, { aoMudar: (v) => { f.de = v || hoje; ctx.redesenhar(); } }).bloco,
    campoData('Até', f.ate, { aoMudar: (v) => { f.ate = v || hoje; ctx.redesenhar(); } }).bloco,
    el('div', { class: 'campo' }, el('label', { for: 'f-status' }, 'Situação'),
      el('select', { id: 'f-status', onchange: (e: Event) => { f.status = (e.target as HTMLSelectElement).value; ctx.redesenhar(); } },
        ...[['todas', 'Todas'], ['concluida', 'Concluídas'], ['cancelada', 'Canceladas']].map(([v, t]) => el('option', { value: v, selected: f.status === v }, t)))));

  return [
    cabecalhoPagina('Vendas', 'Consulte, reimprima ou cancele vendas.', botao('Baixar planilha (CSV)', () => baixarArquivo(`vendas-${f.de}-a-${f.ate}.csv`, csv(lista), 'text/csv;charset=utf-8'), { variante: 'secundario', icone: 'baixar' })),
    abas(f.aba, [{ valor: 'vendas', texto: 'Vendas' }, { valor: 'caixas', texto: 'Caixas' }], (v) => { f.aba = v; ctx.redesenhar(); }),
    ...(f.aba === 'vendas'
      ? [
        filtros,
        el('div', { class: 'kpis' }, kpi('Total no período', R(total)), kpi('Vendas', String(concluidas.length)), kpi('Ticket médio', R(concluidas.length ? Math.round(total / concluidas.length) : 0)), kpi('Canceladas', String(lista.length - concluidas.length))),
        cartao(null, tabela([
          { titulo: 'Nº', valor: (v) => String(v.numero) },
          { titulo: 'Quando', valor: (v) => dataHora(v.quando) },
          { titulo: 'Itens', valor: (v) => v.itens.map((i) => `${formatarQuantidade(i.quantidade, '')}× ${i.nome}`).join(', '), classe: 'truncar' },
          { titulo: 'Pagamento', valor: (v) => v.pagamentos.map((p) => NOME_FORMA[p.forma]).join(' + ') },
          { titulo: 'Situação', valor: (v) => (v.status === 'cancelada' ? etiqueta('cancelada', 'perigo') : etiqueta('ok', 'sucesso')) },
          { titulo: 'Total', valor: (v) => R(v.total), classe: 'num' },
        ], lista, { aoClicar: (v) => janelaVenda(ctx, v), rotuloLinha: (v) => `Venda ${v.numero}`, classeLinha: (v) => (v.status === 'cancelada' ? 'riscado' : ''), vazio: 'Nenhuma venda no período.' })),
      ]
      : [
        cartao(null, tabela([
          { titulo: 'Nº', valor: (s) => String(s.numero) },
          { titulo: 'Operador', valor: (s) => s.operador },
          { titulo: 'Abertura', valor: (s) => dataHora(s.abertaEm) },
          { titulo: 'Fechamento', valor: (s) => (s.fechadaEm ? dataHora(s.fechadaEm) : etiqueta('aberto', 'sucesso')) },
          { titulo: 'Vendido', valor: (s) => R(resumoSessao(ctx.estado, s).total), classe: 'num' },
          { titulo: 'Diferença', valor: (s) => { if (s.contado == null) return '—'; const d = s.contado - resumoSessao(ctx.estado, s).dinheiroEsperado; return d === 0 ? etiqueta('bateu', 'sucesso') : etiqueta((d > 0 ? 'sobrou ' : 'faltou ') + R(Math.abs(d)), 'alerta'); }, classe: 'num' },
        ], [...ctx.estado.caixas].reverse(), { aoClicar: (s) => { const m = abrirModal(`Caixa nº ${s.numero}`, [relatorioFechamento(ctx.estado, s)], [botao('Imprimir', () => imprimir(relatorioFechamento(ctx.estado, s)), { variante: 'secundario', icone: 'imprimir' }), botao('Fechar', () => m.fechar())], { largura: 'p' }); }, vazio: 'Nenhum caixa ainda.' })),
      ]),
  ];
}
