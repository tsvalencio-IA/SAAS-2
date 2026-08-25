/*
 * thIAguinho SaaS - tenant/modules guard
 * Centraliza leitura de modulos, submodulos, brain e templates da oficina.
 * Nao remove logica existente: apenas oculta/bloqueia superficies quando o
 * superadmin desligar um modulo.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;

  const DEFAULT_MODULES = Object.freeze({
    os: true,
    crm: true,
    estoque: true,
    financeiro: true,
    ia: true,
    chat: true,
    agenda: true,
    rh: true,
    comissoes: false,
    autoPecas: false,
    vendaTerceiros: false,
    varejo: true,
    atacado: false,
    comissaoVendas: false,
    tabelaTempa: true,
    cilia: true,
    cotacao: true,
    clienteOficial: true,
    assinatura: true,
    pdf: true,
    xlsx: true,
    auditoria: true,
    relatorios: true,
    exportacoes: true,
    whatsappBot: false,
    templates: true
  });

  const DEPENDENCIES = Object.freeze({
    cotacao: ['os', 'estoque'],
    clienteOficial: ['os', 'crm'],
    tabelaTempa: ['os'],
    cilia: ['os'],
    assinatura: ['os'],
    pdf: ['os'],
    xlsx: ['os'],
    financeiro: [],
    autoPecas: ['estoque'],
    comissaoVendas: ['autoPecas', 'financeiro'],
    whatsappBot: ['chat']
  });

  function parseJson(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function oficinaAtual() {
    return W.J?.oficina
      || W.P?.oficina
      || W._OFIC
      || parseJson(sessionStorage.getItem('j_oficina'))
      || {};
  }

  function modulos() {
    const ofi = oficinaAtual();
    return Object.assign({}, DEFAULT_MODULES, ofi.modulos || {});
  }

  function submodulos() {
    return oficinaAtual().submodulos || {};
  }

  function enabled(key) {
    const mods = modulos();
    if (mods[key] === false) return false;
    const deps = DEPENDENCIES[key] || [];
    return deps.every(dep => mods[dep] !== false);
  }

  function subEnabled(path) {
    const parts = String(path || '').split('.').filter(Boolean);
    if (!parts.length) return true;
    let node = submodulos();
    for (const part of parts) {
      if (!node || typeof node !== 'object' || !(part in node)) return true;
      node = node[part];
    }
    return node !== false;
  }

  function brain() {
    const ofi = oficinaAtual();
    return Object.assign({
      contexto: '',
      catalogos: '',
      erros: '',
      regras: '',
      procedimentos: ''
    }, ofi.brain || ofi.cerebro || ofi.thiaguinhoBrain || {});
  }

  function templates() {
    const ofi = oficinaAtual();
    return Object.assign({
      pdfOrcamento: '',
      pdfLaudo: '',
      planilhaPMSP: '',
      observacoes: ''
    }, ofi.templates || ofi.modelosDocumentos || {});
  }

  function setBodyFlags() {
    if (!D.body) return;
    const mods = modulos();
    Object.keys(DEFAULT_MODULES).forEach(key => {
      const attr = 'mod' + key.charAt(0).toUpperCase() + key.slice(1);
      D.body.dataset[attr] = enabled(key) ? 'on' : 'off';
      D.documentElement.dataset[attr] = enabled(key) ? 'on' : 'off';
    });
    W._thiaModulosResolvidos = mods;
  }

  function applyVisibility(root) {
    root = root || D;
    setBodyFlags();
    root.querySelectorAll('[data-module]').forEach(el => {
      const keys = String(el.getAttribute('data-module') || '').split(',').map(v => v.trim()).filter(Boolean);
      const ok = !keys.length || keys.every(enabled);
      el.style.display = ok ? '' : 'none';
      el.setAttribute('aria-hidden', ok ? 'false' : 'true');
    });
    root.querySelectorAll('[data-submodule]').forEach(el => {
      const keys = String(el.getAttribute('data-submodule') || '').split(',').map(v => v.trim()).filter(Boolean);
      const moduleKeys = String(el.getAttribute('data-module') || '').split(',').map(v => v.trim()).filter(Boolean);
      const moduleOk = !moduleKeys.length || moduleKeys.every(enabled);
      const ok = moduleOk && (!keys.length || keys.every(subEnabled));
      el.style.display = ok ? '' : 'none';
      el.setAttribute('aria-hidden', ok ? 'false' : 'true');
    });
  }

  function dependencyWarnings(rawMods) {
    const mods = Object.assign({}, DEFAULT_MODULES, rawMods || modulos());
    const labels = {
      os: 'O.S.',
      crm: 'CRM/Clientes',
      estoque: 'Estoque',
      financeiro: 'Financeiro',
      chat: 'Chat',
      autoPecas: 'Autopecas'
    };
    const out = [];
    Object.entries(DEPENDENCIES).forEach(([key, deps]) => {
      if (mods[key] === false) return;
      deps.forEach(dep => {
        if (mods[dep] === false) out.push(key + ' depende de ' + (labels[dep] || dep) + '.');
      });
    });
    return out;
  }

  function tenantParam() {
    try {
      const p = new URLSearchParams(W.location.search);
      return (p.get('tenant') || p.get('t') || p.get('oficina') || p.get('slug') || '').trim();
    } catch (_) { return ''; }
  }

  function installCss() {
    if (D.getElementById('thiaTenantModulesCss')) return;
    const st = D.createElement('style');
    st.id = 'thiaTenantModulesCss';
    st.textContent = `
      body[data-mod-tabela-tempa="off"] #navTabelaTempa,
      body[data-mod-tabela-tempa="off"] [onclick*="_tempaSugerir"],
      body[data-mod-tabela-tempa="off"] [onclick*="tempa"],
      body[data-mod-cilia="off"] [id*="cilia" i],
      body[data-mod-cotacao="off"] #cotacaoPecasOSSlot,
      body[data-mod-cotacao="off"] [onclick*="Cotacao"],
      body[data-mod-cotacao="off"] [onclick*="cotacao"],
      body[data-mod-pdf="off"] #btnGerarPDFOS,
      body[data-mod-xlsx="off"] #btnExportarPMSP,
      body[data-mod-xlsx="off"] #btnExportarPMSPItens,
      body[data-mod-assinatura="off"] [data-tab-target="tabOS4"],
      body[data-mod-auditoria="off"] [onclick*="auditoria"],
      body[data-mod-cliente-oficial="off"] [data-module="clienteOficial"]{display:none!important}
    `;
    D.head.appendChild(st);
  }

  W.thiaTenantModulesDefaults = DEFAULT_MODULES;
  W.thiaTenantModuleDependencies = DEPENDENCIES;
  W.thiaGetOficinaAtual = oficinaAtual;
  W.thiaGetModulos = modulos;
  W.thiaGetSubmodulos = submodulos;
  W.thiaModEnabled = enabled;
  W.thiaSubEnabled = subEnabled;
  W.thiaGetBrain = brain;
  W.thiaGetTemplates = templates;
  W.thiaApplyModuleVisibility = applyVisibility;
  W.thiaModuleDependencyWarnings = dependencyWarnings;
  W.thiaTenantParam = tenantParam;

  D.addEventListener('DOMContentLoaded', function () {
    installCss();
    applyVisibility(D);
    setTimeout(() => applyVisibility(D), 500);
  });
})();
