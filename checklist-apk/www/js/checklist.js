(function(){
'use strict';
const $=id=>document.getElementById(id);
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
const state={db:null,model:null,placa:'',os:[],histItens:[],selected:new Map(),sintomas:new Set(),activeSecId:'',completedSecoes:new Set(),photos:[],audioBlob:null,audioUrl:'',entrega:new Map(),entregaStatus:'em_conferencia',entregaObsFinal:'',theme:localStorage.getItem('chk_theme')||'light',user:null,screen:'screenStart',historicoVisivel:false,allowedRoles:['mecanico','mecânico','tecnico','técnico','gerente','gestor','dono','proprietario','proprietário','administrativo','admin','adminmaster','admin master','master','superadmin','admin oficina','adminoficina','admin_master','admin-master']};
let deferredInstallPrompt=null;
const FB_BASE_CHECKLIST={apiKey:'AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg',authDomain:'hub-thiaguinho.firebaseapp.com',projectId:'hub-thiaguinho',storageBucket:'hub-thiaguinho.firebasestorage.app',messagingSenderId:'453508098543',appId:'1:453508098543:web:305f4d48edd9be40bd6e1a'};
const NORM=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=msg=>{const t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3000)};
const nowISO=()=>new Date().toISOString();
function fmtMoney(v){v=Number(v||0);return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} 
function fmtDate(t){if(!t)return'-';try{return new Date(t).toLocaleDateString('pt-BR')}catch(e){return'-'}}
function ts(v){ if(!v)return 0; if(v.toDate)return v.toDate().getTime(); if(typeof v==='number')return v; const t=Date.parse(v); return isNaN(t)?0:t; }
function placaNorm(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)}
function statusLabel(s){return ({ok:'OK',atencao:'ATENÇÃO',trocar:'TROCAR',na:'N/A'})[s]||'PENDENTE'}
function statusClass(s){return ({ok:'ok',atencao:'warn',trocar:'bad',na:'na'})[s]||''}
function applyTheme(){document.documentElement.dataset.theme=state.theme; localStorage.setItem('chk_theme',state.theme)}
function getStore(k){return sessionStorage.getItem(k)||localStorage.getItem(k)||'';}
function hydrateSessionFromSavedLogin(){
  try{
    const saved=JSON.parse(localStorage.getItem('j_saved_login')||'null');
    const session=saved?.session||null;
    if(session && session.j_tid && session.j_role && session.j_nome){
      Object.entries(session).forEach(([k,v])=>{
        if(v!==undefined && v!==null && !sessionStorage.getItem(k)) sessionStorage.setItem(k,String(v));
      });
      return true;
    }
  }catch(e){}
  return false;
}
function readSession(){
  if(!getStore('j_tid') || !getStore('j_role') || !getStore('j_nome')) hydrateSessionFromSavedLogin();
  const rolePossivel = getStore('j_role') || getStore('j_cargo') || getStore('j_role_master') || getStore('perfil') || getStore('role') || getStore('cargo') || getStore('tipoUsuario') || getStore('userRole') || getStore('usuarioPerfil') || getStore('j_perfil');
  const nomePossivel = getStore('j_nome') || getStore('nome') || getStore('usuarioNome') || getStore('userName') || getStore('displayName');
  const tidPossivel = getStore('j_tid') || getStore('tenantId') || getStore('oficinaId') || getStore('tid');
  const actorPossivel = getStore('j_actor_type') || getStore('actorType') || getStore('origemLogin') || 'jarvis';
  const u={
    tid:tidPossivel,
    role:rolePossivel,
    cargo:getStore('j_cargo') || getStore('cargo') || rolePossivel,
    actorType:actorPossivel,
    nome:nomePossivel,
    tnome:getStore('j_tnome') || getStore('oficinaNome') || getStore('tenantNome'),
    fid:getStore('j_fid')||getStore('j_admin_email')||getStore('uid')||getStore('userId')||'',
    cloudName:getStore('j_cloud_name')||'dmuvm1o6m',
    cloudPreset:getStore('j_cloud_preset')||'evolution'
  };
  try{u.oficina=JSON.parse(sessionStorage.getItem('j_oficina')||localStorage.getItem('j_oficina')||'null')||null}catch(e){u.oficina=null}
  state.user=u; return u;
}
function roleNorm(v){return NORM(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function isRoleAutorizado(role){ const r=roleNorm(role); if(!r)return false; if(r.includes('cliente'))return false; return state.allowedRoles.some(a=>r===a||r.includes(a)); }
function isSessionOk(){ const u=state.user||readSession(); return !!(u.tid && u.nome && isRoleAutorizado(u.role)); }
function isGestao(){
  const u=state.user||readSession();
  const bruto=[u.role,u.cargo,u.actorType,getStore('j_role'),getStore('j_cargo'),getStore('j_perfil'),getStore('perfil'),getStore('cargo'),getStore('role'),getStore('tipoUsuario'),getStore('userRole'),getStore('usuarioPerfil')].filter(Boolean).join(' ');
  const r=roleNorm(bruto);
  if(!r || r.includes('cliente')) return false;
  if(/gerente|gestor|administrativo|admin|master|dono|proprietario|owner|super/.test(r)) return true;
  // Gestor/dono logado pelo Jarvis nem sempre grava cargo em todas as chaves.
  // Se veio do Jarvis/admin e não é equipe/mecânico/cliente, libera ações de gestão.
  const actor=roleNorm(u.actorType||getStore('j_actor_type')||'');
  const temSessao=!!(u.tid && u.nome);
  if(temSessao && /jarvis|admin|gestao|gestor|gerente/.test(actor) && !/equipe|mecanico|mecan|tecnico|cliente/.test(r+' '+actor)) return true;
  return false;
}
function modeloKey(){ return 'CHECKLIST_MODELO_CUSTOM_V14'; }
function legadoKey(){ return 'CHECKLIST_MODELO_CUSTOM_V11'; }
function lerModeloEdicao(){
  try{
    const raw=localStorage.getItem(modeloKey())||localStorage.getItem(legadoKey());
    if(!raw) return {add:{},rename:{},deleted:{},required:{},criticidade:{},auditoria:[]};
    const cfg=JSON.parse(raw)||{};
    if(Array.isArray(cfg) || Object.values(cfg).some(v=>Array.isArray(v))){
      return {add:cfg,rename:{},deleted:{},required:{},criticidade:{},auditoria:[]};
    }
    cfg.add=cfg.add||{}; cfg.rename=cfg.rename||{}; cfg.deleted=cfg.deleted||{}; cfg.required=cfg.required||{}; cfg.criticidade=cfg.criticidade||{}; cfg.auditoria=cfg.auditoria||[];
    return cfg;
  }catch(e){ return {add:{},rename:{},deleted:{},required:{},criticidade:{},auditoria:[]}; }
}
function salvarModeloEdicao(cfg,acao,detalhe){
  try{
    const u=state.user||readSession();
    cfg.auditoria=cfg.auditoria||[];
    cfg.auditoria.push({acao,detalhe,por:u.nome||'',perfil:u.role||'',em:nowISO()});
    localStorage.setItem(modeloKey(),JSON.stringify(cfg));
  }catch(e){console.warn('não salvou edição do modelo',e)}
}
function itemKeyText(v){ return String(v||'').trim(); }
function aplicarModeloEdicoes(){
  if(!state.model) return;
  const cfg=lerModeloEdicao();
  (state.model.secoes||[]).forEach(sec=>{
    const secId=sec.id; sec.itens=sec.itens||[];
    const deleted=(cfg.deleted&&cfg.deleted[secId])||[];
    const ren=(cfg.rename&&cfg.rename[secId])||{};
    sec.itens=sec.itens.map(it=>ren[itemKeyText(it)]||it).filter(it=>!deleted.includes(itemKeyText(it)));
    const add=(cfg.add&&cfg.add[secId])||[];
    add.forEach(it=>{ if(it && !sec.itens.includes(it) && !deleted.includes(it)) sec.itens.push(it); });
  });
}
function carregarModeloCustom(){ aplicarModeloEdicoes(); }
function salvarModeloCustom(secId,item){
  const cfg=lerModeloEdicao(); cfg.add[secId]=cfg.add[secId]||[];
  if(item && !cfg.add[secId].includes(item)) cfg.add[secId].push(item);
  salvarModeloEdicao(cfg,'adicionar_item',{secId,item});
}
function getItemMeta(secId,item){
  const cfg=lerModeloEdicao(); const key=itemKeyText(item);
  return {obrigatorio:!!(cfg.required?.[secId]?.[key]),criticidade:(cfg.criticidade?.[secId]?.[key]||'normal')};
}
function adicionarItemGestao(secId){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode editar itens.');return;}
  const sec=(state.model.secoes||[]).find(x=>x.id===secId); if(!sec)return;
  const nome=prompt('Novo item para a seção '+sec.titulo+':');
  const item=String(nome||'').trim(); if(!item)return;
  sec.itens=sec.itens||[];
  if(!sec.itens.includes(item)){sec.itens.push(item); salvarModeloCustom(secId,item);}
  state.activeSecId=secId; renderGroups(); toast('Item adicionado nesta seção.');
}
function editarItemGestao(sec,it,cur){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode editar item.');return;}
  const novo=prompt('Editar descrição do item:', cur.descricao||it);
  if(!novo || !String(novo).trim())return;
  const n=String(novo).trim();
  const old=itemKeyText(it);
  const cfg=lerModeloEdicao(); cfg.rename[sec.id]=cfg.rename[sec.id]||{}; cfg.rename[sec.id][old]=n;
  salvarModeloEdicao(cfg,'renomear_item',{secId:sec.id,de:old,para:n});
  sec.itens=(sec.itens||[]).map(x=>itemKeyText(x)===old?n:x);
  cur.descricao=n; cur.id=itemId(sec,n);
  cur.editadoPor=(state.user||readSession()).nome||''; cur.editadoPerfil=(state.user||readSession()).role||''; cur.editadoEm=nowISO();
  state.selected.delete(itemId(sec,it)); state.selected.set(cur.id,cur);
  saveDraft(); renderGroups(); toast('Item editado e salvo no modelo da seção.');
}
function excluirItemGestao(sec,it){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode excluir item.');return;}
  const old=itemKeyText(it);
  if(!confirm('Remover este item da seção '+sec.titulo+'?\n\n'+old)) return;
  const cfg=lerModeloEdicao(); cfg.deleted[sec.id]=cfg.deleted[sec.id]||[]; if(!cfg.deleted[sec.id].includes(old)) cfg.deleted[sec.id].push(old);
  salvarModeloEdicao(cfg,'excluir_item',{secId:sec.id,item:old});
  sec.itens=(sec.itens||[]).filter(x=>itemKeyText(x)!==old);
  state.selected.delete(itemId(sec,it));
  saveDraft(); renderGroups(); toast('Item removido desta seção.');
}
function alternarObrigatorioGestao(sec,it){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode alterar obrigatoriedade.');return;}
  const key=itemKeyText(it); const cfg=lerModeloEdicao(); cfg.required[sec.id]=cfg.required[sec.id]||{}; cfg.required[sec.id][key]=!cfg.required[sec.id][key];
  salvarModeloEdicao(cfg,'alternar_obrigatorio',{secId:sec.id,item:key,obrigatorio:cfg.required[sec.id][key]});
  renderGroups(); toast(cfg.required[sec.id][key]?'Item marcado como obrigatório.':'Item deixou de ser obrigatório.');
}
function alterarCriticidadeGestao(sec,it){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode alterar criticidade.');return;}
  const key=itemKeyText(it); const atual=getItemMeta(sec.id,it).criticidade;
  const novo=prompt('Criticidade do item: normal, importante ou critico', atual);
  if(!novo)return; const val=roleNorm(novo).includes('critic')?'critico':roleNorm(novo).includes('import')?'importante':'normal';
  const cfg=lerModeloEdicao(); cfg.criticidade[sec.id]=cfg.criticidade[sec.id]||{}; cfg.criticidade[sec.id][key]=val;
  salvarModeloEdicao(cfg,'alterar_criticidade',{secId:sec.id,item:key,criticidade:val});
  renderGroups(); toast('Criticidade alterada: '+val);
}
function gerenciarSecaoGestao(secId){
  if(!isGestao()){toast('Somente gestor, gerente ou admin pode gerenciar seções.');return;}
  const sec=(state.model.secoes||[]).find(x=>x.id===secId); if(!sec)return;
  const op=prompt('Gerenciar seção '+sec.titulo+'\n\n1 - Adicionar item\n2 - Renomear item\n3 - Excluir item\n4 - Marcar/desmarcar obrigatório\n5 - Alterar criticidade\n\nDigite o número:');
  if(!op)return;
  if(op==='1') return adicionarItemGestao(secId);
  const lista=(sec.itens||[]).map((x,i)=>(i+1)+' - '+x).join('\n');
  const idx=Number(prompt('Escolha o item pelo número:\n\n'+lista));
  const it=(sec.itens||[])[idx-1]; if(!it){toast('Item inválido.');return;}
  if(op==='2') return editarItemGestao(sec,it,state.selected.get(itemId(sec,it))||{id:itemId(sec,it),secao:sec.titulo,tipo:guessTipo(sec,it),descricao:it,status:'',obs:'',photos:[]});
  if(op==='3') return excluirItemGestao(sec,it);
  if(op==='4') return alternarObrigatorioGestao(sec,it);
  if(op==='5') return alterarCriticidadeGestao(sec,it);
}
function excluirChecklistPermitido(){ return isGestao(); }
async function excluirChecklistSalvo(chk){
  if(!excluirChecklistPermitido()){toast('Somente gestor/gerente/admin pode excluir checklist. Perfil atual: '+((state.user||readSession()).role||'não identificado'));return;}
  if(!confirm('Excluir este checklist salvo? Essa ação é restrita a gestores/gerentes/admins e não remove a O.S.'))return;
  const db=initFirebase();
  let removidoBanco=false, removidoLocal=false;
  try{
    if(chk && chk.id && chk._col && db){ await db.collection(chk._col).doc(chk.id).delete(); removidoBanco=true; }
  }catch(e){console.warn('delete firestore',e);}
  try{
    const alvoPlaca=placaNorm(chk?.placa||'');
    const alvoCriado=String(chk?.criadoEm||chk?.createdAt||'');
    const alvoId=String(chk?.id||'');
    const apagar=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k||!k.startsWith('CHECKLIST_')) continue;
      try{ const v=JSON.parse(localStorage.getItem(k)||'null')||{};
        const sameId=alvoId && String(v.id||'')===alvoId;
        const samePlaca=alvoPlaca && placaNorm(v.placa||'')===alvoPlaca;
        const sameCriado=alvoCriado && String(v.criadoEm||v.createdAt||'')===alvoCriado;
        if(sameId || (samePlaca && (!alvoCriado || sameCriado)) || k==='CHECKLIST_ULTIMO_'+alvoPlaca) apagar.push(k);
      }catch(e){}
    }
    apagar.forEach(k=>{localStorage.removeItem(k); removidoLocal=true;});
  }catch(e){console.warn('delete local',e);}
  if(removidoBanco||removidoLocal){toast('Checklist excluído.'); consultarChecklists();}
  else toast('Não encontrei registro apagável. Se ele veio do Firebase, verifique regra de permissão para gestor/gerente.');
}

