/**
 * OFICIN-IA V26.4 — Hotfix de sincronização de fornecedores no Jarvis
 *
 * Corrige o falso estado "Nenhum fornecedor cadastrado" quando a primeira
 * leitura vem apenas do cache, falha por rede/cota ou perde o listener.
 * Não altera documentos, financeiro, estoque, NF-e ou regras de negócio.
 * A migração de fornecedores legados só ocorre por ação explícita do gestor
 * e somente para registros relacionados às NFs/financeiro do tenant atual.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_FORNECEDORES_V264__) return;
  W.__THIA_FORNECEDORES_V264__ = true;

  const VERSION = '26.4.0';
  const byId = id => D.getElementById(id);
  const state = {
    unsubscribe: null,
    retryTimer: null,
    attempts: 0,
    serverConfirmed: false,
    legacyCandidates: [],
    lastError: null
  };

  const J = () => W.J || {};
  const norm = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  const digits = value => String(value || '').replace(/\D/g, '');
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function ensureUI() {
    const tb = byId('tbFornec');
    const card = tb?.closest('.j-card');
    if (!card) return null;

    const tools = card.querySelector('.j-card-header .j-collapse-tools');
    if (tools && !byId('fornecReloadV264')) {
      const btn = D.createElement('button');
      btn.type = 'button';
      btn.id = 'fornecReloadV264';
      btn.className = 'btn-ghost';
      btn.textContent = '↻ RECARREGAR';
      btn.title = 'Forçar nova leitura dos fornecedores no Firestore';
      btn.onclick = () => W.recarregarFornecedoresV264?.();
      tools.insertBefore(btn, tools.firstChild);
    }

    let box = byId('fornecSyncV264');
    if (!box) {
      box = D.createElement('div');
      box.id = 'fornecSyncV264';
      box.style.cssText = [
        'display:none', 'margin:8px', 'padding:9px 10px',
        'border:1px solid var(--border)', 'border-radius:5px',
        'font-family:var(--fm)', 'font-size:.64rem', 'line-height:1.45',
        'white-space:normal', 'overflow-wrap:anywhere'
      ].join(';');
      const body = card.querySelector('.j-card-body');
      body?.insertBefore(box, body.firstChild);
    }
    return box;
  }

  function status(message, type = 'info', actions = '') {
    const box = ensureUI();
    if (!box) return;
    const palette = {
      info: ['rgba(56,189,248,.08)', 'rgba(56,189,248,.35)', 'var(--cyan)'],
      ok: ['rgba(16,185,129,.08)', 'rgba(16,185,129,.35)', 'var(--success)'],
      warn: ['rgba(245,158,11,.08)', 'rgba(245,158,11,.38)', 'var(--warn)'],
      err: ['rgba(239,68,68,.08)', 'rgba(239,68,68,.38)', 'var(--danger)']
    }[type] || ['transparent', 'var(--border)', 'var(--muted)'];
    box.style.display = 'block';
    box.style.background = palette[0];
    box.style.borderColor = palette[1];
    box.style.color = palette[2];
    box.innerHTML = `<div>${esc(message)}</div>${actions ? `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:7px;">${actions}</div>` : ''}`;
  }

  function hideStatusLater() {
    setTimeout(() => {
      const box = byId('fornecSyncV264');
      if (box && state.serverConfirmed && (J().fornecedores || []).length) box.style.display = 'none';
    }, 1800);
  }

  function renderList(list) {
    J().fornecedores = Array.isArray(list) ? list : [];
    try { W.renderFornecedores?.(); } catch (err) { console.warn('[V26.4 fornecedores render]', err); }
    try { W.popularSelects?.(); } catch (_) {}
  }

  function errorMessage(err) {
    const code = String(err?.code || '').toLowerCase();
    const raw = String(err?.message || err || 'Falha desconhecida');
    if (code.includes('resource-exhausted') || /quota|resource.exhausted/i.test(raw)) {
      return 'A cota de leituras do Firestore foi atingida ou está indisponível. Os fornecedores não foram apagados; a leitura foi recusada pelo servidor.';
    }
    if (code.includes('permission-denied')) {
      return 'O Firestore recusou a leitura dos fornecedores por regra de acesso.';
    }
    if (code.includes('unavailable') || /network|offline|unavailable/i.test(raw)) {
      return 'Não foi possível sincronizar fornecedores com o Firestore. A conexão está indisponível e o cache local não possui essa coleção.';
    }
    return `Falha ao sincronizar fornecedores: ${raw}`;
  }

  function clearListener() {
    if (typeof state.unsubscribe === 'function') {
      try { state.unsubscribe(); } catch (_) {}
    }
    state.unsubscribe = null;
    clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  function scheduleRetry(err) {
    const code = String(err?.code || '').toLowerCase();
    if (code.includes('resource-exhausted') || code.includes('permission-denied')) return;
    if (state.attempts >= 3) return;
    const delays = [3000, 10000, 30000];
    const delay = delays[Math.min(state.attempts, delays.length - 1)];
    state.attempts += 1;
    clearTimeout(state.retryTimer);
    state.retryTimer = setTimeout(() => startListener(true), delay);
  }

  function emptyActions() {
    return [
      '<button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">↻ TENTAR NOVAMENTE</button>',
      '<button type="button" class="btn-outline" onclick="window.diagnosticarFornecedoresLegadosV264()">DIAGNOSTICAR VÍNCULOS ANTIGOS</button>'
    ].join('');
  }

  function startListener(force = false) {
    ensureUI();
    const db = W.db || J().db;
    const tenantId = String(J().tid || '').trim();
    if (!db || !tenantId) {
      status('Sessão da oficina ainda não está pronta para carregar fornecedores.', 'warn', '<button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">TENTAR NOVAMENTE</button>');
      state.retryTimer = setTimeout(() => startListener(true), 1500);
      return null;
    }
    if (state.unsubscribe && !force) return state.unsubscribe;
    clearListener();
    state.serverConfirmed = false;
    state.lastError = null;
    status('Sincronizando fornecedores com o Firestore…', 'info');

    const query = db.collection('fornecedores').where('tenantId', '==', tenantId);
    state.unsubscribe = query.onSnapshot({ includeMetadataChanges: true }, snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const fromCache = !!snap.metadata?.fromCache;

      // Um snapshot vazio vindo apenas do cache NÃO significa que o banco está vazio.
      if (fromCache && !list.length) {
        status('Aguardando confirmação do servidor. O cache local ainda não possui fornecedores.', 'info', '<button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">FORÇAR SINCRONIZAÇÃO</button>');
        return;
      }

      state.serverConfirmed = !fromCache;
      state.attempts = 0;
      renderList(list);

      if (list.length) {
        status(`${list.length} fornecedor(es) sincronizado(s) para esta oficina${fromCache ? ' pelo cache local' : ' pelo servidor'}.`, 'ok');
        hideStatusLater();
      } else if (!fromCache) {
        status(`O servidor respondeu, mas não encontrou fornecedor com tenantId igual a "${tenantId}". Os documentos podem estar sem vínculo de oficina ou com um tenantId antigo.`, 'warn', emptyActions());
      }
    }, err => {
      state.lastError = err;
      clearListener();
      status(errorMessage(err), 'err', '<button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">↻ TENTAR NOVAMENTE</button>');
      console.warn('[V26.4 fornecedores]', err?.code || '', err?.message || err);
      scheduleRetry(err);
    });
    return state.unsubscribe;
  }

  function valueFrom(obj, paths) {
    for (const path of paths) {
      const parts = path.split('.');
      let value = obj;
      for (const part of parts) value = value?.[part];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function tenantReferences() {
    const ids = new Set();
    const docs = [];
    const sources = [
      ...(Array.isArray(J().notasFiscaisEntrada) ? J().notasFiscaisEntrada : []),
      ...(Array.isArray(J().financeiro) ? J().financeiro : [])
    ];
    sources.forEach(item => {
      const id = valueFrom(item, ['fornecedorId','fornecId','supplierId']);
      if (id) ids.add(String(id));
      const vinculo = String(item?.vinculo || '');
      if (/^F_/i.test(vinculo)) ids.add(vinculo.replace(/^F_/i, ''));
      const cnpj = digits(valueFrom(item, ['fornecedorCnpj','cnpjFornecedor','fornecedor.cnpj','emitente.cnpj','cnpj']));
      const nome = norm(valueFrom(item, ['fornecedorNome','nomeFornecedor','fornecedor.nome','fornecedor.razaoSocial','emitente.nome','emitente.razaoSocial']));
      if (cnpj || nome) docs.push({ cnpj, nome });
    });
    return { ids, docs };
  }

  function linkedToTenant(doc, refs) {
    if (refs.ids.has(String(doc.id))) return true;
    const cnpj = digits(doc.cnpj || doc.cpfCnpj || doc.doc || doc.documento);
    const nome = norm(doc.nome || doc.razaoSocial || doc.razao || doc.fantasia || doc.nomeFantasia);
    return refs.docs.some(ref => (cnpj && ref.cnpj && cnpj === ref.cnpj) || (nome.length > 4 && ref.nome.length > 4 && nome === ref.nome));
  }

  W.diagnosticarFornecedoresLegadosV264 = async function () {
    const db = W.db || J().db;
    const tenantId = String(J().tid || '').trim();
    if (!db || !tenantId) return status('Sessão da oficina ainda não está pronta.', 'warn');
    status('Analisando fornecedores antigos e vínculos das notas fiscais desta oficina…', 'info');
    try {
      const snap = await db.collection('fornecedores').get({ source:'server' });
      const all = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const refs = tenantReferences();
      const legacy = all.filter(doc => !String(doc.tenantId || '').trim() && linkedToTenant(doc, refs));
      const exact = all.filter(doc => String(doc.tenantId || '').trim() === tenantId);
      const foreign = all.filter(doc => String(doc.tenantId || '').trim() && String(doc.tenantId).trim() !== tenantId);
      state.legacyCandidates = legacy;

      if (exact.length) {
        renderList(exact);
        status(`${exact.length} fornecedor(es) pertencem ao tenant atual. A lista foi recarregada diretamente do servidor.`, 'ok');
        hideStatusLater();
        return;
      }
      if (legacy.length) {
        renderList(legacy.map(x => ({ ...x, _legacySemTenant:true })));
        status(`${legacy.length} fornecedor(es) antigo(s) foram identificados por vínculo com NFs/financeiro desta oficina, mas estão sem tenantId. Eles foram exibidos temporariamente. Confirme para gravar o vínculo correto.`, 'warn', '<button type="button" class="btn-success" onclick="window.corrigirVinculoFornecedoresV264()">CORRIGIR VÍNCULO DESTES FORNECEDORES</button>');
        return;
      }
      if (all.length && !refs.ids.size && !refs.docs.length) {
        status(`Existem ${all.length} fornecedor(es) na coleção, mas nenhum vínculo seguro com as NFs/financeiro carregados desta oficina foi encontrado. Não vou misturar fornecedores de outros tenants. Tenant atual: "${tenantId}".`, 'warn', '<button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">TENTAR NOVAMENTE</button>');
        return;
      }
      status(`A coleção possui ${all.length} documento(s): ${foreign.length} vinculado(s) a outros tenants e nenhum fornecedor seguro para o tenant atual "${tenantId}".`, 'warn');
    } catch (err) {
      status(errorMessage(err), 'err', '<button type="button" class="btn-ghost" onclick="window.diagnosticarFornecedoresLegadosV264()">TENTAR DIAGNÓSTICO NOVAMENTE</button>');
      console.warn('[V26.4 diagnóstico fornecedores]', err);
    }
  };

  W.corrigirVinculoFornecedoresV264 = async function () {
    const db = W.db || J().db;
    const tenantId = String(J().tid || '').trim();
    const list = state.legacyCandidates || [];
    if (!db || !tenantId || !list.length) return;
    if (!W.confirm(`Confirmar o vínculo de ${list.length} fornecedor(es) antigos com esta oficina?`)) return;
    try {
      for (let i=0; i<list.length; i+=400) {
        const batch = db.batch();
        list.slice(i, i+400).forEach(doc => batch.update(db.collection('fornecedores').doc(doc.id), {
          tenantId,
          tenantMigradoEm: new Date().toISOString(),
          tenantMigradoPor: J().nome || 'Gestor'
        }));
        await batch.commit();
      }
      state.legacyCandidates = [];
      W.audit?.('FORNECEDORES', `Corrigiu vínculo de ${list.length} fornecedor(es) antigos com o tenant ${tenantId}`);
      W.toast?.(`✓ ${list.length} fornecedor(es) vinculados à oficina`);
      startListener(true);
    } catch (err) {
      status('Erro ao corrigir o vínculo: ' + String(err?.message || err), 'err');
    }
  };

  W.recarregarFornecedoresV264 = function () {
    state.attempts = 0;
    return startListener(true);
  };

  // Sobrescreve apenas o listener de fornecedores da camada V23.
  W.escutarFornecedores = function () { return startListener(false); };

  function install() {
    ensureUI();
    const active = D.querySelector('.section.active')?.id;
    if (active === 's-estoque' || active === 's-financeiro') startListener(false);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  console.info('[OFICIN-IA] Fornecedores hotfix V' + VERSION + ' instalado');
})(window, document);
