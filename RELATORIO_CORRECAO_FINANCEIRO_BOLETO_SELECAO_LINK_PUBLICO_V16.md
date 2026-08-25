# Correção v16 — Financeiro Boleto Agrupado + Link Público OFICIN-IA-COM_IA

Base: v16 já com módulo de boleto agrupado publicado.

## Corrigido
- Adicionada seleção visual na tabela do financeiro para NFs/contas pendentes agrupáveis.
- Botão “AGRUPAR NF EM BOLETO” agora abre o modal usando as notas selecionadas.
- Adicionada barra de resumo: quantidade selecionada, total e opções “Selecionar visíveis” / “Limpar seleção”.
- Adicionado modal completo de agrupamento caso estivesse ausente no HTML publicado.
- Mantida rastreabilidade: as notas originais continuam no banco como origem agrupada; o boleto vira lançamento ativo principal.
- Links públicos alterados de `/OFICIN-IA/` para `/OFICIN-IA-COM_IA/` nos pontos centralizados e fallbacks.

## Arquivos alterados
- jarvis.html
- js/financeiro.js
- js/links-publicos.js
- js/os.js
- service-worker.js
- js/service-worker.js
- capacitor-android/www/jarvis.html
- capacitor-android/www/js/financeiro.js
- capacitor-android/www/js/links-publicos.js
- capacitor-android/www/js/os.js
- capacitor-android/www/service-worker.js
- capacitor-android/www/js/service-worker.js

## Não alterado
- IA
- chat
- estoque/NF
- cliente.html
- clienteOficial.html
- equipe.html
- regras Firebase

## Validação
- node --check js/financeiro.js: OK
- node --check js/os.js: OK
- node --check js/links-publicos.js: OK
- Web/APK sincronizados para os arquivos alterados.
