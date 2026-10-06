// Cardápio online e QR code (gestão) + cardápio público que o cliente abre no celular.

import qrcode from 'qrcode-generator';
import type { Ctx } from '../app';
import { codificarCardapio, decodificarCardapio, linkPedidoWhatsApp, numeroWhatsApp, type CardapioPublico, type ItemPublico } from '../cardapioLink';
import { salvarProduto } from '../dominio/catalogo';
import { formatarReais as R } from '../dinheiro';
import { avisar, el, icone, imprimir, svg } from '../ui/base';
import { aviso, botao, botaoIcone, cabecalhoPagina, campoTexto, cartao, etiqueta } from '../ui/componentes';

function qrSvg(texto: string): SVGElement | null {
  for (const nivel of ['M', 'L'] as const) {
    try {
      const q = qrcode(0, nivel);
      q.addData(texto);
      q.make();
      const n = q.getModuleCount();
      const m = 2;
      const caminho: string[] = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) caminho.push(`M${c + m} ${r + m}h1v1h-1z`);
      return svg('svg', { viewBox: `0 0 ${n + 2 * m} ${n + 2 * m}`, role: 'img', 'aria-label': 'QR code do cardápio', 'shape-rendering': 'crispEdges', class: 'qr-svg' },
        svg('rect', { width: n + 2 * m, height: n + 2 * m, fill: '#FFFFFF' }),
        svg('path', { d: caminho.join(''), fill: '#2B1D14' }));
    } catch {
      /* texto grande demais para este nível: tenta o próximo */
    }
  }
  return null;
}

export function cardapioDaLoja(ctx: Ctx): CardapioPublico {
  const itens: ItemPublico[] = ctx.estado.produtos
    .filter((p) => p.ativo && p.noCardapio && p.tipo !== 'insumo')
    .sort((a, b) => ctx.estado.config.categorias.indexOf(a.categoria) - ctx.estado.config.categorias.indexOf(b.categoria) || a.nome.localeCompare(b.nome))
    .map((p) => ({ categoria: p.categoria, nome: p.unidade === 'un' ? p.nome : `${p.nome} (${p.unidade})`, preco: p.preco }));
  return { loja: ctx.estado.config.nomeLoja, whatsapp: numeroWhatsApp(ctx.estado.config.whatsapp) ? ctx.estado.config.whatsapp.replace(/\D/g, '') : '', itens };
}

export function cardapio(ctx: Ctx): Node[] {
  const dados = cardapioDaLoja(ctx);
  const link = ctx.urlBase + '#/c/' + codificarCardapio(dados);
  const qr = qrSvg(link);
  const vendaveis = ctx.estado.produtos.filter((p) => p.ativo && p.tipo !== 'insumo').sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
  const alternar = (id: string) => ctx.mudar((e) => {
    const p = e.produtos.find((x) => x.id === id)!;
    return salvarProduto(e, { ...p, noCardapio: !p.noCardapio });
  });
  const folhaQr = () => el('div', { class: 'folha-qr' }, el('h1', {}, dados.loja), el('p', {}, 'Cardápio no celular'), qrSvg(link)!, el('p', {}, 'Aponte a câmera do celular para o código'), dados.whatsapp ? el('p', {}, 'Peça pelo WhatsApp direto do cardápio') : null);

  return [
    cabecalhoPagina('Cardápio e QR code', 'O que o cliente vê ao apontar a câmera para o QR.'),
    !dados.whatsapp ? aviso('Cadastre o WhatsApp da loja em Configurações para o cliente poder pedir pelo cardápio.', 'alerta', botao('Configurar', () => ctx.ir('/config'), { variante: 'secundario' })) : null,
    el('div', { class: 'grade-2 topo' },
      cartao('Itens no cardápio',
        el('ul', { class: 'lista-alternar' }, ...vendaveis.map((p) => el('li', {},
          el('label', { class: 'marcar compacto' },
            el('input', { type: 'checkbox', checked: p.noCardapio, onchange: () => alternar(p.id) }),
            el('span', {}, el('strong', {}, p.nome), el('span', { class: 'ajuda' }, ` ${p.categoria}`))),
          p.preco == null ? etiqueta('sem preço', 'alerta') : el('span', {}, R(p.preco) + (p.unidade !== 'un' ? '/' + p.unidade : '')))))),
      cartao('QR code',
        qr ? el('div', { class: 'qr' }, qr) : aviso('Cardápio grande demais para caber num QR. Tire alguns itens ou use o link.', 'alerta'),
        el('p', { class: 'ajuda' }, `${dados.itens.length} itens. Mudou preço ou item? Imprima o QR de novo: o cardápio vai dentro do código.`),
        el('div', { class: 'acoes-linha quebra' },
          qr ? botao('Imprimir QR', () => imprimir(folhaQr()), { icone: 'imprimir' }) : null,
          botao('Copiar link', () => navigator.clipboard?.writeText(link).then(() => avisar('Link copiado. Mande no WhatsApp ou Instagram.'), () => avisar('Não consegui copiar. Use "Abrir como cliente" e copie da barra.', 'erro')), { variante: 'secundario', icone: 'link' }),
          el('a', { class: 'botao secundario', href: link, target: '_blank', rel: 'noopener', 'data-testid': 'abrir-cardapio' }, 'Abrir como cliente')))),
  ].filter(Boolean) as Node[];
}

