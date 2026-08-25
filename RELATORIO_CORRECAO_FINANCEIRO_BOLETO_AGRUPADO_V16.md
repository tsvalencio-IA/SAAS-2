# Correção Financeiro — Agrupar NF em Boleto — V16

Base usada: `OFICIN-IA-COM_IA-main (16).zip`.

## Arquivos alterados
- `js/financeiro.js`
- `jarvis.html`
- `service-worker.js`
- `js/service-worker.js`
- `capacitor-android/www/js/financeiro.js`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/service-worker.js`

## O que foi adicionado
- Botão no financeiro: `📎 AGRUPAR NF EM BOLETO`.
- Modal para selecionar várias NFs/contas pendentes do fornecedor.
- Filtro por fornecedor e busca por NF/descrição/vencimento.
- Geração de 1 lançamento financeiro principal do boleto.
- As NFs/contas originais ficam preservadas como origem/auditoria.
- As origens agrupadas deixam de aparecer no fluxo ativo padrão para não duplicar contas a pagar.
- Novo filtro `Origens agrupadas` no financeiro para consultar os lançamentos originais.
- Novas NFs lançadas passam a salvar `fornecedorId`, `vinculo: F_fornecedor`, `nfNumero` e `parcelaNF` no financeiro para facilitar agrupamento futuro.

## O que não foi alterado
- IA.
- Chat.
- O.S.
- Peças da O.S.
- NF/XML/estoque além da melhoria de metadados financeiros do lançamento.
- Cliente comum/oficial.
- Equipe.

## Validação
- `node --check js/financeiro.js`: OK.
- `node --check capacitor-android/www/js/financeiro.js`: OK.
- Web/APK sincronizados para `financeiro.js` e `jarvis.html`.
