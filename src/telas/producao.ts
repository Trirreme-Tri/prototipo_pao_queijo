// Produção: fornadas rápidas (celular), ordens de produção e fichas técnicas.

import { aplicarNoModal, type Ctx } from '../app';
import { cancelarOrdem, concluirOrdem, criarOrdem, custoUnitario, exigirProduto, fichaDe, iniciarOrdem, margem, necessidadeDaOrdem, produtoPorId, registrarFornada, salvarFicha } from '../dominio/catalogo';
import type { ItemFicha, OrdemProducao, Produto } from '../dominio/tipos';
import { chaveDoDia, dataHora, diaDoIso, formatarQuantidade, horaCurta } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el, toqueUnico } from '../ui/base';
import { abas, aviso, botao, botaoIcone, cabecalhoPagina, campoQuantidade, campoSelecao, cartao, etiqueta, tabela, vazio } from '../ui/componentes';
import { abrirModal, confirmar, erroNoModal } from '../ui/modal';

const fabricados = (ctx: Ctx) => ctx.estado.produtos.filter((p) => p.ativo && p.tipo === 'fabricado');

function janelaNovaOrdem(ctx: Ctx, produtoId?: string): void {
  const lista = fabricados(ctx).filter((p) => p.controlaEstoque);
  if (lista.length === 0) return void abrirModal('Sem produtos', [el('p', {}, 'Cadastre um produto fabricado (com estoque) em Produtos.')]);
  let escolhido = produtoId ?? lista[0].id;
  const m = abrirModal('Nova ordem de produção', [], []);
  const desenhar = () => {
    const p = exigirProduto(ctx.estado, escolhido);
    const ficha = fichaDe(ctx.estado, p.id);
    const prod = campoSelecao('Produto', escolhido, lista.map((x) => ({ valor: x.id, texto: x.nome })), { aoMudar: (v) => { escolhido = v; desenhar(); } });
    const qtd = campoQuantidade('Quantidade', ficha?.rendimento ?? 1, p.unidade, { ajuda: ficha ? `Uma receita rende ${formatarQuantidade(ficha.rendimento, p.unidade)}.` : 'Sem ficha técnica: os ingredientes não saem do estoque.' });
    const necessidade = el('div', {});
    const atualizar = () => {
      const q = qtd.ler();
      const nec = q ? necessidadeDaOrdem(ctx.estado, p.id, q) : [];
      necessidade.replaceChildren(nec.length
        ? tabela([
          { titulo: 'Ingrediente', valor: (l) => l.insumo.nome },
          { titulo: 'Precisa', valor: (l) => formatarQuantidade(l.precisa, l.insumo.unidade), classe: 'num' },
          { titulo: 'Tem', valor: (l) => formatarQuantidade(l.insumo.estoque, l.insumo.unidade), classe: 'num' },
          { titulo: '', valor: (l) => (l.falta > 0 ? etiqueta(`falta ${formatarQuantidade(l.falta, l.insumo.unidade)}`, 'perigo') : etiqueta('ok', 'sucesso')) },
        ], nec)
        : el('span'));
    };
    qtd.input.addEventListener('input', atualizar);
    atualizar();
    m.trocar([el('div', { class: 'grade-2' }, prod.bloco, qtd.bloco), necessidade], [
      botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
      botao('Criar ordem', () => {
        const q = qtd.ler();
        if (q == null) return erroNoModal(m, 'Quantidade inválida.');
        aplicarNoModal(ctx, m, (e) => criarOrdem(e, p.id, q, ctx.agora()), 'Ordem criada');
      }),
    ]);
  };
  desenhar();
}

