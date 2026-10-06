// Janela sobreposta (diálogo). Fica fora de #app, então o redesenho da tela não a apaga.
// Esc fecha; o foco vai para o primeiro campo e volta para onde estava ao fechar.

import { el, icone, type Filho } from './base';

export interface Modal {
  fechar: () => void;
  corpo: HTMLElement;
  rodape: HTMLElement;
  /** Troca o conteúdo sem fechar (para janelas que mudam, como a de pagamento). */
  trocar: (corpo: Filho[], rodape?: Filho[]) => void;
}

const pilha: { no: HTMLElement; fechar: () => void }[] = [];

export function modalAberto(): boolean {
  return pilha.length > 0;
}

export function fecharModalDoTopo(): boolean {
  const topo = pilha.at(-1);
  if (!topo) return false;
  topo.fechar();
  return true;
}

export function abrirModal(titulo: string, corpo: Filho[], rodape: Filho[] = [], op: { largura?: 'p' | 'm' | 'g'; aoFechar?: () => void; testid?: string } = {}): Modal {
  const voltarFoco = document.activeElement as HTMLElement | null;
  const idTitulo = 'modal-titulo-' + (pilha.length + 1);
  const areaCorpo = el('div', { class: 'modal-corpo' }, ...corpo);
  const areaRodape = el('div', { class: 'modal-rodape' }, ...rodape);
  let fechado = false;
  const fechar = () => {
    if (fechado) return;
    fechado = true;
    fundo.remove();
    const i = pilha.findIndex((p) => p.no === fundo);
    if (i >= 0) pilha.splice(i, 1);
    op.aoFechar?.();
    if (voltarFoco && document.contains(voltarFoco)) voltarFoco.focus();
  };
  const janela = el('div', { class: 'modal ' + (op.largura ?? 'm'), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo, 'data-testid': op.testid },
    el('div', { class: 'modal-topo' },
      el('h2', { id: idTitulo }, titulo),
      el('button', { type: 'button', class: 'botao-icone fantasma', 'aria-label': 'Fechar', title: 'Fechar (Esc)', onclick: fechar }, icone('fechar', 20))),
    areaCorpo, areaRodape);
  const fundo = el('div', { class: 'modal-fundo', onmousedown: (e: Event) => { if (e.target === fundo) fechar(); } }, janela);
  janela.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    // Mantém o Tab dentro da janela.
    const focaveis = [...janela.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href], [tabindex="0"]')];
    if (focaveis.length === 0) return;
    const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  });
  document.body.appendChild(fundo);
  pilha.push({ no: fundo, fechar });
  const focar = () => (janela.querySelector<HTMLElement>('[data-autofoco]') ?? janela.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea') ?? janela.querySelector<HTMLElement>('.modal-rodape .botao'))?.focus();
  focar();
  return {
    fechar,
    corpo: areaCorpo,
    rodape: areaRodape,
    trocar: (novoCorpo, novoRodape) => {
      areaCorpo.replaceChildren(...(novoCorpo.filter(Boolean) as Node[]).map((n) => (typeof n === 'string' || typeof n === 'number' ? document.createTextNode(String(n)) : n)));
      if (novoRodape) areaRodape.replaceChildren(...(novoRodape.filter(Boolean) as Node[]));
    },
  };
}

/** Confirmação simples. Devolve via callback para não travar a tela. */
export function confirmar(titulo: string, texto: string, rotuloOk: string, aoConfirmar: () => void, perigo = false): void {
  const m = abrirModal(titulo, [el('p', {}, texto)], [
    el('button', { type: 'button', class: 'botao secundario', onclick: () => m.fechar() }, 'Voltar'),
    el('button', { type: 'button', class: 'botao ' + (perigo ? 'perigo' : 'primario'), 'data-autofoco': true, onclick: () => { m.fechar(); aoConfirmar(); } }, rotuloOk),
  ], { largura: 'p' });
}

/** Mostra o erro dentro da janela (sem fechar), para a pessoa corrigir. */
export function erroNoModal(m: Modal, mensagem: string): void {
  m.corpo.querySelector('.erro-form')?.remove();
  m.corpo.prepend(el('p', { class: 'erro-form', role: 'alert' }, mensagem));
}
