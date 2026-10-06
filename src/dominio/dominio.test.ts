import { describe, expect, it } from 'vitest';
import { carregar, CHAVE, CHAVE_V1, salvar, type Armazem } from '../armazenamento';
import { codificarCardapio, decodificarCardapio, linkPedidoWhatsApp, numeroWhatsApp } from '../cardapioLink';
import { formatarReais, lerReais } from '../dinheiro';
import { abrirCaixa, avancarPedido, caixaAberto, calcularPagamento, cancelarVenda, fecharCaixa, receberFiado, registrarVenda, resumoSessao, saldoFiado, salvarCliente, sangria, suprimento, voltarPedido } from './caixa';
import { abaixoDoMinimo, ajustarEstoque, concluirOrdem, criarOrdem, custoUnitario, entradaEstoque, margem, necessidadeDaOrdem, novoProduto, registrarFornada, registrarPerda, removerProduto, salvarFicha, salvarProduto } from './catalogo';
import { baixarConta, fluxoDeCaixa, painel, relatorioVendas, salvarConta, situacaoConta } from './financeiro';
import { dadosDemonstracao, estadoVazio, migrarV1 } from './inicial';
import type { Estado, Produto } from './tipos';
import { chaveDoDia, novoId } from './util';
import { validarEstado } from './validacao';

const AGORA = new Date(2026, 9, 6, 10, 0); // 06/10/2026 10:00 local
const depois = (min: number) => new Date(AGORA.getTime() + min * 60_000);

/** Loja mínima: polvilho e queijo (insumos), pão de queijo (fabricado, ficha 100 un), Toddynho (revenda) e misto (feito na hora). */
function loja() {
  let e = estadoVazio();
  const polvilho = novoProduto({ codigo: 'I1', nome: 'Polvilho', tipo: 'insumo', unidade: 'kg', custo: 1000 });
  const queijo = novoProduto({ codigo: 'I2', nome: 'Queijo', tipo: 'insumo', unidade: 'kg', custo: 4000 });
  const pdq = novoProduto({ codigo: '101', nome: 'Pão de queijo', categoria: 'Pão de queijo', preco: 250, estoqueMinimo: 20 });
  const toddy = novoProduto({ codigo: '501', nome: 'Toddynho', categoria: 'Bebidas', tipo: 'revenda', preco: 450, custo: 280 });
  const misto = novoProduto({ codigo: '301', nome: 'Misto', categoria: 'Lanches', preco: 900, controlaEstoque: false, preparoNaCozinha: true });
  for (const p of [polvilho, queijo, pdq, toddy, misto]) e = salvarProduto(e, p);
  e = salvarFicha(e, pdq.id, 100, [{ insumoId: polvilho.id, quantidade: 2 }, { insumoId: queijo.id, quantidade: 1 }]);
  e = salvarFicha(e, misto.id, 1, [{ insumoId: queijo.id, quantidade: 0.05 }]);
  e = entradaEstoque(e, { produtoId: polvilho.id, quantidade: 10, custoUnit: 1000, obs: '', contaVencimento: null }, AGORA);
  e = entradaEstoque(e, { produtoId: queijo.id, quantidade: 5, custoUnit: 4000, obs: '', contaVencimento: null }, AGORA);
  e = entradaEstoque(e, { produtoId: toddy.id, quantidade: 12, custoUnit: 280, obs: '', contaVencimento: null }, AGORA);
  return { e, polvilho, queijo, pdq, toddy, misto };
}

const est = (e: Estado, p: Produto) => e.produtos.find((x) => x.id === p.id)!.estoque;

describe('dinheiro', () => {
  it('formata e lê reais em centavos', () => {
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
    expect(lerReais('12,5')).toBe(1250);
    expect(lerReais('R$ 1.234,56')).toBe(123456);
    expect(lerReais('abc')).toBeNull();
  });
});