function janelaConcluir(ctx: Ctx, o: OrdemProducao): void {
  const p = exigirProduto(ctx.estado, o.produtoId);
  const qtd = campoQuantidade('Quanto saiu de verdade?', o.quantidade, p.unidade, { ajuda: 'Se rendeu mais ou menos, corrija aqui: os ingredientes saem na proporção.' });
  const ok = () => {
    const q = qtd.ler();
    if (q == null) return erroNoModal(m, 'Quantidade inválida.');
    aplicarNoModal(ctx, m, (e) => concluirOrdem(e, o.id, ctx.agora(), q), `${p.nome}: +${formatarQuantidade(q, p.unidade)} no estoque`);
  };
  qtd.input.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
  const m = abrirModal(`Concluir ordem nº ${o.numero}`, [el('p', {}, p.nome), qtd.bloco], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Concluir', ok, { variante: 'sucesso' })], { largura: 'p' });
}

export function janelaFicha(ctx: Ctx, p: Produto): void {
  const atual = fichaDe(ctx.estado, p.id);
  const itens: ItemFicha[] = atual ? atual.itens.map((i) => ({ ...i })) : [];
  const insumos = ctx.estado.produtos.filter((x) => x.ativo && x.tipo === 'insumo');
  if (insumos.length === 0) return void abrirModal('Sem insumos', [el('p', {}, 'Cadastre os ingredientes (tipo "Insumo") em Produtos primeiro.')]);
  let rendimento = atual?.rendimento ?? 1;
  const m = abrirModal(`Ficha técnica: ${p.nome}`, [], [], { largura: 'g' });
  const desenhar = () => {
    const rend = campoQuantidade('Uma receita rende', rendimento, p.unidade);
    rend.input.addEventListener('change', () => (rendimento = rend.ler() ?? rendimento));
    const ins = campoSelecao('Ingrediente', insumos.find((x) => !itens.some((i) => i.insumoId === x.id))?.id ?? insumos[0].id, insumos.map((x) => ({ valor: x.id, texto: `${x.nome} (${x.unidade})` })));
    const qtd = campoQuantidade('Quantidade', null, 'na unidade do insumo');
    const custoTotal = itens.reduce<number | null>((s, i) => { const x = produtoPorId(ctx.estado, i.insumoId); return s == null || x?.custo == null ? null : s + x.custo * i.quantidade; }, 0);
    m.trocar([
      rend.bloco,
      tabela([
        { titulo: 'Ingrediente', valor: (i) => produtoPorId(ctx.estado, i.insumoId)?.nome ?? '?' },
        { titulo: 'Quantidade', valor: (i) => formatarQuantidade(i.quantidade, produtoPorId(ctx.estado, i.insumoId)?.unidade ?? ''), classe: 'num' },
        { titulo: 'Custo', valor: (i) => { const x = produtoPorId(ctx.estado, i.insumoId); return x?.custo == null ? 'sem custo' : R(Math.round(x.custo * i.quantidade)); }, classe: 'num' },
        { titulo: '', valor: (i) => botaoIcone('lixo', 'Remover ingrediente', () => { itens.splice(itens.indexOf(i), 1); rendimento = rend.ler() ?? rendimento; desenhar(); }) },
      ], itens, { vazio: 'Nenhum ingrediente ainda.' }),
      el('p', { class: 'direita' }, custoTotal == null ? 'Algum ingrediente está sem custo.' : `Custo da receita: ${R(Math.round(custoTotal))} · por ${p.unidade}: ${R(Math.round(custoTotal / (rend.ler() || 1)))}`),
      el('div', { class: 'grade-3' }, ins.bloco, qtd.bloco, el('div', { class: 'campo alinhar-base' }, botao('Adicionar', () => {
        const q = qtd.ler();
        if (q == null || q <= 0) return erroNoModal(m, 'Digite a quantidade do ingrediente.');
        const existente = itens.find((i) => i.insumoId === ins.valor());
        if (existente) existente.quantidade = q;
        else itens.push({ insumoId: ins.valor(), quantidade: q });
        rendimento = rend.ler() ?? rendimento;
        desenhar();
      }, { variante: 'secundario', icone: 'mais' }))),
    ], [
      botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
      botao('Salvar ficha', () => {
        const r = rend.ler();
        if (r == null) return erroNoModal(m, 'Rendimento inválido.');
        aplicarNoModal(ctx, m, (e) => salvarFicha(e, p.id, r, itens), 'Ficha técnica salva');
      }),
    ]);
  };
  desenhar();
}

export function producao(ctx: Ctx): Node[] {
  const f = ctx.tela('producao', () => ({ aba: 'fornadas' as 'fornadas' | 'ordens' | 'fichas' }));
  const hoje = chaveDoDia(ctx.agora());
  const concluidasHoje = ctx.estado.ordens.filter((o) => o.status === 'concluida' && o.concluidaEm && diaDoIso(o.concluidaEm) === hoje).reverse();
  const abertas = ctx.estado.ordens.filter((o) => o.status === 'planejada' || o.status === 'produzindo');
  const nome = (id: string) => produtoPorId(ctx.estado, id)?.nome ?? '?';
  const uni = (id: string) => produtoPorId(ctx.estado, id)?.unidade ?? '';

  let conteudo: Node[];
  if (f.aba === 'fornadas') {
    const comFicha = fabricados(ctx).filter((p) => p.controlaEstoque);
    conteudo = [
      comFicha.length === 0 ? vazio('Nenhum produto fabricado com estoque.') : el('div', { class: 'fornadas' }, ...comFicha.map((p) => {
        const ficha = fichaDe(ctx.estado, p.id);
        const qtd = ficha?.rendimento ?? 1;
        const hojeQtd = concluidasHoje.filter((o) => o.produtoId === p.id).reduce((s, o) => s + o.quantidade, 0);
        return el('button', { type: 'button', class: 'fornada', 'data-testid': 'fornada-' + p.codigo, onclick: () => toqueUnico('fornada-' + p.id) && ctx.mudar((e) => registrarFornada(e, p.id, ctx.agora()), `Saiu fornada: ${p.nome} (+${formatarQuantidade(qtd, p.unidade)})`) },
          el('span', { class: 'fornada-nome' }, p.nome),
          el('span', { class: 'fornada-mais' }, `+${formatarQuantidade(qtd, p.unidade)}`),
          el('span', { class: 'ajuda' }, `Hoje: ${formatarQuantidade(hojeQtd, p.unidade)} · na vitrine: ${formatarQuantidade(p.estoque, p.unidade)}`));
      })),
      el('p', { class: 'ajuda' }, 'Cada toque registra uma receita (o rendimento da ficha técnica) e tira os ingredientes do estoque.'),
      cartao('Produzido hoje', tabela([
        { titulo: 'Hora', valor: (o) => horaCurta(o.concluidaEm!) },
        { titulo: 'Produto', valor: (o) => nome(o.produtoId) },
        { titulo: 'Quantidade', valor: (o) => formatarQuantidade(o.quantidade, uni(o.produtoId)), classe: 'num' },
      ], concluidasHoje, { vazio: 'Nada produzido hoje ainda.' })),
    ];
  } else if (f.aba === 'ordens') {
    conteudo = [
      cartao('Ordens abertas', tabela([
        { titulo: 'Nº', valor: (o) => String(o.numero) },
        { titulo: 'Produto', valor: (o) => nome(o.produtoId) },
        { titulo: 'Quantidade', valor: (o) => formatarQuantidade(o.quantidade, uni(o.produtoId)), classe: 'num' },
        { titulo: 'Criada', valor: (o) => dataHora(o.criadaEm) },
        { titulo: 'Situação', valor: (o) => etiqueta(o.status === 'planejada' ? 'planejada' : 'produzindo', o.status === 'planejada' ? 'neutro' : 'info') },
        { titulo: '', valor: (o) => el('div', { class: 'acoes-linha' },
          o.status === 'planejada' ? botao('Começar', () => ctx.mudar((e) => iniciarOrdem(e, o.id)), { variante: 'secundario' }) : null,
          botao('Concluir', () => janelaConcluir(ctx, o), { variante: 'sucesso' }),
          botaoIcone('lixo', 'Cancelar ordem', () => confirmar('Cancelar ordem?', `Ordem nº ${o.numero}: nada sai do estoque.`, 'Cancelar ordem', () => ctx.mudar((e) => cancelarOrdem(e, o.id), 'Ordem cancelada'), true))) },
      ], abertas, { vazio: 'Nenhuma ordem aberta.' })),
      cartao('Concluídas hoje', tabela([
        { titulo: 'Nº', valor: (o) => String(o.numero) },
        { titulo: 'Produto', valor: (o) => nome(o.produtoId) },
        { titulo: 'Quantidade', valor: (o) => formatarQuantidade(o.quantidade, uni(o.produtoId)), classe: 'num' },
        { titulo: 'Hora', valor: (o) => horaCurta(o.concluidaEm!) },
      ], concluidasHoje, { vazio: 'Nada concluído hoje.' })),
    ];
  } else {
    conteudo = [
      aviso('A ficha técnica diz quanto de cada ingrediente vai numa receita e quanto ela rende. Com ela o sistema calcula o custo e tira os ingredientes do estoque na produção (ou na venda, para itens feitos na hora).'),
      cartao(null, tabela([
        { titulo: 'Produto', valor: (p) => p.nome },
        { titulo: 'Rende', valor: (p) => { const fi = fichaDe(ctx.estado, p.id); return fi ? formatarQuantidade(fi.rendimento, p.unidade) : etiqueta('sem ficha', 'alerta'); } },
        { titulo: 'Custo/un.', valor: (p) => { const c = custoUnitario(ctx.estado, p); return c == null ? '—' : R(c); }, classe: 'num' },
        { titulo: 'Preço', valor: (p) => (p.preco == null ? '—' : R(p.preco)), classe: 'num' },
        { titulo: 'Margem', valor: (p) => { const mg = margem(ctx.estado, p); return mg == null ? '—' : etiqueta(Math.round(mg * 100) + '%', mg < 0.3 ? 'perigo' : mg < 0.5 ? 'alerta' : 'sucesso'); }, classe: 'num' },
        { titulo: '', valor: (p) => botao(fichaDe(ctx.estado, p.id) ? 'Editar' : 'Criar ficha', () => janelaFicha(ctx, p), { variante: 'secundario', icone: 'editar' }) },
      ], fabricados(ctx), { vazio: 'Nenhum produto fabricado.' })),
    ];
  }

  return [
    cabecalhoPagina('Produção', `${concluidasHoje.length} produções hoje · ${abertas.length} ordens abertas`, botao('Nova ordem', () => janelaNovaOrdem(ctx), { icone: 'mais' })),
    abas(f.aba, [{ valor: 'fornadas', texto: 'Fornadas' }, { valor: 'ordens', texto: 'Ordens', contador: abertas.length }, { valor: 'fichas', texto: 'Fichas técnicas' }], (v) => { f.aba = v; ctx.redesenhar(); }),
    ...conteudo,
  ];
}
