/**
 * Integração Cilia — módulo isolado e não destrutivo.
 *
 * Segurança: este front-end NÃO grava token fixo no código. O token deve ficar no
 * Firestore/RTDB via superadmin/tenant. Em app puramente estático, qualquer token usado
 * pelo navegador/WebView pode ser visto por quem inspecionar o tráfego/app; para uso
 * 100% seguro, crie futuramente uma Cloud Function/proxy e salve o token somente no servidor.
 */
(function(){
  'use strict';

  const W = window;
  const J = W.J || (W.J = {});
  const $ = id => document.getElementById(id);
  const val = id => ($(id) ? String($(id).value || '').trim() : '');
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const DEFAULTS = {
    empresa: 'SOS MECANICA E ELETRICA',
    cnpj: '063.152.340/0001-04',
    baseUrl: '',
    endpoint: ''
  };

  function toast(msg, type='ok'){
    if (typeof W.toast === 'function') return W.toast(msg, type);
    console.log('[CILIA]', msg);
  }

  function db(){
    try { return W.initFirebase ? W.initFirebase() : firebase.firestore(); }
    catch(e){ return null; }
  }

  function readSessao(){
    return {
      token: sessionStorage.getItem('j_cilia_token') || '',
      empresa: sessionStorage.getItem('j_cilia_empresa') || DEFAULTS.empresa,
      cnpj: sessionStorage.getItem('j_cilia_cnpj') || DEFAULTS.cnpj,
      baseUrl: sessionStorage.getItem('j_cilia_base_url') || DEFAULTS.baseUrl,
      endpoint: sessionStorage.getItem('j_cilia_endpoint') || DEFAULTS.endpoint
    };
  }

  async function readTenantConfig(){
    const local = readSessao();
    if (local.token || local.baseUrl || local.endpoint) return local;
    const database = db();
    if (!database || !J.tid) return local;
    try{
      const doc = await database.collection('oficinas').doc(J.tid).get();
      const d = doc.exists ? (doc.data() || {}) : {};
      const c = d.integracoes?.cilia || d.cilia || {};
      const api = d.apiKeys || {};
      return {
        token: c.token || api.ciliaToken || local.token,
        empresa: c.empresa || api.ciliaEmpresa || local.empresa,
        cnpj: c.cnpj || api.ciliaCnpj || local.cnpj,
        baseUrl: c.baseUrl || api.ciliaBaseUrl || local.baseUrl,
        endpoint: c.endpoint || api.ciliaEndpoint || local.endpoint
      };
    }catch(e){
      return local;
    }
  }

  function preencherConfigTela(cfg){
    if($('ciliaEmpresa')) $('ciliaEmpresa').value = cfg.empresa || '';
    if($('ciliaCnpj')) $('ciliaCnpj').value = cfg.cnpj || '';
    if($('ciliaBaseUrl')) $('ciliaBaseUrl').value = cfg.baseUrl || '';
    if($('ciliaEndpoint')) $('ciliaEndpoint').value = cfg.endpoint || '';
    if($('ciliaStatus')) {
      const semEndpoint = !cfg.baseUrl || !cfg.endpoint;
      const semToken = !cfg.token;
      $('ciliaStatus').innerHTML = semEndpoint
        ? '⚠ Integração cadastrada, mas sem URL/endpoint oficial da API Cilia. Configure a URL quando o Cilia fornecer o endpoint técnico.'
        : semToken
          ? '⚠ Endpoint configurado, mas token não encontrado.'
          : '✓ Configuração Cilia pronta para consulta.';
      $('ciliaStatus').style.color = semEndpoint || semToken ? 'var(--warn)' : 'var(--success)';
    }
  }

  function montarUrl(cfg, tipo, termo){
    const base = String(cfg.baseUrl || '').replace(/\/+$/,'');
    let ep = String(cfg.endpoint || '').trim();
    if (!base || !ep) return '';
    if (!ep.startsWith('/')) ep = '/' + ep;
    const rep = {
      '{token}': encodeURIComponent(cfg.token || ''),
      '{cnpj}': encodeURIComponent(cfg.cnpj || ''),
      '{empresa}': encodeURIComponent(cfg.empresa || ''),
      '{tipo}': encodeURIComponent(tipo || ''),
      '{termo}': encodeURIComponent(termo || '')
    };
    Object.keys(rep).forEach(k => { ep = ep.split(k).join(rep[k]); });
    return base + ep;
  }

  function headers(cfg){
    const h = {'Accept':'application/json'};
    if (cfg.token) {
      h.Authorization = 'Bearer ' + cfg.token;
      h['X-Cilia-Token'] = cfg.token;
    }
    if (cfg.cnpj) h['X-CNPJ'] = cfg.cnpj;
    return h;
  }

  function renderResultado(payload){
    const out = $('ciliaResultado');
    if(!out) return;
    const status = payload.status || '';
    const body = payload.body;
    if (typeof body === 'string') {
      out.innerHTML = `<div style="color:var(--muted2);font-family:var(--fm);font-size:0.72rem;margin-bottom:8px;">STATUS: ${esc(status)}</div><pre style="white-space:pre-wrap;word-break:break-word;margin:0;">${esc(body)}</pre>`;
      return;
    }
    out.innerHTML = `<div style="color:var(--muted2);font-family:var(--fm);font-size:0.72rem;margin-bottom:8px;">STATUS: ${esc(status)}</div><pre style="white-space:pre-wrap;word-break:break-word;margin:0;">${esc(JSON.stringify(body, null, 2))}</pre>`;
  }

  async function registrarConsulta(tipo, termo, resposta, erro){
    const database = db();
    if (!database || !J.tid) return;
    try{
      await database.collection('cilia_consultas').add({
        tenantId: J.tid,
        usuario: J.nome || '',
        role: J.role || '',
        tipo, termo,
        ok: !erro,
        erro: erro ? String(erro.message || erro) : '',
        resumo: erro ? '' : JSON.stringify(resposta).slice(0, 1200),
        ts: Date.now(),
        createdAt: new Date().toISOString()
      });
    }catch(e){}
  }

  W.ciliaCarregar = async function(){
    const cfg = await readTenantConfig();
    preencherConfigTela(cfg);
    return cfg;
  };

  W.ciliaPesquisar = async function(){
    const tipo = val('ciliaTipo') || 'geral';
    const termo = val('ciliaBusca');
    const out = $('ciliaResultado');
    if(!termo){ toast('⚠ Informe placa, sinistro, orçamento, chassi ou termo de busca.', 'warn'); return; }
    const cfg = await readTenantConfig();
    // Permite override visual temporário da URL/endpoint sem salvar, para testes.
    cfg.baseUrl = val('ciliaBaseUrl') || cfg.baseUrl;
    cfg.endpoint = val('ciliaEndpoint') || cfg.endpoint;
    cfg.cnpj = val('ciliaCnpj') || cfg.cnpj;
    cfg.empresa = val('ciliaEmpresa') || cfg.empresa;

    if(!cfg.token){
      const msg = 'Token Cilia não encontrado. Cadastre no Superadmin/Tenant antes de consultar.';
      if(out) out.innerHTML = `<div style="color:var(--warn)">${esc(msg)}</div>`;
      toast('⚠ Token Cilia não cadastrado.', 'warn');
      return;
    }
    const url = montarUrl(cfg, tipo, termo);
    if(!url){
      const msg = 'A URL oficial da API Cilia ainda não foi configurada. O token foi extraído, mas o PDF não trouxe endpoint de consulta. Quando o Cilia fornecer a URL técnica, preencha Base URL e Endpoint nesta tela ou no Superadmin.';
      if(out) out.innerHTML = `<div style="color:var(--warn);line-height:1.5">${esc(msg)}</div>`;
      toast('⚠ Falta endpoint oficial da API Cilia.', 'warn');
      return;
    }

    if(out) out.innerHTML = '⏳ Consultando Cilia...';
    try{
      const r = await fetch(url, {method:'GET', headers: headers(cfg)});
      const ct = r.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await r.json() : await r.text();
      const payload = {status: `${r.status} ${r.statusText}`, body};
      renderResultado(payload);
      await registrarConsulta(tipo, termo, payload, r.ok ? null : new Error(payload.status));
      if(!r.ok) toast('⚠ Cilia respondeu com erro HTTP ' + r.status, 'warn');
      else toast('✓ Consulta Cilia concluída');
    }catch(e){
      if(out) out.innerHTML = `<div style="color:var(--danger)">✕ ${esc(e.message)}</div>`;
      await registrarConsulta(tipo, termo, null, e);
      toast('✕ Erro Cilia: ' + e.message, 'err');
    }
  };

  W.ciliaTestarConfig = async function(){
    const cfg = await readTenantConfig();
    cfg.baseUrl = val('ciliaBaseUrl') || cfg.baseUrl;
    cfg.endpoint = val('ciliaEndpoint') || cfg.endpoint;
    cfg.cnpj = val('ciliaCnpj') || cfg.cnpj;
    cfg.empresa = val('ciliaEmpresa') || cfg.empresa;
    preencherConfigTela(cfg);
    const out = $('ciliaResultado');
    if(out) out.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word;margin:0;">${esc(JSON.stringify({
      empresa: cfg.empresa,
      cnpj: cfg.cnpj,
      tokenEncontrado: !!cfg.token,
      baseUrl: cfg.baseUrl,
      endpoint: cfg.endpoint,
      prontoParaChamarApi: !!(cfg.token && cfg.baseUrl && cfg.endpoint)
    }, null, 2))}</pre>`;
  };

  document.addEventListener('DOMContentLoaded', function(){
    W.ciliaCarregar();
    const input = $('ciliaBusca');
    if(input) input.addEventListener('keydown', e => { if(e.key === 'Enter') W.ciliaPesquisar(); });
  });
})();
