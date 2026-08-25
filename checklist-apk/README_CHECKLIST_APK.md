# APK separado do Checklist OFICIN-IA

Este pacote gera um aplicativo Android separado, com outro `appId`:

`br.com.thiaguinhosolucoes.oficinia.checklist`

Por isso ele não conflita com o APK/PWA principal do OFICIN-IA já instalado no celular.

## Por que o link abria o aplicativo antigo?

Porque o app principal foi instalado com o mesmo domínio `https://oficin-ia-com-ia.vercel.app/`. No Android, quando um PWA/APK já domina esse escopo, links como `/checklist.html` podem abrir dentro do app principal. Para ter ícone separado de verdade, precisa de:

1. APK separado com outro pacote Android; ou
2. outro domínio/subdomínio exclusivo para o checklist.

Este pacote resolve pela opção 1.

## Como gerar

Suba a pasta `checklist-apk` em um repositório GitHub e rode a Action `Build Checklist APK`.
