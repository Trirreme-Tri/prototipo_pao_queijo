// Montagem de tela sem innerHTML: todo texto entra como textContent (sem XSS).

export type Filho = Node | string | number | null | undefined | false;
type Valor = string | number | boolean | ((e: Event) => void) | ((e: KeyboardEvent) => void) | undefined;
export type Atributos = Record<string, Valor>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Atributos = {}, ...filhos: (Filho | Filho[])[]): HTMLElementTagNameMap[K] {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') no.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') no.className = String(v);
    else if (k === 'value' && 'value' in no) (no as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in no) (no as HTMLInputElement).checked = Boolean(v);
    else no.setAttribute(k, v === true ? '' : String(v));
  }
  anexar(no, filhos.flat());
  return no;
}

export function anexar(no: Node, filhos: Filho[]): void {
  for (const f of filhos) {
    if (f === null || f === undefined || f === false) continue;
    no.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
  }
}

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag: string, attrs: Record<string, string | number>, ...filhos: Element[]): SVGElement {
  const no = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) no.setAttribute(k, String(v));
  for (const f of filhos) no.appendChild(f);
  return no;
}

// Ícones de traço simples, desenhados para este projeto (24×24).
const ICONES: Record<string, string[]> = {
  painel: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  caixa: ['M3 5h2l2 10h11l2-7H7', 'M9 20a1 1 0 1 0 0-.01', 'M17 20a1 1 0 1 0 0-.01'],
  vendas: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6'],
  cozinha: ['M12 3c3 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z'],
  producao: ['M3 10h18v10H3z', 'M6 10V6a6 6 0 0 1 12 0v4', 'M7 15h10'],
  estoque: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4', 'M12 11v10'],
  produtos: ['M3 12V4h8l10 10-8 8z', 'M7.5 8a.5.5 0 1 0 0-.01'],
  clientes: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21c0-4 3-6 7-6s7 2 7 6', 'M16 4a4 4 0 0 1 0 7', 'M19 15c2 1 3 3 3 6'],
  financeiro: ['M3 7h18v12H3z', 'M3 7l3-3h12l3 3', 'M16 13h2'],
  relatorios: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  cardapio: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 18h2v2h-2z', 'M14 18h2', 'M18 14h2'],
  config: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M4.9 19.1L7 17', 'M17 7l2.1-2.1'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  mais: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  lixo: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  editar: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  imprimir: ['M7 9V3h10v6', 'M5 9h14a2 2 0 0 1 2 2v6h-4', 'M7 17H3v-6a2 2 0 0 1 2-2', 'M7 14h10v7H7z'],
  buscar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M21 21l-5-5'],
  alerta: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17v.5'],
  ok: ['M4 12l5 5L20 6'],
  voltar: ['M15 18l-6-6 6-6'],
  seta: ['M9 18l6-6-6-6'],
  baixar: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 20h16'],
  subir: ['M12 21V9', 'M7 14l5-5 5 5', 'M4 4h16'],
  link: ['M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1', 'M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1'],
  whatsapp: ['M4 20l1.5-4A8 8 0 1 1 9 19z', 'M9 9c0 3 3 6 6 6l1-2-2-1-1 1c-1 0-2-1-2-2l1-1-1-2z'],
  relogio: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
};

export type NomeIcone = keyof typeof ICONES;

export function icone(nome: NomeIcone, tamanho = 22): SVGElement {
  return svg('svg', { width: tamanho, height: tamanho, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icone' },
    ...ICONES[nome].map((d) => svg('path', { d })));
}

const ultimoToque = new Map<string, number>();
/** Ignora o segundo toque rápido no mesmo botão (duplo toque sem querer). */
export function toqueUnico(chave: string, ms = 1200): boolean {
  const agora = Date.now();
  if (agora - (ultimoToque.get(chave) ?? 0) < ms) return false;
  ultimoToque.set(chave, agora);
  return true;
}

let temporizador: number | undefined;
export function avisar(texto: string, tipo: 'ok' | 'erro' = 'ok'): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast ' + tipo, role: tipo === 'erro' ? 'alert' : 'status' }, texto);
  document.body.appendChild(t);
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => t.remove(), tipo === 'erro' ? 4500 : 2600);
}

/** Baixa um arquivo gerado no navegador (backup, CSV). */
export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el('a', { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Imprime só o conteúdo informado (comprovante, fechamento, QR). */
export function imprimir(...conteudo: Node[]): void {
  const area = document.getElementById('impressao') ?? document.body.appendChild(el('div', { id: 'impressao' }));
  area.replaceChildren(...conteudo);
  document.body.classList.add('imprimindo-trecho');
  const limpar = () => document.body.classList.remove('imprimindo-trecho');
  window.addEventListener('afterprint', limpar, { once: true });
  window.print();
  setTimeout(limpar, 1000);
}
