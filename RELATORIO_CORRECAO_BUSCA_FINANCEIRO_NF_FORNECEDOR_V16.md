# Correção V16 — Busca no Financeiro por NF/Nota/Fornecedor

Alteração solicitada: adicionar somente um campo de pesquisa na tela Financeiro/DRE para localizar lançamentos por número da nota de entrada, NF, fornecedor, descrição, vencimento, pagamento, status ou valor.

## Arquivos alterados
- `js/financeiro.js`
- `jarvis.html`
- `service-worker.js`
- `js/service-worker.js`
- `capacitor-android/www/js/financeiro.js`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/service-worker.js`

## O que foi feito
- Criado campo visual: `Pesquisar NF, nota, fornecedor...`
- O filtro atua sobre a tabela já existente do financeiro.
- Não altera salvamento.
- Não altera agrupamento.
- Não altera NF/XML.
- Não altera estoque.
- Não altera O.S.
- Não altera IA, chat, cliente ou clienteOficial.

## Validação
- `js/financeiro.js`: sintaxe OK em `node --check`.
- `capacitor-android/www/js/financeiro.js`: sintaxe OK em `node --check`.