function applySessionUI(){
  const u=state.user||readSession();
  if($('sessOficina')) $('sessOficina').textContent='🏢 '+(u.tnome||u.oficina?.nome||'Oficina');
  if($('sessMecanico')) $('sessMecanico').textContent='👤 '+(u.nome||'Responsável')+' • '+(u.role||'perfil');
  if($('sessStatus')) $('sessStatus').textContent=isSessionOk()?'✅ Autorizado':'⚠️ Sem sessão autorizada';
  if($('mecanico')) $('mecanico').value=u.nome||'';
  if($('consultaMecanico')) $('consultaMecanico').value=u.nome||'';
}
function go(screen){ if(screen!=='screenAccess' && !isSessionOk()){ screen='screenAccess'; } state.screen=screen;['screenAccess','screenStart','screenConsulta','screenCheck','screenMidia','screenResumo','screenEntrega'].forEach(x=>$(x)?.classList.add('hidden')); $(screen)?.classList.remove('hidden'); const idx=['screenStart','screenCheck','screenMidia','screenResumo','screenEntrega'].indexOf(screen); $$('.step').forEach((s,i)=>s.classList.toggle('on', idx>=i || (screen==='screenConsulta'&&i===0))); updateNav(); window.scrollTo({top:0,behavior:'smooth'});}
function updateNav(){
 const order=['screenStart','screenCheck','screenMidia','screenResumo']; const i=order.indexOf(state.screen);
 if($('btnVoltar')) $('btnVoltar').classList.toggle('hidden',state.screen==='screenAccess');
 if($('btnAvancar')) $('btnAvancar').textContent=state.screen==='screenResumo'?'Finalizado ✅':'Avançar ➜';
}
function nextScreen(){ if(state.screen==='screenStart') go('screenCheck'); else if(state.screen==='screenCheck'){renderMidia();go('screenMidia')} else if(state.screen==='screenMidia'){renderResumo();go('screenResumo')} else if(state.screen==='screenResumo'){ abrirChecklistEntrega(); } else if(state.screen==='screenEntrega'){ finalizarFluxoRapido(); } else go('screenStart'); }
function finalizarFluxoRapido(){ renderResumo(); toast('Checklist finalizado. Use Salvar, PDF, Planilha ou Novo checklist.'); const painel=$('acoesPosFinalizacao'); if(painel) painel.scrollIntoView({behavior:'smooth',block:'center'}); }
function prevScreen(){ if(state.screen==='screenEntrega') go('screenResumo'); else if(state.screen==='screenResumo') go('screenMidia'); else if(state.screen==='screenMidia') go('screenCheck'); else if(state.screen==='screenCheck'||state.screen==='screenConsulta') go('screenStart'); else go('screenStart'); }

function destinoSaaSPorPerfil(){
  const u=state.user||readSession();
  const r=roleNorm(u.role||u.cargo||'');
  if(r.includes('mecanico')||r.includes('mecan')||r.includes('tecnico')||r.includes('tec')) return './equipe.html';
  if(r.includes('gerente')||r.includes('gestor')||r.includes('admin')||r.includes('master')||r.includes('dono')||r.includes('proprietario')||r.includes('super')) return './jarvis.html';
  return './index.html';
}
function abrirSistemaSaaS(){
  const url=destinoSaaSPorPerfil();
  try{ window.open(url,'_blank','noopener'); }
  catch(e){ location.href=url; }
}
async function instalarChecklistApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{ await deferredInstallPrompt.userChoice; }catch(e){}
    deferredInstallPrompt=null;
    toast('Instalação acionada. Confira a tela do celular.');
    return;
  }
  toast('No celular: menu do navegador ⋮ > Adicionar à tela inicial.');
}
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredInstallPrompt=e; const b=$('btnInstalarApp'); if(b) b.textContent='📲 Instalar checklist na tela'; });
window.addEventListener('appinstalled',()=>toast('Checklist instalado na tela do celular.'));

async function boot(){applyTheme(); readSession(); applySessionUI(); bind(); if($('loginUsr')) $('loginUsr').value=localStorage.getItem('j_last_user')||''; await loadModel(); if(!isSessionOk()){ go('screenAccess'); return; } restoreDraft(); renderSymptoms(); renderGroups(); go('screenStart');}
function bind(){
 $('btnLoginChecklist')?.addEventListener('click',loginChecklist);
 $('loginPwd')?.addEventListener('keydown',e=>{if(e.key==='Enter') loginChecklist();});
 $('btnAbrirSaasLogin')?.addEventListener('click',()=>{window.open('https://oficin-ia-com-ia.vercel.app/index.html','_blank','noopener');});
 $('btnTheme')?.addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme()});
 $('btnIrSistema')?.addEventListener('click',abrirSistemaSaaS);
 $('btnIrLoginSaaS')?.addEventListener('click',abrirSistemaSaaS);
 $('btnInstalarApp')?.addEventListener('click',instalarChecklistApp);
 $('btnManualTopo')?.addEventListener('click',imprimirManualUmaPagina);
 $('placa')?.addEventListener('input',e=>{e.target.value=placaNorm(e.target.value)});
 $('consultaPlaca')?.addEventListener('input',e=>{e.target.value=placaNorm(e.target.value)});
 $('btnBuscarPlaca')?.addEventListener('click',buscarHistorico);
 $('btnNovo')?.addEventListener('click',novoChecklist);
 $('btnAbrirConsulta')?.addEventListener('click',()=>{go('screenConsulta'); consultarChecklists();});
 $('btnFecharConsulta')?.addEventListener('click',()=>go('screenStart'));
 $('btnConsultar')?.addEventListener('click',consultarChecklists);
 $('buscaItem')?.addEventListener('input',()=>{ const q=NORM($('buscaItem')?.value||''); if(q) state.activeSecId=''; renderGroups(); });
 $('btnAudio')?.addEventListener('click',toggleAudio);
 $('btnDitar')?.addEventListener('click',ditarTexto);
 $('fotoGeral')?.addEventListener('change',e=>addPhotos(e.target.files,'geral','Fotos gerais'));
 $('btnSalvar')?.addEventListener('click',salvarChecklist);
 $('btnPDF')?.addEventListener('click',gerarPDF);
 $('btnXLSX')?.addEventListener('click',gerarXLSX);
 $('btnJSON')?.addEventListener('click',baixarJSON);
 $('btnPrintManual')?.addEventListener('click',imprimirManualUmaPagina);
 $('btnImportOS')?.addEventListener('click',enviarParaOS);
 $('btnAbrirEntrega')?.addEventListener('click',abrirChecklistEntrega);
 $('btnSalvarEntrega')?.addEventListener('click',salvarChecklistEntrega);
 $('btnAnexarEntregaOS')?.addEventListener('click',anexarEntregaNaOS);
 $('btnPdfEntrega')?.addEventListener('click',gerarPDFEntrega);
 $('btnVoltarResumoEntrega')?.addEventListener('click',()=>go('screenResumo'));
 $('entregaStatus')?.addEventListener('change',e=>{state.entregaStatus=e.target.value; saveDraft();});
 $('entregaObsFinal')?.addEventListener('input',e=>{state.entregaObsFinal=e.target.value; saveDraft();});
 $('btnNovoFinal')?.addEventListener('click',novoChecklist);
 $('btnInicioFinal')?.addEventListener('click',()=>go('screenStart'));
 $('btnConsultaFinal')?.addEventListener('click',()=>{go('screenConsulta'); consultarChecklists();});
 $('btnVerHistoricoFinal')?.addEventListener('click',()=>{state.historicoVisivel=true; renderHistoricoDetalhado(); go('screenStart'); setTimeout(()=>document.getElementById('historicoDetalhado')?.scrollIntoView({behavior:'smooth',block:'start'}),100);});
 $('btnVoltar')?.addEventListener('click',prevScreen);
 $('btnAvancar')?.addEventListener('click',nextScreen);
 window.addEventListener('beforeunload',saveDraft);
}
async function loadModel(){
 try{ const r=await fetch('./data/checklist-model.json?ts=20260623v14',{cache:'no-store'}); state.model=await r.json(); carregarModeloCustom(); }
 catch(e){ console.error(e); state.model={sintomas:[],secoes:[],sugestoes:{}}; toast('Modelo não carregado.'); }
}
function firebaseConfig(){
 try{ const cfg=JSON.parse(sessionStorage.getItem('j_firebase_config')||localStorage.getItem('j_firebase_config')||'null'); if(cfg&&cfg.apiKey&&cfg.projectId) return cfg; }catch(e){}
 try{ const saved=JSON.parse(localStorage.getItem('j_saved_login')||'null'); const cfg=JSON.parse(saved?.session?.j_firebase_config||'null'); if(cfg&&cfg.apiKey&&cfg.projectId) return cfg; }catch(e){}
 return window.JARVIS_FB_CONFIG || window.APP_CONFIG?.firebaseConfig || window.firebaseConfig || window.cfg?.firebaseConfig || window.__firebaseConfig || FB_BASE_CHECKLIST;
}
function initFirebase(){
 if(state.db) return state.db;
 try{
   const cfg=firebaseConfig(); if(!window.firebase||!cfg) return null;
   const appName=(cfg.projectId&&cfg.projectId!=='hub-thiaguinho')?('tenant-'+String(cfg.projectId).replace(/[^a-z0-9-]/gi,'-')):undefined;
   let app;
   if(appName) app=firebase.apps.find(a=>a.name===appName)||firebase.initializeApp(cfg,appName); else app=firebase.apps[0]||firebase.initializeApp(cfg);
   state.db=app.firestore(); return state.db;
 }catch(e){console.warn('Firebase indisponível',e); return null;}
}

