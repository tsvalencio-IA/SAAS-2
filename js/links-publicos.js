/*
 * Configuracao central dos links publicos do SaaS.
 * Base publica oficial no GitHub Pages:
 * https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/
 */
(function () {
  'use strict';

  const PUBLIC_BASE_URL = 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/';

  window.THIA_PUBLIC_LINKS = Object.assign({
    baseUrl: PUBLIC_BASE_URL,
    cliente: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/cliente.html',
    clienteOficial: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/clienteOficial.html',
    cotacaoFornecedor: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/cotacao.html',
    cotacaoFornecedorCurta: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/c.html',
    jarvis: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/jarvis.html',
    equipe: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/equipe.html',
    superadmin: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/superadmin.html',
    login: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/index.html',
    selecionarPerfil: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/selecionar-perfil.html',
    usarLinkCurtoCotacao: true,
    incluirFirebaseConfigNoLink: false,
    qrCliente: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/cliente.html',
    apkShareBase: 'https://tsvalencio-ia.github.io/OFICIN-IA-COM_IA/',
    apkUrl: 'https://github.com/tsvalencio-ia/OFICIN-IA/releases/latest'
  }, window.THIA_PUBLIC_LINKS || {});

  function cleanBase(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function runtimeBase() {
    try {
      const loc = window.location || {};
      if (!/^https?:$/i.test(loc.protocol || '')) return '';
      const path = String(loc.pathname || '/');
      const dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
      return cleanBase(loc.origin + dir);
    } catch (_) {
      return '';
    }
  }

  function officeBase() {
    try {
      const ofi = (window.thiaGetOficinaAtual && window.thiaGetOficinaAtual()) || JSON.parse(sessionStorage.getItem('j_oficina') || 'null') || {};
      return cleanBase(ofi.publicBaseUrl || ofi.linksPublicos?.baseUrl || '');
    } catch (_) {
      return '';
    }
  }

  function joinUrl(base, path) {
    base = cleanBase(base);
    path = String(path || '').replace(/^\/+/, '');
    if (!base) return path || '';
    return path ? `${base}/${path}` : base;
  }

  function normalizarTelefoneBR(phone) {
    let n = String(phone || '').replace(/\D/g, '');
    if (!n) return '';
    if (!n.startsWith('55')) n = '55' + n;
    return n;
  }

  function isMobileRuntime() {
    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  }

  function isAppRuntime() {
    try {
      return !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function')
        || /; wv\)|Version\/[\d.]+ Chrome\/[\d.]+ Mobile Safari/i.test(navigator.userAgent || '');
    } catch (_) {
      return false;
    }
  }

  const PAGE_BY_KIND = {
    cliente: 'cliente.html',
    clienteOficial: 'clienteOficial.html',
    qrCliente: 'cliente.html',
    cotacaoFornecedor: 'c.html',
    jarvis: 'jarvis.html',
    equipe: 'equipe.html',
    superadmin: 'superadmin.html',
    login: 'index.html',
    selecionarPerfil: 'selecionar-perfil.html'
  };

  window.thiaGetPublicUrl = function (kind, params) {
    const cfg = window.THIA_PUBLIC_LINKS || {};
    const base = officeBase() || cleanBase(cfg.baseUrl) || runtimeBase();
    let url = '';

    if (kind === 'cotacaoFornecedor') {
      const page = cfg.usarLinkCurtoCotacao === false ? 'cotacao.html' : 'c.html';
      url = cfg.usarLinkCurtoCotacao === false
        ? (cfg.cotacaoFornecedor || joinUrl(base, page))
        : (cfg.cotacaoFornecedorCurta || cfg.cotacaoFornecedor || joinUrl(base, page));
    } else if (kind === 'qrCliente') {
      url = cfg.qrCliente || cfg.cliente || joinUrl(base, PAGE_BY_KIND.qrCliente);
    } else if (cfg[kind]) {
      url = cfg[kind];
    } else {
      url = joinUrl(base, PAGE_BY_KIND[kind] || PAGE_BY_KIND.cliente);
    }

    if (!url) {
      const page = kind === 'cotacaoFornecedor' ? 'cotacao.html' : (kind === 'clienteOficial' ? 'clienteOficial.html' : 'cliente.html');
      url = page;
    }

    const qp = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qp.set(key, String(value));
    });
    const qs = qp.toString();
    return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
  };

  window.thiaGetClientePortalUrl = function (ctx) {
    ctx = ctx || {};
    const cliente = ctx.cliente || {};
    const os = ctx.os || {};
    const veiculo = ctx.veiculo || {};
    const isGov = cliente.tipoCliente === 'governo' || ctx.tipoCliente === 'governo' || ctx.oficial === true;
    const login = cliente.login || ctx.login || os.loginCliente || os.placa || veiculo.placa || '';
    const placa = os.placa || veiculo.placa || ctx.placa || '';
    const ofi = (window.thiaGetOficinaAtual && window.thiaGetOficinaAtual()) || {};
    const tenantRef = ctx.tenant || ctx.tenantId || cliente.slug || cliente.publicSlug || os.tenantSlug || ofi.slug || ofi.publicSlug || ofi.oficinaSlug || '';
    const params = {
      tenant: tenantRef,
      os: os.id || ctx.osId || '',
      placa,
      login
    };
    return window.thiaGetPublicUrl(isGov ? 'clienteOficial' : 'cliente', params);
  };

  window.thiaGetCurrentPublicHttpUrl = function (kind) {
    const k = kind || (/clienteOficial\.html/i.test(location.pathname || '') ? 'clienteOficial' : 'cliente');
    const cfg = window.THIA_PUBLIC_LINKS || {};
    const base = k === 'clienteOficial' ? cfg.clienteOficial : cfg.cliente;
    const qs = location.search || '';
    return base ? (base + qs) : window.thiaGetPublicUrl(k, Object.fromEntries(new URLSearchParams(qs)));
  };

  window.thiaGetApkInstallUrl = function () {
    const cfg = window.THIA_PUBLIC_LINKS || {};
    const ofi = (window.thiaGetOficinaAtual && window.thiaGetOficinaAtual()) || {};
    return ofi.apkUrl || ofi.linksPublicos?.apkUrl || cfg.apkUrl || cfg.apkShareBase || '';
  };

  window.thiaOpenExternalUrl = function (url) {
    if (!url) return false;
    try {
      const Browser = window.Capacitor?.Plugins?.Browser;
      if (Browser && typeof Browser.open === 'function') {
        Browser.open({ url });
        return true;
      }
    } catch (_) {}
    const opened = window.open(url, '_blank');
    if (opened) {
      try { opened.focus(); } catch (_) {}
      return true;
    }
    try { window.location.href = url; } catch (_) {}
    return false;
  };

  window.thiaInjectPortalInstallBar = function (kind) {
    if (document.getElementById('thiaPublicInstallBar')) return;
    const path = String(location.pathname || '');
    const isPortal = /cliente(?:Oficial)?\.html/i.test(path);
    if (!isPortal) return;
    const httpUrl = window.thiaGetCurrentPublicHttpUrl(kind);
    const apkUrl = window.thiaGetApkInstallUrl();
    if (!httpUrl && !apkUrl) return;
    const bar = document.createElement('div');
    bar.id = 'thiaPublicInstallBar';
    bar.style.cssText = [
      'position:fixed',
      'left:12px',
      'right:12px',
      'bottom:12px',
      'z-index:99999',
      'display:flex',
      'gap:8px',
      'flex-wrap:wrap',
      'align-items:center',
      'justify-content:center',
      'padding:10px',
      'border:1px solid rgba(125,211,252,.35)',
      'background:rgba(15,23,42,.94)',
      'box-shadow:0 12px 32px rgba(0,0,0,.28)',
      'border-radius:8px',
      'font-family:Arial,sans-serif'
    ].join(';');
    const label = document.createElement('span');
    label.textContent = isAppRuntime() ? 'Link publico aberto no app' : 'Portal publico';
    label.style.cssText = 'color:#cbd5e1;font-size:12px;font-weight:700;margin-right:4px;';
    bar.appendChild(label);
    if (httpUrl) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Abrir no navegador';
      btn.style.cssText = 'border:0;border-radius:6px;background:#7dd3fc;color:#020617;font-weight:800;padding:9px 12px;cursor:pointer;';
      btn.onclick = () => window.thiaOpenExternalUrl(httpUrl);
      bar.appendChild(btn);
    }
    if (apkUrl) {
      const apk = document.createElement('button');
      apk.type = 'button';
      apk.textContent = 'Instalar APK';
      apk.style.cssText = 'border:1px solid rgba(125,211,252,.4);border-radius:6px;background:transparent;color:#e0f2fe;font-weight:800;padding:8px 12px;cursor:pointer;';
      apk.onclick = () => window.thiaOpenExternalUrl(apkUrl);
      bar.appendChild(apk);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'x';
    close.setAttribute('aria-label', 'Fechar');
    close.style.cssText = 'border:0;background:transparent;color:#94a3b8;font-weight:900;padding:8px;cursor:pointer;';
    close.onclick = () => bar.remove();
    bar.appendChild(close);
    document.body.appendChild(bar);
  };

  window.thiaBuildWhatsAppUrl = function (phone, message, opts) {
    opts = opts || {};
    const fone = normalizarTelefoneBR(phone);
    if (!fone) return '';
    const text = encodeURIComponent(message || '');
    if (opts.transport === 'app') {
      return `whatsapp://send?phone=${fone}&text=${text}`;
    }
    if (opts.transport === 'web') {
      return `https://web.whatsapp.com/send?phone=${fone}&text=${text}`;
    }
    if (opts.forceWaMe || isMobileRuntime()) {
      return `https://wa.me/${fone}?text=${text}`;
    }
    return `https://web.whatsapp.com/send?phone=${fone}&text=${text}`;
  };

  function confirmarFallbackWebWhatsApp(opts) {
    if (opts.confirmWebFallback === false) return true;
    try {
      return window.confirm('O WhatsApp app nao abriu ou foi cancelado. Deseja abrir o WhatsApp Web no navegador?');
    } catch (_) {
      return false;
    }
  }

  function abrirWhatsAppWebOpcional(url, opts) {
    if (!url) return false;
    if (!confirmarFallbackWebWhatsApp(opts)) {
      window.toast?.('WhatsApp Web nao aberto. Voce continuou no SaaS.', 'warn');
      return false;
    }
    const opened = window.open(url, '_blank', 'noopener');
    if (opened) {
      try { opened.focus(); } catch (_) {}
      return true;
    }
    if (opts.allowSameTabFallback === true && opts.fallbackNavigate !== false) {
      try { window.location.href = url; return true; } catch (_) {}
    }
    window.toast?.('O navegador bloqueou o WhatsApp Web. Use a opcao de abrir pelo navegador quando quiser.', 'warn');
    return false;
  }

  window.thiaOpenWhatsApp = function (phone, message, opts) {
    opts = Object.assign({
      fallbackNavigate: true,
      preferDesktopApp: true,
      confirmWebFallback: true,
      appFallbackDelayMs: 2400,
      allowSameTabFallback: false
    }, opts || {});
    if (opts.preferDesktopApp && !opts.forceWeb && !isMobileRuntime()) {
      const appUrl = window.thiaBuildWhatsAppUrl(phone, message, Object.assign({}, opts, { transport: 'app' }));
      if (appUrl) {
        try {
          window.location.href = appUrl;
          if (opts.fallbackNavigate !== false) {
            const startedAt = Date.now();
            setTimeout(function () {
              if (document.visibilityState === 'visible' && Date.now() - startedAt >= opts.appFallbackDelayMs) {
                const webUrl = window.thiaBuildWhatsAppUrl(phone, message, Object.assign({}, opts, { transport: 'web' }));
                abrirWhatsAppWebOpcional(webUrl, opts);
              }
            }, opts.appFallbackDelayMs);
          }
          return true;
        } catch (_) {}
      }
    }
    const url = window.thiaBuildWhatsAppUrl(phone, message, opts);
    if (!url) return false;
    const opened = window.open(url, '_blank', 'noopener');
    if (opened) {
      try { opened.focus(); } catch (_) {}
      return true;
    }
    if (opts.allowSameTabFallback === true && opts.fallbackNavigate !== false) {
      try { window.location.href = url; } catch (_) {}
    } else if (opts.fallbackNavigate !== false) {
      window.toast?.('O navegador bloqueou a abertura do WhatsApp. A tela atual foi preservada.', 'warn');
    }
    return false;
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      window.thiaInjectPortalInstallBar();
    }, 400);
  });
})();
