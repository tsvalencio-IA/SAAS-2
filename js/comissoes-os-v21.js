/**
 * OFICIN-IA V24 — Comissões rastreáveis por O.S., serviço e mecânico.
 * Cada card mostra somente os serviços realmente atribuídos ao colaborador.
 * O rateio interno do valor do serviço aparece somente no financeiro.
 * Powered by thIAguinho Soluções Digitais
 */
(function(){
  'use strict';
  const $id=id=>document.getElementById(id);
  const n=v=>{
    if(window.JOS?.parseNumberBR)return window.JOS.parseNumberBR(v);
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    let s=String(v??'').trim().replace(/\s|R\$/gi,'');
    if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    else if(s.includes(','))s=s.replace(',','.');
    const x=parseFloat(s);return Number.isFinite(x)?x:0;
  };
  const money=v=>(typeof window.moeda==='function'?window.moeda(n(v)):'R$ '+n(v).toFixed(2).replace('.',','));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isPaid=f=>['pago','liquidado','baixado','parcial'].includes(norm(f?.status))||!!f?.pagoEm||!!f?.dataPgto;
  const isCanceled=f=>['cancelado','cancelada','compensado'].includes(norm(f?.status))||f?.canceladoPorReemissaoOS===true;
  const finalStatus=o=>/pronto|entregue|concluido|faturado|finalizado/i.test(String(o?.status||''));
  const selectedFunc=()=> (window.J?.equipe||[]).find(f=>String(f.id)===String($id('rhPgtoFunc')?.value||''));
  const vehicleFor=os=>(window.J?.veiculos||[]).find(v=>String(v.id)===String(os?.veiculoId||''))||os?.veiculoSnapshot||{};
  const clientFor=os=>(window.J?.clientes||[]).find(c=>String(c.id)===String(os?.clienteId||''))||{};

  function ensureStyles(){
    if($id('com-v22-style'))return;
    const st=document.createElement('style');st.id='com-v22-style';st.textContent=`
      #comListaV21{overflow-x:hidden!important;max-width:100%;box-sizing:border-box}
      .com-v22-os{border:1px solid rgba(0,212,255,.20);border-radius:5px;background:rgba(0,212,255,.035);overflow:hidden;max-width:100%;min-width:0}
      .com-v22-row{display:grid;grid-template-columns:24px minmax(0,1fr) minmax(92px,116px);gap:7px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:4px;padding:7px;min-width:0;max-width:100%;box-sizing:border-box}
      .com-v22-row label{min-width:0;overflow-wrap:anywhere}
      .com-v22-row .j-input{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
      @media(max-width:720px){
        .com-v22-row{grid-template-columns:24px minmax(0,1fr)}
        .com-v22-row .com-valor-v21{grid-column:1/-1;width:100%}
        #comListaV21{max-height:54vh!important;padding-right:0!important}
      }
    `;document.head.appendChild(st);
  }

  function paymentAllocations(fin){
    if(Array.isArray(fin?.alocacoesComissao))return fin.alocacoesComissao;
    if(Array.isArray(fin?.itensComissaoPagos))return fin.itensComissaoPagos;
    return [];
  }

  function paidMapFor(mecId){
    const map=new Map();
    (window.J?.financeiro||[]).filter(f=>f?.isComissao===true&&String(f.mecId||'')===String(mecId||'')&&!isCanceled(f)&&isPaid(f)).forEach(fin=>{
      const allocs=paymentAllocations(fin);
      if(allocs.length){
        allocs.forEach(a=>{
          const key=`${a.osId||fin.osId||''}|${a.servicoKey||a.key||''}`;
          map.set(key,(map.get(key)||0)+n(a.valorPago??a.valor??0));
        });
        return;
      }
      const servs=Array.isArray(fin.servicosComissao)?fin.servicosComissao:[];
      let restante=n(fin.valor||0);
      servs.forEach((s,idx)=>{
        if(restante<=0)return;
        const previsto=n(s.valorComissao??s.comissao??0),parcela=previsto>0?Math.min(restante,previsto):0;
        if(parcela>0){const key=`${fin.osId||''}|${s.key||`servico-${idx}`}`;map.set(key,(map.get(key)||0)+parcela);restante-=parcela;}
      });
      if(restante>0&&fin.osId){const key=`${fin.osId}|pecas`;map.set(key,(map.get(key)||0)+restante);}
    });
    return map;
  }

  function rateioDoMecanico(os,item,mecId,registro,mec){
    const origem=(os?.servicos||[])[Number(item?.index)]||{};
    const diretos=Array.isArray(item?.rateiosComissao)?item.rateiosComissao:[];
    const salvos=Array.isArray(origem.rateiosComissao)?origem.rateiosComissao:[];
    const rateios=diretos.length?diretos:salvos;
    const nomeMec=norm(mec?.nome||mec?.usuario||'');
    const achado=rateios.find(r=>{
      const rid=String(r?.mecId||r?.id||'');
      const rnome=norm(r?.mecNome||r?.nome||'');
      return (rid&&rid===String(mecId||''))||(!rid&&nomeMec&&rnome===nomeMec)||(nomeMec&&rnome===nomeMec);
    });
    if(achado)return {valorBase:Math.max(0,n(achado.valorBase??achado.valorDividido??achado.baseComissao??0)),legado:false,explicito:true};
    if(rateios.length)return null;
    const responsavel=registro?.mecId||registro?.responsavelId||origem.mecId||origem.mecanicoId||origem.responsavelId||item?.mecId||item?.responsavelId||os?.mecId||'';
    const responsavelNome=norm(registro?.mecNome||registro?.responsavelNome||origem.mecNome||origem.mecanicoNome||origem.responsavelNome||item?.mecNome||item?.responsavelNome||'');
    if(String(responsavel)!==String(mecId||'')&&(!nomeMec||responsavelNome!==nomeMec))return null;
    return {valorBase:Math.max(0,n(item?.valorFinal||0)),legado:true,explicito:false};
  }

  function rowsFor(mec){
    if(!mec)return[];
    const pct=n(mec.comissaoServico??mec.comissao??0),pagos=paidMapFor(mec.id),rows=[];
    (window.J?.os||[]).filter(o=>!/^cancel/i.test(String(o?.status||''))).forEach(os=>{
      const cli=clientFor(os),vei=vehicleFor(os);
      const itens=window.JOS?.buildBudgetItems?window.JOS.buildBudgetItems(os,cli):[];
      const aprovacaoAtiva=window.JOS?.hasApproval?.(os),aprovados=window.JOS?.getApprovedKeys?.(os)||new Set(),exec=os.execucaoItens||{};
      const temExecServico=Object.entries(exec).some(([key,val])=>String(key).startsWith('servico-')&&String(val?.status||'').trim());
      const statusExecutado=st=>/^(executado|executado_obs|concluido|finalizado|feito|realizado|trocada)$/i.test(String(st||'').trim());
      itens.filter(it=>it.tipo==='servico').forEach(it=>{
        if(aprovacaoAtiva&&!aprovados.has(it.key))return;
        const reg=exec[it.key]||{};
        const elegivelPagamento=temExecServico?statusExecutado(reg.status):finalStatus(os);
        const rateio=rateioDoMecanico(os,it,mec.id,reg,mec);
        if(!rateio||rateio.valorBase<=0)return;
        // O serviço explicitamente dividido continua visível antes da finalização,
        // mas permanece bloqueado para pagamento até existir execução confirmada ou O.S. finalizada.
        if(!elegivelPagamento&&!rateio.explicito)return;
        const base=+Math.min(n(it.valorFinal||0),rateio.valorBase).toFixed(2),previsto=+(base*(pct/100)).toFixed(2);
        const key=`${os.id}|${it.key}`,pago=+(pagos.get(key)||0).toFixed(2),falta=Math.max(0,+(previsto-pago).toFixed(2));
        rows.push({osId:os.id,servicoKey:it.key,servico:it.desc||'Serviço',placa:vei.placa||os.placa||'',veiculo:vei.modelo||vei.veiculo||os.veiculoSnapshot?.modelo||os.veiculo||'',cliente:cli.nome||os.clienteNome||os.cliente||'',status:os.status||'',data:os.data||os.createdAt||'',valorServico:n(it.valorFinal||0),base,percentual:pct,previsto,pago,falta,finalizada:finalStatus(os),legado:rateio.legado,rateioExplicito:rateio.explicito===true,semPercentual:pct<=0,aguardandoExecucao:!elegivelPagamento});
      });
      const pctPeca=n(mec.comissaoPeca||0),principal=String(os.mecId||os.mecIds?.[0]||'');
      const basePecas=itens.filter(it=>it.tipo==='peca'&&(!aprovacaoAtiva||aprovados.has(it.key))).reduce((sum,it)=>sum+n(it.valorFinal||0),0);
      if(basePecas>0&&pctPeca>0&&finalStatus(os)&&principal===String(mec.id)){
        const previsto=+(basePecas*(pctPeca/100)).toFixed(2),key=`${os.id}|pecas`,pago=+(pagos.get(key)||0).toFixed(2);
        rows.push({osId:os.id,servicoKey:'pecas',servico:'COMISSÃO SOBRE PEÇAS DA O.S.',placa:vei.placa||os.placa||'',veiculo:vei.modelo||os.veiculoSnapshot?.modelo||'',cliente:cli.nome||os.cliente||'',status:os.status||'',data:os.data||os.createdAt||'',valorServico:basePecas,base:basePecas,percentual:pctPeca,previsto,pago,falta:Math.max(0,+(previsto-pago).toFixed(2)),finalizada:true,legado:false});
      }
    });
    return rows.sort((a,b)=>String(b.data).localeCompare(String(a.data))||a.placa.localeCompare(b.placa));
  }

  function ensureUI(){
    ensureStyles();const modal=$id('modalPgtoRH');if(!modal)return;
    if($id('boxComissaoDetalhadaV21'))return;
    const body=modal.querySelector('.modal-body');if(!body)return;
    const box=document.createElement('div');box.id='boxComissaoDetalhadaV21';box.style.display='none';
    box.innerHTML=`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;max-width:100%;overflow:hidden"><div style="font-family:var(--fd);font-weight:800;color:var(--cyan);letter-spacing:1px;margin-bottom:6px;">COMISSÃO POR O.S. E SERVIÇO</div><div style="font-family:var(--fm);font-size:.61rem;color:var(--muted);line-height:1.45;margin-bottom:8px;">Este colaborador vê somente os serviços atribuídos a ele. A base dividida é interna e não aparece na O.S., PDF ou planilha.</div><input id="comBuscaV21" class="j-input" type="search" placeholder="Pesquisar O.S., placa, veículo ou serviço..." autocomplete="off" style="margin-bottom:8px;width:100%;box-sizing:border-box"><div id="comResumoV21" style="font-family:var(--fm);font-size:.68rem;color:var(--warn);margin-bottom:8px;"></div><div id="comListaV21" style="display:grid;gap:8px;max-height:48vh;overflow:auto;padding-right:3px;"></div></div>`;
    body.appendChild(box);
    $id('rhPgtoTipo')?.addEventListener('change',toggle);$id('rhPgtoFunc')?.addEventListener('change',render);$id('comBuscaV21')?.addEventListener('input',render);
    modal.addEventListener('input',e=>{if(e.target?.classList?.contains('com-valor-v21'))updateSummary();});
    modal.addEventListener('change',e=>{if(e.target?.classList?.contains('com-check-v21')){const row=e.target.closest('[data-com-row]'),inp=row?.querySelector('.com-valor-v21');if(inp)inp.disabled=!e.target.checked;updateSummary();}});
  }

  function toggle(){ensureUI();const show=$id('rhPgtoTipo')?.value==='Pagamento Comissão',box=$id('boxComissaoDetalhadaV21');if(box)box.style.display=show?'block':'none';const val=$id('rhPgtoValor');if(val){val.readOnly=show;val.title=show?'Valor calculado pelos serviços selecionados.':'';}if(show)render();}

  function render(){
    ensureUI();if($id('rhPgtoTipo')?.value!=='Pagamento Comissão')return;
    const mec=selectedFunc(),list=$id('comListaV21');if(!list)return;
    if(!mec){list.innerHTML='<div style="padding:14px;color:var(--muted);">Selecione o colaborador.</div>';updateSummary();return;}
    const q=norm($id('comBuscaV21')?.value||''),rows=rowsFor(mec).filter(r=>!q||norm([r.osId,r.placa,r.veiculo,r.cliente,r.servico,r.status].join(' ')).includes(q));
    const groups=new Map();rows.forEach(r=>{if(!groups.has(r.osId))groups.set(r.osId,[]);groups.get(r.osId).push(r);});
    list.innerHTML=Array.from(groups.values()).map(group=>{const h=group[0];return `<div class="com-v22-os"><div style="padding:8px 10px;background:rgba(0,0,0,.18);font-family:var(--fm);font-size:.66rem;color:var(--cyan);overflow-wrap:anywhere"><b>O.S. #${esc(String(h.osId).slice(-6).toUpperCase())}</b> · ${esc(h.placa||'SEM PLACA')} · ${esc(h.veiculo||'VEÍCULO')}<br><span style="color:var(--muted)">${esc(h.cliente)} · ${esc(h.status)}</span></div><div style="display:grid;gap:5px;padding:8px;min-width:0">${group.map(r=>{const id=`${r.osId}|${r.servicoKey}`.replace(/[^a-zA-Z0-9_-]/g,'_'),disabled=r.falta<=0||r.semPercentual||r.aguardandoExecucao,alertaPct=r.semPercentual?' · ⚠ percentual de comissão não cadastrado para este colaborador':'',alertaExec=r.aguardandoExecucao?' · ⏳ aguardando execução confirmada ou finalização da O.S.':'';return `<div class="com-v22-row" data-com-row data-os-id="${esc(r.osId)}" data-key="${esc(r.servicoKey)}" data-servico="${esc(r.servico)}" data-placa="${esc(r.placa)}" data-veiculo="${esc(r.veiculo)}" data-base="${r.base}" data-pct="${r.percentual}" data-previsto="${r.previsto}" data-pago="${r.pago}" style="${disabled?'opacity:.62;':''}"><input id="${id}" class="com-check-v21" type="checkbox" ${disabled?'disabled':''} style="width:auto;min-height:0"><label for="${id}" style="font-size:.75rem;line-height:1.35;cursor:pointer"><b>${esc(r.servico)}</b><br><small style="color:${r.semPercentual||r.aguardandoExecucao?'var(--warn)':'var(--muted)'}">Valor cobrado ${money(r.valorServico)} · base interna deste mecânico ${money(r.base)} · ${r.percentual.toFixed(2).replace('.',',')}% · comissão prevista ${money(r.previsto)} · já paga ${money(r.pago)} · falta ${money(r.falta)}${alertaPct}${alertaExec}</small></label><input class="j-input com-valor-v21" type="text" inputmode="decimal" value="${r.falta>0?r.falta.toFixed(2).replace('.',','):''}" ${disabled?'disabled':''} style="text-align:right" title="Valor da comissão a pagar agora neste serviço"></div>`;}).join('')}</div></div>`;}).join('')||'<div style="padding:14px;color:var(--muted);text-align:center;">Nenhum serviço atribuído a este colaborador.</div>';
    updateSummary();
  }

  function selectedAllocations(){return Array.from(document.querySelectorAll('#comListaV21 [data-com-row]')).filter(row=>row.querySelector('.com-check-v21')?.checked).map(row=>({osId:row.dataset.osId||'',servicoKey:row.dataset.key||'',servico:row.dataset.servico||'',placa:row.dataset.placa||'',veiculo:row.dataset.veiculo||'',baseServico:n(row.dataset.base),percentual:n(row.dataset.pct),valorComissaoPrevista:n(row.dataset.previsto),valorJaPagoAntes:n(row.dataset.pago),valorPago:n(row.querySelector('.com-valor-v21')?.value||0)})).filter(a=>a.valorPago>0);}
  function updateSummary(){const allocs=selectedAllocations(),total=allocs.reduce((s,a)=>s+a.valorPago,0);if($id('rhPgtoValor'))$id('rhPgtoValor').value=total?total.toFixed(2):'';if($id('comResumoV21'))$id('comResumoV21').textContent=allocs.length?`${allocs.length} serviço(s) selecionado(s) · pagamento agora ${money(total)}`:'Selecione os serviços que serão pagos agora.';}

  async function consumePending(batch,mecId,osId,valor,agora,paymentId){let restante=valor;const pend=(window.J?.financeiro||[]).filter(f=>f?.isComissao===true&&String(f.mecId||'')===String(mecId)&&String(f.osId||'')===String(osId)&&!isCanceled(f)&&!isPaid(f)).sort((a,b)=>String(a.venc||a.createdAt||'').localeCompare(String(b.venc||b.createdAt||'')));for(const fin of pend){if(restante<=.001)break;const atual=n(fin.valor||0),usar=Math.min(atual,restante),novo=+(atual-usar).toFixed(2),ref=window.db.collection('financeiro').doc(fin.id);if(novo<=.001)batch.update(ref,{status:'Cancelado',valor:0,compensadoPorPagamentoComissao:true,pagamentoComissaoId:paymentId,motivoCancelamento:'Saldo quitado por pagamento detalhado de comissão',updatedAt:agora});else batch.update(ref,{valor:novo,totalComissaoJaPago:+n(fin.totalComissaoJaPago||0)+usar,pagamentoComissaoId:paymentId,updatedAt:agora});restante-=usar;}}

  async function saveDetailed(){
    const mec=selectedFunc();if(!mec){window.toast?.('Selecione o colaborador.','warn');return;}
    const allocs=selectedAllocations();if(!allocs.length){window.toast?.('Selecione ao menos um serviço e informe o valor pago.','warn');return;}
    for(const a of allocs){const restante=Math.max(0,a.valorComissaoPrevista-a.valorJaPagoAntes);if(a.valorPago-restante>.011){window.toast?.(`O valor de ${a.servico} supera o saldo restante (${money(restante)}).`,'warn');return;}}
    const agora=new Date().toISOString(),data=$id('rhPgtoData')?.value||agora.slice(0,10),forma=$id('rhPgtoForma')?.value||'PIX',obs=$id('rhPgtoObs')?.value||'',paymentId=window.db.collection('financeiro').doc().id;
    const groups=new Map();allocs.forEach(a=>{if(!groups.has(a.osId))groups.set(a.osId,[]);groups.get(a.osId).push(a);});
    const batch=window.db.batch();let totalGeral=0;
    for(const [osId,itens] of groups){const total=+itens.reduce((s,a)=>s+a.valorPago,0).toFixed(2);totalGeral+=total;const ref=window.db.collection('financeiro').doc(),placa=itens[0]?.placa||'',veiculo=itens[0]?.veiculo||'';batch.set(ref,{tenantId:window.J.tid,tipo:'Saída',status:'Pago',isComissao:true,isComissaoPagamento:true,categoria:'pagamento_comissao_os_servico',origem:'pagamento_comissao_detalhado',mecId:mec.id,mecNome:mec.nome||'',vinculo:`E_${mec.id}`,osId,placa,veiculo,valor:total,pgto:forma,venc:data,dataPgto:data,pagoEm:agora,pagamentoComissaoId:paymentId,desc:`Pagamento comissão — ${mec.nome} — O.S. ${placa||String(osId).slice(-6)}`,nota:obs,alocacoesComissao:itens,itensComissaoPagos:itens,createdAt:agora,updatedAt:agora});const haviaPendente=(window.J?.financeiro||[]).some(f=>f?.isComissao===true&&String(f.mecId||'')===String(mec.id)&&String(f.osId||'')===String(osId)&&!isCanceled(f)&&!isPaid(f));await consumePending(batch,mec.id,osId,total,agora,paymentId);const residual=+itens.reduce((sum,a)=>sum+Math.max(0,n(a.valorComissaoPrevista)-n(a.valorJaPagoAntes)-n(a.valorPago)),0).toFixed(2);if(!haviaPendente&&residual>.001){const pendRef=window.db.collection('financeiro').doc();batch.set(pendRef,{tenantId:window.J.tid,tipo:'Saída',status:'Pendente',isComissao:true,categoria:'comissao_os_servico_parcial',origem:'saldo_pagamento_comissao_detalhado',mecId:mec.id,mecNome:mec.nome||'',vinculo:`E_${mec.id}`,osId,placa,veiculo,valor:residual,pgto:'A Combinar',venc:data,desc:`Saldo de comissão — ${mec.nome} — O.S. ${placa||String(osId).slice(-6)}`,servicosComissao:itens.map(a=>({key:a.servicoKey,desc:a.servico,valorComissao:Math.max(0,n(a.valorComissaoPrevista)-n(a.valorJaPagoAntes)-n(a.valorPago)),baseServico:a.baseServico,percentual:a.percentual})),createdAt:agora,updatedAt:agora});}}
    await batch.commit();window.toast?.(`✓ Comissão registrada: ${money(totalGeral)} para ${mec.nome}`,'ok');if(typeof window.audit==='function')window.audit('RH/EQUIPE',`Pagamento detalhado de comissão ${money(totalGeral)} para ${mec.nome} em ${groups.size} O.S.`);window.fecharModal?.('modalPgtoRH');window.calcComissoes?.();
  }

  function summaryByFunc(func){
    const id=func?.id||func;
    const all=(window.J?.financeiro||[]).filter(f=>f?.isComissao===true&&String(f.mecId||'')===String(id||'')&&!isCanceled(f));
    const linhas=rowsFor(typeof func==='object'?func:(window.J?.equipe||[]).find(f=>String(f.id)===String(id)));
    return{
      pendente:+linhas.filter(r=>!r.aguardandoExecucao&&!r.semPercentual).reduce((s,r)=>s+n(r.falta||0),0).toFixed(2),
      pago:all.filter(isPaid).reduce((s,f)=>s+n(f.valor||0),0),
      qtdPago:all.filter(isPaid).length,
      qtdServicos:linhas.length,
      semPercentual:linhas.filter(r=>r.semPercentual).length,
      aguardando:linhas.filter(r=>r.aguardandoExecucao).length
    };
  }
  function calcCards(){
    const box=$id('boxComissoes');if(!box)return;
    window.thiaEnsureDataFor?.('equipe');
    box.innerHTML=(window.J?.equipe||[]).map(f=>({f,s:summaryByFunc(f)})).filter(x=>x.s.qtdServicos>0||x.s.pendente>0||x.s.pago>0).map(({f,s})=>`<div class="com-card" style="cursor:pointer;align-items:center;min-width:0;max-width:100%;box-sizing:border-box" onclick="window.abrirComissaoColaboradorV21('${esc(f.id)}')"><div style="min-width:0"><div class="com-nome" style="overflow-wrap:anywhere">${esc(f.nome)}</div><div style="font-family:var(--fm);font-size:.6rem;color:var(--muted)">${s.qtdServicos} SERVIÇO(S) · PAGO ${money(s.pago)} · FALTA ${money(s.pendente)}${s.semPercentual?` · <span style="color:var(--warn)">${s.semPercentual} SEM %</span>`:''}${s.aguardando?` · <span style="color:var(--warn)">${s.aguardando} AGUARDANDO</span>`:''}</div></div><div style="text-align:right"><div class="com-val">${money(s.pendente)}</div><div style="font-family:var(--fm);font-size:.56rem;color:var(--cyan);margin-top:3px">DETALHAR / PAGAR</div></div></div>`).join('')||'<div style="text-align:center;color:var(--muted);padding:20px;">Sem serviços atribuídos ou comissões registradas</div>';
  }

  const oldPrep=window.prepPgtoRH;window.prepPgtoRH=function(){if(typeof oldPrep==='function')oldPrep.apply(this,arguments);ensureUI();toggle();};
  const oldSave=window.salvarPgtoRH;window.salvarPgtoRH=function(){return $id('rhPgtoTipo')?.value==='Pagamento Comissão'?saveDetailed():(typeof oldSave==='function'?oldSave.apply(this,arguments):undefined);};
  window.calcComissoes=calcCards;
  window.abrirComissaoColaboradorV21=function(id){window.thiaEnsureDataFor?.('equipe');window.abrirModal?.('modalPgtoRH');window.prepPgtoRH();if($id('rhPgtoFunc'))$id('rhPgtoFunc').value=id;if($id('rhPgtoTipo'))$id('rhPgtoTipo').value='Pagamento Comissão';toggle();render();setTimeout(render,350);setTimeout(render,1100);};
  function boot(){ensureUI();calcCards();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();[500,1200,2500].forEach(ms=>setTimeout(boot,ms));
})();