function _normalizarEmailChecklist(v){return String(v||'').trim().toLowerCase();}
function _emailValidoChecklist(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
function _hexDimChecklist(hex,alpha){try{const c=String(hex||'#3B82F6').replace('#','');const r=parseInt(c.substring(0,2),16),g=parseInt(c.substring(2,4),16),b=parseInt(c.substring(4,6),16);return `rgba(${r},${g},${b},${alpha})`;}catch(e){return `rgba(59,130,246,${alpha})`;}}
function _dadosOficinaSessaoChecklist(d){return {nome:d.nomeFantasia||d.nome||'Oficina',razaoSocial:d.razaoSocial||'',cnpj:d.cnpj||'',telefone:d.telefone||d.whatsapp||'',endereco:d.endereco||'',cidade:d.cidade||'',uf:d.uf||'',nicho:d.nicho||'carros',apiKeys:d.apiKeys||{},brandName:d.brandName||d.nomeFantasia||'OFICIN-IA',brandColor:d.brandColor||'#3B82F6',modulos:d.modulos||{},submodulos:d.submodulos||{},slug:d.slug||d.publicSlug||d.oficinaSlug||'',publicBaseUrl:d.publicBaseUrl||d.linksPublicos?.baseUrl||''};}
function _cargoLabelChecklist(v){return String(v||'').trim()||'mecanico';}
function _normalizarCargoChecklist(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function _cargoAcessoJarvisChecklist(v){return /^(gerente|gestor|dono|proprietario|owner|admin|administrador|master|superadmin)$/.test(_normalizarCargoChecklist(v));}
async function _buscarOficinaPorLoginAdminChecklist(db,usr){
 const raw=String(usr||'').trim(); const email=_normalizarEmailChecklist(raw); const tentativas=[{campo:'usuario',op:'==',valor:raw}];
 if(_emailValidoChecklist(raw)){ if(email!==raw) tentativas.push({campo:'usuario',op:'==',valor:email}); const candidatos=[...new Set([email,raw])]; ['adminEmails','emailsAdmin','adminsEmails'].forEach(campo=>candidatos.forEach(valor=>tentativas.push({campo,op:'array-contains',valor}))); }
 for(const t of tentativas){ if(!t.valor) continue; try{ const snap=await db.collection('oficinas').where(t.campo,t.op,t.valor).limit(1).get(); if(!snap.empty) return {doc:snap.docs[0],adminEmail:t.op==='array-contains'?email:''}; }catch(e){console.warn('[checklist login oficina]',t.campo,e.message);} }
 return null;
}
function _dbPorFirebaseConfigChecklist(cfg){ if(!cfg||!cfg.apiKey||!cfg.projectId) return null; const appName='checklist-tenant-'+String(cfg.projectId).replace(/[^a-z0-9-]/gi,'-'); let app=firebase.apps.find(a=>a.name===appName); if(!app) app=firebase.initializeApp(cfg,appName); return app.firestore(); }
async function _buscarFuncionarioPorLoginChecklist(db,usr){
 const centralSnap=await db.collection('funcionarios').where('usuario','==',usr).limit(1).get();
 if(!centralSnap.empty){ const docF=centralSnap.docs[0], dF=docF.data(); const mae=await db.collection('oficinas').doc(dF.tenantId).get(); return {docF,dF,mae,maeData:mae.exists?mae.data():null,tenantId:dF.tenantId,tenantDb:db}; }
 const oficinas=await db.collection('oficinas').get();
 for(const ofDoc of oficinas.docs){ const ofi=ofDoc.data()||{}; if(ofi.status==='Bloqueado') continue; const tdb=_dbPorFirebaseConfigChecklist(ofi.firebaseConfig); if(!tdb) continue; try{ const snapFn=await tdb.collection('funcionarios').where('usuario','==',usr).limit(1).get(); if(!snapFn.empty){ const docF=snapFn.docs[0]; return {docF,dF:docF.data(),mae:ofDoc,maeData:ofi,tenantId:ofDoc.id,tenantDb:tdb}; } }catch(e){console.warn('[checklist login funcionário]',ofDoc.id,e.message);} }
 return null;
}
function _salvarSessaoChecklist(sessao,usr,pwd,lembrar,brand){ Object.entries(sessao).forEach(([k,v])=>{ if(v!==undefined&&v!==null){ sessionStorage.setItem(k,String(v)); if(lembrar) localStorage.setItem(k,String(v)); }}); localStorage.setItem('j_last_user',usr||''); if(lembrar){ localStorage.setItem('j_saved_login',JSON.stringify({usr,pwd,destino:'checklist.html',tid:sessao.j_tid,session:sessao})); if(brand) localStorage.setItem('j_saved_brand',JSON.stringify(brand)); } }
async function loginChecklist(){
 const usr=String($('loginUsr')?.value||'').trim(); const pwd=String($('loginPwd')?.value||'').trim(); const lembrar=!!$('loginRemember')?.checked; const lgpd=!!$('loginLgpd')?.checked; const err=$('loginErr');
 if(err){err.classList.add('hidden'); err.textContent='';}
 if(!lgpd){ if(err){err.textContent='Aceite o uso interno/LGPD para acessar.';err.classList.remove('hidden');} return; }
 if(!usr||!pwd){ if(err){err.textContent='Preencha usuário e senha.';err.classList.remove('hidden');} return; }
 const btn=$('btnLoginChecklist'); if(btn){btn.disabled=true; btn.textContent='Autenticando...';}
 try{
   const cfg=FB_BASE_CHECKLIST; const app=firebase.apps.find(a=>a.name==='checklist-login-central')||firebase.initializeApp(cfg,'checklist-login-central'); const centralDb=app.firestore();
   if(usr.includes('@')){ try{ await app.auth().signInWithEmailAndPassword(usr,pwd); const sess={j_tid:'MASTER_ADMIN',j_tnome:'MASTER',j_role:'superadmin',j_nome:usr,j_admin_email:usr,j_actor_type:'checklist',j_firebase_config:JSON.stringify(cfg)}; _salvarSessaoChecklist(sess,usr,pwd,lembrar,{name:'OFICIN-IA Checklist',color:'#3B82F6'}); readSession(); applySessionUI(); restoreDraft(); renderSymptoms(); renderGroups(); go('screenStart'); toast('Login autorizado.'); return; }catch(e){ console.log('Auth principal não autorizou, verificando oficinas/funcionários.'); } }
   const loginOficina=await _buscarOficinaPorLoginAdminChecklist(centralDb,usr);
   if(loginOficina){ const doc=loginOficina.doc, d=doc.data(); if(d.senha!==pwd) throw new Error('Senha incorreta.'); if(d.status==='Bloqueado') throw new Error('Licença bloqueada.'); const brand={name:d.brandName||d.nomeFantasia||'OFICIN-IA',tagline:d.brandTagline||'Checklist técnico',logoLetter:d.brandLetter||(d.nomeFantasia||'C').charAt(0).toUpperCase(),color:d.brandColor||'#3B82F6',footer:d.brandFooter||`${d.nomeFantasia||'Oficina'} · Powered by thIAguinho Soluções`}; brand.colorDim=_hexDimChecklist(brand.color,.12); brand.colorGlow=_hexDimChecklist(brand.color,.25); const sess={j_tid:doc.id,j_tnome:d.nomeFantasia||'Oficina',j_role:'admin',j_cargo:'gestor',j_actor_type:'checklist',j_nome:loginOficina.adminEmail||usr,j_admin_email:loginOficina.adminEmail||(_emailValidoChecklist(usr)?_normalizarEmailChecklist(usr):''),j_nicho:d.nicho||'carros',j_cloud_name:d.apiKeys?.cloudName||'dmuvm1o6m',j_cloud_preset:d.apiKeys?.cloudPreset||'evolution',j_oficina:JSON.stringify(_dadosOficinaSessaoChecklist(d)),j_brand:JSON.stringify(brand)}; if(d.firebaseConfig?.projectId&&d.firebaseConfig?.apiKey) sess.j_firebase_config=JSON.stringify(d.firebaseConfig); _salvarSessaoChecklist(sess,usr,pwd,lembrar,brand); readSession(); applySessionUI(); restoreDraft(); renderSymptoms(); renderGroups(); go('screenStart'); toast('Login de gestão autorizado.'); return; }
   const loginFunc=await _buscarFuncionarioPorLoginChecklist(centralDb,usr);
   if(loginFunc){ const dF=loginFunc.dF, mae=loginFunc.mae, maeData=loginFunc.maeData||{}; if(dF.senha!==pwd) throw new Error('Senha incorreta.'); if(!mae.exists||maeData.status==='Bloqueado') throw new Error('Oficina bloqueada.'); const cargo=_cargoLabelChecklist(dF.cargo||'mecanico'); const acessoJarvis=_cargoAcessoJarvisChecklist(cargo); const brand={name:maeData.brandName||maeData.nomeFantasia||'OFICIN-IA',logoLetter:maeData.brandLetter||(maeData.nomeFantasia||'C').charAt(0).toUpperCase(),color:maeData.brandColor||'#3B82F6',footer:maeData.brandFooter||`${maeData.nomeFantasia||'Oficina'} · Powered by thIAguinho Soluções`}; brand.colorDim=_hexDimChecklist(brand.color,.12); const sess={j_tid:loginFunc.tenantId||dF.tenantId,j_tnome:maeData.nomeFantasia||'Oficina',j_role:acessoJarvis?'admin':cargo,j_cargo:cargo,j_cargo_acesso:acessoJarvis?'jarvis':'equipe',j_actor_type:'checklist',j_nome:dF.nome,j_fid:loginFunc.docF.id,j_comissao:String(dF.comissao||0),j_nicho:maeData.nicho||'carros',j_cloud_name:maeData.apiKeys?.cloudName||'dmuvm1o6m',j_cloud_preset:maeData.apiKeys?.cloudPreset||'evolution',j_oficina:JSON.stringify(_dadosOficinaSessaoChecklist(maeData)),j_brand:JSON.stringify(brand)}; if(maeData.firebaseConfig?.projectId&&maeData.firebaseConfig?.apiKey) sess.j_firebase_config=JSON.stringify(maeData.firebaseConfig); _salvarSessaoChecklist(sess,usr,pwd,lembrar,brand); readSession(); applySessionUI(); restoreDraft(); renderSymptoms(); renderGroups(); go('screenStart'); toast('Login autorizado.'); return; }
   throw new Error('Usuário não encontrado no sistema.');
 }catch(e){ if(err){err.textContent=e.message||String(e);err.classList.remove('hidden');} }
 finally{ if(btn){btn.disabled=false; btn.textContent='Entrar no Checklist';} }
}
function logoutChecklist(){ ['j_tid','j_tnome','j_role','j_cargo','j_cargo_acesso','j_actor_type','j_nome','j_fid','j_comissao','j_nicho','j_cloud_name','j_cloud_preset','j_oficina','j_brand','j_firebase_config','j_admin_email'].forEach(k=>{sessionStorage.removeItem(k); localStorage.removeItem(k);}); localStorage.removeItem('j_saved_login'); state.user=null; readSession(); applySessionUI(); go('screenAccess'); }

function tenantFields(){ const u=state.user||readSession(); return {tenantId:u.tid, oficinaId:u.tid, tid:u.tid}; }
function tenantOk(o){ const u=state.user||readSession(); return !u.tid || !o || !('tenantId' in o || 'oficinaId' in o || 'tid' in o) || o.tenantId===u.tid || o.oficinaId===u.tid || o.tid===u.tid; }
function placaFromOS(o){ return placaNorm(o?.placa||o?.placaNorm||o?.placaBusca||o?.veiculoPlaca||o?.placaVeiculo||o?.dadosVeiculo?.placa||o?.veiculo?.placa||o?.carro?.placa||o?.auto?.placa||''); }
async function getDocsFromCol(db,col,limit=1200){
 const u=state.user||readSession(); let docs=[];
 const mapSnap=(snap)=>snap.docs.map(d=>({id:d.id,_col:col,...d.data()}));
 const filtrosTenant=[['tenantId',u.tid],['oficinaId',u.tid],['tid',u.tid]].filter(x=>x[1]);
 for(const [campo,valor] of filtrosTenant){
   try{ const snap=await db.collection(col).where(campo,'==',valor).limit(limit).get(); docs=docs.concat(mapSnap(snap)); if(docs.length) break; }catch(e){}
 }
 if(!docs.length){
   try{ const snap=await db.collection(col).limit(limit).get(); docs=mapSnap(snap).filter(tenantOk); }catch(e2){ console.warn('coleção indisponível',col,e2.message); }
 }
 return docs;
}
async function buscarOSPorPlacaDireto(db,col,placa){
 const variantes=Array.from(new Set([placa, placa.replace(/([A-Z]{3})([0-9A-Z]{4})/,'$1-$2'), placa.toLowerCase()]));
 const campos=['placa','placaNorm','placaBusca','placaVeiculo','veiculoPlaca','dadosVeiculo.placa','veiculo.placa','carro.placa','auto.placa'];
 const out=[];
 for(const campo of campos){
   for(const valor of variantes){
     try{ const snap=await db.collection(col).where(campo,'==',valor).limit(80).get(); snap.docs.forEach(d=>out.push({id:d.id,_col:col,...d.data()})); }catch(e){}
   }
 }
 return out.filter(tenantOk);
}

function cacheOSLocalDaSessao(){
 const out=[];
 try{ if(Array.isArray(window.J?.os)) out.push(...window.J.os.map(o=>({id:o.id,_col:'window.J.os',...o}))); }catch(e){}
 try{ if(Array.isArray(window.J?.ordens)) out.push(...window.J.ordens.map(o=>({id:o.id,_col:'window.J.ordens',...o}))); }catch(e){}
 const keys=['J_OS_CACHE','JARVIS_OS_CACHE','OFICINIA_OS_CACHE','dbOS','ordens_servico_cache','os_cache'];
 keys.forEach(k=>{ try{ const raw=sessionStorage.getItem(k)||localStorage.getItem(k); if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)) out.push(...arr.map(o=>({id:o.id,_col:k,...o}))); } }catch(e){} });
 return out;
}
function camposDataOS(o){ return ts(o.dataEntrada||o.entrada||o.criadoEm||o.createdAt||o.updatedAt||o.data||o.dataAbertura||o.dataOS||o.finalizadoEm||o.entregueEm); }
function osRefMatch(o,ref){
 const r=NORM(ref); if(!r)return false;
 return [o.id,o.numero,o.codigo,o.cod,o.osId,o.numeroOS,o.nOS,o.prisma,o.prismaNumero,o.referencia].some(v=>NORM(v)===r || (NORM(v)&&NORM(v).includes(r)));
}

