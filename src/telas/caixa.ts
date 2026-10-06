// Frente de caixa (PDV): abrir, vender, receber, sangria/suprimento e fechar.

import { aplicarNoModal, type Ctx } from '../app';
import { abrirCaixa, caixaAberto, calcularPagamento, fecharCaixa, receberFiado, registrarVenda, resumoSessao, saldoFiado, sangria, suprimento } from '../dominio/caixa';
import { produtoPorCodigo, produtoPorId, vendaveis } from '../dominio/catalogo';
import type { FormaPagamento, Pagamento, Produto, Venda } from '../dominio/tipos';
import { FORMAS_PAGAMENTO, NOME_FORMA } from '../dominio/tipos';
import { formatarQuantidade, horaCurta, q3, valorItem } from '../dominio/util';
import { formatarReais as R, lerReais } from '../dinheiro';
import { avisar, el, icone, imprimir } from '../ui/base';
import { aviso, botao, botaoIcone, busca, cabecalhoPagina, campoDinheiro, campoQuantidade, campoSelecao, campoTexto, cartao, etiqueta, kpi, lerNumero } from '../ui/componentes';
import { abrirModal, erroNoModal, modalAberto } from '../ui/modal';
import { comprovante, relatorioFechamento } from './impressos';

interface EstadoPdv {
  itens: { produtoId: string; quantidade: number }[];
  /** Desconto em centavos (modo reais) ou em % (modo pct). */
  desconto: number;
  modoDesconto: 'reais' | 'pct';
  busca: string;
  categoria: string;
}

let ctxAtual: Ctx | null = null;

const pdv = (ctx: Ctx) => ctx.tela<EstadoPdv>('pdv', () => ({ itens: [], desconto: 0, modoDesconto: 'reais', busca: '', categoria: 'Todas' }));

// ---------- Carrinho ----------

function adicionar(ctx: Ctx, p: Produto, quantidade: number): void {
  const s = pdv(ctx);
  const linha = s.itens.find((i) => i.produtoId === p.id);
  if (linha) linha.quantidade = q3(linha.quantidade + quantidade);
  else s.itens.push({ produtoId: p.id, quantidade: q3(quantidade) });
  s.busca = '';
  ctx.redesenhar();
  document.querySelector<HTMLElement>('[data-foco="pdv-busca"]')?.focus();
}

function pedirPeso(ctx: Ctx, p: Produto): void {
  const q = campoQuantidade(`Quanto de ${p.nome}?`, null, p.unidade, { ajuda: `${R(p.preco ?? 0)} por ${p.unidade}. Ex.: 0,350` });
  const confirmar = () => {
    const v = q.ler();
    if (v == null || v <= 0) return erroNoModal(m, 'Digite o peso. Ex.: 0,350');
    m.fechar();
    adicionar(ctx, p, v);
  };
  q.input.addEventListener('keydown', (e) => e.key === 'Enter' && confirmar());
  const m = abrirModal('Pesar produto', [q.bloco], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Adicionar', confirmar)], { largura: 'p' });
}

function escolher(ctx: Ctx, p: Produto, quantidade?: number): void {
  if (p.unidade !== 'un' && quantidade == null) return pedirPeso(ctx, p);
  if (p.unidade === 'un' && quantidade != null && !Number.isInteger(quantidade)) return avisar(`${p.nome} é vendido por unidade.`, 'erro');
  adicionar(ctx, p, quantidade ?? 1);
}

/** "101", "3*101", "0,350*103" ou parte do nome. */
function lerEntrada(ctx: Ctx, texto: string): void {
  const t = texto.trim();
  if (!t) return;
  const m = /^(\d+(?:[.,]\d{1,3})?)\s*[*xX]\s*(\S+)$/.exec(t);
  const qtd = m ? lerNumero(m[1]) : null;
  const codigo = m ? m[2] : t;
  const porCodigo = produtoPorCodigo(ctx.estado, codigo);
  if (porCodigo && porCodigo.tipo !== 'insumo') {
    if (porCodigo.preco == null) return avisar(`${porCodigo.nome} está sem preço.`, 'erro');
    return escolher(ctx, porCodigo, qtd ?? undefined);
  }
  const achados = filtrar(ctx);
  if (achados.length === 1) return escolher(ctx, achados[0], qtd ?? undefined);
  avisar(achados.length === 0 ? `Nenhum produto com "${t}".` : 'Mais de um produto encontrado: clique no certo.', 'erro');
}

function filtrar(ctx: Ctx): Produto[] {
  const s = pdv(ctx);
  const termo = s.busca.trim().toLowerCase();
  return vendaveis(ctx.estado)
    .filter((p) => s.categoria === 'Todas' || p.categoria === s.categoria)
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase() === termo)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
}

