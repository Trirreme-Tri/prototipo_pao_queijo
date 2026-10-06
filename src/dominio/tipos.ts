// Tipos do sistema de gestão da padaria (estado versão 2).
// Dinheiro sempre em centavos (inteiro). Quantidades em número com até 3 casas (kg, l) ou inteiro (un).

export const VERSAO = 2;

export type Unidade = 'un' | 'kg' | 'l';
export const UNIDADES: readonly Unidade[] = ['un', 'kg', 'l'];

/** fabricado = sai da cozinha (tem ficha técnica); revenda = compra pronto e revende; insumo = ingrediente. */
export type TipoProduto = 'fabricado' | 'revenda' | 'insumo';
export const TIPOS_PRODUTO: readonly TipoProduto[] = ['fabricado', 'revenda', 'insumo'];

export interface Produto {
  id: string;
  /** Código curto ou de barras, digitado/lido no caixa. Único entre os ativos. */
  codigo: string;
  nome: string;
  categoria: string;
  tipo: TipoProduto;
  unidade: Unidade;
  /** Preço de venda por unidade, em centavos. null = não vende (insumo) ou sem preço ainda. */
  preco: number | null;
  /** Custo por unidade (última compra), em centavos. Fabricado usa o custo da ficha técnica. */
  custo: number | null;
  estoque: number;
  estoqueMinimo: number;
  noCardapio: boolean;
  /** Ao vender, manda um pedido para a tela da cozinha (ex.: lanche feito na hora). */
  preparoNaCozinha: boolean;
  /**
   * true = o produto tem saldo próprio (sai da vitrine na venda).
   * false = feito na hora: na venda saem os ingredientes da ficha técnica.
   */
  controlaEstoque: boolean;
  ativo: boolean;
}

export interface ItemFicha {
  insumoId: string;
  quantidade: number;
}

/** Ficha técnica: uma receita (ou fornada) rende `rendimento` unidades do produto. */
export interface FichaTecnica {
  produtoId: string;
  rendimento: number;
  itens: ItemFicha[];
}

export type TipoMovimento = 'entrada' | 'venda' | 'cancelamento' | 'producao' | 'consumo' | 'perda' | 'ajuste';

export interface Movimento {
  id: string;
  quando: string;
  produtoId: string;
  tipo: TipoMovimento;
  /** Positivo entra, negativo sai. */
  quantidade: number;
  /** Saldo do produto logo depois do movimento. */
  saldo: number;
  obs: string;
  /** Id da venda ou ordem que gerou o movimento ('' se manual). Permite desfazer exatamente. */
  ref: string;
}

export type StatusOrdem = 'planejada' | 'produzindo' | 'concluida' | 'cancelada';

export interface OrdemProducao {
  id: string;
  numero: number;
  produtoId: string;
  quantidade: number;
  status: StatusOrdem;
  criadaEm: string;
  concluidaEm: string | null;
  obs: string;
}

export type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado';
export const FORMAS_PAGAMENTO: readonly FormaPagamento[] = ['dinheiro', 'pix', 'debito', 'credito', 'fiado'];

export interface Pagamento {
  forma: FormaPagamento;
  valor: number;
}

export interface ItemVenda {
  produtoId: string;
  nome: string;
  precoUnit: number;
  quantidade: number;
}

export interface Venda {
  id: string;
  numero: number;
  sessaoId: string;
  quando: string;
  itens: ItemVenda[];
  subtotal: number;
  desconto: number;
  total: number;
  pagamentos: Pagamento[];
  troco: number;
  clienteId: string | null;
  status: 'concluida' | 'cancelada';
  canceladaEm: string | null;
  motivoCancelamento: string;
}

export type TipoMovCaixa = 'sangria' | 'suprimento' | 'recebimento';

export interface MovCaixa {
  id: string;
  quando: string;
  tipo: TipoMovCaixa;
  valor: number;
  /** Só para recebimento de fiado: como o cliente pagou. */
  forma: FormaPagamento | null;
  obs: string;
}

export interface SessaoCaixa {
  id: string;
  numero: number;
  operador: string;
  abertaEm: string;
  fechadaEm: string | null;
  valorInicial: number;
  movimentos: MovCaixa[];
  /** Dinheiro contado na gaveta ao fechar. */
  contado: number | null;
}

export type StatusPedido = 'novo' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';

export interface Pedido {
  id: string;
  numero: number;
  origem: 'caixa' | 'balcao' | 'encomenda';
  vendaId: string | null;
  identificacao: string;
  itens: { nome: string; quantidade: number }[];
  obs: string;
  status: StatusPedido;
  criadoEm: string;
  atualizadoEm: string;
  /** Encomenda: data/hora combinada de retirada (ISO), senão null. */
  paraQuando: string | null;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  /** Limite de fiado em centavos. null = sem limite. */
  limite: number | null;
  ativo: boolean;
}

export interface LancamentoFiado {
  id: string;
  clienteId: string;
  quando: string;
  tipo: 'compra' | 'pagamento' | 'estorno';
  valor: number;
  vendaId: string | null;
  obs: string;
}

export interface Conta {
  id: string;
  tipo: 'pagar' | 'receber';
  descricao: string;
  categoria: string;
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  pagaEm: string | null;
}

export interface Config {
  nomeLoja: string;
  /** Só dígitos, com DDD. Usado no botão "pedir pelo WhatsApp" do cardápio. */
  whatsapp: string;
  endereco: string;
  categorias: string[];
  categoriasConta: string[];
  /** Dados fictícios carregados para demonstração. */
  demonstracao: boolean;
}

export interface Estado {
  versao: number;
  config: Config;
  produtos: Produto[];
  fichas: FichaTecnica[];
  movimentos: Movimento[];
  ordens: OrdemProducao[];
  caixas: SessaoCaixa[];
  vendas: Venda[];
  pedidos: Pedido[];
  clientes: Cliente[];
  fiado: LancamentoFiado[];
  contas: Conta[];
  seq: { venda: number; pedido: number; ordem: number; caixa: number };
}

export const NOME_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  fiado: 'Fiado',
};

export const NOME_TIPO: Record<TipoProduto, string> = {
  fabricado: 'Fabricado',
  revenda: 'Revenda',
  insumo: 'Insumo',
};

export const NOME_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: 'Entrada',
  venda: 'Venda',
  cancelamento: 'Venda cancelada',
  producao: 'Produção',
  consumo: 'Consumo na produção',
  perda: 'Perda',
  ajuste: 'Ajuste de contagem',
};
