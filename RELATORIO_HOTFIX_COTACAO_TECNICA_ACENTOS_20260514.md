# Relatório Técnico - Hotfix Cotação Técnica e Acentuação

Data: 14/05/2026

## Arquivos alterados

- `js/cotacoes.js`
- `js/cotacao-fornecedor.js`
- `cotacao.html`
- `js/os.js`
- `service-worker.js`
- `js/service-worker.js`
- Cópias sincronizadas em `capacitor-android/www`

## O que foi corrigido

- Envio de cotação aos fornecedores agora leva dados técnicos do veículo:
  - modelo;
  - ano;
  - câmbio automático/manual/CVT/automatizado;
  - motor 8V/16V;
  - complemento técnico livre;
  - opção de marcar que a informação não é conhecida e será complementada manualmente no WhatsApp.
- Formulário público de cotação passou a exibir câmbio/motor e a coletar `marca` e `modelo/código` da peça ofertada por item.
- Respostas públicas agora gravam `modelo`, `marcaModelo` e preservam marca/modelo na O.S.
- Tela interna de cotação na O.S. ganhou campo manual “Marca / modelo ofertado”.
- Exportação da análise de cotação destaca marca/modelo ofertado em coluna própria e usa textos com acentuação profissional.
- PDF de orçamento/laudo teve títulos e cabeçalhos corrigidos com acentuação:
  - ORÇAMENTO / ORDEM DE SERVIÇO;
  - DIAGNÓSTICO TÉCNICO;
  - RESUMO POR SEÇÃO DE MÃO DE OBRA;
  - SERVIÇOS / MÃO DE OBRA;
  - PEÇAS / MATERIAIS;
  - ITENS NÃO APROVADOS.
- Cache PWA atualizado para forçar atualização dos arquivos alterados.

## O que foi preservado

- Fluxo de O.S. existente.
- Cotação por múltiplas peças.
- Cotação por múltiplos fornecedores.
- Links públicos individuais.
- Sincronização de respostas públicas para a O.S.
- Exportação de análise de cotação.
- Geração de PDF/laudo existente.
- Estrutura PWA/APK com `capacitor-android/www`.

## Validação realizada

- `node --check js/os.js`
- `node --check js/cotacoes.js`
- `node --check js/cotacao-fornecedor.js`
- `node --check service-worker.js`
- `node --check js/service-worker.js`
- Mesma validação nos arquivos sincronizados em `capacitor-android/www`.

## Testes que dependem de ambiente real

- Abrir cotação real via link público publicado no Firebase/GitHub Pages.
- Responder como fornecedor e confirmar sincronização automática no Firestore da oficina.
- Exportar análise de cotação com respostas reais.
- Gerar PDF no navegador/APK para conferir renderização final de acentos com a biblioteca jsPDF no ambiente do usuário.

