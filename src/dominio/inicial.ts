// Estado vazio, dados de demonstração (fictícios) e migração do protótipo v1.

import { abrirCaixa, fecharCaixa, registrarVenda, resumoSessao } from './caixa';
import { concluirOrdem, criarOrdem, novoProduto, registrarPerda, salvarFicha } from './catalogo';
import type { Cliente, Conta, Estado, FormaPagamento, Produto, TipoProduto, Unidade } from './tipos';
import { VERSAO } from './tipos';
import { chaveDoDia, novoId, somarDias } from './util';

export const CATEGORIAS_PADRAO = ['Pão de queijo', 'Salgados', 'Lanches', 'Doces', 'Bebidas', 'Cafés'];
export const CATEGORIAS_CONTA = ['Fornecedores', 'Aluguel', 'Energia', 'Água', 'Funcionários', 'Impostos', 'Manutenção', 'Encomendas', 'Outros'];

export function estadoVazio(): Estado {
  return {
    versao: VERSAO,
    config: { nomeLoja: 'Casa do Pão de Queijo', whatsapp: '', endereco: '', categorias: [...CATEGORIAS_PADRAO], categoriasConta: [...CATEGORIAS_CONTA], demonstracao: false },
    produtos: [],
    fichas: [],
    movimentos: [],
    ordens: [],
    caixas: [],
    vendas: [],
    pedidos: [],
    clientes: [],
    fiado: [],
    contas: [],
    seq: { venda: 0, pedido: 0, ordem: 0, caixa: 0 },
  };
}

/** Gerador pseudoaleatório com semente: a demonstração sai igual toda vez. */
function sorteio(semente: number) {
  let s = semente >>> 0;
  const prox = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return { prox, entre: (a: number, b: number) => a + Math.floor(prox() * (b - a + 1)), um: <T,>(lista: readonly T[]) => lista[Math.floor(prox() * lista.length)] };
}

type Def = [codigo: string, nome: string, categoria: string, tipo: TipoProduto, unidade: Unidade, preco: number | null, custo: number | null, estoque: number, minimo: number, extras?: Partial<Produto>];

const PRODUTOS: Def[] = [
  // Insumos (custos fictícios)
  ['I01', 'Polvilho azedo', 'Insumos', 'insumo', 'kg', null, 900, 40, 10],
  ['I02', 'Polvilho doce', 'Insumos', 'insumo', 'kg', null, 800, 25, 8],
  ['I03', 'Queijo meia cura', 'Insumos', 'insumo', 'kg', null, 4200, 18, 5],
  ['I04', 'Ovos', 'Insumos', 'insumo', 'un', null, 70, 240, 60],
  ['I05', 'Leite integral', 'Insumos', 'insumo', 'l', null, 550, 30, 10],
  ['I06', 'Óleo de soja', 'Insumos', 'insumo', 'l', null, 900, 12, 4],
  ['I07', 'Sal', 'Insumos', 'insumo', 'kg', null, 300, 4, 1],
  ['I08', 'Farinha de trigo', 'Insumos', 'insumo', 'kg', null, 500, 30, 10],
  ['I09', 'Carne moída', 'Insumos', 'insumo', 'kg', null, 3500, 6, 2],
  ['I10', 'Frango desfiado', 'Insumos', 'insumo', 'kg', null, 2800, 7, 2],
  ['I11', 'Presunto', 'Insumos', 'insumo', 'kg', null, 3800, 2.5, 1],
  ['I12', 'Muçarela', 'Insumos', 'insumo', 'kg', null, 4500, 1.5, 2],
  ['I13', 'Café em pó', 'Insumos', 'insumo', 'kg', null, 3200, 3, 1],
  ['I14', 'Pão de forma (fatia)', 'Insumos', 'insumo', 'un', null, 40, 120, 40],
  // Fabricados
  ['101', 'Pão de queijo', 'Pão de queijo', 'fabricado', 'un', 250, null, 0, 40],
  ['102', 'Pão de queijo recheado de frango', 'Pão de queijo', 'fabricado', 'un', 700, null, 0, 10],
  ['103', 'Pão de queijo congelado', 'Pão de queijo', 'fabricado', 'kg', 4500, null, 0, 3],
  ['201', 'Coxinha de frango', 'Salgados', 'fabricado', 'un', 700, null, 0, 15],
  ['202', 'Salgado assado de presunto e queijo', 'Salgados', 'fabricado', 'un', 700, null, 0, 10],
  ['203', 'Mini pizza', 'Salgados', 'fabricado', 'un', 600, null, 0, 10],
  ['204', 'Pastel de carne', 'Salgados', 'fabricado', 'un', 800, null, 0, 0, { controlaEstoque: false, preparoNaCozinha: true }],
  ['301', 'Misto quente', 'Lanches', 'fabricado', 'un', 900, null, 0, 0, { controlaEstoque: false, preparoNaCozinha: true }],
  ['401', 'Café coado (copo)', 'Cafés', 'fabricado', 'un', 400, null, 0, 0, { controlaEstoque: false }],
  ['402', 'Café com leite', 'Cafés', 'fabricado', 'un', 550, null, 0, 0, { controlaEstoque: false }],
  // Revenda
  ['501', 'Toddynho', 'Bebidas', 'revenda', 'un', 450, 280, 36, 12],
  ['502', 'Refrigerante lata', 'Bebidas', 'revenda', 'un', 600, 350, 48, 12],
  ['503', 'Água mineral 500 ml', 'Bebidas', 'revenda', 'un', 350, 150, 40, 12],
  ['504', 'Suco de caixinha', 'Bebidas', 'revenda', 'un', 400, 220, 8, 12],
  ['601', 'Bolo de pote', 'Doces', 'revenda', 'un', 1200, 700, 10, 4],
];