describe('produtos e estoque', () => {
  it('não aceita código repetido nem nome vazio', () => {
    const { e } = loja();
    expect(() => salvarProduto(e, novoProduto({ codigo: '101', nome: 'Outro', categoria: 'X' }))).toThrow(/código 101/);
    expect(() => salvarProduto(e, novoProduto({ nome: '  ', categoria: 'X' }))).toThrow(/nome/);
  });

  it('cadastro não mexe no saldo; só movimento mexe', () => {
    const { e, toddy } = loja();
    const editado = salvarProduto(e, { ...e.produtos.find((p) => p.id === toddy.id)!, estoque: 999, nome: 'Toddynho 200ml' });
    expect(est(editado, toddy)).toBe(12);
  });

  it('entrada atualiza custo e pode lançar conta a pagar', () => {
    const { e, toddy } = loja();
    const n = entradaEstoque(e, { produtoId: toddy.id, quantidade: 24, custoUnit: 300, obs: 'NF 123', contaVencimento: '2026-10-20' }, AGORA);
    expect(est(n, toddy)).toBe(36);
    expect(n.produtos.find((p) => p.id === toddy.id)!.custo).toBe(300);
    expect(n.contas.at(-1)).toMatchObject({ tipo: 'pagar', valor: 7200, vencimento: '2026-10-20' });
  });

  it('fabricado não entra por compra', () => {
    const { e, pdq } = loja();
    expect(() => entradaEstoque(e, { produtoId: pdq.id, quantidade: 1, custoUnit: null, obs: '', contaVencimento: null }, AGORA)).toThrow(/produção/);
  });

  it('perda e ajuste de contagem registram movimento com saldo', () => {
    const { e, polvilho } = loja();
    let n = registrarPerda(e, polvilho.id, 0.5, 'Molhou', AGORA);
    n = ajustarEstoque(n, polvilho.id, 9, AGORA);
    expect(est(n, polvilho)).toBe(9);
    expect(n.movimentos.slice(-2).map((m) => [m.tipo, m.quantidade, m.saldo])).toEqual([['perda', -0.5, 9.5], ['ajuste', -0.5, 9]]);
  });

  it('unidade "un" exige número inteiro', () => {
    const { e, toddy } = loja();
    expect(() => registrarPerda(e, toddy.id, 1.5, 'x', AGORA)).toThrow(/inteiro/);
  });

  it('produto com histórico é desativado em vez de apagado', () => {
    const { e, toddy } = loja();
    const n = removerProduto(e, toddy.id);
    expect(n.produtos.find((p) => p.id === toddy.id)?.ativo).toBe(false);
  });
});

describe('ficha técnica e produção', () => {
  it('custo e margem saem da ficha', () => {
    const { e, pdq } = loja();
    const p = e.produtos.find((x) => x.id === pdq.id)!;
    expect(custoUnitario(e, p)).toBe(60); // (2×10,00 + 1×40,00) / 100
    expect(margem(e, p)).toBeCloseTo(0.76);
  });

  it('concluir ordem dá entrada no produto e baixa insumos na proporção', () => {
    const { e, pdq, polvilho, queijo } = loja();
    let n = criarOrdem(e, pdq.id, 100, AGORA);
    expect(necessidadeDaOrdem(n, pdq.id, 100).map((x) => x.precisa)).toEqual([2, 1]);
    n = concluirOrdem(n, n.ordens[0].id, depois(60), 150); // rendeu mais que o planejado
    expect(est(n, pdq)).toBe(150);
    expect(est(n, polvilho)).toBe(7);
    expect(est(n, queijo)).toBe(3.5);
    expect(() => concluirOrdem(n, n.ordens[0].id, depois(61))).toThrow(/encerrada/);
  });

  it('"saiu uma fornada" usa o rendimento da ficha', () => {
    const { e, pdq } = loja();
    const n = registrarFornada(e, pdq.id, AGORA);
    expect(est(n, pdq)).toBe(100);
    expect(n.ordens[0]).toMatchObject({ status: 'concluida', obs: 'Fornada' });
  });

  it('produto feito na hora não entra em ordem de produção', () => {
    const { e, misto } = loja();
    expect(() => criarOrdem(e, misto.id, 1, AGORA)).toThrow(/feito na hora/);
  });

  it('ficha só aceita insumo e sem repetir', () => {
    const { e, pdq, toddy, polvilho } = loja();
    expect(() => salvarFicha(e, pdq.id, 10, [{ insumoId: toddy.id, quantidade: 1 }])).toThrow(/não é insumo/);
    expect(() => salvarFicha(e, pdq.id, 10, [{ insumoId: polvilho.id, quantidade: 1 }, { insumoId: polvilho.id, quantidade: 1 }])).toThrow(/duas vezes/);
  });

  it('alerta de estoque mínimo', () => {
    const { e, pdq } = loja();
    expect(abaixoDoMinimo(e).map((p) => p.id)).toContain(pdq.id);
    expect(abaixoDoMinimo(registrarFornada(e, pdq.id, AGORA)).map((p) => p.id)).not.toContain(pdq.id);
  });
});

