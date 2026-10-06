import { describe, expect, it } from 'vitest';
import { CHAVE, carregar, salvar, type Armazem } from './armazenamento';
import { codificarCardapio, decodificarCardapio } from './cardapioLink';
import { formatarReais, lerReais } from './dinheiro';
import * as E from './estado';

const dia = (h: number, m = 0) => new Date(2026, 9, 6, h, m); // 06/10/2026, horário local

function armazemFalso(inicial: Record<string, string> = {}): Armazem & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return { dados, getItem: (k) => dados[k] ?? null, setItem: (k, v) => { dados[k] = v; }, removeItem: (k) => { delete dados[k]; } };
}

describe('fornadas', () => {
  it('conta cada toque e guarda o horário', () => {
    let e = E.estadoInicial();
    e = E.registrarFornada(e, dia(6, 30));
    e = E.registrarFornada(e, dia(8, 5));
    const d = E.diaDe(e, '2026-10-06');
    expect(d.horarios).toHaveLength(2);
    expect(E.horaCurta(d.horarios[1])).toBe('08:05');
  });

  it('separa os dias', () => {
    let e = E.registrarFornada(E.estadoInicial(), dia(7));
    e = E.registrarFornada(e, new Date(2026, 9, 7, 7));
    expect(E.diaDe(e, '2026-10-06').horarios).toHaveLength(1);
    expect(E.diaDe(e, '2026-10-07').horarios).toHaveLength(1);
  });

  it('desfaz só a última do dia e não quebra com o dia vazio', () => {
    let e = E.registrarFornada(E.estadoInicial(), dia(7));
    e = E.registrarFornada(e, dia(9));
    e = E.desfazerFornada(e, dia(10));
    expect(E.diaDe(e, '2026-10-06').horarios.map(E.horaCurta)).toEqual(['07:00']);
    const vazio = E.estadoInicial();
    expect(E.desfazerFornada(vazio, dia(10))).toBe(vazio);
  });

  it('registra a sobra e recusa valor inválido', () => {
    const e = E.registrarSobra(E.estadoInicial(), dia(18), 12);
    expect(E.diaDe(e, '2026-10-06').sobra).toBe(12);
    expect(() => E.registrarSobra(e, dia(18), -1)).toThrow();
    expect(() => E.registrarSobra(e, dia(18), 1.5)).toThrow();
  });

  it('resume o mês', () => {
    let e = E.registrarFornada(E.estadoInicial(), dia(7));
    e = E.registrarFornada(e, dia(8));
    e = E.registrarSobra(e, dia(18), 5);
    e = E.registrarFornada(e, new Date(2026, 10, 1, 7)); // novembro não entra
    expect(E.resumoDoMes(e, dia(12))).toEqual({ fornadas: 2, dias: 1, sobra: 5 });
  });
});

describe('cardápio e estoque', () => {
  it('cria, edita e remove item do cardápio', () => {
    let e = E.estadoInicial();
    const novo: E.ItemCardapio = { id: 'x', categoria: 'Cafés', nome: '  Café coado ', preco: 450 };
    e = E.salvarItemCardapio(e, novo);
    expect(e.cardapio.find((i) => i.id === 'x')?.nome).toBe('Café coado');
    e = E.salvarItemCardapio(e, { ...novo, preco: 500 });
    expect(e.cardapio.filter((i) => i.id === 'x')).toHaveLength(1);
    expect(e.cardapio.find((i) => i.id === 'x')?.preco).toBe(500);
    e = E.removerItemCardapio(e, 'x');
    expect(e.cardapio.some((i) => i.id === 'x')).toBe(false);
  });

  it('não aceita item sem nome', () => {
    expect(() => E.salvarItemCardapio(E.estadoInicial(), { id: 'y', categoria: 'Bebidas', nome: '   ', preco: null })).toThrow();
  });

  it('mantém as duas listas de estoque separadas', () => {
    let e = E.salvarItemEstoque(E.estadoInicial(), 'ingredientes', { id: 'p', nome: 'Polvilho', quantidade: '3 sacos' });
    e = E.salvarItemEstoque(e, 'revenda', { id: 'r', nome: 'Refrigerante lata', quantidade: '2 fardos' });
    expect(e.estoque.ingredientes.map((i) => i.nome)).toEqual(['Polvilho']);
    expect(e.estoque.revenda.map((i) => i.nome)).toEqual(['Refrigerante lata']);
    e = E.removerItemEstoque(e, 'ingredientes', 'p');
    expect(e.estoque.ingredientes).toHaveLength(0);
    expect(e.estoque.revenda).toHaveLength(1);
  });
});

