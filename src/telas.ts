// As seis telas do wireframe + a tela de dados (cópia de segurança).
// Cada tela recebe o contexto e devolve os elementos a desenhar.

import qrcode from 'qrcode-generator';
import { codificarCardapio, decodificarCardapio, type ItemPublico } from './cardapioLink';
import { formatarReais, lerReais } from './dinheiro';
import * as E from './estado';
import { anexar, aviso, avisar, botao, cabecalho, campoNumerico, campoTexto, cartao, el, itemMenu, linhaLista, pendente, svg, tituloSecao } from './ui';

export interface Contexto {
  estado: E.Estado;
  /** Aplica uma mudança, salva no navegador e redesenha. Devolve false se der erro. */
  mudar: (f: (e: E.Estado) => E.Estado, mensagem?: string) => boolean;
  ir: (rota: string) => void;
  agora: () => Date;
  ui: { edicao: string | null; clienteSelecionado: string | null; mostrarHistorico?: boolean };
  redesenhar: () => void;
  substituirEstado: (e: E.Estado) => void;
  apagarTudo: () => void;
  urlBase: string;
}

const AVISO_DEMO = 'os dados ficam guardados só neste aparelho e nada mexe na nota fiscal.';

const preco = (centavos: number | null) => (centavos == null ? pendente('PREÇO') : formatarReais(centavos));
const tela = (...filhos: (Node | null)[]) => {
  const c = el('main', { class: 'conteudo' });
  anexar(c, filhos);
  return c;
};

// ---------- 1. Início ----------
export function inicio(ctx: Contexto): Node[] {
  return [
    cabecalho('Início', () => ctx.ir('/')),
    aviso('Demonstração:', AVISO_DEMO),
    tela(
      el('p', {}, 'Escolha uma tela:'),
      el('nav', { class: 'caixa', 'aria-label': 'Menu' },
        itemMenu('Fornadas', () => ctx.ir('/fornadas')),
        itemMenu('Cardápio', () => ctx.ir('/cardapio')),
        itemMenu('Estoque', () => ctx.ir('/estoque')),
        itemMenu('Clientes a prazo', () => ctx.ir('/prazo')),
        itemMenu('Vendas', null, 'Aguardando relatório da maquininha')),
      el('button', { type: 'button', class: 'link-botao', onclick: () => ctx.ir('/dados') }, 'Cópia de segurança dos dados'),
    ),
  ];
}

// ---------- 2. Fornadas ----------
export function fornadas(ctx: Contexto): Node[] {
  const agora = ctx.agora();
  const dia = E.diaDe(ctx.estado, E.chaveDoDia(agora));
  const n = dia.horarios.length;
  const horas = dia.horarios.map(E.horaCurta);
  const listaHoras = n === 0
    ? 'Nenhuma fornada ainda. Toque no botão quando sair a primeira.'
    : (n === 1 ? 'Saiu às ' : 'Saíram às ') + (n === 1 ? horas[0] : horas.slice(0, -1).join(', ') + ' e ' + horas[n - 1]);

  const sobra = campoNumerico('Quantos pães sobraram?', dia.sobra, 'pães');

  return [
    cabecalho('Fornadas', () => ctx.ir('/')),
    tela(
      el('div', { class: 'contador' },
        el('span', { class: 'texto-p suave' }, 'Hoje'),
        el('span', { class: 'numero', 'data-teste': 'contagem' }, n === 1 ? '1 fornada' : n + ' fornadas'),
        el('p', { class: 'texto-p suave' }, listaHoras)),
      el('button', {
        type: 'button', class: 'botao-gigante',
        onclick: () => {
          const momento = ctx.agora();
          ctx.mudar((e) => E.registrarFornada(e, momento), 'Fornada registrada às ' + E.horaCurta(momento.toISOString()));
        },
      }, 'Saiu uma fornada'),
      n > 0 ? el('button', {
        type: 'button', class: 'link-botao',
        onclick: () => ctx.mudar((e) => E.desfazerFornada(e, ctx.agora()), 'Última fornada desfeita'),
      }, 'Toquei sem querer: desfazer a última') : null,
      el('hr', { class: 'divisoria' }),
      tituloSecao('Fim do dia'),
      sobra.bloco,
      botao('Registrar sobra', () => {
        const v = sobra.ler() ?? 0;
        ctx.mudar((e) => E.registrarSobra(e, ctx.agora(), v), 'Sobra registrada: ' + v + (v === 1 ? ' pão' : ' pães'));
      }, { variante: 'secundario', total: true }),
      el('div', { class: 'cartoes' },
        cartao('Fornadas', n),
        dia.sobra == null ? cartao('Sobra', '—') : cartao('Sobra', dia.sobra, 'pães')),
    ),
  ];
}