describe('caixa', () => {
  function comCaixa() {
    const l = loja();
    const e = abrirCaixa(registrarFornada(l.e, l.pdq.id, AGORA), 'Thiago', 10000, AGORA);
    return { ...l, e };
  }

  it('não vende com caixa fechado e não abre dois caixas', () => {
    const { e, pdq } = loja();
    expect(() => registrarVenda(e, { itens: [{ produtoId: pdq.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 250 }], clienteId: null }, AGORA)).toThrow(/Abra o caixa/);
    const a = abrirCaixa(e, 'Thiago', 0, AGORA);
    expect(() => abrirCaixa(a, 'Outro', 0, AGORA)).toThrow(/aberto/);
  });

  it('venda com troco baixa estoque e numera em sequência', () => {
    const { e, pdq, toddy } = comCaixa();
    const { estado, venda } = registrarVenda(e, { itens: [{ produtoId: pdq.id, quantidade: 4 }, { produtoId: toddy.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'dinheiro', valor: 2000 }], clienteId: null }, depois(5));
    expect(venda).toMatchObject({ numero: 1, subtotal: 1450, total: 1450, troco: 550 });
    expect(est(estado, pdq)).toBe(96);
    expect(est(estado, toddy)).toBe(11);
    const r = resumoSessao(estado, caixaAberto(estado)!);
    expect(r.porForma.dinheiro).toBe(1450);
    expect(r.dinheiroEsperado).toBe(11450);
  });

  it('pagamento dividido e desconto', () => {
    const { e, pdq } = comCaixa();
    const { venda } = registrarVenda(e, { itens: [{ produtoId: pdq.id, quantidade: 10 }], desconto: 500, pagamentos: [{ forma: 'pix', valor: 1000 }, { forma: 'debito', valor: 1000 }], clienteId: null }, depois(5));
    expect(venda.total).toBe(2000);
    expect(calcularPagamento(2000, [{ forma: 'pix', valor: 1500 }])).toEqual({ pago: 1500, falta: 500, troco: 0 });
  });

  it('recusa pagamento a menor, troco de cartão e desconto maior que a venda', () => {
    const { e, pdq } = comCaixa();
    const venda = (pagamentos: { forma: 'pix' | 'credito' | 'dinheiro'; valor: number }[], desconto = 0) => () =>
      registrarVenda(e, { itens: [{ produtoId: pdq.id, quantidade: 2 }], desconto, pagamentos, clienteId: null }, depois(5));
    expect(venda([{ forma: 'pix', valor: 400 }])).toThrow(/não cobre/);
    expect(venda([{ forma: 'credito', valor: 1000 }])).toThrow(/Troco só sai/);
    expect(venda([{ forma: 'dinheiro', valor: 500 }], 600)).toThrow(/Desconto/);
  });

  it('produto feito na hora baixa os ingredientes e vai para a cozinha', () => {
    const { e, misto, queijo } = comCaixa();
    const antes = est(e, queijo);
    const { estado } = registrarVenda(e, { itens: [{ produtoId: misto.id, quantidade: 2 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 1800 }], clienteId: null, identificacao: 'Carlos' }, depois(5));
    expect(est(estado, queijo)).toBeCloseTo(antes - 0.1);
    expect(estado.pedidos.at(-1)).toMatchObject({ origem: 'caixa', identificacao: 'Carlos', status: 'novo', itens: [{ nome: 'Misto', quantidade: 2 }] });
  });

  it('fiado respeita limite, entra no saldo e é recebido no caixa', () => {
    const { e, pdq } = comCaixa();
    const id = novoId();
    let n = salvarCliente(e, { id, nome: 'Dona Maria', telefone: '(69) 99999-0000', limite: 1000, ativo: true });
    expect(n.clientes[0].telefone).toBe('69999990000');
    const fiado = (q: number) => registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: q }], desconto: 0, pagamentos: [{ forma: 'fiado', valor: q * 250 }], clienteId: id }, depois(5));
    expect(() => fiado(5)).toThrow(/limite/);
    n = fiado(4).estado;
    expect(saldoFiado(n, id)).toBe(1000);
    expect(() => registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'fiado', valor: 250 }], clienteId: null }, depois(6))).toThrow(/cliente/);
    n = receberFiado(n, id, 600, 'dinheiro', depois(10));
    expect(saldoFiado(n, id)).toBe(400);
    expect(resumoSessao(n, caixaAberto(n)!).dinheiroEsperado).toBe(10600);
    expect(() => receberFiado(n, id, 500, 'pix', depois(11))).toThrow(/deve só/);
  });

  it('cancelar venda devolve estoque, estorna fiado e cancela o pedido da cozinha', () => {
    const { e, pdq, misto } = comCaixa();
    const id = novoId();
    let n = salvarCliente(e, { id, nome: 'Zé', telefone: '', limite: null, ativo: true });
    const r = registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: 3 }, { produtoId: misto.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'fiado', valor: 1650 }], clienteId: id }, depois(5));
    n = cancelarVenda(r.estado, r.venda.id, 'Cliente desistiu', depois(6));
    expect(est(n, pdq)).toBe(100);
    expect(saldoFiado(n, id)).toBe(0);
    expect(n.pedidos.at(-1)!.status).toBe('cancelado');
    expect(resumoSessao(n, caixaAberto(n)!)).toMatchObject({ vendas: 0, canceladas: 1, total: 0 });
    expect(() => cancelarVenda(n, r.venda.id, 'de novo', depois(7))).toThrow(/já está cancelada/);
  });

  it('sangria não passa do dinheiro da gaveta; fechamento guarda o contado', () => {
    const { e } = comCaixa();
    expect(() => sangria(e, 20000, '', depois(1))).toThrow(/Não há/);
    let n = suprimento(e, 5000, 'Troco', depois(1));
    n = sangria(n, 12000, 'Depósito', depois(2));
    expect(resumoSessao(n, caixaAberto(n)!).dinheiroEsperado).toBe(3000);
    n = fecharCaixa(n, 2900, depois(3));
    expect(caixaAberto(n)).toBeUndefined();
    expect(n.caixas[0].contado).toBe(2900);
  });

  it('não cancela venda de caixa já fechado', () => {
    const { e, pdq } = comCaixa();
    const r = registrarVenda(e, { itens: [{ produtoId: pdq.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 250 }], clienteId: null }, depois(5));
    const fechado = fecharCaixa(r.estado, 10000, depois(6));
    expect(() => cancelarVenda(fechado, r.venda.id, 'x', depois(7))).toThrow(/aberto/);
  });
});

