# OFICIN-IA Checklist V8 — Fluxo real de oficina

## Corrigido
- Após finalizar, agora existe fluxo claro: salvar/anexar na O.S., iniciar novo checklist, voltar ao início, ver histórico e consultar checklists.
- Histórico por placa reforçado: busca em cache local da sessão do Jarvis/equipe e em coleções Firestore do SaaS.
- Histórico completo da placa fica visível automaticamente após buscar.
- XLSX refeito em padrão mais comercial, com abas: Resumo, IMPORTAR_OS, Itens avaliados, Histórico placa e Fotos.
- Botão “Enviar/anexar na O.S.” agora tenta localizar a O.S. pelo campo O.S./Ref ou pela placa e anexar o resumo diretamente no documento da O.S.
- Se não encontrar a O.S. ou faltar permissão, baixa JSON para anexação/importação manual.
- Mantido layout mobile sem rolagem lateral.

## Arquivos alterados
- checklist.html
- js/checklist.js
- service-worker.js
- js/service-worker.js
- capacitor-android/www/checklist.html
- capacitor-android/www/js/checklist.js
- capacitor-android/www/service-worker.js
- capacitor-android/www/js/service-worker.js