function totais(ctx: Ctx) {
  const s = pdv(ctx);
  const subtotal = s.itens.reduce((t, i) => t + valorItem(produtoPorId(ctx.estado, i.produtoId)?.preco ?? 0, i.quantidade), 0);
  const bruto = s.modoDesconto === 'pct' ? Math.round((subtotal * s.desconto) / 100) : s.desconto;
  const desconto = Math.min(bruto, subtotal);
  return { subtotal, desconto, total: subtotal - desconto };
}

const rotuloSaldo = (s: number) => (s > 0 ? `deve ${R(s)}` : s < 0 ? `crédito ${R(-s)}` : 'em dia');

// ---------- Janelas ----------

function janelaDesconto(ctx: Ctx): void {
  const { subtotal } = totais(ctx);
  let modo: 'reais' | 'pct' = 'reais';
  const valor = campoTexto('Desconto', '', { modo: 'decimal', ajuda: `Venda: ${R(subtotal)}` });
  const tipo = campoSelecao('Em', modo, [{ valor: 'reais', texto: 'Reais (R$)' }, { valor: 'pct', texto: 'Porcentagem (%)' }], { aoMudar: (v) => (modo = v) });
  const aplicar = () => {
    const bruto = valor.valor().trim();
    if (!bruto) {
      pdv(ctx).desconto = 0;
      m.fechar();
      return ctx.redesenhar();
    }
    const v = modo === 'reais' ? lerReais(bruto) : (() => { const p = lerNumero(bruto); return p == null || p > 100 ? null : p; })();
    if (v == null) return erroNoModal(m, modo === 'reais' ? 'Valor inválido. Ex.: 2,50' : 'Porcentagem de 0 a 100.');
    if (modo === 'reais' && v > subtotal) return erroNoModal(m, 'Desconto maior que a venda.');
    pdv(ctx).desconto = v;
    pdv(ctx).modoDesconto = modo;
    m.fechar();
    ctx.redesenhar();
  };
  valor.input.addEventListener('keydown', (e) => e.key === 'Enter' && aplicar());
  const m = abrirModal('Desconto na venda', [el('div', { class: 'grade-2' }, valor.bloco, tipo.bloco)], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Aplicar', aplicar)], { largura: 'p' });
}

function janelaPagamento(ctx: Ctx): void {
  const s = pdv(ctx);
  if (s.itens.length === 0) return avisar('Adicione produtos primeiro.', 'erro');
  const { total } = totais(ctx);
  const pagamentos: Pagamento[] = [];
  let forma: FormaPagamento = 'dinheiro';
  let clienteId = '';
  let identificacao = '';
  const temCozinha = s.itens.some((i) => produtoPorId(ctx.estado, i.produtoId)?.preparoNaCozinha);
  const clientes = ctx.estado.clientes.filter((c) => c.ativo);

  const m = abrirModal('Pagamento', [], [], { largura: 'g', testid: 'janela-pagamento' });

  const confirmar = (extra: Pagamento | null) => {
    const lista = extra ? [...pagamentos, extra] : pagamentos;
    let venda: Venda | null = null;
    const erro = ctx.aplicar((e) => {
      const r = registrarVenda(e, { itens: s.itens, desconto: totais(ctx).desconto, pagamentos: lista, clienteId: clienteId || null, identificacao }, ctx.agora());
      venda = r.venda;
      return r.estado;
    });
    if (erro) return erroNoModal(m, erro);
    s.itens = [];
    s.desconto = 0;
    m.fechar();
    ctx.redesenhar();
    janelaConcluida(ctx, venda!);
  };

  const desenhar = () => {
    const { pago, falta, troco } = calcularPagamento(total, pagamentos);
    const valor = campoDinheiro('Valor recebido', falta, { foco: 'pag-valor', ajuda: forma === 'dinheiro' ? 'Digite o que o cliente entregou: o troco sai sozinho.' : undefined });
    const adicionarPagamento = (finalizarSeCobrir: boolean) => {
      const v = valor.ler();
      if (v == null || v <= 0) {
        if (falta === 0 && finalizarSeCobrir) return confirmar(null);
        return erroNoModal(m, 'Digite o valor.');
      }
      const novo = { forma, valor: v };
      if (finalizarSeCobrir && pago + v >= total) return confirmar(novo);
      pagamentos.push(novo);
      desenhar();
    };
    // Mostra o troco/falta enquanto digita, antes de confirmar.
    const previa = el('p', { class: 'previa-troco', 'aria-live': 'polite' });
    const atualizarPrevia = () => {
      const v = valor.ler() ?? 0;
      const soma = pago + v;
      previa.textContent = !valor.input.value.trim() ? '' : soma >= total ? (forma === 'dinheiro' && soma > total ? `Troco: ${R(soma - total)}` : 'Valor completo.') : `Ainda faltará ${R(total - soma)}`;
    };
    valor.input.addEventListener('input', atualizarPrevia);
    atualizarPrevia();
    valor.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        adicionarPagamento(true);
      }
    });
    const precisaCliente = forma === 'fiado' || pagamentos.some((p) => p.forma === 'fiado');
    const cliente = campoSelecao('Cliente do fiado', clienteId, [{ valor: '', texto: 'Escolha o cliente' }, ...clientes.map((c) => ({ valor: c.id, texto: `${c.nome} — ${rotuloSaldo(saldoFiado(ctx.estado, c.id))}${c.limite != null ? ' · limite ' + R(c.limite) : ''}` }))], { aoMudar: (v) => (clienteId = v) });
    const ident = campoTexto('Nome para chamar (cozinha)', identificacao, { max: 40, placeholder: 'Ex.: Carlos ou senha 12' });
    ident.input.addEventListener('input', () => (identificacao = ident.input.value));

    m.trocar([
      el('div', { class: 'pagamento' },
        el('div', { class: 'pagamento-resumo' },
          kpi('Total', R(total)),
          kpi('Recebido', R(pago)),
          troco > 0 ? kpi('Troco', R(troco), null, 'sucesso') : kpi('Falta', R(falta), null, falta > 0 ? 'alerta' : 'sucesso')),
        el('div', { class: 'formas', role: 'radiogroup', 'aria-label': 'Forma de pagamento' },
          ...FORMAS_PAGAMENTO.map((f) => el('button', { type: 'button', role: 'radio', class: 'forma', 'aria-checked': f === forma ? 'true' : 'false', onclick: () => { forma = f; desenhar(); } }, NOME_FORMA[f]))),
        el('div', { class: 'grade-2' }, valor.bloco, el('div', { class: 'campo alinhar-base' }, botao('Adicionar pagamento', () => adicionarPagamento(false), { variante: 'secundario', icone: 'mais' }))),
        previa,
        precisaCliente ? (clientes.length ? cliente.bloco : aviso('Nenhum cliente cadastrado. Cadastre em Clientes e fiado.', 'alerta')) : null,
        temCozinha ? ident.bloco : null,
        pagamentos.length
          ? el('ul', { class: 'lista-pagamentos' }, ...pagamentos.map((p, i) => el('li', {}, el('span', {}, NOME_FORMA[p.forma]), el('strong', {}, R(p.valor)), botaoIcone('lixo', 'Remover pagamento', () => { pagamentos.splice(i, 1); desenhar(); }))))
          : null,
        forma !== 'dinheiro' && forma !== 'fiado' ? el('p', { class: 'ajuda' }, 'Passe na maquininha/Pix antes de confirmar. O sistema não se comunica com a maquininha.') : null),
    ], [
      botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
      botao('Confirmar venda', () => adicionarPagamento(true), { variante: 'sucesso', icone: 'ok', atalho: 'Enter', testid: 'confirmar-venda' }),
    ]);
    valor.input.focus();
    valor.input.select();
  };
  desenhar();
}