describe('cozinha', () => {
  it('pedido anda novo → preparando → pronto → entregue e pode voltar um passo', () => {
    const { e, misto } = loja();
    let n = abrirCaixa(e, 'T', 0, AGORA);
    n = registrarVenda(n, { itens: [{ produtoId: misto.id, quantidade: 1 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 900 }], clienteId: null }, AGORA).estado;
    const id = n.pedidos[0].id;
    n = avancarPedido(n, id, depois(1));
    n = avancarPedido(n, id, depois(2));
    expect(n.pedidos[0].status).toBe('pronto');
    n = voltarPedido(n, id, depois(3));
    expect(n.pedidos[0].status).toBe('preparando');
    n = avancarPedido(avancarPedido(n, id, depois(4)), id, depois(5));
    expect(n.pedidos[0].status).toBe('entregue');
    expect(() => avancarPedido(n, id, depois(6))).toThrow(/encerrado/);
  });
});

describe('financeiro e relatórios', () => {
  it('situação das contas e baixa', () => {
    let e = estadoVazio();
    e = salvarConta(e, { id: 'c1', tipo: 'pagar', descricao: 'Energia', categoria: 'Energia', valor: 50000, vencimento: '2026-10-05', pagaEm: null });
    expect(situacaoConta(e.contas[0], '2026-10-06')).toBe('vencida');
    e = baixarConta(e, 'c1', AGORA);
    expect(situacaoConta(e.contas[0], '2026-10-06')).toBe('paga');
    expect(() => baixarConta(e, 'c1', AGORA)).toThrow(/já foi/);
    expect(fluxoDeCaixa(e, '2026-10-01', '2026-10-31')).toMatchObject({ entradas: 0, saidas: 50000, saldo: -50000 });
  });

  it('relatório soma vendas, ticket médio, produtos e lucro estimado', () => {
    const { e, pdq, toddy } = loja();
    let n = abrirCaixa(registrarFornada(e, pdq.id, AGORA), 'T', 0, AGORA);
    n = registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: 4 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 1000 }], clienteId: null }, depois(1)).estado;
    n = registrarVenda(n, { itens: [{ produtoId: toddy.id, quantidade: 2 }], desconto: 0, pagamentos: [{ forma: 'dinheiro', valor: 1000 }], clienteId: null }, depois(2)).estado;
    const dia = chaveDoDia(AGORA);
    const r = relatorioVendas(n, dia, dia);
    expect(r).toMatchObject({ total: 1900, quantidade: 2, ticketMedio: 950 });
    expect(r.porForma).toMatchObject({ pix: 1000, dinheiro: 900 });
    expect(r.porProduto[0].nome).toBe('Pão de queijo');
    expect(r.lucroBrutoEstimado).toBe(1900 - (4 * 60 + 2 * 280));
    expect(painel(n, depois(3))).toMatchObject({ vendasHoje: 1900, quantidadeHoje: 2 });
  });
});

