# Protótipo · Casa do Pão de Queijo

MVP de **descoberta** para a Casa do Pão de Queijo (Ariquemes/RO), cliente da TRIRREME.
O objetivo não é ser a primeira versão do produto: é mostrar telas reais ao Thiago e
descobrir qual delas resolve um incômodo de verdade.

## O que tem

| Tela | O que faz | O que queremos descobrir |
|---|---|---|
| Início | Menu e aviso de demonstração | — |
| Fornadas | Botão "Saiu uma fornada" (guarda o horário), desfazer, sobra do dia | Não saber quanto produz incomoda? |
| Cardápio | Thiago edita itens e preços; QR code abre a versão do cliente | O desejo é vitrine ou receber pedidos? |
| Estoque | Duas listas: ingredientes do pão de queijo × produtos de revenda | Qual das duas importa? |
| Clientes a prazo | Lançar consumo, total da semana, marcar como pago | Isso incomoda ou não? |
| Vendas | Desabilitada até chegar o relatório da maquininha | — |

## Onde ficam os dados

No **navegador do aparelho** (`localStorage`). Não há servidor nem banco de dados.
Consequências que o Thiago precisa saber:

- O que é anotado no celular do balcão **não aparece** no computador do caixa.
- Limpar o navegador ou usar aba anônima apaga tudo. Por isso existe a tela
  **Início → Cópia de segurança dos dados** (salvar/abrir arquivo).
- O cardápio público funciona em qualquer celular porque os itens vão **dentro do link**
  do QR code. Mudou preço? Gere e imprima o QR de novo.

Decisões e motivos: [`docs/decisoes.md`](docs/decisoes.md).

## Rodar

```bash
npm ci
npm run dev            # http://localhost:5173
npm run verificar      # tipos + testes + build + testes no navegador (E2E)
```

O E2E usa Playwright: na primeira vez rode `npx playwright install chromium`.

## Publicar

GitHub Pages, automático a cada merge na `main` (`.github/workflows/pages.yml`).
Endereço: `https://trirreme-tri.github.io/prototipo_pao_queijo/`.
Para testar localmente no mesmo caminho: `BASE_PATH=/prototipo_pao_queijo/ npm run test:e2e`.

## Stack

Vite + TypeScript, sem framework. Única dependência de produção: `qrcode-generator` (MIT).
Fontes (Atkinson Hyperlegible e Big Shoulders Display, licença OFL) servidas pelo próprio site.
Design system: "Casa do Pão de Queijo" (Claude Design), tokens em `src/estilos.css`.