async function buscarHistorico(){
 state.placa=placaNorm($('placa').value); if(!state.placa){toast('Digite a placa.');return;}
 $('historicoResumo').innerHTML='<div class="notice">🔎 Buscando histórico real da placa no SaaS...</div>';
 state.os=[]; state.histItens=[]; state.historicoVisivel=true;
 const local=cacheOSLocalDaSessao().filter(o=>placaFromOS(o)===state.placa);
 state.os.push(...local);
 const db=initFirebase();
 if(!db && !state.os.length){ $('historicoResumo').innerHTML='<div class="notice warn">Não consegui carregar Firebase nem cache local. Abra pelo Jarvis/equipe logado e tente novamente.</div>'; go('screenCheck'); return; }
 const cols=['ordens_servico','ordensServico','os','ordens','ordensServicoFinalizadas','historico_os','servicos','ordensDeServico'];
 if(db){
   for(const col of cols){
     const diretos=await buscarOSPorPlacaDireto(db,col,state.placa);
     state.os.push(...diretos.filter(o=>placaFromOS(o)===state.placa));
   }
   if(!state.os.length){
     for(const col of cols){ const docs=await getDocsFromCol(db,col,2200); state.os.push(...docs.filter(o=>placaFromOS(o)===state.placa)); }
   }
 }
 const seen=new Set(); state.os=state.os.filter(o=>{const k=(o._col||'')+'-'+(o.id||o.numero||o.codigo||JSON.stringify(o).slice(0,80)); if(seen.has(k))return false; seen.add(k); return true;}).sort((a,b)=>camposDataOS(b)-camposDataOS(a));
 state.histItens=extrairHistorico(state.os);
 renderHistoricoResumo(); renderGroups(); go('screenCheck'); saveDraft();
 if(state.os.length) toast(`Histórico carregado: ${state.os.length} O.S. e ${state.histItens.length} itens.`); else toast('Nenhum histórico encontrado para a placa.');
}

function extrairHistorico(lista){
 const out=[];
 lista.forEach(o=>{
   const base={osId:o.numero||o.codigo||o.id,docId:o.id,col:o._col,status:o.status||'',data:ts(o.dataEntrada||o.entrada||o.criadoEm||o.createdAt||o.data),cliente:o.clienteNome||o.cliente||o.nomeCliente||o.cliente?.nome||'',veiculo:o.veiculo||o.modelo||o.veiculoModelo||o.veiculo?.modelo||'',km:o.km||o.kmEntrada||o.kmAtual||'',total:o.total||o.valorTotal||0};
   const fontes=[['Peças da O.S.',o.pecas],['Peças orçamento',o.pecasOS||o.itensPecas||o.pecasOrcamento],['Peças reais',o.pecasReais||o.pecasRealmenteTrocadas||o.itensReais],['Peças trocadas',o.pecasTrocadas||o.pecasExecutadas],['Peças aplicadas',o.pecasAplicadas||o.aplicacoes],['Serviços',o.servicos||o.servicosOS||o.itensServicos],['Serviços executados',o.servicosExecutados||o.maoDeObraExecutada],['Mão de obra',o.maoDeObra||o.maosObra||o.maoDeObraItens],['Itens',o.itens||o.items],['Itens aprovados',o.itensAprovados||o.aprovados],['Checklist anterior',o.checklistItens||o.checklistsTecnicos]];
   fontes.forEach(([fonte,arr])=>{ if(!Array.isArray(arr)) return; arr.forEach(x=>{ const desc=x.descricao||x.desc||x.nome||x.servico||x.peca||x.item||x.titulo||''; if(!desc)return; out.push({...base,fonte,tipo:fonte.toLowerCase().includes('peç')?'peça':'serviço',descricao:desc,norm:NORM(desc),codigo:x.codigo||x.cod||x.codigoOriginal||'',qtd:x.qtd||x.quantidade||1,valor:x.valor||x.total||x.valorVenda||x.venda||0}); }); });
   ['diagnostico','diagnosticoTecnico','diagnosticoInterno','relato','observacoes','obs','defeito','queixa'].forEach(k=>{ if(o[k]) out.push({...base,fonte:k,tipo:'texto',descricao:o[k],norm:NORM(o[k])}); });
 });
 return out;
}
function renderHistoricoResumo(){
 const box=$('historicoResumo');
 if(!state.os.length){box.innerHTML='<div class="notice warn">Nenhuma O.S. encontrada para essa placa. O checklist continua funcionando e será salvo com a placa informada.</div>'; renderHistoricoDetalhado(); return;}
 const ult=state.os[0];
 box.innerHTML=`<div class="hist-card"><b>✅ Histórico carregado da placa ${esc(state.placa)}</b><br>${state.os.length} O.S. • ${state.histItens.length} peças/serviços/textos encontrados<br><span>Última O.S.: ${esc(ult.numero||ult.codigo||ult.id)} • ${fmtDate(camposDataOS(ult))} • ${esc(ult.status||'')}</span><div style="margin-top:8px;display:grid;grid-template-columns:1fr;gap:6px"><button class="btn small secondary" id="btnVerHistoricoPlaca" type="button">📜 Ver/ocultar histórico completo</button></div></div>`;
 setTimeout(()=>{$('btnVerHistoricoPlaca')?.addEventListener('click',()=>{state.historicoVisivel=!state.historicoVisivel; renderHistoricoDetalhado();});},0); renderHistoricoDetalhado();
}

