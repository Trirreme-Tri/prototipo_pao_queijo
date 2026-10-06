// Componentes do sistema (design system "Casa do Pão de Queijo", versão para PC e celular).

import { lerReais, formatarReais } from '../dinheiro';
import { el, icone, type Filho, type NomeIcone } from './base';

// ---------- Botões ----------

export type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sucesso';

export function botao(texto: Filho, aoClicar: () => void, op: { variante?: Variante; icone?: NomeIcone; tipo?: 'button' | 'submit'; desabilitado?: boolean; titulo?: string; atalho?: string; grande?: boolean; total?: boolean; testid?: string } = {}): HTMLButtonElement {
  const classes = ['botao', op.variante ?? 'primario', op.grande ? 'grande' : '', op.total ? 'total' : ''].filter(Boolean).join(' ');
  return el('button', {
    type: op.tipo ?? 'button',
    class: classes,
    title: op.titulo,
    disabled: op.desabilitado,
    'data-testid': op.testid,
    onclick: op.tipo === 'submit' ? undefined : (e: Event) => { e.preventDefault(); aoClicar(); },
  }, op.icone ? icone(op.icone, 20) : null, texto, op.atalho ? el('kbd', {}, op.atalho) : null);
}

export function botaoIcone(nome: NomeIcone, rotulo: string, aoClicar: () => void, variante: Variante = 'fantasma'): HTMLButtonElement {
  return el('button', { type: 'button', class: 'botao-icone ' + variante, 'aria-label': rotulo, title: rotulo, onclick: (e: Event) => { e.stopPropagation(); aoClicar(); } }, icone(nome, 20));
}

// ---------- Campos ----------

let idCampo = 0;
const novoIdCampo = () => 'c' + ++idCampo;

function bloco(id: string, rotulo: string, controle: HTMLElement, ajuda?: string, classe = ''): HTMLElement {
  return el('div', { class: 'campo ' + classe }, el('label', { for: id }, rotulo), controle, ajuda ? el('span', { class: 'ajuda', id: id + '-ajuda' }, ajuda) : null);
}

export function campoTexto(rotulo: string, valor: string, op: { ajuda?: string; max?: number; foco?: string; placeholder?: string; tipo?: string; modo?: string; classe?: string; obrigatorio?: boolean } = {}) {
  const id = novoIdCampo();
  const input = el('input', { id, type: op.tipo ?? 'text', value: valor, maxlength: op.max ?? 80, autocomplete: 'off', 'data-foco': op.foco, placeholder: op.placeholder, inputmode: op.modo, required: op.obrigatorio, 'aria-describedby': op.ajuda ? id + '-ajuda' : undefined });
  return { bloco: bloco(id, rotulo, input, op.ajuda, op.classe), input, valor: () => input.value };
}

export function campoAreaTexto(rotulo: string, valor: string, op: { max?: number; linhas?: number } = {}) {
  const id = novoIdCampo();
  const input = el('textarea', { id, maxlength: op.max ?? 200, rows: op.linhas ?? 3 });
  input.value = valor;
  return { bloco: bloco(id, rotulo, input), input, valor: () => input.value };
}

/** Campo de dinheiro: aceita "12,50". ler() devolve centavos ou null. */
export function campoDinheiro(rotulo: string, centavos: number | null, op: { ajuda?: string; foco?: string; classe?: string } = {}) {
  const id = novoIdCampo();
  const input = el('input', { id, type: 'text', inputmode: 'decimal', value: centavos == null ? '' : formatarReais(centavos).replace('R$ ', ''), autocomplete: 'off', 'data-foco': op.foco, placeholder: '0,00', class: 'dinheiro' });
  const controle = el('div', { class: 'com-prefixo' }, el('span', { class: 'prefixo' }, 'R$'), input);
  return { bloco: bloco(id, rotulo, controle, op.ajuda, op.classe), input, ler: () => (input.value.trim() === '' ? null : lerReais(input.value)) };
}

