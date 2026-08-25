# Correção cirúrgica — Peças reais não podem reaparecer na O.S. após exclusão manual

Base: V16 do GitHub + correções financeiras já aplicadas.

## Problema confirmado
A função `osReconciliarPecasReaisParaClienteComumOS()` em `js/os.js` reconstruía automaticamente `pecas` a partir de `pecasReais` para cliente comum.

Quando o usuário apagava uma peça da área superior da O.S. mas mantinha a peça em `pecasReais`, ao reabrir a O.S. ou salvar novamente a rotina entendia que faltava refletir a peça real na O.S. e a recriava.

## Correção aplicada
- Criado controle persistente de peças de NF/peças reais ocultadas manualmente da O.S.
- Ao salvar, se uma peça de origem NF existia em `oldOS.pecas` e não existe mais na tela atual, sua chave é gravada em:
  - `pecasReaisOcultasNaOS`
  - `pecasNFRemovidasDaOS`
- A reconciliação agora respeita essas chaves e não recria a peça.
- `nfe-real-pro.js` também respeita a lista de ocultas ao refletir peças NF na tela ou ao mesclar novas peças de orçamento.

## Arquivos alterados
- `js/os.js`
- `js/nfe-real-pro.js`
- `service-worker.js`
- `js/service-worker.js`
- `capacitor-android/www/js/os.js`
- `capacitor-android/www/js/nfe-real-pro.js`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/service-worker.js`

## Não alterado
- Financeiro
- Boleto agrupado
- IA
- Chat
- Cliente/clienteOficial
- Estoque/NF de entrada original

## Validação
- `node --check js/os.js`: OK
- `node --check js/nfe-real-pro.js`: OK