function renderHistoricoDetalhado(){
 const box=$('historicoDetalhado'); if(!box)return;
 if(!state.historicoVisivel){ box.innerHTML=''; return; }
 if(!state.os.length){ box.innerHTML='<div class="notice warn">Sem histórico encontrado para esta placa.</div>'; return; }
 const osHtml=state.os.slice(0,12).map(o=>`<div class="consulta-card"><b>O.S. ${esc(o.numero||o.codigo||o.id)} • ${esc(o.status||'-')}</b><small>${fmtDate(ts(o.dataEntrada||o.entrada||o.criadoEm||o.createdAt||o.data))} • ${esc(o.clienteNome||o.cliente||o.nomeCliente||o.cliente?.nome||'-')} • ${esc(o.veiculo||o.modelo||o.veiculoModelo||o.veiculo?.modelo||'-')}</small></div>`).join('');
 const itensHtml=state.histItens.slice(0,80).map(h=>`<div class="hist-line"><b>${esc(h.descricao)}</b><span>${fmtDate(h.data)} • O.S. ${esc(h.osId)} • ${esc(h.fonte)} ${h.km?'• KM '+esc(h.km):''}</span></div>`).join('');
 box.innerHTML=`<div class="card hist-full"><div class="title"><h2>📜 Histórico da placa ${esc(state.placa)}</h2><button class="btn small secondary" id="btnOcultarHistorico" type="button">Ocultar</button></div><div class="notice">Histórico puxado do SaaS para ajudar o mecânico a decidir sem procurar O.S. manualmente.</div><h3>Últimas O.S.</h3>${osHtml||'<div class="notice warn">Sem O.S.</div>'}<h3>Peças, serviços e textos encontrados</h3>${itensHtml||'<div class="notice warn">Sem itens técnicos extraídos.</div>'}</div>`;
 setTimeout(()=>{$('btnOcultarHistorico')?.addEventListener('click',()=>{state.historicoVisivel=false; renderHistoricoDetalhado();});},0);
}
function renderSymptoms(){
 const box=$('symptoms'); if(!box||!state.model)return; box.innerHTML='';
 (state.model.sintomas||[]).forEach(s=>{
   const secId=(s.abrir&&s.abrir[0])||s.id; const prog=secProgress(secId);
   const b=document.createElement('button'); b.type='button'; b.className='symptom'+(state.activeSecId===secId?' active':'')+(state.completedSecoes.has(secId)?' done':'');
   b.innerHTML=`<span class="draw">${s.emoji}</span><span>${esc(s.label)}<span class="prog">${prog.txt}</span></span>`;
   b.onclick=()=>abrirSecao(secId,true); box.appendChild(b);
 });
}
function abrirSecao(secId,scroll){ state.activeSecId=secId; state.sintomas.clear(); const sint=(state.model.sintomas||[]).find(s=>(s.abrir||[]).includes(secId)); if(sint) state.sintomas.add(sint.id); renderSymptoms(); renderGroups(); if(scroll)setTimeout(()=>{ const alvo=document.getElementById('sec-'+secId)||document.getElementById('groups'); alvo?.scrollIntoView({behavior:'smooth',block:'start'}); },80); saveDraft(); }
function concluirSecao(secId){ state.completedSecoes.add(secId); state.activeSecId=''; saveDraft(); renderSymptoms(); renderGroups(); toast('Seção concluída e minimizada.'); setTimeout(()=>document.getElementById('symptoms')?.scrollIntoView({behavior:'smooth',block:'start'}),60); }
function secProgress(secId){ const sec=(state.model.secoes||[]).find(x=>x.id===secId); if(!sec)return {done:0,total:0,crit:0,txt:'toque para abrir'}; let done=0,crit=0,total=(sec.itens||[]).length; (sec.itens||[]).forEach(it=>{const cur=state.selected.get(itemId(sec,it)); if(cur&&cur.status){done++; if(cur.status==='trocar'||cur.status==='atencao')crit++;}}); return {done,total,crit,txt: done?`${done}/${total} avaliados${crit?' • '+crit+' críticos':''}`:'toque para abrir'}; }
function itemId(sec,item){return `${sec.id}__${NORM(item).replace(/\s+/g,'_')}`;}
function termosItem(item){ const mapa={PASTILHA:['PASTILHA','PASTILHAS'],FREIO:['FREIO','FREIOS'],DIANTEIRA:['DIANTEIRA','DIANTEIRO','FRENTE'],TRASEIRA:['TRASEIRA','TRASEIRO'],AMORTECEDOR:['AMORTECEDOR','AMORT'],BORRACHA:['BORRACHA','BORRACHAS'],LAMPADA:['LAMPADA','LAMPADAS','LUZ'],PALHETA:['PALHETA','PALHETAS'],FECHADURA:['FECHADURA','FECHADURAS'],BATENTE:['BATENTE','BATENTES'],COIFA:['COIFA','COIFAS'],BIELETA:['BIELETA','BIELETAS']}; const base=NORM(item).split(' ').filter(w=>w.length>2); const out=new Set(base); base.forEach(w=>Object.keys(mapa).forEach(k=>{ if(w.includes(k)||k.includes(w)) mapa[k].forEach(x=>out.add(x)); })); return Array.from(out); }
function matchHist(item){ const target=NORM(item); const words=termosItem(item); let best=null,score=0; state.histItens.forEach(h=>{ let s=0; words.forEach(w=>{if(h.norm.includes(w))s++}); if(target.includes(h.norm)||h.norm.includes(target))s+=5; if(/DIANTEIR/.test(target)&&/TRASEIR/.test(h.norm))s-=2; if(/TRASEIR/.test(target)&&/DIANTEIR/.test(h.norm))s-=2; if(s>score){score=s;best=h;} }); return score>=2?best:null; }
function shouldOpen(sec){ return state.activeSecId===sec.id; }
function renderGroups(){
 const box=$('groups'); if(!box||!state.model)return; const q=NORM($('buscaItem')?.value||''); box.innerHTML=''; const secoes=state.model.secoes||[];
 if(!state.activeSecId && !q){ const closed=document.createElement('div'); closed.innerHTML='<div class="empty-pick">Escolha uma seção acima. O checklist abre somente aquele conjunto para não cansar o mecânico.</div>'; secoes.forEach(sec=>{ const p=secProgress(sec.id); if(!p.done&&!state.completedSecoes.has(sec.id))return; closed.appendChild(closedSection(sec,p)); }); box.appendChild(closed); updateBottomCount(); return; }
 secoes.forEach(sec=>{
   let items=(sec.itens||[]).filter(it=>!q || NORM(it+' '+sec.titulo).includes(q)); if(!items.length)return;
   const aberto=q?true:shouldOpen(sec); const p=secProgress(sec.id);
   if(!aberto){ box.appendChild(closedSection(sec,p)); return; }
   const det=document.createElement('details'); det.open=true; det.className='sec open-focus'; det.id='sec-'+sec.id;
   det.innerHTML=`<summary><span><span class="draw">${sec.emoji}</span> ${esc(sec.titulo)}</span><small>${p.done}/${p.total}</small></summary><div class="quick-help">Avalie esta seção. Ao terminar, toque em <b>Concluir e minimizar</b>.</div><div class="hint">${esc(sec.hint||'')}</div><div class="items"></div><div class="sec-actions"><button type="button" class="btn secondary" data-close-sec="${sec.id}">Minimizar</button><button type="button" class="btn ok" data-done-sec="${sec.id}">Concluir seção ✅</button>${isGestao()?`<button type="button" class="btn secondary" data-manage-sec="${sec.id}">⚙️ Editar seção/itens</button>`:''}</div>`;
   const cont=det.querySelector('.items'); items.forEach(it=>cont.appendChild(renderItem(sec,it)));
   det.querySelector('[data-close-sec]')?.addEventListener('click',()=>{state.activeSecId=''; renderSymptoms(); renderGroups(); saveDraft();});
   det.querySelector('[data-done-sec]')?.addEventListener('click',()=>concluirSecao(sec.id)); det.querySelector('[data-manage-sec]')?.addEventListener('click',()=>gerenciarSecaoGestao(sec.id)); box.appendChild(det);
 }); updateBottomCount();
}
function closedSection(sec,p){ const d=document.createElement('button'); d.type='button'; d.className='section-closed'+(state.completedSecoes.has(sec.id)?' done':''); d.innerHTML=`<span><b><span class="draw">${sec.emoji}</span> ${esc(sec.titulo)}</b><small>${p.done}/${p.total} avaliados${p.crit?' • '+p.crit+' críticos':''}</small></span><span>abrir</span>`; d.onclick=()=>abrirSecao(sec.id,true); return d; }
function renderItem(sec,it){
 const id=itemId(sec,it); const meta=getItemMeta(sec.id,it); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,it),descricao:it,status:'',obs:'',photos:[],obrigatorio:meta.obrigatorio,criticidade:meta.criticidade}; cur.obrigatorio=meta.obrigatorio; cur.criticidade=meta.criticidade; const hist=matchHist(it); const el=document.createElement('div'); el.className='item'; el.dataset.id=id; const photoCount=(cur.photos||[]).length;
 el.innerHTML=`<div class="item-head"><div class="item-icon">${sec.emoji}</div><div><b>${esc(it)}</b><div class="mini">${esc(sec.titulo)} • ${cur.tipo}${cur.obrigatorio?' • obrigatório':''}${cur.criticidade&&cur.criticidade!=='normal'?' • '+cur.criticidade:''}</div></div></div><div class="hist ${hist?'':'empty'}">${hist?`🕘 Última vez: <b>${fmtDate(hist.data)}</b> • O.S. ${esc(hist.osId)} • ${esc(hist.descricao).slice(0,130)} ${hist.km?`• KM ${esc(hist.km)}`:''}`:'Sem histórico encontrado para este item nessa placa.'}</div><div class="status-grid"><button type="button" data-st="ok" class="${cur.status==='ok'?'on ok':''}">✅ OK</button><button type="button" data-st="atencao" class="${cur.status==='atencao'?'on warn':''}">⚠️ Atenção</button><button type="button" data-st="trocar" class="${cur.status==='trocar'?'on bad':''}">🔧 Trocar</button><button type="button" data-st="na" class="${cur.status==='na'?'on na':''}">➖ N/A</button></div><textarea class="obs" placeholder="Comentário rápido desse item (opcional)">${esc(cur.obs||'')}</textarea><div class="item-actions"><label class="filebtn">📷 Foto <input type="file" accept="image/*" capture="environment" multiple hidden></label>${isGestao()?'<button type="button" class="btn small secondary" data-edit-item="1">✏️ Editar</button><button type="button" class="btn small secondary" data-req-item="1">⭐ Obrigatório</button><button type="button" class="btn small secondary" data-crit-item="1">🚦 Criticidade</button><button type="button" class="btn small bad" data-del-item="1">🗑️ Remover</button>':''}<span class="photo-count">${photoCount?photoCount+' foto(s)':'sem foto'}</span></div><div class="sugs"></div>`;
 el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{cur.status=b.dataset.st; state.selected.set(id,cur); renderGroups(); saveDraft();});
 el.querySelector('.obs').oninput=e=>{cur.obs=e.target.value; if(cur.status||cur.obs||cur.photos?.length)state.selected.set(id,cur); saveDraft();};
 el.querySelector('input[type=file]').onchange=e=>addPhotos(e.target.files,id,it,cur); el.querySelector('[data-edit-item]')?.addEventListener('click',()=>editarItemGestao(sec,it,cur)); el.querySelector('[data-del-item]')?.addEventListener('click',()=>excluirItemGestao(sec,it)); el.querySelector('[data-req-item]')?.addEventListener('click',()=>alternarObrigatorioGestao(sec,it)); el.querySelector('[data-crit-item]')?.addEventListener('click',()=>alterarCriticidadeGestao(sec,it)); renderSugestoes(el.querySelector('.sugs'), it); return el;
}
function renderSugestoes(box,it){ const sugs=state.model.sugestoes?.[it]||[]; if(!sugs.length)return; box.innerHTML='<div class="sug-title">Sugestão inteligente do conjunto:</div>'; sugs.slice(0,5).forEach(s=>{ const b=document.createElement('button'); b.type='button'; b.className='sug'; b.textContent='＋ '+s; b.onclick=()=>{ const sec=(state.model.secoes||[]).find(x=>(x.itens||[]).includes(s)); if(sec){ const id=itemId(sec,s); const cur=state.selected.get(id)||{id,secao:sec.titulo,tipo:guessTipo(sec,s),descricao:s,status:'atencao',obs:'Sugerido pelo conjunto: '+it,photos:[]}; state.selected.set(id,cur); toast('Item sugerido marcado: '+s); renderGroups(); saveDraft(); }}; box.appendChild(b); }); }
function guessTipo(sec,it){ const n=NORM(sec.titulo+' '+it); return /SERVICO|ALINHAMENTO|BALANCEAMENTO|SANGRIA|LIMPEZA|HIGIENIZACAO|LEITURA|TESTE|REGULAGEM|CALIBRAGEM|RODIZIO|DESMONTAGEM/.test(n)?'serviço':'peça/serviço'; }
function updateBottomCount(){ const arr=Array.from(state.selected.values()).filter(x=>x.status&&x.status!=='ok'&&x.status!=='na'); if($('selCount')) $('selCount').textContent=arr.length; }
async function compressImage(file){ const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)}); const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=data}); const max=1200; let w=img.width,h=img.height; if(Math.max(w,h)>max){ if(w>h){h=Math.round(h*max/w);w=max}else{w=Math.round(w*max/h);h=max} } const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; canvas.getContext('2d').drawImage(img,0,0,w,h); return canvas.toDataURL('image/jpeg',0.72); }
async function addPhotos(files,itemId,label,cur){ const arr=Array.from(files||[]).slice(0,8); if(!arr.length)return; toast('Processando fotos...'); for(const f of arr){ const dataUrl=await compressImage(f); const photo={id:'ph_'+Date.now()+'_'+Math.random().toString(36).slice(2),itemId,label,dataUrl,createdAt:nowISO()}; state.photos.push(photo); if(cur){cur.photos=cur.photos||[]; cur.photos.push(photo.id); state.selected.set(itemId,cur);} } saveDraft(); renderGroups(); renderMidia(); toast('Foto anexada.'); }
function renderMidia(){ const box=$('photoGrid'); if(!box)return; box.innerHTML=''; if(!state.photos.length){box.innerHTML='<div class="notice">Nenhuma foto anexada ainda.</div>'; return;} state.photos.forEach(p=>{ const d=document.createElement('div'); d.className='photo'; d.innerHTML=`<img src="${p.dataUrl}" alt="foto"><div><b>${esc(p.label)}</b><button type="button">Remover</button></div>`; d.querySelector('button').onclick=()=>{state.photos=state.photos.filter(x=>x.id!==p.id); state.selected.forEach(v=>{v.photos=(v.photos||[]).filter(id=>id!==p.id)}); saveDraft(); renderMidia(); renderGroups();}; box.appendChild(d); }); }
async function toggleAudio(){ if(state.rec&&state.rec.state==='recording'){state.rec.stop();return;} try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[]; state.rec=new MediaRecorder(stream); state.rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; state.rec.onstop=()=>{state.audioBlob=new Blob(chunks,{type:'audio/webm'}); state.audioUrl=URL.createObjectURL(state.audioBlob); $('audioBox').innerHTML=`<audio controls src="${state.audioUrl}"></audio>`; $('btnAudio').textContent='🎤 Gravar áudio'; stream.getTracks().forEach(t=>t.stop()); saveDraft();}; state.rec.start(); $('btnAudio').textContent='⏹️ Parar gravação'; toast('Gravando áudio...'); }catch(e){toast('Microfone não liberado.');} }
function ditarTexto(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){toast('Ditado não suportado.');return;} const rec=new SR(); rec.lang='pt-BR'; rec.onresult=e=>{$('diagnostico').value=($('diagnostico').value+'\n'+e.results[0][0].transcript).trim(); saveDraft();}; rec.start(); toast('Pode falar.'); }
function payload(includePhotos=true){ const u=state.user||readSession(); const itens=Array.from(state.selected.values()).filter(x=>x.status||x.obs||x.photos?.length); return {versao:'checklist-concessionaria-v14-login-seguro-apk-unico',tenantId:u.tid,oficinaNome:u.tnome||u.oficina?.nome||'',criadoEm:nowISO(),atualizadoEm:nowISO(),placa:placaNorm($('placa').value),osRef:$('osRef').value.trim(),mecanico:$('mecanico').value.trim()||u.nome,responsavel:$('mecanico').value.trim()||u.nome,mecanicoId:u.fid||'',responsavelId:u.fid||'',mecanicoRole:u.role||'',responsavelPerfil:u.role||'',km:$('km').value.trim(),relato:$('relato').value.trim(),diagnostico:$('diagnostico').value.trim(),sintomas:Array.from(state.sintomas),secaoAtiva:state.activeSecId,secoesConcluidas:Array.from(state.completedSecoes),itens,historico:{os:state.os.length,itens:state.histItens.length,placa:state.placa},fotos:includePhotos?state.photos:state.photos.map(p=>({id:p.id,itemId:p.itemId,label:p.label,createdAt:p.createdAt})),audioLocal:!!state.audioBlob,entrega:payloadEntrega(),origem:'checklist.html'}; }

