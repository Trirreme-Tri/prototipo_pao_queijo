// Financeiro: contas a pagar, a receber e fluxo de caixa realizado.

import { aplicarNoModal, type Ctx } from '../app';
import { baixarConta, estornarConta, fluxoDeCaixa, removerConta, salvarConta, situacaoConta } from '../dominio/financeiro';
import type { Conta } from '../dominio/tipos';
import { chaveDoDia, dataCurta, novoId, somarDias } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { abas, aviso, botao, botaoIcone, cabecalhoPagina, campoData, campoDinheiro, campoSelecao, campoTexto, cartao, etiqueta, kpi, tabela } from '../ui/componentes';
import { abrirModal, confirmar, erroNoModal } from '../ui/modal';

function janelaConta(ctx: Ctx, tipo: Conta['tipo'], original: Conta | null): void {
  const hoje = chaveDoDia(ctx.agora());
  const c: Conta = original ?? { id: novoId(), tipo, descricao: '', categoria: tipo === 'pagar' ? 'Fornecedores' : 'Encomendas', valor: 0, vencimento: hoje, pagaEm: null };
  const desc = campoTexto('Descrição', c.descricao, { max: 80 });
  const valor = campoDinheiro('Valor', c.valor || null);
  const venc = campoData('Vencimento', c.vencimento);
  const cats = [...new Set([...ctx.estado.config.categoriasConta, c.categoria])];
  const cat = campoSelecao('Categoria', c.categoria, cats.map((x) => ({ valor: x, texto: x })));
  const ok = () => {
    const v = valor.ler();
    if (v == null || v <= 0) return erroNoModal(m, 'Valor inválido.');
    aplicarNoModal(ctx, m, (e) => salvarConta(e, { ...c, descricao: desc.valor(), valor: v, vencimento: venc.valor(), categoria: cat.valor() }), 'Conta salva');
  };
  const m = abrirModal(original ? 'Editar conta' : tipo === 'pagar' ? 'Nova conta a pagar' : 'Nova conta a receber', [desc.bloco, el('div', { class: 'grade-3' }, valor.bloco, venc.bloco, cat.bloco)], [
    botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
    botao('Salvar', ok),
  ]);
}

const TOM = { paga: 'sucesso', vencida: 'perigo', 'vence-hoje': 'alerta', aberta: 'neutro' } as const;
const TEXTO = { paga: 'paga', vencida: 'vencida', 'vence-hoje': 'vence hoje', aberta: 'em aberto' } as const;

