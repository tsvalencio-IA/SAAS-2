# Hotfix - Links publicos OFICIN-IA

Data: 2026-05-14

## Objetivo

Configurar a base publica oficial do SaaS para:

`https://tsvalencio-ia.github.io/OFICIN-IA/`

## Arquivos alterados

- `js/links-publicos.js`
- `js/service-worker.js`
- `service-worker.js`
- `js/capacitor.config.js`
- `README.md`
- `capacitor-android/www/js/links-publicos.js`
- `capacitor-android/www/js/service-worker.js`
- `capacitor-android/www/service-worker.js`
- `capacitor-android/www/js/capacitor.config.js`

## Links configurados

- Cliente: `https://tsvalencio-ia.github.io/OFICIN-IA/cliente.html`
- Cliente Oficial: `https://tsvalencio-ia.github.io/OFICIN-IA/clienteOficial.html`
- Cotacao curta: `https://tsvalencio-ia.github.io/OFICIN-IA/c.html`
- Cotacao completa: `https://tsvalencio-ia.github.io/OFICIN-IA/cotacao.html`
- Jarvis: `https://tsvalencio-ia.github.io/OFICIN-IA/jarvis.html`
- Equipe: `https://tsvalencio-ia.github.io/OFICIN-IA/equipe.html`
- Superadmin: `https://tsvalencio-ia.github.io/OFICIN-IA/superadmin.html`
- Login: `https://tsvalencio-ia.github.io/OFICIN-IA/index.html`
- Seletor de perfil: `https://tsvalencio-ia.github.io/OFICIN-IA/selecionar-perfil.html`

## Validacao local

Com `thiaGetPublicUrl`:

- `cliente` gera `https://tsvalencio-ia.github.io/OFICIN-IA/cliente.html?tenant=T1`
- `clienteOficial` gera `https://tsvalencio-ia.github.io/OFICIN-IA/clienteOficial.html?tenant=T1`
- `cotacaoFornecedor` gera `https://tsvalencio-ia.github.io/OFICIN-IA/c.html?t=T1&token=TK`

Sintaxe validada:

- `node --check js/links-publicos.js`
- `node --check js/cotacoes.js`
- `node --check js/os.js`
- `node --check capacitor-android/www/js/links-publicos.js`
- `node --check capacitor-android/www/js/cotacoes.js`
- `node --check capacitor-android/www/js/os.js`

## Validacao publica atual

Teste HTTP feito em 2026-05-14:

- `cliente.html`: 200
- `clienteOficial.html`: 200
- raiz `/OFICIN-IA/`: 404
- `index.html`: 404
- `c.html`: 404
- `cotacao.html`: 404

## Bloqueio externo

Para os links de cotacao funcionarem fora da maquina local, os arquivos `c.html` e `cotacao.html` desta versao precisam ser publicados no GitHub Pages em `/OFICIN-IA/`.

Tambem e necessario manter `tsvalencio-ia.github.io` autorizado no Firebase Authentication, quando o login do portal depender de Firebase Auth.
