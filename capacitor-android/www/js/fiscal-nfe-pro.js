/*
 * thIAguinho SaaS — Fiscal NFe PRO
 * Correção profissional para XML de NFe, fornecedores, vínculo peça⇄OS/veículo e financeiro.
 * Trabalha 100% client-side, preservando funções existentes e sobrescrevendo apenas o fluxo fiscal/NF.
 */
(function(){
  'use strict';

  const $ = (id)=>document.getElementById(id);
  const val = (id)=>($(id)?.value || '').trim();
  const esc = (s)=>String(s ?? '').replace(/[&<>'"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const only = (s)=>String(s||'').replace(/\D/g,'');
  const num = (v)=>{ const n = Number(String(v??'').replace(/\./g,'').replace(',','.')); return Number.isFinite(n)?n:0; };
  const brMoney = (n)=>Number(n||0).toFixed(2).replace('.', ',');
  const todayISO = ()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const isoFromDateTime = (s)=>String(s||'').slice(0,10);
  const somarMeses = (iso, meses)=>{ const [y,m,d]=String(iso||todayISO()).slice(0,10).split('-').map(Number); const dt=new Date(y||new Date().getFullYear(), (m||1)-1, d||1); dt.setMonth(dt.getMonth()+Number(meses||0)); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; };

  function toast(msg, type){ if(window.toast) window.toast(msg,type); else alert(msg); }
  function auditSafe(acao, detalhes, extra){ try{ window.audit && window.audit(acao, detalhes, extra); }catch(_){}}
  function dbRef(){ return window.db || window.J?.db || null; }

  function injectStyles(){
    if($('fiscalNFeProStyles')) return;
    const st=document.createElement('style'); st.id='fiscalNFeProStyles';
    st.textContent = `
      .nf-pro-grid{display:grid;grid-template-columns:minmax(160px,1.2fr) 80px 90px 90px 90px 90px 80px 120px minmax(190px,1fr) 36px;gap:8px;align-items:start;margin-bottom:8px;padding:8px;border:1px solid rgba(0,210,255,.18);background:rgba(0,40,80,.08);border-radius:4px;}
      .nf-pro-grid .j-label-mini{font-family:var(--fm);font-size:.55rem;letter-spacing:.14em;color:var(--muted);margin-bottom:3px;display:block;}
      .nf-pro-card{border:1px solid rgba(0,210,255,.25);background:rgba(0,210,255,.04);border-radius:4px;padding:10px;margin:8px 0;}
      .nf-pro-muted{font-family:var(--fm);font-size:.62rem;color:var(--muted);line-height:1.45;}
      .nf-pro-os-select{min-width:180px;}
      .nf-pro-small{font-size:.7rem!important;padding:8px!important;}
      @media(max-width:760px){.nf-pro-grid{grid-template-columns:1fr 1fr;}.nf-pro-grid>div:nth-child(1),.nf-pro-grid>div:nth-child(9){grid-column:1/-1}.nf-pro-grid button{height:42px}.nf-pro-os-select{min-width:0;width:100%;}}
    `;
    document.head.appendChild(st);
  }

  function text(node, tag){
    if(!node) return '';
    const a = node.getElementsByTagName(tag); if(a && a[0]) return a[0].textContent || '';
    const b = node.getElementsByTagNameNS('*', tag); if(b && b[0]) return b[0].textContent || '';
    return '';
  }
  function first(xml, tag){
    const a=xml.getElementsByTagName(tag); if(a&&a[0]) return a[0];
    const b=xml.getElementsByTagNameNS('*', tag); if(b&&b[0]) return b[0];
    return null;
  }
  function nodes(xml, tag){
    const a=xml.getElementsByTagName(tag); if(a&&a.length) return Array.from(a);
    const b=xml.getElementsByTagNameNS('*', tag); return b?Array.from(b):[];
  }

  function parseImposto(det){
    const imposto = first(det,'imposto') || det;
    const getAny = (tags)=>{ for(const t of tags){ const v=text(imposto,t); if(v !== '') return v; } return ''; };
    return {
      origem: getAny(['orig']), cstICMS: getAny(['CST','CSOSN']),
      vBC: num(getAny(['vBC'])), vICMS: num(getAny(['vICMS'])),
      vBCSTRet: num(getAny(['vBCSTRet'])), vICMSSTRet: num(getAny(['vICMSSTRet'])),
      vIPI: num(getAny(['vIPI'])), pIPI: num(getAny(['pIPI'])),
      vPIS: num(getAny(['vPIS'])), pPIS: num(getAny(['pPIS'])),
      vCOFINS: num(getAny(['vCOFINS'])), pCOFINS: num(getAny(['pCOFINS'])),
      vTotTrib: num(getAny(['vTotTrib'])),
      cstPIS: text(first(imposto,'PIS') || imposto,'CST'),
      cstCOFINS: text(first(imposto,'COFINS') || imposto,'CST')
    };
  }

  function parseNFe(xmlDoc){
    const inf = first(xmlDoc,'infNFe');
    const ide = first(xmlDoc,'ide'); const emit = first(xmlDoc,'emit'); const dest = first(xmlDoc,'dest'); const total = first(xmlDoc,'ICMSTot'); const cobr = first(xmlDoc,'cobr');
    const chave = (inf?.getAttribute('Id') || '').replace(/^NFe/i,'');
    const emitEnd = first(emit,'enderEmit'); const destEnd = first(dest,'enderDest');
    const header = {
      chave, modelo:text(ide,'mod'), serie:text(ide,'serie'), numero:text(ide,'nNF'), natureza:text(ide,'natOp'),
      dataEmissao: isoFromDateTime(text(ide,'dhEmi')), dataSaida: isoFromDateTime(text(ide,'dhSaiEnt')),
      fornecedor:{
        cnpj: text(emit,'CNPJ') || text(emit,'CPF'), nome:text(emit,'xNome'), fantasia:text(emit,'xFant'), ie:text(emit,'IE'), crt:text(emit,'CRT'),
        cep:text(emitEnd,'CEP'), logradouro:text(emitEnd,'xLgr'), numero:text(emitEnd,'nro'), complemento:text(emitEnd,'xCpl'), bairro:text(emitEnd,'xBairro'), cidade:text(emitEnd,'xMun'), uf:text(emitEnd,'UF'), telefone:text(emitEnd,'fone')
      },
      destinatario:{ cnpj:text(dest,'CNPJ')||text(dest,'CPF'), nome:text(dest,'xNome'), ie:text(dest,'IE'), email:text(dest,'email'), cep:text(destEnd,'CEP'), cidade:text(destEnd,'xMun'), uf:text(destEnd,'UF') },
      totais:{
        vProd:num(text(total,'vProd')), vNF:num(text(total,'vNF')), vDesc:num(text(total,'vDesc')), vFrete:num(text(total,'vFrete')), vIPI:num(text(total,'vIPI')), vOutro:num(text(total,'vOutro')), vPIS:num(text(total,'vPIS')), vCOFINS:num(text(total,'vCOFINS'))
      },
      duplicatas: nodes(cobr || xmlDoc,'dup').map(d=>({ numero:text(d,'nDup'), vencimento:text(d,'dVenc'), valor:num(text(d,'vDup')) })).filter(x=>x.vencimento||x.valor)
    };
    const itens = nodes(xmlDoc,'det').map(det=>{
      const prod = first(det,'prod') || det;
      const imp = parseImposto(det);
      const qtd = num(text(prod,'qCom') || text(prod,'qTrib') || 0);
      const unit = num(text(prod,'vUnCom') || text(prod,'vUnTrib') || 0);
      const bruto = num(text(prod,'vProd'));
      const desconto = num(text(prod,'vDesc'));
      return {
        nItem: det.getAttribute('nItem') || '',
        codigo: text(prod,'cProd'), codigoOriginal: text(prod,'cProd'), ean: text(prod,'cEAN'), eanTrib: text(prod,'cEANTrib'),
        descricao: text(prod,'xProd'), desc: text(prod,'xProd'), ncm: text(prod,'NCM'), cest: text(prod,'CEST'), cfop: text(prod,'CFOP'), unidade: text(prod,'uCom') || text(prod,'uTrib') || 'UN',
        qtd, custo: unit, valorUnitario: unit, valorBruto: bruto, desconto, valorTotal: num(text(det,'vItem')) || Math.max(0, bruto - desconto),
        indTot: text(prod,'indTot'), fci: text(prod,'nFCI'), infAdProd: text(det,'infAdProd'), impostos: imp,
        venda: +(unit * 1.5).toFixed(2), finalidade:'estoque', vinculo:'', osId:'', placa:'', veiculo:'', cliente:'', etapa:'', statusOS:''
      };
    });
    return { header, itens };
  }

  function formatOSOption(o){
    const v = (window.J?.veiculos || []).find(x=>x.id===o.veiculoId) || {};
    const c = (window.J?.clientes || []).find(x=>x.id===o.clienteId) || {};
    const placa = o.placa || v.placa || '-';
    const modelo = o.veiculo || v.modelo || v.nome || '-';
    const cliente = o.cliente || c.nome || '-';
    const status = o.status || o.etapa || '-';
    const data = String(o.createdAt || o.dataEntrada || o.data || '').slice(0,10) || '-';
    const cod = o.codigo || o.numero || o.os || o.id;
    return `OS ${cod} | ${placa} | ${modelo} | ${cliente} | ${status} | ${data}`;
  }
  function osOptionsHtml(selected){
    const arr = (window.J?.ordens || window.J?.os || []).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    return `<option value="">Estoque / sem O.S.</option>` + arr.map(o=>`<option value="${esc(o.id)}" ${selected===o.id?'selected':''}>${esc(formatOSOption(o))}</option>`).join('');
  }

  function makeNFRow(item={}){
    injectStyles();
    const div=document.createElement('div'); div.className='nf-pro-grid';
    div.dataset.nfeItem = JSON.stringify(item).replace(/'/g,'&#39;');
    div.innerHTML = `
      <div><span class="j-label-mini">Descrição real XML</span><input class="j-input nf-desc" value="${esc(item.desc||item.descricao||'')}" placeholder="Descrição do produto"></div>
      <div><span class="j-label-mini">Qtd</span><input type="number" class="j-input nf-qtd" value="${esc(item.qtd||1)}" step="0.0001" min="0" oninput="window.calcNFTotal()"></div>
      <div><span class="j-label-mini">Custo un.</span><input type="number" class="j-input nf-custo" value="${esc(item.custo||item.valorUnitario||0)}" step="0.01" oninput="window.calcNFTotal()"></div>
      <div><span class="j-label-mini">Venda</span><input type="number" class="j-input nf-venda" value="${esc(item.venda||0)}" step="0.01" oninput="window.calcNFTotal()"></div>
      <div><span class="j-label-mini">Código/OEM</span><input class="j-input nf-codigo" value="${esc(item.codigo||'')}" placeholder="cProd/OEM"></div>
      <div><span class="j-label-mini">EAN</span><input class="j-input nf-ean" value="${esc(item.ean||'')}" placeholder="GTIN"></div>
      <div><span class="j-label-mini">NCM</span><input class="j-input nf-ncm" value="${esc(item.ncm||'')}"></div>
      <div><span class="j-label-mini">CFOP / CEST</span><input class="j-input nf-cfop" value="${esc([item.cfop,item.cest].filter(Boolean).join(' / '))}"></div>
      <div>
        <span class="j-label-mini">Destino real da peça</span>
        <select class="j-select nf-finalidade" onchange="window.nfAtualizarDestinoLinha(this)">
          <option value="estoque" ${item.finalidade==='estoque'?'selected':''}>Estoque</option>
          <option value="os" ${item.finalidade==='os'?'selected':''}>Vincular a O.S./veículo</option>
          <option value="placa" ${item.finalidade==='placa'?'selected':''}>Separar por placa</option>
          <option value="uso_interno" ${item.finalidade==='uso_interno'?'selected':''}>Uso interno</option>
          <option value="garantia" ${item.finalidade==='garantia'?'selected':''}>Garantia</option>
          <option value="devolucao" ${item.finalidade==='devolucao'?'selected':''}>Devolução</option>
          <option value="outro" ${item.finalidade==='outro'?'selected':''}>Outro</option>
        </select>
        <div class="nf-destino-box" style="margin-top:6px;display:${['os','placa'].includes(item.finalidade)?'block':'none'}">
          <input class="j-input nf-busca-os nf-pro-small" placeholder="Buscar por placa/O.S./cliente" value="${esc(item.vinculo||'')}" oninput="window.nfFiltrarOS(this)">
          <select class="j-select nf-os-select nf-pro-os-select nf-pro-small" onchange="window.nfSelecionouOS(this)">${osOptionsHtml(item.osId||'')}</select>
          <div class="nf-pro-muted nf-os-info">${item.osId ? esc(formatOSOption((window.J?.ordens||[]).find(o=>o.id===item.osId)||{})) : 'Selecione uma O.S. para gravar placa, cliente, etapa e vínculo.'}</div>
        </div>
        <input class="j-input nf-vinculo nf-pro-small" placeholder="Finalidade/observação" value="${esc(item.vinculo||'')}" style="margin-top:6px;">
      </div>
      <button type="button" onclick="this.parentElement.remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;margin-top:18px;">✕</button>
    `;
    return div;
  }

  window.nfAtualizarDestinoLinha = function(sel){
    const row=sel.closest('.nf-pro-grid'); if(!row) return;
    const box=row.querySelector('.nf-destino-box'); if(box) box.style.display = ['os','placa'].includes(sel.value) ? 'block' : 'none';
  };
  window.nfFiltrarOS = function(input){
    const row=input.closest('.nf-pro-grid'); const sel=row?.querySelector('.nf-os-select'); if(!sel) return;
    const q=String(input.value||'').toLowerCase();
    const arr=(window.J?.ordens||window.J?.os||[]).filter(o=>formatOSOption(o).toLowerCase().includes(q));
    sel.innerHTML = `<option value="">Selecione a O.S.</option>` + arr.map(o=>`<option value="${esc(o.id)}">${esc(formatOSOption(o))}</option>`).join('');
  };
  window.nfSelecionouOS = function(sel){
    const row=sel.closest('.nf-pro-grid'); const o=(window.J?.ordens||window.J?.os||[]).find(x=>x.id===sel.value); if(!row||!o) return;
    const v=(window.J?.veiculos||[]).find(x=>x.id===o.veiculoId)||{}; const c=(window.J?.clientes||[]).find(x=>x.id===o.clienteId)||{};
    row.querySelector('.nf-os-info').textContent = formatOSOption(o);
    row.dataset.osId=o.id; row.dataset.placa=o.placa||v.placa||''; row.dataset.veiculo=o.veiculo||v.modelo||''; row.dataset.cliente=o.cliente||c.nome||''; row.dataset.statusOS=o.status||''; row.dataset.etapa=o.etapa||o.status||'';
    const vinc=row.querySelector('.nf-vinculo'); if(vinc && !vinc.value) vinc.value = `${row.dataset.placa} / ${o.codigo||o.numero||o.id}`;
  };

  window.prepNF = function(){
    try{ if($('nfData')) $('nfData').value = todayISO(); if($('nfVenc')) $('nfVenc').value=todayISO(); }catch(_){ }
    if($('containerItensNF')) $('containerItensNF').innerHTML='';
    if($('nfTotal')) $('nfTotal').innerText='0,00';
    if($('nfFornec')) $('nfFornec').innerHTML = '<option value="">Selecione / importar pelo XML</option>' + (window.J?.fornecedores||[]).map(f=>`<option value="${esc(f.id)}">${esc(f.nome||f.razaoSocial||f.fantasia||'Fornecedor')}</option>`).join('');
  };

  window.lerXMLNFe = function(evt){
    const file = evt?.target?.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload = async function(e){
      try{
        const xmlDoc = new DOMParser().parseFromString(e.target.result, 'text/xml');
        if(xmlDoc.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
        const nfe = parseNFe(xmlDoc); window.__ultimaNFeImportada = nfe;
        if($('nfNumero')) $('nfNumero').value = nfe.header.numero || '';
        if($('nfData')) $('nfData').value = nfe.header.dataEmissao || todayISO();
        if($('nfVenc')) $('nfVenc').value = nfe.header.duplicatas?.[0]?.vencimento || todayISO();
        if($('nfPgtoForma')) $('nfPgtoForma').value = nfe.header.duplicatas?.length > 1 ? 'Parcelado' : (nfe.header.duplicatas?.length ? 'Boleto' : 'Dinheiro');
        if($('nfParcelas') && nfe.header.duplicatas?.length) $('nfParcelas').value = String(Math.min(6, Math.max(2, nfe.header.duplicatas.length)));
        window.checkPgtoNF && window.checkPgtoNF();

        const db=dbRef();
        let fornecedorId='';
        const forn = nfe.header.fornecedor;
        const existente=(window.J?.fornecedores||[]).find(f=>only(f.cnpj||f.cpf||f.documento)===only(forn.cnpj) || String(f.nome||'').toLowerCase()===String(forn.nome||'').toLowerCase());
        if(existente){ fornecedorId=existente.id; }
        else if(db && forn.nome){
          const payload={tenantId:window.J?.tid||'', nome:forn.nome, razaoSocial:forn.nome, fantasia:forn.fantasia||'', cnpj:forn.cnpj||'', ie:forn.ie||'', segmento:'Peças / NFe XML', wpp:forn.telefone||'', telefone:forn.telefone||'', cep:forn.cep||'', rua:forn.logradouro||'', numero:forn.numero||'', complemento:forn.complemento||'', bairro:forn.bairro||'', cidade:forn.cidade||'', uf:forn.uf||'', createdAt:new Date().toISOString(), origem:'xml_nfe'};
          const ref=await db.collection('fornecedores').add(payload); fornecedorId=ref.id;
          if(window.J?.fornecedores) window.J.fornecedores.push({id:fornecedorId,...payload});
        }
        if($('nfFornec')){ window.prepNF && window.prepNF(); $('nfFornec').value=fornecedorId; if($('nfNumero')) $('nfNumero').value=nfe.header.numero||''; if($('nfData')) $('nfData').value=nfe.header.dataEmissao||todayISO(); }

        const cont=$('containerItensNF'); if(cont) { cont.innerHTML=''; nfe.itens.forEach(item=>cont.appendChild(makeNFRow(item))); }
        window.calcNFTotal();
        toast(`✓ XML importado: NF ${nfe.header.numero} — ${nfe.itens.length} item(ns)`, 'ok');
        auditSafe('NFE/XML','Importou XML NFe '+(nfe.header.numero||'s/n'), { chave:nfe.header.chave, fornecedor:forn.nome, itens:nfe.itens.length });
      }catch(err){ console.error('[NFe PRO]',err); toast('✕ XML inválido ou não suportado: '+err.message, 'err'); }
      if($('xmlInputFile')) $('xmlInputFile').value='';
    };
    reader.readAsText(file);
  };

  window.adicionarItemNF = function(){ const cont=$('containerItensNF'); if(cont) cont.appendChild(makeNFRow({qtd:1,custo:0,venda:0,finalidade:'estoque'})); };
  window.calcNFTotal = function(){
    let t=0; document.querySelectorAll('#containerItensNF .nf-pro-grid').forEach(r=>{ t += num(r.querySelector('.nf-qtd')?.value) * num(r.querySelector('.nf-custo')?.value); });
    if($('nfTotal')) $('nfTotal').innerText=brMoney(t);
  };

  function rowToItem(row){
    let raw={}; try{ raw=JSON.parse(row.dataset.nfeItem||'{}'); }catch(_){ }
    const sel=row.querySelector('.nf-os-select'); const osId=sel?.value||row.dataset.osId||'';
    const o=(window.J?.ordens||window.J?.os||[]).find(x=>x.id===osId)||{};
    return {
      ...raw,
      desc: row.querySelector('.nf-desc')?.value || raw.desc || raw.descricao || '', descricao: row.querySelector('.nf-desc')?.value || raw.descricao || '',
      qtd: num(row.querySelector('.nf-qtd')?.value || raw.qtd || 1), custo: num(row.querySelector('.nf-custo')?.value || raw.custo || 0), venda: num(row.querySelector('.nf-venda')?.value || raw.venda || 0),
      codigo: row.querySelector('.nf-codigo')?.value || raw.codigo || '', ean: row.querySelector('.nf-ean')?.value || raw.ean || '', ncm: row.querySelector('.nf-ncm')?.value || raw.ncm || '',
      cfop: (row.querySelector('.nf-cfop')?.value || raw.cfop || '').split('/')[0].trim(), cest: raw.cest || ((row.querySelector('.nf-cfop')?.value||'').split('/')[1]||'').trim(),
      finalidade: row.querySelector('.nf-finalidade')?.value || 'estoque', vinculo: row.querySelector('.nf-vinculo')?.value || '',
      osId, placa: row.dataset.placa || o.placa || '', veiculo: row.dataset.veiculo || o.veiculo || '', cliente: row.dataset.cliente || o.cliente || '', statusOS: row.dataset.statusOS || o.status || '', etapa: row.dataset.etapa || o.etapa || o.status || ''
    };
  }

  window.salvarNF = async function(){
    const db=dbRef(); if(!db){ toast('Firestore indisponível para salvar NF.', 'err'); return; }
    const rows=Array.from(document.querySelectorAll('#containerItensNF .nf-pro-grid'));
    const itens=rows.map(rowToItem).filter(i=>i.desc && i.qtd>0);
    if(!itens.length){ toast('⚠ Adicione ou importe ao menos um item válido.', 'warn'); return; }
    const nfe=window.__ultimaNFeImportada || {header:{}}; const h=nfe.header||{};
    const fornecedor=(window.J?.fornecedores||[]).find(f=>f.id===val('nfFornec'))||{};
    const nfNumero=val('nfNumero') || h.numero || 's/n';
    const dataNF=val('nfData') || h.dataEmissao || todayISO();
    const totalNF=itens.reduce((s,i)=>s+(i.qtd*i.custo),0);
    const batch=db.batch();
    const nfRef=db.collection('notasFiscaisEntrada').doc();
    const nfPayload={ tenantId:window.J?.tid||'', numero:nfNumero, serie:h.serie||'', chave:h.chave||'', natureza:h.natureza||'', dataNF, fornecedorId:val('nfFornec')||'', fornecedorNome:fornecedor.nome||h.fornecedor?.nome||'', fornecedorCNPJ:fornecedor.cnpj||h.fornecedor?.cnpj||'', totalProdutos:h.totais?.vProd||totalNF, totalNF:h.totais?.vNF||totalNF, totalSistema:totalNF, duplicatas:h.duplicatas||[], itensCount:itens.length, createdAt:new Date().toISOString(), origem:'xml_ou_manual' };
    batch.set(nfRef,nfPayload);
    for(const item of itens){
      const itemFiscal={ tenantId:window.J?.tid||'', nfId:nfRef.id, nfNumero, dataNF, fornecedorId:val('nfFornec')||'', fornecedorNome:nfPayload.fornecedorNome, codigo:item.codigo, codigoOriginal:item.codigoOriginal||item.codigo, ean:item.ean, ncm:item.ncm, cest:item.cest, cfop:item.cfop, unidade:item.unidade||'UN', desc:item.desc, descricao:item.descricao||item.desc, qtd:item.qtd, custo:item.custo, venda:item.venda, valorTotal:+(item.qtd*item.custo).toFixed(2), valorBruto:item.valorBruto, desconto:item.desconto||0, impostos:item.impostos||{}, finalidade:item.finalidade, vinculo:item.vinculo, osId:item.osId, placa:item.placa, veiculo:item.veiculo, cliente:item.cliente, statusOS:item.statusOS, etapa:item.etapa, createdAt:new Date().toISOString() };
      batch.set(db.collection('nf_itens_vinculos').doc(), itemFiscal);
      if(item.finalidade === 'estoque' || item.finalidade === 'os' || item.finalidade === 'placa'){
        const existente=(window.J?.estoque||[]).find(p=>String(p.codigo||'')===String(item.codigo||'') || String(p.desc||'').toLowerCase()===String(item.desc||'').toLowerCase());
        if(existente){ batch.update(db.collection('estoqueItems').doc(existente.id), { qtd:(Number(existente.qtd)||0)+item.qtd, custo:item.custo, venda:item.venda, codigo:item.codigo||existente.codigo||'', ean:item.ean||existente.ean||'', ncm:item.ncm||existente.ncm||'', cfop:item.cfop||existente.cfop||'', updatedAt:new Date().toISOString() }); }
        else { batch.set(db.collection('estoqueItems').doc(), { tenantId:window.J?.tid||'', desc:item.desc, codigo:item.codigo||'', ean:item.ean||'', ncm:item.ncm||'', cest:item.cest||'', cfop:item.cfop||'', qtd:item.qtd, custo:item.custo, venda:item.venda, min:1, und:item.unidade||'UN', fornecedorId:val('nfFornec')||'', fornecedor:nfPayload.fornecedorNome, nfNumero, createdAt:new Date().toISOString() }); }
      }
    }
    const duplicatas = h.duplicatas?.length ? h.duplicatas : [];
    if(duplicatas.length){ duplicatas.forEach((d,idx)=>batch.set(db.collection('financeiro').doc(),{tenantId:window.J?.tid||'', tipo:'Saída', status:'Pendente', desc:`NF ${nfNumero} — ${nfPayload.fornecedorNome||'Fornecedor'} (${idx+1}/${duplicatas.length})`, valor:d.valor, pgto:'Boleto', venc:d.vencimento, vinculo:val('nfFornec')?`F_${val('nfFornec')}`:'', nfId:nfRef.id, nfNumero, createdAt:new Date().toISOString()})); }
    else {
      const nPar = ['Parcelado','Boleto'].includes(val('nfPgtoForma')) ? Math.max(1, Number(val('nfParcelas')||1)) : 1;
      const status = ['Dinheiro','PIX'].includes(val('nfPgtoForma')) ? 'Pago' : 'Pendente';
      for(let i=0;i<nPar;i++) batch.set(db.collection('financeiro').doc(),{tenantId:window.J?.tid||'', tipo:'Saída', status, desc:`NF ${nfNumero} — ${nfPayload.fornecedorNome||'Fornecedor'} ${nPar>1?`(${i+1}/${nPar})`:''}`, valor:totalNF/nPar, pgto:val('nfPgtoForma')||'Dinheiro', venc:somarMeses(val('nfVenc')||dataNF,i), vinculo:val('nfFornec')?`F_${val('nfFornec')}`:'', nfId:nfRef.id, nfNumero, createdAt:new Date().toISOString()});
    }
    await batch.commit();
    toast('✓ NF salva com fiscal, estoque, vínculo e financeiro.');
    auditSafe('NFE/ENTRADA',`Salvou NF ${nfNumero} com ${itens.length} item(ns).`, {nfNumero,totalNF,itens:itens.length});
    window.fecharModal && fecharModal('modalNF');
  };

  async function buscarCepGenerico(cep, prefix){
    const c=only(cep); if(c.length!==8) return;
    try{ const r=await fetch(`https://viacep.com.br/ws/${c}/json/`); const j=await r.json(); if(j.erro) throw new Error('CEP não encontrado');
      const map={ Rua:['Rua','Endereco','Logradouro'], Cep:['Cep'], Bairro:['Bairro'], Cidade:['Cidade'], Uf:['Uf','UF'] };
      const setAny=(suffix,val)=>{ for(const s of map[suffix]||[suffix]){ const el=$(prefix+s); if(el){ el.value=val||''; return; } } };
      setAny('Rua',j.logradouro); setAny('Bairro',j.bairro); setAny('Cidade',j.localidade); setAny('Uf',j.uf);
      toast('✓ CEP preenchido automaticamente');
    }catch(e){ toast('CEP não encontrado ou internet indisponível.', 'warn'); }
  }
  window.buscarCEPFornecedor = (cep)=>buscarCepGenerico(cep,'fornec');

  const oldBuscarCEP = window.buscarCEP;
  window.buscarCEP = async function(cep){
    const active=document.activeElement?.id||'';
    if(active.startsWith('fornec')) return buscarCepGenerico(cep,'fornec');
    if(typeof oldBuscarCEP==='function') return oldBuscarCEP(cep);
    return buscarCepGenerico(cep,'cli');
  };

  const oldSalvarFornec = window.salvarFornec;
  window.salvarFornec = async function(){
    const db=dbRef(); if(!db) return oldSalvarFornec && oldSalvarFornec();
    const nome=val('fornecNome'); if(!nome){ toast('Informe a razão social/nome do fornecedor.', 'warn'); return; }
    const payload={ tenantId:window.J?.tid||'', nome, razaoSocial:nome, fantasia:val('fornecFantasia'), cnpj:val('fornecCnpj'), ie:val('fornecIE'), segmento:val('fornecSeg'), wpp:val('fornecWpp'), telefone:val('fornecTelefone')||val('fornecWpp'), email:val('fornecEmail'), cep:val('fornecCep'), rua:val('fornecRua'), numero:val('fornecNumero'), complemento:val('fornecComplemento'), bairro:val('fornecBairro'), cidade:val('fornecCidade'), uf:val('fornecUf'), obs:val('fornecObs'), updatedAt:new Date().toISOString() };
    const id=val('fornecId'); if(id) await db.collection('fornecedores').doc(id).update(payload); else await db.collection('fornecedores').add({...payload,createdAt:new Date().toISOString()});
    toast('✓ Fornecedor salvo com cadastro completo.'); window.fecharModal && fecharModal('modalFornec');
  };

  const oldRenderFornec = window.renderFornecedores;
  window.renderFornecedores = function(){
    if($('tbFornec')) $('tbFornec').innerHTML=(window.J?.fornecedores||[]).map(f=>`<tr><td>${esc(f.nome||f.razaoSocial||'-')}<br><small>${esc(f.cnpj||'')}</small></td><td>${esc(f.segmento||'-')}<br><small>${esc([f.cidade,f.uf].filter(Boolean).join('/'))}</small></td><td>${esc(f.wpp||f.telefone||'-')}</td><td><button class="btn-ghost" onclick="window.prepFornec&&window.prepFornec('${esc(f.id)}');abrirModal('modalFornec')">✏</button><button class="btn-danger" onclick="window.excluirFornecedorDef?window.excluirFornecedorDef('${esc(f.id)}'):(window.deletarFornec?window.deletarFornec('${esc(f.id)}'):alert('Exclusao bloqueada: auditoria indisponivel.'))">🗑</button></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">Nenhum fornecedor cadastrado</td></tr>';
    else oldRenderFornec && oldRenderFornec();
  };

  const oldPrepFornec = window.prepFornec;
  window.prepFornec = function(id){
    oldPrepFornec && oldPrepFornec(id);
    ['fornecFantasia','fornecCnpj','fornecIE','fornecTelefone','fornecEmail','fornecCep','fornecRua','fornecNumero','fornecComplemento','fornecBairro','fornecCidade','fornecUf','fornecObs'].forEach(k=>{ if($(k)) $(k).value=''; });
    if(id){ const f=(window.J?.fornecedores||[]).find(x=>x.id===id)||{}; Object.entries({fornecFantasia:f.fantasia,fornecCnpj:f.cnpj,fornecIE:f.ie,fornecTelefone:f.telefone,fornecEmail:f.email,fornecCep:f.cep,fornecRua:f.rua||f.logradouro||f.endereco,fornecNumero:f.numero,fornecComplemento:f.complemento,fornecBairro:f.bairro,fornecCidade:f.cidade,fornecUf:f.uf,fornecObs:f.obs}).forEach(([k,v])=>{ if($(k)) $(k).value=v||''; }); }
  };

  document.addEventListener('DOMContentLoaded', injectStyles);
})();