export function financeiro(ctx: Ctx): Node[] {
  const hoje = chaveDoDia(ctx.agora());
  const inicioMes = hoje.slice(0, 8) + '01';
  const fimMes = somarDias(chaveDoDia(new Date(ctx.agora().getFullYear(), ctx.agora().getMonth() + 1, 1)), -1);
  const f = ctx.tela('financeiro', () => ({ aba: 'pagar' as 'pagar' | 'receber' | 'fluxo', mostrar: 'abertas' as 'abertas' | 'todas', de: inicioMes, ate: fimMes }));

  const contasDoTipo = (t: Conta['tipo']) => ctx.estado.contas.filter((c) => c.tipo === t);
  const abertoTotal = (t: Conta['tipo']) => contasDoTipo(t).filter((c) => !c.pagaEm).reduce((s, c) => s + c.valor, 0);
  const vencidas = ctx.estado.contas.filter((c) => situacaoConta(c, hoje) === 'vencida');

  let conteudo: Node[];
  if (f.aba === 'fluxo') {
    const fl = fluxoDeCaixa(ctx.estado, f.de, f.ate);
    conteudo = [
      el('div', { class: 'filtros' }, campoData('De', f.de, { aoMudar: (v) => { f.de = v || inicioMes; ctx.redesenhar(); } }).bloco, campoData('Até', f.ate, { aoMudar: (v) => { f.ate = v || fimMes; ctx.redesenhar(); } }).bloco),
      el('div', { class: 'kpis' }, kpi('Entradas', R(fl.entradas), null, 'sucesso'), kpi('Saídas', R(fl.saidas), null, 'perigo'), kpi('Saldo', R(fl.saldo), null, fl.saldo >= 0 ? 'sucesso' : 'perigo')),
      aviso('Entradas = vendas (menos o que foi no fiado) + fiado recebido + contas a receber baixadas. Saídas = contas pagas. Cartão entra no dia da venda (o prazo da maquininha não é considerado).'),
      cartao(null, tabela([
        { titulo: 'Dia', valor: (l) => dataCurta(l.dia) },
        { titulo: 'Entradas', valor: (l) => R(l.entradas), classe: 'num' },
        { titulo: 'Saídas', valor: (l) => R(l.saidas), classe: 'num' },
        { titulo: 'Saldo do dia', valor: (l) => el('strong', { class: l.entradas - l.saidas < 0 ? 'perigo-texto' : '' }, R(l.entradas - l.saidas)), classe: 'num' },
      ], fl.linhas, { vazio: 'Nenhum movimento no período.' })),
    ];
  } else {
    const t = f.aba;
    const lista = contasDoTipo(t).filter((c) => f.mostrar === 'todas' || !c.pagaEm).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    conteudo = [
      el('div', { class: 'filtros' }, campoSelecao('Mostrar', f.mostrar, [{ valor: 'abertas', texto: 'Em aberto' }, { valor: 'todas', texto: 'Todas' }], { aoMudar: (v) => { f.mostrar = v; ctx.redesenhar(); } }).bloco),
      cartao(null, tabela([
        { titulo: 'Vencimento', valor: (c) => dataCurta(c.vencimento) },
        { titulo: 'Descrição', valor: (c) => c.descricao },
        { titulo: 'Categoria', valor: (c) => c.categoria },
        { titulo: 'Situação', valor: (c) => { const s = situacaoConta(c, hoje); return etiqueta(TEXTO[s], TOM[s]); } },
        { titulo: 'Valor', valor: (c) => R(c.valor), classe: 'num' },
        { titulo: '', valor: (c) => el('div', { class: 'acoes-linha' },
          c.pagaEm
            ? botao('Desfazer', () => ctx.mudar((e) => estornarConta(e, c.id), 'Baixa desfeita'), { variante: 'fantasma' })
            : botao(t === 'pagar' ? 'Paguei' : 'Recebi', () => ctx.mudar((e) => baixarConta(e, c.id, ctx.agora()), 'Conta baixada'), { variante: 'sucesso' }),
          botaoIcone('editar', 'Editar conta', () => janelaConta(ctx, t, c)),
          botaoIcone('lixo', 'Excluir conta', () => confirmar('Excluir conta?', c.descricao, 'Excluir', () => ctx.mudar((e) => removerConta(e, c.id), 'Conta excluída'), true))) },
      ], lista, { classeLinha: (c) => (situacaoConta(c, hoje) === 'vencida' ? 'linha-alerta' : ''), vazio: 'Nenhuma conta aqui.' })),
    ];
  }

  return [
    cabecalhoPagina('Financeiro', null,
      botao('Conta a pagar', () => janelaConta(ctx, 'pagar', null), { icone: 'mais' }),
      botao('Conta a receber', () => janelaConta(ctx, 'receber', null), { variante: 'secundario', icone: 'mais' })),
    el('div', { class: 'kpis' },
      kpi('A pagar (em aberto)', R(abertoTotal('pagar'))),
      kpi('A receber (em aberto)', R(abertoTotal('receber'))),
      kpi('Vencidas', String(vencidas.length), vencidas.length ? R(vencidas.reduce((s, c) => s + c.valor, 0)) : 'nenhuma', vencidas.length ? 'perigo' : 'sucesso')),
    abas(f.aba, [{ valor: 'pagar', texto: 'A pagar' }, { valor: 'receber', texto: 'A receber' }, { valor: 'fluxo', texto: 'Fluxo de caixa' }], (v) => { f.aba = v; ctx.redesenhar(); }),
    ...conteudo,
  ];
}
