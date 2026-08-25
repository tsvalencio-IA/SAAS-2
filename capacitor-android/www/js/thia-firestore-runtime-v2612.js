/**
 * thIAguinho Firestore Runtime V26.13
 * Camada de leitura econômica e compatível com o banco existente.
 * - Não altera coleções ou regras de negócio.
 * - Evita listeners duplicados na mesma página.
 * - Usa cache IndexedDB/localStorage antes de consultar o servidor.
 * - Mantém fallback para consultas legadas quando um índice ainda não foi publicado.
 * Powered by thIAguinho Soluções Digitais.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_FIRESTORE_RUNTIME_V2612__) return;
  W.__THIA_FIRESTORE_RUNTIME_V2612__ = true;

  const VERSION = '26.13.0';
  const listeners = new Map();
  const inflight = new Map();
  const metrics = W.thiaFirestoreMetricsV2612 = W.thiaFirestoreMetricsV2612 || {
    version: VERSION,
    startedAt: new Date().toISOString(),
    queries: {},
    snapshots: 0,
    documentsDelivered: 0,
    estimatedBillableReads: 0,
    cacheDocumentsDelivered: 0,
    errors: []
  };

  const now = () => Date.now();
  const tid = () => String(W.J?.tid || W.P?.tenantId || W.TID || sessionStorage.getItem('j_tenant_id') || sessionStorage.getItem('govTid') || '').trim();
  const safeJSON = value => {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  };
  const stampKey = key => `thia:v2612:${tid() || 'sem-tenant'}:${key}:serverAt`;
  const readStamp = key => {
    try { return Number(localStorage.getItem(stampKey(key)) || 0); } catch (_) { return 0; }
  };
  const writeStamp = key => {
    try { localStorage.setItem(stampKey(key), String(now())); } catch (_) {}
  };
  const fresh = (key, ttl) => ttl > 0 && now() - readStamp(key) < ttl;

  function count(key, source, snap) {
    const bucket = metrics.queries[key] = metrics.queries[key] || {
      cacheRequests: 0,
      serverRequests: 0,
      listenersOpened: 0,
      listenerEvents: 0,
      listenerCacheEvents: 0,
      listenerServerEvents: 0,
      documentsDelivered: 0,
      cacheDocumentsDelivered: 0,
      estimatedBillableReads: 0,
      lastAt: null,
      lastSource: null
    };
    if (source === 'cache-request') bucket.cacheRequests++;
    if (source === 'server-request') bucket.serverRequests++;
    if (source === 'listen-open') bucket.listenersOpened++;
    if (source === 'listen-cache' || source === 'listen-server') bucket.listenerEvents++;
    if (source === 'listen-cache') bucket.listenerCacheEvents++;
    if (source === 'listen-server') bucket.listenerServerEvents++;

    const size = Number(snap?.size ?? snap?.docs?.length ?? 0) || 0;
    if (source === 'cache-result' || source === 'listen-cache') {
      bucket.cacheDocumentsDelivered += size;
      metrics.cacheDocumentsDelivered += size;
    }
    if (source === 'server-result') {
      bucket.documentsDelivered += size;
      bucket.estimatedBillableReads += size;
      metrics.documentsDelivered += size;
      metrics.estimatedBillableReads += size;
      metrics.snapshots++;
    }
    if (source === 'listen-server') {
      let changes = size;
      try { changes = snap?.docChanges ? snap.docChanges().length : size; } catch (_) {}
      bucket.documentsDelivered += size;
      bucket.estimatedBillableReads += changes;
      metrics.documentsDelivered += size;
      metrics.estimatedBillableReads += changes;
      metrics.snapshots++;
    }
    bucket.lastAt = new Date().toISOString();
    bucket.lastSource = source;
  }

  function recordError(key, err) {
    const item = {
      key,
      code: String(err?.code || ''),
      message: String(err?.message || err || ''),
      at: new Date().toISOString()
    };
    metrics.errors.push(item);
    if (metrics.errors.length > 100) metrics.errors.shift();
    console.warn('[Firestore V26.13]', key, item.code, item.message);
  }

  async function getSource(query, source, key) {
    count(key, source + '-request', null);
    const snap = await query.get({ source });
    count(key, source + '-result', snap);
    return snap;
  }

  async function once(key, query, options) {
    const opts = Object.assign({ ttl: 15 * 60 * 1000, force: false, cacheFirst: true, apply: null, fallback: null }, options || {});
    if (!query) return [];
    if (inflight.has(key) && !opts.force) return inflight.get(key);

    const task = (async () => {
      let cacheSnap = null;
      if (opts.cacheFirst) {
        try {
          cacheSnap = await getSource(query, 'cache', key);
          if (cacheSnap && typeof opts.apply === 'function') opts.apply(cacheSnap, 'cache');
        } catch (_) {}
      }

      if (!opts.force && fresh(key, opts.ttl) && cacheSnap && !cacheSnap.empty) return cacheSnap;

      try {
        const serverSnap = await getSource(query, 'server', key);
        writeStamp(key);
        if (typeof opts.apply === 'function') opts.apply(serverSnap, 'server');
        return serverSnap;
      } catch (err) {
        recordError(key, err);
        if (typeof opts.fallback === 'function') {
          const fallbackQuery = opts.fallback(err);
          if (fallbackQuery) {
            try {
              const fallbackSnap = await getSource(fallbackQuery, 'server', key + ':fallback');
              writeStamp(key);
              if (typeof opts.apply === 'function') opts.apply(fallbackSnap, 'server-fallback');
              return fallbackSnap;
            } catch (fallbackErr) {
              recordError(key + ':fallback', fallbackErr);
            }
          }
        }
        return cacheSnap;
      }
    })().finally(() => inflight.delete(key));

    inflight.set(key, task);
    return task;
  }

  function stop(key) {
    const entry = listeners.get(key);
    if (!entry) return;
    entry.stopped = true;
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    try { entry.unsubscribe?.(); } catch (_) {}
    listeners.delete(key);
  }

  function transientListenerError(err) {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || err || '').toLowerCase();
    return ['unavailable','internal','unknown','deadline-exceeded','resource-exhausted','cancelled'].some(v => code.includes(v)) ||
      /webchannel|transport|network|offline|connection|listen stream/.test(message);
  }

  function listen(key, query, options) {
    const opts = Object.assign({ apply: null, error: null, includeMetadataChanges: true, fallback: null, maxRetries: 6 }, options || {});
    if (!query) return function () {};
    if (listeners.has(key)) return () => stop(key);

    const entry = {
      key,
      query,
      activeQuery: query,
      fallbackUsed: false,
      unsubscribe: null,
      retryTimer: null,
      attempts: 0,
      stopped: false
    };
    listeners.set(key, entry);

    const scheduleRetry = err => {
      if (entry.stopped || !transientListenerError(err) || entry.attempts >= Number(opts.maxRetries || 0)) return false;
      const delay = Math.min(15000, 1000 * Math.pow(2, entry.attempts));
      entry.attempts += 1;
      if (entry.retryTimer) clearTimeout(entry.retryTimer);
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = null;
        if (!entry.stopped) open(entry.activeQuery);
      }, delay);
      return true;
    };

    const open = q => {
      if (entry.stopped) return;
      count(key, 'listen-open', null);
      entry.activeQuery = q;
      try { entry.unsubscribe?.(); } catch (_) {}
      entry.unsubscribe = q.onSnapshot(
        { includeMetadataChanges: !!opts.includeMetadataChanges },
        snap => {
          entry.attempts = 0;
          const fromCache = !!snap.metadata?.fromCache;
          count(key, fromCache ? 'listen-cache' : 'listen-server', snap);
          if (!fromCache) writeStamp(key);
          try { opts.apply?.(snap, fromCache ? 'cache-live' : 'server-live'); }
          catch (err) { recordError(key + ':apply', err); }
        },
        err => {
          recordError(key, err);
          if (!entry.fallbackUsed && typeof opts.fallback === 'function') {
            const q2 = opts.fallback(err);
            if (q2) {
              entry.fallbackUsed = true;
              entry.attempts = 0;
              open(q2);
              return;
            }
          }
          if (scheduleRetry(err)) return;
          try { opts.error?.(err); } catch (_) {}
          stop(key);
        }
      );
    };

    open(query);
    return () => stop(key);
  }

  function docs(snap) {
    return (snap?.docs || []).map(d => ({ id: d.id, ...d.data() }));
  }

  function mergeLists() {
    const map = new Map();
    Array.from(arguments).flat().filter(Boolean).forEach(item => {
      const id = String(item.id || item.docId || '');
      if (!id) return;
      map.set(id, Object.assign({}, map.get(id) || {}, item));
    });
    return Array.from(map.values());
  }

  function chunks(list, size) {
    const out = [];
    const src = Array.from(list || []);
    for (let i = 0; i < src.length; i += size) out.push(src.slice(i, i + size));
    return out;
  }

  function queryIdentity(label, query) {
    return `${label}:${safeJSON(query?._delegate?._query || query?._query || '')}`;
  }

  W.ThiaFirestoreV2612 = {
    version: VERSION,
    once,
    listen,
    stop,
    stopAll() { Array.from(listeners.keys()).forEach(stop); },
    docs,
    mergeLists,
    chunks,
    fresh,
    readStamp,
    writeStamp,
    metrics,
    track(key, source, snap) { count(key, source, snap); },
    queryIdentity,
    tenantId: tid
  };

  W.thiaRelatorioLeiturasV2612 = function () {
    try { return JSON.parse(JSON.stringify(metrics)); } catch (_) { return metrics; }
  };

  W.thiaResetarRelatorioLeiturasV2612 = function () {
    metrics.startedAt = new Date().toISOString();
    metrics.queries = {};
    metrics.snapshots = 0;
    metrics.documentsDelivered = 0;
    metrics.estimatedBillableReads = 0;
    metrics.cacheDocumentsDelivered = 0;
    metrics.errors = [];
    return W.thiaRelatorioLeiturasV2612();
  };
  W.addEventListener('beforeunload', () => W.ThiaFirestoreV2612.stopAll());
  D.documentElement.dataset.thiaFirestoreRuntime = VERSION;
  console.info('[OFICIN-IA] Firestore Runtime V' + VERSION + ' ativo');
})(window, document);
