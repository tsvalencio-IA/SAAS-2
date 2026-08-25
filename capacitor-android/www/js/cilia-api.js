/*
  Integração Cília API — thIAguinho Soluções
  ------------------------------------------------------------
  Arquivo novo, isolado e não invasivo.
  NÃO substitui o importador antigo de PDF/XML do Cília.
  NÃO altera window.importarCilia(this).

  Fluxo suportado conforme endpoints reais capturados no Cília:
  - GET /vehicle/search/license-plate?licensePlate=PLACA
  - GET /vehicle-type-areas?vehicleCompositionCiliaId=ID
  - GET /vehicle-type-areas/{areaId}/vehicle-part-regions?vehicleCompositionCiliaId=ID
  - GET /vehicle-parts?vehicleCompositionCiliaId=ID&vehiclePartRegionId=REGION_ID
  - GET /vehicle-pieces?vehiclePartCompositionId=PART_ID&vehicleCompositionCiliaId=ID

  Autenticação:
  - Usa token oficial/Bearer informado pela oficina.
  - Salva no localStorage por tenant/oficina/aparelho.
  - Não salva token fixo no código.
*/
(function () {
  'use strict';

  const CILIA_BASE = 'https://gateway-oficinas.cilia.com.br';
  const MODAL_ID = 'modalCiliaPesquisaApi';
  const STYLE_ID = 'styleCiliaPesquisaApi';

  const state = {
    token: '',
    usuario: '',
    senha: '',
    placa: '',
    veiculos: [],
    veiculo: null,
    areas: [],
    area: null,
    regioes: [],
    regiao: null,
    grupos: [],
    grupo: null,
    pecas: [],
    carregando: false
  };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(v) {
    const n = Number(String(v || 0).replace(',', '.')) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function cleanPlate(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  }

  function cleanToken(v) {
    return String(v || '').trim().replace(/^Bearer\s+/i, '').trim();
  }

  function getTenantKey() {
    const keys = ['j_tid', 'tenantId', 'oficinaId', 'tid'];
    for (const k of keys) {
      const v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (v) return String(v);
    }
    if (window.J && (window.J.tid || window.J.tenantId || window.J.oficinaId)) {
      return String(window.J.tid || window.J.tenantId || window.J.oficinaId);
    }
    return 'oficina_padrao';
  }

  function storageKey() {
    return 'thiaguinho:ciliar_api:' + getTenantKey();
  }

  function toast(msg, tipo) {
    if (typeof window.toast === 'function') {
      window.toast(msg, tipo || 'info');
      return;
    }
    console[tipo === 'err' ? 'error' : 'log']('[Cília]', msg);
  }

  function setLoading(on, msg) {
    state.carregando = !!on;
    const box = $('ciliaStatusApi');
    if (box) {
      box.innerHTML = on
        ? `<span class="cilia-spinner"></span> ${escapeHtml(msg || 'Consultando Cília...')}`
        : escapeHtml(msg || '');
      box.style.display = msg || on ? 'block' : 'none';
    }
    const btns = document.querySelectorAll('#' + MODAL_ID + ' button, #' + MODAL_ID + ' input, #' + MODAL_ID + ' textarea');
    btns.forEach(el => {
      if (el.dataset.noDisable === '1') return;
      el.disabled = !!on;
    });
  }

  function carregarCredenciais() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      state.token = data.token || '';
      state.usuario = data.usuario || '';
      state.senha = data.senha || '';
    } catch (e) {
      console.warn('[Cília] Falha ao carregar localStorage:', e);
    }
  }

  function salvarCredenciais() {
    const token = cleanToken(($('ciliaTokenApi') || {}).value || state.token || '');
    const usuario = (($('ciliaUsuarioApi') || {}).value || '').trim();
    const senha = (($('ciliaSenhaApi') || {}).value || '').trim();
    state.token = token;
    state.usuario = usuario;
    state.senha = senha;
    localStorage.setItem(storageKey(), JSON.stringify({
      token,
      usuario,
      senha,
      tenant: getTenantKey(),
      atualizadoEm: new Date().toISOString()
    }));
    toast('Credenciais Cília salvas neste aparelho.', 'ok');
  }

  function limparCredenciais() {
    localStorage.removeItem(storageKey());
    state.token = '';
    state.usuario = '';
    state.senha = '';
    if ($('ciliaTokenApi')) $('ciliaTokenApi').value = '';
    if ($('ciliaUsuarioApi')) $('ciliaUsuarioApi').value = '';
    if ($('ciliaSenhaApi')) $('ciliaSenhaApi').value = '';
    toast('Credenciais Cília removidas deste aparelho.', 'warn');
  }

  async function ciliaGet(path) {
    const token = cleanToken(($('ciliaTokenApi') || {}).value || state.token);
    if (!token) throw new Error('Informe o token oficial/Bearer do Cília antes de consultar.');
    const url = CILIA_BASE + path;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': 'Bearer ' + token
      }
    });
    let body = null;
    const contentType = res.headers.get('content-type') || '';
    try {
      body = contentType.includes('application/json') ? await res.json() : await res.text();
    } catch (e) {
      body = null;
    }
    if (!res.ok) {
      const detalhe = typeof body === 'string' ? body : JSON.stringify(body || {});
      throw new Error('Cília retornou HTTP ' + res.status + (detalhe ? ': ' + detalhe.slice(0, 300) : ''));
    }
    return body;
  }

  async function buscarVeiculos() {
    if (window.exigirModulo && !window.exigirModulo('cilia')) return;
    salvarCredenciais();
    const placa = cleanPlate(($('ciliaPlacaApi') || {}).value || state.placa);
    if (!placa) {
      toast('Digite a placa para pesquisar no Cília.', 'warn');
      return;
    }
    state.placa = placa;
    resetAbaixo('veiculo');
    renderAll();
    setLoading(true, 'Buscando veículo por placa no Cília...');
    try {
      const data = await ciliaGet('/vehicle/search/license-plate?licensePlate=' + encodeURIComponent(placa));
      state.veiculos = Array.isArray(data) ? data : [];
      renderAll();
      if (!state.veiculos.length) toast('Nenhum veículo retornado pelo Cília para essa placa.', 'warn');
    } catch (e) {
      renderErro(e);
    } finally {
      setLoading(false);
    }
  }

  async function selecionarVeiculo(idx) {
    const veiculo = state.veiculos[Number(idx)];
    if (!veiculo) return;
    state.veiculo = veiculo;
    resetAbaixo('area');
    renderAll();
    setLoading(true, 'Carregando áreas do veículo...');
    try {
      const id = veiculo.ciliaCompositionId;
      const data = await ciliaGet('/vehicle-type-areas?vehicleCompositionCiliaId=' + encodeURIComponent(id));
      state.areas = Array.isArray(data && data.vehicleTypeAreas) ? data.vehicleTypeAreas : [];
      state.areaMapImage = data && data.imageUrl ? data.imageUrl : '';
      renderAll();
    } catch (e) {
      renderErro(e);
    } finally {
      setLoading(false);
    }
  }

  async function selecionarArea(idx) {
    const area = state.areas[Number(idx)];
    if (!area || !state.veiculo) return;
    state.area = area;
    resetAbaixo('regiao');
    renderAll();
    setLoading(true, 'Carregando sub-regiões da área...');
    try {
      const path = '/vehicle-type-areas/' + encodeURIComponent(area.id) + '/vehicle-part-regions?vehicleCompositionCiliaId=' + encodeURIComponent(state.veiculo.ciliaCompositionId);
      const data = await ciliaGet(path);
      state.regioes = Array.isArray(data) ? data : [];
      renderAll();
    } catch (e) {
      renderErro(e);
    } finally {
      setLoading(false);
    }
  }

  async function selecionarRegiao(idx) {
    const regiao = state.regioes[Number(idx)];
    if (!regiao || !state.veiculo) return;
    state.regiao = regiao;
    resetAbaixo('grupo');
    renderAll();
    setLoading(true, 'Carregando grupos de peças...');
    try {
      const path = '/vehicle-parts?vehicleCompositionCiliaId=' + encodeURIComponent(state.veiculo.ciliaCompositionId) + '&vehiclePartRegionId=' + encodeURIComponent(regiao.id);
      const data = await ciliaGet(path);
      state.grupos = Array.isArray(data) ? data : [];
      renderAll();
    } catch (e) {
      renderErro(e);
    } finally {
      setLoading(false);
    }
  }

  async function selecionarGrupo(idx) {
    const grupo = state.grupos[Number(idx)];
    if (!grupo || !state.veiculo) return;
    state.grupo = grupo;
    state.pecas = [];
    renderAll();
    setLoading(true, 'Carregando peças finais com preço...');
    try {
      const partId = grupo.vehiclePartCompositionCiliaId;
      const path = '/vehicle-pieces?vehiclePartCompositionId=' + encodeURIComponent(partId) + '&vehicleCompositionCiliaId=' + encodeURIComponent(state.veiculo.ciliaCompositionId);
      const data = await ciliaGet(path);
      state.pecas = Array.isArray(data) ? data : [];
      renderAll();
      if (!state.pecas.length) toast('O Cília não retornou peça final para esse grupo.', 'warn');
    } catch (e) {
      renderErro(e);
    } finally {
      setLoading(false);
    }
  }

  function resetAbaixo(nivel) {
    if (nivel === 'veiculo') {
      state.veiculos = [];
      state.veiculo = null;
      state.areas = [];
      state.area = null;
      state.regioes = [];
      state.regiao = null;
      state.grupos = [];
      state.grupo = null;
      state.pecas = [];
    }
    if (nivel === 'area') {
      state.areas = [];
      state.area = null;
      state.regioes = [];
      state.regiao = null;
      state.grupos = [];
      state.grupo = null;
      state.pecas = [];
    }
    if (nivel === 'regiao') {
      state.regioes = [];
      state.regiao = null;
      state.grupos = [];
      state.grupo = null;
      state.pecas = [];
    }
    if (nivel === 'grupo') {
      state.grupos = [];
      state.grupo = null;
      state.pecas = [];
    }
  }

  function renderErro(e) {
    console.error('[Cília API]', e);
    const msg = e && e.message ? e.message : String(e || 'Erro desconhecido');
    const box = $('ciliaResultadosApi');
    if (box) {
      box.innerHTML = `<div class="cilia-alert cilia-alert-erro"><b>Erro na consulta Cília</b><br>${escapeHtml(msg)}</div>`;
    }
    toast('Erro na consulta Cília: ' + msg, 'err');
  }

  function renderAll() {
    const box = $('ciliaResultadosApi');
    if (!box) return;
    const html = [];
    html.push(renderResumo());
    html.push(renderVeiculos());
    html.push(renderAreas());
    html.push(renderRegioes());
    html.push(renderGrupos());
    html.push(renderPecas());
    box.innerHTML = html.join('');
  }

  function renderResumo() {
    const crumbs = [];
    if (state.placa) crumbs.push('Placa: ' + escapeHtml(state.placa));
    if (state.veiculo) crumbs.push('Veículo: ' + escapeHtml(state.veiculo.fullName || 'Selecionado'));
    if (state.area) crumbs.push('Área: ' + escapeHtml(state.area.name));
    if (state.regiao) crumbs.push('Região: ' + escapeHtml(state.regiao.name));
    if (state.grupo) crumbs.push('Grupo: ' + escapeHtml(state.grupo.name));
    if (!crumbs.length) return '<div class="cilia-empty">Digite a placa, informe o token Cília e clique em pesquisar.</div>';
    return '<div class="cilia-crumbs">' + crumbs.map(c => '<span>' + c + '</span>').join('') + '</div>';
  }

  function renderVeiculos() {
    if (!state.veiculos.length) return '';
    return `<div class="cilia-block"><h4>1. Veículos encontrados</h4><div class="cilia-list">${state.veiculos.map((v, i) => `
      <button type="button" class="cilia-card ${state.veiculo === v ? 'sel' : ''}" onclick="window.CiliaPesquisa.selecionarVeiculo(${i})">
        ${v.previewImage ? `<img src="${escapeHtml(v.previewImage)}" alt="">` : ''}
        <span><b>${escapeHtml(v.fullName || 'Veículo Cília')}</b><small>${escapeHtml((v.vehicleBrand && v.vehicleBrand.name) || '')} • ${escapeHtml((v.vehicleEngine && v.vehicleEngine.name) || '')} • ID ${escapeHtml(v.ciliaCompositionId)}</small></span>
      </button>`).join('')}</div></div>`;
  }

  function renderAreas() {
    if (!state.veiculo || !state.areas.length) return '';
    return `<div class="cilia-block"><h4>2. Áreas do veículo</h4><div class="cilia-grid">${state.areas.map((a, i) => `
      <button type="button" class="cilia-pill ${state.area === a ? 'sel' : ''}" onclick="window.CiliaPesquisa.selecionarArea(${i})">${escapeHtml(a.name)}</button>`).join('')}</div></div>`;
  }

  function renderRegioes() {
    if (!state.area || !state.regioes.length) return '';
    return `<div class="cilia-block"><h4>3. Sub-regiões</h4><div class="cilia-grid">${state.regioes.map((r, i) => `
      <button type="button" class="cilia-pill ${state.regiao === r ? 'sel' : ''}" onclick="window.CiliaPesquisa.selecionarRegiao(${i})">${r.favorite ? '⭐ ' : ''}${escapeHtml(r.name)}</button>`).join('')}</div></div>`;
  }

  function renderGrupos() {
    if (!state.regiao || !state.grupos.length) return '';
    return `<div class="cilia-block"><h4>4. Grupos de peças</h4><div class="cilia-list">${state.grupos.map((g, i) => `
      <button type="button" class="cilia-card ${state.grupo === g ? 'sel' : ''}" onclick="window.CiliaPesquisa.selecionarGrupo(${i})">
        ${g.imageUrl ? `<img src="${escapeHtml(g.imageUrl)}" alt="">` : ''}
        <span><b>${g.favorite ? '⭐ ' : ''}${escapeHtml(g.name)}</b><small>ID composição: ${escapeHtml(g.vehiclePartCompositionCiliaId)} • Categoria: ${escapeHtml(g.pieceCategory || '')}</small></span>
      </button>`).join('')}</div></div>`;
  }

  function renderPecas() {
    if (!state.grupo || !state.pecas.length) return '';
    return `<div class="cilia-block"><h4>5. Peças finais / ofertas</h4><div class="cilia-list">${state.pecas.map((p, i) => `
      <div class="cilia-piece">
        ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : ''}
        <div class="cilia-piece-info">
          <b>${escapeHtml(p.name || p.vehiclePartName || 'Peça Cília')}</b>
          <small>Código: ${escapeHtml(p.code || p.ciliaId || '')} • Tipo: ${escapeHtml(p.pieceType || '')} • Cília ID: ${escapeHtml(p.vehiclePieceCiliaId || p.ciliaId || '')}</small>
        </div>
        <div class="cilia-price">${money(p.price)}</div>
        <button type="button" class="cilia-add" onclick="window.CiliaPesquisa.adicionarPecaOS(${i})">Adicionar à OS</button>
      </div>`).join('')}</div></div>`;
  }

  function adicionarPecaOS(idx) {
    const p = state.pecas[Number(idx)];
    if (!p) return;
    const dados = {
      codigo: p.code || p.ciliaId || p.vehiclePieceCiliaId || '',
      desc: p.name || p.vehiclePartName || state.grupo?.name || 'Peça Cília',
      qtd: 1,
      venda: Number(p.price || 0) || 0,
      custo: 0,
      ciliaBruto: Number(p.price || 0) || 0,
      ciliaValorLiquido: Number(p.price || 0) || 0,
      ciliaDesconto: 0,
      ciliaPieceIndex: Date.now(),
      ciliaMeta: {
        placa: state.placa,
        vehicleCompositionCiliaId: state.veiculo && state.veiculo.ciliaCompositionId,
        vehiclePieceCiliaId: p.vehiclePieceCiliaId,
        ciliaId: p.ciliaId,
        pieceType: p.pieceType,
        category: p.vehiclePartCategoryCiliaName || p.vehiclePartName || state.grupo?.name || '',
        origem: 'Pesquisa Cília API'
      }
    };

    if (typeof window.renderCiliaPecaOSRow === 'function') {
      window.renderCiliaPecaOSRow(dados, []);
    } else if (typeof window.renderPecaOSRow === 'function') {
      window.renderPecaOSRow(dados);
      if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
    } else {
      adicionarPecaManualFallback(dados);
    }
    toast('Peça Cília adicionada à OS.', 'ok');
  }

  function adicionarPecaManualFallback(p) {
    const cont = $('containerPecasOS');
    if (!cont) return;
    const row = document.createElement('div');
    row.dataset.pecaAvulsa = '1';
    row.style.cssText = 'display:grid;grid-template-columns:120px 1fr 60px 100px 32px;gap:8px;align-items:center;background:rgba(0,212,255,0.06);padding:8px;border-radius:4px;border:1px solid rgba(0,212,255,0.18);';
    row.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${escapeHtml(p.codigo)}" placeholder="Código">
      <input type="text" class="j-input peca-desc-livre" value="${escapeHtml(p.desc)}" placeholder="Descrição" oninput="window.calcOSTotal && window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="1" min="1" oninput="window.calcOSTotal && window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${Number(p.venda || 0).toFixed(2).replace('.', ',')}" oninput="window.calcOSTotal && window.calcOSTotal()">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal && window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>`;
    cont.appendChild(row);
    if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
  }

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = `
      .cilia-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:99990;display:none;align-items:center;justify-content:center;padding:16px;}
      .cilia-modal-backdrop.open{display:flex;}
      .cilia-modal{width:min(1120px,96vw);max-height:92vh;background:var(--surf,#101827);border:1px solid rgba(167,139,250,.45);box-shadow:0 18px 70px rgba(0,0,0,.55);border-radius:12px;overflow:hidden;color:var(--text,#e5e7eb);display:flex;flex-direction:column;}
      .cilia-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(90deg,rgba(124,58,237,.22),rgba(0,212,255,.08));border-bottom:1px solid rgba(255,255,255,.08);}
      .cilia-modal-head h3{margin:0;font-family:var(--fd,Arial);font-size:1.02rem;color:#C4B5FD;letter-spacing:.5px;}
      .cilia-close{background:rgba(255,59,59,.12);border:1px solid rgba(255,59,59,.45);color:#ff8a8a;border-radius:6px;width:36px;height:32px;cursor:pointer;font-weight:900;}
      .cilia-modal-body{padding:14px;overflow:auto;}
      .cilia-form{display:grid;grid-template-columns:1.2fr 1.2fr 1.8fr 1fr auto;gap:8px;align-items:end;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:12px;}
      .cilia-field label{display:block;font-family:var(--fm,Arial);font-size:.66rem;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;}
      .cilia-field input{width:100%;box-sizing:border-box;background:var(--surf2,#111827);border:1px solid rgba(255,255,255,.14);color:var(--text,#fff);border-radius:6px;padding:9px 10px;font-family:var(--fm,Arial);font-size:.82rem;outline:none;}
      .cilia-field input:focus{border-color:#A78BFA;box-shadow:0 0 0 2px rgba(167,139,250,.14);}
      .cilia-actions{display:flex;gap:6px;flex-wrap:wrap;}
      .cilia-btn{background:#2563eb;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:6px;padding:9px 12px;font-family:var(--fm,Arial);font-weight:800;font-size:.72rem;cursor:pointer;letter-spacing:.4px;}
      .cilia-btn.secondary{background:rgba(255,255,255,.06);color:#cbd5e1;}
      .cilia-btn.danger{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);color:#fca5a5;}
      .cilia-status{display:none;margin:8px 0;padding:10px;border-radius:8px;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.18);font-family:var(--fm,Arial);font-size:.78rem;color:#A5F3FC;}
      .cilia-spinner{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid rgba(165,243,252,.3);border-top-color:#A5F3FC;animation:ciliaSpin .8s linear infinite;vertical-align:-2px;margin-right:6px;}@keyframes ciliaSpin{to{transform:rotate(360deg)}}
      .cilia-empty,.cilia-alert{padding:12px;border-radius:8px;background:rgba(255,255,255,.035);border:1px dashed rgba(255,255,255,.12);font-family:var(--fm,Arial);font-size:.82rem;color:var(--muted,#9ca3af);}
      .cilia-alert-erro{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.28);color:#fecaca;}
      .cilia-crumbs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}.cilia-crumbs span{font-family:var(--fm,Arial);font-size:.7rem;padding:5px 8px;border-radius:999px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.22);color:#DDD6FE;}
      .cilia-block{margin:12px 0;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025);}.cilia-block h4{margin:0 0 8px 0;font-family:var(--fd,Arial);font-size:.9rem;color:#93C5FD;}
      .cilia-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;}.cilia-list{display:flex;flex-direction:column;gap:8px;}
      .cilia-pill,.cilia-card{cursor:pointer;text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:var(--text,#e5e7eb);border-radius:8px;padding:9px 10px;font-family:var(--fm,Arial);font-size:.78rem;}.cilia-pill.sel,.cilia-card.sel{border-color:#A78BFA;background:rgba(167,139,250,.18);}
      .cilia-card{display:flex;gap:10px;align-items:center;}.cilia-card img{width:54px;height:42px;object-fit:contain;background:rgba(255,255,255,.08);border-radius:6px;}.cilia-card b{display:block;font-size:.8rem;}.cilia-card small{display:block;margin-top:3px;color:var(--muted,#9ca3af);font-size:.68rem;line-height:1.25;}
      .cilia-piece{display:grid;grid-template-columns:58px 1fr 120px 130px;gap:10px;align-items:center;border:1px solid rgba(0,212,255,.16);background:rgba(0,212,255,.045);border-radius:9px;padding:9px;}.cilia-piece img{width:52px;height:42px;object-fit:contain;background:rgba(255,255,255,.08);border-radius:6px;}.cilia-piece-info b{display:block;font-family:var(--fd,Arial);font-size:.82rem;color:#e5e7eb;}.cilia-piece-info small{display:block;color:var(--muted,#9ca3af);font-size:.68rem;margin-top:3px;}.cilia-price{font-family:var(--fd,Arial);font-size:1rem;color:#86EFAC;font-weight:900;text-align:right;}.cilia-add{background:#16a34a;border:1px solid rgba(255,255,255,.16);color:white;border-radius:6px;padding:8px 10px;font-weight:900;cursor:pointer;font-size:.72rem;}
      @media(max-width:780px){.cilia-modal-backdrop{align-items:stretch;padding:0;}.cilia-modal{width:100vw;max-height:100vh;border-radius:0;}.cilia-modal-body{padding:10px;}.cilia-form{grid-template-columns:1fr;}.cilia-actions{display:grid;grid-template-columns:1fr 1fr;}.cilia-btn{width:100%;}.cilia-piece{grid-template-columns:46px 1fr;}.cilia-price{text-align:left;}.cilia-add{grid-column:1/-1;}.cilia-grid{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(css);
  }

  function ensureModal() {
    injectStyle();
    let overlay = $(MODAL_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'cilia-modal-backdrop';
    overlay.innerHTML = `
      <div class="cilia-modal" role="dialog" aria-modal="true" aria-label="Pesquisar no Cília">
        <div class="cilia-modal-head">
          <h3>🔎 Pesquisar no Cília</h3>
          <button type="button" class="cilia-close" data-no-disable="1" onclick="window.CiliaPesquisa.fechar()">✕</button>
        </div>
        <div class="cilia-modal-body">
          <div class="cilia-form">
            <div class="cilia-field"><label>Usuário Cília</label><input id="ciliaUsuarioApi" autocomplete="username" placeholder="opcional"></div>
            <div class="cilia-field"><label>Senha Cília</label><input id="ciliaSenhaApi" type="password" autocomplete="current-password" placeholder="opcional"></div>
            <div class="cilia-field"><label>Token / Bearer Cília</label><input id="ciliaTokenApi" autocomplete="off" placeholder="Cole o token oficial do Cília"></div>
            <div class="cilia-field"><label>Placa</label><input id="ciliaPlacaApi" autocomplete="off" placeholder="ETR7E65" onkeydown="if(event.key==='Enter'){window.CiliaPesquisa.buscarVeiculos()}"></div>
            <div class="cilia-actions">
              <button type="button" class="cilia-btn" onclick="window.CiliaPesquisa.buscarVeiculos()">Pesquisar</button>
              <button type="button" class="cilia-btn secondary" onclick="window.CiliaPesquisa.salvarCredenciais()">Salvar</button>
              <button type="button" class="cilia-btn danger" onclick="window.CiliaPesquisa.limparCredenciais()">Limpar</button>
            </div>
          </div>
          <div id="ciliaStatusApi" class="cilia-status"></div>
          <div id="ciliaResultadosApi"></div>
        </div>
      </div>`;
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) fechar();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function abrir() {
    if (window.exigirModulo && !window.exigirModulo('cilia')) return;
    carregarCredenciais();
    const overlay = ensureModal();
    overlay.classList.add('open');
    if ($('ciliaTokenApi')) $('ciliaTokenApi').value = state.token || '';
    if ($('ciliaUsuarioApi')) $('ciliaUsuarioApi').value = state.usuario || '';
    if ($('ciliaSenhaApi')) $('ciliaSenhaApi').value = state.senha || '';
    if ($('ciliaPlacaApi') && state.placa) $('ciliaPlacaApi').value = state.placa;
    renderAll();
    setTimeout(() => { if ($('ciliaPlacaApi')) $('ciliaPlacaApi').focus(); }, 80);
  }

  function fechar() {
    const overlay = $(MODAL_ID);
    if (overlay) overlay.classList.remove('open');
  }

  function instalarBotaoBackup() {
    // Segurança: se o botão fixo do HTML não existir por cache ou versão antiga,
    // injeta um botão visível ao lado do importador de Cília sem remover nada.
    if ($('btnPesquisarCiliaApi')) return;
    const file = $('ciliaFileInput');
    const parent = file && file.parentElement;
    if (!parent) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnPesquisarCiliaApi';
    btn.textContent = '🔎 PESQUISAR NO CÍLIA';
    btn.title = 'Pesquisar peças direto no Cília por placa, área, região e peça usando token oficial da oficina';
    btn.style.cssText = 'background:rgba(124,58,237,0.14);border:1px solid rgba(167,139,250,0.55);color:#C4B5FD;padding:6px 14px;border-radius:3px;font-family:var(--fm);font-size:0.72rem;font-weight:800;cursor:pointer;letter-spacing:.5px;';
    btn.onclick = abrir;
    btn.dataset.modulo = 'cilia';
    const addBtn = parent.querySelector('.btn-success');
    parent.insertBefore(btn, addBtn || null);
  }

  window.CiliaPesquisa = {
    abrir,
    fechar,
    salvarCredenciais,
    limparCredenciais,
    buscarVeiculos,
    selecionarVeiculo,
    selecionarArea,
    selecionarRegiao,
    selecionarGrupo,
    adicionarPecaOS,
    _state: state,
    _ciliaGet: ciliaGet
  };

  document.addEventListener('DOMContentLoaded', function () {
    carregarCredenciais();
    instalarBotaoBackup();
  });

  // Caso o script carregue depois do DOMContentLoaded.
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(function () {
      carregarCredenciais();
      instalarBotaoBackup();
    }, 80);
  }
})();