const FICHAS: [codigo: string, rendimento: number, itens: [string, number][]][] = [
  ['101', 100, [['I01', 1.5], ['I02', 0.5], ['I03', 1], ['I04', 12], ['I05', 1], ['I06', 0.5], ['I07', 0.04]]],
  ['102', 40, [['I01', 1], ['I02', 0.4], ['I03', 0.8], ['I04', 8], ['I05', 0.7], ['I06', 0.3], ['I10', 1.2], ['I07', 0.03]]],
  ['103', 5, [['I01', 1.7], ['I02', 0.5], ['I03', 1.2], ['I04', 14], ['I05', 1.1], ['I06', 0.6], ['I07', 0.05]]],
  ['201', 40, [['I08', 1.6], ['I10', 1.5], ['I05', 1], ['I06', 1], ['I07', 0.04]]],
  ['202', 30, [['I08', 1.5], ['I11', 0.6], ['I12', 0.6], ['I04', 4], ['I05', 0.5]]],
  ['203', 30, [['I08', 1.2], ['I12', 0.8], ['I11', 0.4], ['I06', 0.1]]],
  ['204', 30, [['I08', 1.5], ['I09', 1.2], ['I06', 0.8], ['I07', 0.03]]],
  ['301', 1, [['I14', 2], ['I11', 0.04], ['I12', 0.04]]],
  ['401', 20, [['I13', 0.1]]],
  ['402', 20, [['I13', 0.08], ['I05', 2]]],
];

const PRODUCAO_DIARIA: [string, number][] = [['101', 50], ['101', 50], ['102', 12], ['201', 15], ['202', 12], ['203', 12]];

/**
 * Loja fictícia com 7 dias de movimento (caixas fechados, vendas, produção, contas),
 * para a demonstração não começar vazia. Nada aqui é dado real.
 */