describe('clientes a prazo', () => {
  it('soma lançamentos, marca pago e guarda o pagamento', () => {
    let e = E.estadoInicial();
    const id = e.clientes[0].id;
    e = E.lancarConsumo(e, id, 1250, dia(8));
    e = E.lancarConsumo(e, id, 800, dia(9));
    expect(E.totalCliente(e.clientes[0])).toBe(2050);
    expect(E.totalClientes(e)).toBe(2050);
    e = E.marcarPago(e, id, dia(10));
    expect(E.totalCliente(e.clientes[0])).toBe(0);
    expect(e.clientes[0].ultimoPagamento?.valor).toBe(2050);
  });

  it('não lança valor zero e não registra pagamento de conta vazia', () => {
    const e = E.estadoInicial();
    expect(() => E.lancarConsumo(e, e.clientes[0].id, 0, dia(8))).toThrow();
    expect(E.marcarPago(e, e.clientes[0].id, dia(8)).clientes[0].ultimoPagamento).toBeNull();
  });

  it('começa só com nomes fictícios', () => {
    expect(E.estadoInicial().clientes.map((c) => c.nome)).toEqual(['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D']);
  });
});

describe('dinheiro', () => {
  it.each([
    ['12', 1200], ['12,5', 1250], ['12,50', 1250], ['R$ 1.234,56', 123456], ['12.50', 1250], ['1.234', 123400], ['0,99', 99],
  ])('lê "%s"', (t, v) => expect(lerReais(t)).toBe(v));
  it.each(['', 'abc', '12,345', '-5', '1,2,3'])('recusa "%s"', (t) => expect(lerReais(t)).toBeNull());
  it('formata', () => {
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
    expect(formatarReais(5)).toBe('R$ 0,05');
  });
});

describe('armazenamento', () => {
  it('salva e carrega o mesmo estado', () => {
    const a = armazemFalso();
    const e = E.registrarFornada(E.estadoInicial(), dia(7));
    expect(salvar(a, e)).toBe(true);
    expect(carregar(a)).toEqual({ estado: e, aviso: null });
  });

  it('dados danificados: começa do zero e guarda cópia do antigo', () => {
    const a = armazemFalso({ [CHAVE]: '{"versao":1,"fornadas":"isso nao"}' });
    const r = carregar(a);
    expect(r.aviso).toBe('dados-corrompidos');
    expect(r.estado.clientes).toHaveLength(4);
    expect(Object.keys(a.dados).some((k) => k.includes(':corrompido:'))).toBe(true);
  });

  it('sem armazenamento: avisa em vez de quebrar', () => {
    expect(carregar(null).aviso).toBe('sem-armazenamento');
    const quebrado: Armazem = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); }, removeItem: () => {} };
    expect(carregar(quebrado).aviso).toBe('sem-armazenamento');
    expect(salvar(quebrado, E.estadoInicial())).toBe(false);
  });
});

describe('link do cardápio', () => {
  it('ida e volta preservam itens e acentos', () => {
    const itens: E.ItemCardapio[] = [
      { id: '1', categoria: 'Pão de queijo', nome: 'Pão de queijo recheado', preco: 650 },
      { id: '2', categoria: 'Cafés', nome: 'Café com leite', preco: null },
    ];
    expect(decodificarCardapio(codificarCardapio(itens))).toEqual(itens.map(({ categoria, nome, preco }) => ({ categoria, nome, preco })));
  });

  it('recusa link adulterado', () => {
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
    expect(decodificarCardapio('lixo!!')).toBeNull();
    expect(decodificarCardapio(b64([[9, 'x', 1]]))).toBeNull(); // categoria inexistente
    expect(decodificarCardapio(b64([[0, '', 1]]))).toBeNull(); // nome vazio
    expect(decodificarCardapio(b64([[0, 'x', -1]]))).toBeNull(); // preço negativo
    expect(decodificarCardapio(b64({ a: 1 }))).toBeNull();
  });
});
