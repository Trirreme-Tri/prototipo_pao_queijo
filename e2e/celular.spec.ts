import { expect, test } from '@playwright/test';

test('celular: barra inferior, telas de PC avisam, menu "Mais" abre', async ({ page }) => {
  await page.goto('./');
  const barra = page.getByRole('navigation', { name: 'Atalhos' });
  await expect(barra).toBeVisible();
  await barra.getByRole('link', { name: 'Cozinha' }).click();
  await expect(page.getByRole('heading', { name: 'Cozinha', level: 1 })).toBeVisible();
  await page.goto('./#/caixa');
  await expect(page.getByText('Esta tela foi feita para o computador')).toBeVisible();
  await barra.getByRole('button', { name: 'Mais' }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: /Configurações/ })).toBeInViewport();
});

test('celular: registrar fornada e lançar perda', async ({ page }) => {
  await page.goto('./#/producao');
  await page.getByTestId('fornada-101').click();
  await expect(page.getByText(/Saiu fornada/)).toBeVisible();
  await page.goto('./#/estoque');
  await page.getByPlaceholder('Buscar produto').fill('Pão de queijo recheado');
  await page.getByRole('button', { name: 'Perda' }).nth(1).click();
  const janela = page.getByRole('dialog');
  await janela.getByLabel('Quantidade').fill('2');
  await janela.getByLabel('Motivo').fill('Caiu no chão');
  await janela.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Perda registrada')).toBeVisible();
});

test('celular: nada sai da tela na horizontal', async ({ page }) => {
  for (const r of ['', 'cozinha', 'producao', 'estoque', 'clientes', 'cardapio', 'config']) {
    await page.goto('./#/' + r);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    const tela = await page.evaluate(() => window.innerWidth);
    expect(largura, r || 'painel').toBeLessThanOrEqual(tela + 1);
  }
});
