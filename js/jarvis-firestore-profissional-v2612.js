/**
 * OFICIN-IA V26.13.0 — Hotfix mínimo do inventário responsivo no celular.
 * Preserva coleções, documentos, regras de negócio e funções existentes.
 */
(function (W, D) {
  'use strict';
  if (W.__JARVIS_FIRESTORE_PRO_V2612__) return;
  W.__JARVIS_FIRESTORE_PRO_V2612__ = true;

  const VERSION = '26.13.0';
  const RT = () => W.ThiaFirestoreV2612;
  const db = () => W.db || W.J?.db;
  const J = () => W.J || {};
  const byId = id => D.getElementById(id);
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const num = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let s = String(value ?? '').trim();
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const localUnsubs = new Map();
  const fullClientMessages = new Map();
  let fullTeamMessages = [];
  function stopLocal(key) {
    const u = localUnsubs.get(key);
    if (typeof u === 'function') { try { u(); } catch (_) {} }
    localUnsubs.delete(key);
    RT()?.stop?.(key);
  }

  function limitedListener(key, primaryQuery, fallbackQuery, apply) {
    if (!RT() || !primaryQuery) return;
    if (localUnsubs.has(key)) return localUnsubs.get(key);
    stopLocal(key);
    const unsub = RT().listen(key, primaryQuery, {
      apply,
      fallback: () => fallbackQuery,
      error: err => console.warn('[V26.12 ' + key + ']', err?.message || err)
    });
    localUnsubs.set(key, unsub);
    return unsub;
  }

  function applyMessages(snap) {
    const recent = RT().docs(snap);
    J().mensagens = RT().mergeLists(recent, ...Array.from(fullClientMessages.values())).sort((a, b) => num(a.ts) - num(b.ts));
    W.renderChatLista?.();
    const naoLidas = J().mensagens.filter(m => m.sender === 'cliente' && !m.lidaAdmin).length;
    const badge = byId('chatBadge');
    if (badge) {
      badge.style.display = naoLidas > 0 ? 'block' : 'none';
      badge.textContent = naoLidas > 0 ? String(naoLidas) : '';
    }
    if (J().chatAtivo) W.renderChatMsgs?.(J().chatAtivo);
  }

  function applyTeamMessages(snap) {
    J().chatEquipeMsgs = RT().mergeLists(RT().docs(snap), fullTeamMessages).sort((a, b) => num(a.ts) - num(b.ts));
    W.renderChatEquipeLista?.();
    if (J().chatEquipeAtivo) W.renderChatEquipeMsgs?.(J().chatEquipeAtivo);
  }

  function applyAppointments(snap) {
    J().agendamentos = RT().docs(snap).sort((a, b) => String(b.data || b.createdAt || '').localeCompare(String(a.data || a.createdAt || '')));
    W.renderAgenda?.();
  }

  function applyAudit(snap) {
    J().auditoria = RT().docs(snap).sort((a, b) => String(b.ts || b.createdAt || '').localeCompare(String(a.ts || a.createdAt || '')));
    W.renderAuditoria?.();
  }

  function installLimitedDataFunctions() {
    const database = db();
    if (!database || !J().tid) return false;

    W.escutarMensagens = function () {
      const base = database.collection('mensagens').where('tenantId', '==', J().tid);
      return limitedListener('jarvis:mensagens', base.orderBy('ts', 'desc').limit(500), base.limit(500), applyMessages);
    };

    W.escutarChatEquipe = function () {
      const base = database.collection('chat_equipe').where('tenantId', '==', J().tid);
      return limitedListener('jarvis:chat-equipe', base.orderBy('ts', 'desc').limit(500), base.limit(500), applyTeamMessages);
    };

    W.escutarAgendamentos = function () {
      const base = database.collection('agendamentos').where('tenantId', '==', J().tid);
      return limitedListener('jarvis:agendamentos', base.orderBy('data', 'desc').limit(250), base.limit(250), applyAppointments);
    };

    W.escutarAuditoria = function () {
      const base = database.collection('lixeira_auditoria').where('tenantId', '==', J().tid);
      return limitedListener('jarvis:auditoria', base.orderBy('ts', 'desc').limit(250), base.limit(250), applyAudit);
    };

    return true;
  }


  function installChatHistoryHooks() {
    const database = db();
    if (!database || !RT() || !J().tid) return;

    const oldOpenChat = W.abrirChat;
    if (typeof oldOpenChat === 'function' && !oldOpenChat.__thiaHistoryV2612) {
      const wrapped = function (clienteId, nome) {
        const out = oldOpenChat.apply(this, arguments);
        const cid = String(clienteId || '').trim();
        if (!cid) return out;
        const q = database.collection('mensagens').where('tenantId', '==', J().tid).where('clienteId', '==', cid);
        RT().once('jarvis:mensagens-historico:' + cid, q, {
          ttl: 15 * 60 * 1000, cacheFirst: true,
          apply: snap => {
            fullClientMessages.set(cid, RT().docs(snap));
            J().mensagens = RT().mergeLists(J().mensagens || [], ...Array.from(fullClientMessages.values())).sort((a,b)=>num(a.ts)-num(b.ts));
            if (String(J().chatAtivo || '') === cid) W.renderChatMsgs?.(cid);
          }
        });
        return out;
      };
      wrapped.__thiaHistoryV2612 = true;
      wrapped.__original = oldOpenChat;
      W.abrirChat = wrapped;
    }

    const oldOpenTeam = W.abrirChatEquipe;
    if (typeof oldOpenTeam === 'function' && !oldOpenTeam.__thiaHistoryV2612) {
      const wrapped = function (fid, nome) {
        const out = oldOpenTeam.apply(this, arguments);
        const q = database.collection('chat_equipe').where('tenantId', '==', J().tid);
        RT().once('jarvis:chat-equipe-historico', q, {
          ttl: 30 * 60 * 1000, cacheFirst: true,
          apply: snap => {
            fullTeamMessages = RT().docs(snap);
            J().chatEquipeMsgs = RT().mergeLists(J().chatEquipeMsgs || [], fullTeamMessages).sort((a,b)=>num(a.ts)-num(b.ts));
            if (J().chatEquipeAtivo) { W.renderChatEquipeLista?.(); W.renderChatEquipeMsgs?.(J().chatEquipeAtivo); }
          }
        });
        return out;
      };
      wrapped.__thiaHistoryV2612 = true;
      wrapped.__original = oldOpenTeam;
      W.abrirChatEquipe = wrapped;
    }
  }

  // V26.12 não executa migração automática nem grava campos no banco.
  // A compatibilidade com documentos antigos é resolvida exclusivamente por consultas/fallbacks de leitura.

  function wrapEnsureData() {
    const original = W.thiaEnsureDataFor;
    if (typeof original !== 'function' || original.__thiaProV2612) return;
    const wrapped = function (key, opts) {
      if (key !== 'chat') stopLocal('jarvis:mensagens');
      if (key !== 'chatequipe') stopLocal('jarvis:chat-equipe');
      if (key !== 'agenda') stopLocal('jarvis:agendamentos');
      if (key !== 'auditoria') stopLocal('jarvis:auditoria');
      const result = original.apply(this, arguments);
      if (key === 'chat') {
        Promise.resolve(result).finally(() => {
          W.thiaEnsureKeyV2612?.('clientes');
          W.escutarMensagens?.();
        });
      } else if (key === 'chatequipe') {
        Promise.resolve(result).finally(() => W.escutarChatEquipe?.());
      } else if (key === 'agenda') {
        Promise.resolve(result).finally(() => W.escutarAgendamentos?.());
      } else if (key === 'auditoria') {
        Promise.resolve(result).finally(() => W.escutarAuditoria?.());
      }
      return result;
    };
    wrapped.__thiaProV2612 = true;
    wrapped.__original = original;
    W.thiaEnsureDataFor = wrapped;
  }

  let fiscalDemandTask = null;
  function loadFiscal(reason, force) {
    const fn = W.thiaLoadFiscalV2612;
    if (typeof fn !== 'function') return Promise.resolve([]);
    if (fiscalDemandTask && !force) return fiscalDemandTask;
    D.documentElement.dataset.thiaFiscalLoading = '1';
    fiscalDemandTask = Promise.resolve(fn(!!force)).catch(err => {
      console.warn('[V26.12 fiscal sob demanda]', reason || '', err?.message || err);
      return [];
    }).finally(() => {
      delete D.documentElement.dataset.thiaFiscalLoading;
      W.renderDocsFiscaisHardening?.();
      W.renderFiscalPecasV266?.();
      fiscalDemandTask = null;
    });
    return fiscalDemandTask;
  }
  W.thiaCarregarFiscalSobDemandaV2612 = loadFiscal;

  function installFiscalDemandHooks() {
    if (!W.__JARVIS_FISCAL_DEMAND_HOOKS_V2612__) {
      W.__JARVIS_FISCAL_DEMAND_HOOKS_V2612__ = true;
      D.addEventListener('click', event => {
        if (event.target.closest?.('[data-stock-action="kardex"], .btn-kardex-v269')) return;
        const target = event.target.closest?.('#fiscalPecasCardV268, #docsFiscaisPanel');
        if (!target) return;
        loadFiscal('card-fiscal', false);
      }, true);
    }

    const oldKardex = W.rastrearPecaKardexV269;
    if (typeof oldKardex === 'function' && !oldKardex.__thiaFiscalDemandV2612) {
      const wrapped = async function () {
        await loadFiscal('kardex', false);
        return oldKardex.apply(this, arguments);
      };
      wrapped.__thiaFiscalDemandV2612 = true;
      wrapped.__original = oldKardex;
      W.rastrearPecaKardexV269 = wrapped;
    }
  }

  function injectInventoryCSS() {
    let style = byId('jarvisInventoryFinalV2612CSS');
    if (style) return;
    style = D.createElement('style');
    style.id = 'jarvisInventoryFinalV2612CSS';
    style.textContent = `
      #s-estoque, #s-estoque *{box-sizing:border-box;}
      #s-estoque{container-type:inline-size;}
      #s-estoque .j-auto-card-grid-stock{grid-template-columns:minmax(0,2fr) minmax(300px,1fr)!important;align-items:start!important;min-width:0!important;}
      #s-estoque .thia-inventory-v2612{min-width:0!important;width:100%!important;max-width:100%!important;overflow:hidden!important;}
      #s-estoque .thia-inventory-v2612 .j-card-body{min-width:0!important;max-width:100%!important;overflow:hidden!important;}
      #s-estoque .thia-inventory-v2612 .j-table{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;}
      #s-estoque .thia-inventory-v2612 table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse!important;}
      #s-estoque .thia-inventory-v2612 th,
      #s-estoque .thia-inventory-v2612 td{min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
      #s-estoque .thia-inventory-v2612 th:nth-child(1),#s-estoque .thia-inventory-v2612 td:nth-child(1){width:16%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(2),#s-estoque .thia-inventory-v2612 td:nth-child(2){width:29%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(3),#s-estoque .thia-inventory-v2612 td:nth-child(3){width:11%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(4),#s-estoque .thia-inventory-v2612 td:nth-child(4){width:11%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(5),#s-estoque .thia-inventory-v2612 td:nth-child(5){width:7%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(6),#s-estoque .thia-inventory-v2612 td:nth-child(6){width:7%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(7),#s-estoque .thia-inventory-v2612 td:nth-child(7){width:9%;}
      #s-estoque .thia-inventory-v2612 th:nth-child(8),#s-estoque .thia-inventory-v2612 td:nth-child(8){width:10%;}
      #s-estoque .thia-inventory-v2612 .acoes-estoque-v2610{display:flex!important;flex-wrap:wrap!important;gap:5px!important;min-width:0!important;}
      #s-estoque .thia-inventory-v2612 .acoes-estoque-v2610 button{flex:1 1 72px!important;max-width:100%!important;min-width:0!important;padding:7px 5px!important;}
      #estoqueMobileCardsFix,#estoqueMobileV269{display:none!important;}
      /* A largura útil do estoque é menor que a viewport por causa da sidebar.
         Usa a largura REAL da seção para não esmagar Inventário + Fornecedores em notebooks/zoom. */
      @container (max-width:1320px){#s-estoque .j-auto-card-grid-stock{grid-template-columns:minmax(0,1fr)!important;}}
      @media(max-width:1480px){#s-estoque .j-auto-card-grid-stock{grid-template-columns:minmax(0,1fr)!important;}}
      @media(max-width:760px){
        #s-estoque .j-auto-card-grid-stock{display:block!important;width:100%!important;max-width:100%!important;}
        #s-estoque .thia-inventory-v2612:not(.j-minimized) .j-card-body{display:block!important;width:100%!important;max-width:100%!important;overflow:visible!important;}
        #s-estoque .thia-inventory-v2612 .j-table{display:block!important;width:100%!important;max-width:100%!important;overflow:visible!important;}
        #s-estoque .thia-inventory-v2612 table{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;}
        #s-estoque .thia-inventory-v2612 thead{display:none!important;}
        #s-estoque .j-card.thia-inventory-v2612:not(.j-minimized) .j-card-body > .j-table > #tbEstoque,
        #s-estoque .thia-inventory-v2612 #tbEstoque{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;padding:9px!important;}
        #s-estoque .thia-inventory-v2612 #tbEstoque > tr{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0 0 12px!important;padding:12px!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--surf2)!important;}
        #s-estoque .thia-inventory-v2612 #tbEstoque > tr > td{display:grid!important;grid-template-columns:minmax(96px,34%) minmax(0,1fr)!important;gap:10px!important;width:100%!important;max-width:100%!important;min-width:0!important;padding:7px 0!important;border:0!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;text-align:left!important;}
        #s-estoque .thia-inventory-v2612 #tbEstoque > tr > td::before{content:attr(data-label);font-family:var(--fm);font-size:.58rem;letter-spacing:1px;color:var(--muted);text-transform:uppercase;align-self:start;}
        #s-estoque .thia-inventory-v2612 #tbEstoque > tr > td[data-label="Ações"]{display:block!important;}
        #s-estoque .thia-inventory-v2612 #tbEstoque > tr > td[data-label="Ações"]::before{display:block!important;margin-bottom:6px;}
        #s-estoque .thia-inventory-v2612 .acoes-estoque-v2610{display:grid!important;grid-template-columns:1fr!important;width:100%!important;}
        #s-estoque .thia-inventory-v2612 .acoes-estoque-v2610 button{width:100%!important;min-height:44px!important;}
      }
    `;
    D.head.appendChild(style);
  }

  const labels = ['Ref / Código','Descrição','Custo','Venda','Quantidade','Mínimo','Status','Ações'];
  function markInventory() {
    const tbody = byId('tbEstoque');
    if (!tbody) return false;
    const table = tbody.closest('table');
    const card = tbody.closest('.j-card');
    const wrap = tbody.closest('.j-table');
    if (!card || !table) return false;
    card.classList.add('thia-inventory-v2612');
    table.removeAttribute('style');
    wrap?.style?.removeProperty('overflow-x');
    Array.from(tbody.rows || []).forEach(row => {
      Array.from(row.cells || []).forEach((cell, index) => {
        if (!cell.dataset.label) cell.dataset.label = labels[index] || '';
      });
    });
    return true;
  }

  function observeInventory() {
    const section = byId('s-estoque');
    if (!section || section.dataset.thiaInventoryObserverV2612 === '1') return;
    section.dataset.thiaInventoryObserverV2612 = '1';
    const runtime = W.ThiaRuntimeCoreV2613;
    const observer = new MutationObserver(() => {
      if (runtime?.scheduleDom) runtime.scheduleDom('inventory-v2613', markInventory, { delay:50, maxRetries:4 });
      else setTimeout(markInventory, 50);
    });
    observer.observe(section, { childList:true, subtree:true });
    section.__thiaInventoryObserverV2612 = observer;
  }

  function installInventoryFix() {
    injectInventoryCSS();
    markInventory();
    observeInventory();
  }

  function install() {
    if (D.documentElement.dataset.thiaFirestoreProfessionalInstalled === VERSION) return;
    installLimitedDataFunctions();
    wrapEnsureData();
    installFiscalDemandHooks();
    installChatHistoryHooks();
    installInventoryFix();
    W.ThiaRuntimeCoreV2613?.installPrepOSGuard?.();
    W.ThiaRuntimeCoreV2613?.installSaveGuard?.();
    D.documentElement.dataset.thiaDatabaseMode = 'profissional-v2613';
    D.documentElement.dataset.thiaInventoryFix = VERSION;
    D.documentElement.dataset.thiaFirestoreProfessionalInstalled = VERSION;
    console.info('[OFICIN-IA] Jarvis Firestore profissional e inventário V' + VERSION + ' ativos');
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
  const runtime = W.ThiaRuntimeCoreV2613;
  if (runtime?.addEventOnce) {
    runtime.addEventOnce(W, 'resize', 'inventory-v2613', markInventory);
    runtime.addEventOnce(W, 'orientationchange', 'inventory-v2613', () => setTimeout(markInventory, 200));
  } else {
    W.addEventListener('resize', markInventory, { passive:true });
    W.addEventListener('orientationchange', () => setTimeout(markInventory, 200), { passive:true });
  }
})(window, document);
