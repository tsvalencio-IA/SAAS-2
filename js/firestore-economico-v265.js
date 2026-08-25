/**
 * OFICIN-IA V26.5 — Firestore Econômico
 *
 * Objetivos:
 * - Evitar carregar estoque, financeiro, fornecedores e documentos fiscais no dashboard.
 * - Usar cache local + validade por coleção para não reler tudo a cada recarga/navegação.
 * - Manter tempo real apenas onde é operacionalmente necessário (O.S. enquanto a tela usa O.S.).
 * - Suspender listener de O.S. quando a aba fica oculta ou o usuário permanece em módulo que não usa O.S.
 * - Carregar a IA por intenção, sem baixar todas as coleções ao abrir a aba thIAguinho.
 * - Atualizar a memória local após gravações feitas nesta própria aba.
 *
 * Não altera documentos, regras de negócio, cálculos, PDFs, planilhas ou estrutura do Firebase.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_FIRESTORE_ECONOMICO_V265__) return;
  W.__THIA_FIRESTORE_ECONOMICO_V265__ = true;

  const VERSION = '26.17.5';
  const J = () => W.J || {};
  const db = () => W.db || J().db;
  const byId = id => D.getElementById(id);
  const now = () => Date.now();
  const metric = (key, source, snap) => { try { W.ThiaFirestoreV2612?.track?.('jarvis:' + key, source, snap); } catch (_) {} };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const plate = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Impede que o módulo fiscal antigo abra quatro listeners permanentes no DOMContentLoaded.
  // Os mesmos dados serão carregados sob demanda por esta camada.
  W._hardeningFiscalListeners = true;

  const CONFIG = {
    os: { collection:'ordens_servico', target:'os', ttl:10*60*1000, live:true,
      sort:(a,b)=>String(b.updatedAt||b.createdAt||b.data||'').localeCompare(String(a.updatedAt||a.createdAt||a.data||'')) },
    clientes: { collection:'clientes', target:'clientes', ttl:2*60*60*1000,
      sort:(a,b)=>norm(a.nome||a.razaoSocial).localeCompare(norm(b.nome||b.razaoSocial)) },
    veiculos: { collection:'veiculos', target:'veiculos', ttl:60*60*1000,
      sort:(a,b)=>plate(a.placa).localeCompare(plate(b.placa)) },
    estoque: { collection:'estoqueItems', target:'estoque', ttl:60*60*1000,
      sort:(a,b)=>norm(a.desc||a.descricao).localeCompare(norm(b.desc||b.descricao)) },
    financeiro: { collection:'financeiro', target:'financeiro', ttl:30*60*1000,
      sort:(a,b)=>String(b.venc||b.data||b.createdAt||'').localeCompare(String(a.venc||a.data||a.createdAt||'')) },
    equipe: { collection:'funcionarios', target:'equipe', ttl:2*60*60*1000,
      sort:(a,b)=>norm(a.nome).localeCompare(norm(b.nome)) },
    fornecedores: { collection:'fornecedores', target:'fornecedores', ttl:2*60*60*1000,
      sort:(a,b)=>norm(a.nome||a.razaoSocial).localeCompare(norm(b.nome||b.razaoSocial)) },
    vendas: { collection:'vendas_pecas', target:'vendasAutopecas', ttl:30*60*1000,
      sort:(a,b)=>String(b.data||b.createdAt||'').localeCompare(String(a.data||a.createdAt||'')) },
    auditoria: { collection:'lixeira_auditoria', target:'auditoria', ttl:2*60*60*1000,
      sort:(a,b)=>String(b.ts||b.createdAt||'').localeCompare(String(a.ts||a.createdAt||'')) },
    notasFiscaisEntrada: { collection:'notas_fiscais_entrada', target:'notasFiscaisEntrada', ttl:60*60*1000 },
    nfItensVinculos: { collection:'nf_itens_vinculos', target:'nfItensVinculos', ttl:60*60*1000 },
    estoqueMovimentos: { collection:'estoque_movimentos', target:'estoqueMovimentos', ttl:60*60*1000 },
    pacotesBoletos: { collection:'pacotes_boletos', target:'pacotesBoletos', ttl:60*60*1000 }
  };

  const COLLECTION_TO_KEY = Object.fromEntries(Object.entries(CONFIG).map(([k,v]) => [v.collection, k]));
  const states = new Map();
  const stateOf = key => {
    if (!states.has(key)) states.set(key, { loaded:false, loading:null, liveUnsub:null, stopTimer:null, wakeTimer:null, lastSource:'', lastCount:0 });
    return states.get(key);
  };
  const stampKey = key => `thia:v265:${String(J().tid||'sem-tenant')}:${key}:serverAt`;
  const getStamp = key => { try { return Number(localStorage.getItem(stampKey(key)) || 0); } catch (_) { return 0; } };
  const setStamp = key => { try { localStorage.setItem(stampKey(key), String(now())); } catch (_) {} };
  const isFresh = key => now() - getStamp(key) < (CONFIG[key]?.ttl || 0);

  const renderTimers = new Map();
  function debounceRender(name, fn, wait=80) {
    clearTimeout(renderTimers.get(name));
    renderTimers.set(name, setTimeout(() => {
      renderTimers.delete(name);
      try { fn?.(); } catch (err) { console.warn('[V26.5 render]', name, err?.message || err); }
    }, wait));
  }

  function rebuildIndexes(target) {
    try {
      if (typeof W.thiaRebuildIndexesV23 === 'function') W.thiaRebuildIndexesV23(target);
    } catch (_) {}
  }

  function renderKey(key) {
    const active = activeKey();
    if (key === 'os') {
      if (active === 'dashboard') debounceRender('dashboard', W.renderDashboard);
      if (active === 'kanban') debounceRender('kanban', W.renderKanban);
      if (active === 'clientes') { debounceRender('clientes', W.renderClientes); debounceRender('veiculos', W.renderVeiculos); }
      if (active === 'equipe' || active === 'financeiro') debounceRender('comissoes', W.calcComissoes);
    } else if (key === 'clientes') {
      if (active === 'clientes') debounceRender('clientes', W.renderClientes);
      if (active === 'agenda' || active === 'kanban' || modalOpen('modalOS') || modalOpen('modalVeiculo')) debounceRender('selects', W.popularSelects);
    } else if (key === 'veiculos') {
      if (active === 'clientes') { debounceRender('veiculos', W.renderVeiculos); debounceRender('clientes', W.renderClientes); }
      if (active === 'kanban') debounceRender('kanban', W.renderKanban);
      if (active === 'agenda' || modalOpen('modalOS') || modalOpen('modalVeiculo')) debounceRender('selects', W.popularSelects);
    } else if (key === 'estoque') {
      if (active === 'estoque') debounceRender('estoque', W.renderEstoque);
      if (active === 'vendas') debounceRender('vendas', W.renderVendasAutopecas);
      if (active === 'dashboard') debounceRender('dashboard', W.renderDashboard);
    } else if (key === 'financeiro') {
      if (active === 'financeiro') debounceRender('financeiro', W.renderFinanceiro);
      if (active === 'equipe' || active === 'financeiro') debounceRender('comissoes', W.calcComissoes);
      if (active === 'dashboard') debounceRender('dashboard', W.renderDashboard);
    } else if (key === 'equipe') {
      if (active === 'equipe') debounceRender('equipe', W.renderEquipe);
      if (active === 'equipe' || active === 'financeiro') debounceRender('comissoes', W.calcComissoes);
      if (modalOpen('modalOS') || active === 'agenda' || active === 'vendas') debounceRender('selects', W.popularSelects);
      if (active === 'chatequipe') debounceRender('chatEquipeLista', W.renderChatEquipeLista);
    } else if (key === 'fornecedores') {
      if (active === 'estoque' || active === 'financeiro') debounceRender('fornecedores', W.renderFornecedores);
      if (modalOpen('modalNF') || modalOpen('modalFin')) debounceRender('selects', W.popularSelects);
      updateSupplierStatus();
    } else if (key === 'vendas') {
      if (active === 'vendas' || active === 'estoque') debounceRender('vendas', W.renderVendasAutopecas);
      if (active === 'estoque') debounceRender('docsFiscais', W.renderDocsFiscaisHardening);
    } else if (key === 'auditoria') {
      if (active === 'auditoria') debounceRender('auditoria', W.renderAuditoria);
    } else if (['notasFiscaisEntrada','nfItensVinculos','estoqueMovimentos'].includes(key)) {
      if (active === 'estoque') debounceRender('docsFiscais', W.renderDocsFiscaisHardening, 120);
    } else if (key === 'pacotesBoletos') {
      if (active === 'financeiro') debounceRender('pacotesBoletos', W.renderPacotesBoletosHardening, 120);
    }
  }

  function applyDocs(key, docs, source='server') {
    const cfg = CONFIG[key];
    if (!cfg) return [];
    let list = (docs || []).map(d => d && typeof d.data === 'function' ? ({ id:d.id, ...d.data() }) : d).filter(Boolean);
    if (key === 'os' && W.thiaRuntimeCore?.dedupeOSForDisplay) list = W.thiaRuntimeCore.dedupeOSForDisplay(list);
    else if (W.thiaRuntimeCore?.dedupeById) list = W.thiaRuntimeCore.dedupeById(list);
    if (typeof cfg.sort === 'function') list.sort(cfg.sort);
    const st = stateOf(key);
    const signature = W.thiaRuntimeCore?.listSignature
      ? W.thiaRuntimeCore.listSignature(list)
      : list.map(item => `${item?.id || ''}|${item?.updatedAt || item?.createdAt || item?.ts || ''}|${item?.status || ''}`).join('||');
    const changed = source === 'local-write' || st.signature !== signature;
    J()[cfg.target] = list;
    st.loaded = true;
    st.lastSource = source;
    st.lastCount = list.length;
    st.signature = signature;
    if (changed) {
      rebuildIndexes(cfg.target);
      renderKey(key);
    }
    updateSyncBadge();
    return list;
  }

  function queryFor(key) {
    const cfg = CONFIG[key];
    const database = db();
    const tid = String(J().tid || '').trim();
    if (!cfg || !database || !tid) return null;
    return database.collection(cfg.collection).where('tenantId', '==', tid);
  }

  async function readCache(key) {
    const q = queryFor(key);
    if (!q) return [];
    try {
      metric(key, 'cache-request');
      const snap = await q.get({ source:'cache' });
      metric(key, 'cache-result', snap);
      if (!snap.empty || !(J()[CONFIG[key].target] || []).length) applyDocs(key, snap.docs, 'cache');
      return snap.docs;
    } catch (_) { return []; }
  }

  async function readServer(key, force=false) {
    const q = queryFor(key);
    if (!q) return [];
    const st = stateOf(key);
    if (!force && isFresh(key) && st.loaded) return J()[CONFIG[key].target] || [];
    metric(key, 'server-request');
    const snap = await q.get({ source:'server' });
    metric(key, 'server-result', snap);
    setStamp(key);
    return applyDocs(key, snap.docs, 'server');
  }

  async function loadOnce(key, opts={}) {
    const cfg = CONFIG[key];
    if (!cfg) return [];
    const st = stateOf(key);
    if (st.loading && !opts.force) return st.loading;
    st.loading = (async () => {
      const existing = J()[cfg.target] || [];
      if (!st.loaded || !existing.length) await readCache(key);
      if (opts.force || !isFresh(key) || !(J()[cfg.target] || []).length) {
        try { await readServer(key, !!opts.force); }
        catch (err) {
          console.warn('[V26.5 Firestore]', cfg.collection, err?.code || '', err?.message || err);
          showSyncError(key, err);
        }
      }
      return J()[cfg.target] || [];
    })().finally(() => { st.loading = null; });
    return st.loading;
  }

  async function ensureLiveKey(key, force=false) {
    const cfg = CONFIG[key];
    if (!cfg) return [];
    const st = stateOf(key);
    if (st.liveUnsub && !force) return J()[cfg.target] || [];
    if (force && st.liveUnsub) { try { st.liveUnsub(); } catch (_) {} st.liveUnsub = null; }

    // Clientes e veículos são dados operacionais compartilhados entre PCs/celulares.
    // O cache serve apenas para primeira pintura; a fonte de verdade permanece o onSnapshot.
    if (!st.loaded || !(J()[cfg.target] || []).length) await readCache(key);
    const q = queryFor(key);
    if (!q) return J()[cfg.target] || [];

    return new Promise(resolve => {
      let first = true;
      metric(key, 'listen-open');
      const onData = snap => {
        metric(key, 'listen-event', snap);
        const fromCache = !!snap.metadata?.fromCache;
        applyDocs(key, snap.docs, fromCache ? 'cache-live' : 'server-live');
        if (!fromCache) setStamp(key);
        if (first) { first = false; resolve(J()[cfg.target] || []); }
      };
      const onError = err => {
        console.warn('[V26.5 ' + cfg.collection + ' live]', err?.code || '', err?.message || err);
        st.liveUnsub = null;
        showSyncError(key, err);
        if (first) { first = false; resolve(J()[cfg.target] || []); }
      };
      if (W.ThiaFirestoreV2612?.listen) {
        st.liveUnsub = W.ThiaFirestoreV2612.listen('jarvis:' + key, q, {
          includeMetadataChanges: true,
          apply: onData,
          error: onError
        });
      } else {
        st.liveUnsub = q.onSnapshot({ includeMetadataChanges:true }, onData, onError);
      }
    });
  }

  async function ensureOS(force=false) {
    const key = 'os';
    const cfg = CONFIG[key];
    const st = stateOf(key);
    clearTimeout(st.stopTimer); st.stopTimer = null;
    if (st.liveUnsub && !force) return J().os || [];
    if (force && st.liveUnsub) { try { st.liveUnsub(); } catch (_) {} st.liveUnsub = null; }

    if (!st.loaded || !(J().os || []).length) await readCache(key);
    if (!force && isFresh(key) && (J().os || []).length) {
      scheduleOSWake();
      return J().os || [];
    }

    const q = queryFor(key);
    if (!q) return [];
    return new Promise(resolve => {
      let first = true;
      metric(key, 'listen-open');
      const onData = snap => {
        metric(key, 'listen-event', snap);
        const fromCache = !!snap.metadata?.fromCache;
        applyDocs(key, snap.docs, fromCache ? 'cache-live' : 'server-live');
        if (!fromCache) setStamp(key);
        if (first) { first = false; resolve(J().os || []); }
      };
      const onError = err => {
        console.warn('[V26.5 O.S. live]', err?.code || '', err?.message || err);
        st.liveUnsub = null;
        showSyncError(key, err);
        if (first) { first = false; resolve(J().os || []); }
      };
      if (W.ThiaFirestoreV2612?.listen) {
        st.liveUnsub = W.ThiaFirestoreV2612.listen('jarvis:os', q, {
          includeMetadataChanges: true,
          apply: onData,
          error: onError
        });
      } else {
        st.liveUnsub = q.onSnapshot({ includeMetadataChanges:true }, onData, onError);
      }
    });
  }

  function scheduleOSWake() {
    const st = stateOf('os');
    clearTimeout(st.wakeTimer);
    const remaining = Math.max(15000, CONFIG.os.ttl - (now() - getStamp('os')));
    st.wakeTimer = setTimeout(() => {
      if (!D.hidden && sectionNeedsOS(activeKey())) ensureOS(false);
    }, remaining);
  }

  function stopOSLater(delay=60000) {
    const st = stateOf('os');
    clearTimeout(st.stopTimer);
    st.stopTimer = setTimeout(() => {
      if (sectionNeedsOS(activeKey()) && !D.hidden) return;
      if (typeof st.liveUnsub === 'function') { try { st.liveUnsub(); } catch (_) {} }
      st.liveUnsub = null;
      updateSyncBadge();
    }, delay);
  }

  function activeKey() {
    const id = D.querySelector('.section.active')?.id || '';
    const map = {'s-dashboard':'dashboard','s-agenda':'agenda','s-kanban':'kanban','s-clientes':'clientes','s-estoque':'estoque','s-vendas':'vendas','s-financeiro':'financeiro','s-equipe':'equipe','s-chat':'chat','s-chatequipe':'chatequipe','s-ia':'ia','s-tabelatempa':'tabelatempa','s-auditoria':'auditoria','s-oficina':'oficina'};
    return map[id] || 'dashboard';
  }
  const modalOpen = id => byId(id)?.classList.contains('open');
  const sectionNeedsOS = key => ['dashboard','kanban','clientes','financeiro','equipe'].includes(key) || modalOpen('modalOS');

  let fiscalRequested = false;
  async function loadFiscal(force=false) {
    fiscalRequested = true;
    return Promise.all(['notasFiscaisEntrada','nfItensVinculos','estoqueMovimentos'].map(k => loadOnce(k,{force})));
  }

  const SECTION_KEYS = {
    dashboard:['os'],
    agenda:['clientes','veiculos','equipe'],
    kanban:['os','clientes','veiculos'],
    clientes:['clientes','veiculos','os'],
    estoque:['estoque','fornecedores'],
    vendas:['estoque','equipe','vendas'],
    financeiro:['financeiro','equipe','fornecedores','os','pacotesBoletos'],
    equipe:['equipe','financeiro','os'],
    chat:[],
    chatequipe:['equipe'],
    ia:[],
    osModal:['clientes','veiculos','estoque','financeiro','equipe','fornecedores'],
    tabelatempa:[],
    auditoria:['auditoria'],
    oficina:[]
  };

  async function ensureKey(key, opts={}) {
    if (key === 'os') return ensureOS(!!opts.force);
    if (key === 'clientes' || key === 'veiculos') return ensureLiveKey(key, !!opts.force);
    if (key === 'fiscal') return loadFiscal(!!opts.force);
    if (CONFIG[key]) return loadOnce(key, opts);
    // Coleções pequenas e chats continuam usando suas rotinas originais, abertas somente na tela correspondente.
    if (key === 'agendamentos') return W.escutarAgendamentos?.();
    if (key === 'mensagens') return W.escutarMensagens?.();
    if (key === 'chatequipe') return W.escutarChatEquipe?.();
    return [];
  }

  W.thiaEnsureDataFor = function (key, opts={}) {
    const active = activeKey();
    // Bloqueia os timers antigos de 3s/6s que tentavam consultar estoque e financeiro no dashboard.
    if ((key === 'estoque' || key === 'financeiro') && active !== key && !opts.force) return Promise.resolve([]);
    const keys = SECTION_KEYS[key] || [];
    const jobs = keys.map(k => ensureKey(k, opts));
    // No dashboard, reaproveita SOMENTE o cache local de estoque/financeiro para preservar os indicadores
    // sem gerar leituras no servidor. A atualização real ocorre ao abrir o módulo ou tocar em sincronizar.
    if (key === 'dashboard' && !opts.force) {
      jobs.push(readCache('estoque'));
      jobs.push(readCache('financeiro'));
    } else if (key === 'dashboard' && opts.force) {
      jobs.push(ensureKey('estoque', { force:true }));
      jobs.push(ensureKey('financeiro', { force:true }));
    }
    if (!sectionNeedsOS(active)) stopOSLater(); else clearTimeout(stateOf('os').stopTimer);
    return Promise.all(jobs);
  };

  // Sobrescreve somente as entradas de dados volumosas. O restante do sistema continua chamando os mesmos nomes.
  W.escutarOS = () => ensureOS(false);
  W.escutarClientes = () => ensureLiveKey('clientes', false);
  W.escutarVeiculos = () => ensureLiveKey('veiculos', false);
  W.escutarEstoque = () => loadOnce('estoque');
  W.escutarFinanceiro = () => loadOnce('financeiro');
  W.escutarEquipe = () => loadOnce('equipe');
  W.escutarFornecedores = () => loadOnce('fornecedores');
  W.escutarVendasAutopecas = () => loadOnce('vendas');
  W.escutarAuditoria = () => loadOnce('auditoria');
  W.recarregarFornecedoresV264 = () => loadOnce('fornecedores', { force:true });

  function questionKeys(question) {
    const raw = String(question || '');
    const q = norm(raw);
    try { if (W.thiaPareceConsultaCatalogo?.(raw)) return []; } catch (_) {}
    if (/finance|dre|caixa|receita|despesa|conta|vencid|comiss|salario|pagamento/.test(q)) return ['financeiro','equipe','os'];
    if (/nota fiscal|\bnf\b/.test(q)) return ['fornecedores','fiscal'];
    if (/estoque|reposi|saldo|quantidade|fornecedor/.test(q)) return ['estoque','fornecedores'];
    if (/atendimento|mecanic|historico|placa|veiculo|cliente|ordem de servico|\bos\b|servico realizado|peca instalada/.test(q)) return ['os','clientes','veiculos','equipe'];
    return ['os'];
  }

  function wrapIA() {
    const original = W.thiaResponderLocalAsync;
    if (typeof original !== 'function' || original.__thiaEconomyV265) return;
    const wrapped = async function (question, opts) {
      const keys = questionKeys(question);
      if (keys.length) await Promise.all(keys.map(k => ensureKey(k)));
      return original.apply(this, arguments);
    };
    wrapped.__thiaEconomyV265 = true;
    wrapped.__original = original;
    W.thiaResponderLocalAsync = wrapped;
  }

  // Atualiza os arrays em memória após gravações feitas nesta aba, evitando uma releitura completa.
  function plainPatch(args) {
    if (!args?.length) return {};
    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) return args[0];
    const out = {};
    for (let i=0;i<args.length;i+=2) if (typeof args[i] === 'string') out[args[i]] = args[i+1];
    return out;
  }
  function localMutation(collection, id, mode, payload) {
    const key = COLLECTION_TO_KEY[collection];
    const cfg = CONFIG[key];
    const st = key ? stateOf(key) : null;
    if (!cfg || !st?.loaded) return;
    const arr = Array.isArray(J()[cfg.target]) ? [...J()[cfg.target]] : [];
    const idx = arr.findIndex(x => String(x.id) === String(id));
    if (mode === 'delete') {
      if (idx >= 0) arr.splice(idx,1);
    } else {
      const current = idx >= 0 ? arr[idx] : { id };
      const next = { ...current, ...(payload || {}), id };
      if (idx >= 0) arr[idx] = next; else arr.push(next);
    }
    applyDocs(key, arr, 'local-write');
  }

  function patchDocRef(ref, collection, id) {
    if (!ref || ref.__thiaV265Patched) return ref;
    try { Object.defineProperty(ref,'__thiaV265Patched',{value:true}); } catch (_) { return ref; }
    if (typeof ref.set === 'function') {
      const original = ref.set.bind(ref);
      ref.set = async function (data, options) { const r = await original(data, options); localMutation(collection,id,'set',data); return r; };
    }
    if (typeof ref.update === 'function') {
      const original = ref.update.bind(ref);
      ref.update = async function () { const args = Array.from(arguments); const r = await original(...args); localMutation(collection,id,'update',plainPatch(args)); return r; };
    }
    if (typeof ref.delete === 'function') {
      const original = ref.delete.bind(ref);
      ref.delete = async function () { const r = await original(); localMutation(collection,id,'delete'); return r; };
    }
    return ref;
  }

  function patchWrites() {
    const database = db();
    if (!database || database.__thiaV265Writes) return;
    try {
      const originalCollection = database.collection.bind(database);
      database.collection = function (name) {
        const ref = originalCollection(name);
        if (!ref || ref.__thiaV265Patched) return ref;
        try { Object.defineProperty(ref,'__thiaV265Patched',{value:true}); } catch (_) { return ref; }
        if (typeof ref.doc === 'function') {
          const originalDoc = ref.doc.bind(ref);
          ref.doc = function (id) { return patchDocRef(originalDoc(id), name, id); };
        }
        if (typeof ref.add === 'function') {
          const originalAdd = ref.add.bind(ref);
          ref.add = async function (data) { const doc = await originalAdd(data); localMutation(name,doc.id,'add',data); return patchDocRef(doc,name,doc.id); };
        }
        return ref;
      };

      if (typeof database.batch === 'function') {
        const originalBatch = database.batch.bind(database);
        database.batch = function () {
          const batch = originalBatch();
          const ops = [];
          const wrap = method => {
            if (typeof batch[method] !== 'function') return;
            const original = batch[method].bind(batch);
            batch[method] = function (docRef) {
              const args = Array.from(arguments).slice(1);
              const collection = docRef?.parent?.id || '';
              const id = docRef?.id || '';
              const payload = method === 'delete' ? null : plainPatch(args);
              ops.push({ collection, id, mode:method, payload });
              original(docRef, ...args);
              return batch;
            };
          };
          ['set','update','delete'].forEach(wrap);
          if (typeof batch.commit === 'function') {
            const originalCommit = batch.commit.bind(batch);
            batch.commit = async function () { const r = await originalCommit(); ops.forEach(op => localMutation(op.collection,op.id,op.mode,op.payload)); return r; };
          }
          return batch;
        };
      }
      database.__thiaV265Writes = true;
    } catch (err) { console.warn('[V26.5 write cache]', err?.message || err); }
  }

  function keysForCurrent() {
    return (SECTION_KEYS[activeKey()] || []).filter(k => k !== 'fiscal');
  }
  W.thiaSincronizarTelaV265 = async function () {
    const key = activeKey();
    const keys = SECTION_KEYS[key] || [];
    setSyncText('SINCRONIZANDO…');
    try {
      await Promise.all(keys.map(k => ensureKey(k,{force:true})));
      if (key === 'estoque' && fiscalRequested) await loadFiscal(true);
      setSyncText('SINCRONIZADO');
      W.toast?.('✓ Dados desta tela atualizados', 'ok');
    } catch (err) {
      setSyncText('ERRO DE SYNC');
      W.toast?.('Não foi possível atualizar: ' + (err?.message || err), 'err');
    }
  };

  function syncBadge() { return D.querySelector('.topbar-badge'); }
  function setSyncText(text) {
    const el = syncBadge(); if (!el) return;
    const dot = el.querySelector('.live-dot');
    el.innerHTML = ''; if (dot) el.appendChild(dot); else { const d=D.createElement('div'); d.className='live-dot'; el.appendChild(d); }
    el.appendChild(D.createTextNode(' ' + text));
  }
  function updateSyncBadge() {
    const osLive = !!stateOf('os').liveUnsub;
    setSyncText(osLive ? 'NUVEM AO VIVO' : 'MODO ECONÔMICO');
  }
  function installSyncButton() {
    const el = syncBadge(); if (!el || el.dataset.v265) return;
    el.dataset.v265 = '1';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.title = 'Toque para atualizar somente os dados da tela atual';
    el.onclick = () => W.thiaSincronizarTelaV265();
    updateSyncBadge();
  }

  function updateSupplierStatus() {
    const box = byId('fornecSyncV264');
    if (!box) return;
    const list = J().fornecedores || [];
    const st = stateOf('fornecedores');
    box.style.display = 'block';
    box.style.whiteSpace = 'normal';
    if (list.length) {
      box.style.color = 'var(--success)';
      box.textContent = `${list.length} fornecedor(es) carregado(s) em modo econômico (${st.lastSource || 'memória'}). Use ↻ RECARREGAR apenas quando precisar buscar alterações externas.`;
      setTimeout(()=>{ if (box.textContent.includes('modo econômico')) box.style.display='none'; },2200);
    } else if (st.loaded) {
      box.style.color = 'var(--warn)';
      box.innerHTML = 'Nenhum fornecedor encontrado para este tenant. <button type="button" class="btn-ghost" onclick="window.recarregarFornecedoresV264()">↻ CONSULTAR SERVIDOR</button>';
    }
  }

  function showSyncError(key, err) {
    const code = String(err?.code || '');
    if (key === 'fornecedores') updateSupplierStatus();
    if (/resource-exhausted/i.test(code)) W.toast?.('Limite do Firestore atingido. Mantive os dados que já estavam em cache.', 'warn');
  }

  function installWriteRefreshWrappers() {
    const map = {
      salvarCliente:['clientes'], excluirClienteDef:['clientes'],
      salvarVeiculo:['veiculos'], excluirVeiculoDef:['veiculos'],
      salvarPeca:['estoque'], excluirPecaDef:['estoque'],
      salvarFin:['financeiro'], toggleStatusFin:['financeiro'], excluirFinanceiroDef:['financeiro'], salvarPgtoRH:['financeiro'],
      salvarFunc:['equipe'], excluirFuncionarioDef:['equipe'],
      salvarFornec:['fornecedores'], deletarFornec:['fornecedores'], excluirFornecedorDef:['fornecedores'],
      salvarOS:['os','estoque','financeiro'], salvarOSContinuar:['os','estoque','financeiro'], excluirOSDef:['os','estoque','financeiro'], salvarExecucaoAprovadosOS:['os','estoque'],
      salvarNF:['estoque','financeiro','fornecedores','notasFiscaisEntrada','nfItensVinculos','estoqueMovimentos'], excluirNFDef:['estoque','financeiro','notasFiscaisEntrada','nfItensVinculos','estoqueMovimentos'],
      salvarVendaPeca:['vendas','estoque','financeiro']
    };
    Object.entries(map).forEach(([name,keys]) => {
      const install = original => function () {
        const out = original.apply(this, arguments);
        const refresh = () => {
          keys.forEach(key => {
            const st = stateOf(key);
            if (key === 'os' && st.liveUnsub) return;
            if (st.loaded) renderKey(key);
          });
        };
        if (W.thiaRuntimeCore?.afterSettled) W.thiaRuntimeCore.afterSettled('refresh:' + name, out, refresh, 80);
        else Promise.resolve(out).finally(() => setTimeout(refresh, 80)).catch(() => {});
        return out;
      };
      if (W.thiaRuntimeCore?.wrapOnce) {
        W.thiaRuntimeCore.wrapOnce(name, 'economy-refresh-v265', install);
      } else {
        const fn = W[name];
        if (typeof fn !== 'function' || fn.__thiaEconomyRefreshV265) return;
        const wrapped = install(fn);
        wrapped.__thiaEconomyRefreshV265 = true;
        wrapped.__original = fn;
        W[name] = wrapped;
      }
    });
  }

  function installNavigationHooks() {
    if (typeof W.ir === 'function' && !W.ir.__thiaEconomyV265) {
      const original = W.ir;
      const wrapped = function () {
        const out = original.apply(this, arguments);
        setTimeout(() => {
          const key = activeKey();
          W.thiaEnsureDataFor?.(key);
          if (!sectionNeedsOS(key)) stopOSLater();
          else clearTimeout(stateOf('os').stopTimer);
        },0);
        return out;
      };
      wrapped.__thiaEconomyV265 = true; wrapped.__original = original; W.ir = wrapped;
    }
    if (typeof W.abrirModal === 'function' && !W.abrirModal.__thiaEconomyV265) {
      const original = W.abrirModal;
      const wrapped = function (id) {
        if (id === 'modalOS') W.thiaEnsureDataFor?.('osModal');
        else if (id === 'modalCliente') Promise.all([ensureKey('clientes'),ensureKey('veiculos')]);
        else if (id === 'modalVeiculo') Promise.all([ensureKey('clientes'),ensureKey('veiculos')]);
        else if (id === 'modalPeca' || id === 'modalNF') Promise.all([ensureKey('estoque'),ensureKey('fornecedores')]);
        else if (id === 'modalFin') ensureKey('financeiro');
        else if (id === 'modalFunc') ensureKey('equipe');
        else if (/fornec/i.test(id)) ensureKey('fornecedores');
        return original.apply(this, arguments);
      };
      wrapped.__thiaEconomyV265 = true; wrapped.__original = original; W.abrirModal = wrapped;
    }
  }

  D.addEventListener('visibilitychange', () => {
    if (D.hidden) stopOSLater(45000);
    else {
      if (sectionNeedsOS(activeKey())) ensureOS(false);
      W.thiaEnsureDataFor?.(activeKey());
    }
  });

  function install() {
    if (D.documentElement.dataset.thiaFirestoreEconomyInstalled === VERSION) return;
    patchWrites();
    installNavigationHooks();
    installWriteRefreshWrappers();
    installSyncButton();
    wrapIA();
    W.thiaEnsureDataFor?.(activeKey());
    D.documentElement.dataset.thiaFirestoreMode = 'economico-v265';
    D.documentElement.dataset.thiaFirestoreEconomyInstalled = VERSION;
    W.thiaLoadFiscalV2612 = loadFiscal;
    W.thiaEnsureKeyV2612 = ensureKey;
    W.thiaFirestoreEconomyStateV2612 = { states, CONFIG, get fiscalRequested(){ return fiscalRequested; } };
    console.info('[OFICIN-IA] Firestore econômico V' + VERSION + ' ativo');
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})(window, document);
