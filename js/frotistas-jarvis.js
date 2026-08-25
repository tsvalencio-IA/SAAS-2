/**
 * OFICIN-IA — Gestão de Frotistas no Jarvis
 * V26.18.0
 * Escopo: cliente comum classificado como frotista, veículos vinculados e catálogo comercial.
 * Cliente Governo/Oficial não entra neste fluxo.
 */
(function(){
  'use strict';

  const W = window;
  const byId = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const num = v => {
    if (W.JOS?.parseNumberBR) return W.JOS.parseNumberBR(v);
    const s = String(v ?? '').trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g,'').replace(',','.')) || 0;
    if (s.includes(',')) return Number(s.replace(',','.')) || 0;
    return Number(s) || 0;
  };
  const moeda = v => 'R$ ' + num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const toast = (m,t='ok') => typeof W.toast === 'function' ? W.toast(m,t) : alert(m);
  const J = () => W.J || {};
  const roleOK = () => ['admin','gestor','gerente','superadmin'].includes(String(J().role || sessionStorage.getItem('j_role') || '').toLowerCase());
  const clienteAtual = () => {
    const id = String(byId('cliId')?.value || '');
    return (J().clientes || []).find(c => String(c.id) === id) || null;
  };
  const protegido = c => !!c && String(c.tipoCliente || '').toLowerCase() === 'governo';
  const ehFrotista = c => !!c && !protegido(c) && (c.frotista === true || String(c.categoriaComercial || '').toLowerCase() === 'frotista');
  const veiculos = c => c?.id ? (J().veiculos || []).filter(v => String(v.clienteId || '') === String(c.id)) : [];
  const catalogo = c => {
    if (Array.isArray(c?.catalogoPecasFrotista) && c.catalogoPecasFrotista.length) return c.catalogoPecasFrotista.slice();
    const legado = Array.isArray(c?.tabelaPrecosOS) ? c.tabelaPrecosOS : [];
    return legado.map(p => ({
      id:p.id || ('leg_'+Math.random().toString(36).slice(2)), grupo:p.grupo || 'Peças cadastradas',
      categoria:p.categoria || p.descricao || p.desc || '', descricao:p.descricao || p.desc || '',
      codigos:[p.codigo].filter(Boolean), qtdPadrao:p.qtdPadrao || 1, venda:num(p.venda || 0),
      aplicacaoTipo:p.veiculoIdReferencia ? 'veiculo' : (p.veiculoModeloKey ? 'modelo' : 'todos'),
      aplicacaoValor:p.veiculoIdReferencia || p.veiculoModeloKey || '*',
      veiculoId:p.veiculoIdReferencia || '', veiculoModeloKey:p.veiculoModeloKey || '', veiculoModelo:p.veiculoModelo || ''
    }));
  };

  function opcoesAplicacao(c, atual){
    atual = atual || {};
    const vs = veiculos(c);
    const tipoAtual = String(atual.aplicacaoTipo || 'todos');
    const valorAtual = String(atual.aplicacaoValor || atual.veiculoId || atual.veiculoModeloKey || '*');
    let out = `<option value="todos:*" ${tipoAtual==='todos'?'selected':''}>Toda a frota</option>`;
    const modelos = new Map();
    vs.forEach(v => {
      const label = [v.marca,v.modelo].filter(Boolean).join(' ').trim() || v.modelo || v.placa || 'Veículo';
      const key = norm(label);
      if (key && !modelos.has(key)) modelos.set(key,label);
    });
    if (modelos.size) {
      out += '<optgroup label="Por modelo">';
      modelos.forEach((label,key) => { out += `<option value="modelo:${esc(key)}" ${tipoAtual==='modelo'&&valorAtual===key?'selected':''}>${esc(label)}</option>`; });
      out += '</optgroup>';
    }
    if (vs.length) {
      out += '<optgroup label="Veículo específico">';
      vs.forEach(v => {
        const label=[v.placa,v.modelo].filter(Boolean).join(' • ') || 'Veículo';
        out += `<option value="veiculo:${esc(v.id)}" ${tipoAtual==='veiculo'&&valorAtual===String(v.id)?'selected':''}>${esc(label)}</option>`;
      });
      out += '</optgroup>';
    }
    return out;
  }

  W._toggleClienteFrotistaBlock = function(mostrar){
    const block = byId('cliFrotistaBlock');
    if (!block) return;
    const gov = !!byId('cliTipoGov')?.checked;
    block.style.display = mostrar && !gov && roleOK() ? 'block' : 'none';
    if (block.style.display !== 'none') W.renderFrotistaJarvis?.();
  };

  W.renderFrotistaJarvis = function(){
    const block = byId('cliFrotistaBlock');
    if (!block || block.style.display === 'none') return;
    const c = clienteAtual();
    const resumo = byId('cliFrotistaResumo');
    const boxV = byId('cliFrotistaVeiculos');
    const boxC = byId('cliFrotistaCatalogo');
    const app = byId('cliFrotistaAplicacao');
    const btnV = byId('cliFrotistaNovoVeiculo');
    if (!c?.id) {
      if (resumo) resumo.textContent = 'Novo frotista: salve primeiro o cadastro para habilitar a frota e a tabela de peças.';
      if (boxV) boxV.innerHTML = '<div style="font-size:.65rem;color:var(--muted);padding:8px;border:1px dashed var(--border);">Os veículos serão vinculados ao cliente após o primeiro salvamento.</div>';
      if (boxC) boxC.innerHTML = '<div style="font-size:.65rem;color:var(--muted);padding:8px;border:1px dashed var(--border);">Salve o frotista antes de cadastrar peças.</div>';
      if (btnV) btnV.disabled = true;
      if (app) app.innerHTML = '<option value="todos:*">Toda a frota</option>';
      return;
    }
    if (protegido(c)) { block.style.display='none'; return; }
    const vs = veiculos(c), cat = catalogo(c);
    if (btnV) btnV.disabled = false;
    if (resumo) resumo.textContent = `${vs.length} veículo(s) vinculado(s) • ${cat.length} item(ns) cadastrado(s)`;
    if (boxV) boxV.innerHTML = vs.length
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${vs.map(v=>`<span class="pill pill-cyan" title="${esc(v.modelo||'')}">${esc(v.placa||'S/PLACA')} • ${esc(v.modelo||'')}</span>`).join('')}</div>`
      : '<div style="font-size:.65rem;color:var(--muted);padding:8px;border:1px dashed var(--border);">Nenhum veículo vinculado. Use “+ VEÍCULO DA FROTA”.</div>';
    if (app && !byId('cliFrotistaItemId')?.value) app.innerHTML = opcoesAplicacao(c,{});

    if (boxC) {
      if (!cat.length) boxC.innerHTML = '<div style="font-size:.65rem;color:var(--muted);padding:8px;border:1px dashed var(--border);">Nenhuma peça cadastrada para este frotista.</div>';
      else {
        const grupos = new Map();
        cat.forEach(item => { const g=String(item.grupo||'Sem grupo'); if(!grupos.has(g)) grupos.set(g,[]); grupos.get(g).push(item); });
        boxC.innerHTML = Array.from(grupos.entries()).map(([g,itens]) => `
          <div style="border:1px solid var(--border);border-radius:3px;margin-bottom:8px;overflow:hidden;">
            <div style="padding:7px 9px;background:rgba(0,212,255,.04);font-family:var(--fm);font-size:.63rem;color:var(--cyan);font-weight:700;letter-spacing:1px;">${esc(g.toUpperCase())}</div>
            ${itens.map(item=>{
              const cod=Array.isArray(item.codigos)?item.codigos.filter(Boolean):[];
              const aplic=item.aplicacaoLabel || (item.aplicacaoTipo==='modelo' ? `Modelo: ${item.veiculoModelo||item.aplicacaoValor||''}` : item.aplicacaoTipo==='veiculo' ? [item.veiculoPlaca,item.veiculoModelo].filter(Boolean).join(' • ') : 'Toda a frota');
              return `<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border-top:1px solid var(--border);align-items:center;">
                <div style="min-width:0"><b style="font-size:.72rem">${esc(item.categoria||item.descricao||'Peça')}</b><div style="font-family:var(--fm);font-size:.59rem;color:var(--muted);margin-top:2px;line-height:1.45;">${esc(aplic)} • Qtd ${esc(item.qtdPadrao||1)} • ${moeda(item.venda||0)}${cod.length?'<br>Códigos: '+esc(cod.join(' • ')):''}</div></div>
                <div style="display:flex;gap:4px;flex-shrink:0"><button type="button" class="btn-ghost" onclick="window.editarItemFrotistaJarvis('${esc(item.id)}')">✏</button><button type="button" class="btn-danger" onclick="window.excluirItemFrotistaJarvis('${esc(item.id)}')">×</button></div>
              </div>`;
            }).join('')}
          </div>`).join('');
      }
    }
  };

  W.limparItemFrotistaJarvis = function(){
    if (byId('cliFrotistaItemId')) byId('cliFrotistaItemId').value='';
    ['cliFrotistaGrupo','cliFrotistaCategoria','cliFrotistaCodigos','cliFrotistaVenda'].forEach(id=>{ if(byId(id)) byId(id).value=''; });
    if (byId('cliFrotistaQtd')) byId('cliFrotistaQtd').value='1';
    if (byId('cliFrotistaCancelarItem')) byId('cliFrotistaCancelarItem').style.display='none';
    const c=clienteAtual(); if(byId('cliFrotistaAplicacao')) byId('cliFrotistaAplicacao').innerHTML=opcoesAplicacao(c||{},{});
  };

  W.editarItemFrotistaJarvis = function(id){
    const c=clienteAtual(); if(!c || protegido(c)) return;
    const item=catalogo(c).find(x=>String(x.id)===String(id)); if(!item) return;
    byId('cliFrotistaItemId').value=item.id||'';
    byId('cliFrotistaGrupo').value=item.grupo||'';
    byId('cliFrotistaCategoria').value=item.categoria||item.descricao||'';
    byId('cliFrotistaCodigos').value=Array.isArray(item.codigos)?item.codigos.join(', '):'';
    byId('cliFrotistaQtd').value=String(item.qtdPadrao||1).replace('.',',');
    byId('cliFrotistaVenda').value=num(item.venda||0).toFixed(2).replace('.',',');
    byId('cliFrotistaAplicacao').innerHTML=opcoesAplicacao(c,item);
    byId('cliFrotistaCancelarItem').style.display='';
  };

  async function persistir(c, itens, acao){
    if(!c?.id || protegido(c) || !roleOK()) return false;
    const db=W.db || J().db; if(!db) throw new Error('Firestore indisponível');
    await db.collection('clientes').doc(c.id).update({catalogoPecasFrotista:itens, updatedAt:new Date().toISOString()});
    c.catalogoPecasFrotista=itens;
    try { W.audit?.('CLIENTES',acao); } catch(_){}
    return true;
  }

  W.salvarItemFrotistaJarvis = async function(){
    try {
      const c=clienteAtual();
      if(!c?.id){ toast('Salve o cliente como Frotista primeiro.','warn'); return; }
      if(protegido(c) || !roleOK()) return;
      if(!byId('cliTipoFrotista')?.checked && !ehFrotista(c)){ toast('Marque o cliente como Frotista primeiro.','warn'); return; }
      const grupo=String(byId('cliFrotistaGrupo')?.value||'').trim();
      const categoria=String(byId('cliFrotistaCategoria')?.value||'').trim();
      const venda=num(byId('cliFrotistaVenda')?.value||0);
      const qtd=Math.max(num(byId('cliFrotistaQtd')?.value||1),0.01);
      if(!grupo || !categoria){ toast('Informe grupo e categoria/peça.','warn'); return; }
      const codigos=Array.from(new Set(String(byId('cliFrotistaCodigos')?.value||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean)));
      const raw=String(byId('cliFrotistaAplicacao')?.value||'todos:*');
      const pos=raw.indexOf(':'); const tipo=pos>=0?raw.slice(0,pos):'todos'; const valor=pos>=0?raw.slice(pos+1):'*';
      const vs=veiculos(c);
      let aplicacaoLabel='Toda a frota', veiculoModelo='', veiculoPlaca='';
      if(tipo==='modelo'){
        const v=vs.find(x=>norm([x.marca,x.modelo].filter(Boolean).join(' ').trim()||x.modelo||x.placa)===valor);
        veiculoModelo=[v?.marca,v?.modelo].filter(Boolean).join(' ').trim()||v?.modelo||valor; aplicacaoLabel='Modelo: '+veiculoModelo;
      } else if(tipo==='veiculo'){
        const v=vs.find(x=>String(x.id)===valor); veiculoModelo=v?.modelo||''; veiculoPlaca=v?.placa||''; aplicacaoLabel=[veiculoPlaca,veiculoModelo].filter(Boolean).join(' • ')||'Veículo específico';
      }
      const itens=catalogo(c); const edit=String(byId('cliFrotistaItemId')?.value||''); const idx=itens.findIndex(x=>String(x.id)===edit); const antigo=idx>=0?itens[idx]:null;
      const item=Object.assign({},antigo||{}, {
        id:antigo?.id || ('cf_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),
        grupo,categoria,descricao:categoria,codigos,qtdPadrao:qtd,venda,
        aplicacaoTipo:['todos','modelo','veiculo'].includes(tipo)?tipo:'todos', aplicacaoValor:valor, aplicacaoLabel,
        veiculoModeloKey:tipo==='modelo'?valor:'', veiculoModelo, veiculoId:tipo==='veiculo'?valor:'', veiculoPlaca,
        createdAt:antigo?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
      });
      if(idx>=0) itens[idx]=item; else itens.push(item);
      await persistir(c,itens,`${idx>=0?'Atualizou':'Cadastrou'} peça frotista ${categoria}`);
      W.limparItemFrotistaJarvis(); W.renderFrotistaJarvis(); toast(idx>=0?'Peça do frotista atualizada.':'Peça cadastrada para o frotista.','ok');
    } catch(e){ console.error('[Frotista] salvar item',e); toast('Erro ao salvar peça do frotista: '+e.message,'err'); }
  };

  W.excluirItemFrotistaJarvis = async function(id){
    try {
      const c=clienteAtual(); if(!c?.id || protegido(c) || !roleOK()) return;
      const itens=catalogo(c), item=itens.find(x=>String(x.id)===String(id)); if(!item) return;
      if(!confirm(`Excluir “${item.categoria||item.descricao||'peça'}” da tabela deste frotista?`)) return;
      const novos=itens.filter(x=>String(x.id)!==String(id));
      await persistir(c,novos,`Excluiu peça frotista ${item.categoria||item.descricao||id}`);
      W.limparItemFrotistaJarvis(); W.renderFrotistaJarvis(); toast('Peça removida da tabela do frotista.','ok');
    } catch(e){ console.error('[Frotista] excluir item',e); toast('Erro ao excluir peça: '+e.message,'err'); }
  };

  W.novoVeiculoFrotistaJarvis = function(){
    const c=clienteAtual();
    if(!c?.id){ toast('Salve o frotista antes de cadastrar o veículo.','warn'); return; }
    if(protegido(c) || !roleOK()) return;
    W.__THIA_V20_VEHICLE_FROM_CLIENT__=c.id;
    try { W.fecharModal?.('modalCliente'); } catch(_){}
    W.prepVeiculo?.('add');
    setTimeout(()=>{
      if(byId('veicDono')) byId('veicDono').value=c.id;
      W.abrirModal?.('modalVeiculo');
    },20);
  };

  // Mantém painel sincronizado após listeners locais, sem criar nenhuma leitura extra no Firebase.
  document.addEventListener('change', ev=>{
    if(ev.target?.id==='cliTipoFrotista') W._toggleClienteFrotistaBlock(!!ev.target.checked);
  });
})();
