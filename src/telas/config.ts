// Configurações: dados da loja, categorias, cópia de segurança e dados de demonstração.

import type { Ctx } from '../app';
import { caixaAberto } from '../dominio/caixa';
import { dadosDemonstracao, estadoVazio } from '../dominio/inicial';
import { chaveDoDia } from '../dominio/util';
import { validarEstado } from '../dominio/validacao';
import { numeroWhatsApp } from '../cardapioLink';
import { avisar, baixarArquivo, el } from '../ui/base';
import { aviso, botao, botaoIcone, cabecalhoPagina, campoTexto, cartao } from '../ui/componentes';
import { confirmar } from '../ui/modal';

export function config(ctx: Ctx): Node[] {
  const c = ctx.estado.config;
  const nome = campoTexto('Nome da loja', c.nomeLoja, { max: 80 });
  const whats = campoTexto('WhatsApp da loja (com DDD)', c.whatsapp, { max: 20, modo: 'tel', ajuda: 'Usado no botão "pedir pelo WhatsApp" do cardápio.' });
  const end = campoTexto('Endereço (sai no comprovante)', c.endereco, { max: 200 });
  const salvarLoja = (e: Event) => {
    e.preventDefault();
    const w = whats.valor().replace(/\D/g, '');
    if (w && !numeroWhatsApp(w)) return avisar('WhatsApp: use DDD + número (10 ou 11 dígitos).', 'erro');
    if (!nome.valor().trim()) return avisar('Preencha o nome da loja.', 'erro');
    ctx.mudar((est) => ({ ...est, config: { ...est.config, nomeLoja: nome.valor().trim(), whatsapp: w, endereco: end.valor().trim() } }), 'Dados da loja salvos');
  };

  const novaCat = campoTexto('Nova categoria', '', { max: 40 });
  const addCat = (e: Event) => {
    e.preventDefault();
    const n = novaCat.valor().trim();
    if (!n) return;
    if (c.categorias.some((x) => x.toLowerCase() === n.toLowerCase())) return avisar('Essa categoria já existe.', 'erro');
    ctx.mudar((est) => ({ ...est, config: { ...est.config, categorias: [...est.config.categorias, n] } }), 'Categoria criada');
  };
  const remCat = (cat: string) => {
    if (ctx.estado.produtos.some((p) => p.ativo && p.categoria === cat)) return avisar('Há produtos nessa categoria. Mude-os antes.', 'erro');
    ctx.mudar((est) => ({ ...est, config: { ...est.config, categorias: est.config.categorias.filter((x) => x !== cat) } }));
  };

  const importar = el('input', { type: 'file', accept: 'application/json,.json', class: 'escondido', 'aria-label': 'Escolher arquivo de cópia' });
  importar.addEventListener('change', async () => {
    const arq = importar.files?.[0];
    if (!arq) return;
    try {
      if (arq.size > 5_000_000) throw new Error('Arquivo grande demais.');
      const novo = validarEstado(JSON.parse(await arq.text()));
      confirmar('Restaurar cópia?', 'Os dados atuais deste aparelho serão trocados pelos do arquivo.', 'Restaurar', () => ctx.substituirEstado(novo, 'Cópia restaurada'), true);
    } catch {
      avisar('Esse arquivo não é uma cópia válida do sistema.', 'erro');
    } finally {
      importar.value = '';
    }
  });

  return [
    cabecalhoPagina('Configurações'),
    el('div', { class: 'grade-2 topo' },
      cartao('Dados da loja', el('form', { class: 'form', onsubmit: salvarLoja }, nome.bloco, whats.bloco, end.bloco, botao('Salvar', () => {}, { tipo: 'submit' }))),
      cartao('Categorias do cardápio',
        el('ul', { class: 'lista-simples' }, ...c.categorias.map((cat) => el('li', {}, el('span', {}, cat), botaoIcone('lixo', `Remover ${cat}`, () => remCat(cat))))),
        el('form', { class: 'form linha', onsubmit: addCat }, novaCat.bloco, botao('Adicionar', () => {}, { tipo: 'submit', variante: 'secundario' })))),
    cartao('Onde ficam os dados',
      aviso('Os dados ficam guardados neste navegador, neste aparelho. Outro computador ou celular tem os seus próprios dados (este protótipo não tem servidor). Abas abertas no mesmo navegador se atualizam sozinhas. Limpar o navegador apaga tudo: faça cópias.'),
      el('div', { class: 'acoes-linha quebra' },
        botao('Baixar cópia de segurança', () => baixarArquivo(`casa-pao-de-queijo-${chaveDoDia(ctx.agora())}.json`, JSON.stringify(ctx.estado), 'application/json'), { icone: 'baixar' }),
        botao('Restaurar de um arquivo', () => importar.click(), { variante: 'secundario', icone: 'subir' }),
        importar)),
    cartao('Dados de demonstração',
      c.demonstracao ? aviso('Você está usando dados de exemplo (loja fictícia, preços inventados).', 'alerta') : null,
      el('div', { class: 'acoes-linha quebra' },
        botao('Carregar demonstração', () => confirmar('Carregar demonstração?', 'Troca os dados atuais por uma loja fictícia com 7 dias de movimento.', 'Carregar', () => ctx.substituirEstado(dadosDemonstracao(ctx.agora()), 'Demonstração carregada'), true), { variante: 'secundario' }),
        botao('Começar do zero', () => confirmar('Apagar tudo e começar do zero?', caixaAberto(ctx.estado) ? 'Há um caixa aberto. Tudo neste aparelho será apagado: produtos, vendas, estoque, contas.' : 'Tudo neste aparelho será apagado: produtos, vendas, estoque, contas.', 'Apagar tudo', () => ctx.substituirEstado({ ...estadoVazio(), config: { ...estadoVazio().config, nomeLoja: c.nomeLoja, whatsapp: c.whatsapp, endereco: c.endereco } }, 'Tudo apagado'), true), { variante: 'perigo' }))),
    el('p', { class: 'ajuda' }, 'Protótipo de demonstração · TRIRREME. Controle interno: não emite nota fiscal.'),
  ].filter(Boolean) as Node[];
}