// ---------- 3. Cardápio (versão do Thiago, editável) ----------
export function cardapio(ctx: Contexto): Node[] {
  const editando = ctx.ui.edicao;
  const link = ctx.urlBase + '#/c/' + codificarCardapio(ctx.estado.cardapio);

  const formulario = (item: E.ItemCardapio | null) => {
    const nome = campoTexto('Nome do item', item?.nome ?? '');
    const valor = campoTexto('Preço', item?.preco == null ? '' : formatarReais(item.preco).replace('R$ ', ''), { modo: 'decimal', ajuda: 'Ex.: 6,50. Pode deixar em branco.' });
    const idSel = 'sel-categoria';
    const sel = el('select', { id: idSel }, ...E.CATEGORIAS.map((c) => el('option', { value: c, selected: (item?.categoria ?? 'Pão de queijo') === c }, c)));
    const erro = el('p', { class: 'erro', role: 'alert' });
    const salvar = () => {
      const p = valor.input.value.trim() === '' ? null : lerReais(valor.input.value);
      if (p === null && valor.input.value.trim() !== '') {
        erro.textContent = 'Preço não entendido. Use números, como 6,50.';
        return;
      }
      const novo: E.ItemCardapio = { id: item?.id ?? E.novoId(), categoria: sel.value as E.Categoria, nome: nome.input.value, preco: p };
      ctx.ui.edicao = null;
      if (!ctx.mudar((e) => E.salvarItemCardapio(e, novo), 'Item salvo')) ctx.ui.edicao = item?.id ?? 'novo';
    };
    return el('form', { class: 'painel', onsubmit: (e: Event) => { e.preventDefault(); salvar(); } },
      tituloSecao(item ? 'Editar item' : 'Novo item'),
      nome.bloco, el('div', { class: 'campo' }, el('label', { for: idSel }, 'Categoria'), sel), valor.bloco, erro,
      el('div', { class: 'botoes' },
        botao('Salvar', () => {}, { tipo: 'submit' }),
        botao('Cancelar', () => { ctx.ui.edicao = null; ctx.redesenhar(); }, { variante: 'secundario' })),
      item ? botao('Remover este item', () => {
        if (!window.confirm('Remover "' + item.nome + '" do cardápio?')) return;
        ctx.ui.edicao = null;
        ctx.mudar((e) => E.removerItemCardapio(e, item.id), 'Item removido');
      }, { variante: 'perigo', total: true }) : null);
  };

  const secoes = E.CATEGORIAS.map((cat) => {
    const itens = ctx.estado.cardapio.filter((i) => i.categoria === cat);
    const emEdicao = itens.find((i) => i.id === editando);
    return el('section', { class: 'secao' },
      tituloSecao(cat),
      el('div', { class: 'caixa' }, ...(itens.length
        ? itens.map((i) => linhaLista(i.nome, preco(i.preco), { aoClicar: () => { ctx.ui.edicao = i.id; ctx.redesenhar(); }, rotuloAcessivel: 'Editar ' + i.nome, selecionado: i.id === editando }))
        : [el('p', { class: 'vazio' }, 'Nenhum item nesta categoria.')])),
      emEdicao ? formulario(emEdicao) : null);
  });

  return [
    cabecalho('Cardápio', () => ctx.ir('/')),
    aviso('Demonstração:', AVISO_DEMO),
    tela(
      el('p', { class: 'texto-p' }, 'Toque num item para mudar o nome ou o preço.'),
      ...secoes,
      editando === 'novo' ? formulario(null) : botao('+ Adicionar item', () => { ctx.ui.edicao = 'novo'; ctx.redesenhar(); }, { variante: 'secundario', total: true }),
      el('hr', { class: 'divisoria' }),
      tituloSecao('Para o cliente'),
      el('div', { class: 'qr' }, qrSvg(link), el('p', { class: 'texto-p' }, 'Este QR code abre o cardápio no celular do cliente, sem cadastro e sem aplicativo.')),
      el('p', { class: 'texto-p suave' }, 'Mudou preço ou item? O QR code muda junto. Imprima de novo depois de alterar.'),
      botao('Ver como o cliente vê', () => ctx.ir('/c/' + codificarCardapio(ctx.estado.cardapio)), { variante: 'secundario', total: true }),
    ),
  ];
}

