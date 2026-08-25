# OFICIN-IA — Keystore de assinatura

Este diretório contém a keystore que assina TODOS os APKs do OFICIN-IA.

## Por que ela está no repositório

Sem uma keystore consistente, o GitHub Actions geraria um APK debug
assinado com uma chave aleatória do runner — diferente a cada build.
Resultado: o Android recusa instalar o APK novo por cima do antigo
("App não instalado", "Conflito com aplicativo já instalado").

Versionar esta keystore garante:
- Mesma assinatura em todo build → Android aceita atualização in-place
- Não precisa desinstalar o app antigo ao subir versão nova
- Builds reproduzíveis

## Arquivo

- `oficinia-release.jks` — keystore RSA 2048-bit, validade 30 anos
- alias: `oficinia`
- senha do store: `oficinia2026`
- senha da chave: `oficinia2026`
- DName: CN=OFICIN-IA, OU=thIAguinho Solucoes Digitais, O=thIAguinho

## Riscos e mitigação

Como a senha está versionada, qualquer pessoa com acesso ao repositório
pode assinar APKs como se fosse o OFICIN-IA. Isto é aceitável porque:

1. O app não está publicado na Play Store (distribuição direta via APK).
2. Você controla quem tem acesso ao repositório no GitHub.
3. Se em algum momento for publicar na Play Store, será necessário gerar
   uma keystore separada (com senha em GitHub Secrets) e usar ela
   exclusivamente para builds de produção. Esta keystore continuaria
   válida apenas para distribuição direta.

## Como rotacionar (se a senha vazar)

```bash
# Gera nova keystore
keytool -genkeypair \
  -keystore capacitor-android/keystore/oficinia-release.jks \
  -alias oficinia \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass NOVA_SENHA -keypass NOVA_SENHA \
  -dname "CN=OFICIN-IA, OU=thIAguinho, O=thIAguinho, L=Sao Jose do Rio Preto, ST=SP, C=BR"

# Atualizar capacitor-android/android-overrides/build.gradle.signing
# com a nova senha. ATENÇÃO: usuários já com APK antigo instalado
# precisarão desinstalar antes de instalar APK assinado com nova chave.
```

Powered by thIAguinho Soluções Digitais
