/**
 * OFICIN-IA V26.13 — Núcleo único de execução e estabilidade do Jarvis
 * - Impede empilhamento de wrappers entre hotfixes.
 * - Centraliza debounce de manutenção de DOM e pós-gravação.
 * - Protege o salvamento da O.S. contra duplo clique.
 * - Evita abertura/renderização duplicada da mesma O.S.
 * - Evita manutenção estrutural enquanto o usuário está digitando no modal da O.S.
 *
 * Não altera regras de negócio, permissões, cálculos financeiros ou documentos.
 * Powered by thIAguinho Soluções Digitais · 2026
 */
(function (W, D) {
  'use strict';

  if (W.thiaRuntimeCore?.version === '26.13.0') return;

  const wrapperRegistry = W.__THIA_WRAPPER_REGISTRY__ = W.__THIA_WRAPPER_REGISTRY__ || Object.create(null);
  const timers = new Map();
  const domRetries = new Map();
  const onceRegistry = W.__THIA_ONCE_REGISTRY__ = W.__THIA_ONCE_REGISTRY__ || Object.create(null);
  const osFingerprintCache = new WeakMap();

  function schedule(key, fn, delay = 0) {
    const id = String(key || 'default');
    clearTimeout(timers.get(id));
    const timer = setTimeout(() => {
      timers.delete(id);
      try { fn?.(); }
      catch (err) { console.warn('[OFICIN-IA Runtime] tarefa ' + id, err?.message || err); }
    }, Math.max(0, Number(delay) || 0));
    timers.set(id, timer);
    return timer;
  }

  function cancelSchedule(key) {
    const id = String(key || 'default');
    clearTimeout(timers.get(id));
    timers.delete(id);
  }

  function runOnce(key, fn) {
    const id = String(key || 'default');
    if (onceRegistry[id]) return onceRegistry[id].value;
    const entry = onceRegistry[id] = { running: true, value: undefined };
    try {
      entry.value = fn?.();
      return entry.value;
    } finally {
      entry.running = false;
    }
  }

  function activeEditor(scope) {
    const active = D.activeElement;
    if (!active || !active.matches?.('input, textarea, select, [contenteditable="true"]')) return null;
    if (!scope) return active;
    const root = typeof scope === 'string' ? D.querySelector(scope) : scope;
    return root?.contains?.(active) ? active : null;
  }

  function scheduleDom(key, fn, options = {}) {
    const id = String(key || 'dom');
    const delay = Math.max(0, Number(options.delay ?? 80) || 0);
    const retryDelay = Math.max(80, Number(options.retryDelay ?? 180) || 180);
    const maxRetries = Math.max(0, Number(options.maxRetries ?? 10) || 0);
    const scope = options.scope === undefined ? '#modalOS' : options.scope;

    schedule('dom:' + id, function attempt() {
      const editing = options.skipWhileEditing !== false && activeEditor(scope);
      const retries = domRetries.get(id) || 0;
      if (editing) {
        if (maxRetries > 0 && retries >= maxRetries) {
          domRetries.delete(id);
          return;
        }
        domRetries.set(id, retries + 1);
        schedule('dom:' + id, attempt, retryDelay);
        return;
      }
      domRetries.delete(id);
      fn?.();
    }, delay);
  }

  function wrapOnce(name, layer, factory) {
    const functionName = String(name || '');
    const layerName = String(layer || 'default');
    if (!functionName || typeof factory !== 'function') return W[functionName];

    const state = wrapperRegistry[functionName] = wrapperRegistry[functionName] || {
      layers: Object.create(null),
      history: []
    };
    if (state.layers[layerName]) return W[functionName];

    const original = W[functionName];
    if (typeof original !== 'function') return original;

    const wrapped = factory(original);
    if (typeof wrapped !== 'function') return original;

    try {
      Object.defineProperty(wrapped, '__thiaRuntimeLayer', { value: layerName, configurable: true });
      Object.defineProperty(wrapped, '__original', { value: original, configurable: true });
    } catch (_) {
      wrapped.__thiaRuntimeLayer = layerName;
      wrapped.__original = original;
    }

    state.layers[layerName] = true;
    state.history.push({ layer: layerName, installedAt: Date.now() });
    W[functionName] = wrapped;
    return wrapped;
  }

  function addEventOnce(target, type, key, handler, options) {
    if (!target?.addEventListener || typeof handler !== 'function') return false;
    const store = target.__thiaEventRegistry = target.__thiaEventRegistry || Object.create(null);
    const id = String(type) + ':' + String(key || 'default');
    if (store[id]) return false;
    target.addEventListener(type, handler, options);
    store[id] = true;
    return true;
  }

  function afterSettled(key, promiseLike, task, delay = 60) {
    Promise.resolve(promiseLike).finally(() => schedule('settled:' + key, task, delay)).catch(() => {});
    return promiseLike;
  }

  function setText(el, value) {
    if (!el) return false;
    const next = String(value ?? '');
    if (el.textContent === next) return false;
    el.textContent = next;
    return true;
  }

  function setHTML(el, value) {
    if (!el) return false;
    const next = String(value ?? '');
    if (el.innerHTML === next) return false;
    el.innerHTML = next;
    return true;
  }

  function setValue(el, value, preserveActive = true) {
    if (!el || (preserveActive && D.activeElement === el)) return false;
    const next = String(value ?? '');
    if (String(el.value ?? '') === next) return false;
    el.value = next;
    return true;
  }

  function dedupeById(list) {
    const map = new Map();
    const anonymous = [];
    Array.from(list || []).filter(Boolean).forEach(item => {
      const id = String(item.id || item.docId || '').trim();
      if (!id) {
        anonymous.push(item);
        return;
      }
      const previous = map.get(id) || {};
      map.set(id, Object.assign({}, previous, item, { id }));
    });
    return Array.from(map.values()).concat(anonymous);
  }


  function stableOSPart(value) {
    if (Array.isArray(value)) return value.map(stableOSPart);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).sort().forEach(key => {
        if (['id','createdAt','updatedAt','ts','timeline','pin','media','fotos'].includes(key)) return;
        const item = value[key];
        if (typeof item !== 'function' && item !== undefined) out[key] = stableOSPart(item);
      });
      return out;
    }
    if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ').toLowerCase();
    if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
    return value ?? null;
  }

  function osDisplayFingerprint(os) {
    const version = [os?.updatedAt || '', os?.status || '', os?.total || 0, os?.totalAprovado || 0, os?.servicos?.length || 0, os?.pecas?.length || 0].join('|');
    if (os && typeof os === 'object') {
      const cached = osFingerprintCache.get(os);
      if (cached?.version === version) return cached.fingerprint;
    }
    const core = {
      tenantId: os?.tenantId || '',
      clienteId: os?.clienteId || os?.cliente || '',
      veiculoId: os?.veiculoId || os?.placa || os?.prefixo || '',
      status: os?.status || '',
      km: os?.km || '',
      prisma: os?.prisma || os?.numeroPrisma || '',
      desc: os?.desc || os?.relato || '',
      total: os?.total || 0,
      totalAprovado: os?.totalAprovado || 0,
      servicos: os?.servicos || [],
      pecas: os?.pecas || [],
      itens: os?.itens || []
    };
    try {
      const fingerprint = JSON.stringify(stableOSPart(core));
      if (os && typeof os === 'object') osFingerprintCache.set(os, { version, fingerprint });
      return fingerprint;
    } catch (_) { return ''; }
  }

  function osCreationTime(os) {
    const raw = os?.createdAt || os?.abertoEm || os?.dataAbertura || '';
    const value = raw?.toDate ? raw.toDate() : raw;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : NaN;
  }

  function dedupeOSForDisplay(list) {
    const source = dedupeById(list).slice().sort((a, b) => {
      const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
      const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
      return tb - ta;
    });
    const kept = [];
    const groups = new Map();
    const hidden = [];
    source.forEach(os => {
      const fingerprint = osDisplayFingerprint(os);
      const time = osCreationTime(os);
      const candidates = fingerprint ? (groups.get(fingerprint) || []) : [];
      const duplicate = candidates.find(item => {
        if (!Number.isFinite(time) || !Number.isFinite(item.time)) return false;
        return Math.abs(time - item.time) <= 15000;
      });
      if (duplicate) {
        hidden.push({ keptId: duplicate.os.id, hiddenId: os.id });
        return;
      }
      kept.push(os);
      if (fingerprint) {
        candidates.push({ os, time });
        groups.set(fingerprint, candidates);
      }
    });
    if (hidden.length) {
      W.__thiaOSDuplicatesForDisplay = hidden;
      console.warn('[OFICIN-IA] O.S. duplicadas ocultadas somente na interface:', hidden);
    } else {
      W.__thiaOSDuplicatesForDisplay = [];
    }
    return kept;
  }

  function listSignature(list) {
    return dedupeById(list).map(item => [
      String(item.id || item.docId || ''),
      String(item.updatedAt || item.createdAt || item.data || item.ts || ''),
      String(item.status || '')
    ].join('|')).join('||');
  }

  function installOpenOSGuard() {
    W.thiaAbrirOS = function (osId, mode = 'edit') {
      const id = String(osId || '').trim();
      const modal = D.getElementById('modalOS');
      const currentId = String(D.getElementById('osId')?.value || '').trim();
      const now = Date.now();
      const token = `${mode}:${id}`;

      if (W.__thiaOpenOSState?.token === token && now - W.__thiaOpenOSState.at < 700) return true;
      if (mode === 'edit' && id && modal?.classList.contains('open') && currentId === id) return true;

      W.__thiaOpenOSState = { token, at: now };
      try {
        if (typeof W.prepOS === 'function') W.prepOS(mode, id || null);
        if (typeof W.abrirModal === 'function') W.abrirModal('modalOS');
        return true;
      } catch (err) {
        console.error('[OFICIN-IA Runtime] abertura O.S.', err);
        W.toast?.('Não foi possível abrir a O.S.: ' + (err?.message || err), 'err');
        return false;
      }
    };
  }

  function installPrepOSGuard() {
    return wrapOnce('prepOS', 'prep-os-reentrancy-v2613', original => function (mode, id) {
      const key = `${String(mode || '')}:${String(id || '')}`;
      const now = Date.now();
      if (W.__thiaPrepOSState?.key === key && now - W.__thiaPrepOSState.at < 350) return W.__thiaPrepOSState.result;
      W.__thiaPrepOSState = { key, at: now, result: undefined };
      const result = original.apply(this, arguments);
      W.__thiaPrepOSState.result = result;
      return result;
    });
  }

  function installSaveGuard() {
    return wrapOnce('salvarOS', 'save-guard-v2613', original => async function () {
      if (W.__thiaSalvarOSPromise) {
        W.toast?.('A O.S. já está sendo salva. Aguarde a conclusão.', 'warn');
        return W.__thiaSalvarOSPromise;
      }

      const buttons = Array.from(D.querySelectorAll(
        '#modalOS button[onclick*="salvarOS"], #modalOS button[onclick*="salvarOSContinuar"], #btnSalvarOS, #btnSalvarOSContinuar'
      ));
      const states = buttons.map(button => ({
        button,
        disabled: !!button.disabled,
        text: button.textContent
      }));
      buttons.forEach(button => {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        if (/salvar/i.test(button.textContent || '')) button.textContent = 'SALVANDO...';
      });

      const execution = Promise.resolve().then(() => original.apply(this, arguments));
      W.__thiaSalvarOSPromise = execution;
      try {
        return await execution;
      } finally {
        W.__thiaSalvarOSPromise = null;
        states.forEach(({ button, disabled, text }) => {
          if (!button?.isConnected) return;
          button.disabled = disabled;
          button.removeAttribute('aria-busy');
          button.textContent = text;
        });
      }
    });
  }

  W.thiaRuntimeCore = {
    version: '26.13.0',
    schedule,
    cancelSchedule,
    runOnce,
    scheduleDom,
    activeEditor,
    wrapOnce,
    addEventOnce,
    afterSettled,
    setText,
    setHTML,
    setValue,
    dedupeById,
    dedupeOSForDisplay,
    listSignature,
    installOpenOSGuard,
    installPrepOSGuard,
    installSaveGuard,
    wrapperRegistry
  };
  W.ThiaRuntimeCoreV2613 = W.thiaRuntimeCore;

  installOpenOSGuard();
})(window, document);
