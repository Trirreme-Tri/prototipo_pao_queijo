import './estilos.css';
import { apagarTudo, armazemDoNavegador, carregar, salvar } from './armazenamento';
import { estadoInicial, type Estado } from './estado';
import * as T from './telas';
import { aviso, avisar, el } from './ui';

const armazem = armazemDoNavegador();
const carga = carregar(armazem);
let estado: Estado = carga.estado;
let avisoArmazenamento: string | null =
  carga.aviso === 'sem-armazenamento'
    ? 'este navegador não está guardando os dados (modo anônimo?). O que você fizer some ao fechar.'
    : carga.aviso === 'dados-corrompidos'
      ? 'os dados salvos estavam danificados. Começamos do zero; a cópia antiga foi guardada.'
      : null;

const ui: T.Contexto['ui'] = { edicao: null, clienteSelecionado: null };
const raiz = document.getElementById('app')!;

function rotaAtual(): string {
  return location.hash.replace(/^#/, '') || '/';
}

function ir(rota: string): void {
  ui.edicao = null;
  ui.clienteSelecionado = null;
  if (rotaAtual() === rota) desenhar();
  else location.hash = rota;
}

function mudar(f: (e: Estado) => Estado, mensagem?: string): boolean {
  try {
    estado = f(estado);
  } catch (err) {
    avisar(err instanceof Error ? err.message : 'Não deu certo.');
    return false;
  }
  if (!salvar(armazem, estado)) {
    avisoArmazenamento = 'não foi possível salvar neste navegador. Faça uma cópia em arquivo (Início → Cópia de segurança).';
  }
  desenhar();
  if (mensagem) avisar(mensagem);
  return true;
}

const contexto = (): T.Contexto => ({
  estado,
  mudar,
  ir,
  agora: () => new Date(),
  ui,
  redesenhar: desenhar,
  substituirEstado: (novo) => {
    estado = novo;
    salvar(armazem, estado);
    ir('/');
  },
  apagarTudo: () => {
    apagarTudo(armazem);
    estado = estadoInicial();
    salvar(armazem, estado);
    ir('/');
    avisar('Tudo apagado');
  },
  urlBase: location.origin + location.pathname,
});

function desenhar(): void {
  const rota = rotaAtual();
  const ctx = contexto();
  let nos: Node[];
  if (rota.startsWith('/c/')) nos = T.cardapioPublico(rota.slice(3));
  else if (rota === '/fornadas') nos = T.fornadas(ctx);
  else if (rota === '/cardapio') nos = T.cardapio(ctx);
  else if (rota === '/estoque') nos = T.estoque(ctx);
  else if (rota === '/prazo') nos = T.prazo(ctx);
  else if (rota === '/vendas') nos = T.vendas(ctx);
  else if (rota === '/dados') nos = T.dados(ctx);
  else nos = T.inicio(ctx);

  const publico = rota.startsWith('/c/');
  if (avisoArmazenamento && !publico) nos.splice(1, 0, aviso('Atenção:', avisoArmazenamento, true));
  if (!publico) nos.push(el('footer', { class: 'rodape' }, 'Protótipo de demonstração · TRIRREME'));

  const rolagem = window.scrollY;
  raiz.replaceChildren(...nos);
  const titulo = raiz.querySelector('h1')?.textContent ?? '';
  document.title = titulo ? titulo + ' · Casa do Pão de Queijo' : 'Casa do Pão de Queijo';
  // Mantém a posição ao editar na mesma tela; ao trocar de tela, volta ao topo.
  window.scrollTo(0, raiz.dataset.rota === rota ? rolagem : 0);
  raiz.dataset.rota = rota;
  // Foca o primeiro campo de um formulário recém-aberto.
  const campo = raiz.querySelector<HTMLInputElement>('form.painel input');
  if (campo && ui.edicao) campo.focus({ preventScroll: false });
}

window.addEventListener('hashchange', () => {
  ui.edicao = null;
  ui.clienteSelecionado = null;
  desenhar();
});
window.addEventListener('storage', (e) => {
  // Outra aba mudou os dados: recarrega para não sobrescrever.
  if (e.key && e.key.startsWith('casa-pao-de-queijo')) {
    estado = carregar(armazem).estado;
    desenhar();
  }
});
desenhar();