function qrSvg(texto: string): SVGElement {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  const m = 2; // margem
  const caminho: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) caminho.push(`M${c + m} ${r + m}h1v1h-1z`);
  return svg('svg', { viewBox: `0 0 ${n + 2 * m} ${n + 2 * m}`, role: 'img', 'aria-label': 'QR code do cardápio', 'shape-rendering': 'crispEdges' },
    svg('rect', { width: n + 2 * m, height: n + 2 * m, fill: '#FFFFFF' }),
    svg('path', { d: caminho.join(''), fill: '#2B1D14' }));
}

// ---------- 3b. Cardápio público (aberto pelo QR code) ----------
export function cardapioPublico(codigo: string): Node[] {
  const itens: ItemPublico[] | null = decodificarCardapio(codigo);
  if (!itens) {
    return [cabecalho('Casa do Pão de Queijo'), tela(el('p', {}, 'Este link do cardápio está incompleto. Peça um QR code novo no balcão.'))];
  }
  return [
    cabecalho('Casa do Pão de Queijo'),
    tela(
      el('p', {}, el('strong', {}, 'Cardápio'), ' · sem cadastro, sem aplicativo'),
      ...E.CATEGORIAS.map((cat) => {
        const doGrupo = itens.filter((i) => i.categoria === cat);
        if (!doGrupo.length) return null;
        return el('section', { class: 'secao' }, tituloSecao(cat),
          el('div', { class: 'caixa' }, ...doGrupo.map((i) => linhaLista(i.nome, i.preco == null ? 'Consulte' : formatarReais(i.preco)))));
      }),
      el('p', { class: 'texto-p suave' }, 'Peça no balcão. Preços podem mudar.'),
    ),
  ];
}

// ---------- 4. Estoque ----------
export function estoque(ctx: Contexto): Node[] {
  const listas: { chave: E.ListaEstoque; titulo: string; vazio: string }[] = [
    { chave: 'ingredientes', titulo: 'Ingredientes do pão de queijo', vazio: 'Nenhum ingrediente ainda.' },
    { chave: 'revenda', titulo: 'Produtos de revenda', vazio: 'Nenhum produto de revenda ainda.' },
  ];
  const formulario = (lista: E.ListaEstoque, item: E.ItemEstoque | null) => {
    const nome = campoTexto(lista === 'ingredientes' ? 'Ingrediente' : 'Produto', item?.nome ?? '');
    const qtd = campoTexto('Quanto tem agora', item?.quantidade ?? '', { ajuda: 'Escreva do seu jeito: "2 sacos", "15 kg", "3 caixas".', maximo: 40 });
    const salvar = () => {
      const novo: E.ItemEstoque = { id: item?.id ?? E.novoId(), nome: nome.input.value, quantidade: qtd.input.value };
      const antes = ctx.ui.edicao;
      ctx.ui.edicao = null;
      if (!ctx.mudar((e) => E.salvarItemEstoque(e, lista, novo), 'Estoque atualizado')) ctx.ui.edicao = antes;
    };
    return el('form', { class: 'painel', onsubmit: (e: Event) => { e.preventDefault(); salvar(); } },
      nome.bloco, qtd.bloco,
      el('div', { class: 'botoes' },
        botao('Salvar', () => {}, { tipo: 'submit' }),
        botao('Cancelar', () => { ctx.ui.edicao = null; ctx.redesenhar(); }, { variante: 'secundario' })),
      item ? botao('Remover', () => {
        if (!window.confirm('Remover "' + item.nome + '"?')) return;
        ctx.ui.edicao = null;
        ctx.mudar((e) => E.removerItemEstoque(e, lista, item.id), 'Removido');
      }, { variante: 'perigo', total: true }) : null);
  };

  return [
    cabecalho('Estoque', () => ctx.ir('/')),
    aviso('Demonstração:', AVISO_DEMO),
    tela(...listas.map(({ chave, titulo, vazio }) => {
      const itens = ctx.estado.estoque[chave];
      const emEdicao = itens.find((i) => ctx.ui.edicao === chave + ':' + i.id);
      return el('section', { class: 'secao' },
        tituloSecao(titulo),
        el('div', { class: 'caixa' }, ...(itens.length
          ? itens.map((i) => linhaLista(i.nome, i.quantidade || pendente('QTD'), { aoClicar: () => { ctx.ui.edicao = chave + ':' + i.id; ctx.redesenhar(); }, rotuloAcessivel: 'Editar ' + i.nome, selecionado: emEdicao?.id === i.id }))
          : [el('p', { class: 'vazio' }, vazio)])),
        emEdicao ? formulario(chave, emEdicao)
          : ctx.ui.edicao === chave + ':novo' ? formulario(chave, null)
          : botao('+ Adicionar', () => { ctx.ui.edicao = chave + ':novo'; ctx.redesenhar(); }, { variante: 'secundario', total: true }));
    })),
  ];
}

