/**
 * OFICIN-IA V26.12 — painel Equipe com consultas por mecânico.
 * Mantém compatibilidade com O.S. antigas por sincronização legada controlada.
 */
(function (W, D) {
  'use strict';
  if (W.__EQUIPE_FIRESTORE_PRO_V2612__) return;
  W.__EQUIPE_FIRESTORE_PRO_V2612__ = true;

  const VERSION = '26.12.0';
  const RT = () => W.ThiaFirestoreV2612;
  const S = () => W.J || (typeof J !== 'undefined' ? J : {});
  const DB = () => W.db || (typeof db !== 'undefined' ? db : null);
  const liveMaps = { principal:new Map(), multi:new Map(), legacy:new Map() };
  const chatMaps = { de:new Map(), para:new Map(), all:new Map() };
  const unsubs = new Map();
  let hiddenStopTimer = null;
  const roleAll = () => ['gerente','gestor','admin','superadmin','dono'].includes(String(S().role || '').toLowerCase());

  function stop(key) {
    const u = unsubs.get(key);
    if (typeof u === 'function') { try { u(); } catch (_) {} }
    unsubs.delete(key);
    RT()?.stop?.(key);
  }
  function stopOS() { ['equipe:os:all','equipe:os:principal','equipe:os:multi'].forEach(stop); }

  function applyList(list) {
    const all = RT().mergeLists(list || []);
    dbOS = roleAll() ? all : all.filter(osAtribuidaAoUsuarioEquipe);
    statusEquipeDados('');
    renderKanban();
    renderKPIs();
  }

  function mergedMechanicOS() {
    return RT().mergeLists(
      Array.from(liveMaps.principal.values()),
      Array.from(liveMaps.multi.values()),
      Array.from(liveMaps.legacy.values())
    );
  }

  function setMap(name, snap, filter) {
    const map = liveMaps[name];
    map.clear();
    RT().docs(snap).filter(doc => typeof filter === 'function' ? filter(doc) : true).forEach(doc => map.set(String(doc.id), doc));
    applyList(mergedMechanicOS());
  }


  function stopChat() { ['equipe:chat:de','equipe:chat:para','equipe:chat:all'].forEach(stop); }

  function applyTeamChat() {
    const list = RT().mergeLists(
      Array.from(chatMaps.de.values()),
      Array.from(chatMaps.para.values()),
      Array.from(chatMaps.all.values())
    ).sort((a,b)=>(Number(a.ts||0)-Number(b.ts||0)));
    try { dbMsgs = list; } catch (_) { W.dbMsgs = list; }
    try { renderChat(); } catch (_) { W.renderChat?.(); }
    const fid = String(S().fid || '');
    const unread = list.filter(m => m.sender === 'admin' && !m.lidaEquipe && String(m.para || '') === fid).length;
    const badge = D.getElementById('chatTabBadge');
    if (badge) {
      if (unread > 0) { badge.classList.remove('d-none'); badge.textContent = String(unread); }
      else badge.classList.add('d-none');
    }
  }

  function setChatMap(name, snap, filter) {
    const map = chatMaps[name];
    map.clear();
    RT().docs(snap).filter(doc => typeof filter === 'function' ? filter(doc) : true).forEach(doc => map.set(String(doc.id), doc));
    applyTeamChat();
  }

  function startTeamChat() {
    if (unsubs.has('equipe:chat:all') || unsubs.has('equipe:chat:de') || unsubs.has('equipe:chat:para')) return;
    const database = DB();
    const session = S();
    if (!database || !session.tid || !RT()) return;
    stopChat();
    Object.values(chatMaps).forEach(map => map.clear());
    try { _chatEquipeListenerIniciado = true; } catch (_) {}
    const base = database.collection('chat_equipe').where('tenantId', '==', session.tid);
    if (roleAll() || !session.fid) {
      const u = RT().listen('equipe:chat:all', base, { apply:snap=>setChatMap('all',snap), error:()=>{ try{_chatEquipeListenerIniciado=false;}catch(_){} } });
      unsubs.set('equipe:chat:all', u);
      return;
    }
    const de = base.where('de', '==', session.fid);
    const para = base.where('para', '==', session.fid);
    const ownChat = msg => String(msg.de || '') === String(session.fid) || String(msg.para || '') === String(session.fid);
    const u1 = RT().listen('equipe:chat:de', de, {
      apply:snap=>setChatMap('de',snap,ownChat),
      // Fallback temporário preserva o chat enquanto o índice é criado; filtra antes de guardar/renderizar.
      fallback:()=>base,
      error:err=>console.warn('[Equipe V26.12 chat de]',err?.message||err)
    });
    const u2 = RT().listen('equipe:chat:para', para, {
      apply:snap=>setChatMap('para',snap,ownChat),
      fallback:()=>null,
      error:err=>console.warn('[Equipe V26.12 chat para]',err?.message||err)
    });
    unsubs.set('equipe:chat:de',u1); unsubs.set('equipe:chat:para',u2);
  }

  async function loadReferenceData(force) {
    const database = DB();
    const session = S();
    if (!database || !session.tid || !RT()) return;
    const qClients = database.collection('clientes').where('tenantId', '==', session.tid);
    const qVehicles = database.collection('veiculos').where('tenantId', '==', session.tid);
    await Promise.all([
      RT().once('equipe:clientes', qClients, {
        ttl: 2 * 60 * 60 * 1000,
        force: !!force,
        apply: snap => { dbClientes = RT().docs(snap); popularSelects(); }
      }),
      RT().once('equipe:veiculos', qVehicles, {
        ttl: 60 * 60 * 1000,
        force: !!force,
        apply: snap => { dbVeiculos = RT().docs(snap); popularSelects(); }
      })
    ]);
  }

  async function loadLegacyCompatibility(force) {
    if (roleAll()) return;
    const database = DB();
    const session = S();
    if (!database || !session.tid || !session.fid || !RT()) return;
    const q = database.collection('ordens_servico').where('tenantId', '==', session.tid);
    await RT().once('equipe:os:legado:' + session.fid, q, {
      ttl: 30 * 24 * 60 * 60 * 1000,
      force: !!force,
      apply: snap => {
        liveMaps.legacy.clear();
        RT().docs(snap).filter(osAtribuidaAoUsuarioEquipe).forEach(doc => liveMaps.legacy.set(String(doc.id), doc));
        applyList(mergedMechanicOS());
      }
    });
  }

  function startManagers() {
    const database = DB();
    const session = S();
    const q = database.collection('ordens_servico').where('tenantId', '==', session.tid);
    stopOS();
    const unsub = RT().listen('equipe:os:all', q, {
      apply: snap => applyList(RT().docs(snap)),
      error: err => {
        console.error('[Equipe V26.12 O.S. gestor]', err);
        statusEquipeDados('Falha ao sincronizar as O.S. Mantive o cache local.', 'err');
      }
    });
    unsubs.set('equipe:os:all', unsub);
  }

  async function startMechanic(force) {
    const database = DB();
    const session = S();
    if (!database || !session.tid || !session.fid) return;
    stopOS();
    liveMaps.principal.clear();
    liveMaps.multi.clear();
    if (force) liveMaps.legacy.clear();

    const base = database.collection('ordens_servico').where('tenantId', '==', session.tid);
    const qPrincipal = base.where('mecId', '==', session.fid);
    const qMulti = base.where('mecIds', 'array-contains', session.fid);

    const u1 = RT().listen('equipe:os:principal', qPrincipal, {
      apply: snap => setMap('principal', snap),
      fallback: () => null,
      error: err => console.warn('[Equipe V26.12 mecId]', err?.message || err)
    });
    const u2 = RT().listen('equipe:os:multi', qMulti, {
      apply: snap => setMap('multi', snap, osAtribuidaAoUsuarioEquipe),
      // Fallback temporário mantém o fluxo atual enquanto o índice composto é criado.
      // A lista é filtrada antes de entrar na memória ou ser exibida.
      fallback: () => base,
      error: err => console.warn('[Equipe V26.12 mecIds]', err?.message || err)
    });
    unsubs.set('equipe:os:principal', u1);
    unsubs.set('equipe:os:multi', u2);

    await loadLegacyCompatibility(!!force);
  }

  async function startOS(force) {
    const active = roleAll()
      ? unsubs.has('equipe:os:all')
      : (unsubs.has('equipe:os:principal') && unsubs.has('equipe:os:multi'));
    if (active && !force) return;
    statusEquipeDados('Sincronizando pátio da equipe...', 'warn');
    if (roleAll()) startManagers();
    else await startMechanic(!!force);
  }

  async function loadStock(force) {
    const database = DB();
    const session = S();
    if (!database || !session.tid || !RT()) return;
    const q = database.collection('estoqueItems').where('tenantId', '==', session.tid);
    await RT().once('equipe:estoque', q, {
      ttl: 60 * 60 * 1000,
      force: !!force,
      apply: snap => { dbEstoque = RT().docs(snap); }
    });
  }

  W.equipeEconomiaV265Start = async function () {
    statusEquipeDados('Carregando pátio em modo profissional...', 'warn');
    await loadReferenceData(false);
    await startOS(false);
  };
  W.equipeEconomiaV265Start.__thiaProV2612 = true;
  W.equipeEconomiaV265LoadEstoque = loadStock;
  W.equipeEconomiaV265RefreshOS = () => startOS(true);
  W.iniciarEstoqueEquipeDados = () => loadStock(false);
  W.iniciarChatEquipeDados = startTeamChat;

  function hooks() {
    if (typeof W.abrirModal === 'function' && !W.abrirModal.__thiaEquipeProV2612) {
      const original = W.abrirModal;
      const wrapped = function (id) {
        if (id === 'modalOS') loadStock(false);
        return original.apply(this, arguments);
      };
      wrapped.__thiaEquipeProV2612 = true;
      wrapped.__original = original;
      W.abrirModal = wrapped;
    }
    if (typeof W.salvarOS === 'function' && !W.salvarOS.__thiaEquipeProV2612) {
      const original = W.salvarOS;
      const wrapped = function () {
        const out = original.apply(this, arguments);
        Promise.resolve(out).finally(() => {
          loadStock(false);
          if (!roleAll()) startMechanic(false);
        });
        return out;
      };
      wrapped.__thiaEquipeProV2612 = true;
      wrapped.__original = original;
      W.salvarOS = wrapped;
    }
  }

  D.addEventListener('visibilitychange', () => {
    clearTimeout(hiddenStopTimer);
    if (D.hidden) {
      // Evita reabrir todos os listeners a cada troca rápida de aplicativo/aba.
      hiddenStopTimer = setTimeout(() => {
        if (!D.hidden) return;
        stopOS(); stopChat();
        try { _chatEquipeListenerIniciado = false; } catch (_) {}
      }, 5 * 60 * 1000);
    } else {
      startOS(false);
    }
  });
  W.addEventListener('beforeunload', () => { stopOS(); stopChat(); });

  function install() {
    hooks();
    D.documentElement.dataset.thiaEquipeFirestore = 'profissional-v2612';
  }
  install();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  [300,900,1800].forEach(ms => setTimeout(install, ms));
  console.info('[OFICIN-IA] Equipe Firestore profissional V' + VERSION + ' ativo');
})(window, document);
