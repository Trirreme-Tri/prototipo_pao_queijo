// Cadastro de produtos: insumos, fabricados e revenda.

import { aplicarNoModal, type Ctx } from '../app';
import { custoUnitario, fichaDe, margem, novoProduto, removerProduto, salvarProduto } from '../dominio/catalogo';
import type { Produto, TipoProduto, Unidade } from '../dominio/tipos';
import { NOME_TIPO, TIPOS_PRODUTO, UNIDADES } from '../dominio/tipos';
import { formatarQuantidade } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { botao, busca, cabecalhoPagina, campoDinheiro, campoQuantidade, campoSelecao, campoTexto, caixaMarcar, cartao, etiqueta, tabela } from '../ui/componentes';
import { abrirModal, confirmar, erroNoModal } from '../ui/modal';
import { janelaFicha } from './producao';

const EXPLICA_TIPO: Record<TipoProduto, string> = {
  fabricado: 'Feito aqui (pão de queijo, salgado). Tem ficha técnica.',
  revenda: 'Comprado pronto e revendido (Toddynho, refrigerante).',
  insumo: 'Ingrediente. Não é vendido (polvilho, queijo).',
};

function janelaProduto(ctx: Ctx, original: Produto | null): void {
  const p: Produto = original ? { ...original } : novoProduto({ categoria: ctx.estado.config.categorias[0] ?? '' });
  const m = abrirModal(original ? `Editar: ${original.nome}` : 'Novo produto', [], [], { largura: 'g' });
  const desenhar = () => {
    const nome = campoTexto('Nome', p.nome, { max: 80 });
    const codigo = campoTexto('Código (ou código de barras)', p.codigo, { max: 20, ajuda: 'Digitado no caixa. Ex.: 101' });
    const tipo = campoSelecao<TipoProduto>('Tipo', p.tipo, TIPOS_PRODUTO.map((t) => ({ valor: t, texto: NOME_TIPO[t] })), { ajuda: EXPLICA_TIPO[p.tipo], aoMudar: (v) => { ler(); p.tipo = v; desenhar(); } });
    const categorias = [...new Set([...ctx.estado.config.categorias, p.categoria].filter(Boolean))];
    const categoria = campoSelecao('Categoria', p.categoria, [{ valor: '', texto: 'Escolha' }, ...categorias.map((c) => ({ valor: c, texto: c }))]);
    const unidade = campoSelecao<Unidade>('Vendido/medido em', p.unidade, UNIDADES.map((u) => ({ valor: u, texto: u === 'un' ? 'Unidade (un)' : u === 'kg' ? 'Quilo (kg)' : 'Litro (l)' })));
    const preco = campoDinheiro(`Preço de venda por ${p.unidade}`, p.preco);
    const custo = campoDinheiro(`Custo por ${p.unidade}`, p.custo, { ajuda: p.tipo === 'fabricado' ? 'Fabricado: o custo vem da ficha técnica.' : 'Última compra.' });
    const minimo = campoQuantidade('Estoque mínimo', p.estoqueMinimo, p.unidade, { ajuda: 'Abaixo disso, o sistema avisa.' });
    const noCardapio = caixaMarcar('Aparece no cardápio online/QR', p.noCardapio);
    const cozinha = caixaMarcar('Vai para a tela da cozinha', p.preparoNaCozinha, 'Ao vender, abre um pedido para preparar.');
    const controla = caixaMarcar('Tem estoque próprio (vitrine)', p.controlaEstoque, 'Desmarque para item feito na hora: na venda saem os ingredientes da ficha.');
    const ativo = caixaMarcar('Ativo', p.ativo, 'Inativo some do caixa e do cardápio, mas o histórico fica.');
    function ler() {
      p.nome = nome.valor();
      p.codigo = codigo.valor();
      p.categoria = categoria.valor();
      p.unidade = unidade.valor();
      p.noCardapio = noCardapio.marcado();
      p.preparoNaCozinha = cozinha.marcado();
      p.controlaEstoque = controla.marcado();
      p.ativo = ativo.marcado();
      // Guarda o que já foi digitado para não perder ao trocar o tipo.
      p.preco = preco.input.value.trim() ? preco.ler() ?? p.preco : null;
      p.custo = custo.input.value.trim() ? custo.ler() ?? p.custo : null;
      p.estoqueMinimo = minimo.ler() ?? p.estoqueMinimo;
    }
    const salvar = () => {
      ler();
      const vPreco = preco.input.value.trim() ? preco.ler() : null;
      const vCusto = custo.input.value.trim() ? custo.ler() : null;
      const vMin = minimo.input.value.trim() ? minimo.ler() : 0;
      if (preco.input.value.trim() && vPreco == null) return erroNoModal(m, 'Preço inválido. Ex.: 2,50');
      if (custo.input.value.trim() && vCusto == null) return erroNoModal(m, 'Custo inválido.');
      if (vMin == null) return erroNoModal(m, 'Estoque mínimo inválido.');
      aplicarNoModal(ctx, m, (e) => salvarProduto(e, { ...p, preco: vPreco, custo: vCusto, estoqueMinimo: vMin }), original ? 'Produto salvo' : 'Produto cadastrado');
    };
    m.trocar([
      el('div', { class: 'grade-2' }, nome.bloco, codigo.bloco),
      el('div', { class: 'grade-3' }, tipo.bloco, categoria.bloco, unidade.bloco),
      el('div', { class: 'grade-3' }, p.tipo !== 'insumo' ? preco.bloco : null, custo.bloco, minimo.bloco),
      p.tipo !== 'insumo' ? el('div', { class: 'grade-2' }, noCardapio.bloco, cozinha.bloco, p.tipo === 'fabricado' ? controla.bloco : null, ativo.bloco) : ativo.bloco,
    ], [
      original ? botao(original.ativo ? 'Excluir' : 'Excluir de vez', () => confirmar('Excluir produto?', 'Se ele já tem histórico (vendas, estoque), fica inativo em vez de sumir.', 'Excluir', () => { m.fechar(); ctx.mudar((e) => removerProduto(e, original.id), 'Produto excluído'); }, true), { variante: 'perigo' }) : null,
      el('span', { class: 'espaco' }),
      botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
      botao('Salvar', salvar),
    ]);
  };
  desenhar();
}

