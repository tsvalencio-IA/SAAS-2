/**
 * Regras finais 10/10: IA verdadeira, auditoria, bloqueios de execução,
 * segredo de peças reais, nome da oficina na equipe e integração sem remover fluxo existente.
 * Powered by thIAguinho Soluções Digitais
 */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moeda = v => (window.JOS?.moeda ? window.JOS.moeda(v) : ('R$ ' + (parseFloat(v||0)||0).toFixed(2).replace('.',',')));

  function approvedInfo(os){
    const U = window.JOS || window.JarvisOSUtils || {};
    const itens = U.buildBudgetItems?.(os, null) || [];
    const keys = U.getApprovedKeys?.(os) || new Set(os?.itensAprovados || []);
    return { itens, keys, aprovados: itens.filter(i=>keys.has(i.key)), nao: itens.filter(i=>!keys.has(i.key)) };
  }
  window.thIAContextoOSVerdadeiro = function(lista){
    const arr = Array.isArray(lista) ? lista : ((window.J?.os) || window.dbOS || []);
    return arr.map(o=>{
      const info = approvedInfo(o);
      const exec = o.execucaoItens || {};
      const placa = o.placa || (window.J?.veiculos||[]).find(v=>v.id===o.veiculoId)?.placa || 'S/P';
      const aprovados = info.aprovados.map(i=>`${i.labelTipo||i.tipo}: ${i.desc} [${exec[i.key]?.status || 'pendente'}${exec[i.key]?.obs ? ' obs:'+exec[i.key].obs : ''}]`).join('; ') || 'nenhum item aprovado identificado';
      const nao = info.nao.map(i=>`${i.labelTipo||i.tipo}: ${i.desc}`).join('; ') || 'nenhum';
      return `OS ${String(o.id||'').slice(-6).toUpperCase()} | Placa ${placa} | Status ${o.status||'-'} | Diag ${o.diagnostico||'-'} | APROVADOS: ${aprovados} | NÃO APROVADOS/HISTÓRICO: ${nao}`;
    }).join('\n');
  };

  // Jarvis: substitui contexto da IA por um contexto que diferencia orçamento, aprovado e executado.
  if (typeof window._buildContextoIA === 'function') {
    const old = window._buildContextoIA;
    window._buildContextoIA = function(){
      const base = old.call(this);
      return base + '\n\n=== REGRA DE VERDADE SOBRE O.S. ===\n' +
        'Item no orçamento NÃO significa item trocado. Só afirmar executado/trocado quando execucaoItens.status for executado/executado_obs. Itens não aprovados são histórico, não autorização.\n' +
        window.thIAContextoOSVerdadeiro(window.J?.os || []);
    };
  }

  // Equipe: IA com contexto verdadeiro; evita afirmar que item não aprovado foi trocado.
  if (location.pathname.toLowerCase().includes('equipe') && typeof window.iaEnviar === 'function') {
    window.iaEnviar = async function(){
      const inp=$('iaInput'); const msg=inp?.value?.trim(); if(!msg) return; inp.value='';
      if (typeof window._iaMsgUser === 'function') window._iaMsgUser(msg);
      const lid = typeof window._iaMsgBot === 'function' ? window._iaMsgBot('<span class="j-spinner"></span> Analisando historico real da O.S...') : null;
      try{
        if (typeof window.thiaCarregarCerebroGlobal === 'function') await window.thiaCarregarCerebroGlobal();
        const resp = typeof window.thiaResponderLocalAsync === 'function'
          ? await window.thiaResponderLocalAsync(msg, { perfil:'equipe' })
          : (typeof window.thiaResponderLocal === 'function' ? window.thiaResponderLocal(msg, { perfil:'equipe' }) : 'Motor interno indisponivel nesta tela.');
        if(window._iaReplace) window._iaReplace(lid, resp);
      }catch(e){ if(window._iaReplace) window._iaReplace(lid,'Nao consegui cruzar os dados internos: '+(e.message||e)); }
    };
  }

  // Destaca bloqueio em O.S. aprovada na equipe e no Jarvis.
  window.destacarItensNaoAprovadosOS = function(){
    const osId = $('osId')?.value;
    const os = (window.J?.os||window.dbOS||[]).find(o=>o.id===osId);
    if(!os) return;
    const U = window.JOS || window.JarvisOSUtils || {};
    if(!U.hasApproval?.(os)) return;
    const msg = document.createElement('div');
    msg.className='alerta-aprovacao-1010';
    msg.style.cssText='background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.35);border-radius:4px;padding:10px;margin:8px 0;color:var(--warn);font-family:var(--fm);font-size:.68rem;line-height:1.55;';
    msg.textContent='ATENÇÃO: O.S. aprovada. Itens não aprovados são histórico e não devem ser executados. Equipe só pode atualizar status de execução dos itens aprovados.';
    const alvo=$('containerServicosOS')||$('containerServicos')||$('tp1');
    if(alvo && !document.querySelector('.alerta-aprovacao-1010')) alvo.parentElement.insertBefore(msg, alvo);
  };
  document.addEventListener('click',()=>setTimeout(window.destacarItensNaoAprovadosOS,150));

  // Segredo das peças reais: 5 cliques no rodapé/assinatura + senha *177.
  let clicks=0, timer=null;
  function armarSegredo(){
    const candidatos=[...document.querySelectorAll('#thiaguinhoSecretFooter')];
    candidatos.forEach(el=>{
      if(el.__segredoPecasReais) return; el.__segredoPecasReais=true;
      el.addEventListener('click',()=>{
        clicks++; clearTimeout(timer); timer=setTimeout(()=>{clicks=0;},2500);
        if(clicks>=5){ clicks=0; const senha=prompt('Área restrita. Senha:');
          if(senha==='*177') {
            window._pecasReaisDesbloqueadas=true;
            if (document.body) document.body.dataset.secret177='on';
            const b=$('blocoReais'); if(b) b.style.display='block';
            try { window.atualizarVisibilidadeReaisOS?.(); } catch (_) {}
            try { window.renderTimelineOS?.(); } catch (_) {}
            try { window.renderAuditoria?.(); } catch (_) {}
            try {
              const placa = $('histBuscaPlaca')?.value || '';
              const termo = $('histBuscaTermo')?.value || '';
              if (placa || termo) window.buscarHistoricoOS?.();
            } catch (_) {}
            try { window.atualizarResumoPecasReais177?.(); } catch (_) {}
            if (typeof window.thiaAudit === 'function') window.thiaAudit('abriu_area_pecas_reais', 'ordens_servico', $('osId')?.value || '', null, { desbloqueado:true }, 'Senha *177');
            alert('Peças reais liberadas somente nesta sessão.');
          }
          else alert('Senha inválida.');
        }
      });
    });
  }
  document.addEventListener('DOMContentLoaded', armarSegredo); setTimeout(armarSegredo,1000);

  // Nome da oficina no painel equipe igual ao Jarvis.
  function sincronizarNomeOficina(){
    const nome = window.J?.tnome || window.J?.oficina?.nomeFantasia || window.J?.oficina?.nome || sessionStorage.getItem('j_tnome') || sessionStorage.getItem('j_oficina_nome');
    if(!nome) return;
    document.querySelectorAll('.oficina-nome,.sb-logo-text small,.brand-oficina').forEach(el=>{ el.textContent=nome; });
    const logo=document.querySelector('.sb-logo-text');
    if(logo && location.pathname.toLowerCase().includes('equipe')) logo.childNodes[0].textContent='J.A.R.V.I.S';
  }
  document.addEventListener('DOMContentLoaded', sincronizarNomeOficina); setInterval(sincronizarNomeOficina,2500);

  // Auditoria com motivo para exclusões definitivas.
  window.registrarAuditoriaExclusao1010 = async function(collection,id,antes,motivo){
    try{
      const db = window.db || window.J?.db; if(!db) return;
      await db.collection('auditoria').add({tenantId:window.J?.tid||sessionStorage.getItem('j_tid')||'', modulo:'EXCLUSAO', usuario:window.J?.nome||sessionStorage.getItem('j_nome')||'usuario', acao:`Excluiu ${collection}/${id}`, motivo:motivo||'', dadosAntes:antes||null, ts:Date.now(), createdAt:new Date().toISOString()});
    }catch(e){ console.warn('[auditoria exclusao]',e); }
  };
})();