export function dadosDemonstracao(agora: Date): Estado {
  const r = sorteio(20261006);
  let e = estadoVazio();
  e.config = { ...e.config, demonstracao: true, endereco: 'Endereço de exemplo' };

  const porCodigo = new Map<string, Produto>();
  for (const [codigo, nome, categoria, tipo, unidade, preco, custo, estoque, minimo, extras] of PRODUTOS) {
    const p = novoProduto({ codigo, nome, categoria, tipo, unidade, preco, custo, estoque, estoqueMinimo: minimo, noCardapio: tipo !== 'insumo', ...extras });
    porCodigo.set(codigo, p);
    e.produtos.push(p);
  }
  for (const [codigo, rendimento, itens] of FICHAS) {
    e = salvarFicha(e, porCodigo.get(codigo)!.id, rendimento, itens.map(([c, q]) => ({ insumoId: porCodigo.get(c)!.id, quantidade: q })));
  }

  const clientes: Cliente[] = ['Dona Maria (exemplo)', 'Seu João (exemplo)', 'Oficina do Zé (exemplo)', 'Ana Paula (exemplo)'].map((nome, i) => ({ id: novoId(), nome, telefone: '', limite: i === 2 ? 30000 : 15000, ativo: true }));
  e.clientes = clientes;

  const hoje = chaveDoDia(agora);
  const vendaveis = e.produtos.filter((p) => p.tipo !== 'insumo');
  const formas: FormaPagamento[] = ['dinheiro', 'dinheiro', 'pix', 'pix', 'pix', 'debito', 'debito', 'credito'];

  for (let d = -6; d <= -1; d++) {
    const dia = somarDias(hoje, d);
    const [a, m, dd] = dia.split('-').map(Number);
    const em = (h: number, min: number) => new Date(a, m - 1, dd, h, min);

    // Produção do dia: abastece a vitrine antes de abrir.
    for (const [cod, qtd] of PRODUCAO_DIARIA) {
      e = criarOrdem(e, porCodigo.get(cod)!.id, qtd, em(5, 30), 'Fornada');
      e = concluirOrdem(e, e.ordens[e.ordens.length - 1].id, em(6, r.entre(0, 50)));
    }
    if (r.prox() < 0.5) {
      e = criarOrdem(e, porCodigo.get('103')!.id, 5, em(14, 0));
      e = concluirOrdem(e, e.ordens[e.ordens.length - 1].id, em(15, 30));
    }

    e = abrirCaixa(e, r.um(['Thiago', 'Atendente']), 10000, em(6, 30));
    const qtdVendas = r.entre(28, 42);
    for (let k = 0; k < qtdVendas; k++) {
      const h = 6 + Math.floor((k / qtdVendas) * 13);
      const itens = new Map<string, number>();
      const n = r.entre(1, 3);
      for (let j = 0; j < n; j++) {
        const p = r.prox() < 0.35 ? porCodigo.get('101')! : r.um(vendaveis);
        const q = p.unidade === 'kg' ? r.um([0.5, 1, 1.25]) : r.entre(1, p.codigo.startsWith('10') ? 6 : 2);
        itens.set(p.id, (itens.get(p.id) ?? 0) + q);
      }
      const lista = [...itens].map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
      const total = lista.reduce((s, i) => s + Math.round((e.produtos.find((p) => p.id === i.produtoId)!.preco ?? 0) * i.quantidade), 0);
      let forma = r.um(formas);
      const cliente = r.prox() < 0.06 ? r.um(clientes) : null;
      if (cliente) forma = 'fiado';
      const valor = forma === 'dinheiro' ? Math.ceil(total / 500) * 500 : total;
      try {
        e = registrarVenda(e, { itens: lista, desconto: 0, pagamentos: [{ forma, valor }], clienteId: cliente?.id ?? null }, em(h, r.entre(0, 59))).estado;
      } catch {
        // limite de fiado estourado: vende no Pix
        e = registrarVenda(e, { itens: lista, desconto: 0, pagamentos: [{ forma: 'pix', valor: total }], clienteId: null }, em(h, r.entre(0, 59))).estado;
      }
    }
    // Sobra do fim do dia: metade vira perda (o resto vende no dia seguinte).
    for (const p of e.produtos) {
      if (p.tipo === 'fabricado' && p.controlaEstoque && p.unidade === 'un' && p.estoque >= 2) {
        e = registrarPerda(e, p.id, Math.floor(p.estoque / 2), 'Sobra do dia', em(19, 0));
      }
    }
    // Pedidos da cozinha desses dias já foram entregues.
    e = { ...e, pedidos: e.pedidos.map((p) => ({ ...p, status: 'entregue' })) };
    const sessao = e.caixas[e.caixas.length - 1];
    const esperado = resumoSessao(e, sessao).dinheiroEsperado;
    e = fecharCaixa(e, esperado + r.um([0, 0, 0, -50, 100]), em(19, 15));
  }

  // Insumos e revenda voltam ao nível de exemplo (alguns abaixo do mínimo, para o alerta aparecer).
  // O histórico deles na semana fictícia é descartado para o extrato de estoque bater com o saldo.
  const alvo = new Map(PRODUTOS.filter((d) => d[3] !== 'fabricado').map((d) => [d[0], d[7]]));
  const insumos = new Set(e.produtos.filter((p) => p.tipo !== 'fabricado').map((p) => p.id));
  e = {
    ...e,
    produtos: e.produtos.map((p) => (alvo.has(p.codigo) ? { ...p, estoque: alvo.get(p.codigo)! } : p)),
    movimentos: e.movimentos.filter((mv) => !insumos.has(mv.produtoId)),
  };

  // Vitrine de hoje: sobras de ontem + produção da manhã.
  for (const [cod, qtd] of PRODUCAO_DIARIA) {
    e = criarOrdem(e, porCodigo.get(cod)!.id, qtd, new Date(agora.getTime() - 3 * 3600_000), 'Fornada');
    e = concluirOrdem(e, e.ordens[e.ordens.length - 1].id, new Date(agora.getTime() - 2 * 3600_000));
  }
  e = criarOrdem(e, porCodigo.get('102')!.id, 12, agora, 'Para a tarde');
  e = {
    ...e,
    pedidos: [
      ...e.pedidos,
      { id: novoId(), numero: e.seq.pedido + 1, origem: 'encomenda', vendaId: null, identificacao: 'Festa da escola (exemplo)', itens: [{ nome: 'Pão de queijo', quantidade: 200 }, { nome: 'Coxinha de frango', quantidade: 100 }], obs: 'Retirar às 15h. Sinal pago no Pix.', status: 'novo', criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), paraQuando: new Date(agora.getTime() + 26 * 3600_000).toISOString() },
    ],
    seq: { ...e.seq, pedido: e.seq.pedido + 1 },
  };

  const conta = (tipo: Conta['tipo'], descricao: string, categoria: string, valor: number, dias: number, paga: boolean): Conta => ({
    id: novoId(), tipo, descricao, categoria, valor, vencimento: somarDias(hoje, dias), pagaEm: paga ? new Date(agora.getTime() + Math.min(0, dias) * 86400_000).toISOString() : null,
  });
  e.contas = [
    conta('pagar', 'Aluguel do ponto (exemplo)', 'Aluguel', 250000, 4, false),
    conta('pagar', 'Energia (exemplo)', 'Energia', 68000, -1, false),
    conta('pagar', 'Fornecedor de polvilho (exemplo)', 'Fornecedores', 54000, -3, true),
    conta('pagar', 'Laticínio: queijo (exemplo)', 'Fornecedores', 126000, 0, false),
    conta('pagar', 'Água (exemplo)', 'Água', 14000, 9, false),
    conta('receber', 'Encomenda festa da escola: restante (exemplo)', 'Encomendas', 60000, 1, false),
  ];
  return e;
}

