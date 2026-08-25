# Correção Financeiro — Boleto Agrupado Parcelado — V16

Base: pacote V16 já corrigido com seleção de notas e busca por NF/fornecedor.

## Alterado
- `js/financeiro.js`
- `jarvis.html`
- `service-worker.js`
- `js/service-worker.js`
- `capacitor-android/www/js/financeiro.js`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/service-worker.js`

## O que foi adicionado
- Campo de quantidade de boletos/parcelas no modal **Agrupar NF / Contas em Boleto**.
- Botão **Gerar / Atualizar Parcelas**.
- Grade editável com vencimento, valor, número do boleto e linha digitável por parcela.
- Geração de múltiplos lançamentos financeiros oficiais, um por boleto/parcela.
- As NFs originais continuam preservadas como origem/auditoria e marcadas como agrupadas.
- Cada boleto gerado recebe `boletoGrupoId`, `boletoParcela`, `boletoTotalParcelas` e `notasAgrupadas`.

## Não alterado
- O.S.
- Estoque/NF/XML
- IA
- Chat
- Cliente/ClienteOficial
- Equipe

## Validação
- `js/financeiro.js` validado com `node --check` sem erro de sintaxe.
- Web/APK sincronizados.
