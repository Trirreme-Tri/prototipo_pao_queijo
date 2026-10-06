// Tela da cozinha (KDS): pedidos que vêm do caixa e encomendas, em colunas.
// Funciona no celular e num monitor/tablet na cozinha.

import { aplicarNoModal, type Ctx } from '../app';
import { avancarPedido, cancelarPedido, criarPedido, voltarPedido } from '../dominio/caixa';
import { vendaveis } from '../dominio/catalogo';
import type { Pedido, StatusPedido } from '../dominio/tipos';
import { dataHora, formatarQuantidade } from '../dominio/util';
import { el, toqueUnico } from '../ui/base';
import { botao, botaoIcone, cabecalhoPagina, campoAreaTexto, campoQuantidade, campoSelecao, campoTexto, etiqueta } from '../ui/componentes';
import { abrirModal, confirmar, erroNoModal } from '../ui/modal';

const COLUNAS: { status: StatusPedido; titulo: string; acao: string }[] = [
  { status: 'novo', titulo: 'Novos', acao: 'Começar' },
  { status: 'preparando', titulo: 'Preparando', acao: 'Pronto' },
  { status: 'pronto', titulo: 'Prontos', acao: 'Entregue' },
];

function minutosDesde(iso: string, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000));
}

function janelaNovoPedido(ctx: Ctx): void {
  const itens: { nome: string; quantidade: number }[] = [];
  const produtos = vendaveis(ctx.estado);
  const m = abrirModal('Novo pedido ou encomenda', [], [], { largura: 'm' });
  let tipo: 'balcao' | 'encomenda' = 'encomenda';
  const ident = campoTexto('Para quem', '', { max: 40, placeholder: 'Nome do cliente' });
  const quando = el('input', { type: 'datetime-local', id: 'enc-quando' });
  const obs = campoAreaTexto('Observação', '', { max: 200 });
  const desenhar = () => {
    const prod = campoSelecao('Produto', produtos[0]?.id ?? '', produtos.map((p) => ({ valor: p.id, texto: p.nome })));
    const qtd = campoQuantidade('Quantidade', 1, 'un');
    const adicionar = () => {
      const p = produtos.find((x) => x.id === prod.valor());
      const q = qtd.ler();
      if (!p || q == null || q <= 0) return erroNoModal(m, 'Escolha o produto e a quantidade.');
      itens.push({ nome: p.nome, quantidade: q });
      desenhar();
    };
    m.trocar([
      campoSelecao('Tipo', tipo, [{ valor: 'encomenda', texto: 'Encomenda (retirar depois)' }, { valor: 'balcao', texto: 'Pedido do balcão (agora)' }], { aoMudar: (v) => { tipo = v; desenhar(); } }).bloco,
      ident.bloco,
      tipo === 'encomenda' ? el('div', { class: 'campo' }, el('label', { for: 'enc-quando' }, 'Retirar em'), quando) : null,
      el('div', { class: 'grade-3' }, prod.bloco, qtd.bloco, el('div', { class: 'campo alinhar-base' }, botao('Adicionar item', adicionar, { variante: 'secundario', icone: 'mais' }))),
      itens.length ? el('ul', { class: 'lista-pagamentos' }, ...itens.map((i, k) => el('li', {}, el('span', {}, i.nome), el('strong', {}, String(i.quantidade)), botaoIcone('lixo', 'Remover item', () => { itens.splice(k, 1); desenhar(); })))) : el('p', { class: 'ajuda' }, 'Nenhum item ainda.'),
      obs.bloco,
    ].filter(Boolean) as Node[], [
      botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
      botao('Mandar para a cozinha', () => {
        if (tipo === 'encomenda' && !quando.value) return erroNoModal(m, 'Informe quando o cliente vai retirar.');
        aplicarNoModal(ctx, m, (e) => criarPedido(e, { origem: tipo, vendaId: null, identificacao: ident.valor() || (tipo === 'encomenda' ? 'Encomenda' : 'Balcão'), itens, obs: obs.valor(), paraQuando: tipo === 'encomenda' ? new Date(quando.value).toISOString() : null }, ctx.agora()), 'Pedido enviado para a cozinha');
      }),
    ]);
  };
  desenhar();
}

function cartaoPedido(ctx: Ctx, p: Pedido, acao: string): HTMLElement {
  const min = minutosDesde(p.criadoEm, ctx.agora());
  const atrasado = p.origem !== 'encomenda' && p.status !== 'pronto' && min >= 15;
  return el('article', { class: 'pedido' + (atrasado ? ' atrasado' : ''), 'data-testid': 'pedido' },
    el('header', {},
      el('strong', {}, `#${p.numero} · ${p.identificacao}`),
      etiqueta(p.origem === 'encomenda' ? 'encomenda' : p.origem === 'caixa' ? 'caixa' : 'balcão', p.origem === 'encomenda' ? 'info' : 'neutro')),
    el('ul', {}, ...p.itens.map((i) => el('li', {}, el('strong', {}, formatarQuantidade(i.quantidade, '') + '×'), ' ', i.nome))),
    p.obs ? el('p', { class: 'obs' }, p.obs) : null,
    el('p', { class: 'ajuda' }, p.paraQuando ? `Retirar: ${dataHora(p.paraQuando)}` : `Há ${min} min`, atrasado ? ' · atrasado' : ''),
    el('footer', {},
      p.status !== 'novo' ? botaoIcone('voltar', 'Voltar uma etapa', () => ctx.mudar((e) => voltarPedido(e, p.id, ctx.agora()))) : botaoIcone('lixo', 'Cancelar pedido', () => confirmar('Cancelar pedido?', `Pedido #${p.numero} de ${p.identificacao}.`, 'Cancelar pedido', () => ctx.mudar((e) => cancelarPedido(e, p.id, ctx.agora()), 'Pedido cancelado'), true)),
      botao(acao, () => toqueUnico('pedido-' + p.id + '-' + p.status, 800) && ctx.mudar((e) => avancarPedido(e, p.id, ctx.agora())), { variante: p.status === 'pronto' ? 'sucesso' : 'primario' })));
}

export function cozinha(ctx: Ctx): Node[] {
  const abertos = ctx.estado.pedidos.filter((p) => p.status === 'novo' || p.status === 'preparando' || p.status === 'pronto');
  const ordenar = (a: Pedido, b: Pedido) => (a.paraQuando ?? a.criadoEm).localeCompare(b.paraQuando ?? b.criadoEm);
  return [
    cabecalhoPagina('Cozinha', 'Pedidos do caixa (itens feitos na hora) e encomendas. A tela atualiza sozinha.', botao('Novo pedido', () => janelaNovoPedido(ctx), { icone: 'mais' })),
    el('div', { class: 'kds' },
      ...COLUNAS.map((c) => {
        const lista = abertos.filter((p) => p.status === c.status).sort(ordenar);
        return el('section', { class: 'kds-coluna ' + c.status, 'aria-label': c.titulo },
          el('h2', {}, c.titulo, ' ', el('span', { class: 'contador' }, lista.length)),
          ...(lista.length ? lista.map((p) => cartaoPedido(ctx, p, c.acao)) : [el('p', { class: 'vazio' }, 'Nada aqui.')]));
      })),
  ];
}