function itensParaEntrega(){
 const arr=Array.from(state.selected.values()).filter(x=>x.status==='trocar'||x.status==='atencao');
 return arr.map((x,i)=>({id:x.id||('entrega_'+i),secao:x.secao||'',tipo:x.tipo||'',descricao:x.descricao||'',statusOrigem:x.status||'',obsOrigem:x.obs||''}));
}
function entregaRegistro(item){
 const id=item.id; const cur=state.entrega.get(id)||{};
 return {id,itemId:id,secao:item.secao,tipo:item.tipo,descricao:item.descricao,statusOrigem:item.statusOrigem,obsOrigem:item.obsOrigem,executado:!!cur.executado,naoExecutado:!!cur.naoExecutado,conferidoPor:cur.conferidoPor||'',conferidoPerfil:cur.conferidoPerfil||'',conferidoEm:cur.conferidoEm||'',obs:cur.obs||''};
}
function payloadEntrega(){
 const u=state.user||readSession(); const itens=itensParaEntrega().map(entregaRegistro);
 const feitos=itens.filter(x=>x.executado).length;
 const pend=itens.filter(x=>!x.executado && !x.naoExecutado).length;
 const nao=itens.filter(x=>x.naoExecutado).length;
 const total=itens.length;
 return {status:state.entregaStatus||'em_conferencia',obsFinal:state.entregaObsFinal||'',conferente:u.nome||'',conferenteId:u.fid||'',conferentePerfil:u.role||'',atualizadoEm:nowISO(),total,executados:feitos,pendentes:pend,naoExecutados:nao,percentual:total?Math.round((feitos/total)*100):0,itens};
}
function abrirChecklistEntrega(){ renderResumo(); renderEntrega(); go('screenEntrega'); }
function setEntregaItem(id,patch){
 const u=state.user||readSession(); const cur=state.entrega.get(id)||{}; const next={...cur,...patch};
 if(patch.executado||patch.naoExecutado){ next.conferidoPor=u.nome||''; next.conferidoPerfil=u.role||''; next.conferidoEm=nowISO(); }
 state.entrega.set(id,next); renderEntrega(); saveDraft();
}
function renderEntrega(){
 const u=state.user||readSession(); if($('entregaConferente')) $('entregaConferente').value=(u.nome||'')+(u.role?' • '+u.role:'');
 if($('entregaStatus')) $('entregaStatus').value=state.entregaStatus||'em_conferencia';
 if($('entregaObsFinal')) $('entregaObsFinal').value=state.entregaObsFinal||'';
 const box=$('entregaLista'); if(!box)return; const base=itensParaEntrega(); const payload=payloadEntrega();
 if($('entregaPercent')) $('entregaPercent').textContent=payload.percentual+'% concluído';
 if($('entregaBar')) $('entregaBar').style.width=payload.percentual+'%';
 if(!base.length){ box.innerHTML='<div class="notice warn">Nenhum item marcado como Trocar/Atenção no checklist técnico. Marque itens no checklist técnico para gerar a conferência de entrega.</div>'; return; }
 box.innerHTML=`<div class="kpis"><div class="kpi"><b>${payload.total}</b><span>Itens</span></div><div class="kpi"><b>${payload.executados}</b><span>Executados</span></div><div class="kpi"><b>${payload.pendentes}</b><span>Pendentes</span></div><div class="kpi"><b>${payload.naoExecutados}</b><span>Não feitos</span></div></div>`;
 base.forEach(item=>{
   const r=entregaRegistro(item); const d=document.createElement('div'); d.className='delivery-item '+(r.executado?'done':'pending');
   d.innerHTML=`<div><b>${esc(item.descricao)}</b><div class="mini">${esc(item.secao)} • origem: ${statusLabel(item.statusOrigem)}${item.obsOrigem?' • '+esc(item.obsOrigem):''}</div></div><div class="delivery-meta"><span class="pill">Solicitado no checklist técnico</span>${r.conferidoPor?`<span class="pill">Conferido por: ${esc(r.conferidoPor)} (${esc(r.conferidoPerfil)})</span><span class="pill">${fmtDate(ts(r.conferidoEm))}</span>`:''}</div><div class="delivery-actions"><button type="button" data-act="feito" class="${r.executado?'on':''}">✅ Executado/conferido</button><button type="button" data-act="nao" class="${r.naoExecutado?'badon':''}">⛔ Não feito/pendente</button></div><textarea class="obs" placeholder="Observação da conferência (opcional)">${esc(r.obs||'')}</textarea>`;
   d.querySelector('[data-act="feito"]').onclick=()=>setEntregaItem(item.id,{executado:true,naoExecutado:false});
   d.querySelector('[data-act="nao"]').onclick=()=>setEntregaItem(item.id,{executado:false,naoExecutado:true});
   d.querySelector('textarea').oninput=e=>setEntregaItem(item.id,{obs:e.target.value});
   box.appendChild(d);
 });
}
async function salvarChecklistEntrega(){
 const p=payload(true); if(!p.placa){toast('Digite a placa antes de salvar a entrega.');return null;}
 const entrega=p.entrega; try{localStorage.setItem('CHECKLIST_ENTREGA_ULTIMO_'+p.placa,JSON.stringify({placa:p.placa,osRef:p.osRef,checklist:p,entrega,criadoEm:nowISO()}));}catch(e){}
 const db=initFirebase(); if(db){ try{ const ref=await db.collection('checklistsEntrega').add({...tenantFields(),placa:p.placa,osRef:p.osRef,checklistTecnico:p,entrega,createdAt:nowISO(),updatedAt:nowISO(),status:entrega.percentual>=100?'conferido':'parcial'}); toast('Checklist de entrega salvo no sistema.'); return ref.id; }catch(e){console.warn(e); toast('Conferência salva no celular. Banco recusou ou sem permissão.'); return null;} }
 toast('Conferência salva no celular.'); return null;
}
function resumoEntregaParaOS(p,entregaId){
 const e=p.entrega||payloadEntrega(); return {entregaId:entregaId||'',checklistTecnicoId:'',data:nowISO(),placa:p.placa,osRef:p.osRef||'',conferente:e.conferente||'',conferentePerfil:e.conferentePerfil||'',status:e.status,percentual:e.percentual,total:e.total,executados:e.executados,pendentes:e.pendentes,naoExecutados:e.naoExecutados,obsFinal:e.obsFinal||'',itens:e.itens.map(x=>({descricao:x.descricao,secao:x.secao,executado:x.executado,naoExecutado:x.naoExecutado,conferidoPor:x.conferidoPor,conferidoPerfil:x.conferidoPerfil,conferidoEm:x.conferidoEm,obs:x.obs||''})),origem:'checklist-entrega.html'};
}
async function anexarEntregaNaOS(){
 const p=payload(true); if(!p.placa){toast('Digite a placa antes de anexar na O.S.');return;}
 const db=initFirebase(); const entregaId=await salvarChecklistEntrega(); if(!db){baixarJSON(); toast('Sem Firebase. Baixei JSON para anexar manualmente.');return;}
 const os=await localizarOSParaAnexo(db); if(!os||!os.id||!os._col){baixarJSON(); toast('Não localizei a O.S. Baixei JSON para importação manual.');return;}
 const resumo=resumoEntregaParaOS(p,entregaId); const diagAtual=String(os.diagnosticoTecnico||os.diagnosticoInterno||'');
 const bloco=`\n\n[CHECKLIST DE ENTREGA ${new Date().toLocaleString('pt-BR')}] ${resumo.conferente} (${resumo.conferentePerfil})\nStatus: ${resumo.status} • ${resumo.percentual}% • Executados: ${resumo.executados}/${resumo.total} • Pendentes: ${resumo.pendentes+resumo.naoExecutados}\n${resumo.obsFinal||''}\nItens:\n${resumo.itens.map(i=>'- '+(i.executado?'OK':'PENDENTE')+' • '+i.secao+' • '+i.descricao+(i.obs?' — '+i.obs:'')).join('\n')}`;
 const up={checklistEntregaUltimo:resumo,checklistEntregaAtualizadoEm:nowISO(),checklistsEntrega:(window.firebase?.firestore?.FieldValue?.arrayUnion?window.firebase.firestore.FieldValue.arrayUnion(resumo):[resumo]),diagnosticoTecnico:(diagAtual+bloco).trim()};
 try{await db.collection(os._col).doc(os.id).update(up); toast('Checklist de entrega anexado na O.S.');}
 catch(e){console.warn(e); baixarJSON(); toast('Não consegui atualizar a O.S. JSON baixado para importação manual.');}
}
async function gerarPDFEntrega(){
 if(!window.jspdf){toast('jsPDF não carregado.');return;} const {jsPDF}=window.jspdf; const p=payload(true); const e=p.entrega; const doc=new jsPDF('p','mm','a4'); let y=12;
 function footer(){doc.setFontSize(8);doc.setTextColor(115);doc.text('Powered by thIAguinho Soluções Digitais • OFICIN-IA • Checklist de entrega',12,292);}
 function page(h=8){if(y+h>284){footer();doc.addPage();y=12;}}
 function txt(t,size=9,b=false){page(8);doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(size);doc.setTextColor(15,23,42);const lines=doc.splitTextToSize(String(t||''),186);doc.text(lines,12,y);y+=lines.length*4.6;}
 doc.setFillColor(15,23,42);doc.rect(0,0,210,24,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Checklist de Entrega / Conferência',12,13);doc.setFontSize(9);doc.text(`OFICIN-IA • ${new Date().toLocaleString('pt-BR')}`,12,20);y=34;
 txt(`Placa: ${p.placa||'-'}   O.S.: ${p.osRef||'-'}   KM: ${p.km||'-'}`,10,true); txt(`Conferente: ${e.conferente||'-'} (${e.conferentePerfil||'-'})   Percentual: ${e.percentual}%   Status: ${e.status}`,9,false); if(e.obsFinal)txt('Observação final: '+e.obsFinal,9,false);
 txt('Itens conferidos',11,true); e.itens.forEach((i,idx)=>{txt(`${idx+1}. [${i.executado?'EXECUTADO':i.naoExecutado?'NÃO FEITO':'PENDENTE'}] ${i.secao} • ${i.descricao}${i.obs?' — '+i.obs:''}${i.conferidoPor?' • por '+i.conferidoPor:''}`,8,false);}); footer(); doc.save(`CHECKLIST_ENTREGA_${p.placa||'SEM_PLACA'}_${Date.now()}.pdf`);
}
function renderResumo(){ const p=payload(false); const trocar=p.itens.filter(x=>x.status==='trocar').length, at=p.itens.filter(x=>x.status==='atencao').length, ok=p.itens.filter(x=>x.status==='ok').length; $('kTrocar').textContent=trocar; $('kAtencao').textContent=at; $('kOk').textContent=ok; $('kFotos').textContent=state.photos.length; const box=$('resumoLista'); box.innerHTML=''; const list=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao'); if(!list.length){box.innerHTML='<div class="notice">Nenhum item crítico marcado.</div>';return;} list.forEach(x=>{ const d=document.createElement('div'); d.className='resume-line'; d.innerHTML=`<div><b>${esc(x.descricao)}</b><span>${esc(x.secao)} • ${esc(x.obs||'sem comentário')}</span></div><strong class="${statusClass(x.status)}">${statusLabel(x.status)}</strong>`; box.appendChild(d);}); }
async function salvarChecklist(){ if(!isSessionOk()){go('screenAccess'); return null;} const p=payload(false); if(!p.placa){toast('Digite a placa.');return;} try{localStorage.setItem('CHECKLIST_ULTIMO_'+p.placa,JSON.stringify(payload(true)));}catch(e){} const db=initFirebase(); if(db){ try{ const ref=await db.collection('checklists').add({...p,...tenantFields(),createdAt:nowISO(),updatedAt:nowISO(),status:'salvo'}); toast('Checklist salvo no sistema e no celular.'); return ref.id; }catch(e){console.warn(e); toast('Salvo no celular. Banco recusou ou sem permissão.'); return null;} } toast('Salvo no celular.'); return null; }
function baixarJSON(){ const p=payload(true); downloadBlob(JSON.stringify(p,null,2),'application/json',`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.json`); }
function gerarXLSX(){
 if(!window.XLSX){toast('XLSX não carregado.');return;}
 const p=payload(false); const wb=XLSX.utils.book_new();
 wb.Props={Title:'Checklist Técnico OFICIN-IA',Subject:'Relatório de checklist técnico',Author:'thIAguinho Soluções Digitais',Company:'OFICIN-IA'};
 const crit=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao');
 const resumo=[
  ['OFICIN-IA • CHECKLIST TÉCNICO PADRÃO CONCESSIONÁRIA'],
  ['Gerado em',new Date(p.criadoEm).toLocaleString('pt-BR'),'Placa',p.placa||'-','O.S./Ref',p.osRef||'-'],
  ['Responsável',p.responsavel||p.mecanico||'-','Perfil',p.responsavelPerfil||p.mecanicoRole||'-','KM',p.km||'-'],
  ['Oficina',p.oficinaNome||'-','Histórico',`${p.historico.os} O.S. / ${p.historico.itens} itens`,'Fotos',state.photos.length],
  [],['RESUMO EXECUTIVO'],
  ['Trocar',p.itens.filter(x=>x.status==='trocar').length],['Atenção',p.itens.filter(x=>x.status==='atencao').length],['OK',p.itens.filter(x=>x.status==='ok').length],['N/A',p.itens.filter(x=>x.status==='na').length],
  [],['Relato do cliente'],[p.relato||''],[],['Diagnóstico técnico interno'],[p.diagnostico||''],[],['Observação para O.S.'],['Use a aba IMPORTAR_OS para copiar peças, serviços e diagnóstico para a O.S. do Jarvis.']
 ];
 let ws=XLSX.utils.aoa_to_sheet(resumo); ws['!cols']=[{wch:24},{wch:34},{wch:16},{wch:24},{wch:16},{wch:28}]; ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}}]; XLSX.utils.book_append_sheet(wb,ws,'01 Resumo');
 const importar=[['Tipo','Seção','Descrição','Qtd','Valor sugerido','Comentário','Histórico encontrado','Ação sugerida']];
 crit.forEach(x=>{const h=matchHist(x.descricao); importar.push([x.tipo,x.secao,x.descricao,1,'',x.obs||'',h?`${fmtDate(h.data)} • OS ${h.osId} • ${h.descricao}`:'Sem histórico',x.status==='trocar'?'Adicionar à O.S.':'Avaliar']);});
 ws=XLSX.utils.aoa_to_sheet(importar); ws['!cols']=[{wch:16},{wch:25},{wch:52},{wch:8},{wch:14},{wch:45},{wch:60},{wch:18}]; ws['!autofilter']={ref:`A1:H${Math.max(1,importar.length)}`}; XLSX.utils.book_append_sheet(wb,ws,'02 IMPORTAR_OS');
 const itens=[['Status','Tipo','Seção','Item','Comentário','Fotos','Último histórico']];
 p.itens.forEach(x=>{const h=matchHist(x.descricao); itens.push([statusLabel(x.status),x.tipo,x.secao,x.descricao,x.obs||'',(x.photos||[]).length,h?`${fmtDate(h.data)} • OS ${h.osId} • ${h.descricao}`:'Sem histórico']);});
 ws=XLSX.utils.aoa_to_sheet(itens); ws['!cols']=[{wch:14},{wch:16},{wch:28},{wch:48},{wch:54},{wch:8},{wch:68}]; ws['!autofilter']={ref:`A1:G${Math.max(1,itens.length)}`}; XLSX.utils.book_append_sheet(wb,ws,'03 Itens avaliados');
 const hist=[['Data','O.S.','Status','Cliente','Veículo','Tipo','Fonte','Descrição','KM','Valor']];
 state.histItens.slice(0,600).forEach(h=>hist.push([fmtDate(h.data),h.osId,h.status,h.cliente||'',h.veiculo||'',h.tipo,h.fonte,h.descricao,h.km||'',Number(h.valor||0)]));
 ws=XLSX.utils.aoa_to_sheet(hist); ws['!cols']=[{wch:12},{wch:16},{wch:16},{wch:32},{wch:28},{wch:12},{wch:22},{wch:58},{wch:12},{wch:14}]; ws['!autofilter']={ref:`A1:J${Math.max(1,hist.length)}`}; XLSX.utils.book_append_sheet(wb,ws,'04 Histórico placa');
 const fotos=[['Item/Seção','Data','Observação'],...state.photos.map(f=>[f.label,fmtDate(f.createdAt),'Foto incorporada no PDF e salva no JSON/checklist'])];
 ws=XLSX.utils.aoa_to_sheet(fotos); ws['!cols']=[{wch:42},{wch:18},{wch:48}]; XLSX.utils.book_append_sheet(wb,ws,'05 Fotos');
 XLSX.writeFile(wb,`CHECKLIST_OFICINIA_${p.placa||'SEM_PLACA'}_${Date.now()}.xlsx`); toast('Planilha inteligente gerada.');
}