/** Quantidade: aceita "1,5". ler() devolve número ou null. */
export function campoQuantidade(rotulo: string, valor: number | null, unidade: string, op: { ajuda?: string; foco?: string; classe?: string } = {}) {
  const id = novoIdCampo();
  const input = el('input', { id, type: 'text', inputmode: 'decimal', value: valor == null ? '' : String(valor).replace('.', ','), autocomplete: 'off', 'data-foco': op.foco, class: 'quantidade' });
  const controle = el('div', { class: 'com-sufixo' }, input, el('span', { class: 'sufixo' }, unidade));
  return { bloco: bloco(id, rotulo, controle, op.ajuda, op.classe), input, ler: () => lerNumero(input.value) };
}

/** Aceita "1,5" e "1.5" (teclado de celular/americano). Não aceita separador de milhar. */
export function lerNumero(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  return Number(s);
}

export function campoSelecao<T extends string>(rotulo: string, valor: T, opcoes: { valor: T; texto: string }[], op: { ajuda?: string; classe?: string; aoMudar?: (v: T) => void; foco?: string } = {}) {
  const id = novoIdCampo();
  const select = el('select', { id, 'data-foco': op.foco, onchange: op.aoMudar ? () => op.aoMudar!(select.value as T) : undefined },
    ...opcoes.map((o) => el('option', { value: o.valor, selected: o.valor === valor }, o.texto)));
  select.value = valor;
  return { bloco: bloco(id, rotulo, select, op.ajuda, op.classe), select, valor: () => select.value as T };
}

export function campoData(rotulo: string, valor: string, op: { classe?: string; aoMudar?: (v: string) => void } = {}) {
  const id = novoIdCampo();
  const input = el('input', { id, type: 'date', value: valor, onchange: op.aoMudar ? () => op.aoMudar!(input.value) : undefined });
  return { bloco: bloco(id, rotulo, input, undefined, op.classe), input, valor: () => input.value };
}

export function caixaMarcar(rotulo: string, marcado: boolean, ajuda?: string) {
  const id = novoIdCampo();
  const input = el('input', { id, type: 'checkbox', checked: marcado });
  return { bloco: el('label', { class: 'marcar', for: id }, input, el('span', {}, el('strong', {}, rotulo), ajuda ? el('span', { class: 'ajuda' }, ajuda) : null)), input, marcado: () => input.checked };
}

export function busca(valor: string, aoMudar: (v: string) => void, op: { placeholder?: string; foco?: string } = {}) {
  const input = el('input', { type: 'search', value: valor, placeholder: op.placeholder ?? 'Buscar', 'aria-label': op.placeholder ?? 'Buscar', 'data-foco': op.foco ?? 'busca', autocomplete: 'off', oninput: () => aoMudar(input.value) });
  return el('div', { class: 'busca' }, icone('buscar', 18), input);
}

// ---------- Estrutura ----------

export function cabecalhoPagina(titulo: string, subtitulo?: Filho, ...acoes: Filho[]): HTMLElement {
  return el('div', { class: 'cabecalho-pagina' }, el('div', {}, el('h1', {}, titulo), subtitulo ? el('p', { class: 'subtitulo' }, subtitulo) : null), acoes.length ? el('div', { class: 'acoes' }, ...acoes) : null);
}

export function cartao(titulo: Filho, ...conteudo: Filho[]): HTMLElement {
  return el('section', { class: 'cartao' }, titulo ? el('h2', { class: 'titulo-cartao' }, titulo) : null, ...conteudo);
}

export function kpi(rotulo: string, valor: Filho, detalhe?: Filho, tom: '' | 'alerta' | 'perigo' | 'sucesso' = ''): HTMLElement {
  return el('div', { class: 'kpi ' + tom }, el('span', { class: 'rotulo' }, rotulo), el('strong', { class: 'valor' }, valor), detalhe ? el('span', { class: 'detalhe' }, detalhe) : null);
}