// ---------- Migração do protótipo v1 ----------

interface V1 {
  versao: 1;
  cardapio: { nome: string; categoria: string; preco: number | null }[];
  estoque: { ingredientes: { nome: string }[]; revenda: { nome: string }[] };
  clientes: { nome: string; lancamentos: { valor: number; quando: string }[] }[];
}

/** Aproveita o que o Thiago anotou no protótipo antigo. Fornadas antigas ficam guardadas na chave v1. */
export function migrarV1(v1: V1): Estado {
  const e = estadoVazio();
  const tipoDe = (cat: string): TipoProduto => (cat === 'Bebidas' ? 'revenda' : 'fabricado');
  let n = 0;
  for (const i of v1.cardapio) {
    n += 1;
    e.produtos.push(novoProduto({ codigo: String(100 + n), nome: i.nome.trim().slice(0, 80), categoria: i.categoria.slice(0, 40), tipo: tipoDe(i.categoria), preco: i.preco, controlaEstoque: i.categoria !== 'Cafés' }));
  }
  for (const i of v1.estoque.ingredientes) e.produtos.push(novoProduto({ nome: i.nome.trim().slice(0, 80), categoria: 'Insumos', tipo: 'insumo', noCardapio: false }));
  for (const i of v1.estoque.revenda) {
    if (!e.produtos.some((p) => p.nome.toLowerCase() === i.nome.toLowerCase())) e.produtos.push(novoProduto({ nome: i.nome.trim().slice(0, 80), categoria: 'Bebidas', tipo: 'revenda', noCardapio: false }));
  }
  for (const c of v1.clientes) {
    const cliente: Cliente = { id: novoId(), nome: c.nome.trim().slice(0, 60), telefone: '', limite: null, ativo: true };
    e.clientes.push(cliente);
    for (const l of c.lancamentos) e.fiado.push({ id: novoId(), clienteId: cliente.id, quando: l.quando, tipo: 'compra', valor: l.valor, vendaId: null, obs: 'Do protótipo anterior' });
  }
  return e;
}