async function gerarPDF(){
 if(!window.jspdf){toast('jsPDF não carregado.');return;} const {jsPDF}=window.jspdf; const p=payload(true); const doc=new jsPDF('p','mm','a4'); let y=12; const W=210;
 function pageCheck(h=8){if(y+h>284){footer();doc.addPage();y=12;}}
 function footer(){const pages=doc.internal.getNumberOfPages(); doc.setFontSize(8); doc.setTextColor(115); doc.text(`Powered by thIAguinho Soluções Digitais • OFICIN-IA • Página ${doc.internal.getCurrentPageInfo().pageNumber}/${pages}`,12,292);}
 function header(){doc.setFillColor(15,23,42);doc.rect(0,0,W,26,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Checklist Técnico Padrão Concessionária',12,13);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`OFICIN-IA • ${p.oficinaNome||'Oficina'} • ${new Date(p.criadoEm).toLocaleString('pt-BR')}`,12,20);y=34;doc.setTextColor(15,23,42);}
 function text(txt,x=12,size=9,bold=false,max=186){pageCheck(8);doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(15,23,42);const lines=doc.splitTextToSize(String(txt||''),max);doc.text(lines,x,y);y+=lines.length*4.6;}
 function box(title,lines,color){pageCheck(18);doc.setDrawColor(215,226,239);doc.setFillColor(248,250,252);const start=y;doc.roundedRect(10,y-5,190,Math.max(18,8+lines.length*5),3,3,'FD');doc.setTextColor(color[0],color[1],color[2]);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(title,14,y+1);doc.setTextColor(15,23,42);doc.setFont('helvetica','normal');doc.setFontSize(8);let yy=y+7;lines.forEach(l=>{doc.text(doc.splitTextToSize(String(l||''),178),14,yy); yy+=5;});y=start+Math.max(20,10+lines.length*5);}
 header();
 box('Identificação',[`Placa: ${p.placa||'-'}   O.S./Ref: ${p.osRef||'-'}   KM: ${p.km||'-'}`,`Responsável: ${p.responsavel||p.mecanico||'-'}   Perfil: ${p.responsavelPerfil||p.mecanicoRole||'-'}   Histórico: ${p.historico.os} O.S. / ${p.historico.itens} itens`],[29,78,216]);
 const trocar=p.itens.filter(x=>x.status==='trocar').length, at=p.itens.filter(x=>x.status==='atencao').length, ok=p.itens.filter(x=>x.status==='ok').length;
 box('Resumo executivo',[`Trocar: ${trocar}   Atenção: ${at}   OK: ${ok}   Fotos: ${state.photos.length}`,`Relatório gerado para análise e importação/anexo na O.S. do Jarvis.`],[21,128,61]);
 if(p.relato) box('Relato do cliente',[p.relato],[180,83,9]);
 if(p.diagnostico) box('Diagnóstico técnico interno',[p.diagnostico],[185,28,28]);
 text('Itens críticos e observações',12,11,true); y+=2;
 const crit=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao');
 if(!crit.length) text('Nenhum item crítico marcado.',12,9,false); else crit.forEach((it,i)=>{ const h=matchHist(it.descricao); box(`${i+1}. ${statusLabel(it.status)} • ${it.secao}`,[`${it.descricao}${it.obs?' — '+it.obs:''}`,h?`Histórico: ${fmtDate(h.data)} • O.S. ${h.osId} • ${h.descricao}`:'Histórico: sem ocorrência anterior encontrada para esta placa.'],it.status==='trocar'?[185,28,28]:[180,83,9]); });
 const demais=p.itens.filter(x=>x.status==='ok'||x.status==='na'); if(demais.length){ text('Itens conferidos',12,11,true); demais.forEach((it,i)=>text(`${i+1}. [${statusLabel(it.status)}] ${it.secao} • ${it.descricao}${it.obs?' — '+it.obs:''}`,12,8,false)); }
 if(state.photos.length){ footer(); doc.addPage(); header(); text('Fotos anexadas',12,12,true); for(const ph of state.photos){ pageCheck(78); text(ph.label,12,9,true); try{doc.addImage(ph.dataUrl,'JPEG',12,y,84,63); y+=68;}catch(e){text('Foto não pôde ser inserida no PDF.',12,8,false);} } }
 const pages=doc.internal.getNumberOfPages(); for(let i=1;i<=pages;i++){doc.setPage(i);footer();}
 doc.save(`CHECKLIST_${p.placa||'SEM_PLACA'}_${Date.now()}.pdf`);
}
function imprimirManualUmaPagina(){
 const secoes=state.model?.secoes||[]; const placa=placaNorm($('placa')?.value||''); const os=$('osRef')?.value||''; const resp=$('mecanico')?.value||state.user?.nome||'';
 const grupos=secoes.map(sec=>`<section><h2>${sec.emoji||''} ${esc(sec.titulo)}</h2><div class="mini-grid">${(sec.itens||[]).slice(0,18).map(it=>`<label><span class="chk"></span>${esc(it)}</label>`).join('')}</div></section>`).join('');
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>Checklist manual OFICIN-IA</title><style>@page{size:A4;margin:7mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:9px}header{border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:4px;display:grid;grid-template-columns:1fr auto;gap:8px}h1{font-size:15px;margin:0}p{margin:2px 0}.meta{font-size:9px;text-align:right}.wrap{columns:2;column-gap:5mm}section{break-inside:avoid;border:1px solid #999;border-radius:6px;padding:4px;margin:0 0 4px;background:#fff}h2{font-size:10px;margin:0 0 3px;padding-bottom:2px;border-bottom:1px solid #ccc}.mini-grid{display:grid;grid-template-columns:1fr;gap:1px}label{display:flex;gap:3px;align-items:flex-start;line-height:1.08}.chk{width:8px;height:8px;border:1px solid #111;display:inline-block;flex:0 0 8px;margin-top:1px}.obs{border:1px solid #999;height:32px;border-radius:6px;margin-top:4px;padding:3px}.foot{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #999;padding-top:2px;font-size:8px;text-align:center}@media print{button{display:none}}</style></head><body><header><div><h1>Checklist Técnico Manual • OFICIN-IA</h1><p>Placa: <b>${esc(placa||'________')}</b> &nbsp; O.S.: <b>${esc(os||'________')}</b> &nbsp; KM: __________</p><p>Responsável: <b>${esc(resp||'________________')}</b> &nbsp; Data: ____/____/______</p></div><div class="meta">OK / Atenção / Trocar<br>usar observação quando necessário</div></header><div class="wrap">${grupos}</div><div class="obs"><b>Observações gerais:</b></div><div class="foot">Powered by thIAguinho Soluções Digitais • OFICIN-IA</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
 const w=window.open('','_blank'); if(!w){toast('Pop-up bloqueado. Libere pop-ups para imprimir.');return;} w.document.open(); w.document.write(html); w.document.close();
}
async function localizarOSParaAnexo(db){
 const ref=String($('osRef')?.value||'').trim(); const placa=placaNorm($('placa')?.value||state.placa||'');
 let candidatos=[]; if(ref) candidatos=state.os.filter(o=>osRefMatch(o,ref));
 if(!candidatos.length && placa) candidatos=state.os.filter(o=>placaFromOS(o)===placa);
 if(candidatos.length===1) return candidatos[0];
 if(ref && db){
   const cols=['ordens_servico','ordensServico','os','ordens'];
   for(const col of cols){
     try{ const d=await db.collection(col).doc(ref).get(); if(d.exists) return {id:d.id,_col:col,...d.data()}; }catch(e){}
     const docs=await getDocsFromCol(db,col,800); const found=docs.find(o=>osRefMatch(o,ref)); if(found) return found;
   }
 }
 return null;
}
function resumoParaOS(p,checklistId){
 const crit=p.itens.filter(x=>x.status==='trocar'||x.status==='atencao');
 return {checklistId:checklistId||'',data:p.criadoEm,placa:p.placa,osRef:p.osRef||'',responsavel:p.responsavel||p.mecanico||'',responsavelPerfil:p.responsavelPerfil||p.mecanicoRole||'',km:p.km||'',trocar:p.itens.filter(x=>x.status==='trocar').length,atencao:p.itens.filter(x=>x.status==='atencao').length,fotos:(p.fotos||[]).length,diagnostico:p.diagnostico||'',relato:p.relato||'',itensCriticos:crit.slice(0,80).map(x=>({status:x.status,tipo:x.tipo,secao:x.secao,descricao:x.descricao,obs:x.obs||''})),origem:'checklist.html'};
}
async function enviarParaOS(){
 const p=payload(true); if(!p.placa){toast('Digite a placa antes de enviar para O.S.');return;}
 const db=initFirebase(); const checklistId=await salvarChecklist();
 if(!db){ baixarJSON(); toast('Firebase não carregou. Baixei o JSON para importar manualmente na O.S.'); return; }
 const os=await localizarOSParaAnexo(db); if(!os||!os.id||!os._col){ baixarJSON(); toast('Não localizei a O.S. pelo campo O.S./Ref. Baixei o JSON para anexar manualmente.'); return; }
 const resumo=resumoParaOS(p,checklistId);
 const diagAtual=String(os.diagnosticoTecnico||os.diagnosticoInterno||'');
 const bloco=`\n\n[CHECKLIST TÉCNICO ${fmtDate(Date.now())}] ${resumo.responsavel} (${resumo.responsavelPerfil})\nTrocar: ${resumo.trocar} | Atenção: ${resumo.atencao} | Fotos: ${resumo.fotos}\n${p.diagnostico||p.relato||''}\nItens críticos:\n${resumo.itensCriticos.map(i=>'- '+statusLabel(i.status)+' • '+i.secao+' • '+i.descricao+(i.obs?' — '+i.obs:'')).join('\n')}`;
 const up={checklistUltimo:resumo,checklistAtualizadoEm:nowISO(),checklistsTecnicos:(window.firebase?.firestore?.FieldValue?.arrayUnion?window.firebase.firestore.FieldValue.arrayUnion(resumo):[resumo]),diagnosticoTecnico:(diagAtual+bloco).trim()};
 try{ await db.collection(os._col).doc(os.id).update(up); toast('Checklist salvo e anexado na O.S. do Jarvis.'); }
 catch(e){ console.warn(e); baixarJSON(); toast('Não consegui atualizar a O.S. por permissão/campo. JSON baixado para importação manual.'); }
}

function downloadBlob(content,type,name){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function saveDraft(){ try{localStorage.setItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user'),JSON.stringify(payload(true))); if($('draftInfo')) $('draftInfo').textContent='Rascunho salvo';}catch(e){console.warn('rascunho grande demais',e)} }
function restoreDraft(){ try{ const raw=localStorage.getItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user'))||localStorage.getItem('CHECKLIST_RASCUNHO'); if(!raw)return; const p=JSON.parse(raw); if(!p)return; if(p.placa&&!$('placa').value)$('placa').value=p.placa; if(p.osRef)$('osRef').value=p.osRef; if(p.km)$('km').value=p.km; if(p.relato)$('relato').value=p.relato; if(p.diagnostico)$('diagnostico').value=p.diagnostico; (p.itens||[]).forEach(x=>state.selected.set(x.id,x)); state.photos=p.fotos||[]; state.activeSecId=p.secaoAtiva||''; state.completedSecoes=new Set(p.secoesConcluidas||[]); }catch(e){} }
function novoChecklist(){ if(!confirm('Zerar este checklist e começar um novo? O histórico salvo no sistema não será apagado.'))return; const mec=$('mecanico')?.value||state.user?.nome||''; ['placa','osRef','km','relato','diagnostico'].forEach(id=>{if($(id))$(id).value=''}); if($('mecanico'))$('mecanico').value=mec; state.placa=''; state.os=[]; state.histItens=[]; state.selected.clear(); state.sintomas.clear(); state.activeSecId=''; state.completedSecoes.clear(); state.entrega.clear(); state.entregaStatus='em_conferencia'; state.entregaObsFinal=''; state.photos=[]; state.audioBlob=null; state.audioUrl=''; $('historicoResumo').innerHTML=''; $('audioBox').innerHTML=''; localStorage.removeItem('CHECKLIST_RASCUNHO_'+(state.user?.fid||state.user?.nome||'user')); renderSymptoms(); renderGroups(); renderMidia(); go('screenStart'); toast('Novo checklist iniciado.'); }
async function consultarChecklists(){ if(!isSessionOk()){go('screenAccess'); return;} const box=$('consultaLista'); if(!box)return; box.innerHTML='<div class="notice">Pesquisando checklists salvos...</div>'; const db=initFirebase(); const placa=placaNorm($('consultaPlaca')?.value||$('placa')?.value||''); const mec=NORM($('consultaMecanico')?.value||''); const qtd=Number($('consultaQtd')?.value||20); let list=[]; if(db){ try{ const docs=await getDocsFromCol(db,'checklists',Math.max(qtd,100)); list=docs; }catch(e){console.warn(e)} } const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('CHECKLIST_ULTIMO_')){try{local.push(JSON.parse(localStorage.getItem(k)))}catch(e){}} } list=list.concat(local).filter(Boolean); if(placa) list=list.filter(x=>placaNorm(x.placa)===placa); if(mec) list=list.filter(x=>NORM(x.responsavel||x.mecanico||x.mecanicoNome||'').includes(mec)); list=list.sort((a,b)=>ts(b.criadoEm||b.createdAt)-ts(a.criadoEm||a.createdAt)).slice(0,qtd); if(!list.length){box.innerHTML='<div class="notice warn">Nenhum checklist encontrado para o filtro.</div>';return;} box.innerHTML=''; list.forEach(x=>{ const d=document.createElement('div'); d.className='consulta-card'; const crit=(x.itens||[]).filter(i=>i.status==='trocar'||i.status==='atencao').length; d.innerHTML=`<b>${esc(x.placa||'-')} • ${esc(x.osRef||'sem O.S.')}</b><small>${fmtDate(ts(x.criadoEm||x.createdAt))} • Responsável: ${esc(x.responsavel||x.mecanico||'-')} • ${crit} crítico(s) • ${x.fotos?.length||0} foto(s)</small><div style="margin-top:8px;display:grid;grid-template-columns:1fr;gap:6px"><button class="btn small secondary" data-load="1" type="button">Carregar neste aparelho</button>${isGestao()?'<button class="btn small" data-edit="1" type="button">✏️ Editar checklist</button><button class="btn small bad" data-del="1" type="button">🗑️ Excluir checklist</button>':''}</div>`; d.querySelector('[data-load]')?.addEventListener('click',()=>{loadChecklistPayload(x); go('screenStart'); toast('Checklist carregado.');}); d.querySelector('[data-edit]')?.addEventListener('click',()=>{loadChecklistPayload(x); go('screenCheck'); toast('Checklist aberto para edição.');}); d.querySelector('[data-del]')?.addEventListener('click',()=>excluirChecklistSalvo(x)); box.appendChild(d); }); }
function loadChecklistPayload(p){ if(!p)return; if($('placa'))$('placa').value=p.placa||''; if($('osRef'))$('osRef').value=p.osRef||''; if($('km'))$('km').value=p.km||''; if($('relato'))$('relato').value=p.relato||''; if($('diagnostico'))$('diagnostico').value=p.diagnostico||''; state.selected.clear(); (p.itens||[]).forEach(x=>state.selected.set(x.id,x)); state.photos=p.fotos||[]; state.completedSecoes=new Set(p.secoesConcluidas||[]); state.activeSecId=p.secaoAtiva||''; state.entrega=new Map((p.entrega?.itens||[]).map(x=>[x.itemId||x.id,x])); state.entregaStatus=p.entrega?.status||state.entregaStatus; state.entregaObsFinal=p.entrega?.obsFinal||state.entregaObsFinal; renderSymptoms(); renderGroups(); renderMidia(); renderResumo(); }
window.CHECKLIST_OFICINIA={state,buscarHistorico,consultarChecklists,novoChecklist,gerarPDF,gerarXLSX,baixarJSON,salvarChecklist,enviarParaOS,abrirChecklistEntrega,salvarChecklistEntrega,anexarEntregaNaOS,gerarPDFEntrega,excluirChecklistSalvo,adicionarItemGestao,gerenciarSecaoGestao,editarItemGestao,excluirItemGestao,alternarObrigatorioGestao,alterarCriticidadeGestao};
boot();
})();
