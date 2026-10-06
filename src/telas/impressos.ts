// Papéis impressos (impressora comum ou térmica de 80 mm via navegador).
// Comprovante NÃO é documento fiscal: o próprio papel diz isso.

import { resumoSessao } from '../dominio/caixa';
import type { Estado, SessaoCaixa, Venda } from '../dominio/tipos';
import { FORMAS_PAGAMENTO, NOME_FORMA } from '../dominio/tipos';
import { dataHora, formatarQuantidade, valorItem } from '../dominio/util';
import { formatarReais as R } from '../dinheiro';
import { el } from '../ui/base';

function cabecalhoLoja(estado: Estado): HTMLElement[] {
  return [
    el('h1', {}, estado.config.nomeLoja),
    estado.config.endereco ? el('p', {}, estado.config.endereco) : null,
  ].filter(Boolean) as HTMLElement[];
}

const linha = (a: string, b: string, forte = false) => el('div', { class: 'cupom-linha' + (forte ? ' forte' : '') }, el('span', {}, a), el('span', {}, b));

export function comprovante(estado: Estado, v: Venda): HTMLElement {
  const cliente = v.clienteId ? estado.clientes.find((c) => c.id === v.clienteId) : null;
  return el('div', { class: 'cupom' },
    ...cabecalhoLoja(estado),
    el('p', { class: 'cupom-destaque' }, 'COMPROVANTE DE VENDA — NÃO É DOCUMENTO FISCAL'),
    linha(`Venda nº ${v.numero}`, dataHora(v.quando)),
    v.status === 'cancelada' ? el('p', { class: 'cupom-destaque' }, `CANCELADA: ${v.motivoCancelamento}`) : null,
    el('hr'),
    ...v.itens.map((i) => el('div', { class: 'cupom-item' },
      el('span', {}, i.nome),
      linha(`${formatarQuantidade(i.quantidade, '')}× ${R(i.precoUnit)}`, R(valorItem(i.precoUnit, i.quantidade))))),
    el('hr'),
    linha('Subtotal', R(v.subtotal)),
    v.desconto ? linha('Desconto', '− ' + R(v.desconto)) : null,
    linha('TOTAL', R(v.total), true),
    ...v.pagamentos.map((p) => linha(NOME_FORMA[p.forma], R(p.valor))),
    v.troco ? linha('Troco', R(v.troco)) : null,
    cliente ? linha('Cliente', cliente.nome) : null,
    el('hr'),
    el('p', {}, 'Obrigado pela preferência!'));
}

export function relatorioFechamento(estado: Estado, s: SessaoCaixa): HTMLElement {
  const r = resumoSessao(estado, s);
  const dif = s.contado == null ? null : s.contado - r.dinheiroEsperado;
  return el('div', { class: 'cupom' },
    ...cabecalhoLoja(estado),
    el('p', { class: 'cupom-destaque' }, `FECHAMENTO DO CAIXA nº ${s.numero}`),
    linha('Operador', s.operador),
    linha('Abertura', dataHora(s.abertaEm)),
    linha('Fechamento', s.fechadaEm ? dataHora(s.fechadaEm) : 'aberto'),
    el('hr'),
    linha('Vendas', String(r.vendas)),
    linha('Canceladas', String(r.canceladas)),
    linha('Descontos', R(r.descontos)),
    linha('Total vendido', R(r.total), true),
    el('hr'),
    ...FORMAS_PAGAMENTO.map((f) => linha(NOME_FORMA[f] + (f === 'dinheiro' ? ' (líquido de troco)' : ''), R(r.porForma[f]))),
    el('hr'),
    linha('Troco inicial', R(s.valorInicial)),
    linha('Suprimentos', R(r.suprimentos)),
    linha('Sangrias', '− ' + R(r.sangrias)),
    linha('Fiado recebido em dinheiro', R(r.recebimentos.dinheiro)),
    linha('Fiado recebido (Pix/cartão)', R(r.recebimentos.pix + r.recebimentos.debito + r.recebimentos.credito)),
    linha('Dinheiro esperado', R(r.dinheiroEsperado), true),
    s.contado != null ? linha('Dinheiro contado', R(s.contado), true) : null,
    dif != null ? linha(dif === 0 ? 'Diferença' : dif > 0 ? 'Sobrou' : 'Faltou', R(Math.abs(dif)), true) : null,
    el('hr'),
    el('p', {}, 'Controle interno — não é documento fiscal.'));
}
