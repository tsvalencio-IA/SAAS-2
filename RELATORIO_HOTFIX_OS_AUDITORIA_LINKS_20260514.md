# Hotfix - Links publicos, auditoria de status e patio

Data: 2026-05-14

## Objetivo

Corrigir a geracao de links publicos em todo o fluxo do SaaS e reforcar a auditoria operacional da O.S. sem remover logica existente de financeiro, aprovacao, execucao, Cilia, cotacao, PDF, cliente ou clienteOficial.

## Arquivos alterados

- `js/links-publicos.js`
- `js/os.js`
- `js/os-utils.js`
- `jarvis.html`
- `equipe.html`
- `cliente.html`
- `clienteOficial.html`
- `service-worker.js`
- `js/service-worker.js`
- equivalentes sincronizados em `capacitor-android/www`

## Links publicos

- Foi criada a funcao `thiaGetClientePortalUrl`.
- O envio de acesso pelo painel de clientes do Jarvis usa agora a funcao central.
- O envio de orcamento da O.S. usa agora link central com:
  - `tenant`
  - `os`
  - `placa`
  - `login`
- `cliente.html` e `clienteOficial.html` passam a preencher o login automaticamente quando o link recebe `login` ou `placa`.

## Auditoria de status da O.S.

- Mudanca de status no Kanban Jarvis agora exige comentario/motivo.
- Mudanca de status no painel Equipe agora exige comentario/motivo.
- Mudanca de status pelo modal da O.S. tambem exige comentario/motivo.
- Cada mudanca grava item estruturado na timeline:
  - usuario
  - data/hora
  - status anterior
  - status novo
  - motivo interno
  - origem
  - visibilidade publica resumida

## Cliente e Cliente Oficial

- Cliente e Cliente Oficial nao recebem o motivo interno da mudanca.
- Eles veem apenas resumo publico do status:
  - status atualizado
  - usuario que alterou

## Patio / Kanban

- Coluna `Entregues` ganhou busca propria por placa, prefixo ou cliente.
- Ao finalizar como `Entregue`, o Jarvis pergunta o tipo de finalizacao:
  - servico executado e veiculo entregue
  - somente orcamento finalizado
  - orcamento nao aprovado / recusado
- O tipo de finalizacao fica salvo na O.S. e aparece no card entregue.
- Foi adicionado botao `RELATORIOS / HISTORICO` no patio para acesso rapido ao historico/relatorios existentes.

## Validacao realizada

- `node --check js/links-publicos.js`
- `node --check js/os.js`
- `node --check js/os-utils.js`
- `node --check capacitor-android/www/js/links-publicos.js`
- `node --check capacitor-android/www/js/os.js`
- `node --check capacitor-android/www/js/os-utils.js`
- Parse de scripts inline em:
  - `jarvis.html`
  - `equipe.html`
  - `cliente.html`
  - `clienteOficial.html`
- Teste de geracao de links:
  - cliente comum
  - cliente oficial

## Bloqueio externo ainda existente

No GitHub Pages atual, `cliente.html` e `clienteOficial.html` respondem, mas `c.html` e `cotacao.html` ainda precisam estar publicados no repositorio `/OFICIN-IA/` para o link publico de cotacao funcionar fora da maquina local.
