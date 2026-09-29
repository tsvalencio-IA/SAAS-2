# Migração segura — SAAS-2 + CHECKLIS_SOS — 29/09/2026

## Objetivo

1. Todo link público enviado a cliente comum e cliente oficial/governo deve usar a base oficial:
   `https://tsvalencio-ia.github.io/SAAS-2/`
2. O checklist aberto a partir da O.S. deve usar exclusivamente:
   `https://tsvalencio-ia.github.io/CHECKLIS_SOS/`
3. O checklist salvo deve continuar gravando no mesmo Firebase e anexar seus resultados à O.S. sem substituir/apagar campos existentes.
4. A O.S. deve mostrar os resultados operacionais do checklist e manter PDF/XLSX/impressão.
5. Auditoria do checklist deve continuar aparecendo na auditoria do SAAS-2 e na timeline da própria O.S.

## O que foi alterado no SAAS-2

### Links públicos
- `js/links-publicos.js`
- `capacitor-android/www/js/links-publicos.js`
- `jarvis.html`
- `capacitor-android/www/jarvis.html`
- `js/os.js`
- `capacitor-android/www/js/os.js`
- `js/capacitor.config.js`
- `capacitor-android/www/js/capacitor.config.js`
- `superadmin.html`
- `capacitor-android/www/superadmin.html`

A base antiga `OFICIN-IA-COM_IA` e o fallback mais antigo `OFICIN-IA` foram substituídos por `SAAS-2` nos pontos ativos de geração de links.

Foi adicionada migração automática de bases antigas na camada central de links. Assim, mesmo que uma oficina tenha `publicBaseUrl` antigo salvo ou uma configuração antiga carregada em `window.THIA_PUBLIC_LINKS`, o link final de cliente/cliente oficial é normalizado para `SAAS-2` antes de ser enviado.

### Checklist dentro da O.S.
- `js/checklist-jarvis-bridge.js`
- `capacitor-android/www/js/checklist-jarvis-bridge.js`

O endereço canônico passou a ser:
`https://tsvalencio-ia.github.io/CHECKLIS_SOS/`

Valores antigos de `OFICINIA_CHECKLIST_APP_URL` apontando para `/CHECKLIST/` ou repositórios antigos são migrados para o novo endereço.

A tela da O.S. continua mantendo o laudo técnico existente e agora também exibe a saída operacional gravada pelo CHECKLIS_SOS em três grupos:
- Peças para trocar / cotar
- Serviços / ações a executar
- Atenções / revisar

Nada do laudo existente foi removido. Fotos, registro de entrega, PDF, XLSX, impressão e lista técnica continuam disponíveis.

### Cache
Os HTMLs que carregam a camada de links públicos receberam `?v=26.24.0` para forçar atualização do JS no navegador. `os.js` e `checklist-jarvis-bridge.js` também receberam novo versionamento no `jarvis.html`.

## Integração já existente e validada no CHECKLIS_SOS V15.24

O `CHECKLIS_SOS` enviado já está apontando para o SAAS-2 e já implementa a integração correta. Ao salvar um checklist vinculado a uma O.S., ele faz `set(..., {merge:true})` na O.S., portanto não substitui o documento inteiro.

Campos principais gravados na O.S.:
- `checklistId`
- `checklistResumo`
- `checklistUltimo`
- `checklistOperacional`
- `checklistOperacionalAtualizadoEm`
- `checklistAtualizadoEm`
- `checklistsTecnicos`
- `checklistAppUrl`
- `checklistOrigem`

O `checklistOperacional` contém:
- `pecasTrocar`
- `servicosExecutar`
- `atencoes`
- `totais`

Na entrega também são gravados os campos de entrega do checklist, sem apagar os anteriores.

## Auditoria

O CHECKLIS_SOS grava um evento com `tipo: checklist_sos` no array `timeline` da O.S. e também cria registro em `lixeira_auditoria` com `modulo: CHECKLIST SOS`, incluindo usuário, O.S., placa, checklistId, progresso e totais de peças/serviços/atenções.

## Testes executados nesta correção

- Validação JS (`node --check`) em `js/links-publicos.js`, `js/os.js` e `js/checklist-jarvis-bridge.js`.
- Teste de geração de link para cliente oficial com configuração normal: retornou `SAAS-2/clienteOficial.html`.
- Teste com `window.THIA_PUBLIC_LINKS` antigo: foi migrado automaticamente para `SAAS-2`.
- Teste com `publicBaseUrl` antigo salvo na oficina: foi migrado automaticamente para `SAAS-2`.
- Validação oficial do CHECKLIS_SOS: `ok: true`, versão `15.24.0`, 16 seções, 171 itens, modelo remoto `checklis_sos_v15`.
- Conferido que SAAS-2 e CHECKLIS_SOS usam o mesmo Firebase principal `hub-thiaguinho`.
- Conferido que o bridge web e o espelho Android usam o mesmo arquivo corrigido.

## O que NÃO foi feito

- Nenhum arquivo do checklist legado interno foi apagado.
- Nenhuma lógica de O.S., financeiro, estoque, clientes, cliente oficial, equipe, IA ou permissões foi removida.
- Nenhuma coleção existente foi renomeada ou migrada.
- Nenhuma regra Firebase foi alterada nesta correção.
- O repositório GitHub não foi alterado automaticamente; este pacote é uma cópia corrigida para revisão/publicação.
