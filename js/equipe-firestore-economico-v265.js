/**
 * OFICIN-IA V26.5 — Firestore Econômico do painel Equipe
 * - Reaproveita cache por validade para O.S., clientes e veículos.
 * - Mantém O.S. em tempo real somente enquanto a aba está ativa ou a O.S. está aberta.
 * - Estoque só é consultado ao abrir a ficha da O.S., não no pátio vazio.
 * - Não altera permissões, filtros de mecânico, tarefas, comissões ou salvamento.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_EQUIPE_ECONOMIA_V265__) return;
  W.__THIA_EQUIPE_ECONOMIA_V265__ = true;

  const V='26.5.0';
  const S=()=>W.J||(typeof J!=='undefined'?J:{});
  const DB=()=>W.db||(typeof db!=='undefined'?db:null);
  const ttl={ os:5*60*1000, clientes:30*60*1000, veiculos:20*60*1000, estoque:10*60*1000 };
  const state={ osUnsub:null, osStop:null, loading:{}, loaded:{} };
  try {
    const database=DB();
    if(database?.enablePersistence) database.enablePersistence({synchronizeTabs:true}).catch(err=>{
      if(!/failed-precondition|unimplemented/i.test(String(err?.code||err?.message||''))) console.warn('[Equipe V26.5 cache]',err?.message||err);
    });
  } catch(_) {}
  const stamp=k=>`thia:eq:v265:${String(S().tid||'sem-tenant')}:${k}`;
  const fresh=k=>{try{return Date.now()-Number(localStorage.getItem(stamp(k))||0)<ttl[k];}catch(_){return false;}};
  const mark=k=>{try{localStorage.setItem(stamp(k),String(Date.now()));}catch(_){}};

  function query(col){
    const database=DB(); const session=S();
    if(!database||!session?.tid) return null;
    return database.collection(col).where('tenantId','==',session.tid);
  }
  function roleAll(){return ['gerente','gestor','admin','superadmin','dono'].includes(String(S().role||'').toLowerCase());}
  function applyOS(docs){
    const todas=(docs||[]).map(d=>d&&typeof d.data==='function'?({id:d.id,...d.data()}):d).filter(Boolean);
    dbOS=roleAll()?todas:todas.filter(osAtribuidaAoUsuarioEquipe);
    state.loaded.os=true;
    statusEquipeDados('');
    renderKanban(); renderKPIs();
  }
  function applyClientes(docs){dbClientes=(docs||[]).map(d=>d&&typeof d.data==='function'?({id:d.id,...d.data()}):d).filter(Boolean);state.loaded.clientes=true;popularSelects();}
  function applyVeiculos(docs){dbVeiculos=(docs||[]).map(d=>d&&typeof d.data==='function'?({id:d.id,...d.data()}):d).filter(Boolean);state.loaded.veiculos=true;popularSelects();}
  function applyEstoque(docs){dbEstoque=(docs||[]).map(d=>d&&typeof d.data==='function'?({id:d.id,...d.data()}):d).filter(Boolean);state.loaded.estoque=true;}

  async function cache(k,col,apply){
    try{const s=await query(col)?.get({source:'cache'});if(s)apply(s.docs);return s?.docs||[];}catch(_){return [];}
  }
  async function once(k,col,apply,force=false){
    if(state.loading[k]&&!force)return state.loading[k];
    state.loading[k]=(async()=>{
      if(!state.loaded[k])await cache(k,col,apply);
      const arr=k==='clientes'?dbClientes:k==='veiculos'?dbVeiculos:k==='estoque'?dbEstoque:dbOS;
      if(force||!fresh(k)||!arr?.length){
        try{const s=await query(col).get({source:'server'});apply(s.docs);mark(k);}catch(e){console.warn('[Equipe V26.5]',col,e?.code||'',e?.message||e);}
      }
    })().finally(()=>state.loading[k]=null);
    return state.loading[k];
  }

  async function startOS(force=false){
    clearTimeout(state.osStop);state.osStop=null;
    if(state.osUnsub&&!force)return;
    if(force&&state.osUnsub){try{state.osUnsub();}catch(_){}state.osUnsub=null;}
    if(!state.loaded.os)await cache('os','ordens_servico',applyOS);
    if(!force&&fresh('os')&&dbOS?.length)return;
    statusEquipeDados('Sincronizando pátio da equipe...', 'warn');
    const q=query('ordens_servico');if(!q)return;
    state.osUnsub=q.onSnapshot({includeMetadataChanges:true},snap=>{
      applyOS(snap.docs);
      if(!snap.metadata?.fromCache)mark('os');
    },err=>{
      state.osUnsub=null;
      console.error('[Equipe V26.5 O.S.]',err);
      statusEquipeDados('Não foi possível sincronizar as O.S. Agora. Mantive o cache local.', 'err');
    });
  }
  function stopOS(delay=120000){clearTimeout(state.osStop);state.osStop=setTimeout(()=>{if(!D.hidden&&D.getElementById('modalOS')?.classList.contains('open'))return;if(state.osUnsub){try{state.osUnsub();}catch(_){}state.osUnsub=null;}},delay);}

  W.equipeEconomiaV265Start=async function(){
    statusEquipeDados('Carregando pátio em modo econômico...', 'warn');
    await Promise.all([once('clientes','clientes',applyClientes),once('veiculos','veiculos',applyVeiculos)]);
    await startOS(false);
  };
  W.equipeEconomiaV265LoadEstoque=function(force=false){return once('estoque','estoqueItems',applyEstoque,force);};
  W.equipeEconomiaV265RefreshOS=function(){return startOS(true);};
  W.iniciarEstoqueEquipeDados=function(){return W.equipeEconomiaV265LoadEstoque(false);};

  function hooks(){
    if(typeof W.abrirModal==='function'&&!W.abrirModal.__eqEco265){
      const original=W.abrirModal;
      const wrapped=function(id){if(id==='modalOS'){W.equipeEconomiaV265LoadEstoque(false);startOS(true);}return original.apply(this,arguments);};
      wrapped.__eqEco265=true;wrapped.__original=original;W.abrirModal=wrapped;
    }
  }
  D.addEventListener('visibilitychange',()=>{if(D.hidden)stopOS(45000);else startOS(false);});
  function wrapSave(){
    if(typeof W.salvarOS==='function'&&!W.salvarOS.__eqEco265){
      const original=W.salvarOS;
      const wrapped=function(){const out=original.apply(this,arguments);Promise.resolve(out).finally(()=>{cache('os','ordens_servico',applyOS);cache('estoque','estoqueItems',applyEstoque);});return out;};
      wrapped.__eqEco265=true;wrapped.__original=original;W.salvarOS=wrapped;
    }
  }
  function install(){hooks();wrapSave();console.info('[OFICIN-IA] Equipe econômico V'+V+' ativo');}
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(()=>{hooks();wrapSave();},500);
})(window,document);
