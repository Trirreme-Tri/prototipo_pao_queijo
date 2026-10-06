import { expect, type Page } from '@playwright/test';

/** Abre o caixa com o troco padrão (R$ 100,00). */
export async function abrirCaixa(page: Page): Promise<void> {
  await page.goto('./#/caixa');
  await page.getByLabel('Quem está no caixa?').fill('Thiago');
  await page.getByRole('button', { name: 'Abrir caixa' }).click();
  await expect(page.getByRole('heading', { name: /Caixa nº/ })).toBeVisible();
}

export function campoCaixa(page: Page) {
  return page.getByPlaceholder(/Código ou nome do produto/);
}

/** Lê o saldo mostrado na tabela de estoque para um produto (coluna Saldo). */
export async function saldo(page: Page, produto: string): Promise<string> {
  await page.goto('./#/estoque');
  await page.getByPlaceholder('Buscar produto').fill(produto);
  const linha = page.getByRole('row').filter({ has: page.getByRole('cell', { name: produto, exact: true }) });
  return (await linha.getByRole('cell').nth(3).textContent()) ?? '';
}
