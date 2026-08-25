/// <reference types="@capacitor/cli" />

/**
 * thIAguinho ERP — Configuração do Capacitor para Android
 *
 * IMPORTANTE: o app aponta para o GitHub Pages.
 * Quando você atualizar o código no GitHub, o app já estará atualizado
 * (não precisa republicar APK toda vez que mexer no HTML/JS).
 *
 * Para fazer um app "offline-only" (sem GitHub Pages), troque:
 *   server: { url: 'https://...', cleartext: true }
 * por:
 *   webDir: 'www'
 *
 * Powered by thIAguinho Soluções Digitais
 */
const config = {
  appId: 'br.com.thiaguinho.saas',
  appName: 'thIAguinho SaaS',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0e1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#00D4FF'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e1a'
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
      promptLabelHeader: 'Foto do veículo',
      promptLabelCancel: 'Cancelar',
      promptLabelPhoto: 'Da galeria',
      promptLabelPicture: 'Tirar foto'
    }
  }
};

module.exports = config;