export function produtos(ctx: Ctx): Node[] {
  const f = ctx.tela('produtos', () => ({ busca: '', tipo: 'todos' as TipoProduto | 'todos', inativos: false }));
  const termo = f.busca.trim().toLowerCase();
  const lista = ctx.estado.produtos
    .filter((p) => (f.inativos ? true : p.ativo))
    .filter((p) => f.tipo === 'todos' || p.tipo === f.tipo)
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
  return [
    cabecalhoPagina('Produtos', `${ctx.estado.produtos.filter((p) => p.ativo).length} produtos ativos`, botao('Novo produto', () => janelaProduto(ctx, null), { icone: 'mais' })),
    el('div', { class: 'filtros' },
      busca(f.busca, (v) => { f.busca = v; ctx.redesenhar(); }, { placeholder: 'Buscar por nome ou código', foco: 'produtos-busca' }),
      campoSelecao('Tipo', f.tipo, [{ valor: 'todos', texto: 'Todos' }, ...TIPOS_PRODUTO.map((t) => ({ valor: t, texto: NOME_TIPO[t] }))], { aoMudar: (v) => { f.tipo = v; ctx.redesenhar(); } }).bloco,
      el('label', { class: 'marcar compacto' }, el('input', { type: 'checkbox', checked: f.inativos, onchange: (e: Event) => { f.inativos = (e.target as HTMLInputElement).checked; ctx.redesenhar(); } }), el('span', {}, 'Mostrar inativos'))),
    cartao(null, tabela([
      { titulo: 'Código', valor: (p) => p.codigo || '—' },
      { titulo: 'Produto', valor: (p) => el('span', {}, p.nome, !p.ativo ? ' ' : '', !p.ativo ? etiqueta('inativo', 'neutro') : null) },
      { titulo: 'Tipo', valor: (p) => NOME_TIPO[p.tipo] },
      { titulo: 'Categoria', valor: (p) => p.categoria },
      { titulo: 'Preço', valor: (p) => (p.preco == null ? (p.tipo === 'insumo' ? '—' : etiqueta('sem preço', 'alerta')) : R(p.preco) + (p.unidade !== 'un' ? '/' + p.unidade : '')), classe: 'num' },
      { titulo: 'Custo', valor: (p) => { const c = custoUnitario(ctx.estado, p); return c == null ? '—' : R(c); }, classe: 'num' },
      { titulo: 'Margem', valor: (p) => { const mg = margem(ctx.estado, p); return mg == null ? '—' : Math.round(mg * 100) + '%'; }, classe: 'num' },
      { titulo: 'Estoque', valor: (p) => (p.controlaEstoque ? formatarQuantidade(p.estoque, p.unidade) : 'na hora'), classe: 'num' },
      { titulo: '', valor: (p) => (p.tipo === 'fabricado' ? botao(fichaDe(ctx.estado, p.id) ? 'Ficha' : 'Criar ficha', () => janelaFicha(ctx, p), { variante: 'fantasma' }) : null) },
    ], lista, { aoClicar: (p) => janelaProduto(ctx, p), rotuloLinha: (p) => `Editar ${p.nome}`, classeLinha: (p) => (p.ativo ? '' : 'riscado'), vazio: 'Nenhum produto encontrado.' })),
  ];
}