export function etiqueta(texto: string, tom: 'neutro' | 'alerta' | 'perigo' | 'sucesso' | 'info' = 'neutro'): HTMLElement {
  return el('span', { class: 'etiqueta ' + tom }, texto);
}

export function vazio(texto: string, ...acoes: Filho[]): HTMLElement {
  return el('div', { class: 'vazio' }, el('p', {}, texto), ...acoes);
}

export function aviso(texto: Filho, tom: 'info' | 'alerta' | 'perigo' = 'info', ...acoes: Filho[]): HTMLElement {
  return el('div', { class: 'aviso ' + tom, role: tom === 'perigo' ? 'alert' : 'note' }, el('div', { class: 'texto' }, texto), acoes.length ? el('div', { class: 'acoes' }, ...acoes) : null);
}

export function abas<T extends string>(atual: T, opcoes: { valor: T; texto: string; contador?: number }[], aoMudar: (v: T) => void): HTMLElement {
  return el('div', { class: 'abas', role: 'tablist' },
    ...opcoes.map((o) => el('button', { type: 'button', role: 'tab', class: 'aba', 'aria-selected': o.valor === atual ? 'true' : 'false', onclick: () => aoMudar(o.valor) },
      o.texto, o.contador ? el('span', { class: 'contador' }, o.contador) : null)));
}

export interface Coluna<T> {
  titulo: string;
  valor: (l: T) => Filho | Filho[];
  classe?: string;
}

export function tabela<T>(colunas: Coluna<T>[], linhas: T[], op: { aoClicar?: (l: T) => void; classeLinha?: (l: T) => string; vazio?: string; rotuloLinha?: (l: T) => string } = {}): HTMLElement {
  if (linhas.length === 0) return vazio(op.vazio ?? 'Nada por aqui.');
  return el('div', { class: 'tabela-rolagem' },
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {}, ...colunas.map((c) => el('th', { class: c.classe, scope: 'col' }, c.titulo)))),
      el('tbody', {}, ...linhas.map((l) => {
        const tr = el('tr', { class: (op.classeLinha?.(l) ?? '') + (op.aoClicar ? ' clicavel' : '') }, ...colunas.map((c) => el('td', { class: c.classe }, c.valor(l))));
        if (op.aoClicar) {
          tr.tabIndex = 0;
          if (op.rotuloLinha) tr.setAttribute('aria-label', op.rotuloLinha(l));
          tr.addEventListener('click', () => op.aoClicar!(l));
          tr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') op.aoClicar!(l);
          });
        }
        return tr;
      }))));
}

/** Barras horizontais simples (sem biblioteca). Valores em centavos ou unidades. */
export function barras(itens: { rotulo: string; valor: number; texto: string }[], op: { vazio?: string } = {}): HTMLElement {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  if (itens.length === 0 || max === 0) return vazio(op.vazio ?? 'Sem dados no período.');
  return el('div', { class: 'barras' },
    ...itens.map((i) => el('div', { class: 'barra-linha' },
      el('span', { class: 'barra-rotulo' }, i.rotulo),
      el('span', { class: 'barra-trilho' }, el('span', { class: 'barra', style: `width:${Math.max(2, (i.valor / max) * 100).toFixed(1)}%` })),
      el('span', { class: 'barra-valor' }, i.texto))));
}

/** Colunas verticais (vendas por hora/dia). */
export function colunas(itens: { rotulo: string; valor: number; texto: string }[]): HTMLElement {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return el('div', { class: 'colunas', role: 'img', 'aria-label': itens.filter((i) => i.valor > 0).map((i) => `${i.rotulo}: ${i.texto}`).join('; ') || 'Sem dados' },
    ...itens.map((i) => el('div', { class: 'coluna', title: `${i.rotulo}: ${i.texto}` },
      el('span', { class: 'coluna-barra', style: `height:${max ? Math.max(i.valor > 0 ? 3 : 0, (i.valor / max) * 100).toFixed(1) : 0}%` }),
      el('span', { class: 'coluna-rotulo' }, i.rotulo))));
}

export const dinheiro = (c: number) => formatarReais(c);
