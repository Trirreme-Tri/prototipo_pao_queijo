import './estilos.css';
import { ROTAS, ROTAS_BARRA_CELULAR, type Ctx, type Rota } from './app';
import { armazemDoNavegador, carregar, CHAVE, salvar } from './armazenamento';
import { caixaAberto } from './dominio/caixa';
import type { Estado } from './dominio/tipos';
import { validarEstado } from './dominio/validacao';
import { avisar, el, icone } from './ui/base';
import { aviso, botao } from './ui/componentes';
import { fecharModalDoTopo, modalAberto } from './ui/modal';
import { caixa } from './telas/caixa';
import { cardapio, cardapioPublico } from './telas/cardapio';
import { clientes } from './telas/clientes';
import { config } from './telas/config';
import { cozinha } from './telas/cozinha';
import { estoque } from './telas/estoque';
import { financeiro } from './telas/financeiro';
import { painel } from './telas/painel';
import { producao } from './telas/producao';
import { produtos } from './telas/produtos';
import { relatorios } from './telas/relatorios';
import { vendas } from './telas/vendas';

const TELAS: Record<string, (ctx: Ctx) => Node[]> = {
  '/': painel, '/caixa': caixa, '/vendas': vendas, '/cardapio': cardapio, '/cozinha': cozinha, '/producao': producao,
  '/estoque': estoque, '/produtos': produtos, '/clientes': clientes, '/financeiro': financeiro, '/relatorios': relatorios, '/config': config,
};

const armazem = armazemDoNavegador();
const carga = carregar(armazem, new Date());
let estado: Estado = carga.estado;
if (carga.aviso === null || carga.aviso === 'migrado-v1') salvar(armazem, estado);
let avisoArmazenamento: string | null =
  carga.aviso === 'sem-armazenamento' ? 'Este navegador não está guardando os dados (modo anônimo?). O que você fizer some ao fechar.'
    : carga.aviso === 'dados-corrompidos' ? 'Os dados salvos estavam danificados. Começamos do zero; a cópia antiga foi guardada no navegador.'
      : carga.aviso === 'migrado-v1' ? 'Trouxemos os itens, o estoque e os clientes do protótipo anterior. Confira os preços e as unidades em Produtos.'
        : null;

const raiz = document.getElementById('app')!;
const telasUi = new Map<string, object>();
const celularMq = window.matchMedia('(max-width: 899px)');
let menuAberto = false;

