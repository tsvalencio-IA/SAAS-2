(function () {
  'use strict';

  const W = window;
  const D = document;
  const state = { osId: '', itemKey: '', itemKeys: [], os: null, item: null, items: [], fornecedores: [], mensagens: [] };

  function $(id) { return D.getElementById(id); }
  function J() { return W.J || {}; }
  function db() { return W.db || J().db || null; }
  function centralDb() {
    try {
      return typeof W.initCentralFirebase === 'function' ? W.initCentralFirebase() : null;
    } catch (_) {
      return null;
    }
  }
  function dbProject(database) {
    try { return database?.app?.options?.projectId || ''; } catch (_) { return ''; }
  }
  function sameDatabase(a, b) {
    const pa = dbProject(a);
    const pb = dbProject(b);
    return !!pa && !!pb && pa === pb;
  }
  function publicFirebaseConfig() {
    try {
      const cfg = typeof W.getActiveFirebaseConfig === 'function'
        ? W.getActiveFirebaseConfig()
        : (W.JARVIS_FB_CONFIG || null);
      if (cfg && cfg.apiKey && cfg.projectId) {
        return {
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain || '',
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket || '',
          messagingSenderId: cfg.messagingSenderId || '',
          appId: cfg.appId || ''
        };
      }
    } catch (_) {}
    return null;
  }
  function encodeFirebaseConfigParam(cfg) {
    if (!cfg || !cfg.apiKey || !cfg.projectId) return '';
    try {
      const json = JSON.stringify(cfg);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch (_) {
      return '';
    }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escAttr(v) { return esc(v).replace(/`/g, '&#96;'); }
  function onlyDigits(v) { return String(v || '').replace(/\D+/g, ''); }
  function norm(v) {
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function moeda(v) {
    return 'R$ ' + num(v).toFixed(2).replace('.', ',');
  }
  function nowISO() { return new Date().toISOString(); }
  function localDateAdd(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 3));
    return d.toISOString().slice(0, 10);
  }
  function randomToken() {
    try {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return 'cot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
    }
  }
  function safeKey(v) {
    const raw = String(v == null ? '' : v).trim() || ('k_' + Date.now());
    return raw.replace(/[.#$\[\]\/]/g, '_');
  }
  function phoneBR(v) {
    let d = onlyDigits(v);
    if (!d) return '';
    if (d.length <= 11 && !d.startsWith('55')) d = '55' + d;
    return d;
  }
  function cotMap(os) {
    const raw = os && os.cotacoesPecas;
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        if (item && item.key) acc[item.key] = item;
        return acc;
      }, {});
    }
    return raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
  }
  function osUtils() {
    try { return typeof W.OSUtils === 'function' ? W.OSUtils() : (W.OSUtils || {}); } catch (_) { return {}; }
  }
  function budgetItems(os) {
    const U = osUtils();
    const cliente = (J().clientes || []).find(c => c.id === os?.clienteId);
    try { return U.buildBudgetItems ? (U.buildBudgetItems(os, cliente) || []) : []; } catch (_) { return []; }
  }
  function itemFromCotacaoCard(key) {
    const k = String(key || '');
    if (!k) return null;
    const cards = Array.from(D.querySelectorAll('.cotacao-peca-box[data-item-key]'));
    const card = cards.find(box => String(box.getAttribute('data-item-key')) === k);
    if (!card) return null;
    try {
      const raw = card.querySelector('.cot-item-json')?.value || '';
      const item = raw ? JSON.parse(raw) : null;
      if (item && (item.key || item.desc || item.descricao || item.codigo)) {
        if (!item.key) item.key = k;
        return item;
      }
    } catch (_) {}
    const titulo = card.querySelector('[data-cot-item-title]')?.textContent || '';
    if (titulo.trim()) return { key: k, desc: titulo.trim(), tipo: 'peca' };
    return null;
  }
  function getItem(os, key) {
    const saved = cotMap(os)[key]?.item;
    if (saved && (saved.desc || saved.descricao || saved.codigo)) return saved;
    const domItem = itemFromCotacaoCard(key);
    if (domItem && (domItem.desc || domItem.descricao || domItem.codigo)) return domItem;
    return budgetItems(os).find(i => String(i.key) === String(key)) || { key };
  }
  function getItems(os, keys) {
    const out = [];
    const vistos = new Set();
    (keys || []).forEach(key => {
      const k = String(key || '').trim();
      if (!k || vistos.has(k)) return;
      vistos.add(k);
      const item = getItem(os, k);
      if (!item.key) item.key = k;
      out.push(item);
    });
    return out;
  }
  function itemTitulo(item) {
    return (item?.codigo ? '[' + item.codigo + '] ' : '') + (item?.desc || item?.descricao || 'Peça');
  }
  function itensTitulo(items) {
    const lista = Array.isArray(items) && items.length ? items : (state.item ? [state.item] : []);
    if (lista.length === 1) return itemTitulo(lista[0]);
    return lista.length + ' peças selecionadas';
  }
  function veiculoOS(os) {
    const snap = os?.veiculoSnapshot || {};
    const v = (J().veiculos || []).find(x => x.id === os?.veiculoId) || {};
    const placa = String(os?.placa || snap.placa || v.placa || '').toUpperCase();
    const prefixo = os?.prefixo || os?.prefixoVeiculo || snap.prefixo || snap.prefixoVeiculo || v.prefixo || v.frota || '';
    const marca = snap.marca || v.marca || os?.marca || '';
    const modelo = snap.modelo || v.modelo || os?.modelo || os?.veiculo || '';
    const ano = snap.ano || v.ano || os?.ano || '';
    const chassi = snap.chassi || snap.chassis || v.chassi || v.chassis || os?.chassi || os?.chassis || '';
    const cor = snap.cor || v.cor || os?.cor || '';
    const km = os?.km || snap.km || v.km || '';
    const tipo = os?.tipoVeiculoOS || os?.tipoVeiculo || snap.tipoVeiculo || snap.tipo || v.tipoVeiculo || v.tipo || '';
    const cambio = snap.cambio || snap.transmissao || v.cambio || v.transmissao || os?.cambio || os?.transmissao || '';
    const valvulas = snap.valvulas || snap.motorValvulas || snap.qtdValvulas || v.valvulas || v.motorValvulas || v.qtdValvulas || os?.valvulas || os?.motorValvulas || os?.qtdValvulas || '';
    const complementoTecnico = snap.complementoTecnico || snap.dadosTecnicos || v.complementoTecnico || v.dadosTecnicos || os?.complementoTecnicoVeiculo || os?.dadosTecnicosVeiculo || '';
    return {
      placa,
      prefixo,
      marca,
      modelo,
      ano,
      chassi,
      chassis: chassi,
      cor,
      km,
      tipo,
      cambio,
      transmissao: cambio,
      valvulas,
      motorValvulas: valvulas,
      complementoTecnico,
      combustivel: snap.combustivel || v.combustivel || os?.combustivel || '',
      motor: snap.motor || v.motor || os?.motor || '',
      renavam: snap.renavam || v.renavam || os?.renavam || '',
      frota: snap.frota || v.frota || prefixo || '',
      nome: [marca, modelo].filter(Boolean).join(' ') || os?.veiculo || 'Veiculo'
    };
  }
  function labelCambioCotacao(v) {
    const raw = String(v || '').trim();
    const n = norm(raw);
    if (!raw) return '';
    if (n.includes('nao sei') || n.includes('nao_informado') || n.includes('whatsapp')) return 'Não sei / vou complementar no WhatsApp';
    if (n.includes('automatic')) return 'Automático';
    if (n.includes('manual')) return 'Manual';
    if (n.includes('cvt')) return 'CVT';
    if (n.includes('automatizado')) return 'Automatizado';
    return raw;
  }
  function labelValvulasCotacao(v) {
    const raw = String(v || '').trim();
    const n = norm(raw);
    if (!raw) return '';
    if (n.includes('nao sei') || n.includes('nao_informado') || n.includes('whatsapp')) return 'Não sei / vou complementar no WhatsApp';
    if (/^8v$|8\s*v|8\s*val/.test(n)) return '8 válvulas';
    if (/^16v$|16\s*v|16\s*val/.test(n)) return '16 válvulas';
    return raw;
  }
  function normalizarCambioCotacao(v) {
    const n = norm(v || '');
    if (!n) return '';
    if (n.includes('automatic')) return 'automatico';
    if (n.includes('manual')) return 'manual';
    if (n.includes('cvt')) return 'cvt';
    if (n.includes('automatizado')) return 'automatizado';
    if (n.includes('nao sei') || n.includes('whatsapp')) return 'nao_informado';
    return 'outro';
  }
  function normalizarValvulasCotacao(v) {
    const n = norm(v || '');
    if (!n) return '';
    if (/^8v$|8\s*v|8\s*val/.test(n)) return '8v';
    if (/^16v$|16\s*v|16\s*val/.test(n)) return '16v';
    if (n.includes('nao sei') || n.includes('whatsapp')) return 'nao_informado';
    return 'outro';
  }
  function preencherCamposTecnicosVeiculo(v) {
    if ($('cotRfqModeloVeiculo')) $('cotRfqModeloVeiculo').value = v.modelo || v.nome || '';
    if ($('cotRfqAnoVeiculo')) $('cotRfqAnoVeiculo').value = v.ano || '';
    if ($('cotRfqCambio')) $('cotRfqCambio').value = normalizarCambioCotacao(v.cambio || v.transmissao);
    if ($('cotRfqValvulas')) $('cotRfqValvulas').value = normalizarValvulasCotacao(v.valvulas || v.motorValvulas);
    if ($('cotRfqComplementoVeiculo')) $('cotRfqComplementoVeiculo').value = v.complementoTecnico || '';
    if ($('cotRfqInfoManual')) $('cotRfqInfoManual').checked = false;
  }
  function veiculoCotacaoDetalhado(base) {
    const modelo = $('cotRfqModeloVeiculo')?.value?.trim() || base.modelo || base.nome || '';
    const ano = $('cotRfqAnoVeiculo')?.value?.trim() || base.ano || '';
    const cambioSelect = $('cotRfqCambio')?.value || '';
    const valvulasSelect = $('cotRfqValvulas')?.value || '';
    const complemento = $('cotRfqComplementoVeiculo')?.value?.trim() || base.complementoTecnico || '';
    const infoManual = !!$('cotRfqInfoManual')?.checked || cambioSelect === 'nao_informado' || valvulasSelect === 'nao_informado';
    const cambio = cambioSelect === 'outro' ? (base.cambio || base.transmissao || '') : (cambioSelect || base.cambio || base.transmissao || '');
    const valvulas = valvulasSelect === 'outro' ? (base.valvulas || base.motorValvulas || '') : (valvulasSelect || base.valvulas || base.motorValvulas || '');
    return Object.assign({}, base, {
      modelo,
      ano,
      nome: [base.marca, modelo].filter(Boolean).join(' ') || modelo || base.nome || 'Veiculo',
      cambio,
      transmissao: cambio,
      cambioLabel: labelCambioCotacao(cambio),
      valvulas,
      motorValvulas: valvulas,
      valvulasLabel: labelValvulasCotacao(valvulas),
      complementoTecnico: complemento,
      infoManualPendente: infoManual
    });
  }
  function textoTecnicoVeiculoCotacao(v) {
    return [
      'Modelo: ' + (v.modelo || v.nome || 'não informado'),
      'Ano: ' + (v.ano || 'não informado'),
      'Câmbio: ' + (v.cambioLabel || labelCambioCotacao(v.cambio || v.transmissao) || 'não informado'),
      'Motor/válvulas: ' + (v.valvulasLabel || labelValvulasCotacao(v.valvulas || v.motorValvulas) || 'não informado'),
      v.chassi ? 'Chassi: ' + v.chassi : '',
      v.complementoTecnico ? 'Complemento técnico: ' + v.complementoTecnico : '',
      v.infoManualPendente ? 'Observação: dados técnicos pendentes; a oficina pode complementar manualmente pelo WhatsApp.' : ''
    ].filter(Boolean).join('\n');
  }
  function fornecedorContato(f) {
    const wpp = f.wpp || f.whatsapp || f.telefone || f.celular || f.phone || '';
    const email = f.email || f.mail || '';
    return { wpp, email, phone: phoneBR(wpp) };
  }
  function fornecedorTexto(f) {
    return [
      f.nome, f.razao, f.nomeFantasia, f.segmento, f.categorias, f.categoria,
      f.tags, f.marcas, f.obs, f.observacoes, f.cidade, f.uf
    ].filter(Boolean).join(' ');
  }
  function scoreFornecedor(f, item) {
    const texto = norm(fornecedorTexto(f));
    const desc = norm([item?.desc, item?.descricao, item?.codigo, item?.labelTipo].filter(Boolean).join(' '));
    if (!texto || !desc) return 0;
    let score = 0;
    const termos = desc.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
    termos.forEach(t => { if (texto.includes(t)) score += 2; });
    [
      'bateria', 'oleo', 'filtro', 'freio', 'pastilha', 'disco', 'suspensao',
      'amortecedor', 'eletrica', 'motor', 'pneu', 'lataria', 'funilaria',
      'arrefecimento', 'radiador', 'injeção', 'injecao'
    ].forEach(t => { if (desc.includes(norm(t)) && texto.includes(norm(t))) score += 5; });
    if (f.preferencial || f.preferido || f.prioridade) score += 3;
    return score;
  }
  function fornecedoresOrdenados(itemOuItens) {
    const itens = Array.isArray(itemOuItens) ? itemOuItens : [itemOuItens];
    return (J().fornecedores || [])
      .map(f => {
        const score = itens.reduce((acc, item) => acc + scoreFornecedor(f, item), 0);
        return Object.assign({}, f, { _scoreCotacao: score });
      })
      .sort((a, b) => (b._scoreCotacao || 0) - (a._scoreCotacao || 0) || String(a.nome || '').localeCompare(String(b.nome || '')));
  }
  function publicBaseOk() {
    const cfg = W.THIA_PUBLIC_LINKS || {};
    if (cfg.cotacaoFornecedor || cfg.baseUrl) return true;
    try { return /^https?:$/i.test(W.location?.protocol || ''); } catch (_) { return false; }
  }
  function publicUrl(token) {
    const tenantRef = J().oficina?.slug || J().oficina?.publicSlug || J().oficina?.oficinaSlug || J().tid || '';
    const params = { t: tenantRef, token };
    const cfgParam = encodeFirebaseConfigParam(publicFirebaseConfig());
    if ((W.THIA_PUBLIC_LINKS || {}).incluirFirebaseConfigNoLink === true && cfgParam) params.fcfg = cfgParam;
    if (typeof W.thiaGetPublicUrl === 'function') {
      return W.thiaGetPublicUrl('cotacaoFornecedor', params);
    }
    return 'cotacao.html?' + new URLSearchParams(params).toString();
  }
  function osRefLabel(os) {
    return 'OS #' + String(os?.numero || os?.id || '').slice(-6).toUpperCase();
  }

  function ensureModal() {
    if ($('modalCotacaoFornecedores')) return;
    const style = D.createElement('style');
    style.textContent = `
      .cot-rfq-modal{max-width:1120px;width:96vw}
      .cot-rfq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      .cot-forn-card{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;border:1px solid var(--border);background:rgba(255,255,255,.035);border-radius:4px;padding:9px;cursor:pointer}
      .cot-forn-card.is-suggested{border-color:rgba(0,255,136,.35)}
      .cot-forn-card.is-selected{background:rgba(0,255,136,.08);border-color:rgba(0,255,136,.55)}
      .cot-msg-card{border:1px solid var(--border);border-radius:4px;background:rgba(0,0,0,.14);padding:10px;margin-top:8px}
      .cot-msg-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
      @media(max-width:720px){.cot-rfq-modal{width:100vw;max-height:96vh}.cot-rfq-grid{grid-template-columns:1fr}.cot-msg-actions button{flex:1 1 140px}}
    `;
    D.head.appendChild(style);
    D.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="modalCotacaoFornecedores">
        <div class="modal cot-rfq-modal">
          <div class="modal-head">
            <div class="modal-title">COTAÇÃO MANUAL DE PEÇAS</div>
            <button class="modal-close" onclick="window.fecharCotacaoFornecedoresOS()">x</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="cotRfqOsId">
            <input type="hidden" id="cotRfqItemKey">
            <div id="cotRfqResumo" style="border:1px solid var(--border);background:var(--surf3);border-radius:4px;padding:12px;margin-bottom:12px;"></div>
            <div class="form-row cols-3">
              <div class="form-group"><label class="j-label">Buscar fornecedor</label><input class="j-input" id="cotRfqBusca" placeholder="nome, segmento, marca, cidade..." oninput="window.filtrarFornecedoresCotacao()"></div>
              <div class="form-group"><label class="j-label">Validade da cotação</label><input type="date" class="j-input" id="cotRfqExpira"></div>
              <div class="form-group"><label class="j-label">Prioridade</label><select class="j-select" id="cotRfqPrioridade"><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
            </div>
            <div style="border:1px solid var(--border);background:var(--surf2);border-radius:4px;padding:10px;margin:4px 0 12px;">
              <div style="font-family:var(--fm);font-size:.62rem;color:var(--success);font-weight:800;letter-spacing:1px;margin-bottom:8px;">DADOS TÉCNICOS ENVIADOS AO FORNECEDOR</div>
              <div class="form-row cols-3">
                <div class="form-group"><label class="j-label">Modelo do veículo</label><input class="j-input" id="cotRfqModeloVeiculo" placeholder="Ex: Civic, Palio, Titan 160"></div>
                <div class="form-group"><label class="j-label">Ano</label><input class="j-input" id="cotRfqAnoVeiculo" placeholder="Ex: 2018/2019"></div>
                <div class="form-group"><label class="j-label">Câmbio</label><select class="j-select" id="cotRfqCambio">
                  <option value="">Não informado</option>
                  <option value="automatico">Automático</option>
                  <option value="manual">Manual</option>
                  <option value="cvt">CVT</option>
                  <option value="automatizado">Automatizado</option>
                  <option value="outro">Outro / detalhar no complemento</option>
                  <option value="nao_informado">Não sei / vou complementar no WhatsApp</option>
                </select></div>
              </div>
              <div class="form-row cols-3">
                <div class="form-group"><label class="j-label">Motor / válvulas</label><select class="j-select" id="cotRfqValvulas">
                  <option value="">Não informado</option>
                  <option value="8v">8 válvulas</option>
                  <option value="16v">16 válvulas</option>
                  <option value="outro">Outro / detalhar no complemento</option>
                  <option value="nao_informado">Não sei / vou complementar no WhatsApp</option>
                </select></div>
                <div class="form-group" style="grid-column:span 2;"><label class="j-label">Complemento técnico</label><input class="j-input" id="cotRfqComplementoVeiculo" placeholder="Ex: motor 1.0 flex, 2 portas, ABS, ar condicionado, versão..."></div>
              </div>
              <label style="display:flex;align-items:center;gap:7px;font-family:var(--fm);font-size:.62rem;color:var(--muted);margin-top:2px;">
                <input type="checkbox" id="cotRfqInfoManual" style="width:auto;min-height:0;"> não sei confirmar todos os dados; vou complementar manualmente no WhatsApp depois
              </label>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              <button type="button" class="btn-outline" onclick="window.selecionarFornecedoresCotacao('sugeridos')">Selecionar sugeridos</button>
              <button type="button" class="btn-outline" onclick="window.selecionarFornecedoresCotacao('todos')">Selecionar todos visíveis</button>
              <button type="button" class="btn-ghost" onclick="window.selecionarFornecedoresCotacao('limpar')">Limpar seleção</button>
            </div>
            <div id="cotRfqFornecedores" class="cot-rfq-grid"></div>
            <div class="form-group" style="margin-top:12px;">
              <label class="j-label">Observação para os fornecedores</label>
              <textarea class="j-textarea" id="cotRfqObs" rows="3" placeholder="Ex: confirmar marca, modelo, prazo real, frete e disponibilidade para retirada/entrega."></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">
              <button type="button" class="btn-primary" onclick="window.gerarEnvioCotacaoOS()">GERAR FORMULÁRIOS E MENSAGENS</button>
              <button type="button" class="btn-outline" onclick="window.exportarCotacaoFornecedoresOS()">EXPORTAR ANÁLISE COM RESPOSTAS</button>
              <small id="cotRfqAvisoBase" style="font-family:var(--fm);font-size:.62rem;color:var(--muted);"></small>
            </div>
            <div id="cotRfqMensagens" style="margin-top:12px;"></div>
          </div>
          <div class="modal-foot">
            <button class="btn-ghost" onclick="window.fecharCotacaoFornecedoresOS()">FECHAR</button>
          </div>
        </div>
      </div>
    `);
  }

  function renderResumo() {
    const os = state.os || {};
    const items = state.items && state.items.length ? state.items : (state.item ? [state.item] : []);
    const vBase = veiculoOS(os);
    preencherCamposTecnicosVeiculo(vBase);
    const v = veiculoCotacaoDetalhado(vBase);
    const cliente = (J().clientes || []).find(c => c.id === os.clienteId) || {};
    const listaItens = items.map((item, idx) => `
      <div style="display:grid;grid-template-columns:34px minmax(180px,1fr) 70px;gap:8px;align-items:center;border-top:1px dashed var(--border);padding:7px 0;">
        <small style="font-family:var(--fm);color:var(--muted);">${idx + 1}</small>
        <strong style="color:var(--text);font-size:.78rem;">${esc(itemTitulo(item))}</strong>
        <small style="font-family:var(--fm);color:var(--cyan);text-align:right;">Qtd ${esc(item.qtd || 1)}</small>
      </div>`).join('');
    $('cotRfqResumo').innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-family:var(--fm);font-size:.62rem;color:var(--success);font-weight:800;letter-spacing:1px;">${items.length > 1 ? 'PEÇAS DA O.S. PARA COTAÇÃO' : 'PEÇA DA O.S. PARA COTAÇÃO'}</div>
          <div style="font-size:.88rem;color:var(--text);font-weight:800;">${esc(itensTitulo(items))}</div>
          <small style="font-family:var(--fm);font-size:.62rem;color:var(--muted);">cotação aberta na ${esc(osRefLabel(os))}</small>
        </div>
        <div style="font-family:var(--fm);font-size:.66rem;color:var(--cyan);text-align:right;">
          ${v.prefixo ? 'Prefixo ' + esc(v.prefixo) + '<br>' : ''}${v.placa ? 'Placa ' + esc(v.placa) + '<br>' : ''}${esc(v.nome)}${v.ano ? '<br>Ano: ' + esc(v.ano) : ''}${v.cambioLabel ? '<br>Câmbio: ' + esc(v.cambioLabel) : ''}${v.valvulasLabel ? '<br>Motor/válvulas: ' + esc(v.valvulasLabel) : ''}${v.chassi ? '<br>Chassi: ' + esc(v.chassi) : ''}${cliente.nome ? '<br>Cliente: ' + esc(cliente.nome) : ''}
        </div>
      </div>
      <div style="margin-top:8px;">${listaItens}</div>`;
  }

  function renderFornecedores() {
    const box = $('cotRfqFornecedores');
    if (!box) return;
    const q = norm($('cotRfqBusca')?.value || '');
    const lista = state.fornecedores.filter(f => {
      if (!q) return true;
      return norm(fornecedorTexto(f)).includes(q) || norm(fornecedorContato(f).wpp).includes(q);
    });
    const haSugeridos = state.fornecedores.some(f => (f._scoreCotacao || 0) > 0);
    box.innerHTML = lista.map((f, idx) => {
      const contato = fornecedorContato(f);
      const sugerido = (f._scoreCotacao || 0) > 0;
      const checked = sugerido || (!haSugeridos && idx < 3);
      const contatoTxt = [contato.wpp ? 'WPP ' + contato.wpp : '', contato.email].filter(Boolean).join(' | ') || 'sem contato cadastrado';
      return `<label class="cot-forn-card ${sugerido ? 'is-suggested' : ''} ${checked ? 'is-selected' : ''}" data-search="${escAttr(norm(fornecedorTexto(f)))}">
        <input type="checkbox" class="cot-forn-check" value="${escAttr(f.id)}" ${checked ? 'checked' : ''} onchange="this.closest('.cot-forn-card').classList.toggle('is-selected',this.checked)">
        <span>
          <strong style="display:block;color:var(--text);font-size:.78rem;">${esc(f.nome || f.razao || f.nomeFantasia || 'Fornecedor')}</strong>
          <small style="display:block;color:${sugerido ? 'var(--success)' : 'var(--muted)'};font-family:var(--fm);font-size:.60rem;">${sugerido ? 'SUGERIDO PELO SISTEMA' : 'FORNECEDOR CADASTRADO'}</small>
          <small style="display:block;color:var(--muted);font-size:.66rem;">${esc(f.segmento || f.categoria || f.categorias || '-')}</small>
          <small style="display:block;color:var(--muted2);font-family:var(--fm);font-size:.60rem;">${esc(contatoTxt)}</small>
        </span>
      </label>`;
    }).join('') || '<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:4px;">Nenhum fornecedor encontrado. Cadastre fornecedores com WhatsApp/e-mail, segmento, categorias ou marcas.</div>';
  }

  function abrirCotacaoFornecedoresComItens(osId, itemKeys) {
    ensureModal();
    const os = (J().os || []).find(o => String(o.id) === String(osId));
    if (!os) { W.toast?.('Salve ou reabra a O.S. antes de enviar cotacao.', 'warn'); return; }
    const keys = (Array.isArray(itemKeys) ? itemKeys : [itemKeys]).map(k => String(k || '').trim()).filter(Boolean);
    const items = getItems(os, keys);
    if (!items.length) { W.toast?.('Selecione pelo menos uma peca da O.S. para cotacao.', 'warn'); return; }
    state.osId = osId;
    state.itemKey = keys[0] || '';
    state.itemKeys = keys;
    state.os = os;
    state.item = items[0] || null;
    state.items = items;
    state.fornecedores = fornecedoresOrdenados(items);
    state.mensagens = [];
    $('cotRfqOsId').value = osId || '';
    $('cotRfqItemKey').value = keys.join(',');
    $('cotRfqExpira').value = localDateAdd(3);
    $('cotRfqBusca').value = '';
    $('cotRfqObs').value = 'Favor informar valor unitário, marca, modelo/código da peça, disponibilidade, prazo, frete e condição de pagamento.';
    $('cotRfqMensagens').innerHTML = '';
    $('cotRfqAvisoBase').textContent = publicBaseOk()
      ? 'Link publico pronto para envio.'
      : 'Atenção: preencha baseUrl/cotacaoFornecedor em js/links-publicos.js antes de enviar para fornecedor externo.';
    renderResumo();
    renderFornecedores();
    if (typeof W.abrirModal === 'function') W.abrirModal('modalCotacaoFornecedores');
    else $('modalCotacaoFornecedores').style.display = 'flex';
  }

  W.abrirCotacaoFornecedoresOS = function (osId, itemKey) {
    if (typeof W.thiaModEnabled === 'function' && !W.thiaModEnabled('cotacao')) {
      W.toast?.('Modulo de cotacao bloqueado para esta oficina pelo Superadmin.', 'warn');
      return;
    }
    abrirCotacaoFornecedoresComItens(osId, [itemKey]);
  };

  W.toggleTodasPecasCotacao = function (checked) {
    const root = $('cotacaoPecasOS') || D;
    root.querySelectorAll('.cotacao-peca-box .cot-lote-check').forEach(cb => {
      cb.checked = !!checked;
      const label = cb.closest('label');
      if (label) label.style.color = checked ? 'var(--success)' : 'var(--muted)';
    });
    root.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (String(cb.getAttribute('onchange') || '').includes('toggleTodasPecasCotacao')) cb.checked = !!checked;
    });
    W.toast?.(checked ? 'Todas as pecas da O.S. foram marcadas para cotacao.' : 'Selecao de pecas limpa.', checked ? 'ok' : 'warn');
  };

  W.abrirCotacaoFornecedoresOSLote = function (osId, modo) {
    if (typeof W.thiaModEnabled === 'function' && !W.thiaModEnabled('cotacao')) {
      W.toast?.('Modulo de cotacao bloqueado para esta oficina pelo Superadmin.', 'warn');
      return;
    }
    const root = $('cotacaoPecasOS') || D;
    const boxes = Array.from(root.querySelectorAll('.cotacao-peca-box[data-item-key]'));
    let keys = [];
    if (modo === 'todos') {
      keys = boxes.map(box => box.getAttribute('data-item-key')).filter(Boolean);
    } else {
      keys = boxes
        .filter(box => box.querySelector('.cot-lote-check')?.checked)
        .map(box => box.getAttribute('data-item-key'))
        .filter(Boolean);
    }
    if (!keys.length) { W.toast?.('Marque uma ou mais pecas da O.S. para cotar.', 'warn'); return; }
    abrirCotacaoFornecedoresComItens(osId, keys);
  };

  W.fecharCotacaoFornecedoresOS = function () {
    if (typeof W.fecharModal === 'function') W.fecharModal('modalCotacaoFornecedores');
    else if ($('modalCotacaoFornecedores')) $('modalCotacaoFornecedores').style.display = 'none';
  };

  W.filtrarFornecedoresCotacao = renderFornecedores;

  W.selecionarFornecedoresCotacao = function (modo) {
    D.querySelectorAll('#cotRfqFornecedores .cot-forn-card').forEach(card => {
      const cb = card.querySelector('.cot-forn-check');
      if (!cb) return;
      let checked = cb.checked;
      if (modo === 'limpar') checked = false;
      else if (modo === 'todos') checked = true;
      else if (modo === 'sugeridos') checked = card.classList.contains('is-suggested');
      cb.checked = checked;
      card.classList.toggle('is-selected', checked);
    });
  };

  function selecionados() {
    const ids = Array.from(D.querySelectorAll('#cotRfqFornecedores .cot-forn-check:checked')).map(cb => cb.value);
    return state.fornecedores.filter(f => ids.includes(String(f.id)));
  }

  function montarMensagem(f, link) {
    const os = state.os || {};
    const item = state.item || {};
    const v = veiculoCotacaoDetalhado(veiculoOS(os));
    const prioridade = $('cotRfqPrioridade')?.value || 'normal';
    const obs = $('cotRfqObs')?.value?.trim() || '';
    const lines = [
      'Olá, ' + (f.nome || f.razao || 'fornecedor') + '.',
      '',
      'Solicito cotacao para peca de O.S.:',
      'Peça: ' + (item.codigo ? '[' + item.codigo + '] ' : '') + (item.desc || item.descricao || '-'),
      'Qtd: ' + (item.qtd || 1),
      'Veículo: ' + [v.prefixo ? 'prefixo ' + v.prefixo : '', v.placa ? 'placa ' + v.placa : '', v.nome].filter(Boolean).join(' / '),
      osRefLabel(os),
      'Prioridade: ' + prioridade,
      '',
      obs,
      '',
      'Responda pelo link:',
      link,
      '',
      'Informe valor unitário, marca, disponibilidade, prazo, frete e condição.'
    ];
    return lines.filter(line => line !== null && line !== undefined).join('\n');
  }

  function montarMensagem(f, link) {
    const os = state.os || {};
    const items = state.items && state.items.length ? state.items : (state.item ? [state.item] : []);
    const v = veiculoCotacaoDetalhado(veiculoOS(os));
    const prioridade = $('cotRfqPrioridade')?.value || 'normal';
    const obs = $('cotRfqObs')?.value?.trim() || '';
    const lines = [
      'Olá, ' + (f.nome || f.razao || 'fornecedor') + '.',
      '',
      'Solicito cotação para ' + (items.length > 1 ? 'peças da O.S.' : 'peça da O.S.') + ':',
      ...items.map((item, idx) => (idx + 1) + '. ' + itemTitulo(item) + ' | Qtd: ' + (item.qtd || 1)),
      '',
      'Dados do veículo:',
      (v.prefixo ? 'Prefixo: ' + v.prefixo : ''),
      (v.placa ? 'Placa: ' + v.placa : ''),
      textoTecnicoVeiculoCotacao(v),
      (v.cor ? 'Cor: ' + v.cor : ''),
      (v.km ? 'KM: ' + v.km : ''),
      osRefLabel(os),
      'Prioridade: ' + prioridade,
      '',
      obs,
      '',
      'Responda pelo link:',
      link,
      '',
      'Informe valor unitário, marca, modelo/código da peça ofertada, disponibilidade, prazo, frete e condição de cada item.'
    ];
    return lines.filter(line => line !== null && line !== undefined).join('\n');
  }

  async function salvarSolicitacao(lista) {
    const database = db();
    const os = state.os || {};
    const item = state.item || {};
    const items = state.items && state.items.length ? state.items : [item];
    const itemKeys = state.itemKeys && state.itemKeys.length ? state.itemKeys : [state.itemKey];
    if (!database || !J().tid || !os.id) throw new Error('Banco/tenant/O.S. indisponivel.');

    const cotRef = database.collection('cotacoes_pecas').doc();
    const cotacaoId = cotRef.id;
    const expiraEm = $('cotRfqExpira')?.value || localDateAdd(3);
    const expiraDate = new Date(expiraEm + 'T23:59:59');
    const v = veiculoOS(os);
    const criadoEm = nowISO();
    const fornecedores = lista.map(f => {
      const contato = fornecedorContato(f);
      const token = randomToken();
      const link = publicUrl(token);
      return {
        id: f.id || '',
        nome: f.nome || f.razao || f.nomeFantasia || 'Fornecedor',
        wpp: contato.wpp || '',
        email: contato.email || '',
        token,
        link,
        status: 'pendente'
      };
    });
    const itensPayload = items.map((it, idx) => ({
      key: it.key || itemKeys[idx] || state.itemKey,
      codigo: it.codigo || '',
      desc: it.desc || it.descricao || '',
      qtd: num(it.qtd || 1),
      tipo: it.tipo || 'peca',
      valorAprovado: num(it.valorFinal || it.valorUnit || 0),
      valorOrcado: num(it.valorFinal || it.valorUnit || 0)
    }));

    const cotPayload = {
      tenantId: J().tid,
      osId: os.id,
      itemKey: state.itemKey,
      itemKeys,
      status: 'enviada',
      origem: 'os_orcamento',
      prioridade: $('cotRfqPrioridade')?.value || 'normal',
      observacao: $('cotRfqObs')?.value?.trim() || '',
      expiraEm,
      expiraEmTs: expiraDate,
      item: itensPayload[0] || {},
      itens: itensPayload,
      veiculo: v,
      fornecedores,
      createdAt: criadoEm,
      createdBy: J().nome || 'Jarvis'
    };
    const firebaseConfigPublica = publicFirebaseConfig();

    const batch = database.batch();
    batch.set(cotRef, cotPayload);
    fornecedores.forEach(f => {
      const pubRef = database.collection('cotacoes_publicas').doc(f.token);
      batch.set(pubRef, {
        tenantId: J().tid,
        cotacaoId,
        osId: os.id,
        itemKey: state.itemKey,
        itemKeys,
        token: f.token,
        fornecedorId: f.id || '',
        fornecedorNome: f.nome,
        oficinaNome: J().oficina?.nome || J().oficina?.razao || J().nomeOficina || 'Oficina',
        status: 'aberta',
        prioridade: cotPayload.prioridade,
        observacao: cotPayload.observacao,
        expiraEm,
        expiraEmTs: expiraDate,
        item: cotPayload.item,
        itens: cotPayload.itens,
        veiculo: v,
        firebaseConfig: firebaseConfigPublica,
        createdAt: criadoEm
      });
    });

    const map = Object.assign({}, cotMap(os));
    const coletadas = W.coletarCotacoesPecasOS ? (W.coletarCotacoesPecasOS() || {}) : {};
    itensPayload.forEach((itemPayload, idx) => {
      const key = itemPayload.key || itemKeys[idx] || state.itemKey;
      const anterior = map[key] || {};
      const coletadaAtual = coletadas[key] || {};
      const opcoesAtuais = Array.isArray(coletadaAtual.opcoes) && coletadaAtual.opcoes.length
        ? coletadaAtual.opcoes
        : (Array.isArray(anterior.opcoes) ? anterior.opcoes : []);
      const atual = Object.assign({ key, item: itemPayload, opcoes: [] }, anterior, coletadaAtual, { opcoes: opcoesAtuais });
      atual.item = atual.item || itemPayload;
      atual.solicitacoes = Array.isArray(atual.solicitacoes) ? atual.solicitacoes.slice() : [];
      atual.solicitacoes.push({
        id: cotacaoId,
        status: 'enviada',
        createdAt: criadoEm,
        expiraEm,
        fornecedorCount: fornecedores.length,
        fornecedores
      });
      atual.updatedAt = criadoEm;
      map[key] = atual;
    });

    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: criadoEm,
      user: J().nome || 'Jarvis',
      acao: 'Enviou cotacao de ' + itensPayload.length + ' peca(s) da O.S. para ' + fornecedores.length + ' fornecedor(es).',
      tipo: 'cotacao_pecas_envio',
      interno: true,
      cotacaoId
    });
    batch.update(database.collection('ordens_servico').doc(os.id), {
      cotacoesPecas: map,
      timeline,
      updatedAt: criadoEm
    });

    await batch.commit();
    const cdb = centralDb();
    if (cdb && !sameDatabase(cdb, database)) {
      const centralBatch = cdb.batch();
      fornecedores.forEach(f => {
        centralBatch.set(cdb.collection('cotacoes_publicas').doc(f.token), {
          tenantId: J().tid,
          cotacaoId,
          osId: os.id,
          itemKey: state.itemKey,
          itemKeys,
          token: f.token,
          fornecedorId: f.id || '',
          fornecedorNome: f.nome,
          oficinaNome: J().oficina?.nome || J().oficina?.razao || J().nomeOficina || 'Oficina',
          status: 'aberta',
          prioridade: cotPayload.prioridade,
          observacao: cotPayload.observacao,
          expiraEm,
          expiraEmTs: expiraDate,
          item: cotPayload.item,
          itens: cotPayload.itens,
          veiculo: v,
          firebaseConfig: firebaseConfigPublica,
          createdAt: criadoEm
        });
      });
      try {
        await centralBatch.commit();
      } catch (err) {
        throw new Error('Cotacao interna criada, mas o link publico nao foi publicado no Firebase central. Verifique regras/permissao em cotacoes_publicas: ' + (err.message || err));
      }
    }
    Object.assign(os, { cotacoesPecas: map, timeline, updatedAt: criadoEm });
    try {
      await database.collection('notificacoes_live').add({
        tenantId: J().tid,
        tipo: 'cotacao_enviada',
        titulo: 'Cotacao enviada',
        mensagem: 'Cotacao de ' + itensTitulo(items) + ' enviada para fornecedores.',
        perfilDestino: 'jarvis',
        entidade: 'ordens_servico',
        entidadeId: os.id,
        prioridade: cotPayload.prioridade,
        lida: false,
        createdAt: criadoEm
      });
    } catch (_) {}
    if (typeof W.thiaAudit === 'function') {
      W.thiaAudit('cotacao_pecas_enviada', 'ordens_servico', os.id, null, cotPayload, 'Envio de cotacao para fornecedores').catch(() => {});
    }
    return { cotacaoId, fornecedores };
  }

  function renderMensagens(payload) {
    const box = $('cotRfqMensagens');
    if (!box) return;
    state.mensagens = payload.fornecedores.map(f => ({
      fornecedor: f,
      mensagem: montarMensagem(f, f.link)
    }));
    box.innerHTML = `
      <div style="font-family:var(--fm);font-size:.66rem;color:var(--success);font-weight:800;letter-spacing:1px;margin:4px 0 8px;">MENSAGENS PRONTAS - CONFIRME O ENVIO</div>
      <div class="cot-msg-actions" style="margin-bottom:10px;">
        <button type="button" class="btn-success" onclick="window.abrirCanalCotacaoTodos('whatsapp')">Abrir WhatsApp dos selecionados</button>
        <button type="button" class="btn-outline" onclick="window.abrirCanalCotacaoTodos('email')">Abrir e-mails dos selecionados</button>
        <button type="button" class="btn-ghost" onclick="window.copiarTodasMensagensCotacao()">Copiar todas</button>
      </div>
      <small style="display:block;color:var(--muted);font-family:var(--fm);font-size:.60rem;margin-bottom:8px;">WhatsApp Web/wa.me exige confirmacao humana por contato e o navegador pode bloquear varias abas; se isso acontecer, use Copiar todas ou abra uma por vez.</small>
      ${state.mensagens.map((m, idx) => {
        const c = fornecedorContato(m.fornecedor);
        return `<div class="cot-msg-card">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <strong style="color:var(--text);">${esc(m.fornecedor.nome || 'Fornecedor')}</strong>
            <small style="font-family:var(--fm);color:var(--muted);">${c.wpp ? 'WPP ' + esc(c.wpp) : ''}${c.email ? ' | ' + esc(c.email) : ''}</small>
          </div>
          <textarea class="j-textarea cot-msg-text" rows="7">${esc(m.mensagem)}</textarea>
          <div style="display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:7px;margin-top:7px;align-items:center;">
            <input class="j-input cot-link-publico" readonly value="${escAttr(m.fornecedor.link || '')}" style="font-size:.68rem;font-family:var(--fm);" title="Link publico individual para este fornecedor">
            <button type="button" class="btn-outline" onclick="window.copiarLinkCotacao(${idx})">Copiar link publico</button>
          </div>
          <div class="cot-msg-actions">
            <button type="button" class="btn-success" onclick="window.abrirCanalCotacao(${idx},'whatsapp')">WhatsApp</button>
            <button type="button" class="btn-outline" onclick="window.abrirCanalCotacao(${idx},'email')">E-mail</button>
            <button type="button" class="btn-primary" onclick="window.abrirCanalCotacao(${idx},'share')">Compartilhar</button>
            <button type="button" class="btn-ghost" onclick="window.copiarMensagemCotacao(${idx})">Copiar</button>
          </div>
        </div>`;
      }).join('')}`;
  }

  function linhasExportCotacao() {
    if (!(state.items && state.items.length)) {
      const osIdAtual = $('osId')?.value || '';
      const osAtual = (J().os || []).find(o => String(o.id) === String(osIdAtual)) || {
        id: osIdAtual,
        clienteId: $('osCliente')?.value || '',
        veiculoId: $('osVeiculo')?.value || '',
        placa: $('osPlacaView')?.value || '',
        prefixo: $('osPrefixo')?.value || '',
        tipoVeiculoOS: $('osTipoVeiculo')?.value || ''
      };
      state.os = osAtual;
      state.items = typeof W.pecasCotacaoDaTelaOS === 'function' ? W.pecasCotacaoDaTelaOS() : [];
    }
    const os = state.os || {};
    const items = state.items && state.items.length ? state.items : (state.item ? [state.item] : []);
    const v = veiculoOS(os);
    const fornecedoresSel = selecionados();
    const mensagens = state.mensagens || [];
    const lines = [
      'COTACAO DE PECAS - thIAguinho',
      'Gerada em: ' + new Date().toLocaleString('pt-BR'),
      'O.S.: ' + osRefLabel(os),
      '',
      'VEICULO',
      'Prefixo: ' + (v.prefixo || '-'),
      'Placa: ' + (v.placa || '-'),
      'Modelo: ' + (v.nome || '-'),
      'Ano: ' + (v.ano || '-'),
      'Chassi: ' + (v.chassi || '-'),
      'Cor: ' + (v.cor || '-'),
      'KM: ' + (v.km || '-'),
      'Tipo: ' + (v.tipo || '-'),
      '',
      'ITENS',
      ...items.map((item, idx) => [
        (idx + 1) + '. ' + itemTitulo(item),
        'Qtd: ' + (item.qtd || 1),
        item.valorFinal ? 'Valor orcado: ' + moeda(item.valorFinal) : ''
      ].filter(Boolean).join(' | ')),
      '',
      'FORNECEDORES SELECIONADOS',
      ...(fornecedoresSel.length ? fornecedoresSel.map((f, idx) => {
        const contato = fornecedorContato(f);
        const msg = mensagens.find(m => String(m.fornecedor?.id || '') === String(f.id || ''));
        return (idx + 1) + '. ' + (f.nome || f.razao || 'Fornecedor') +
          (contato.wpp ? ' | WPP: ' + contato.wpp : '') +
          (contato.email ? ' | Email: ' + contato.email : '') +
          (msg?.fornecedor?.link ? ' | Link: ' + msg.fornecedor.link : '');
      }) : ['Nenhum fornecedor selecionado no momento da exportacao.']),
      '',
      'OBSERVACAO',
      $('cotRfqObs')?.value?.trim() || '-'
    ];
    return lines.join('\r\n');
  }

  function osAtualExportacaoCotacao() {
    const idTela = $('osId')?.value || state.os?.id || state.osId || '';
    const osTela = (J().os || []).find(o => String(o.id || '') === String(idTela || ''));
    return osTela || state.os || {};
  }

  function mergeCotacoesTela(os) {
    const salvas = cotMap(os);
    const tela = typeof W.coletarCotacoesPecasOS === 'function' ? (W.coletarCotacoesPecasOS() || {}) : {};
    const out = Object.assign({}, salvas);
    Object.keys(tela).forEach(key => {
      out[key] = Object.assign({}, salvas[key] || {}, tela[key] || {}, {
        solicitacoes: (salvas[key]?.solicitacoes || tela[key]?.solicitacoes || [])
      });
    });
    return out;
  }

  function itensParaExportacaoCotacao(os, map) {
    const keys = new Set(Object.keys(map || {}));
    D.querySelectorAll('#cotacaoPecasOS .cotacao-peca-box[data-item-key]').forEach(box => keys.add(box.getAttribute('data-item-key')));
    if (state.itemKeys && state.itemKeys.length) state.itemKeys.forEach(k => keys.add(k));
    const itens = getItems(os, Array.from(keys));
    if (itens.length) return itens;
    if (typeof W.pecasCotacaoDaTelaOS === 'function') return W.pecasCotacaoDaTelaOS() || [];
    return budgetItems(os).filter(i => i.tipo === 'peca');
  }

  function valorTotalOpcao(op, item) {
    const qtd = num(item?.qtd || op?.qtd || 1) || 1;
    const totalDireto = num(op?.valorTotal);
    if (totalDireto > 0) return totalDireto;
    return +(num(op?.valorUnitario) * qtd + num(op?.frete)).toFixed(2);
  }

  function opcoesValidasExportacao(cot, item) {
    return (cot?.opcoes || [])
      .filter(op => num(op?.valorUnitario) > 0 || num(op?.valorTotal) > 0 || op?.fornecedor || op?.fornecedorNome)
      .map(op => Object.assign({}, op, {
        valorUnitario: num(op?.valorUnitario),
        frete: num(op?.frete),
        valorTotalCalculado: valorTotalOpcao(op, item)
      }))
      .sort((a, b) => {
        const av = a.valorTotalCalculado || 999999999;
        const bv = b.valorTotalCalculado || 999999999;
        return av - bv || String(a.fornecedor || a.fornecedorNome || '').localeCompare(String(b.fornecedor || b.fornecedorNome || ''));
      });
  }

  function melhorOpcaoExportacao(opcoes) {
    return opcoes.filter(op => num(op.valorUnitario) > 0 || num(op.valorTotalCalculado) > 0)[0] || null;
  }

  function escolhidaExportacao(opcoes) {
    return opcoes.find(op => op.selecionado) || melhorOpcaoExportacao(opcoes);
  }

  function fmtDataHoraCotacao(v) {
    if (!v) return '-';
    try {
      const d = v && typeof v.toDate === 'function' ? v.toDate() : new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString('pt-BR');
    } catch (_) {
      return String(v);
    }
  }

  function fornecedorNomeOpcao(op) {
    return op?.fornecedor || op?.fornecedorNome || op?.responsavel || 'Fornecedor';
  }

  function fornecedorKeyCotacao(v) {
    return norm(String(v || ''));
  }

  function fornecedoresConsultadosHTML(cot, opcoes) {
    const respondidos = new Set();
    opcoes.forEach(op => {
      if (op.fornecedorId) respondidos.add('id:' + String(op.fornecedorId));
      respondidos.add('nome:' + fornecedorKeyCotacao(fornecedorNomeOpcao(op)));
    });
    const solicitacoes = Array.isArray(cot?.solicitacoes) ? cot.solicitacoes : [];
    const fornecedores = [];
    solicitacoes.forEach(sol => {
      (sol.fornecedores || []).forEach(f => {
        const k = f.id ? 'id:' + String(f.id) : 'nome:' + fornecedorKeyCotacao(f.nome);
        if (!fornecedores.some(x => x.key === k)) fornecedores.push({ key: k, item: f, sol });
      });
    });
    if (!fornecedores.length) return '<span class="muted">Sem pedido publico registrado para esta peca.</span>';
    return '<ul class="consultados">' + fornecedores.map(({ key, item, sol }) => {
      const ok = respondidos.has(key) || respondidos.has('nome:' + fornecedorKeyCotacao(item.nome));
      return `<li><strong>${esc(item.nome || 'Fornecedor')}</strong> <span class="${ok ? 'ok' : 'pend'}">${ok ? 'respondido' : 'sem resposta'}</span><br><small>${item.wpp ? 'WPP ' + esc(item.wpp) + ' | ' : ''}${item.email ? 'Email ' + esc(item.email) + ' | ' : ''}solicitado em ${fmtDataHoraCotacao(sol.createdAt)}</small></li>`;
    }).join('') + '</ul>';
  }

  function montarHTMLAnaliseCotacao() {
    const os = osAtualExportacaoCotacao();
    const map = mergeCotacoesTela(os);
    const itens = itensParaExportacaoCotacao(os, map);
    const v = veiculoOS(os);
    const emitido = new Date();
    let totalOrcado = 0;
    let totalMelhor = 0;
    let totalEscolhido = 0;
    let totalComprado = 0;
    const linhasItens = itens.map((item, idx) => {
      const cot = map[item.key] || {};
      const opcoes = opcoesValidasExportacao(cot, item);
      const melhor = melhorOpcaoExportacao(opcoes);
      const escolhida = escolhidaExportacao(opcoes);
      const qtd = num(item.qtd || 1) || 1;
      const orcado = num(item.valorFinal || item.valorOrcado || item.valorAprovado || item.valorUnit || 0);
      const melhorTotal = melhor ? melhor.valorTotalCalculado : 0;
      const escolhidaTotal = escolhida ? escolhida.valorTotalCalculado : 0;
      totalOrcado += orcado;
      totalMelhor += melhorTotal;
      totalEscolhido += escolhidaTotal;
      if (escolhida?.comprado || opcoes.some(op => op.comprado)) totalComprado += escolhidaTotal || melhorTotal;
      const status = opcoes.length ? (escolhida?.comprado ? 'comprado' : escolhida?.selecionado ? 'escolhido' : 'analisar') : 'aguardando';
      const rows = opcoes.length ? opcoes.map((op, opIdx) => {
        const isBest = melhor && op.id === melhor.id;
        const isEscolhida = escolhida && op.id === escolhida.id && op.selecionado;
        const marcaOferta = op.marca || op.marcaPeca || '';
        const modeloOferta = op.modelo || op.modeloPeca || (op.marcaModelo && op.marcaModelo !== marcaOferta ? op.marcaModelo : '') || op.codigoFornecedor || '';
        return `<tr class="${isBest ? 'best' : ''} ${isEscolhida ? 'chosen' : ''}">
          <td>${opIdx + 1}</td>
          <td><strong>${esc(fornecedorNomeOpcao(op))}</strong>${op.origem ? `<br><small>${esc(op.origem)}</small>` : ''}</td>
          <td class="brandcell"><strong>${esc(marcaOferta || '-')}</strong><br><small>${esc(modeloOferta || '-')}</small></td>
          <td class="num">${moeda(op.valorUnitario)}</td>
          <td class="num">${op.frete ? moeda(op.frete) : '-'}</td>
          <td class="num"><strong>${moeda(op.valorTotalCalculado)}</strong></td>
          <td>${esc(op.prazo || '-')}</td>
          <td>${esc(op.condicao || op.observacao || '-')}</td>
          <td>${isBest ? '<span class="tag ok">menor</span>' : ''}${op.selecionado ? '<span class="tag info">comprar</span>' : ''}${op.comprado ? '<span class="tag bought">comprado</span>' : ''}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="9" class="empty">Nenhuma resposta registrada para esta peca.</td></tr>';
      const economia = orcado && melhorTotal ? orcado - melhorTotal : 0;
      const melhorMarca = melhor ? (melhor.marca || melhor.marcaPeca || '') : '';
      const melhorModelo = melhor ? (melhor.modelo || melhor.modeloPeca || (melhor.marcaModelo && melhor.marcaModelo !== melhorMarca ? melhor.marcaModelo : '') || melhor.codigoFornecedor || '') : '';
      const melhorMarcaModelo = [melhorMarca, melhorModelo].filter(Boolean).join(' / ');
      return `<section class="item">
        <div class="item-head">
          <div>
            <h2>${idx + 1}. ${esc(itemTitulo(item))}</h2>
            <p>Qtd ${esc(qtd)} | Valor orcado/aprovado: <strong>${moeda(orcado)}</strong>${economia ? ` | Diferença vs menor: <strong class="${economia >= 0 ? 'ok' : 'danger'}">${moeda(economia)}</strong>` : ''}</p>
          </div>
          <span class="status ${status}">${status}</span>
        </div>
        <div class="rec">
          <strong>Recomendação:</strong> ${melhor ? `menor resposta em <strong>${esc(fornecedorNomeOpcao(melhor))}</strong>, ${moeda(melhor.valorTotalCalculado)} total (${moeda(melhor.valorUnitario)} un.)${melhor.prazo ? ', prazo ' + esc(melhor.prazo) : ''}${melhorMarcaModelo ? ', peça ' + esc(melhorMarcaModelo) : ''}.` : 'aguardar retorno dos fornecedores ou registrar cotação manual.'}
        </div>
        <table>
          <thead><tr><th>#</th><th>Fornecedor</th><th>Marca / modelo ofertado</th><th>Unit.</th><th>Frete</th><th>Total</th><th>Prazo</th><th>Condição/obs.</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="consultados-wrap"><strong>Fornecedores consultados:</strong>${fornecedoresConsultadosHTML(cot, opcoes)}</div>
      </section>`;
    }).join('');
    const economiaTotal = totalOrcado && totalMelhor ? totalOrcado - totalMelhor : 0;
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Análise de cotação ${esc(osRefLabel(os))}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f3f5f8;color:#152033;} .page{max-width:1120px;margin:0 auto;background:#fff;min-height:100vh;padding:28px;} header{border-bottom:3px solid #0f766e;padding-bottom:16px;margin-bottom:18px;display:flex;justify-content:space-between;gap:18px;} h1{margin:0;font-size:22px;letter-spacing:.04em;} .muted,small{color:#64748b;} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0;} .kpi{border:1px solid #d7dee8;border-radius:6px;padding:12px;background:#f8fafc;} .kpi b{display:block;font-size:17px;margin-top:4px;} .item{page-break-inside:avoid;border:1px solid #d7dee8;border-radius:6px;margin:18px 0;overflow:hidden;} .item-head{display:flex;justify-content:space-between;gap:12px;padding:14px;background:#eef6f5;border-bottom:1px solid #d7dee8;} .item h2{font-size:16px;margin:0 0 5px;} .item p{margin:0;font-size:12px;color:#475569;} .status,.tag{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;text-transform:uppercase;margin:2px;} .status{height:fit-content;background:#e2e8f0;color:#334155;} .status.comprado,.tag.bought{background:#dcfce7;color:#166534;} .status.escolhido,.tag.info{background:#dbeafe;color:#1d4ed8;} .status.analisar,.tag.ok{background:#ccfbf1;color:#0f766e;} .status.aguardando{background:#fee2e2;color:#991b1b;} .rec{padding:10px 14px;background:#fff7ed;border-bottom:1px solid #fed7aa;font-size:12px;} table{width:100%;border-collapse:collapse;font-size:11px;} th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;vertical-align:top;} th{background:#f8fafc;color:#334155;text-transform:uppercase;font-size:10px;} tr.best td{background:#ecfdf5;} tr.chosen td{outline:2px solid #60a5fa;outline-offset:-2px;} .brandcell strong{display:block;color:#0f172a;font-size:12px}.brandcell small{display:block;margin-top:2px;color:#475569;font-weight:700}.num{text-align:right;white-space:nowrap;} .ok{color:#15803d;} .danger{color:#b91c1c;} .empty{text-align:center;color:#64748b;padding:16px;} .consultados-wrap{padding:10px 14px;background:#fafafa;font-size:11px;} .consultados{margin:6px 0 0;padding-left:18px;} .consultados li{margin:4px 0;} .pend{color:#b45309;font-weight:700;} footer{border-top:1px solid #d7dee8;margin-top:24px;padding-top:10px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;gap:12px;} @media print{body{background:#fff}.page{padding:12mm;max-width:none}.item{break-inside:avoid}.no-print{display:none}}
</style>
</head>
<body>
<div class="page">
<header>
  <div><h1>ANÁLISE DE COTAÇÃO DE PEÇAS</h1><div class="muted">${esc(osRefLabel(os))} | emitido em ${emitido.toLocaleString('pt-BR')}</div></div>
  <div style="text-align:right"><strong>${esc(J().oficina?.nomeFantasia || J().tnome || 'Oficina')}</strong><br><span class="muted">Oficin_IA</span></div>
</header>
<section>
  <strong>Veículo:</strong> ${esc([v.prefixo ? 'Prefixo ' + v.prefixo : '', v.placa ? 'Placa ' + v.placa : '', v.nome || '', v.ano || '', v.chassi ? 'Chassi ' + v.chassi : '', v.cambio ? 'Câmbio ' + labelCambioCotacao(v.cambio) : '', v.valvulas ? labelValvulasCotacao(v.valvulas) : ''].filter(Boolean).join(' | ') || '-')}
</section>
<div class="grid">
  <div class="kpi">Itens cotados<b>${itens.length}</b></div>
  <div class="kpi">Total orçado<b>${moeda(totalOrcado)}</b></div>
  <div class="kpi">Menores respostas<b>${moeda(totalMelhor)}</b></div>
  <div class="kpi">Economia potencial<b class="${economiaTotal >= 0 ? 'ok' : 'danger'}">${moeda(economiaTotal)}</b></div>
  <div class="kpi">Total escolhido<b>${moeda(totalEscolhido)}</b></div>
  <div class="kpi">Já comprado<b>${moeda(totalComprado)}</b></div>
</div>
${linhasItens || '<section class="item"><div class="empty">Nenhuma peça de cotação encontrada nesta O.S.</div></section>'}
<footer><span>Orçamento/laudo comercial gerado pelo sistema Oficin_IA</span><strong>Powered by thIAguinho Solu\u00e7\u00f5es Digitais</strong></footer>
</div>
</body>
</html>`;
  }

  W.exportarCotacaoFornecedoresOS = async function () {
    const os = osAtualExportacaoCotacao();
    const html = montarHTMLAnaliseCotacao();
    const nome = 'analise-cotacao-' + String(os?.numero || os?.id || state.os?.id || 'os').slice(-6).toUpperCase() + '-' + new Date().toISOString().slice(0, 10) + '.html';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    try {
      if (typeof W.salvarBlobArquivoOS === 'function') {
        await W.salvarBlobArquivoOS(blob, nome, 'text/html');
      } else {
        const url = URL.createObjectURL(blob);
        const a = D.createElement('a');
        a.href = url;
        a.download = nome;
        D.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      W.toast?.('Analise de cotacao exportada com respostas dos fornecedores.', 'ok');
    } catch (err) {
      console.warn(err);
      W.toast?.('Nao foi possivel exportar a analise de cotacao.', 'warn');
    }
  };

  W.gerarEnvioCotacaoOS = async function () {
    const lista = selecionados();
    if (!lista.length) { W.toast?.('Selecione pelo menos um fornecedor.', 'warn'); return; }
    try {
      const payload = await salvarSolicitacao(lista);
      renderMensagens(payload);
      W.toast?.('Cotacao criada. Agora confirme o envio das mensagens.', 'ok');
    } catch (err) {
      console.error(err);
      W.toast?.('Nao foi possivel criar cotacao: ' + (err.message || err), 'err');
    }
  };

  W.copiarMensagemCotacao = async function (idx) {
    const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
    const txt = ta ? ta.value : state.mensagens[idx]?.mensagem || '';
    try {
      await navigator.clipboard.writeText(txt);
      W.toast?.('Mensagem copiada.', 'ok');
    } catch (_) {
      if (ta) { ta.focus(); ta.select(); D.execCommand('copy'); W.toast?.('Mensagem copiada.', 'ok'); }
    }
  };

  W.copiarLinkCotacao = async function (idx) {
    const input = D.querySelectorAll('#cotRfqMensagens .cot-link-publico')[idx];
    const link = input ? input.value : state.mensagens[idx]?.fornecedor?.link || '';
    if (!link) { W.toast?.('Link publico ainda nao foi gerado.', 'warn'); return; }
    try {
      await navigator.clipboard.writeText(link);
      W.toast?.('Link publico copiado.', 'ok');
    } catch (_) {
      if (input) { input.focus(); input.select(); D.execCommand('copy'); W.toast?.('Link publico copiado.', 'ok'); }
    }
  };

  W.copiarTodasMensagensCotacao = async function () {
    const textos = Array.from(D.querySelectorAll('#cotRfqMensagens .cot-msg-text')).map((ta, idx) => {
      const fornecedor = state.mensagens[idx]?.fornecedor?.nome || ('Fornecedor ' + (idx + 1));
      return '--- ' + fornecedor + ' ---\n' + ta.value;
    }).join('\n\n');
    if (!textos) { W.toast?.('Nao ha mensagens geradas.', 'warn'); return; }
    try {
      await navigator.clipboard.writeText(textos);
      W.toast?.('Todas as mensagens foram copiadas.', 'ok');
    } catch (_) {
      W.toast?.('Nao foi possivel copiar em lote. Copie uma mensagem por vez.', 'warn');
    }
  };

  W.abrirCanalCotacaoTodos = function (canal) {
    if (!state.mensagens.length) { W.toast?.('Nao ha mensagens geradas.', 'warn'); return; }
    if (canal === 'whatsapp') {
      let abertas = 0;
      state.mensagens.forEach((m, idx) => {
        const c = fornecedorContato(m.fornecedor || {});
        const phone = phoneBR(c.wpp);
        if (!phone) return;
        const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
        const msg = ta ? ta.value : m.mensagem;
        setTimeout(() => {
          if (typeof W.thiaOpenWhatsApp === 'function') W.thiaOpenWhatsApp(phone, msg, { fallbackNavigate: true });
          else W.open('https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(msg), '_blank');
        }, idx * 450);
        abertas++;
      });
      if (!abertas) W.toast?.('Nenhum fornecedor selecionado tem WhatsApp cadastrado.', 'warn');
      else W.toast?.('Abrindo WhatsApp por fornecedor. Confirme cada envio manualmente.', 'ok');
      return;
    }
    if (canal === 'email') {
      state.mensagens.forEach((m, idx) => {
        const c = fornecedorContato(m.fornecedor || {});
        if (!c.email) return;
        const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
        const msg = ta ? ta.value : m.mensagem;
        setTimeout(() => {
          W.location.href = 'mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent('Cotacao de peca - ' + osRefLabel(state.os)) + '&body=' + encodeURIComponent(msg);
        }, idx * 350);
      });
      return;
    }
    W.copiarTodasMensagensCotacao();
  };

  W.abrirCanalCotacao = async function (idx, canal) {
    const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
    const msg = ta ? ta.value : state.mensagens[idx]?.mensagem || '';
    const f = state.mensagens[idx]?.fornecedor || {};
    const c = fornecedorContato(f);
    if (canal === 'whatsapp') {
      const phone = phoneBR(c.wpp);
      if (!phone) { W.toast?.('Fornecedor sem WhatsApp cadastrado.', 'warn'); return; }
      if (typeof W.thiaOpenWhatsApp === 'function') W.thiaOpenWhatsApp(phone, msg, { fallbackNavigate: true });
      else W.open('https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(msg), '_blank');
      return;
    }
    if (canal === 'email') {
      if (!c.email) { W.toast?.('Fornecedor sem e-mail cadastrado.', 'warn'); return; }
      W.location.href = 'mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent('Cotacao de peca - ' + osRefLabel(state.os)) + '&body=' + encodeURIComponent(msg);
      return;
    }
    if (canal === 'share' && navigator.share) {
      try { await navigator.share({ title: 'Cotacao de peca', text: msg }); return; } catch (_) {}
    }
    W.copiarMensagemCotacao(idx);
  };

  async function incorporarResposta(respId, resp, origemDb) {
    const database = db();
    if (!database || !resp || !resp.osId || !J().tid) return;
    const respItens = Array.isArray(resp.itensResposta) && resp.itensResposta.length ? resp.itensResposta : [{
      itemKey: resp.itemKey,
      item: resp.item || {},
      valorUnitario: resp.valorUnitario,
      marca: resp.marca,
      modelo: resp.modelo,
      disponibilidade: resp.disponibilidade,
      prazo: resp.prazo || resp.prazoDias,
      observacao: resp.observacao
    }];
    const keyProcesso = respId + ':' + resp.osId + ':' + respItens.map(i => i.itemKey || i.key || '').join(',');
    W._cotRespSyncing = W._cotRespSyncing || new Set();
    if (W._cotRespSyncing.has(keyProcesso)) return;
    W._cotRespSyncing.add(keyProcesso);
    try {
      const ref = database.collection('ordens_servico').doc(resp.osId);
      const snap = await ref.get();
      if (!snap.exists) return;
      const os = { id: snap.id, ...snap.data() };
      const map = cotMap(os);
      respItens.forEach((ri, idx) => {
        const itemKey = ri.itemKey || ri.key || ri.item?.key || resp.itemKeys?.[idx] || resp.itemKey;
        if (!itemKey) return;
        const itemResp = ri.item || (Array.isArray(resp.itens) ? resp.itens.find(i => String(i.key) === String(itemKey)) : null) || resp.item || {};
        const atual = Object.assign({ key: itemKey, item: itemResp, opcoes: [] }, map[itemKey] || {});
        atual.opcoes = Array.isArray(atual.opcoes) ? atual.opcoes.slice() : [];
        if (atual.opcoes.some(o => o.respostaId === respId && String(o.itemKey || itemKey) === String(itemKey))) return;
        const qtd = num(atual.item?.qtd || itemResp?.qtd || 1) || 1;
        const valorUnitario = num(ri.valorUnitario);
        if (valorUnitario <= 0) return;
        const frete = num(resp.frete);
        atual.opcoes.push({
          id: 'resp-' + respId + '-' + itemKey,
          itemKey,
          respostaId: respId,
          cotacaoId: resp.cotacaoId || '',
          fornecedorId: resp.fornecedorId || '',
          fornecedor: resp.fornecedorNome || resp.responsavel || 'Fornecedor',
          valorUnitario,
          frete,
          valorTotal: +(valorUnitario * qtd + (idx === 0 ? frete : 0)).toFixed(2),
          marca: ri.marca || resp.marca || '',
          modelo: ri.modelo || ri.modeloPeca || resp.modelo || resp.modeloPeca || '',
          marcaModelo: [ri.marca || resp.marca || '', ri.modelo || ri.modeloPeca || resp.modelo || resp.modeloPeca || ''].filter(Boolean).join(' / '),
          prazo: ri.prazo || resp.prazo || resp.prazoDias || '',
          condicao: [
            resp.condicao || '',
            ri.disponibilidade || resp.disponibilidade ? 'Disponibilidade: ' + (ri.disponibilidade || resp.disponibilidade) : '',
            ri.marca || resp.marca ? 'Marca: ' + (ri.marca || resp.marca) : '',
            ri.modelo || ri.modeloPeca || resp.modelo || resp.modeloPeca ? 'Modelo/código: ' + (ri.modelo || ri.modeloPeca || resp.modelo || resp.modeloPeca) : '',
            idx === 0 && frete ? 'Frete: ' + moeda(frete) : '',
            ri.observacao || resp.observacao || ''
          ].filter(Boolean).join(' | '),
          selecionado: false,
          comprado: false,
          origem: 'cotacao_publica',
          recebidoEm: resp.createdAt || nowISO(),
          updatedAt: nowISO()
        });
        atual.updatedAt = nowISO();
        map[itemKey] = atual;
      });
      const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
      timeline.push({
        dt: nowISO(),
        user: resp.fornecedorNome || 'Fornecedor',
        acao: 'Recebeu resposta de cotacao para ' + respItens.length + ' peca(s) da O.S.',
        tipo: 'cotacao_pecas_resposta',
        interno: true,
        respostaId: respId
      });
      await ref.update({ cotacoesPecas: map, timeline, updatedAt: nowISO() });
      try { await (origemDb || database).collection('cotacoes_respostas').doc(respId).update({ sincronizadaEm: nowISO() }); } catch (_) {}
      const local = (J().os || []).find(o => o.id === resp.osId);
      if (local) Object.assign(local, { cotacoesPecas: map, timeline, updatedAt: nowISO() });
      try {
        await database.collection('notificacoes_live').add({
          tenantId: J().tid,
          tipo: 'cotacao_recebida',
          titulo: 'Cotacao recebida',
          mensagem: 'Fornecedor respondeu cotacao de ' + (respItens.length > 1 ? respItens.length + ' pecas' : (resp.item?.desc || 'peca')) + '.',
          perfilDestino: 'jarvis',
          entidade: 'ordens_servico',
          entidadeId: resp.osId,
          prioridade: 'normal',
          lida: false,
          createdAt: nowISO()
        });
      } catch (_) {}
      if ($('osId')?.value === resp.osId && typeof W.aplicarMarcadoresAprovacaoOS === 'function') {
        W.aplicarMarcadoresAprovacaoOS(local || os);
      }
      W.toast?.('Resposta de cotacao recebida e anexada na O.S.', 'ok');
    } catch (err) {
      console.warn('Falha ao sincronizar resposta de cotacao', err);
    } finally {
      W._cotRespSyncing.delete(keyProcesso);
    }
  }

  function instalarListenerRespostas() {
    if (W._cotRespListener || !db() || !J().tid) return;
    try {
      W._cotRespListener = db().collection('cotacoes_respostas')
        .where('tenantId', '==', J().tid)
        .onSnapshot(snap => {
          snap.docChanges().forEach(ch => {
            if (ch.type !== 'added' && ch.type !== 'modified') return;
            const data = ch.doc.data() || {};
            if (data.sincronizadaEm) return;
            incorporarResposta(ch.doc.id, { id: ch.doc.id, ...data }, db());
          });
        });
    } catch (err) {
      console.warn('Listener de cotacoes indisponivel', err);
    }
    try {
      const cdb = centralDb();
      if (cdb && !sameDatabase(cdb, db()) && !W._cotRespCentralListener) {
        W._cotRespCentralListener = cdb.collection('cotacoes_respostas')
          .where('tenantId', '==', J().tid)
          .onSnapshot(snap => {
            snap.docChanges().forEach(ch => {
              if (ch.type !== 'added' && ch.type !== 'modified') return;
              const data = ch.doc.data() || {};
              if (data.sincronizadaEm) return;
              incorporarResposta(ch.doc.id, { id: ch.doc.id, ...data }, cdb);
            });
          });
      }
    } catch (err) {
      console.warn('Listener central de cotacoes indisponivel', err);
    }
  }

  function patchRenderCotacoes() {
    if (W._cotacoesRenderPatched || typeof W.renderCotacaoPecasAprovadasOS !== 'function') return;
    const original = W.renderCotacaoPecasAprovadasOS;
    W.renderCotacaoPecasAprovadasOS = function (os, aprovados, moedaFn) {
      let html = original.call(this, os, aprovados, moedaFn);
      if (!html || typeof html !== 'string') return html;
      return html;
    };
    W._cotacoesRenderPatched = true;
  }

  D.addEventListener('DOMContentLoaded', function () {
    patchRenderCotacoes();
    setTimeout(patchRenderCotacoes, 300);
    const timer = setInterval(function () {
      patchRenderCotacoes();
      instalarListenerRespostas();
      if ((W._cotRespListener || W._cotRespCentralListener) && W._cotacoesRenderPatched) clearInterval(timer);
    }, 1200);
  });

  W.thiaCotacoes = Object.assign(W.thiaCotacoes || {}, {
    abrir: W.abrirCotacaoFornecedoresOS,
    sincronizarResposta: incorporarResposta
  });
})();
