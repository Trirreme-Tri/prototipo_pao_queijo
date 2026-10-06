import { expect, test } from '@playwright/test';
import { abrirCaixa, campoCaixa, saldo } from './apoio';

test('caixa: vender por código, receber em dinheiro e mostrar o troco; estoque baixa', async ({ page }) => {
  const antes = await saldo(page, 'Pão de queijo');
  await abrirCaixa(page);
  await campoCaixa(page).fill('3*101');
  await campoCaixa(page).press('Enter');
  await page.getByTestId('produto-501').click(); // Toddynho
  await expect(page.getByTestId('total-venda')).toHaveText('R$ 12,00');
  await page.keyboard.press('F2');
  const janela = page.getByTestId('janela-pagamento');
  await expect(janela).toBeVisible();
  await janela.getByLabel('Valor recebido').fill('20');
  await janela.getByLabel('Valor recebido').press('Enter');
  await expect(page.getByTestId('troco')).toHaveText('R$ 8,00');
  await page.getByRole('button', { name: 'Nova venda' }).click();
  await expect(page.getByTestId('total-venda')).toHaveText('R$ 0,00');

  const depois = await saldo(page, 'Pão de queijo');
  expect(parseInt(antes) - parseInt(depois)).toBe(3);
  await page.goto('./#/');
  await expect(page.getByText('R$ 12,00').first()).toBeVisible();
});

test('caixa: pagamento dividido com fiado exige cliente; item feito na hora vai para a cozinha', async ({ page }) => {
  await abrirCaixa(page);
  await page.getByTestId('produto-204').click(); // Pastel (feito na hora)
  await page.getByTestId('produto-204').click();
  await expect(page.getByTestId('total-venda')).toHaveText('R$ 16,00');
  await page.getByTestId('finalizar').click();
  const janela = page.getByTestId('janela-pagamento');
  await janela.getByRole('radio', { name: 'Pix' }).click();
  await janela.getByLabel('Valor recebido').fill('6');
  await janela.getByRole('button', { name: 'Adicionar pagamento' }).click();
  await expect(janela.getByText('R$ 10,00').first()).toBeVisible(); // falta
  await janela.getByRole('radio', { name: 'Fiado' }).click();
  await janela.getByLabel('Nome para chamar (cozinha)').fill('Carlos');
  await janela.getByTestId('confirmar-venda').click();
  await expect(janela.getByRole('alert')).toContainText('precisa de um cliente');
  // Dona Maria (exemplo) já está no limite: o sistema recusa, como deve.
  const dona = await janela.getByLabel('Cliente do fiado').locator('option', { hasText: 'Dona Maria' }).getAttribute('value');
  await janela.getByLabel('Cliente do fiado').selectOption(dona!);
  await janela.getByTestId('confirmar-venda').click();
  await expect(janela.getByRole('alert')).toContainText('limite de fiado');
  const opcao = await janela.getByLabel('Cliente do fiado').locator('option', { hasText: 'Oficina do Zé' }).getAttribute('value');
  await janela.getByLabel('Cliente do fiado').selectOption(opcao!);
  await janela.getByTestId('confirmar-venda').click();
  await expect(page.getByRole('heading', { name: /Venda nº \d+ concluída/ })).toBeVisible();
  await page.getByRole('button', { name: 'Nova venda' }).click();

  await page.goto('./#/cozinha');
  const pedido = page.getByTestId('pedido').filter({ hasText: 'Carlos' });
  await expect(pedido).toContainText('Pastel de carne');
  await pedido.getByRole('button', { name: 'Começar' }).click();
  await page.getByTestId('pedido').filter({ hasText: 'Carlos' }).getByRole('button', { name: 'Pronto' }).click();
  await expect(page.getByRole('region', { name: 'Prontos' })).toContainText('Carlos');
});

test('vendas: cancelar devolve o estoque; fechar caixa mostra a diferença', async ({ page }) => {
  await abrirCaixa(page);
  const antes = await saldo(page, 'Coxinha de frango');
  await page.goto('./#/caixa');
  await campoCaixa(page).fill('2*201');
  await campoCaixa(page).press('Enter');
  await page.keyboard.press('F2');
  await page.getByTestId('janela-pagamento').getByRole('radio', { name: 'Débito' }).click();
  await page.getByTestId('confirmar-venda').click();
  await page.getByRole('button', { name: 'Nova venda' }).click();
  expect(parseInt(await saldo(page, 'Coxinha de frango'))).toBe(parseInt(antes) - 2);

  await page.goto('./#/vendas');
  await page.getByRole('row', { name: /Venda \d+/ }).first().click();
  await page.getByRole('button', { name: 'Cancelar venda' }).click();
  await page.getByLabel('Motivo do cancelamento').fill('Lançado errado');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar venda' }).click();
  await expect(page.getByText(/cancelada\. Estoque devolvido/)).toBeVisible();
  expect(parseInt(await saldo(page, 'Coxinha de frango'))).toBe(parseInt(antes));

  await page.goto('./#/caixa');
  await page.getByRole('button', { name: 'Fechar caixa' }).click();
  await page.getByLabel('Dinheiro contado na gaveta').fill('95');
  await expect(page.getByText('Faltando R$ 5,00')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar caixa' }).click();
  await expect(page.getByRole('heading', { name: 'Caixa fechado' })).toBeVisible();
});

test('produção: fornada soma no produto e tira os ingredientes do estoque', async ({ page }) => {
  const antes = await saldo(page, 'Pão de queijo');
  await page.goto('./#/producao');
  await page.getByTestId('fornada-101').click();
  await expect(page.getByText(/Saiu fornada: Pão de queijo/)).toBeVisible();
  expect(parseInt(await saldo(page, 'Pão de queijo'))).toBe(parseInt(antes) + 100);
  await page.getByRole('tab', { name: 'Movimentações' }).click();
  await expect(page.getByRole('cell', { name: 'Consumo na produção' }).first()).toBeVisible();
});

test('produtos: cadastrar, recusar código repetido e vender o novo item', async ({ page }) => {
  await page.goto('./#/produtos');
  await page.getByRole('button', { name: 'Novo produto' }).click();
  const janela = page.getByRole('dialog');
  await janela.getByLabel('Nome').fill('Broa de milho');
  await janela.getByLabel(/^Código/).fill('101');
  await janela.getByLabel('Categoria').selectOption('Doces');
  await janela.getByLabel(/Preço de venda/).fill('3,50');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(janela.getByRole('alert')).toContainText('código 101');
  await janela.getByLabel(/^Código/).fill('701');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('cell', { name: 'Broa de milho' })).toBeVisible();

  await abrirCaixa(page);
  await campoCaixa(page).fill('701');
  await campoCaixa(page).press('Enter');
  await expect(page.getByTestId('total-venda')).toHaveText('R$ 3,50');
});

