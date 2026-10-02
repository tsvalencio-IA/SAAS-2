/*
 * SAAS-2 -> SIGFROTA
 * Sincronização manual por O.S.: nada desta integração é enviado ao SIGFROTA
 * até o Gestor/Admin clicar no botão dentro da própria O.S.
 */
(function (W) {
  'use strict';

  const CFG = W.SIGFROTA_BRIDGE_CONFIG || {
    apiKey: 'AIzaSyBGP3xeCIWPPCz5dbZRYzuLyKVj8ZaoHOo',
    authDomain: 'sigfrota-d64d0.firebaseapp.com',
    projectId: 'sigfrota-d64d0',
    storageBucket: 'sigfrota-d64d0.firebasestorage.app',
    messagingSenderId: '99786546073',
    appId: '1:99786546073:web:6b1edeb23c21e7f3665108'
  };
  const APP_NAME = 'sigfrota-bridge-' + String(CFG.projectId || 'app').replace(/[^a-z0-9-]/gi, '-');
  const BOOTSTRAP_UID = 'uwUU8OkzRbfBtlVR1oeT72H0jYE2';
  let bridgeApp = null;
  let bridgeAuth = null;
  let bridgeDb = null;
  let chatUnsub = null;
  let globalEventsUnsub = null;
  let bridgeEvents = [];
  let bridgeEventsInitialized = false;
  let authObserverInstalled = false;
  let importedEventIds = new Set();
  let pendingAuthResolve = null;
  let pendingAuthReject = null;

  const nowISO = () => new Date().toISOString();
  const n = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v ?? '').trim();
    if (!s) return 0;
    s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(',', '.');
    const x = Number(s);
    return Number.isFinite(x) ? x : 0;
  };
  const round2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
  const discountRate = (v) => {
    const x = n(v);
    if (!x) return 0;
    return Math.max(0, Math.min(1, x > 1 ? x / 100 : x));
  };
  const pick = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '';
  const safeId = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const role = () => String(W.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  const manager = () => ['admin', 'gestor', 'gerente', 'superadmin', 'dono', 'proprietario', 'owner'].includes(role());
  const integrationId = (clientId) => 'saas2_' + safeId(W.J?.tid) + '_' + safeId(clientId);
  const toast = (msg, type) => { try { if (typeof W.toast === 'function') return W.toast(msg, type || 'ok'); } catch (_) {} alert(msg); };

  function ensureFirebase() {
    if (!W.firebase) throw new Error('Firebase não carregado no Jarvis.');
    if (!W.firebase.auth) throw new Error('Módulo de autenticação do Firebase não carregado.');
    let app = W.firebase.apps.find(a => a.name === APP_NAME);
    if (!app) app = W.firebase.initializeApp(CFG, APP_NAME);
    bridgeApp = app;
    bridgeAuth = app.auth();
    bridgeDb = app.firestore();
    try { bridgeAuth.setPersistence(W.firebase.auth.Auth.Persistence.LOCAL); } catch (_) {}
    // Não instala observer automático: o SIGFROTA só é acessado após ação explícita do gestor.
    return { app: bridgeApp, auth: bridgeAuth, db: bridgeDb };
  }

  function ensureUi() {
    if (document.getElementById('sigfrotaBridgeStyle')) return;
    const style = document.createElement('style');
    style.id = 'sigfrotaBridgeStyle';
    style.textContent = `
      .sf-overlay{position:fixed;inset:0;background:rgba(4,10,20,.76);z-index:99999;display:grid;place-items:center;padding:16px}
      .sf-modal{width:min(720px,96vw);max-height:90vh;overflow:auto;background:#111a27;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 26px 90px rgba(0,0,0,.48);color:#e7eef8}
      .sf-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.09)}
      .sf-head strong{font-size:.86rem;letter-spacing:.03em}.sf-x{border:0;background:transparent;color:#9aabbd;font-size:1.2rem;cursor:pointer}
      .sf-body{padding:18px}.sf-note{font-size:.72rem;line-height:1.5;color:#9db0c4;margin:0 0 14px}.sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .sf-field label{display:block;font-size:.62rem;font-weight:700;color:#91a4ba;margin-bottom:5px}.sf-field input{width:100%;background:#0c1420;border:1px solid rgba(255,255,255,.13);color:#fff;border-radius:8px;padding:10px;outline:none}
      .sf-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.sf-btn{border:0;border-radius:8px;padding:9px 13px;font-size:.7rem;font-weight:800;cursor:pointer}.sf-primary{background:#d4ad45;color:#111b2b}.sf-ghost{background:#243044;color:#e7eef8}
      .sf-chat{height:360px;overflow:auto;background:#09111c;padding:12px;display:flex;flex-direction:column;gap:8px}.sf-msg{max-width:78%;padding:8px 10px;border-radius:10px;font-size:.73rem;line-height:1.45}.sf-msg.jarvis{align-self:flex-end;background:#17365e}.sf-msg.sigfrota{align-self:flex-start;background:#1d2734}.sf-msg small{display:block;font-size:.55rem;color:#8fa1b4;margin-bottom:3px}.sf-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.09)}.sf-chat-form input{flex:1;background:#0c1420;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:10px}
      .sf-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,0,0,.2);border-top-color:#111;border-radius:50%;animation:sfspin .7s linear infinite}@keyframes sfspin{to{transform:rotate(360deg)}}
      .k-card{position:relative}.sf-kanban-badge{position:absolute;right:7px;top:7px;z-index:6;display:flex;align-items:center;gap:5px;background:#ef4444;color:#fff;border:1px solid rgba(255,255,255,.35);box-shadow:0 5px 18px rgba(239,68,68,.28);border-radius:999px;padding:4px 7px;font-family:var(--fm);font-size:.54rem;font-weight:800;letter-spacing:.4px;pointer-events:none}
      .sf-os-update-banner{display:none;margin:0 18px 12px;padding:10px 12px;border:1px solid rgba(245,158,11,.45);background:rgba(245,158,11,.10);border-radius:6px;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--text)}
      .sf-os-update-banner.show{display:flex}.sf-os-update-banner strong{font-family:var(--fd);font-size:.82rem;color:#fbbf24}.sf-os-update-banner span{display:block;margin-top:2px;font-family:var(--fm);font-size:.58rem;color:var(--muted2)}.sf-os-update-banner button{border:1px solid rgba(96,165,250,.5);background:rgba(96,165,250,.12);color:#93c5fd;border-radius:4px;padding:7px 10px;font-family:var(--fm);font-size:.62rem;cursor:pointer}
      @media(max-width:620px){.sf-grid{grid-template-columns:1fr}.sf-modal{width:100%;max-height:94vh}.sf-chat{height:55vh}.sf-os-update-banner{margin:0 8px 8px}}
    `;
    document.head.appendChild(style);
  }

  function closeModal(id) { document.getElementById(id)?.remove(); }

  function jarvisUserMeta() {
    return {
      name: String(W.J?.nome || sessionStorage.getItem('j_nome') || 'Jarvis'),
      role: String(W.J?.role || sessionStorage.getItem('j_role') || ''),
      uid: String(W.J?.fid || sessionStorage.getItem('j_fid') || ''),
      email: String(W.J?.email || sessionStorage.getItem('j_email') || '')
    };
  }

  function eventTs(e) {
    const t = Number(e?.ts || 0);
    if (Number.isFinite(t) && t > 0) return t;
    const p = Date.parse(e?.created_at || e?.date_time || '');
    return Number.isFinite(p) ? p : 0;
  }

  function importedStorageKey() { return 'sigfrota:imported-events:' + String(W.J?.tid || 'tenant'); }
  function loadImportedEventIds() {
    try { importedEventIds = new Set(JSON.parse(localStorage.getItem(importedStorageKey()) || '[]')); } catch (_) { importedEventIds = new Set(); }
  }
  function rememberImportedEvent(id) {
    if (!id) return;
    importedEventIds.add(String(id));
    if (importedEventIds.size > 500) importedEventIds = new Set([...importedEventIds].slice(-350));
    try { localStorage.setItem(importedStorageKey(), JSON.stringify([...importedEventIds])); } catch (_) {}
  }

  function incomingEventsForOrder(orderId) {
    const id = String(orderId || '');
    const os = (W.J?.os || []).find(o => String(o.id) === id);
    const readTs = Number(os?.sigfrotaReadTs || 0);
    return bridgeEvents.filter(e =>
      String(e.order_id || '') === id &&
      String(e.sender || '').toLowerCase() === 'sigfrota' &&
      eventTs(e) > readTs
    ).sort((a,b) => eventTs(a) - eventTs(b));
  }

  async function writeLocalAudit({ key, action, osId, userName, userRole, detail, source, eventType, at }) {
    const database = W.J?.db || W.db;
    if (!database || !W.J?.tid) return;
    const ts = Number(at || Date.now());
    const payload = {
      tenantId: W.J.tid,
      modulo: 'SIGFROTA',
      entidade: 'ordens_servico',
      osId: String(osId || ''),
      usuario: String(userName || 'SIGFROTA'),
      perfil: String(userRole || ''),
      acao: String(action || 'Atualização SIGFROTA'),
      detalhe: String(detail || ''),
      origem: String(source || 'SIGFROTA'),
      tipoEvento: String(eventType || ''),
      ts,
      createdAt: new Date(ts).toISOString()
    };
    const id = safeId('sf_' + String(key || ts));
    await Promise.allSettled([
      database.collection('lixeira_auditoria').doc(id).set(payload, { merge:true }),
      database.collection('auditoria').doc(id).set(payload, { merge:true })
    ]);
  }

  async function appendLocalTimeline(osId, entry, latestPatch) {
    const database = W.J?.db || W.db;
    if (!database || !osId) return;
    await database.collection('ordens_servico').doc(String(osId)).set({
      ...(latestPatch || {}),
      timeline: W.firebase.firestore.FieldValue.arrayUnion(entry)
    }, { merge:true });
  }

  async function importIncomingBridgeEvent(e) {
    if (!e?.id || !e?.order_id || String(e.sender || '').toLowerCase() !== 'sigfrota') return;
    if (String(e.tenant_id || '') !== String(W.J?.tid || '')) return;
    if (importedEventIds.has(String(e.id))) return;
    const osLocal = (W.J?.os || []).find(o => String(o.id) === String(e.order_id));
    if (!osLocal) return;
    if (Array.isArray(osLocal.timeline) && osLocal.timeline.some(t => String(t?.eventoId || '') === String(e.id))) { rememberImportedEvent(e.id); return; }
    const ts = eventTs(e) || Date.now();
    const senderName = String(e.sender_name || e.user_name || e.sender_email || 'SIGFROTA');
    const senderRole = String(e.sender_role || e.role || 'SIGFROTA');
    const isChat = String(e.event_type || '') === 'CHAT_MESSAGE';
    const detail = isChat
      ? String(e.message_text || e.text || e.message || 'Nova mensagem')
      : String(e.message || e.event_type || 'Atualização recebida');
    const action = isChat ? 'Mensagem recebida do SIGFROTA' : 'Atualização recebida do SIGFROTA';
    const entry = {
      tipo: isChat ? 'sigfrota_chat' : 'sigfrota_atualizacao',
      origem: 'SIGFROTA', eventoId: String(e.id), acao: detail,
      usuario: senderName, perfil: senderRole, data: new Date(ts).toISOString(), ts
    };
    try {
      await appendLocalTimeline(e.order_id, entry, {
        sigfrotaLastUpdateTs: ts,
        sigfrotaLastUpdateAt: new Date(ts).toISOString(),
        sigfrotaLastUpdateBy: senderName,
        sigfrotaLastUpdateType: String(e.event_type || ''),
        sigfrotaLastUpdateText: detail
      });
    } catch (err) { console.warn('[SIGFROTA] timeline local', err); }
    await writeLocalAudit({
      key:e.id, action, osId:e.order_id, userName:senderName, userRole:senderRole,
      detail, source:'SIGFROTA', eventType:e.event_type, at:ts
    });
    rememberImportedEvent(e.id);
  }

  function decorateKanbanCards() {
    if (!manager()) return;
    document.querySelectorAll('.k-card').forEach(card => {
      card.querySelectorAll('.sf-kanban-badge').forEach(x => x.remove());
      const onclick = String(card.getAttribute('onclick') || '');
      if (!onclick) return;
      for (const os of (W.J?.os || [])) {
        const pending = incomingEventsForOrder(os.id);
        if (!pending.length || !onclick.includes(String(os.id))) continue;
        const badge = document.createElement('div');
        badge.className = 'sf-kanban-badge';
        badge.textContent = '🔔 SIGFROTA ' + pending.length;
        badge.title = pending.length + ' atualização(ões) do SIGFROTA ainda não lida(s)';
        card.appendChild(badge);
        break;
      }
    });
  }

  function ensureOSUpdateBanner() {
    const foot = document.querySelector('#modalOS .modal-foot');
    if (!foot) return null;
    let banner = document.getElementById('sfOsUpdateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sfOsUpdateBanner';
      banner.className = 'sf-os-update-banner';
      foot.parentNode.insertBefore(banner, foot);
    }
    return banner;
  }

  function renderOSUpdateBanner() {
    const os = currentOS();
    const banner = ensureOSUpdateBanner();
    if (!banner) return;
    const pending = incomingEventsForOrder(os?.id);
    const chatBtn = document.getElementById('btnSigfrotaChatOS');
    if (!os || !pending.length) {
      banner.classList.remove('show');
      banner.innerHTML = '';
      if (chatBtn && chatBtn.style.display !== 'none') chatBtn.textContent = '💬 CHAT SIGFROTA';
      return;
    }
    const last = pending[pending.length - 1];
    const sender = esc(last.sender_name || last.user_name || 'SIGFROTA');
    const when = new Date(eventTs(last)).toLocaleString('pt-BR');
    banner.innerHTML = '<div><strong>🔔 ' + pending.length + ' atualização(ões) do SIGFROTA</strong><span>Última: ' + sender + ' • ' + esc(when) + '</span></div><button type="button" id="sfOpenUpdatesBtn">VER ATUALIZAÇÕES / CHAT</button>';
    banner.classList.add('show');
    banner.querySelector('#sfOpenUpdatesBtn').onclick = () => openOrderChat(os);
    if (chatBtn) chatBtn.textContent = '🔔 CHAT SIGFROTA (' + pending.length + ')';
  }

  function refreshPendingUI() {
    decorateKanbanCards();
    renderOSUpdateBanner();
  }

  async function markOrderUpdatesRead(os) {
    if (!os?.id) return;
    const pending = incomingEventsForOrder(os.id);
    if (!pending.length) return;
    const latestTs = Math.max(...pending.map(eventTs));
    const meta = jarvisUserMeta();
    const at = nowISO();
    try {
      await (W.J?.db || W.db).collection('ordens_servico').doc(String(os.id)).set({
        sigfrotaReadTs: latestTs,
        sigfrotaReadAt: at,
        sigfrotaReadBy: meta.name,
        sigfrotaReadRole: meta.role
      }, { merge:true });
      os.sigfrotaReadTs = latestTs;
      await writeLocalAudit({
        key:'read_' + os.id + '_' + latestTs,
        action:'Atualizações do SIGFROTA visualizadas', osId:os.id,
        userName:meta.name, userRole:meta.role,
        detail:pending.length + ' atualização(ões) marcada(s) como lida(s)',
        source:'SAAS2', eventType:'READ', at:Date.now()
      });
    } catch (err) { console.warn('[SIGFROTA] leitura', err); }
    refreshPendingUI();
  }

  function stopGlobalBridgeListener() {
    if (globalEventsUnsub) { try { globalEventsUnsub(); } catch (_) {} }
    globalEventsUnsub = null;
    bridgeEvents = [];
    bridgeEventsInitialized = false;
    refreshPendingUI();
  }

  function startGlobalBridgeListener() {
    if (globalEventsUnsub || !bridgeDb || !W.J?.tid || !manager()) return;
    loadImportedEventIds();
    globalEventsUnsub = bridgeDb.collection('saas2_sync_events')
      .where('tenant_id', '==', String(W.J.tid))
      .onSnapshot(snap => {
        bridgeEvents = snap.docs.map(d => ({ id:d.id, ...d.data() }))
          .filter(e => String(e.sender || '').toLowerCase() === 'sigfrota')
          .sort((a,b) => eventTs(a) - eventTs(b));
        bridgeEvents.forEach(e => importIncomingBridgeEvent(e).catch(err => console.warn('[SIGFROTA] importar evento', err)));
        if (bridgeEventsInitialized) {
          snap.docChanges().forEach(change => {
            if (change.type !== 'added') return;
            const e = { id:change.doc.id, ...change.doc.data() };
            if (String(e.sender || '').toLowerCase() !== 'sigfrota') return;
            const os = (W.J?.os || []).find(x => String(x.id) === String(e.order_id || ''));
            const placa = os ? (vehicleForOS(os)?.placa || os.placa || '') : '';
            toast('🔔 SIGFROTA • ' + (placa ? placa + ' • ' : '') + String(e.sender_name || 'SIGFROTA') + ': ' + String(e.message_text || e.message || 'nova atualização'), 'info');
          });
        }
        bridgeEventsInitialized = true;
        refreshPendingUI();
      }, err => console.warn('[SIGFROTA] listener global', err));
  }

  function authModal() {
    ensureUi();
    closeModal('sigfrotaAuthModal');
    const overlay = document.createElement('div');
    overlay.className = 'sf-overlay';
    overlay.id = 'sigfrotaAuthModal';
    overlay.innerHTML = `<div class="sf-modal"><div class="sf-head"><strong>Autorizar envio ao SIGFROTA</strong><button class="sf-x" data-close>×</button></div><div class="sf-body">
      <p class="sf-note">Use uma conta autorizada do SIGFROTA. Esta etapa é necessária somente para validar a integração neste navegador.</p>
      <div class="sf-grid"><div class="sf-field"><label>E-mail SIGFROTA</label><input id="sfAuthEmail" type="email"></div><div class="sf-field"><label>Senha SIGFROTA</label><input id="sfAuthPass" type="password"></div></div>
      <div id="sfAuthErr" style="display:none;color:#ff8585;font-size:.68rem;margin-top:9px"></div>
      <div class="sf-actions"><button class="sf-btn sf-ghost" data-close>Cancelar</button><button class="sf-btn sf-primary" id="sfAuthGo">Conectar</button></div>
    </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
      closeModal('sigfrotaAuthModal');
      pendingAuthReject?.(new Error('Conexão cancelada.'));
      pendingAuthResolve = pendingAuthReject = null;
    });
    overlay.querySelector('#sfAuthGo').onclick = async () => {
      const btn = overlay.querySelector('#sfAuthGo');
      const err = overlay.querySelector('#sfAuthErr');
      const email = overlay.querySelector('#sfAuthEmail').value.trim();
      const pass = overlay.querySelector('#sfAuthPass').value;
      if (!email || !pass) { err.textContent = 'Informe e-mail e senha.'; err.style.display = 'block'; return; }
      btn.disabled = true; btn.innerHTML = '<span class="sf-spinner"></span> Conectando'; err.style.display = 'none';
      try {
        const { auth, db } = ensureFirebase();
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        const prof = await db.collection('users').doc(cred.user.uid).get();
        const data = prof.exists ? prof.data() : {};
        const perms = Array.isArray(data.permissoes_especiais) ? data.permissoes_especiais : [];
        const ok = cred.user.uid === BOOTSTRAP_UID || data.role === 'gestor' || data.role === 'adm' || perms.includes('acesso_total') || perms.includes('gerenciar_oficinas');
        if (!ok || data.active === false || ['INATIVO', 'EXCLUIDO', 'PENDENTE'].includes(data.status_usuario)) {
          await auth.signOut();
          throw new Error('Esta conta não possui autorização para esta integração.');
        }
        closeModal('sigfrotaAuthModal');
        pendingAuthResolve?.(cred.user);
        pendingAuthResolve = pendingAuthReject = null;
      } catch (e) {
        err.textContent = e.message || String(e); err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Conectar';
      }
    };
  }

  async function ensureAuth() {
    const { auth, db } = ensureFirebase();
    if (auth.currentUser) {
      try {
        const prof = await db.collection('users').doc(auth.currentUser.uid).get();
        const d = prof.exists ? prof.data() : {};
        const perms = Array.isArray(d.permissoes_especiais) ? d.permissoes_especiais : [];
        if ((auth.currentUser.uid === BOOTSTRAP_UID || d.role === 'gestor' || d.role === 'adm' || perms.includes('acesso_total') || perms.includes('gerenciar_oficinas')) && d.active !== false && !['INATIVO', 'EXCLUIDO', 'PENDENTE'].includes(d.status_usuario)) return auth.currentUser;
      } catch (_) {}
    }
    return new Promise((resolve, reject) => { pendingAuthResolve = resolve; pendingAuthReject = reject; authModal(); });
  }

  function currentOS() {
    const id = document.getElementById('osId')?.value || '';
    return (W.J?.os || []).find(o => String(o.id) === String(id)) || null;
  }

  function clientForOS(os) {
    return (W.J?.clientes || []).find(c => String(c.id) === String(os?.clienteId || '')) || null;
  }

  function vehicleForOS(os) {
    return (W.J?.veiculos || []).find(v => String(v.id) === String(os?.veiculoId || '')) || {};
  }

  function isOfficialClient(c) {
    return String(c?.tipoCliente || '').toLowerCase() === 'governo';
  }

  function publicWorkshop() {
    const o = W.J?.oficina || {};
    return {
      id: W.J?.tid || '',
      name: pick(o.nomeFantasia, o.nome, W.J?.tnome),
      legal_name: pick(o.razaoSocial, o.razao_social),
      cnpj: pick(o.cnpj, o.doc),
      phone: pick(o.telefone, o.whatsapp, o.phone),
      email: pick(o.email, o.adminEmail),
      address: pick(o.endereco, o.enderecoCompleto),
      city: pick(o.cidade, o.municipio),
      uf: pick(o.uf),
      slug: pick(o.slug, o.publicSlug, o.oficinaSlug)
    };
  }

  function publicClient(c) {
    return {
      id: c.id || '', name: c.nome || '', cnpj: c.doc || '', email: c.email || '', phone: c.wpp || '',
      address: pick(c.enderecoCompleto, [c.rua, c.num, c.bairro, c.cidade].filter(Boolean).join(', ')), city: c.cidade || '',
      unit: c.govUnidade || '', fiscal: c.govFiscal || '', header: c.govCabecalho || '',
      labor_hour: n(c.govValorHora), labor_discount: discountRate(c.govDescMO), parts_discount: discountRate(c.govDescPeca)
    };
  }

  function publicVehicle(v, os) {
    return {
      id: v.id || os?.veiculoId || '', prefix: pick(v.prefixo, v.frota, os?.prefixo), plate: pick(v.placa, os?.placa),
      brand: pick(v.marca, os?.marca), model: pick(v.modelo, os?.veiculo, os?.modelo), year: pick(v.ano, os?.ano),
      chassis: pick(v.chassi, v.chassis, os?.chassi), patrimonio: pick(v.patrimonio, os?.patrimonio), km: pick(os?.km, v.km),
      unit: pick(clientForOS(os)?.govUnidade, v.unidade, v.opm)
    };
  }

  function isAllowedBudgetPart(p) {
    if (!p || typeof p !== 'object') return false;
    const blocked = ['origemNFItemKey', 'idReal', 'pecaRealId', 'nfId', 'codigoFornecedor', 'fornecedorId', 'fornecedor', 'valorCompra', 'custoCompra', 'notaFiscalId'];
    return !blocked.some(k => p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '');
  }

  function partRows(os, client) {
    const rate = discountRate(os?.descPeca != null ? os.descPeca : client?.govDescPeca);
    return (Array.isArray(os?.pecas) ? os.pecas : []).filter(isAllowedBudgetPart).filter(p => pick(p.desc, p.descricao, p.codigo, p.cod, p.venda, p.valor)).map((p, index) => {
      const qty = n(p.qtd || p.q || 1) || 1;
      const unit = n(p.venda || p.valor || p.v);
      const gross = round2(qty * unit);
      const total = round2(gross * (1 - rate));
      return {
        key: 'p-' + index,
        code: String(pick(p.codigo, p.cod, p.codigoOriginal, p.codigoOEM, p.oem, p.partNumber, p.numeroPeca, 'sem oem')),
        description: String(pick(p.desc, p.descricao)),
        quantity: qty,
        unit_value: round2(unit),
        gross,
        discount_rate: rate,
        discount_value: round2(gross - total),
        total,
        link_index: p.ciliaPieceIndex != null ? String(p.ciliaPieceIndex) : ''
      };
    });
  }

  function serviceRows(os, client, vehicle) {
    const rate = discountRate(os?.descMO != null ? os.descMO : client?.govDescMO);
    const fallbackHour = n(os?.valorHoraOS ?? os?.govValorHoraOS ?? client?.govValorHora ?? 0);
    const utils = W.JarvisOSUtils || W.JOS || {};
    const rows = (Array.isArray(os?.servicos) ? os.servicos : []).filter(s => pick(s.desc, s.descricao, s.valor, s.tempo)).map((s, index) => {
      let resolved = {};
      try { resolved = typeof utils.resolvePMSPServico === 'function' ? (utils.resolvePMSPServico(s, { veiculo: vehicle, fallbackValorHora: fallbackHour }) || {}) : {}; } catch (_) {}
      const hours = n(s.tempo || s.horas);
      const raw = n(s.valor);
      const unit = n(s.valorHora || s.valorHoraSecao || resolved.valorHora) || (hours > 0 && raw > 0 ? raw / hours : 0) || fallbackHour;
      const gross = round2(unit * hours);
      const total = round2(gross * (1 - rate));
      const internalCode = String(pick(s.codigoInterno, s.codInterno, s.codigoServicoInterno, resolved.codigoInterno, resolved.codInterno, ''));
      const tableCode = String(pick(s.codigoTabela, s.codigoTempa, s.codigoSiafisico, resolved.codigoTabela, resolved.codigo, ''));
      return {
        key: 's-' + index,
        code: String(pick(internalCode, tableCode, s.codigoServico, s.codigo, s.cod, resolved.codigoServico, '')),
        table_code: tableCode,
        description: String(pick(s.desc, s.descricao)),
        hours,
        unit_value: round2(unit),
        gross,
        discount_rate: rate,
        discount_value: round2(gross - total),
        total,
        system: String(pick(resolved.secaoHoraLabel, s.secaoHoraLabel, s.sistemaTabela, s.sistema, '')),
        vehicle_type: String(pick(s.tipoVeiculoTabela, s.tipoVeiculoTempa, s.tipoVeiculoTemp, s.tipoVeiculo, vehicle?.tipo, '')),
        link_index: s.ciliaPieceIndex != null ? String(s.ciliaPieceIndex) : '',
        part_code: String(pick(s.pecaCodigo, s.codigoPeca, '')),
        part_description: String(pick(s.pecaDesc, s.descricaoPeca, ''))
      };
    });

    const g = os?.deslocamentoGuincho || os?.guincho || {};
    const kmTotal = n(g.kmTotal || 0);
    const franquiaKm = n(g.franquiaKm || 15) || 15;
    const valorSaida = n(g.valorSaida || (g.tipo === 'pesado' ? 463.86 : 253.22));
    const valorKmAdicional = n(g.valorKmAdicional || (g.tipo === 'pesado' ? 16.66 : 8.51));
    const kmExcedente = n(g.kmExcedente || Math.max(kmTotal - franquiaKm, 0));
    const subtotal = n(g.subtotal || (valorSaida + (kmExcedente * valorKmAdicional)));
    const rateTow = discountRate(g.descontoPct ?? g.descPct ?? g.ajustePct ?? 0);
    const totalTow = n(g.total || Math.max(0, subtotal - (subtotal * rateTow)));
    if (g.ativo && totalTow > 0) {
      rows.push({
        key: 's-guincho', code: 'GUINCHO', table_code: '',
        description: `Deslocamento/guincho — ${kmTotal.toFixed(2).replace('.', ',')} km total; franquia ${franquiaKm.toFixed(2).replace('.', ',')} km; excedente ${kmExcedente.toFixed(2).replace('.', ',')} km`,
        hours: 0, unit_value: 0, gross: round2(subtotal), discount_rate: rateTow,
        discount_value: round2(subtotal - totalTow), total: round2(totalTow), system: 'DESLOCAMENTO / GUINCHO', vehicle_type: '', link_index: '', part_code: '', part_description: ''
      });
    }
    return rows;
  }

  function normalizeKey(v) { return String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }

  function groupComposition(parts, services) {
    const groups = parts.map((part, index) => ({ part, index, services: [] }));
    const byLink = new Map();
    const byCode = new Map();
    groups.forEach(g => {
      if (g.part.link_index && !byLink.has(g.part.link_index)) byLink.set(g.part.link_index, g);
      const code = normalizeKey(g.part.code);
      if (code && code !== 'SEM OEM' && !byCode.has(code)) byCode.set(code, g);
    });
    const loose = [];
    services.forEach(service => {
      let group = null;
      if (service.link_index && byLink.has(service.link_index)) group = byLink.get(service.link_index);
      if (!group && service.part_code && byCode.has(normalizeKey(service.part_code))) group = byCode.get(normalizeKey(service.part_code));
      if (!group && service.part_description) {
        const target = normalizeKey(service.part_description);
        group = groups.find(g => target && normalizeKey(g.part.description).includes(target));
      }
      if (group) group.services.push(service); else loose.push(service);
    });
    return { groups, loose_services: loose };
  }

  function safeMedia(os) {
    return (Array.isArray(os?.media) ? os.media : []).filter(m => m && m.url).map(m => ({
      url: String(m.url), type: String(m.type || 'image'), name: String(m.name || ''), uploaded_at: String(m.uploadedAt || m.uploaded_at || '')
    }));
  }

  function safeTimeline(os) {
    return (Array.isArray(os?.timeline) ? os.timeline : []).filter(e => e && e.visivelCliente === true).map(e => ({
      at: String(pick(e.dt, e.data, e.createdAt)),
      by: String(pick(e.user, e.usuario, e.usuarioNome, 'Sistema')),
      action: String(pick(e.acao, e.descricao, e.mensagem)),
      status_before: String(pick(e.statusAnterior, '')),
      status_after: String(pick(e.statusNovo, ''))
    })).filter(e => e.action);
  }

  function orderSnapshot(os, client, vehicle) {
    const parts = partRows(os, client);
    const services = serviceRows(os, client, vehicle);
    const composition = groupComposition(parts, services);
    const totals = {
      parts_original: round2(parts.reduce((s, p) => s + p.gross, 0)),
      parts_discount: round2(parts.reduce((s, p) => s + p.discount_value, 0)),
      parts_total: round2(parts.reduce((s, p) => s + p.total, 0)),
      labor_original: round2(services.reduce((s, p) => s + p.gross, 0)),
      labor_discount: round2(services.reduce((s, p) => s + p.discount_value, 0)),
      labor_total: round2(services.reduce((s, p) => s + p.total, 0))
    };
    totals.grand_total = round2(totals.parts_total + totals.labor_total);
    return {
      id: os.id || '', number: String(pick(os.numero, os.osNumero, os.codigo, String(os.id || '').slice(-6).toUpperCase())),
      status: String(os.status || ''), opened_at: String(pick(os.data, os.createdAt, '')), updated_at: String(pick(os.updatedAt, os.updated_at, '')),
      synced_at: nowISO(), vehicle: publicVehicle(vehicle, os),
      composition, totals, media: safeMedia(os), timeline: safeTimeline(os)
    };
  }

  async function syncOrder(os) {
    if (!manager()) { toast('Apenas Gestor/Admin pode enviar atualizações ao SIGFROTA.', 'warn'); return; }
    if (!os?.id) { toast('Salve a O.S. antes de enviar ao SIGFROTA.', 'warn'); return; }
    const client = clientForOS(os);
    if (!client || !isOfficialClient(client)) { toast('Esta O.S. não pertence a um Cliente Oficial.', 'warn'); return; }
    const vehicle = vehicleForOS(os);
    try {
      const user = await ensureAuth();
      const { db } = ensureFirebase();
      const iid = integrationId(client.id);
      const now = nowISO();
      const office = publicWorkshop();
      const official = publicClient(client);
      const meta = jarvisUserMeta();
      const order = {
        ...orderSnapshot(os, client, vehicle),
        manual_sync: true, manual_sync_at: now, manual_sync_by: meta.name, manual_sync_role: meta.role
      };
      const integrationRef = db.collection('saas2_integrations').doc(iid);
      const currentSnap = await integrationRef.get();
      const current = currentSnap.exists ? currentSnap.data() : {};
      const orders = Array.isArray(current.orders) ? current.orders.filter(x => x && x.manual_sync === true) : [];
      const orderIndex = orders.findIndex(x => String(x.id) === String(order.id));
      if (orderIndex >= 0) orders[orderIndex] = order; else orders.push(order);
      const vehicles = [];
      orders.forEach(x => {
        const v = x?.vehicle;
        if (!v?.id) return;
        const i = vehicles.findIndex(y => String(y.id) === String(v.id));
        if (i >= 0) vehicles[i] = v; else vehicles.push(v);
      });

      const payload = {
        integration_id: iid,
        source: 'SAAS2_CLIENTEOFICIAL',
        tenant_id: W.J?.tid || '',
        official_client_id: client.id,
        saas2_workshop: office,
        official_client: official,
        vehicles,
        orders,
        last_sync_at: now,
        last_sync_ts: Date.now(),
        updated_at: now,
        synced_by: { uid: user.uid, email: user.email || '', saas2_user: meta.name, saas2_role: meta.role },
        chat_enabled: true
      };

      const workshopRef = db.collection('workshops').doc(iid);
      const workshopSnap = await workshopRef.get();
      const existingWorkshop = workshopSnap.exists ? workshopSnap.data() : {};
      const workshopDoc = {
        source: 'SAAS2_CLIENTEOFICIAL', integration_id: iid, saas2_tenant_id: W.J?.tid || '', saas2_client_id: client.id,
        codigo: existingWorkshop.codigo || pick(office.slug, 'S2'), oes_code: existingWorkshop.oes_code || pick(office.slug, 'S2'),
        name: existingWorkshop.name || office.name || 'Oficina', razao_social: existingWorkshop.razao_social || office.legal_name || '',
        cnpj: existingWorkshop.cnpj || office.cnpj || '', address: existingWorkshop.address || office.address || '', city: existingWorkshop.city || office.city || '',
        phone: existingWorkshop.phone || office.phone || '', email: existingWorkshop.email || office.email || '',
        contact_person: existingWorkshop.contact_person || W.J?.nome || '', active: existingWorkshop.active !== false,
        official_client_name: official.name, official_client_cnpj: official.cnpj, official_client_unit: official.unit,
        last_sync_at: now, last_sync_ts: Date.now(), synced_from: 'Jarvis SAAS-2'
      };

      const batch = db.batch();
      batch.set(integrationRef, payload, { merge: true });
      batch.set(workshopRef, workshopDoc, { merge: true });
      const eventRef = db.collection('saas2_sync_events').doc();
      batch.set(eventRef, {
        integration_id: iid, order_id: order.id, order_number: order.number, event_type: 'OS_SYNC', tenant_id: W.J?.tid || '',
        official_client_id: client.id, official_client_name: official.name, workshop_name: workshopDoc.name,
        message: `O.S. ${order.number} atualizada no SIGFROTA.`, created_at: now, ts: Date.now(), sender: 'jarvis', sender_name: meta.name, sender_role: meta.role, sender_uid: meta.uid, sender_email: meta.email
      });
      const auditRef = db.collection('audit_logs').doc();
      batch.set(auditRef, {
        user_id: user.uid, user_name: user.email || 'Integração SAAS-2', user_email: user.email || '', role: 'integracao_saas2',
        action: 'OS_SINCRONIZADA', entity: 'SAAS2Order', record_id: order.id, previous_value: null,
        new_value: { integration_id: iid, order_number: order.number, status: order.status },
        context: { tenant_id: W.J?.tid || '', source: 'JARVIS_SAAS2' }, date_time: now,
        created_at_server: W.firebase.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();

      const localSync = { integrationId: iid, orderId: order.id, lastSyncAt: now, lastSyncTs: Date.now(), projectId: CFG.projectId, status: 'SINCRONIZADO' };
      try {
        const localEntry = {
          tipo:'sigfrota_envio', origem:'SAAS2', eventoId:eventRef.id, acao:'O.S. enviada/atualizada no SIGFROTA',
          usuario:meta.name, perfil:meta.role, data:now, ts:Date.now()
        };
        await W.J.db.collection('ordens_servico').doc(os.id).set({
          sigfrotaSync: localSync,
          timeline: W.firebase.firestore.FieldValue.arrayUnion(localEntry)
        }, { merge:true });
        os.sigfrotaSync = localSync;
        await writeLocalAudit({
          key:eventRef.id, action:'O.S. enviada/atualizada no SIGFROTA', osId:os.id, userName:meta.name, userRole:meta.role,
          detail:'O.S. ' + order.number, source:'SAAS2', eventType:'OS_SYNC', at:Date.now()
        });
      } catch (e) { console.warn('[SIGFROTA] espelho local não atualizado', e); }
      refreshButtons();
      refreshPendingUI();
      toast(`✓ O.S. ${order.number} enviada ao SIGFROTA.`, 'ok');
    } catch (e) {
      console.error('[SIGFROTA sync]', e);
      toast('Falha ao enviar ao SIGFROTA: ' + (e.message || e), 'err');
    }
  }

  function renderChat(messages) {
    const box = document.getElementById('sfChatMessages');
    if (!box) return;
    box.innerHTML = messages.length ? messages.map(m => `<div class="sf-msg ${m.sender === 'jarvis' ? 'jarvis' : 'sigfrota'}"><small>${esc(m.sender_name || (m.sender === 'jarvis' ? 'Jarvis' : 'SIGFROTA'))} · ${esc(new Date(m.created_at || m.ts || Date.now()).toLocaleString('pt-BR'))}${m.sender === 'jarvis' && m.read_sigfrota ? ' · ✓ lida' : ''}</small>${esc(m.text || '').replace(/\n/g, '<br>')}</div>`).join('') : '<div style="text-align:center;color:#8092a7;font-size:.7rem;padding:30px">Nenhuma mensagem ainda.</div>';
    box.scrollTop = box.scrollHeight;
  }

  async function openOrderChat(os) {
    if (!manager()) { toast('Apenas Gestor/Admin pode abrir este chat.', 'warn'); return; }
    const client = clientForOS(os);
    if (!client || !isOfficialClient(client)) return;
    if (!os?.sigfrotaSync?.integrationId) { toast('Envie esta O.S. ao SIGFROTA antes de abrir o chat.', 'warn'); return; }
    try { await ensureAuth(); } catch (_) { return; }
    ensureUi();
    closeModal('sigfrotaChatModal');
    if (chatUnsub) { try { chatUnsub(); } catch (_) {} chatUnsub = null; }
    const iid = integrationId(client.id);
    const overlay = document.createElement('div');
    overlay.className = 'sf-overlay'; overlay.id = 'sigfrotaChatModal';
    overlay.innerHTML = `<div class="sf-modal"><div class="sf-head"><strong>Chat da O.S. ${esc(pick(os.numero, os.osNumero, os.codigo, String(os.id).slice(-6).toUpperCase()))}</strong><button class="sf-x" data-close>×</button></div><div id="sfChatMessages" class="sf-chat"></div><form id="sfChatForm" class="sf-chat-form"><input id="sfChatInput" placeholder="Mensagem para o SIGFROTA..."><button class="sf-btn sf-primary" type="submit">Enviar</button></form></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').onclick = () => { if (chatUnsub) { chatUnsub(); chatUnsub = null; } closeModal('sigfrotaChatModal'); };
    await markOrderUpdatesRead(os);
    chatUnsub = bridgeDb.collection('saas2_chat').where('integration_id', '==', iid).where('order_id', '==', os.id).onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id:d.id, ref:d.ref, ...d.data() })).sort((a,b) => (a.ts || 0) - (b.ts || 0));
      renderChat(list);
      list.filter(m => m.sender === 'sigfrota' && m.read_jarvis !== true).forEach(m => {
        m.ref.update({ read_jarvis:true, read_jarvis_at:nowISO(), read_jarvis_by:jarvisUserMeta().name }).catch(()=>{});
      });
    }, e => toast('Chat: ' + e.message, 'err'));
    overlay.querySelector('#sfChatForm').onsubmit = async ev => {
      ev.preventDefault();
      const input = overlay.querySelector('#sfChatInput'); const msg = input.value.trim(); if (!msg) return;
      input.value = '';
      const now = nowISO();
      const number = String(pick(os.numero, os.osNumero, os.codigo, String(os.id).slice(-6).toUpperCase()));
      const meta = jarvisUserMeta();
      const ts = Date.now();
      const chatRef = await bridgeDb.collection('saas2_chat').add({
        integration_id:iid, order_id:os.id, order_number:number, tenant_id:W.J?.tid || '', client_id:client.id,
        workshop_name:W.J?.tnome || '', official_client_name:client.nome || '', sender:'jarvis', sender_name:meta.name,
        sender_role:meta.role, sender_uid:meta.uid, sender_email:meta.email, sender_bridge_uid:bridgeAuth?.currentUser?.uid || '',
        text:msg, ts, created_at:now, read_jarvis:true, read_sigfrota:false
      });
      const eventRef = await bridgeDb.collection('saas2_sync_events').add({
        integration_id:iid, order_id:os.id, order_number:number, event_type:'CHAT_MESSAGE', tenant_id:W.J?.tid || '',
        official_client_id:client.id, official_client_name:client.nome || '', workshop_name:W.J?.tnome || '',
        message:`Nova mensagem na O.S. ${number}.`, message_text:msg, created_at:now, ts, sender:'jarvis',
        sender_name:meta.name, sender_role:meta.role, sender_uid:meta.uid, sender_email:meta.email, chat_id:chatRef.id
      });
      try {
        await appendLocalTimeline(os.id, {
          tipo:'sigfrota_chat', origem:'SAAS2', eventoId:eventRef.id, acao:msg, usuario:meta.name, perfil:meta.role, data:now, ts
        });
        await writeLocalAudit({
          key:eventRef.id, action:'Mensagem enviada ao SIGFROTA', osId:os.id, userName:meta.name, userRole:meta.role,
          detail:msg, source:'SAAS2', eventType:'CHAT_MESSAGE', at:ts
        });
        await bridgeDb.collection('audit_logs').doc().set({
          user_id:bridgeAuth?.currentUser?.uid || '', user_name:meta.name, user_email:meta.email || bridgeAuth?.currentUser?.email || '',
          role:meta.role || 'integracao_saas2', action:'MENSAGEM_JARVIS_ENVIADA', entity:'SAAS2Order', record_id:String(os.id),
          previous_value:null, new_value:{integration_id:iid,order_number:number,chat_id:chatRef.id}, justification:null,
          context:{source:'JARVIS_SAAS2',tenant_id:W.J?.tid || '',message:msg}, date_time:now,
          created_at_server:W.firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (auditErr) { console.warn('[SIGFROTA] auditoria mensagem', auditErr); }
    };
  }

  function refreshButtons() {
    const syncBtn = document.getElementById('btnSigfrotaOS');
    const chatBtn = document.getElementById('btnSigfrotaChatOS');
    if (!syncBtn || !chatBtn) return;
    const os = currentOS();
    const client = clientForOS(os);
    const show = !!(manager() && os?.id && isOfficialClient(client));
    syncBtn.style.display = show ? '' : 'none';
    chatBtn.style.display = show && !!os?.sigfrotaSync?.integrationId ? '' : 'none';
    if (show) syncBtn.textContent = os?.sigfrotaSync?.integrationId ? '↗ ATUALIZAR NO SIGFROTA' : '↗ ENVIAR AO SIGFROTA';
    renderOSUpdateBanner();
  }

  W.SIGFROTA_INTEGRACAO = {
    sincronizarOSAtual: () => syncOrder(currentOS()),
    abrirChatOSAtual: () => openOrderChat(currentOS()),
    marcarAtualizacoesLidas: () => markOrderUpdatesRead(currentOS()),
    atualizarBotoes: refreshButtons
  };

  function boot() {
    ensureUi();
    // Não inicializa o Firebase do SIGFROTA no carregamento do Jarvis.
    // Envio/atualização e chat continuam disponíveis, mas somente após clique explícito do Gestor/Admin.
    stopGlobalBridgeListener();
    refreshButtons();
    refreshPendingUI();
    setInterval(() => {
      refreshButtons();
      refreshPendingUI();
    }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window);