// ---------- Público ----------

const carrinho = new Map<string, number>(); // nome do item → quantidade

export function cardapioPublico(codigo: string, redesenhar: () => void): Node[] {
  const c = decodificarCardapio(codigo);
  if (!c) {
    return [el('div', { class: 'publico' }, el('header', { class: 'publico-topo' }, el('h1', {}, 'Cardápio')),
      el('div', { class: 'publico-corpo' }, aviso('Este link do cardápio está incompleto ou foi alterado. Peça um QR code novo no balcão.', 'alerta')))];
  }
  document.title = `Cardápio · ${c.loja}`;
  const comPreco = c.itens.filter((i) => i.preco != null);
  const pedido = [...carrinho].map(([nome, quantidade]) => ({ item: comPreco.find((i) => i.nome === nome), quantidade })).filter((x) => x.item && x.quantidade > 0) as { item: ItemPublico; quantidade: number }[];
  const total = pedido.reduce((s, p) => s + (p.item.preco ?? 0) * p.quantidade, 0);
  const podePedir = Boolean(c.whatsapp);
  const categorias = [...new Set(c.itens.map((i) => i.categoria))];
  const mudar = (nome: string, d: number) => {
    carrinho.set(nome, Math.max(0, (carrinho.get(nome) ?? 0) + d));
    redesenhar();
  };
  const nome = campoTexto('Seu nome', '', { max: 40 });
  const obs = campoTexto('Observação', '', { max: 200, placeholder: 'Ex.: retiro às 16h' });
  const enviar = () => {
    const url = linkPedidoWhatsApp(c.whatsapp, c.loja, pedido.map((p) => ({ nome: p.item.nome, preco: p.item.preco ?? 0, quantidade: p.quantidade })), nome.valor(), obs.valor());
    if (url) window.open(url, '_blank', 'noopener');
  };

  return [el('div', { class: 'publico' },
    el('header', { class: 'publico-topo' }, el('h1', {}, c.loja), el('p', {}, podePedir ? 'Escolha e envie o pedido pelo WhatsApp' : 'Nosso cardápio')),
    el('div', { class: 'publico-corpo' },
      ...categorias.map((cat) => el('section', { class: 'publico-secao' },
        el('h2', {}, cat),
        el('ul', {}, ...c.itens.filter((i) => i.categoria === cat).map((i) => {
          const q = carrinho.get(i.nome) ?? 0;
          return el('li', { class: 'publico-item' },
            el('span', { class: 'nome' }, i.nome),
            el('span', { class: 'preco' }, i.preco == null ? 'consulte' : R(i.preco)),
            podePedir && i.preco != null
              ? el('span', { class: 'qtd-publico' }, q > 0 ? botaoIcone('menos', `Tirar ${i.nome}`, () => mudar(i.nome, -1), 'secundario') : null, q > 0 ? el('strong', {}, q) : null, botaoIcone('mais', `Adicionar ${i.nome}`, () => mudar(i.nome, 1), 'primario'))
              : null);
        })))),
      pedido.length
        ? el('section', { class: 'publico-pedido', id: 'pedido' },
          el('h2', {}, 'Seu pedido'),
          el('ul', {}, ...pedido.map((p) => el('li', {}, el('span', {}, `${p.quantidade}× ${p.item.nome}`), el('span', {}, R((p.item.preco ?? 0) * p.quantidade))))),
          el('p', { class: 'total' }, 'Total: ', el('strong', {}, R(total))),
          nome.bloco, obs.bloco,
          el('button', { type: 'button', class: 'botao sucesso grande total', onclick: enviar, 'data-testid': 'enviar-whatsapp' }, icone('whatsapp', 22), 'Enviar pedido pelo WhatsApp'),
          el('p', { class: 'ajuda' }, 'O pedido abre no seu WhatsApp. A loja confirma por lá.'))
        : null),
    pedido.length ? el('a', { class: 'barra-pedido', href: '#pedido', onclick: (e: Event) => { e.preventDefault(); document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth' }); } }, `Ver pedido (${pedido.reduce((s, p) => s + p.quantidade, 0)}) · ${R(total)}`) : null,
    el('footer', { class: 'publico-rodape' }, 'Preços sujeitos a alteração. Cardápio digital.'))];
}
