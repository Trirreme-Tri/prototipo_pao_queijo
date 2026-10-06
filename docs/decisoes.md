# Decisões do protótipo

Registro curto das decisões tomadas durante a construção. Decisões materiais
devem virar ADR em `docs/adr/` quando o projeto sair do laboratório.

## D1 · Dados salvos no navegador, sem Firebase — 06/10/2026

- **Decisão:** os dados ficam no `localStorage` do aparelho. Sem banco de dados e sem servidor.
- **Quem decidiu:** Wellington, com acordo da equipe (informado por ele em 06/10/2026).
- **Motivo:** o Thiago precisa alterar os dados e eles precisam continuar lá ao reabrir.
  Isso basta para a apresentação; um banco de dados não muda o que o MVP quer descobrir.
- **Mudança em relação à spec do MVP:** a spec dizia "nada é salvo". Agora os dados são
  salvos, mas **só no aparelho**. Continua sem login, sem backend e sem dado pessoal real
  da loja sendo enviado a lugar nenhum (trilha Leve).
- **Trade-offs aceitos:** dados não sincronizam entre aparelhos; somem se o navegador for limpo.
  Mitigação: tela de cópia de segurança (exportar/importar arquivo JSON).
- **Revisitar quando:** o Thiago precisar usar em mais de um aparelho, ou a equipe quiser
  ver os dados dele. Aí entra backend (trilha Completa, com ADR).

## D2 · Cardápio do cliente dentro do link do QR code

- **Problema:** com dados só no aparelho do Thiago, o celular do cliente não teria o cardápio.
- **Decisão:** o QR code leva os itens codificados no próprio link (`#/c/...`).
  O link é tratado como dado não confiável: validado e exibido só como texto.
- **Trade-off:** mudou preço ou item, é preciso imprimir um QR novo.

## D3 · Dependência `qrcode-generator`

- MIT, sem dependências, mantida desde 2009. Gerar QR à mão seria mais código e mais risco.

## D4 · O que ficou de fora de propósito

- **Total do mês de fornadas não aparece na tela.** O histórico é guardado, mas mostrar o total
  estragaria o teste: um dos sinais que procuramos é o Thiago *pedir* esse número.
- **Vendas** continua desabilitada até chegar o relatório da maquininha.
- **Itens iniciais do cardápio:** só os que aparecem na foto da comanda (pão de queijo, pastel,
  salgado frito, salgado assado, mini pizza, Toddynho), sem preço. O Thiago completa.
- **Clientes a prazo** começam como Cliente A–D (nomes fictícios). Se o Thiago digitar nomes
  reais, eles ficam só no aparelho dele.

## D5 · Hospedagem no GitHub Pages — 06/10/2026

- **Decisão:** o protótipo é publicado no GitHub Pages pelo workflow `.github/workflows/pages.yml`,
  a cada merge na `main`.
- **Quem decidiu:** Wellington (06/10/2026). A Vercel foi descartada: o plano gratuito (Hobby)
  não permite uso comercial.
- **Como funciona:** site estático, sem servidor. O build recebe o caminho do site
  (`BASE_PATH`, ex.: `/prototipo_pao_queijo/`) e o CI roda o E2E nesse mesmo caminho.
- **Atenção:** no plano gratuito do GitHub, o Pages só funciona com repositório **público**.
  Repositório privado exige plano pago (Pro/Team). E o **site** publicado é aberto para quem
  tiver o link, mesmo vindo de repositório privado (`robots noindex` só pede para não aparecer
  em buscadores).
- **Revisitar quando:** o protótipo virar produto (domínio próprio, backend).

## D6 · De protótipo de descoberta para sistema de gestão (protótipo) — 06/10/2026

- **Decisão (Wellington):** refazer como sistema de gestão para PC e celular: caixa (PDV), vendas,
  estoque, produção com ficha técnica, cozinha, cardápio online/QR com pedido por WhatsApp,
  clientes e fiado, financeiro, relatórios. Continua **protótipo**: sem login, sem dados reais.
- **Nota fiscal:** caixa é **controle interno**; o comprovante diz "não é documento fiscal".
  NFC-e fica para uma fase futura (certificado digital, servidor, serviço emissor pago).
- **Vários aparelhos:** pedido do Wellington, mas sem servidor cada aparelho tem seus dados.
  Abas no mesmo navegador se sincronizam. Sincronizar aparelhos exige backend (próxima fase, R3: custo).
- **Celular:** Painel, Cozinha, Produção, Estoque, Clientes, Cardápio, Configurações.
  Caixa, Vendas, Produtos, Financeiro e Relatórios só no computador.
- **Dados de demonstração:** loja fictícia com 7 dias de movimento; dados do protótipo v1 são migrados.
- **Link do cardápio não é assinado:** qualquer pessoa pode gerar um link com outro nome/WhatsApp.
  Aceitável num protótipo; com backend, o cardápio passa a vir do servidor.
- **Risco de negócio (registrado):** sistema completo antes de contrato e do aval do Leo.

## Pendências

- Backend (sincronizar aparelhos), login e NFC-e: próximas fases, com ADR e orçamento.
- Teste num celular e num PC reais da loja; impressora térmica não testada.
- Lint (ESLint) não configurado; os gates hoje são tipos + testes + build + E2E.
