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
      @media(max-width:620px){.sf-grid{grid-template-columns:1fr}.sf-modal{width:100%;max-height:94vh}.sf-chat{height:55vh}}
    `;
    document.head.appendChild(style);
  }

  function closeModal(id) { document.getElementById(id)?.remove(); }

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
      const order = orderSnapshot(os, client, vehicle);
      const integrationRef = db.collection('saas2_integrations').doc(iid);
      const currentSnap = await integrationRef.get();
      const current = currentSnap.exists ? currentSnap.data() : {};
      const orders = Array.isArray(current.orders) ? current.orders.slice() : [];
      const orderIndex = orders.findIndex(x => String(x.id) === String(order.id));
      if (orderIndex >= 0) orders[orderIndex] = order; else orders.push(order);
      const vehicles = Array.isArray(current.vehicles) ? current.vehicles.slice() : [];
      const publicV = order.vehicle;
      const vehicleIndex = vehicles.findIndex(x => String(x.id) === String(publicV.id));
      if (vehicleIndex >= 0) vehicles[vehicleIndex] = publicV; else vehicles.push(publicV);

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
        synced_by: { uid: user.uid, email: user.email || '', saas2_user: W.J?.nome || '', saas2_role: role() },
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
        message: `O.S. ${order.number} atualizada no SIGFROTA.`, created_at: now, ts: Date.now(), sender: 'jarvis'
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
        await W.J.db.collection('ordens_servico').doc(os.id).update({ sigfrotaSync: localSync });
        os.sigfrotaSync = localSync;
      } catch (e) { console.warn('[SIGFROTA] espelho local não atualizado', e); }
      refreshButtons();
      toast(`✓ O.S. ${order.number} enviada ao SIGFROTA.`, 'ok');
    } catch (e) {
      console.error('[SIGFROTA sync]', e);
      toast('Falha ao enviar ao SIGFROTA: ' + (e.message || e), 'err');
    }
  }

  function renderChat(messages) {
    const box = document.getElementById('sfChatMessages');
    if (!box) return;
    box.innerHTML = messages.length ? messages.map(m => `<div class="sf-msg ${m.sender === 'jarvis' ? 'jarvis' : 'sigfrota'}"><small>${esc(m.sender_name || (m.sender === 'jarvis' ? 'Jarvis' : 'SIGFROTA'))} · ${esc(new Date(m.created_at || m.ts || Date.now()).toLocaleString('pt-BR'))}</small>${esc(m.text || '').replace(/\n/g, '<br>')}</div>`).join('') : '<div style="text-align:center;color:#8092a7;font-size:.7rem;padding:30px">Nenhuma mensagem ainda.</div>';
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
    chatUnsub = bridgeDb.collection('saas2_chat').where('integration_id', '==', iid).where('order_id', '==', os.id).onSnapshot(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      renderChat(list);
    }, e => toast('Chat: ' + e.message, 'err'));
    overlay.querySelector('#sfChatForm').onsubmit = async ev => {
      ev.preventDefault();
      const input = overlay.querySelector('#sfChatInput'); const msg = input.value.trim(); if (!msg) return;
      input.value = '';
      const now = nowISO();
      const number = String(pick(os.numero, os.osNumero, os.codigo, String(os.id).slice(-6).toUpperCase()));
      await bridgeDb.collection('saas2_chat').add({
        integration_id: iid, order_id: os.id, order_number: number, tenant_id: W.J?.tid || '', client_id: client.id,
        workshop_name: W.J?.tnome || '', official_client_name: client.nome || '', sender: 'jarvis', sender_name: W.J?.nome || 'Jarvis',
        text: msg, ts: Date.now(), created_at: now, read_jarvis: true, read_sigfrota: false
      });
      await bridgeDb.collection('saas2_sync_events').add({
        integration_id: iid, order_id: os.id, order_number: number, event_type: 'CHAT_MESSAGE', tenant_id: W.J?.tid || '',
        official_client_id: client.id, official_client_name: client.nome || '', workshop_name: W.J?.tnome || '',
        message: `Nova mensagem na O.S. ${number}.`, created_at: now, ts: Date.now(), sender: 'jarvis'
      });
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
  }

  W.SIGFROTA_INTEGRACAO = {
    sincronizarOSAtual: () => syncOrder(currentOS()),
    abrirChatOSAtual: () => openOrderChat(currentOS()),
    atualizarBotoes: refreshButtons
  };

  function boot() {
    refreshButtons();
    setInterval(refreshButtons, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window);
