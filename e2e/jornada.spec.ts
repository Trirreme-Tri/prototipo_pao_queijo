import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept()); // confirma os window.confirm
  await page.goto('./');
});

test('fornadas: registrar, desfazer, sobra e continuar salvo após recarregar', async ({ page }) => {
  await page.getByRole('button', { name: 'Fornadas' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fornadas');
  await expect(page.locator('[data-teste=contagem]')).toHaveText('0 fornadas');

  const botao = page.getByRole('button', { name: 'Saiu uma fornada' });
  await botao.click();
  await botao.click();
  await botao.click();
  await expect(page.locator('[data-teste=contagem]')).toHaveText('3 fornadas');

  await page.getByRole('button', { name: /desfazer a última/ }).click();
  await expect(page.locator('[data-teste=contagem]')).toHaveText('2 fornadas');

  await page.getByLabel('Quantos pães sobraram?').fill('14');
  await page.getByRole('button', { name: 'Registrar sobra' }).click();
  await expect(page.locator('.cartao').nth(1)).toContainText('14');

  await page.reload();
  await expect(page.locator('[data-teste=contagem]')).toHaveText('2 fornadas');
  await expect(page.locator('.cartao').nth(1)).toContainText('14');
});

test('botão gigante ocupa pelo menos um terço da tela e o texto tem 18px ou mais', async ({ page }) => {
  await page.goto('./#/fornadas');
  const tela = page.viewportSize()!;
  const caixa = (await page.getByRole('button', { name: 'Saiu uma fornada' }).boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(tela.width / 3);
  expect(caixa.height).toBeGreaterThanOrEqual(48);
  const menores = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
      .map((n) => parseFloat(getComputedStyle(n).fontSize))
      .filter((t) => t < 18),
  );
  expect(menores).toEqual([]);
});

test('cardápio: editar preço e ver no link público do cliente', async ({ page }) => {
  await page.goto('./#/cardapio');
  await page.getByRole('button', { name: /Pastel/ }).click();
  await page.getByLabel('Preço').fill('7,50');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: /Pastel/ })).toContainText('R$ 7,50');

  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  await page.getByLabel('Nome do item').fill('Café coado');
  await page.getByLabel('Categoria').selectOption('Cafés');
  await page.getByLabel('Preço').fill('4');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await page.getByRole('button', { name: 'Ver como o cliente vê' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Casa do Pão de Queijo');
  await expect(page.getByText('R$ 7,50')).toBeVisible();
  await expect(page.getByText('Café coado')).toBeVisible();
  // O cliente não vê menu, nem aviso de demonstração.
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveCount(0);
});

test('cardápio público abre em outro navegador, sem os dados locais', async ({ page, browser }) => {
  await page.goto('./#/cardapio');
  await page.getByRole('button', { name: /Toddynho/ }).click();
  await page.getByLabel('Preço').fill('5');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: 'Ver como o cliente vê' }).click();
  const link = page.url();

  const outro = await browser.newContext();
  const cliente = await outro.newPage();
  await cliente.goto(link);
  await expect(cliente.getByText('Toddynho')).toBeVisible();
  await expect(cliente.getByText('R$ 5,00')).toBeVisible();
  await outro.close();
});

test('link do cardápio adulterado mostra mensagem, não quebra', async ({ page }) => {
  await page.goto('./#/c/isso-nao-e-um-cardapio');
  await expect(page.getByText(/link do cardápio está incompleto/)).toBeVisible();
});

test('nome com código não é executado', async ({ page }) => {
  await page.goto('./#/estoque');
  await page.getByRole('button', { name: '+ Adicionar' }).first().click();
  await page.getByLabel('Ingrediente').fill('<img src=x onerror="window.invadido=1">');
  await page.getByLabel('Quanto tem agora').fill('2 sacos');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('<img src=x onerror="window.invadido=1">')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { invadido?: number }).invadido)).toBeUndefined();
});

test('estoque: duas listas separadas', async ({ page }) => {
  await page.goto('./#/estoque');
  await page.getByRole('button', { name: '+ Adicionar' }).first().click();
  await page.getByLabel('Ingrediente').fill('Polvilho');
  await page.getByLabel('Quanto tem agora').fill('3 sacos');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: '+ Adicionar' }).nth(1).click();
  await page.getByLabel('Produto').fill('Refrigerante lata');
  await page.getByLabel('Quanto tem agora').fill('2 fardos');
  await page.getByRole('button', { name: 'Salvar' }).click();
  const secoes = page.locator('section');
  await expect(secoes.nth(0)).toContainText('Polvilho');
  await expect(secoes.nth(0)).not.toContainText('Refrigerante');
  await expect(secoes.nth(1)).toContainText('Refrigerante lata');
});

test('clientes a prazo: lançar, somar e marcar como pago', async ({ page }) => {
  await page.goto('./#/prazo');
  const pagar = () => page.getByRole('button', { name: 'Marcar como pago' });
  await page.getByRole('button', { name: /Cliente A/ }).click();
  await expect(pagar()).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Valor consumido hoje').fill('12,50');
  await page.getByRole('button', { name: 'Lançar consumo' }).click();
  await page.getByLabel('Valor consumido hoje').fill('8');
  await page.getByRole('button', { name: 'Lançar consumo' }).click();
  await expect(page.locator('.linha-lista.destaque')).toContainText('R$ 20,50');
  await pagar().click();
  await expect(page.locator('.linha-lista.destaque')).toContainText('R$ 0,00');
  await expect(page.getByRole('button', { name: /Cliente A/ })).toContainText('Pago');
});

test('vendas fica desabilitado no menu', async ({ page }) => {
  const vendas = page.getByRole('button', { name: /Vendas/ });
  await expect(vendas).toBeDisabled(); // aria-disabled: leitor de tela anuncia como indisponível
  await vendas.click({ force: true }); // mesmo forçando o toque, não sai do lugar
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Início');
});
