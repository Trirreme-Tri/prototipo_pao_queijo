# Casa do Pão de Queijo · Sistema de gestão (protótipo)

Protótipo de sistema de gestão para a Casa do Pão de Queijo (Ariquemes/RO), cliente da TRIRREME.
Funciona no navegador, no **PC** (completo) e no **celular** (telas da cozinha e do balcão).

Publicado em: `https://trirreme-tri.github.io/prototipo_pao_queijo/` (atualiza a cada merge na `main`).

## Módulos

| Módulo | O que faz | Celular |
|---|---|---|
| Painel | Vendas do dia, caixa, cozinha, estoque baixo, contas vencendo | sim |
| Caixa (PDV) | Abrir/fechar caixa, código ou `3*101`, peso (kg), desconto, dinheiro com troco, Pix, débito, crédito, fiado, pagamento dividido, sangria, suprimento, comprovante (F2 finaliza, F9 abre o caixa) | não |
| Vendas | Histórico, reimpressão, cancelamento (devolve estoque), fechamentos de caixa, CSV | não |
| Cozinha | Pedidos do caixa (itens feitos na hora) e encomendas: novo → preparando → pronto → entregue | sim |
| Produção | "Saiu fornada" com um toque, ordens de produção, fichas técnicas com custo e margem | sim |
| Estoque | Posição, entrada de mercadoria (com conta a pagar), perdas, contagem, extrato | sim |
| Produtos | Insumos, fabricados e revenda; feito na hora baixa ingredientes na venda | não |
| Clientes e fiado | Limite, extrato, recebimento no caixa | sim |
| Financeiro | Contas a pagar/receber, fluxo de caixa | não |
| Relatórios | Faturamento, ticket médio, formas de pagamento, mais vendidos, lucro estimado, produção, perdas | não |
| Cardápio e QR | Escolhe os itens, gera QR; o cliente pede pelo WhatsApp | sim |

**Controle interno: não emite nota fiscal.**

## Onde ficam os dados

No navegador de cada aparelho (`localStorage`). Sem servidor: o PC do caixa e o celular da cozinha
têm dados separados. Abas abertas no mesmo navegador se atualizam sozinhas. Faça cópias em
Configurações. Na primeira vez abre uma loja de demonstração (dados fictícios).

Decisões e motivos: [`docs/decisoes.md`](docs/decisoes.md).

## Rodar

```bash
npm ci
npm run dev            # http://localhost:5173
npm run verificar      # tipos + testes + build + testes no navegador (PC e celular)
```

Para testar no caminho do GitHub Pages: `BASE_PATH=/prototipo_pao_queijo/ npm run test:e2e`.

## Código

- `src/dominio/` regras de negócio (funções puras, testadas em `dominio.test.ts`)
- `src/telas/` uma tela por módulo · `src/ui/` componentes · `src/main.ts` navegação e armazenamento
- Vite + TypeScript, sem framework. Única dependência de produção: `qrcode-generator` (MIT).