// ---------- 5. Clientes a prazo ----------
export function prazo(ctx: Contexto): Node[] {
  const sel = ctx.estado.clientes.find((c) => c.id === ctx.ui.clienteSelecionado) ?? null;

  const linhas = ctx.estado.clientes.map((c) => {
    const total = E.totalCliente(c);
    const valor = total > 0 ? formatarReais(total) : c.ultimoPagamento ? el('span', { class: 'selo-pago' }, 'Pago') : formatarReais(0);
    return linhaLista(c.nome, valor, {
      detalhe: c.lancamentos.length ? c.lancamentos.length + (c.lancamentos.length === 1 ? ' lançamento' : ' lançamentos') : undefined,
      selecionado: sel?.id === c.id,
      rotuloAcessivel: 'Escolher ' + c.nome,
      aoClicar: () => { ctx.ui.clienteSelecionado = sel?.id === c.id ? null : c.id; ctx.ui.edicao = null; ctx.redesenhar(); },
    });
  });

  let painel: Node | null = null;
  if (sel && ctx.ui.edicao === 'nome') {
    const nome = campoTexto('Nome do cliente', sel.nome);
    painel = el('form', { class: 'painel', onsubmit: (e: Event) => { e.preventDefault(); ctx.ui.edicao = null; ctx.mudar((s) => E.salvarCliente(s, sel.id, nome.input.value), 'Nome salvo'); } },
      nome.bloco,
      el('div', { class: 'botoes' }, botao('Salvar', () => {}, { tipo: 'submit' }), botao('Cancelar', () => { ctx.ui.edicao = null; ctx.redesenhar(); }, { variante: 'secundario' })),
      botao('Remover cliente', () => {
        if (E.totalCliente(sel) > 0 && !window.confirm(sel.nome + ' ainda deve ' + formatarReais(E.totalCliente(sel)) + '. Remover mesmo assim?')) return;
        if (E.totalCliente(sel) === 0 && !window.confirm('Remover ' + sel.nome + '?')) return;
        ctx.ui.clienteSelecionado = null;
        ctx.ui.edicao = null;
        ctx.mudar((s) => E.removerCliente(s, sel.id), 'Cliente removido');
      }, { variante: 'perigo', total: true }));
  } else if (sel) {
    const valor = campoTexto('Valor consumido hoje', '', { modo: 'decimal', ajuda: 'Ex.: 12,50' });
    const erro = el('p', { class: 'erro', role: 'alert' });
    const total = E.totalCliente(sel);
    painel = el('form', {
      class: 'painel',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const v = lerReais(valor.input.value);
        if (v == null || v <= 0) { erro.textContent = 'Digite um valor, como 12,50.'; return; }
        ctx.mudar((s) => E.lancarConsumo(s, sel.id, v, ctx.agora()), formatarReais(v) + ' lançado para ' + sel.nome);
      },
    },
      tituloSecao(sel.nome),
      sel.lancamentos.length
        ? el('div', { class: 'caixa' }, ...sel.lancamentos.map((l) => linhaLista(new Date(l.quando).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }), formatarReais(l.valor))))
        : el('p', { class: 'texto-p suave' }, sel.ultimoPagamento ? 'Pagou ' + formatarReais(sel.ultimoPagamento.valor) + ' em ' + new Date(sel.ultimoPagamento.quando).toLocaleDateString('pt-BR') + '. Nada em aberto.' : 'Nada em aberto.'),
      valor.bloco, erro,
      botao('Lançar consumo', () => {}, { tipo: 'submit', variante: 'secundario', total: true }),
      botao('Marcar como pago', () => {
        if (!window.confirm('Confirmar que ' + sel.nome + ' pagou ' + formatarReais(total) + '?')) return;
        ctx.ui.clienteSelecionado = null;
        ctx.mudar((s) => E.marcarPago(s, sel.id, ctx.agora()), sel.nome + ': pago');
      }, { total: true, desabilitado: total === 0 }),
      total === 0 ? el('p', { class: 'texto-p', style: 'color: var(--desabilitado-texto)' }, 'Não há conta em aberto para pagar.') : null,
      el('button', { type: 'button', class: 'link-botao', onclick: () => { ctx.ui.edicao = 'nome'; ctx.redesenhar(); } }, 'Mudar nome ou remover cliente'));
  }

  return [
    cabecalho('Clientes a prazo', () => ctx.ir('/')),
    aviso('Demonstração:', AVISO_DEMO),
    tela(
      el('p', { class: 'texto-p suave' }, 'Conta em aberto · acerto semanal'),
      el('p', {}, 'Toque no cliente para lançar consumo ou marcar como pago.'),
      el('div', { class: 'caixa' }, ...linhas),
      painel,
      el('div', { class: 'caixa' }, linhaLista('Total em aberto', formatarReais(E.totalClientes(ctx.estado)), { destaque: true })),
      ctx.ui.edicao === 'novo-cliente'
        ? (() => {
            const nome = campoTexto('Nome do novo cliente', '');
            return el('form', { class: 'painel', onsubmit: (e: Event) => { e.preventDefault(); ctx.ui.edicao = null; ctx.mudar((s) => E.salvarCliente(s, null, nome.input.value), 'Cliente adicionado'); } },
              nome.bloco, el('div', { class: 'botoes' }, botao('Adicionar', () => {}, { tipo: 'submit' }), botao('Cancelar', () => { ctx.ui.edicao = null; ctx.redesenhar(); }, { variante: 'secundario' })));
          })()
        : botao('+ Novo cliente', () => { ctx.ui.clienteSelecionado = null; ctx.ui.edicao = 'novo-cliente'; ctx.redesenhar(); }, { variante: 'secundario', total: true }),
    ),
  ];
}

