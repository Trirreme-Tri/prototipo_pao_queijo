// Clientes e fiado: cadastro, limite, extrato e recebimento.

import { aplicarNoModal, type Ctx } from '../app';
import { caixaAberto, removerCliente, saldoFiado, salvarCliente, totalFiado } from '../dominio/caixa';
import type { Cliente } from '../dominio/tipos';
import { dataHora } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';
import { aviso, botao, busca, cabecalhoPagina, campoDinheiro, campoTexto, cartao, etiqueta, kpi, tabela } from '../ui/componentes';
import { abrirModal, confirmar, erroNoModal } from '../ui/modal';
import { janelaReceberFiado } from './caixa';
import { novoId } from '../dominio/util';

function janelaCliente(ctx: Ctx, original: Cliente | null): void {
  const c: Cliente = original ?? { id: novoId(), nome: '', telefone: '', limite: null, ativo: true };
  const nome = campoTexto('Nome', c.nome, { max: 60 });
  const tel = campoTexto('Telefone (com DDD)', c.telefone, { max: 20, modo: 'tel' });
  const limite = campoDinheiro('Limite de fiado', c.limite, { ajuda: 'Deixe vazio para não ter limite.' });
  const ok = () => {
    const l = limite.input.value.trim() ? limite.ler() : null;
    if (limite.input.value.trim() && l == null) return erroNoModal(m, 'Limite inválido.');
    aplicarNoModal(ctx, m, (e) => salvarCliente(e, { ...c, nome: nome.valor(), telefone: tel.valor(), limite: l }), 'Cliente salvo');
  };
  const m = abrirModal(original ? 'Editar cliente' : 'Novo cliente', [nome.bloco, el('div', { class: 'grade-2' }, tel.bloco, limite.bloco)], [
    original ? botao('Excluir', () => confirmar('Excluir cliente?', 'Só dá para excluir quem não deve nada.', 'Excluir', () => { if (ctx.mudar((e) => removerCliente(e, original.id), 'Cliente excluído')) m.fechar(); }, true), { variante: 'perigo' }) : null,
    el('span', { class: 'espaco' }),
    botao('Voltar', () => m.fechar(), { variante: 'secundario' }),
    botao('Salvar', ok),
  ], { largura: 'p' });
}

function janelaExtrato(ctx: Ctx, c: Cliente): void {
  const lanc = ctx.estado.fiado.filter((l) => l.clienteId === c.id).slice().reverse();
  const saldo = saldoFiado(ctx.estado, c.id);
  const m = abrirModal(`Fiado: ${c.nome}`, [
    el('div', { class: 'kpis' }, saldo < 0 ? kpi('Crédito a favor', R(-saldo), 'abate na próxima compra no fiado', 'sucesso') : kpi('Deve', R(saldo), null, saldo > 0 ? 'alerta' : 'sucesso'), kpi('Limite', c.limite == null ? 'sem limite' : R(c.limite))),
    tabela([
      { titulo: 'Quando', valor: (l) => dataHora(l.quando) },
      { titulo: 'O quê', valor: (l) => (l.tipo === 'compra' ? 'Compra' : l.tipo === 'pagamento' ? 'Pagamento' : 'Estorno') },
      { titulo: 'Detalhe', valor: (l) => l.obs },
      { titulo: 'Valor', valor: (l) => el('span', { class: l.tipo === 'compra' ? 'perigo-texto' : 'sucesso-texto' }, (l.tipo === 'compra' ? '+ ' : '− ') + R(l.valor)), classe: 'num' },
    ], lanc, { vazio: 'Nenhum lançamento.' }),
    !caixaAberto(ctx.estado) && saldo > 0 ? aviso('Para receber, abra o caixa (o dinheiro entra na gaveta).', 'alerta') : null,
  ], [
    botao('Fechar', () => m.fechar(), { variante: 'secundario' }),
    saldo > 0 && caixaAberto(ctx.estado) ? botao('Receber pagamento', () => { m.fechar(); janelaReceberFiado(ctx, c.id); }) : null,
  ]);
}

export function clientes(ctx: Ctx): Node[] {
  const f = ctx.tela('clientes', () => ({ busca: '' }));
  const termo = f.busca.trim().toLowerCase();
  const lista = ctx.estado.clientes.filter((c) => c.ativo && (!termo || c.nome.toLowerCase().includes(termo))).sort((a, b) => saldoFiado(ctx.estado, b.id) - saldoFiado(ctx.estado, a.id) || a.nome.localeCompare(b.nome));
  const total = totalFiado(ctx.estado);
  const devendo = ctx.estado.clientes.filter((c) => saldoFiado(ctx.estado, c.id) > 0).length;
  return [
    cabecalhoPagina('Clientes e fiado', 'Quem compra para pagar depois.', botao('Novo cliente', () => janelaCliente(ctx, null), { icone: 'mais' })),
    el('div', { class: 'kpis' }, kpi('Total a receber', R(total), `${devendo} clientes devendo`, total > 0 ? 'alerta' : '')),
    el('div', { class: 'filtros' }, busca(f.busca, (v) => { f.busca = v; ctx.redesenhar(); }, { placeholder: 'Buscar cliente', foco: 'clientes-busca' })),
    cartao(null, tabela([
      { titulo: 'Cliente', valor: (c) => c.nome },
      { titulo: 'Telefone', valor: (c) => c.telefone || '—' },
      { titulo: 'Limite', valor: (c) => (c.limite == null ? 'sem limite' : R(c.limite)), classe: 'num' },
      { titulo: 'Deve', valor: (c) => { const s = saldoFiado(ctx.estado, c.id); const estourou = c.limite != null && s >= c.limite; return s > 0 ? etiqueta(R(s), estourou ? 'perigo' : 'alerta') : s < 0 ? etiqueta(`crédito ${R(-s)}`, 'info') : etiqueta('em dia', 'sucesso'); }, classe: 'num' },
      { titulo: '', valor: (c) => el('div', { class: 'acoes-linha' }, botao('Extrato', () => janelaExtrato(ctx, c), { variante: 'secundario' }), botao('Editar', () => janelaCliente(ctx, c), { variante: 'fantasma' })) },
    ], lista, { vazio: 'Nenhum cliente cadastrado.' })),
  ];
}
