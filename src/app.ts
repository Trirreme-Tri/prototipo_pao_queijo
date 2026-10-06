// Contrato entre o "motor" (main.ts) e as telas, e o mapa de rotas.

import type { Estado } from './dominio/tipos';
import type { NomeIcone } from './ui/base';
import { erroNoModal, type Modal } from './ui/modal';

export interface Ctx {
  estado: Estado;
  agora: () => Date;
  /** Aplica uma mudança e salva. Devolve a mensagem de erro, ou null se deu certo. */
  aplicar: (f: (e: Estado) => Estado, sucesso?: string) => string | null;
  /** Igual a aplicar, mas mostra o erro num aviso. Devolve true se deu certo. */
  mudar: (f: (e: Estado) => Estado, sucesso?: string) => boolean;
  /** Estado de tela (filtros, carrinho do caixa) que sobrevive ao redesenho. */
  tela: <T extends object>(chave: string, criar: () => T) => T;
  redesenhar: () => void;
  ir: (rota: string) => void;
  urlBase: string;
  celular: boolean;
  substituirEstado: (e: Estado, mensagem: string) => void;
}

/** Aplica a mudança a partir de uma janela: erro aparece na janela; sucesso fecha. */
export function aplicarNoModal(ctx: Ctx, m: Modal, f: (e: Estado) => Estado, sucesso?: string): boolean {
  const erro = ctx.aplicar(f, sucesso);
  if (erro) {
    erroNoModal(m, erro);
    return false;
  }
  m.fechar();
  return true;
}

export interface Rota {
  caminho: string;
  titulo: string;
  icone: NomeIcone;
  /** false = só no computador (no celular mostra um aviso). */
  celular: boolean;
  grupo: 'Loja' | 'Cozinha' | 'Gestão';
  atalho?: string;
}

export const ROTAS: Rota[] = [
  { caminho: '/', titulo: 'Painel', icone: 'painel', celular: true, grupo: 'Loja' },
  { caminho: '/caixa', titulo: 'Caixa', icone: 'caixa', celular: false, grupo: 'Loja', atalho: 'F9' },
  { caminho: '/vendas', titulo: 'Vendas', icone: 'vendas', celular: false, grupo: 'Loja' },
  { caminho: '/cardapio', titulo: 'Cardápio e QR', icone: 'cardapio', celular: true, grupo: 'Loja' },
  { caminho: '/cozinha', titulo: 'Cozinha', icone: 'cozinha', celular: true, grupo: 'Cozinha' },
  { caminho: '/producao', titulo: 'Produção', icone: 'producao', celular: true, grupo: 'Cozinha' },
  { caminho: '/estoque', titulo: 'Estoque', icone: 'estoque', celular: true, grupo: 'Cozinha' },
  { caminho: '/produtos', titulo: 'Produtos', icone: 'produtos', celular: false, grupo: 'Gestão' },
  { caminho: '/clientes', titulo: 'Clientes e fiado', icone: 'clientes', celular: true, grupo: 'Gestão' },
  { caminho: '/financeiro', titulo: 'Financeiro', icone: 'financeiro', celular: false, grupo: 'Gestão' },
  { caminho: '/relatorios', titulo: 'Relatórios', icone: 'relatorios', celular: false, grupo: 'Gestão' },
  { caminho: '/config', titulo: 'Configurações', icone: 'config', celular: true, grupo: 'Gestão' },
];

/** Atalhos do menu inferior no celular. */
export const ROTAS_BARRA_CELULAR = ['/', '/cozinha', '/producao', '/estoque'];