// ---------- 6. Vendas (fora do MVP) ----------
export function vendas(ctx: Contexto): Node[] {
  return [
    cabecalho('Vendas', () => ctx.ir('/')),
    aviso('Fora do MVP atual:', 'esta tela só existe se chegar o relatório da maquininha.'),
    tela(
      el('p', { class: 'texto-p suave' }, 'Total por dia da semana · ', pendente('MÊS DO RELATÓRIO')),
      el('div', { class: 'grafico', role: 'img', 'aria-label': 'Gráfico sem dados' }, ...['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(() => el('div', { class: 'barra' }))),
      el('div', { class: 'grafico-dias' }, ...['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((d) => el('span', {}, d))),
    ),
  ];
}

// ---------- Cópia de segurança ----------
export function dados(ctx: Contexto): Node[] {
  const arquivo = el('input', { type: 'file', accept: 'application/json,.json', id: 'importar', class: 'texto-p' });
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    if (!f) return;
    try {
      const novo = E.validarEstado(JSON.parse(await f.text()));
      if (!window.confirm('Trocar os dados deste aparelho pelos do arquivo? O que está aqui agora será substituído.')) return;
      ctx.substituirEstado(novo);
      avisar('Dados importados');
    } catch {
      avisar('Arquivo não reconhecido. Nada foi alterado.');
    }
    arquivo.value = '';
  });
  return [
    cabecalho('Dados', () => ctx.ir('/')),
    tela(
      el('p', {}, 'Os dados ficam só neste aparelho. Se limpar o navegador ou trocar de celular, eles somem.'),
      el('p', { class: 'texto-p suave' }, 'Para não perder nada, salve uma cópia de vez em quando.'),
      botao('Salvar cópia em arquivo', () => {
        const blob = new Blob([JSON.stringify(ctx.estado, null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'casa-pao-de-queijo-' + E.chaveDoDia(ctx.agora()) + '.json' });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, { total: true }),
      el('div', { class: 'campo' }, el('label', { for: 'importar' }, 'Trazer dados de um arquivo'), arquivo),
      el('hr', { class: 'divisoria' }),
      botao('Apagar tudo e começar de novo', () => {
        if (!window.confirm('Apagar todos os dados deste aparelho? Isso não tem volta.')) return;
        ctx.apagarTudo();
      }, { variante: 'perigo', total: true }),
    ),
  ];
}