describe('dados de demonstração, validação e armazenamento', () => {
  it('demonstração é válida, determinística e tem uma semana de movimento', () => {
    const a = dadosDemonstracao(AGORA);
    expect(() => validarEstado(JSON.parse(JSON.stringify(a)))).not.toThrow();
    expect(a.config.demonstracao).toBe(true);
    expect(a.caixas.length).toBe(6);
    expect(caixaAberto(a)).toBeUndefined();
    expect(a.vendas.length).toBeGreaterThan(150);
    expect(dadosDemonstracao(AGORA).vendas.length).toBe(a.vendas.length);
    expect(JSON.stringify(a).length).toBeLessThan(1_500_000);
    expect(abaixoDoMinimo(a).length).toBeGreaterThan(0);
  });

  it('validação recusa dado adulterado', () => {
    const a = JSON.parse(JSON.stringify(estadoVazio()));
    expect(() => validarEstado({ ...a, versao: 1 })).toThrow(/versão/);
    expect(() => validarEstado({ ...a, produtos: [{ id: 'x', nome: 1 }] })).toThrow(/Dados inválidos/);
    const comVenda = { ...a, vendas: [{ id: 'v', sessaoId: 'nao-existe' }] };
    expect(() => validarEstado(comVenda)).toThrow(/Dados inválidos/);
  });

  it('armazenamento: primeira vez = demonstração; migra o protótipo v1; guarda cópia de dado corrompido', () => {
    const mem = new Map<string, string>();
    const armazem: Armazem = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
    expect(carregar(armazem, AGORA).estado.config.demonstracao).toBe(true);

    mem.set(CHAVE_V1, JSON.stringify({ versao: 1, fornadas: {}, cardapio: [{ id: 'a', categoria: 'Bebidas', nome: 'Toddynho', preco: 450 }], estoque: { ingredientes: [{ id: 'b', nome: 'Polvilho', quantidade: '2 sacos' }], revenda: [] }, clientes: [{ id: 'c', nome: 'Cliente A', lancamentos: [{ id: 'l', valor: 1200, quando: AGORA.toISOString() }], ultimoPagamento: null }] }));
    const migrado = carregar(armazem, AGORA);
    expect(migrado.aviso).toBe('migrado-v1');
    expect(migrado.estado.produtos.map((p) => [p.nome, p.tipo])).toEqual([['Toddynho', 'revenda'], ['Polvilho', 'insumo']]);
    expect(saldoFiado(migrado.estado, migrado.estado.clientes[0].id)).toBe(1200);
    expect(migrarV1).toBeTypeOf('function');

    expect(salvar(armazem, migrado.estado)).toBe(true);
    expect(carregar(armazem, AGORA).aviso).toBeNull();
    mem.set(CHAVE, '{quebrado');
    const r = carregar(armazem, AGORA);
    expect(r.aviso).toBe('dados-corrompidos');
    expect([...mem.keys()].some((k) => k.startsWith(CHAVE + ':corrompido:'))).toBe(true);
  });
});

