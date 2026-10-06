// Regras de negócio do protótipo. Funções puras: recebem o estado e devolvem um novo.
// Nada aqui acessa o navegador; o armazenamento fica em armazenamento.ts.

export const VERSAO = 1;

export const CATEGORIAS = ['Pão de queijo', 'Salgados', 'Bebidas', 'Cafés'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export interface ItemCardapio {
  id: string;
  categoria: Categoria;
  nome: string;
  /** Preço em centavos. null = ainda não informado. */
  preco: number | null;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  /** Texto livre ("2 sacos", "15 kg"). Cada produto tem a sua unidade. */
  quantidade: string;
}

export interface Lancamento {
  id: string;
  valor: number; // centavos
  quando: string; // ISO
}

export interface Cliente {
  id: string;
  nome: string;
  lancamentos: Lancamento[];
  ultimoPagamento: { quando: string; valor: number } | null;
}

export interface DiaFornadas {
  horarios: string[]; // ISO, em ordem
  sobra: number | null;
}

export interface Estado {
  versao: number;
  fornadas: Record<string, DiaFornadas>; // chave: AAAA-MM-DD (data local)
  cardapio: ItemCardapio[];
  estoque: { ingredientes: ItemEstoque[]; revenda: ItemEstoque[] };
  clientes: Cliente[];
}

export type ListaEstoque = keyof Estado['estoque'];

let contador = 0;
export function novoId(): string {
  contador += 1;
  return Date.now().toString(36) + '-' + contador.toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/**
 * Estado inicial. Os itens do cardápio são os que aparecem na foto da comanda
 * (leitura registrada na conversa da equipe). Preços ficam vazios: o Thiago preenche.
 * Os clientes a prazo usam nomes fictícios.
 */
export function estadoInicial(): Estado {
  const item = (categoria: Categoria, nome: string): ItemCardapio => ({ id: novoId(), categoria, nome, preco: null });
  const cliente = (nome: string): Cliente => ({ id: novoId(), nome, lancamentos: [], ultimoPagamento: null });
  return {
    versao: VERSAO,
    fornadas: {},
    cardapio: [
      item('Pão de queijo', 'Pão de queijo'),
      item('Salgados', 'Pastel'),
      item('Salgados', 'Salgado frito'),
      item('Salgados', 'Salgado assado'),
      item('Salgados', 'Mini pizza'),
      item('Bebidas', 'Toddynho'),
    ],
    estoque: { ingredientes: [], revenda: [] },
    clientes: [cliente('Cliente A'), cliente('Cliente B'), cliente('Cliente C'), cliente('Cliente D')],
  };
}

// ---------- Datas ----------

export function chaveDoDia(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function horaCurta(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ---------- Fornadas ----------

export function diaDe(estado: Estado, chave: string): DiaFornadas {
  return estado.fornadas[chave] ?? { horarios: [], sobra: null };
}

export function registrarFornada(estado: Estado, agora: Date): Estado {
  const chave = chaveDoDia(agora);
  const dia = diaDe(estado, chave);
  return { ...estado, fornadas: { ...estado.fornadas, [chave]: { ...dia, horarios: [...dia.horarios, agora.toISOString()] } } };
}

/** Desfaz o último toque do dia (para corrigir toque sem querer). */
export function desfazerFornada(estado: Estado, agora: Date): Estado {
  const chave = chaveDoDia(agora);
  const dia = diaDe(estado, chave);
  if (dia.horarios.length === 0) return estado;
  return { ...estado, fornadas: { ...estado.fornadas, [chave]: { ...dia, horarios: dia.horarios.slice(0, -1) } } };
}

export function registrarSobra(estado: Estado, agora: Date, sobra: number): Estado {
  if (!Number.isInteger(sobra) || sobra < 0) throw new Error('Sobra precisa ser um número inteiro, zero ou mais.');
  const chave = chaveDoDia(agora);
  const dia = diaDe(estado, chave);
  return { ...estado, fornadas: { ...estado.fornadas, [chave]: { ...dia, sobra } } };
}

/** Total de fornadas e dias com registro no mês da data informada. */
export function resumoDoMes(estado: Estado, referencia: Date): { fornadas: number; dias: number; sobra: number } {
  const prefixo = chaveDoDia(referencia).slice(0, 7);
  let fornadas = 0,
    dias = 0,
    sobra = 0;
  for (const [chave, dia] of Object.entries(estado.fornadas)) {
    if (!chave.startsWith(prefixo)) continue;
    if (dia.horarios.length === 0 && dia.sobra == null) continue;
    dias += 1;
    fornadas += dia.horarios.length;
    sobra += dia.sobra ?? 0;
  }
  return { fornadas, dias, sobra };
}

// ---------- Cardápio ----------

export function salvarItemCardapio(estado: Estado, item: ItemCardapio): Estado {
  const nome = item.nome.trim();
  if (!nome) throw new Error('O item precisa de um nome.');
  if (item.preco != null && (!Number.isInteger(item.preco) || item.preco < 0)) throw new Error('Preço inválido.');
  const limpo = { ...item, nome };
  const existe = estado.cardapio.some((i) => i.id === item.id);
  return {
    ...estado,
    cardapio: existe ? estado.cardapio.map((i) => (i.id === item.id ? limpo : i)) : [...estado.cardapio, limpo],
  };
}

export function removerItemCardapio(estado: Estado, id: string): Estado {
  return { ...estado, cardapio: estado.cardapio.filter((i) => i.id !== id) };
}

// ---------- Estoque ----------

export function salvarItemEstoque(estado: Estado, lista: ListaEstoque, item: ItemEstoque): Estado {
  const nome = item.nome.trim();
  if (!nome) throw new Error('O produto precisa de um nome.');
  const limpo = { ...item, nome, quantidade: item.quantidade.trim() };
  const atual = estado.estoque[lista];
  const existe = atual.some((i) => i.id === item.id);
  const nova = existe ? atual.map((i) => (i.id === item.id ? limpo : i)) : [...atual, limpo];
  return { ...estado, estoque: { ...estado.estoque, [lista]: nova } };
}

export function removerItemEstoque(estado: Estado, lista: ListaEstoque, id: string): Estado {
  return { ...estado, estoque: { ...estado.estoque, [lista]: estado.estoque[lista].filter((i) => i.id !== id) } };
}

// ---------- Clientes a prazo ----------

export function totalCliente(c: Cliente): number {
  return c.lancamentos.reduce((s, l) => s + l.valor, 0);
}

export function totalClientes(estado: Estado): number {
  return estado.clientes.reduce((s, c) => s + totalCliente(c), 0);
}

export function salvarCliente(estado: Estado, id: string | null, nome: string): Estado {
  const n = nome.trim();
  if (!n) throw new Error('O cliente precisa de um nome.');
  if (id == null) {
    return { ...estado, clientes: [...estado.clientes, { id: novoId(), nome: n, lancamentos: [], ultimoPagamento: null }] };
  }
  return { ...estado, clientes: estado.clientes.map((c) => (c.id === id ? { ...c, nome: n } : c)) };
}

export function removerCliente(estado: Estado, id: string): Estado {
  return { ...estado, clientes: estado.clientes.filter((c) => c.id !== id) };
}

export function lancarConsumo(estado: Estado, id: string, valor: number, agora: Date): Estado {
  if (!Number.isInteger(valor) || valor <= 0) throw new Error('O valor precisa ser maior que zero.');
  return {
    ...estado,
    clientes: estado.clientes.map((c) =>
      c.id === id ? { ...c, lancamentos: [...c.lancamentos, { id: novoId(), valor, quando: agora.toISOString() }] } : c,
    ),
  };
}

/** Zera a conta do cliente e guarda quanto foi pago. */
export function marcarPago(estado: Estado, id: string, agora: Date): Estado {
  return {
    ...estado,
    clientes: estado.clientes.map((c) => {
      if (c.id !== id) return c;
      const valor = totalCliente(c);
      if (valor === 0) return c;
      return { ...c, lancamentos: [], ultimoPagamento: { quando: agora.toISOString(), valor } };
    }),
  };
}

// ---------- Validação (dados vindos do navegador ou de arquivo importado) ----------

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehInteiroOuNulo = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 0);

/** Confere a forma do estado. Dados salvos são tratados como não confiáveis. */
export function validarEstado(v: unknown): Estado {
  const erro = (m: string): never => {
    throw new Error('Dados inválidos: ' + m);
  };
  if (!v || typeof v !== 'object') erro('formato');
  const e = v as Record<string, unknown>;
  if (e.versao !== VERSAO) erro('versão');
  const fornadas = e.fornadas as Record<string, unknown>;
  if (!fornadas || typeof fornadas !== 'object') erro('fornadas');
  for (const [k, d] of Object.entries(fornadas)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) erro('dia');
    const dia = d as DiaFornadas;
    if (!Array.isArray(dia?.horarios) || !dia.horarios.every(ehTexto) || !ehInteiroOuNulo(dia.sobra)) erro('fornadas');
  }
  if (!Array.isArray(e.cardapio)) erro('cardápio');
  for (const i of e.cardapio as ItemCardapio[]) {
    if (!ehTexto(i?.id) || !ehTexto(i.nome) || !CATEGORIAS.includes(i.categoria) || !ehInteiroOuNulo(i.preco)) erro('cardápio');
  }
  const est = e.estoque as Estado['estoque'];
  if (!est || !Array.isArray(est.ingredientes) || !Array.isArray(est.revenda)) erro('estoque');
  for (const i of [...est.ingredientes, ...est.revenda]) {
    if (!ehTexto(i?.id) || !ehTexto(i.nome) || !ehTexto(i.quantidade)) erro('estoque');
  }
  if (!Array.isArray(e.clientes)) erro('clientes');
  for (const c of e.clientes as Cliente[]) {
    if (!ehTexto(c?.id) || !ehTexto(c.nome) || !Array.isArray(c.lancamentos)) erro('clientes');
    for (const l of c.lancamentos) if (!ehTexto(l?.id) || !Number.isInteger(l.valor) || !ehTexto(l.quando)) erro('lançamentos');
  }
  return e as unknown as Estado;
}
