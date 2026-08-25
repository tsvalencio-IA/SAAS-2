# OFICIN-IA Checklist V9 — App próprio + SaaS + A4 manual

## Base
Aplicado sobre a V8 do checklist, preservando histórico, fotos, áudio, PDF, XLSX, JSON e envio/anexo na O.S.

## Adicionado
- PWA instalável na tela do celular com `checklist.webmanifest`.
- Ícones próprios em `assets/icons/checklist-192.png` e `assets/icons/checklist-512.png`.
- Botão `📲 Instalar checklist na tela`.
- Botão `↗️ Ir para sistema SaaS`.
- Roteamento inteligente:
  - mecânico/técnico -> `equipe.html`;
  - gestor/gerente/admin/dono/superadmin -> `jarvis.html`;
  - sem sessão -> `index.html`.
- Botão rápido `🖨️ Checklist manual A4` no topo.
- Service worker atualizado para cache da V9 e ícones/manifest.

## Mantido
- Sem rolagem lateral.
- Tema claro/escuro.
- Histórico por placa.
- Consulta de checklists.
- PDF, XLSX, JSON, fotos e áudio.
- Manual 1 página para impressão A4.

## Validação
- `js/checklist.js`: OK no `node --check`.
- `checklist.webmanifest`: JSON válido.
- Web e `capacitor-android/www` sincronizados.
