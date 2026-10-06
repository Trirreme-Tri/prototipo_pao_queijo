// Estoque: posição, entrada de mercadoria, perdas, contagem e extrato de movimentações.

import { aplicarNoModal, type Ctx } from '../app';
import { abaixoDoMinimo, ajustarEstoque, custoUnitario, entradaEstoque, exigirProduto, produtoPorId, registrarPerda, valorEmEstoque } from '../dominio/catalogo';
import type { Produto, TipoProduto } from '../dominio/tipos';
import { NOME_MOVIMENTO, NOME_TIPO } from '../dominio/tipos';
import { chaveDoDia, dataHora, formatarQuantidade, somarDias } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { abas, botao, busca, cabecalhoPagina, campoData, campoDinheiro, campoQuantidade, campoSelecao, campoTexto, caixaMarcar, cartao, etiqueta, kpi, tabela } from '../ui/componentes';
import { abrirModal, erroNoModal } from '../ui/modal';

type Acao = 'entrada' | 'perda' | 'contagem';

function janelaAcao(ctx: Ctx, acao: Acao, produtoInicial?: Produto): void {
  const candidatos = ctx.estado.produtos.filter((p) => p.ativo && (acao !== 'entrada' || p.tipo !== 'fabricado') && (p.controlaEstoque || p.tipo !== 'fabricado'));
  if (candidatos.length === 0) return;
  let id = produtoInicial && candidatos.includes(produtoInicial) ? produtoInicial.id : candidatos[0].id;
  const titulo = acao === 'entrada' ? 'Entrada de mercadoria' : acao === 'perda' ? 'Registrar perda' : 'Contagem (ajuste de estoque)';
  const m = abrirModal(titulo, [], [], { largura: acao === 'entrada' ? 'm' : 'p' });
  const desenhar = () => {
    const p = exigirProduto(ctx.estado, id);
    const prod = campoSelecao('Produto', id, candidatos.map((x) => ({ valor: x.id, texto: `${x.nome} (${formatarQuantidade(x.estoque, x.unidade)})` })), { aoMudar: (v) => { id = v; desenhar(); } });
    const qtd = campoQuantidade(acao === 'contagem' ? 'Quanto tem de verdade' : 'Quantidade', null, p.unidade, { ajuda: `No sistema: ${formatarQuantidade(p.estoque, p.unidade)}` });
    const custo = campoDinheiro(`Custo por ${p.unidade}`, p.custo, { ajuda: 'Atualiza o custo do produto.' });
    const obs = campoTexto(acao === 'perda' ? 'Motivo' : 'Observação', '', { max: 120, placeholder: acao === 'perda' ? 'Ex.: queimou, venceu, caiu' : acao === 'entrada' ? 'Ex.: fornecedor, nº da nota' : 'Contagem' });
    const gerarConta = caixaMarcar('Lançar conta a pagar', false, 'Cria a conta no Financeiro com o valor da compra.');
    const venc = campoData('Vencimento', somarDias(chaveDoDia(ctx.agora()), 7));
    const ok = () => {
      const q = qtd.ler();
      if (q == null) return erroNoModal(m, 'Quantidade inválida.');
      if (acao === 'entrada') {
        const c = custo.input.value.trim() ? custo.ler() : null;
        if (custo.input.value.trim() && c == null) return erroNoModal(m, 'Custo inválido.');
        aplicarNoModal(ctx, m, (e) => entradaEstoque(e, { produtoId: id, quantidade: q, custoUnit: c, obs: obs.valor(), contaVencimento: gerarConta.marcado() ? venc.valor() : null }, ctx.agora()), `Entrada de ${formatarQuantidade(q, p.unidade)} de ${p.nome}`);
      } else if (acao === 'perda') {
        aplicarNoModal(ctx, m, (e) => registrarPerda(e, id, q, obs.valor(), ctx.agora()), 'Perda registrada');
      } else {
        aplicarNoModal(ctx, m, (e) => ajustarEstoque(e, id, q, ctx.agora(), obs.valor() || 'Contagem'), 'Estoque ajustado');
      }
    };
    m.trocar([
      prod.bloco,
      acao === 'entrada' ? el('div', { class: 'grade-2' }, qtd.bloco, custo.bloco) : qtd.bloco,
      obs.bloco,
      acao === 'entrada' ? el('div', { class: 'grade-2' }, gerarConta.bloco, venc.bloco) : null,
    ].filter(Boolean) as Node[], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Registrar', ok, { variante: acao === 'perda' ? 'perigo' : 'primario' })]);
    qtd.input.focus();
  };
  desenhar();
}

export function estoque(ctx: Ctx): Node[] {
  const f = ctx.tela('estoque', () => ({ aba: 'posicao' as 'posicao' | 'movimentos', busca: '', tipo: 'todos' as TipoProduto | 'todos' | 'baixo', produto: '' }));
  const baixo = abaixoDoMinimo(ctx.estado);
  const termo = f.busca.trim().toLowerCase();
  const produtos = ctx.estado.produtos
    .filter((p) => p.ativo && (p.controlaEstoque || p.tipo !== 'fabricado'))
    .filter((p) => (f.tipo === 'todos' ? true : f.tipo === 'baixo' ? baixo.includes(p) : p.tipo === f.tipo))
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome));

  const filtroTipo = campoSelecao('Mostrar', f.tipo, [
    { valor: 'todos', texto: 'Tudo' }, { valor: 'baixo', texto: `Abaixo do mínimo (${baixo.length})` },
    { valor: 'insumo', texto: 'Insumos' }, { valor: 'fabricado', texto: 'Fabricados' }, { valor: 'revenda', texto: 'Revenda' },
  ], { aoMudar: (v) => { f.tipo = v; ctx.redesenhar(); } });

  const posicao = ctx.celular
    ? el('ul', { class: 'lista-cartoes' }, ...produtos.map((p) => el('li', { class: baixo.includes(p) ? 'baixo' : '' },
      el('div', {}, el('strong', {}, p.nome), el('span', { class: 'ajuda' }, `${NOME_TIPO[p.tipo]} · mín. ${formatarQuantidade(p.estoqueMinimo, p.unidade)}`)),
      el('strong', { class: 'saldo' }, formatarQuantidade(p.estoque, p.unidade)),
      el('div', { class: 'acoes-linha' },
        p.tipo !== 'fabricado' ? botao('Entrada', () => janelaAcao(ctx, 'entrada', p), { variante: 'secundario' }) : null,
        botao('Perda', () => janelaAcao(ctx, 'perda', p), { variante: 'secundario' }),
        botao('Contar', () => janelaAcao(ctx, 'contagem', p), { variante: 'secundario' })))))
    : tabela([
      { titulo: 'Código', valor: (p) => p.codigo },
      { titulo: 'Produto', valor: (p) => p.nome },
      { titulo: 'Tipo', valor: (p) => NOME_TIPO[p.tipo] },
      { titulo: 'Saldo', valor: (p) => el('strong', {}, formatarQuantidade(p.estoque, p.unidade)), classe: 'num' },
      { titulo: 'Mínimo', valor: (p) => formatarQuantidade(p.estoqueMinimo, p.unidade), classe: 'num' },
      { titulo: 'Custo/un.', valor: (p) => { const c = custoUnitario(ctx.estado, p); return c == null ? '—' : R(c); }, classe: 'num' },
      { titulo: 'Situação', valor: (p) => (p.estoque <= 0 ? etiqueta('zerado', 'perigo') : baixo.includes(p) ? etiqueta('baixo', 'alerta') : etiqueta('ok', 'sucesso')) },
      { titulo: '', valor: (p) => el('div', { class: 'acoes-linha' },
        p.tipo !== 'fabricado' ? botao('Entrada', () => janelaAcao(ctx, 'entrada', p), { variante: 'secundario' }) : null,
        botao('Perda', () => janelaAcao(ctx, 'perda', p), { variante: 'fantasma' }),
        botao('Contar', () => janelaAcao(ctx, 'contagem', p), { variante: 'fantasma' })) },
    ], produtos, { classeLinha: (p) => (baixo.includes(p) ? 'linha-alerta' : ''), vazio: 'Nenhum produto com esse filtro.' });

  const movs = ctx.estado.movimentos.filter((m) => !f.produto || m.produtoId === f.produto).slice(-300).reverse();
  const movimentos = [
    el('div', { class: 'filtros' }, campoSelecao('Produto', f.produto, [{ valor: '', texto: 'Todos' }, ...ctx.estado.produtos.filter((p) => p.controlaEstoque || p.tipo !== 'fabricado').map((p) => ({ valor: p.id, texto: p.nome }))], { aoMudar: (v) => { f.produto = v; ctx.redesenhar(); } }).bloco),
    cartao(null, tabela([
      { titulo: 'Quando', valor: (m) => dataHora(m.quando) },
      { titulo: 'Produto', valor: (m) => produtoPorId(ctx.estado, m.produtoId)?.nome ?? '?' },
      { titulo: 'Movimento', valor: (m) => NOME_MOVIMENTO[m.tipo] },
      { titulo: 'Qtd.', valor: (m) => el('span', { class: m.quantidade < 0 ? 'perigo-texto' : 'sucesso-texto' }, (m.quantidade > 0 ? '+' : '') + formatarQuantidade(m.quantidade, produtoPorId(ctx.estado, m.produtoId)?.unidade ?? '')), classe: 'num' },
      { titulo: 'Saldo', valor: (m) => formatarQuantidade(m.saldo, ''), classe: 'num' },
      { titulo: 'Obs.', valor: (m) => m.obs, classe: 'truncar' },
    ], movs, { vazio: 'Nenhuma movimentação.' })),
    el('p', { class: 'ajuda' }, 'Mostrando as últimas 300 movimentações.'),
  ];

  return [
    cabecalhoPagina('Estoque', null,
      botao('Entrada', () => janelaAcao(ctx, 'entrada'), { icone: 'baixar' }),
      botao('Perda', () => janelaAcao(ctx, 'perda'), { variante: 'secundario' }),
      botao('Contagem', () => janelaAcao(ctx, 'contagem'), { variante: 'secundario' })),
    el('div', { class: 'kpis' }, kpi('Abaixo do mínimo', String(baixo.length), baixo.slice(0, 3).map((p) => p.nome).join(', ') || 'nenhum', baixo.length ? 'perigo' : 'sucesso'), kpi('Valor em estoque (custo)', R(valorEmEstoque(ctx.estado)))),
    abas(f.aba, [{ valor: 'posicao', texto: 'Posição' }, { valor: 'movimentos', texto: 'Movimentações' }], (v) => { f.aba = v; ctx.redesenhar(); }),
    ...(f.aba === 'posicao'
      ? [el('div', { class: 'filtros' }, busca(f.busca, (v) => { f.busca = v; ctx.redesenhar(); }, { placeholder: 'Buscar produto', foco: 'estoque-busca' }), filtroTipo.bloco), ctx.celular ? posicao : cartao(null, posicao)]
      : movimentos),
  ];
}
