# OFICIN-IA Checklist V14 — Login seguro + APK separado corrigido

Correções aplicadas:

1. Segurança de acesso
- `checklist.html` não abre mais a tela principal por padrão.
- Todas as telas ficam bloqueadas até existir sessão autorizada.
- Aba anônima/sem sessão vê somente a tela de login.
- Consulta de checklists, salvar checklist e buscar histórico exigem sessão válida.
- Cliente continua bloqueado.

2. Login interno do checklist
- Adicionada tela de login dentro do próprio checklist.
- Usa o mesmo padrão de login do SaaS:
  - gestor/admin da oficina por `oficinas`;
  - funcionário/mecânico por `funcionarios`;
  - superadmin por Firebase Auth.
- Não depende mais exclusivamente da sessão do `equipe.html` ou `jarvis.html`.

3. APK separado
- Package ID novo:
  `br.com.thiaguinhosolucoes.oficinia.checklist.solo.v14.seguro`
- Nome do app:
  `Checklist OFICIN-IA V14 Seguro`
- Workflow atualizado para limpar `android` antes de gerar APK.
- Incluído `js/config.js` também dentro de `checklist-apk/www/js/config.js`.

4. Cache/manifest
- Cache atualizado para V14.
- Manifest atualizado para V14.

Validações:
- `js/checklist.js`: OK no `node --check`.
- `capacitor-android/www/js/checklist.js`: OK no `node --check`.
- `checklist-apk/www/js/checklist.js`: OK no `node --check`.

Observação técnica:
- Se instalar via navegador no mesmo domínio, o Android pode continuar abrindo o PWA antigo porque o app principal já domina `https://oficin-ia-com-ia.vercel.app/`.
- Para ícone separado real, use o APK gerado pela pasta `checklist-apk` desta V14.