function janelaConcluida(ctx: Ctx, v: Venda): void {
  const m = abrirModal(`Venda nº ${v.numero} concluída`, [
    el('div', { class: 'concluida' },
      icone('ok', 48),
      v.troco > 0 ? el('p', { class: 'troco' }, 'Troco: ', el('strong', { 'data-testid': 'troco' }, R(v.troco))) : el('p', { class: 'troco' }, 'Sem troco'),
      el('p', {}, `Total ${R(v.total)} · ${v.pagamentos.map((p) => NOME_FORMA[p.forma]).join(' + ')}`)),
  ], [
    botao('Imprimir comprovante', () => imprimir(comprovante(ctx.estado, v)), { variante: 'secundario', icone: 'imprimir' }),
    el('button', { type: 'button', class: 'botao primario', 'data-autofoco': true, onclick: () => { m.fechar(); document.querySelector<HTMLElement>('[data-foco="pdv-busca"]')?.focus(); } }, 'Nova venda'),
  ], { largura: 'p' });
}

function janelaMovimento(ctx: Ctx, tipo: 'sangria' | 'suprimento'): void {
  const valor = campoDinheiro('Valor', null);
  const obs = campoTexto('Observação', '', { placeholder: tipo === 'sangria' ? 'Ex.: depósito no banco' : 'Ex.: troco extra' });
  const ok = () => {
    const v = valor.ler();
    if (v == null || v <= 0) return erroNoModal(m, 'Digite o valor.');
    aplicarNoModal(ctx, m, (e) => (tipo === 'sangria' ? sangria : suprimento)(e, v, obs.valor(), ctx.agora()), tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado');
  };
  const m = abrirModal(tipo === 'sangria' ? 'Sangria (tirar dinheiro do caixa)' : 'Suprimento (colocar dinheiro no caixa)', [valor.bloco, obs.bloco], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Registrar', ok)], { largura: 'p' });
}

function janelaReceberFiado(ctx: Ctx, clienteInicial = ''): void {
  const devedores = ctx.estado.clientes.filter((c) => saldoFiado(ctx.estado, c.id) > 0);
  if (devedores.length === 0) return avisar('Ninguém está devendo no fiado.');
  const cliente = campoSelecao('Cliente', clienteInicial || devedores[0].id, devedores.map((c) => ({ valor: c.id, texto: `${c.nome} — deve ${R(saldoFiado(ctx.estado, c.id))}` })));
  const valor = campoDinheiro('Valor pago', null);
  const forma = campoSelecao<FormaPagamento>('Pagou com', 'dinheiro', FORMAS_PAGAMENTO.filter((f) => f !== 'fiado').map((f) => ({ valor: f, texto: NOME_FORMA[f] })));
  const ok = () => {
    const v = valor.ler();
    if (v == null || v <= 0) return erroNoModal(m, 'Digite o valor.');
    aplicarNoModal(ctx, m, (e) => receberFiado(e, cliente.valor(), v, forma.valor(), ctx.agora()), 'Pagamento do fiado registrado');
  };
  const m = abrirModal('Receber fiado', [cliente.bloco, el('div', { class: 'grade-2' }, valor.bloco, forma.bloco)], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Receber', ok)], { largura: 'p' });
}
export { janelaReceberFiado };

function janelaFechar(ctx: Ctx): void {
  const s = caixaAberto(ctx.estado)!;
  const r = resumoSessao(ctx.estado, s);
  const contado = campoDinheiro('Dinheiro contado na gaveta', null, { ajuda: 'Conte as notas e moedas e digite o total.' });
  const dif = el('p', { class: 'diferenca', 'aria-live': 'polite' });
  const atualizar = () => {
    const c = contado.ler();
    if (c == null) return (dif.textContent = '');
    const d = c - r.dinheiroEsperado;
    dif.className = 'diferenca ' + (d === 0 ? 'ok' : 'erro');
    dif.textContent = d === 0 ? 'Bateu certinho.' : d > 0 ? `Sobrando ${R(d)}` : `Faltando ${R(-d)}`;
  };
  contado.input.addEventListener('input', atualizar);
  const linha = (a: string, b: string, forte = false) => el('tr', { class: forte ? 'forte' : '' }, el('td', {}, a), el('td', { class: 'num' }, b));
  const ok = () => {
    const c = contado.ler();
    if (c == null) return erroNoModal(m, 'Digite quanto tem na gaveta.');
    if (aplicarNoModal(ctx, m, (e) => fecharCaixa(e, c, ctx.agora()), 'Caixa fechado')) {
      const fechado = ctx.estado.caixas.find((x) => x.id === s.id)!;
      const fim = abrirModal('Caixa fechado', [relatorioFechamento(ctx.estado, fechado)], [botao('Imprimir', () => imprimir(relatorioFechamento(ctx.estado, fechado)), { variante: 'secundario', icone: 'imprimir' }), botao('Concluir', () => fim.fechar())], { largura: 'p' });
    }
  };
  const m = abrirModal(`Fechar caixa nº ${s.numero}`, [
    el('table', { class: 'tabela compacta' }, el('tbody', {},
      linha('Vendas', `${r.vendas} (${r.canceladas} canceladas)`),
      linha('Total vendido', R(r.total), true),
      ...FORMAS_PAGAMENTO.map((f) => linha(NOME_FORMA[f], R(r.porForma[f]))),
      linha('Troco inicial', R(s.valorInicial)),
      linha('Suprimentos', R(r.suprimentos)),
      linha('Sangrias', '− ' + R(r.sangrias)),
      linha('Fiado recebido em dinheiro', R(r.recebimentos.dinheiro)),
      linha('Dinheiro esperado na gaveta', R(r.dinheiroEsperado), true))),
    contado.bloco,
    dif,
  ], [botao('Voltar', () => m.fechar(), { variante: 'secundario' }), botao('Fechar caixa', ok, { variante: 'perigo' })]);
}

// ---------- Tela ----------

function telaAbertura(ctx: Ctx): Node[] {
  const ultimo = ctx.estado.caixas.at(-1);
  const operador = campoTexto('Quem está no caixa?', ultimo?.operador ?? '', { max: 40, foco: 'abrir-operador' });
  const troco = campoDinheiro('Troco inicial na gaveta', 10000, { foco: 'abrir-troco' });
  const abrir = (e: Event) => {
    e.preventDefault();
    const v = troco.ler();
    if (v == null) return avisar('Troco inicial inválido.', 'erro');
    ctx.mudar((est) => abrirCaixa(est, operador.valor(), v, ctx.agora()), 'Caixa aberto. Boas vendas!');
  };
  return [
    cabecalhoPagina('Caixa', 'O caixa está fechado.'),
    el('div', { class: 'grade-2 topo' },
      cartao('Abrir caixa',
        el('form', { class: 'form', onsubmit: abrir }, operador.bloco, troco.bloco, botao('Abrir caixa', () => {}, { tipo: 'submit', icone: 'caixa', grande: true }))),
      ultimo
        ? cartao(`Último caixa (nº ${ultimo.numero})`, relatorioFechamento(ctx.estado, ultimo), botao('Imprimir', () => imprimir(relatorioFechamento(ctx.estado, ultimo)), { variante: 'secundario', icone: 'imprimir' }))
        : cartao('Primeira vez?', el('p', {}, 'Abra o caixa com o dinheiro de troco que está na gaveta. Ao fim do dia, feche o caixa e confira o dinheiro.'))),
  ];
}

export function caixa(ctx: Ctx): Node[] {
  ctxAtual = ctx;
  const sessao = caixaAberto(ctx.estado);
  if (!sessao) return telaAbertura(ctx);
  const s = pdv(ctx);
  // Remove do carrinho produto que deixou de ser vendável (editado em outra aba).
  s.itens = s.itens.filter((i) => vendaveis(ctx.estado).some((p) => p.id === i.produtoId));
  if (s.itens.length === 0) s.desconto = 0; // desconto não passa para o próximo cliente
  const { subtotal, desconto, total } = totais(ctx);
  const categorias = ['Todas', ...new Set(vendaveis(ctx.estado).map((p) => p.categoria))];
  const produtos = filtrar(ctx);
  const r = resumoSessao(ctx.estado, sessao);

  const entrada = busca(s.busca, (v) => {
    s.busca = v;
    ctx.redesenhar();
  }, { placeholder: 'Código ou nome do produto (ex.: 101 ou 3*101) e Enter', foco: 'pdv-busca' });
  entrada.querySelector('input')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lerEntrada(ctx, (e.target as HTMLInputElement).value);
    }
  });

  return [
    el('div', { class: 'pdv-topo' },
      el('div', {},
        el('h1', {}, `Caixa nº ${sessao.numero}`),
        el('p', { class: 'subtitulo' }, `${sessao.operador} · aberto às ${horaCurta(sessao.abertaEm)} · ${r.vendas} vendas · ${R(r.total)}`)),
      el('div', { class: 'acoes' },
        botao('Receber fiado', () => janelaReceberFiado(ctx), { variante: 'secundario', icone: 'clientes' }),
        botao('Sangria', () => janelaMovimento(ctx, 'sangria'), { variante: 'secundario', icone: 'subir' }),
        botao('Suprimento', () => janelaMovimento(ctx, 'suprimento'), { variante: 'secundario', icone: 'baixar' }),
        botao('Fechar caixa', () => janelaFechar(ctx), { variante: 'perigo' }))),
    el('div', { class: 'pdv' },
      el('section', { class: 'pdv-produtos', 'aria-label': 'Produtos' },
        entrada,
        el('div', { class: 'chips' }, ...categorias.map((c) => el('button', { type: 'button', class: 'chip', 'aria-pressed': c === s.categoria ? 'true' : 'false', onclick: () => { s.categoria = c; ctx.redesenhar(); } }, c))),
        produtos.length
          ? el('div', { class: 'grade-produtos' }, ...produtos.map((p) => {
            const semEstoque = p.controlaEstoque && p.estoque <= 0;
            return el('button', { type: 'button', class: 'produto' + (semEstoque ? ' sem-estoque' : ''), onclick: () => escolher(ctx, p), 'data-testid': 'produto-' + p.codigo },
              el('span', { class: 'produto-codigo' }, p.codigo),
              el('span', { class: 'produto-nome' }, p.nome),
              el('span', { class: 'produto-preco' }, R(p.preco ?? 0) + (p.unidade !== 'un' ? '/' + p.unidade : '')),
              p.controlaEstoque ? el('span', { class: 'produto-estoque' }, semEstoque ? 'sem estoque' : formatarQuantidade(p.estoque, p.unidade)) : el('span', { class: 'produto-estoque' }, 'feito na hora'));
          }))
          : el('p', { class: 'vazio' }, 'Nenhum produto encontrado.')),
      el('section', { class: 'pdv-venda', 'aria-label': 'Venda atual' },
        el('h2', { class: 'titulo-cartao' }, 'Venda atual'),
        s.itens.length === 0
          ? el('p', { class: 'vazio' }, 'Passe os produtos: digite o código ou clique no produto.')
          : el('ul', { class: 'itens-venda' }, ...s.itens.map((i, idx) => {
            const p = produtoPorId(ctx.estado, i.produtoId)!;
            const faltando = p.controlaEstoque && p.estoque < i.quantidade;
            return el('li', { class: 'item-venda', 'data-testid': 'item-venda' },
              el('div', { class: 'item-nome' }, el('strong', {}, p.nome), el('span', { class: 'ajuda' }, `${R(p.preco ?? 0)}${p.unidade !== 'un' ? '/' + p.unidade : ''}`, faltando ? ' · ' : '', faltando ? etiqueta('estoque insuficiente', 'alerta') : null)),
              el('div', { class: 'item-qtd' },
                p.unidade === 'un' ? botaoIcone('menos', 'Diminuir', () => { i.quantidade -= 1; if (i.quantidade <= 0) s.itens.splice(idx, 1); ctx.redesenhar(); }) : null,
                el('span', { class: 'qtd' }, formatarQuantidade(i.quantidade, p.unidade === 'un' ? '' : p.unidade)),
                p.unidade === 'un' ? botaoIcone('mais', 'Aumentar', () => { i.quantidade += 1; ctx.redesenhar(); }) : null),
              el('strong', { class: 'item-total' }, R(valorItem(p.preco ?? 0, i.quantidade))),
              botaoIcone('lixo', 'Tirar da venda', () => { s.itens.splice(idx, 1); ctx.redesenhar(); }));
          })),
        el('div', { class: 'pdv-totais' },
          el('div', { class: 'linha-total' }, el('span', {}, 'Subtotal'), el('span', {}, R(subtotal))),
          el('div', { class: 'linha-total' }, el('button', { type: 'button', class: 'link', onclick: () => janelaDesconto(ctx), disabled: s.itens.length === 0 }, desconto ? 'Desconto (alterar)' : '+ Dar desconto'), el('span', {}, desconto ? `− ${R(desconto)}${s.modoDesconto === 'pct' ? ` (${String(s.desconto).replace('.', ',')}%)` : ''}` : '')),
          el('div', { class: 'linha-total grande' }, el('span', {}, 'Total'), el('strong', { 'data-testid': 'total-venda' }, R(total)))),
        el('div', { class: 'pdv-acoes' },
          botao('Limpar', () => { s.itens = []; s.desconto = 0; ctx.redesenhar(); }, { variante: 'secundario', desabilitado: s.itens.length === 0 }),
          botao('Finalizar venda', () => janelaPagamento(ctx), { variante: 'sucesso', grande: true, atalho: 'F2', desabilitado: s.itens.length === 0, testid: 'finalizar' })))),
  ];
}

// Atalhos de teclado do caixa (F2 finaliza). Ficam ativos só nesta tela e sem janela aberta.
document.addEventListener('keydown', (e) => {
  if (!ctxAtual || location.hash.replace(/^#/, '') !== '/caixa' || modalAberto()) return;
  if (e.key === 'F2') {
    e.preventDefault();
    if (caixaAberto(ctxAtual.estado)) janelaPagamento(ctxAtual);
  }
});
