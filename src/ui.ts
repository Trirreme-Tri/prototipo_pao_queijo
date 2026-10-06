// Pequenos ajudantes para montar a tela sem innerHTML.
// Todo texto entra como textContent, então nome digitado nunca vira código (sem XSS).

type Filho = Node | string | number | null | undefined | false;
type Atributos = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Atributos = {}, ...filhos: Filho[]): HTMLElementTagNameMap[K] {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') no.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') no.className = String(v);
    else if (k === 'value' && 'value' in no) (no as HTMLInputElement).value = String(v);
    else no.setAttribute(k, v === true ? '' : String(v));
  }
  anexar(no, filhos);
  return no;
}

export function anexar(no: Node, filhos: Filho[]): void {
  for (const f of filhos) {
    if (f === null || f === undefined || f === false) continue;
    no.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
  }
}

const SVG = 'http://www.w3.org/2000/svg';
export function svg(tag: string, attrs: Record<string, string | number>, ...filhos: Element[]): SVGElement {
  const no = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) no.setAttribute(k, String(v));
  for (const f of filhos) no.appendChild(f);
  return no;
}

function icone(caminhos: Element[], tamanho: number): SVGElement {
  return svg('svg', { width: tamanho, height: tamanho, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, ...caminhos);
}

// ---------- Componentes do design system ----------

export function cabecalho(titulo: string, aoMenu?: () => void): HTMLElement {
  const linhas = [6, 12, 18].map((y) => svg('line', { x1: 4, x2: 20, y1: y, y2: y }));
  return el('header', { class: 'cabecalho' },
    el('div', { class: 'linha' },
      aoMenu ? el('button', { type: 'button', class: 'menu', 'aria-label': 'Abrir menu', onclick: aoMenu }, icone(linhas, 32)) : null,
      el('h1', {}, titulo)));
}

export function aviso(titulo: string, texto: string, forte = false): HTMLElement {
  return el('div', { class: forte ? 'aviso forte' : 'aviso', role: 'note' }, el('strong', {}, titulo), ' ', texto);
}

export function botao(texto: string, aoClicar: () => void, opcoes: { variante?: 'secundario' | 'perigo'; total?: boolean; desabilitado?: boolean; tipo?: 'button' | 'submit' } = {}): HTMLButtonElement {
  const classes = ['botao', opcoes.variante, opcoes.total ? 'total' : ''].filter(Boolean).join(' ');
  return el('button', {
    type: opcoes.tipo ?? 'button',
    class: classes,
    'aria-disabled': opcoes.desabilitado ? 'true' : undefined,
    onclick: (e: Event) => {
      if (opcoes.desabilitado) {
        e.preventDefault();
        return;
      }
      aoClicar();
    },
  }, texto);
}

export function itemMenu(rotulo: string, aoClicar: (() => void) | null, legenda?: string): HTMLButtonElement {
  const seta = icone([svg('path', { d: 'm9 18 6-6-6-6' })], 28);
  return el('button', { type: 'button', class: 'item-menu', 'aria-disabled': aoClicar ? undefined : 'true', onclick: () => aoClicar?.() },
    el('span', { class: 'textos' }, el('span', { class: 'rotulo' }, rotulo), legenda ? el('span', { class: 'legenda' }, legenda) : null),
    aoClicar ? el('span', { class: 'seta' }, seta) : null);
}

export function linhaLista(nome: Filho, valor: Filho, opcoes: { detalhe?: string; destaque?: boolean; aoClicar?: () => void; selecionado?: boolean; rotuloAcessivel?: string } = {}): HTMLElement {
  const classes = ['linha-lista', opcoes.destaque ? 'destaque' : '', opcoes.selecionado ? 'selecionado' : ''].filter(Boolean).join(' ');
  const corpo: Filho[] = [
    el('span', { class: 'nome' }, nome, opcoes.detalhe ? el('span', { class: 'detalhe' }, opcoes.detalhe) : null),
    el('span', { class: 'valor' }, valor),
  ];
  if (opcoes.aoClicar) {
    return el('button', { type: 'button', class: classes, onclick: opcoes.aoClicar, 'aria-pressed': opcoes.selecionado ? 'true' : 'false', title: opcoes.rotuloAcessivel }, ...corpo);
  }
  return el('div', { class: classes }, ...corpo);
}

export function pendente(texto: string): HTMLElement {
  return el('span', { class: 'pendente', title: 'Ainda não informado' }, '[' + texto + ']');
}

export function cartao(rotulo: string, valor: string | number, unidade?: string): HTMLElement {
  return el('div', { class: 'cartao' }, el('span', { class: 'rotulo' }, rotulo), el('span', { class: 'valor' }, valor, unidade ? el('span', { class: 'unidade' }, unidade) : null));
}

export function tituloSecao(texto: string): HTMLElement {
  return el('h2', { class: 'titulo-secao' }, texto);
}

let idCampo = 0;
export function campoTexto(rotulo: string, valor: string, opcoes: { ajuda?: string; modo?: 'decimal' | 'numeric' | 'text'; nome?: string; maximo?: number } = {}): { bloco: HTMLElement; input: HTMLInputElement } {
  idCampo += 1;
  const id = 'campo-' + idCampo;
  const input = el('input', { id, type: 'text', value: valor, inputmode: opcoes.modo, name: opcoes.nome, maxlength: opcoes.maximo ?? 80, autocomplete: 'off', 'aria-describedby': opcoes.ajuda ? id + '-ajuda' : undefined });
  const bloco = el('div', { class: 'campo' }, el('label', { for: id }, rotulo), input, opcoes.ajuda ? el('span', { class: 'ajuda', id: id + '-ajuda' }, opcoes.ajuda) : null);
  return { bloco, input };
}

export function campoNumerico(rotulo: string, valor: number | null, unidade: string): { bloco: HTMLElement; ler: () => number | null } {
  idCampo += 1;
  const id = 'campo-' + idCampo;
  const input = el('input', { id, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: valor == null ? '' : String(valor), 'aria-describedby': id + '-un', autocomplete: 'off' });
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 5);
  });
  const mudar = (d: number) => {
    const atual = input.value === '' ? 0 : Number(input.value);
    input.value = String(Math.max(0, atual + d));
  };
  const bloco = el('div', { class: 'campo' },
    el('label', { for: id }, rotulo),
    el('div', { class: 'numerico' },
      el('button', { type: 'button', class: 'passo', 'aria-label': 'Diminuir', onclick: () => mudar(-1) }, '−'),
      input,
      el('button', { type: 'button', class: 'passo', 'aria-label': 'Aumentar', onclick: () => mudar(1) }, '+')),
    el('span', { class: 'ajuda', id: id + '-un' }, unidade));
  return { bloco, ler: () => (input.value === '' ? null : Number(input.value)) };
}

let temporizador: number | undefined;
export function avisar(texto: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, texto);
  document.body.appendChild(t);
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => t.remove(), 2600);
}