describe('cardápio público (link do QR)', () => {
  const cardapio = { loja: 'Casa do Pão de Queijo', whatsapp: '69999990000', itens: [{ categoria: 'Pão de queijo', nome: 'Pão de queijo', preco: 250 }, { categoria: 'Bebidas', nome: 'Café <b>', preco: null }] };

  it('ida e volta', () => {
    expect(decodificarCardapio(codificarCardapio(cardapio))).toEqual(cardapio);
  });

  it('aceita o QR antigo (v1) e recusa link adulterado', () => {
    // Mesmo algoritmo do protótipo v1: JSON → bytes UTF-8 → base64url.
    const bytes = new TextEncoder().encode(JSON.stringify([[0, 'Pão de queijo', 300]]));
    const v1 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodificarCardapio(v1)?.itens[0]).toEqual({ categoria: 'Pão de queijo', nome: 'Pão de queijo', preco: 300 });
    expect(decodificarCardapio('isso-nao-e-um-cardapio')).toBeNull();
    const ruim = btoa(JSON.stringify({ v: 2, l: 'X', w: 'abc', c: ['A'], i: [] }));
    expect(decodificarCardapio(ruim)).toBeNull();
  });

  it('monta o pedido do WhatsApp com número brasileiro', () => {
    expect(numeroWhatsApp('(69) 99999-0000')).toBe('5569999990000');
    expect(numeroWhatsApp('123')).toBeNull();
    const link = linkPedidoWhatsApp('69999990000', 'Casa', [{ nome: 'Pão de queijo', preco: 250, quantidade: 4 }], 'Ana', '')!;
    expect(link.startsWith('https://wa.me/5569999990000?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toContain('4x Pão de queijo — R$ 10,00');
    expect(decodeURIComponent(link.split('text=')[1])).toContain('Total: R$ 10,00');
  });
});

describe('regressões da revisão independente', () => {
  it('excluir produto com ordem de produção só desativa (dados continuam válidos)', () => {
    const { e, pdq } = loja();
    const n = removerProduto(criarOrdem(e, pdq.id, 10, AGORA), pdq.id);
    expect(n.produtos.find((p) => p.id === pdq.id)?.ativo).toBe(false);
    expect(() => validarEstado(JSON.parse(JSON.stringify(n)))).not.toThrow();
  });

  it('cancelar devolve exatamente o que a venda tirou, mesmo se o cadastro mudou', () => {
    const { e, pdq } = loja();
    let n = abrirCaixa(registrarFornada(e, pdq.id, AGORA), 'T', 0, AGORA);
    const r = registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: 5 }], desconto: 0, pagamentos: [{ forma: 'pix', valor: 1250 }], clienteId: null }, AGORA);
    n = salvarProduto(r.estado, { ...r.estado.produtos.find((p) => p.id === pdq.id)!, controlaEstoque: false });
    n = cancelarVenda(n, r.venda.id, 'teste', AGORA);
    expect(est(n, pdq)).toBe(100);
  });

  it('fiado pago e depois cancelado vira crédito, sem abater a dívida de outros', () => {
    const { e, pdq } = loja();
    const id = novoId();
    let n = salvarCliente(abrirCaixa(registrarFornada(e, pdq.id, AGORA), 'T', 0, AGORA), { id, nome: 'Ana', telefone: '', limite: null, ativo: true });
    const r = registrarVenda(n, { itens: [{ produtoId: pdq.id, quantidade: 2 }], desconto: 0, pagamentos: [{ forma: 'fiado', valor: 500 }], clienteId: id }, AGORA);
    n = cancelarVenda(receberFiado(r.estado, id, 500, 'pix', AGORA), r.venda.id, 'x', AGORA);
    expect(saldoFiado(n, id)).toBe(-500);
    expect(painel(n, AGORA).fiadoTotal).toBe(0);
  });

  it('descrição de conta gerada na entrada respeita o limite de 80 letras', () => {
    const { e } = loja();
    let n = salvarProduto(e, novoProduto({ nome: 'X'.repeat(78), tipo: 'insumo', unidade: 'kg' }));
    const p = n.produtos.at(-1)!;
    n = entradaEstoque(n, { produtoId: p.id, quantidade: 10, custoUnit: 100, obs: '', contaVencimento: '2026-10-20' }, AGORA);
    expect(() => validarEstado(JSON.parse(JSON.stringify(n)))).not.toThrow();
  });
});
