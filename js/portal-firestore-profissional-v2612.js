/**
 * OFICIN-IA V26.12 — Portais de cliente com consultas específicas.
 * Preserva histórico e fluxo; elimina listeners de O.S./financeiro de toda a oficina.
 */
(function (W, D) {
  'use strict';
  if (W.__PORTAL_FIRESTORE_PRO_V2612__) return;
  W.__PORTAL_FIRESTORE_PRO_V2612__ = true;

  const VERSION = '26.12.0';
  const RT = () => W.ThiaFirestoreV2612;
  const num = value => Number(value || 0) || 0;
  const plate = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const unsubs = new Map();

  function stopAll() {
    for (const [key, unsub] of unsubs) {
      try { if (typeof unsub === 'function') unsub(); } catch (_) {}
      RT()?.stop?.(key);
    }
    unsubs.clear();
  }

  function keep(key, unsub) {
    const old = unsubs.get(key);
    if (typeof old === 'function') { try { old(); } catch (_) {} }
    unsubs.set(key, unsub);
    return unsub;
  }

  function listen(key, primary, fallback, apply) {
    if (!primary || !RT()) return;
    return keep(key, RT().listen(key, primary, {
      apply,
      fallback: () => fallback,
      error: err => console.warn('[Portal V26.12 ' + key + ']', err?.message || err)
    }));
  }

  async function cachedLegacyFinance(database, tenantId, filter) {
    if (!database || !tenantId) return [];
    try {
      const snap = await database.collection('financeiro').where('tenantId', '==', tenantId).get({ source:'cache' });
      return RT().docs(snap).filter(filter);
    } catch (_) { return []; }
  }

  async function financeByOS(key, database, tenantId, osList, clienteId, filter) {
    if (!database || !tenantId || !RT()) return [];
    const ids = Array.from(new Set((osList || []).map(o => String(o.id || '')).filter(Boolean)));
    const jobs = RT().chunks(ids, 10).map((chunk, index) => {
      const q = database.collection('financeiro').where('tenantId', '==', tenantId).where('osId', 'in', chunk);
      return RT().once(`${key}:os:${index}`, q, { ttl:60*60*1000, cacheFirst:true });
    });
    const snaps = await Promise.all(jobs);
    const byOs = RT().mergeLists(...snaps.filter(Boolean).map(snap => RT().docs(snap)));
    const cacheLegacy = await cachedLegacyFinance(database, tenantId, filter);
    return RT().mergeLists(byOs, cacheLegacy).filter(filter);
  }

  function installPortalComum() {
    if (typeof W._iniciarPortalListeners !== 'function' || typeof W._renderPortalOS !== 'function') return false;
    const original = W._iniciarPortalListeners;
    if (original.__thiaProV2612) return true;

    W._iniciarPortalListeners = function () {
      stopAll();
      const database = W.db;
      if (!database || typeof P === 'undefined' || !P?.tenantId) return original.apply(this, arguments);

      const tenantId = P.tenantId;
      const clienteId = P.clienteId;
      const pin = D.getElementById('pPin')?.value?.trim() || '';
      const loginRaw = D.getElementById('pLogin')?.value?.trim() || '';
      const loginPlate = plate(loginRaw);
      const registered = !!clienteId && clienteId !== 'avulso';
      let osList = [];
      let primaryFin = [];
      let legacyFin = [];

      const renderFinance = () => {
        const merged = RT().mergeLists(primaryFin, legacyFin).filter(f => {
          if (f.tipo === 'Saída' || f.tipo === 'Saida' || f.isComissao) return false;
          if (f.vinculo && (String(f.vinculo).startsWith('F_') || String(f.vinculo).startsWith('E_'))) return false;
          return true;
        }).sort((a, b) => String(b.venc || b.data || '').localeCompare(String(a.venc || a.data || '')));
        P.financeiro = merged;
        W._renderFinanceiro?.(merged);
        if (W._osDoCliente) W._renderPortalOS?.(W._osDoCliente);
      };

      const afterOS = list => {
        osList = list;
        W._osDoCliente = list;
        try { _osDoCliente = list; } catch (_) {}
        W._renderPortalOS?.(list);
        if (!registered) return;
        const osIds = new Set(list.map(o => String(o.id || '')).filter(Boolean));
        const plates = new Set(list.map(o => plate(o.placa)).filter(Boolean));
        const legacyFilter = f => {
          if (f.clienteId && String(f.clienteId) === String(clienteId)) return true;
          if (f.osId && osIds.has(String(f.osId))) return true;
          const p = plate(f.placa);
          if (p && plates.has(p)) return true;
          const desc = String(f.desc || f.descricao || '').toUpperCase();
          for (const placa of plates) if (placa && desc.replace(/[^A-Z0-9]/g, '').includes(placa)) return true;
          return false;
        };
        financeByOS('portal:financeiro-legado:' + tenantId + ':' + clienteId, database, tenantId, list, clienteId, legacyFilter)
          .then(listLegacy => { legacyFin = listLegacy; renderFinance(); });
      };

      if (registered) {
        const qVeic = database.collection('veiculos').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
        listen('portal:veiculos:' + clienteId, qVeic, qVeic, snap => {
          P.veiculos = RT().docs(snap);
          const el = D.getElementById('agdVeiculoCli');
          if (el) el.innerHTML = '<option value="">Selecione o Veículo...</option>' + P.veiculos.map(v => `<option value="${v.id}">${v.placa || ''} - ${v.modelo || ''}</option>`).join('');
          if (osList.length) W._renderPortalOS?.(osList);
        });

        const qOS = database.collection('ordens_servico').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
        listen('portal:os:' + clienteId, qOS, qOS, snap => {
          const list = RT().docs(snap).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
          afterOS(list);
        });

        const qMsg = database.collection('mensagens').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
        listen('portal:mensagens:' + clienteId, qMsg, qMsg, snap => {
          const msgs = RT().docs(snap).sort((a, b) => num(a.ts) - num(b.ts));
          W._renderChat?.(msgs);
        });

        const qFin = database.collection('financeiro').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
        listen('portal:financeiro:' + clienteId, qFin, qFin, snap => {
          primaryFin = RT().docs(snap);
          renderFinance();
        });

        const qAgd = database.collection('agendamentos').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
        listen('portal:agendamentos:' + clienteId, qAgd, qAgd, snap => {
          const list = RT().docs(snap).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
          W._renderAgendamento?.(list);
        });
      } else {
        // Cliente avulso: consulta somente O.S. que corresponde ao PIN/placa usados no login.
        const base = database.collection('ordens_servico').where('tenantId', '==', tenantId);
        const q = pin ? base.where('pin', '==', pin).limit(100) : base.limit(100);
        listen('portal:os-avulso:' + tenantId + ':' + pin, q, q, snap => {
          const list = RT().docs(snap).filter(o => {
            const p = plate(o.placa);
            return (pin && String(o.pin || '') === pin) || (loginPlate && p === loginPlate);
          }).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
          afterOS(list);
        });
        const fin = D.getElementById('renderFinArea');
        if (fin) fin.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Área financeira disponível apenas para clientes cadastrados.</div>';
        const agd = D.getElementById('renderAgdArea');
        if (agd) agd.innerHTML = '';
      }
    };

    W._iniciarPortalListeners.__thiaProV2612 = true;
    W._iniciarPortalListeners.__original = original;

    if (typeof W.portalLogout === 'function' && !W.portalLogout.__thiaProV2612) {
      const logout = W.portalLogout;
      W.portalLogout = function () { stopAll(); return logout.apply(this, arguments); };
      W.portalLogout.__thiaProV2612 = true;
    }
    return true;
  }

  function installPortalOficial() {
    if (typeof W._ligarListeners !== 'function' || typeof W._renderOS !== 'function') return false;
    const original = W._ligarListeners;
    if (original.__thiaProV2612) return true;

    W._ligarListeners = function () {
      stopAll();
      const database = W.db;
      if (!database || typeof TID === 'undefined' || typeof CLI === 'undefined' || !TID || !CLI?.id) return original.apply(this, arguments);
      const tenantId = TID;
      const clienteId = CLI.id;
      let osList = [];
      let primaryFin = [];
      let legacyFin = [];

      const rerender = () => { W._renderStats?.(); W._renderOS?.(); W._renderHist?.(); };
      const applyFinance = () => {
        _FIN = RT().mergeLists(primaryFin, legacyFin).filter(f => !String(f.tipo || '').toLowerCase().startsWith('sa') && !f.isComissao);
        rerender();
      };

      const qVeic = database.collection('veiculos').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
      listen('oficial:veiculos:' + clienteId, qVeic, qVeic, snap => {
        _VEIC = RT().docs(snap);
        W._renderViaturas?.();
        const el = D.getElementById('agdVeiculo');
        if (el) el.innerHTML = '<option value="">Selecione a viatura...</option>' + _VEIC.map(v => `<option value="${v.id}">${String(v.prefixo || v.placa || '').toUpperCase()} — ${v.modelo || ''}</option>`).join('');
      });

      const qOS = database.collection('ordens_servico').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
      listen('oficial:os:' + clienteId, qOS, qOS, snap => {
        _OS = RT().docs(snap).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        osList = _OS;
        rerender();
        if (typeof W.tempaCarregar === 'function') W.tempaCarregar().then(rerender).catch(() => {});
        const osIds = new Set(osList.map(o => String(o.id || '')).filter(Boolean));
        const plates = new Set(osList.map(o => plate(o.placa)).filter(Boolean));
        const legacyFilter = f => {
          if (f.clienteId && String(f.clienteId) === String(clienteId)) return true;
          if (f.osId && osIds.has(String(f.osId))) return true;
          const p = plate(f.placa);
          if (p && plates.has(p)) return true;
          const desc = String(f.desc || f.descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          for (const placa of plates) if (placa && desc.includes(placa)) return true;
          return false;
        };
        financeByOS('oficial:financeiro-legado:' + tenantId + ':' + clienteId, database, tenantId, osList, clienteId, legacyFilter)
          .then(listLegacy => { legacyFin = listLegacy; applyFinance(); });
      });

      const qMsg = database.collection('mensagens').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
      listen('oficial:mensagens:' + clienteId, qMsg, qMsg, snap => {
        const msgs = RT().docs(snap).sort((a, b) => num(a.ts) - num(b.ts));
        W._renderChat?.(msgs);
      });

      const qFin = database.collection('financeiro').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
      listen('oficial:financeiro:' + clienteId, qFin, qFin, snap => { primaryFin = RT().docs(snap); applyFinance(); });

      const qAgd = database.collection('agendamentos').where('tenantId', '==', tenantId).where('clienteId', '==', clienteId);
      listen('oficial:agendamentos:' + clienteId, qAgd, qAgd, snap => {
        const list = RT().docs(snap).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
        W._renderAgd?.(list);
      });
    };

    W._ligarListeners.__thiaProV2612 = true;
    W._ligarListeners.__original = original;
    if (typeof W.sair === 'function' && !W.sair.__thiaProV2612) {
      const sair = W.sair;
      W.sair = function () { stopAll(); return sair.apply(this, arguments); };
      W.sair.__thiaProV2612 = true;
    }
    return true;
  }

  function install() {
    installPortalComum();
    installPortalOficial();
    D.documentElement.dataset.thiaPortalFirestore = 'profissional-v2612';
  }

  install();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  [200,700,1500,3000].forEach(ms => setTimeout(install, ms));
  W.addEventListener('beforeunload', stopAll);
  console.info('[OFICIN-IA] Portais Firestore profissional V' + VERSION + ' ativos');
})(window, document);
