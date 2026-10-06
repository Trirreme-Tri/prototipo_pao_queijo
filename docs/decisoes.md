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

## Pendências

- Hospedagem (onde colocar no ar) — decisão do Wellington, ver PR.
- Lint (ESLint) não configurado; os gates hoje são tipos + testes + build + E2E.
