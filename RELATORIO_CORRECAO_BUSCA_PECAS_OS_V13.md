# Correção cirúrgica — busca de peças na O.S. v13

Alteração aplicada somente na escolha de peças dentro da O.S.

## Arquivos alterados
- js/os.js
- jarvis.html
- service-worker.js
- capacitor-android/www/js/os.js
- capacitor-android/www/jarvis.html
- capacitor-android/www/service-worker.js

## O que foi adicionado
- Campo de busca acima da lista de peças cadastradas nas Peças da O.S.
- Campo de busca acima da lista de estoque nas Peças Reais Instaladas (*177).
- Filtro por código, descrição, fornecedor, NF, OEM, EAN, referência e marca.
- Enter seleciona a primeira peça filtrada.

## O que NÃO foi alterado
- Não alterou salvarOS.
- Não alterou estoque.
- Não alterou financeiro.
- Não alterou NF/XML.
- Não alterou IA.
- Não alterou chat.
- Não alterou cliente.html/clienteOficial.html.
- Não alterou formato dos dados salvos da O.S.

## Validação
- js/os.js passou em node --check.
- capacitor-android/www/js/os.js passou em node --check.
