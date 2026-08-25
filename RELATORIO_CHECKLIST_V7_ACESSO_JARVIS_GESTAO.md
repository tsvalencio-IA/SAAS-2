# Checklist V7 — Acesso Jarvis/Gestão corrigido

Correção aplicada sem alterar o fluxo do checklist:

- checklist.html não exige mais exclusivamente equipe.html.
- Aceita sessão já aberta pelo Jarvis, gestor, gerente, dono, admin e equipe.
- Lê sessionStorage do login ativo e também fallback do j_saved_login quando existir.
- Mantém bloqueio para cliente.
- Mantém histórico por placa, PDF, XLSX, JSON, fotos, áudio e impressão manual.

Arquivos alterados:
- checklist.html
- js/checklist.js
- service-worker.js
- js/service-worker.js
- capacitor-android/www/checklist.html
- capacitor-android/www/js/checklist.js
- capacitor-android/www/service-worker.js
- capacitor-android/www/js/service-worker.js