function rotaAtual(): string {
  return location.hash.replace(/^#/, '') || '/';
}

function ir(rota: string): void {
  menuAberto = false;
  if (rotaAtual() === rota) desenhar();
  else location.hash = rota;
}

function aplicar(f: (e: Estado) => Estado, sucesso?: string): string | null {
  let novo: Estado;
  try {
    novo = f(estado);
  } catch (err) {
    return err instanceof Error ? err.message : 'Não deu certo.';
  }
  // Rede de segurança: nunca salva algo que não carregaria de volta.
  try {
    validarEstado(JSON.parse(JSON.stringify(novo)));
  } catch (err) {
    console.error(err);
    return 'Não deu para salvar: isso deixaria os dados inconsistentes. Nada foi alterado.';
  }
  estado = novo;
  if (!salvar(armazem, estado)) avisoArmazenamento = 'Não foi possível salvar neste navegador. Baixe uma cópia em Configurações.';
  desenhar();
  if (sucesso) avisar(sucesso);
  return null;
}

const ctx = (): Ctx => ({
  // Getter: quem guardou o ctx (ex.: uma janela aberta) sempre lê o estado atual.
  get estado() {
    return estado;
  },
  agora: () => new Date(),
  aplicar,
  mudar: (f, sucesso) => {
    const erro = aplicar(f, sucesso);
    if (erro) avisar(erro, 'erro');
    return erro === null;
  },
  tela: <T extends object>(chave: string, criar: () => T): T => {
    if (!telasUi.has(chave)) telasUi.set(chave, criar());
    return telasUi.get(chave) as T;
  },
  redesenhar: desenhar,
  ir,
  urlBase: location.origin + location.pathname,
  celular: celularMq.matches,
  substituirEstado: (novo, mensagem) => {
    estado = novo;
    telasUi.clear();
    salvar(armazem, estado);
    ir('/');
    avisar(mensagem);
  },
});

function linkMenu(r: Rota, atual: string, celular: boolean): HTMLElement {
  const bloqueado = celular && !r.celular;
  return el('a', { href: '#' + r.caminho, class: 'item-menu' + (r.caminho === atual ? ' ativo' : '') + (bloqueado ? ' so-pc' : ''), 'aria-current': r.caminho === atual ? 'page' : undefined, onclick: () => (menuAberto = false) },
    icone(r.icone, 20), el('span', {}, r.titulo), bloqueado ? el('small', {}, 'PC') : r.atalho ? el('kbd', {}, r.atalho) : null);
}

function menuLateral(atual: string, celular: boolean): HTMLElement {
  const grupos = [...new Set(ROTAS.map((r) => r.grupo))];
  const sessao = caixaAberto(estado);
  return el('nav', { class: 'menu-lateral' + (menuAberto ? ' aberto' : ''), 'aria-label': 'Menu principal' },
    el('div', { class: 'marca' }, el('strong', {}, estado.config.nomeLoja), el('span', {}, 'Gestão da loja')),
    ...grupos.map((g) => el('div', { class: 'grupo-menu' }, el('span', { class: 'titulo-grupo' }, g), ...ROTAS.filter((r) => r.grupo === g).map((r) => linkMenu(r, atual, celular)))),
    el('div', { class: 'status-caixa ' + (sessao ? 'aberto' : 'fechado') }, sessao ? `Caixa aberto · ${sessao.operador}` : 'Caixa fechado'));
}

function barraCelular(atual: string): HTMLElement {
  return el('nav', { class: 'barra-celular', 'aria-label': 'Atalhos' },
    ...ROTAS.filter((r) => ROTAS_BARRA_CELULAR.includes(r.caminho)).map((r) =>
      el('a', { href: '#' + r.caminho, class: r.caminho === atual ? 'ativo' : '', 'aria-current': r.caminho === atual ? 'page' : undefined }, icone(r.icone, 22), el('span', {}, r.titulo))),
    el('button', { type: 'button', class: menuAberto ? 'ativo' : '', 'aria-expanded': menuAberto ? 'true' : 'false', onclick: () => { menuAberto = !menuAberto; desenhar(); } }, icone('menu', 22), el('span', {}, 'Mais')));
}

function soNoComputador(r: Rota): Node[] {
  return [el('div', { class: 'so-computador' }, icone(r.icone, 48), el('h1', {}, r.titulo),
    el('p', {}, 'Esta tela foi feita para o computador (tela grande, teclado e impressora).'),
    el('p', { class: 'ajuda' }, 'No celular: Painel, Cozinha, Produção, Estoque, Clientes, Cardápio e Configurações.'),
    botao('Voltar ao painel', () => ir('/'), { variante: 'secundario' }))];
}

function desenhar(): void {
  const rota = rotaAtual();
  // Lembra o campo focado para devolver o foco depois do redesenho (ex.: busca do caixa).
  const ativo = document.activeElement as HTMLInputElement | null;
  const chaveFoco = ativo?.dataset?.foco;
  const selecao = chaveFoco && 'selectionStart' in ativo! ? [ativo.selectionStart, ativo.selectionEnd] : null;

  if (rota.startsWith('/c/')) {
    document.body.className = 'modo-publico';
    raiz.replaceChildren(...cardapioPublico(rota.slice(3), desenhar));
    return;
  }
  document.body.className = '';
  const c = ctx();
  const r = ROTAS.find((x) => x.caminho === rota) ?? ROTAS[0];
  const conteudo = c.celular && !r.celular ? soNoComputador(r) : TELAS[r.caminho](c);
  const avisos = [
    avisoArmazenamento ? aviso(avisoArmazenamento, 'alerta', botao('Entendi', () => { avisoArmazenamento = null; desenhar(); }, { variante: 'secundario' })) : null,
    estado.config.demonstracao && r.caminho === '/' ? aviso('Dados de demonstração: loja fictícia, preços e vendas inventados.', 'info', botao('Começar do zero', () => ir('/config'), { variante: 'secundario' })) : null,
  ];

  const rolagem = window.scrollY;
  raiz.replaceChildren(
    el('div', { class: 'casca' + (c.celular ? ' celular' : '') },
      c.celular
        ? el('header', { class: 'topo-celular' }, el('strong', {}, estado.config.nomeLoja), el('span', {}, r.titulo))
        : null,
      menuLateral(r.caminho, c.celular),
      c.celular && menuAberto ? el('div', { class: 'fundo-menu', onclick: () => { menuAberto = false; desenhar(); } }) : null,
      el('main', { class: 'conteudo', id: 'conteudo' }, ...(avisos.filter(Boolean) as Node[]), ...conteudo),
      c.celular ? barraCelular(r.caminho) : null));
  document.title = `${r.titulo} · ${estado.config.nomeLoja}`;
  window.scrollTo(0, raiz.dataset.rota === rota ? rolagem : 0);
  raiz.dataset.rota = rota;

  if (chaveFoco) {
    const novo = raiz.querySelector<HTMLInputElement>(`[data-foco="${CSS.escape(chaveFoco)}"]`);
    if (novo && !modalAberto()) {
      novo.focus();
      if (selecao && typeof selecao[0] === 'number') novo.setSelectionRange(selecao[0], selecao[1]);
    }
  } else if (rota === '/caixa' && !modalAberto() && document.activeElement === document.body) {
    raiz.querySelector<HTMLElement>('[data-foco="pdv-busca"]')?.focus();
  }
}

window.addEventListener('hashchange', () => {
  menuAberto = false;
  desenhar();
});
celularMq.addEventListener('change', desenhar);

// Outra aba (ex.: cozinha aberta noutra janela) mudou os dados: recarrega para não sobrescrever.
window.addEventListener('storage', (e) => {
  if (e.key !== CHAVE) return;
  const novo = carregar(armazem, new Date());
  if (novo.aviso === null) {
    estado = novo.estado;
    desenhar();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fecharModalDoTopo()) {
    e.preventDefault();
    return;
  }
  if (e.key === 'F9' && !modalAberto()) {
    e.preventDefault();
    ir('/caixa');
  }
});

// A cozinha mostra "há X min": atualiza a cada 30 s se ninguém estiver digitando.
window.setInterval(() => {
  if (rotaAtual() === '/cozinha' && !modalAberto()) desenhar();
}, 30_000);

desenhar();
