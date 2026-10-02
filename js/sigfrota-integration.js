/*
 * SAAS-2 ↔ SIGFROTA — Cliente Oficial
 * Regra: NADA é enviado automaticamente. A integração só é criada/atualizada
 * quando um gestor/admin do Jarvis clica em "Sincronizar SIGFROTA".
 *
 * O Firebase público abaixo é do SIGFROTA do Brandão. A autenticação usa uma
 * conta real do SIGFROTA e persiste apenas o token Firebase no navegador;
 * a senha não é gravada pelo SAAS-2.
 */
(function(W){
  'use strict';

  const CFG = W.SIGFROTA_BRIDGE_CONFIG || {
    apiKey: 'AIzaSyBGP3xeCIWPPCz5dbZRYzuLyKVj8ZaoHOo',
    authDomain: 'sigfrota-d64d0.firebaseapp.com',
    projectId: 'sigfrota-d64d0',
    storageBucket: 'sigfrota-d64d0.firebasestorage.app',
    messagingSenderId: '99786546073',
    appId: '1:99786546073:web:6b1edeb23c21e7f3665108'
  };
  const APP_NAME = 'sigfrota-bridge-' + String(CFG.projectId || 'app').replace(/[^a-z0-9-]/gi,'-');
  const BOOTSTRAP_UID = 'uwUU8OkzRbfBtlVR1oeT72H0jYE2';
  let bridgeApp=null, bridgeAuth=null, bridgeDb=null;
  let chatUnsub=null, globalChatUnsub=null, globalBootTs=Date.now();
  let pendingAuthResolve=null, pendingAuthReject=null;

  function role(){ return String(W.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase(); }
  function gestor(){ return ['admin','gestor','gerente','superadmin','dono','proprietario','owner'].includes(role()); }
  function esc(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function pick(){ for(const v of arguments){ if(v!==undefined&&v!==null&&String(v).trim()!=='') return v; } return ''; }
  function safeId(v){ return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120); }
  function integrationId(clientId){ return 'saas2_'+safeId(W.J?.tid)+'_'+safeId(clientId); }
  function toast(msg,type){ try{ if(typeof W.toast==='function') return W.toast(msg,type||'ok'); }catch(_){} alert(msg); }

  function ensureFirebase(){
    if(!W.firebase) throw new Error('Firebase não carregado no Jarvis.');
    let app=W.firebase.apps.find(a=>a.name===APP_NAME);
    if(!app) app=W.firebase.initializeApp(CFG,APP_NAME);
    bridgeApp=app;
    if(typeof app.auth!=='function') throw new Error('firebase-auth-compat.js não foi carregado.');
    bridgeAuth=app.auth();
    bridgeDb=app.firestore();
    try{ bridgeAuth.setPersistence(W.firebase.auth.Auth.Persistence.LOCAL); }catch(_){}
    return {app,auth:bridgeAuth,db:bridgeDb};
  }

  function ensureUi(){
    if(document.getElementById('sigfrotaBridgeStyle')) return;
    const style=document.createElement('style');
    style.id='sigfrotaBridgeStyle';
    style.textContent=`
      .sf-overlay{position:fixed;inset:0;background:rgba(4,10,20,.76);z-index:99999;display:grid;place-items:center;padding:16px}
      .sf-modal{width:min(680px,96vw);max-height:90vh;overflow:auto;background:#111a27;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 26px 90px rgba(0,0,0,.48);color:#e7eef8}
      .sf-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.09)}
      .sf-head strong{font-size:.86rem;letter-spacing:.03em}.sf-x{border:0;background:transparent;color:#9aabbd;font-size:1.2rem;cursor:pointer}
      .sf-body{padding:18px}.sf-note{font-size:.72rem;line-height:1.5;color:#9db0c4;margin:0 0 14px}.sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .sf-field label{display:block;font-size:.62rem;font-weight:700;color:#91a4ba;margin-bottom:5px}.sf-field input{width:100%;background:#0c1420;border:1px solid rgba(255,255,255,.13);color:#fff;border-radius:8px;padding:10px;outline:none}
      .sf-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.sf-btn{border:0;border-radius:8px;padding:9px 13px;font-size:.7rem;font-weight:800;cursor:pointer}.sf-primary{background:#d4ad45;color:#111b2b}.sf-ghost{background:#243044;color:#e7eef8}
      .sf-chat{height:360px;overflow:auto;background:#09111c;padding:12px;display:flex;flex-direction:column;gap:8px}.sf-msg{max-width:78%;padding:8px 10px;border-radius:10px;font-size:.73rem;line-height:1.45}.sf-msg.jarvis{align-self:flex-end;background:#17365e}.sf-msg.sigfrota{align-self:flex-start;background:#1d2734}.sf-msg small{display:block;font-size:.55rem;color:#8fa1b4;margin-bottom:3px}.sf-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.09)}.sf-chat-form input{flex:1;background:#0c1420;border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:8px;padding:10px}
      .sf-sync-ok{color:#74d99a;font-size:.66rem;margin-top:8px}.sf-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,0,0,.2);border-top-color:#111;border-radius:50%;animation:sfspin .7s linear infinite}@keyframes sfspin{to{transform:rotate(360deg)}}
      @media(max-width:620px){.sf-grid{grid-template-columns:1fr}.sf-modal{width:100%;max-height:94vh}.sf-chat{height:55vh}}
    `;
    document.head.appendChild(style);
  }

  function closeModal(id){ const el=document.getElementById(id); if(el) el.remove(); }

  function authModal(){
    ensureUi();
    closeModal('sigfrotaAuthModal');
    const overlay=document.createElement('div'); overlay.className='sf-overlay'; overlay.id='sigfrotaAuthModal';
    const guess=String(W.J?.nome||'').includes('@')?W.J.nome:'';
    overlay.innerHTML=`<div class="sf-modal"><div class="sf-head"><strong>Conectar Jarvis ao SIGFROTA</strong><button class="sf-x" data-close>×</button></div><div class="sf-body">
      <p class="sf-note">Esta autenticação é exigida apenas para autorizar a sincronização. Use uma conta <b>Gestor/ADM autorizada no SIGFROTA</b>. A senha não é salva pelo SAAS-2; o Firebase mantém somente a sessão autenticada neste navegador.</p>
      <div class="sf-grid"><div class="sf-field"><label>E-mail SIGFROTA</label><input id="sfAuthEmail" type="email" value="${esc(guess)}"></div><div class="sf-field"><label>Senha SIGFROTA</label><input id="sfAuthPass" type="password"></div></div>
      <div id="sfAuthErr" style="display:none;color:#ff8585;font-size:.68rem;margin-top:9px"></div>
      <div class="sf-actions"><button class="sf-btn sf-ghost" data-close>Cancelar</button><button class="sf-btn sf-primary" id="sfAuthGo">Conectar</button></div>
    </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{closeModal('sigfrotaAuthModal'); pendingAuthReject?.(new Error('Conexão cancelada.')); pendingAuthResolve=pendingAuthReject=null;});
    overlay.querySelector('#sfAuthGo').onclick=async()=>{
      const btn=overlay.querySelector('#sfAuthGo'); const err=overlay.querySelector('#sfAuthErr');
      const email=overlay.querySelector('#sfAuthEmail').value.trim(); const pass=overlay.querySelector('#sfAuthPass').value;
      if(!email||!pass){err.textContent='Informe e-mail e senha.';err.style.display='block';return;}
      btn.disabled=true; btn.innerHTML='<span class="sf-spinner"></span> Conectando'; err.style.display='none';
      try{
        const {auth,db}=ensureFirebase();
        const cred=await auth.signInWithEmailAndPassword(email,pass);
        const prof=await db.collection('users').doc(cred.user.uid).get();
        const data=prof.exists?prof.data():{};
        const perms=Array.isArray(data.permissoes_especiais)?data.permissoes_especiais:[];
        const ok=cred.user.uid===BOOTSTRAP_UID||data.role==='gestor'||data.role==='adm'||perms.includes('acesso_total')||perms.includes('gerenciar_oficinas')||perms.includes('integrar_saas2');
        if(!ok || data.active===false || data.status_usuario==='INATIVO' || data.status_usuario==='EXCLUIDO'){
          await auth.signOut(); throw new Error('Esta conta não possui autorização para integrar SAAS-2 e SIGFROTA.');
        }
        closeModal('sigfrotaAuthModal');
        pendingAuthResolve?.(cred.user); pendingAuthResolve=pendingAuthReject=null;
      }catch(e){err.textContent=e.message||String(e);err.style.display='block';btn.disabled=false;btn.textContent='Conectar';}
    };
  }

  async function ensureAuth(){
    const {auth,db}=ensureFirebase();
    if(auth.currentUser){
      try{
        const prof=await db.collection('users').doc(auth.currentUser.uid).get();
        const d=prof.exists?prof.data():{}; const perms=Array.isArray(d.permissoes_especiais)?d.permissoes_especiais:[];
        if((auth.currentUser.uid===BOOTSTRAP_UID||d.role==='gestor'||d.role==='adm'||perms.includes('acesso_total')||perms.includes('gerenciar_oficinas')||perms.includes('integrar_saas2'))&&d.active!==false&&d.status_usuario!=='INATIVO'&&d.status_usuario!=='EXCLUIDO') return auth.currentUser;
      }catch(_){}
    }
    return new Promise((resolve,reject)=>{pendingAuthResolve=resolve;pendingAuthReject=reject;authModal();});
  }

  function publicWorkshop(){
    const o=W.J?.oficina||{};
    return {
      id:W.J?.tid||'',
      name:pick(o.nomeFantasia,o.nome,W.J?.tnome),
      legal_name:pick(o.razaoSocial,o.razao_social),
      cnpj:pick(o.cnpj,o.doc),
      phone:pick(o.telefone,o.whatsapp,o.phone),
      email:pick(o.email,o.adminEmail),
      address:pick(o.endereco,o.enderecoCompleto),
      city:pick(o.cidade,o.municipio),
      uf:pick(o.uf),
      slug:pick(o.slug,o.publicSlug,o.oficinaSlug),
      brand_name:pick(o.brandName,o.nomeFantasia,W.J?.tnome)
    };
  }

  function publicClient(c){
    return {
      id:c.id||'', name:c.nome||'', cnpj:c.doc||'', email:c.email||'', phone:c.wpp||'',
      address:pick(c.enderecoCompleto,[c.rua,c.num,c.bairro,c.cidade].filter(Boolean).join(', ')), city:c.cidade||'',
      gov_unit:c.govUnidade||'', gov_fiscal:c.govFiscal||'', labor_hour:Number(c.govValorHora||0)||0,
      labor_discount:Number(c.govDescMO||0)||0, parts_discount:Number(c.govDescPeca||0)||0,
      header:c.govCabecalho||'', oes_model:c.govOesModelo||'', type:'governo'
    };
  }

  function publicPart(p,os){
    return {
      code:pick(p.codigo,p.codigoExibicao), description:pick(p.desc,p.descricao,p.descricaoExibicao),
      quantity:Number(p.qtd||1)||1, unit_value:Number(p.venda||0)||0, value:Number(p.valorFinal||p.total||0)||0,
      origin:p.origem||'', cilia_piece_index:p.ciliaPieceIndex||'', cilia_group:p.ciliaGrupo||'',
      cilia_group_order:Number(p.ciliaGrupoOrdem||0)||0, cilia_aggregator:p.ciliaAgrupador||'',
      cilia_position_order:Number(p.ciliaPosicaoOrdem||0)||0, cilia_gross:Number(p.ciliaBruto||0)||0,
      cilia_net:Number(p.ciliaValorLiquido||0)||0, cilia_discount:Number(p.ciliaDesconto||0)||0,
      cilia_piece_id:pick(p.ciliaMeta?.vehiclePieceCiliaId,p.ciliaMeta?.ciliaId,p.vehiclePieceCiliaId,p.ciliaId),
      category:pick(p.ciliaMeta?.category,p.ciliaGrupo,p.categoria), os_id:os.id||'', os_number:pick(os.numero,os.osNumero,os.codigo),
      plate:pick(os.placa,os.veiculoPlaca), os_status:os.status||''
    };
  }

  function isCiliaPart(p){
    const origem=String(p?.origem||'').toLowerCase();
    return origem.includes('cilia') || !!p?.ciliaPieceIndex || !!p?.ciliaGrupo || !!p?.ciliaAgrupador || !!p?.ciliaMeta || Number(p?.ciliaBruto||0)>0 || Number(p?.ciliaValorLiquido||0)>0;
  }

  function snapshot(client){
    const vehicles=(W.J?.veiculos||[]).filter(v=>String(v.clienteId||'')===String(client.id)).map(v=>({
      id:v.id||'', prefix:pick(v.prefixo,v.frota), plate:v.placa||'', model:v.modelo||'', year:v.ano||'', color:v.cor||'', km:v.km||'', type:v.tipo||''
    }));
    const vehicleIds=new Set(vehicles.map(v=>String(v.id)));
    const orders=(W.J?.os||[]).filter(o=>String(o.clienteId||'')===String(client.id)||vehicleIds.has(String(o.veiculoId||''))).map(o=>({
      id:o.id||'', number:pick(o.numero,o.osNumero,o.codigo), status:o.status||'', plate:pick(o.placa,(W.J?.veiculos||[]).find(v=>v.id===o.veiculoId)?.placa),
      vehicle_id:o.veiculoId||'', vehicle_model:pick(o.veiculo,o.modelo,(W.J?.veiculos||[]).find(v=>v.id===o.veiculoId)?.modelo), km:o.km||'',
      date:pick(o.data,o.createdAt), updated_at:pick(o.updatedAt,o.updated_at), total:Number(o.total||0)||0,
      services:(o.servicos||[]).map(s=>({description:pick(s.desc,s.descricao),code:pick(s.codigoTabela,s.codigo),hours:Number(s.tempo||s.horas||0)||0,value:Number(s.valorFinal||s.valor||0)||0,source:s.origem||''})),
      parts:(o.pecas||[]).map(p=>publicPart(p,o))
    }));
    const cilia=[];
    (W.J?.os||[]).filter(o=>String(o.clienteId||'')===String(client.id)||vehicleIds.has(String(o.veiculoId||''))).forEach(o=>(o.pecas||[]).forEach(p=>{if(isCiliaPart(p)) cilia.push(publicPart(p,o));}));
    return {vehicles,orders,cilia};
  }

  async function syncClient(clientId){
    if(!gestor()){toast('Apenas Gestor/Admin do SAAS-2 pode sincronizar com o SIGFROTA.','warn');return;}
    const client=(W.J?.clientes||[]).find(c=>String(c.id)===String(clientId));
    if(!client){toast('Cliente não encontrado.','err');return;}
    if(String(client.tipoCliente||'').toLowerCase()!=='governo'){toast('Somente CLIENTEOFICIAL/governo pode ser sincronizado com o SIGFROTA.','warn');return;}
    try{
      const user=await ensureAuth(); const {db}=ensureFirebase();
      const iid=integrationId(client.id); const now=new Date().toISOString(); const snap=snapshot(client); const office=publicWorkshop(); const official=publicClient(client);
      const payload={
        integration_id:iid, source:'SAAS2_CLIENTEOFICIAL', tenant_id:W.J?.tid||'', official_client_id:client.id,
        saas2_workshop:office, official_client:official, vehicles:snap.vehicles, orders:snap.orders, cilia_parts:snap.cilia,
        last_sync_at:now, last_sync_ts:Date.now(), synced_by:{uid:user.uid,email:user.email||'',saas2_user:W.J?.nome||'',saas2_role:role()}, chat_enabled:true,
        updated_at:now
      };
      const workshopDoc={
        source:'SAAS2_CLIENTEOFICIAL', integration_id:iid, saas2_tenant_id:W.J?.tid||'', saas2_client_id:client.id,
        codigo:pick(office.slug,'S2'), oes_code:pick(office.slug,'S2'), name:office.name||'Oficina SAAS-2', razao_social:office.legal_name||'', cnpj:office.cnpj||'',
        address:office.address||'', city:office.city||'', phone:office.phone||'', email:office.email||'', contact_person:W.J?.nome||'', active:true,
        official_client_name:official.name, official_client_cnpj:official.cnpj, official_client_unit:official.gov_unit,
        last_sync_at:now, last_sync_ts:Date.now(), synced_from:'Jarvis SAAS-2'
      };
      const batch=db.batch();
      batch.set(db.collection('saas2_integrations').doc(iid),payload,{merge:true});
      batch.set(db.collection('workshops').doc(iid),workshopDoc,{merge:true});
      const ev=db.collection('saas2_sync_events').doc();
      batch.set(ev,{integration_id:iid,event_type:'SAAS2_SYNC',tenant_id:W.J?.tid||'',official_client_id:client.id,official_client_name:official.name,workshop_name:office.name,
        message:`${official.name} sincronizado por ${W.J?.tnome||office.name}. ${snap.vehicles.length} viatura(s), ${snap.orders.length} OS, ${snap.cilia.length} peça(s) Cília.`,created_at:now,ts:Date.now(),sender:'jarvis'});
      const auditRef=db.collection('audit_logs').doc();
      batch.set(auditRef,{user_id:user.uid,user_name:user.email||'Integração SAAS-2',user_email:user.email||'',role:'integracao_saas2',action:'SAAS2_SINCRONIZADO',entity:'Workshop',record_id:iid,
        previous_value:null,new_value:{official_client_name:official.name,vehicles:snap.vehicles.length,orders:snap.orders.length,cilia_parts:snap.cilia.length},context:{tenant_id:W.J?.tid||'',source:'JARVIS_SAAS2'},date_time:now,created_at_server:W.firebase.firestore.FieldValue.serverTimestamp()});
      await batch.commit();
      try{
        await W.J.db.collection('clientes').doc(client.id).update({sigfrotaSync:{integrationId:iid,lastSyncAt:now,lastSyncTs:Date.now(),projectId:CFG.projectId,status:'SINCRONIZADO'}});
        client.sigfrotaSync={integrationId:iid,lastSyncAt:now,lastSyncTs:Date.now(),projectId:CFG.projectId,status:'SINCRONIZADO'};
        W.renderClientes?.();
      }catch(e){console.warn('[SIGFROTA] não foi possível gravar espelho local',e);}
      try{W.audit?.('SIGFROTA',`Sincronizou Cliente Oficial ${client.nome} com SIGFROTA (${snap.cilia.length} peças Cília)`);}catch(_){}
      toast(`✓ SIGFROTA atualizado: ${snap.vehicles.length} viatura(s), ${snap.orders.length} OS e ${snap.cilia.length} peça(s) Cília.`,'ok');
    }catch(e){console.error('[SIGFROTA sync]',e);toast('Falha ao sincronizar SIGFROTA: '+(e.message||e),'err');}
  }

  function renderChat(messages){
    const box=document.getElementById('sfChatMessages'); if(!box) return;
    box.innerHTML=messages.length?messages.map(m=>`<div class="sf-msg ${m.sender==='jarvis'?'jarvis':'sigfrota'}"><small>${esc(m.sender_name|| (m.sender==='jarvis'?'Jarvis':'SIGFROTA'))} · ${esc(new Date(m.created_at||m.ts||Date.now()).toLocaleString('pt-BR'))}</small>${esc(m.text||'').replace(/\n/g,'<br>')}</div>`).join(''):'<div style="text-align:center;color:#8092a7;font-size:.7rem;padding:30px">Nenhuma mensagem ainda.</div>';
    box.scrollTop=box.scrollHeight;
  }

  async function openChat(clientId){
    if(!gestor()){toast('Apenas Gestor/Admin pode abrir o chat SIGFROTA.','warn');return;}
    const client=(W.J?.clientes||[]).find(c=>String(c.id)===String(clientId)); if(!client) return;
    if(client.sigfrotaSync?.status!=='SINCRONIZADO'){
      toast('Sincronize este CLIENTEOFICIAL com o SIGFROTA antes de abrir o chat.','warn');
      return;
    }
    try{await ensureAuth();}catch(e){return;}
    ensureUi(); closeModal('sigfrotaChatModal'); if(chatUnsub){try{chatUnsub();}catch(_){}chatUnsub=null;}
    const iid=integrationId(client.id);
    const overlay=document.createElement('div'); overlay.className='sf-overlay'; overlay.id='sigfrotaChatModal';
    overlay.innerHTML=`<div class="sf-modal"><div class="sf-head"><strong>Chat SIGFROTA × Jarvis — ${esc(client.nome)}</strong><button class="sf-x" data-close>×</button></div><div id="sfChatMessages" class="sf-chat"></div><form id="sfChatForm" class="sf-chat-form"><input id="sfChatInput" placeholder="Mensagem para o SIGFROTA..."><button class="sf-btn sf-primary" type="submit">Enviar</button></form></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').onclick=()=>{if(chatUnsub){chatUnsub();chatUnsub=null;}closeModal('sigfrotaChatModal');};
    chatUnsub=bridgeDb.collection('saas2_chat').where('integration_id','==',iid).onSnapshot(snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ts||0)-(b.ts||0)); renderChat(list);
    },e=>toast('Chat SIGFROTA: '+e.message,'err'));
    overlay.querySelector('#sfChatForm').onsubmit=async ev=>{
      ev.preventDefault(); const input=overlay.querySelector('#sfChatInput'); const msg=input.value.trim(); if(!msg)return;
      input.value=''; const now=new Date().toISOString();
      await bridgeDb.collection('saas2_chat').add({integration_id:iid,tenant_id:W.J?.tid||'',client_id:client.id,workshop_name:W.J?.tnome||'',official_client_name:client.nome||'',sender:'jarvis',sender_name:W.J?.nome||'Jarvis',text:msg,ts:Date.now(),created_at:now,read_jarvis:true,read_sigfrota:false});
      await bridgeDb.collection('saas2_sync_events').add({integration_id:iid,event_type:'CHAT_MESSAGE',tenant_id:W.J?.tid||'',official_client_id:client.id,official_client_name:client.nome||'',workshop_name:W.J?.tnome||'',message:`Nova mensagem do Jarvis: ${msg.slice(0,120)}`,created_at:now,ts:Date.now(),sender:'jarvis'});
    };
  }

  function startGlobalChatNotifications(){
    if(!bridgeDb || !W.J?.tid || globalChatUnsub) return;
    try{
      globalChatUnsub=bridgeDb.collection('saas2_chat').where('tenant_id','==',W.J.tid).onSnapshot(snap=>{
        snap.docChanges().forEach(ch=>{
          if(ch.type!=='added') return; const m=ch.doc.data()||{};
          if(m.sender!=='sigfrota'||Number(m.ts||0)<=globalBootTs) return;
          toast(`💬 SIGFROTA: ${m.text||'Nova mensagem'}`,'ok');
        });
      });
    }catch(e){console.warn('[SIGFROTA chat listener]',e);}
  }

  function boot(){
    try{
      ensureFirebase();
      bridgeAuth.onAuthStateChanged(u=>{if(u) startGlobalChatNotifications();});
    }catch(e){console.warn('[SIGFROTA bridge boot]',e.message||e);}
  }

  W.SIGFROTA_INTEGRACAO={
    sincronizarCliente:syncClient,
    abrirChat:openChat,
    conectar:ensureAuth,
    desconectar:async()=>{try{ensureFirebase();await bridgeAuth.signOut();toast('Conexão SIGFROTA encerrada.','ok');}catch(e){toast(e.message,'err');}},
    integrationId
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})(window);