/* CORREÇÃO FINAL 10/10 — regras reais adicionais sem remover lógica existente */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const U = () => window.JOS || window.JarvisOSUtils || {};

  function contextoVerdadeiro(lista){
    if (typeof window.thIAContextoOSVerdadeiro === 'function') return window.thIAContextoOSVerdadeiro(lista);
    const arr = Array.isArray(lista) ? lista : (window.J?.os || window.dbOS || []);
    return arr.map(o=>{
      const itens = U().buildBudgetItems?.(o, null) || [];
      const keys = U().getApprovedKeys?.(o) || new Set(o?.itensAprovados || []);
      const exec = o.execucaoItens || {};
      const aprov = itens.filter(i=>keys.has(i.key)).map(i=>`${i.labelTipo||i.tipo}: ${i.desc} [${exec[i.key]?.status || 'pendente'}${exec[i.key]?.obs?' obs:'+exec[i.key].obs:''}]`).join('; ') || 'nenhum aprovado identificado';
      const nao = itens.filter(i=>!keys.has(i.key)).map(i=>`${i.labelTipo||i.tipo}: ${i.desc}`).join('; ') || 'nenhum';
      return `OS ${String(o.id||'').slice(-6).toUpperCase()} | Placa ${o.placa||'-'} | Status ${o.status||'-'} | APROVADOS: ${aprov} | NÃO APROVADOS/HISTÓRICO: ${nao}`;
    }).join('\n');
  }

  // Jarvis: reforça contexto verdadeiro na IA mesmo se o bloco interno for usado.
  if (typeof window.iaPerguntar === 'function' && typeof window._jiaChamar === 'function') {
    const oldBuild = window._buildContextoIA;
    if (typeof oldBuild === 'function' && !oldBuild.__verdadeiro1010) {
      const novo = function(){
        const base = oldBuild.apply(this, arguments);
        return base + '\n\n=== REGRAS ABSOLUTAS SOBRE O.S. / EXECUÇÃO ===\n' +
          'Item no orçamento NÃO significa peça trocada ou serviço executado. Item NÃO APROVADO é histórico, não autorização. Só afirmar executado/trocado quando execucaoItens.status = executado ou executado_obs. Nunca usar o campo peças reais em resposta normal.\n' + contextoVerdadeiro(window.J?.os || []);
      };
      novo.__verdadeiro1010 = true;
      window._buildContextoIA = novo;
    }
  }

  // Superadmin: teste do cerebro local tambem recebe regra anti-alucinacao.
  if (typeof window.testarCerebroLocal === 'function' && !window.testarCerebroLocal.__blindado1010) {
    const old = window.testarCerebroLocal;
    window.testarCerebroLocal = async function(){
      const inp = $('iaTestInput');
      if (inp && !/item no orçamento/i.test(inp.value || '')) {
        inp.value = String(inp.value || '') + '\n\nRegra do sistema: item no orçamento não é item executado; não aprovado não é trocado; só considerar executado com status de execução real.';
      }
      return old.apply(this, arguments);
    };
    window.testarCerebroLocal.__blindado1010 = true;
  }

  // Peças reais: sempre escondido até segredo local. Evita exposição jurídica acidental.
  function travarPecasReais(){
    const b = $('blocoReais');
    if (b && window._pecasReaisDesbloqueadas !== true) b.style.display = 'none';
  }
  document.addEventListener('DOMContentLoaded', travarPecasReais);
  setInterval(travarPecasReais, 1200);

  // Exibe alerta visual em OS aprovada no Jarvis/equipe e destaca não aprovados como histórico.
  window.renderAvisoAprovacao1010 = function(os){
    os = os || (window.J?.os || window.dbOS || []).find(x=>x.id===$('osId')?.value);
    const has = U().hasApproval?.(os);
    if (!os || !has || document.getElementById('avisoAprovacao1010')) return;
    const box = document.createElement('div');
    box.id='avisoAprovacao1010';
    box.style.cssText='background:rgba(255,184,0,.09);border:1px solid rgba(255,184,0,.4);border-left:4px solid var(--warn);border-radius:4px;padding:10px 12px;margin:10px 0;color:var(--warn);font-family:var(--fm);font-size:.68rem;line-height:1.55;';
    box.innerHTML='<b>O.S. APROVADA:</b> itens não aprovados são histórico e não podem ser executados. Equipe/Jarvis devem alterar somente status de execução dos itens aprovados.';
    const alvo = document.getElementById('containerServicosOS') || document.getElementById('containerServicos') || document.getElementById('tp1');
    if (alvo?.parentElement) alvo.parentElement.insertBefore(box, alvo);
  };
  document.addEventListener('click',()=>setTimeout(()=>window.renderAvisoAprovacao1010(),120));

  // Busca de rastreabilidade de peças por código: mostra vínculos de NF/O.S. se houver coleção nf_itens_vinculos carregável.
  window.buscarRastreioPeca1010 = async function(codigoOuDesc){
    try{
      const db = window.db || window.J?.db; if(!db) return [];
      const q = String(codigoOuDesc||'').trim().toLowerCase(); if(!q) return [];
      const snap = await db.collection('nf_itens_vinculos').where('tenantId','==',window.J?.tid||sessionStorage.getItem('j_tid')||'').limit(80).get();
      const arr = snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>{
        const status=String([x.status,x.situacao,x.statusVinculo].filter(Boolean).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        if(/cancelad|excluid|estornad|devolvid/.test(status)) return false;
        return String([x.desc,x.descricao,x.codigo,x.codigoFornecedor,x.codigoComercial,x.vinculo,x.finalidade,x.destino,x.placa,x.osId].join(' ')).toLowerCase().includes(q);
      });
      return arr;
    }catch(e){ console.warn('[rastreio peça]',e); return []; }
  };
})();