test('financeiro: lançar conta a pagar e dar baixa', async ({ page }) => {
  await page.goto('./#/financeiro');
  await page.getByRole('button', { name: 'Conta a pagar' }).click();
  await page.getByLabel('Descrição').fill('Gás de cozinha');
  await page.getByLabel('Valor').fill('120');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  const linha = page.getByRole('row').filter({ hasText: 'Gás de cozinha' });
  await linha.getByRole('button', { name: 'Paguei' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Gás de cozinha' })).toHaveCount(0); // sai dos "em aberto"
  await page.getByLabel('Mostrar').selectOption('todas');
  await expect(page.getByRole('row').filter({ hasText: 'Gás de cozinha' })).toContainText('paga');
});

test('cardápio público: pedido pelo WhatsApp, texto do cliente nunca vira código, link adulterado', async ({ page, browser }) => {
  await page.goto('./#/config');
  await page.getByLabel('WhatsApp da loja (com DDD)').fill('69 99999-0000');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await expect(page.getByText('Dados da loja salvos')).toBeVisible();
  await page.goto('./#/produtos');
  await page.getByRole('button', { name: 'Novo produto' }).click();
  const janela = page.getByRole('dialog');
  await janela.getByLabel('Nome', { exact: true }).fill('<img src=x onerror="window.__xss=1">');
  await janela.getByLabel('Categoria').selectOption('Doces');
  await janela.getByLabel(/Preço de venda/).fill('1');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(janela).toHaveCount(0);

  await page.goto('./#/cardapio');
  const link = await page.getByTestId('abrir-cardapio').getAttribute('href');
  const outroAparelho = await browser.newContext(); // sem os dados da loja
  const p = await outroAparelho.newPage();
  await p.addInitScript(() => {
    const w = window as unknown as { abriu: string[] };
    w.abriu = [];
    window.open = ((u: string) => { w.abriu.push(u); return null; }) as typeof window.open;
  });
  await p.goto(link!);
  await expect(p.getByText('<img src=x onerror="window.__xss=1">')).toBeVisible();
  expect(await p.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await p.getByRole('button', { name: 'Adicionar Pão de queijo', exact: true }).click();
  await p.getByRole('button', { name: 'Adicionar Pão de queijo', exact: true }).click();
  await expect(p.getByText(/Ver pedido \(2\)/)).toBeVisible();
  await p.getByLabel('Seu nome').fill('Ana');
  await p.getByTestId('enviar-whatsapp').click();
  const abriu = await p.evaluate(() => (window as unknown as { abriu: string[] }).abriu);
  expect(abriu[0]).toMatch(/^https:\/\/wa\.me\/5569999990000\?text=/);
  expect(decodeURIComponent(abriu[0])).toContain('2x Pão de queijo — R$ 5,00');

  await p.goto(link!.replace(/#\/c\/.*/, '#/c/isso-nao-e-um-cardapio'));
  await expect(p.getByText(/link do cardápio está incompleto/)).toBeVisible();
  await outroAparelho.close();
});

test('dados ficam salvos ao recarregar e outra aba (cozinha) atualiza sozinha', async ({ page, context }) => {
  await abrirCaixa(page);
  const cozinha = await context.newPage();
  await cozinha.goto('./#/cozinha');
  await campoCaixa(page).fill('301'); // misto quente: vai para a cozinha
  await campoCaixa(page).press('Enter');
  await page.keyboard.press('F2');
  await page.getByTestId('janela-pagamento').getByRole('radio', { name: 'Pix' }).click();
  await page.getByTestId('janela-pagamento').getByLabel('Nome para chamar (cozinha)').fill('Mesa 4');
  await page.getByTestId('confirmar-venda').click();
  await expect(cozinha.getByTestId('pedido').filter({ hasText: 'Mesa 4' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Caixa nº/ })).toBeVisible();
});

test('migra os dados do protótipo anterior (v1)', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('casa-pao-de-queijo:v2')) return;
    localStorage.setItem('casa-pao-de-queijo:v1', JSON.stringify({ versao: 1, fornadas: {}, cardapio: [{ id: 'a', categoria: 'Pão de queijo', nome: 'Pão de queijo do Thiago', preco: 300 }], estoque: { ingredientes: [], revenda: [] }, clientes: [] }));
  });
  await page.goto('./#/produtos');
  await expect(page.getByText(/Trouxemos os itens/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Pão de queijo do Thiago' })).toBeVisible();
});
