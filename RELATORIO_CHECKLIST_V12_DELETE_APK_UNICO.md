# Checklist V12 — correção exclusão e APK separado

## Corrigido

- Detecção de gestor/gerente/admin reforçada com várias chaves de sessão do SaaS.
- Botões Editar/Excluir aparecem na consulta para perfis de gestão.
- Exclusão remove Firestore quando houver permissão e também registros locais do aparelho.
- APK separado agora tem packageId único V12.
- Workflow limpa plataforma Android antiga antes de gerar o APK, evitando reaproveitar packageId anterior.

## PackageId novo

`br.com.thiaguinhosolucoes.oficinia.checklistsolo.v12`

## Observação

Se o celular disser “já instalado”, o APK usado não foi gerado desta V12 ou é cache/artefato antigo.
