# Correção cirúrgica v13 — thIAguinho Soluções Digitais

Base usada: `OFICIN-IA-COM_IA-main (13).zip` informada como versão funcionando no GitHub.

## O que foi corrigido

1. Sincronização Web/APK do arquivo:
   - `js/operacional-cadastros-nf-fix-20260518.js`
   - `capacitor-android/www/js/operacional-cadastros-nf-fix-20260518.js`

   Antes estavam diferentes. A versão Web era mais completa e preservava rotinas de parcelamento/financeiro de NF. O APK estava com uma versão simplificada/reduzida. Agora ambos estão iguais à versão Web completa.

2. Sincronização de service worker/cache:
   - `service-worker.js`
   - `js/service-worker.js`
   - `capacitor-android/www/service-worker.js`
   - `capacitor-android/www/js/service-worker.js`

   Antes `js/service-worker.js` estava em cache antigo. Agora todos usam a mesma versão de cache `oficinia-20260616-v13-cirurgica-sync-web-apk-sw-os`.

3. Limpeza de duplicidade em `os.js`:
   - removida duplicação de `atualizarMetaServicoLinhaOS`
   - removida duplicação de `_ciliaMetaTempaHTML`

   Foram preservadas as versões mais completas, que tinham código interno/SIAFÍSICO/Tempária.

## O que NÃO foi mexido

- IA externa
- IA interna
- Chat equipe
- Cília/API
- Prisma
- regras Firebase
- HTML principal
- layout geral
- financeiro geral
- NF principal `nfe-real-pro.js`

## Validação executada

- 113 arquivos `.js` verificados com `node --check`.
- 0 erros de sintaxe.
- Referências locais de scripts nos HTML principais verificadas.
- 0 scripts locais faltando.
- Web/APK sincronizados nos arquivos corrigidos.
- `js/os.js` sem funções duplicadas após correção.

## Observação honesta

Essa correção elimina inconsistências técnicas comprovadas na v13. Não é possível prometer 100% absoluto sem executar o fluxo real no Firebase com OS/NF/estoque reais, mas o pacote corrige os pontos objetivos encontrados na auditoria sem empilhar alterações fora do escopo.
