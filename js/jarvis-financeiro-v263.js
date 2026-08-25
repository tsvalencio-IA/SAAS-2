/**
 * thIAguinho ERP V26.3 — Usabilidade do Financeiro no Jarvis
 * - filtros rápidos por categoria (comissão, salário, gastos internos etc.)
 * - lançamento categorizado de gastos internos/manutenção
 * - seleção múltipla com ações em lote (pago/pendente)
 * - tabela responsiva sem rolagem horizontal no celular
 * - cotação da O.S. minimizável/maximizável
 *
 * Camada aditiva: preserva os lançamentos, agrupamento de boletos, DRE,
 * comissões, RH e rotinas anteriores.
 */
(function financeiroJarvisV263(){
  'use strict';

  const W = window;
  const D = document;
  const byId = id => D.getElementById(id);
  const norm = v => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const num = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).trim();
    if (!s) return 0;
    const n = Number(s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s);
    return Number.isFinite(n) ? n : 0;
  };
  const money = v => typeof W.moeda === 'function'
    ? W.moeda(num(v))
    : num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const getState = () => W.J || {};
  const getFin = () => Array.isArray(getState().financeiro) ? getState().financeiro : [];

  const CATEGORY_LABELS = {
    todos: 'Todos',
    comissao: 'Comissões',
    salario: 'Salários',
    vale: 'Vales / adiantamentos',
    gasto_interno: 'Gastos internos',
    manutencao_interna: 'Manutenção interna',
    fornecedor: 'Fornecedores / peças',
    imposto: 'Impostos / taxas',
    estrutura: 'Aluguel / estrutura',
    receita: 'Receitas',
    outros: 'Outros'
  };

  function categoryOf(fin){
    const f = fin || {};
    const cat = norm(f.categoria || f.category || f.tipoCategoria || '');
    const text = norm([
      f.desc, f.nota, f.pgto, f.origem, f.tipoDocumento, f.rhTipo,
      f.categoria, f.category, f.vinculo
    ].join(' '));

    if (f.isComissao === true || cat.includes('comissao') || /\bcomiss/.test(text)) return 'comissao';
    if (cat.includes('salario') || /pagamento salario|\bsalario\b|folha de pagamento/.test(text)) return 'salario';
    if (cat.includes('vale') || cat.includes('adiantamento') || /vale\s*\/|\bvale\b|adiantamento/.test(text)) return 'vale';
    if (cat.includes('manutencao_interna') || cat.includes('manutencao') || /manutencao interna|manutencao da oficina|conserto de equipamento|reparo de equipamento/.test(text)) return 'manutencao_interna';
    if (cat.includes('gasto_interno') || cat.includes('despesa_interna') || f.isGastoInterno === true || /gasto interno|despesa interna/.test(text)) return 'gasto_interno';
    if (cat.includes('imposto') || cat.includes('taxa') || /imposto|tributo|taxa bancaria|taxa de cartao/.test(text)) return 'imposto';
    if (cat.includes('aluguel') || cat.includes('estrutura') || /aluguel|condominio|energia eletrica|conta de agua|internet da oficina/.test(text)) return 'estrutura';
    if (String(f.vinculo || '').startsWith('F_') || f.fornecedorId || cat.includes('fornecedor') || cat.includes('nota_fiscal') || f.nfNumero || f.chaveNFe) return 'fornecedor';
    if (String(f.tipo || '').toLowerCase() === 'entrada') return 'receita';
    return 'outros';
  }

  function categoryLabel(finOrKey){
    const key = typeof finOrKey === 'string' ? finOrKey : categoryOf(finOrKey);
    return CATEGORY_LABELS[key] || 'Outros';
  }

  W.thiaFinanceiroV263 = Object.assign(W.thiaFinanceiroV263 || {}, {
    categoryOf,
    categoryLabel
  });

  function injectStyle(){
    if (byId('styleFinanceiroV263')) return;
    const st = D.createElement('style');
    st.id = 'styleFinanceiroV263';
    st.textContent = `
      #s-financeiro .fin-v263-toolbar{display:flex;flex-direction:column;gap:10px;padding:12px;border-bottom:1px solid var(--border);background:rgba(0,212,255,.035)}
      #s-financeiro .fin-v263-quick{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      #s-financeiro .fin-v263-chip{border:1px solid var(--border);background:var(--surf3);color:var(--muted2);padding:7px 10px;border-radius:999px;font:700 .62rem var(--fm);cursor:pointer;white-space:normal}
      #s-financeiro .fin-v263-chip.active{border-color:rgba(0,212,255,.65);background:rgba(0,212,255,.12);color:var(--cyan)}
      #s-financeiro .fin-v263-lote{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border:1px dashed rgba(0,212,255,.28);border-radius:5px;background:rgba(0,0,0,.1)}
      #s-financeiro .fin-v263-lote strong{font:800 .66rem var(--fm);color:var(--cyan);margin-right:auto}
      #s-financeiro .fin-v263-lote .j-select,#s-financeiro .fin-v263-lote .j-input{width:auto;min-width:145px;max-width:220px}
      #s-financeiro .fin-v263-rowcheck{display:inline-flex;align-items:center;justify-content:center;margin-right:6px;padding:5px;border:1px solid rgba(0,212,255,.28);border-radius:4px;background:rgba(0,212,255,.06)}
      #s-financeiro .fin-v263-rowcheck input{width:17px;height:17px;min-height:0;margin:0}
      #s-financeiro .fin-v263-cat{display:inline-block;margin-top:5px;padding:3px 6px;border:1px solid rgba(159,122,234,.28);border-radius:999px;color:var(--purple);font:700 .56rem var(--fm)}
      #s-financeiro .fin-v263-count{font:700 .58rem var(--fm);opacity:.8;margin-left:3px}
      #s-financeiro .j-card-header{align-items:flex-start;flex-wrap:wrap;gap:10px}
      #s-financeiro .j-card-header>div:last-child{display:flex!important;gap:8px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-end}
      #s-financeiro .j-card-header>div:last-child>.j-select,
      #s-financeiro .j-card-header>div:last-child>.j-input{max-width:100%}
      #s-financeiro .fin-v263-gasto-btn{border-color:rgba(245,158,11,.55)!important;color:#fbbf24!important}
      #cotacaoPecasOS.cot-v263{border:1px solid rgba(0,255,136,.22)!important;border-radius:5px;padding:0!important;overflow:hidden}
      #cotacaoPecasOS .cot-v263-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;background:rgba(0,255,136,.07);border-bottom:1px solid rgba(0,255,136,.18)}
      #cotacaoPecasOS .cot-v263-title{font:800 .72rem var(--fm);letter-spacing:1px;color:var(--success);overflow-wrap:anywhere}
      #cotacaoPecasOS .cot-v263-body{padding:12px;min-width:0}
      #cotacaoPecasOS[data-collapsed="1"] .cot-v263-body{display:none}
      #cotacaoPecasOS[data-collapsed="1"] .cot-v263-head{border-bottom:0}
      #cotacaoPecasOS .cot-v263-toggle{flex:0 0 auto;max-width:100%;white-space:normal}
      @media(max-width:980px){
        #s-financeiro .j-card-header>div:last-child{width:100%;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #s-financeiro .j-card-header>div:last-child>*{width:100%!important;min-width:0!important}
        #s-financeiro .fin-v263-lote{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
        #s-financeiro .fin-v263-lote strong{grid-column:1/-1;margin:0}
        #s-financeiro .fin-v263-lote>*{width:100%!important;max-width:none!important;min-width:0!important}
        #s-financeiro .j-card-body{overflow:visible!important}
        #s-financeiro table.j-table{display:block;width:100%;border:0}
        #s-financeiro table.j-table thead{display:none}
        #s-financeiro table.j-table tbody{display:block;width:100%}
        #s-financeiro table.j-table tbody tr{display:block;width:calc(100% - 16px);margin:8px;border:1px solid var(--border);border-radius:6px;background:var(--surf2);overflow:hidden}
        #s-financeiro table.j-table tbody td{display:grid;grid-template-columns:minmax(105px,35%) minmax(0,1fr);gap:10px;align-items:center;width:100%;box-sizing:border-box;padding:9px 11px!important;border-bottom:1px solid rgba(255,255,255,.06);white-space:normal!important;overflow-wrap:anywhere;word-break:break-word}
        #s-financeiro table.j-table tbody td:last-child{border-bottom:0}
        #s-financeiro table.j-table tbody td::before{content:attr(data-label);font:800 .56rem var(--fm);letter-spacing:.6px;color:var(--muted);text-transform:uppercase}
        #s-financeiro table.j-table tbody td[colspan]{display:block;text-align:center!important}
        #s-financeiro table.j-table tbody td[colspan]::before{display:none}
        #s-financeiro table.j-table tbody td:last-child>button,#s-financeiro table.j-table tbody td:last-child>label{margin:3px}
      }
      @media(max-width:560px){
        #s-financeiro .dre-grid{grid-template-columns:1fr!important}
        #s-financeiro .j-card-header>div:last-child{grid-template-columns:1fr!important}
        #s-financeiro .fin-v263-lote{grid-template-columns:1fr}
        #s-financeiro .fin-v263-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
        #s-financeiro .fin-v263-chip{width:100%;text-align:center}
        #s-financeiro table.j-table tbody td{grid-template-columns:1fr;gap:4px}
        #cotacaoPecasOS .cot-v263-head{align-items:flex-start;flex-direction:column}
        #cotacaoPecasOS .cot-v263-toggle{width:100%}
      }
    `;
    D.head.appendChild(st);
  }

  function ensureCategoryField(){
    if (byId('finCategoria')) return;
    const vinculo = byId('finVinculo')?.closest('.form-group');
    if (!vinculo) return;
    const group = D.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label class="j-label">Categoria / finalidade</label>
      <select class="j-select" id="finCategoria">
        <option value="outros">Outros</option>
        <option value="receita">Receita operacional</option>
        <option value="fornecedor">Fornecedor / peças / NF</option>
        <option value="comissao">Comissão</option>
        <option value="salario">Salário</option>
        <option value="vale">Vale / adiantamento</option>
        <option value="manutencao_interna">Manutenção interna</option>
        <option value="gasto_interno">Outro gasto interno</option>
        <option value="imposto">Impostos / taxas</option>
        <option value="estrutura">Aluguel / estrutura</option>
      </select>
      <small style="font-family:var(--fm);font-size:.58rem;color:var(--muted);">Usada nos filtros e relatórios. Não altera o valor nem o vínculo do lançamento.</small>`;
    vinculo.insertAdjacentElement('afterend', group);
  }

  function matchesCategory(fin, key){
    if (!key || key === 'todos') return true;
    const cat = categoryOf(fin);
    if (key === 'gasto_interno') return cat === 'gasto_interno' || cat === 'manutencao_interna' || cat === 'imposto' || cat === 'estrutura';
    return cat === key;
  }

  W.financeiroSelecaoLoteV263 = W.financeiroSelecaoLoteV263 || new Set();
  W.financeiroVisiveisV263 = W.financeiroVisiveisV263 || [];

  function selectedRecords(){
    const valid = new Set(getFin().map(f => String(f.id)));
    [...W.financeiroSelecaoLoteV263].forEach(id => { if (!valid.has(String(id))) W.financeiroSelecaoLoteV263.delete(id); });
    return [...W.financeiroSelecaoLoteV263].map(id => getFin().find(f => String(f.id) === String(id))).filter(Boolean);
  }

  function refreshBulkSummary(){
    const list = selectedRecords();
    const total = list.reduce((s,f)=>s+num(f.valor),0);
    const el = byId('finLoteResumoV263');
    if (el) el.textContent = list.length ? `${list.length} selecionado(s) • ${money(total)}` : 'Nenhum lançamento selecionado';
  }

  W.toggleFinanceiroLoteV263 = function(id, checked){
    if (checked) W.financeiroSelecaoLoteV263.add(String(id));
    else W.financeiroSelecaoLoteV263.delete(String(id));
    refreshBulkSummary();
  };
  W.selecionarFinanceiroVisivelV263 = function(mark){
    (W.financeiroVisiveisV263 || []).forEach(id => mark ? W.financeiroSelecaoLoteV263.add(String(id)) : W.financeiroSelecaoLoteV263.delete(String(id)));
    D.querySelectorAll('.fin-v263-checkbox').forEach(ch => { ch.checked = !!mark; });
    refreshBulkSummary();
  };
  W.limparFinanceiroLoteV263 = function(){
    W.financeiroSelecaoLoteV263.clear();
    D.querySelectorAll('.fin-v263-checkbox').forEach(ch => { ch.checked = false; });
    refreshBulkSummary();
  };

  async function batchUpdate(ids, patchFactory){
    const chunks = [];
    for (let i=0;i<ids.length;i+=400) chunks.push(ids.slice(i,i+400));
    for (const chunk of chunks){
      const batch = W.db.batch();
      chunk.forEach(id => batch.update(W.db.collection('financeiro').doc(id), patchFactory(id)));
      await batch.commit();
    }
  }

  W.aplicarAcaoFinanceiroLoteV263 = async function(status){
    const list = selectedRecords();
    if (!list.length){ W.toast?.('⚠ Selecione ao menos um lançamento','warn'); return; }
    const label = status === 'Pago' ? 'marcar como pago' : 'voltar para pendente';
    if (!confirm(`Deseja ${label} ${list.length} lançamento(s)?`)) return;
    if (status === 'Pago' && list.some(f => categoryOf(f) === 'comissao')) {
      if (!confirm('A seleção contém comissão. A ação em lote liquidará os títulos selecionados diretamente. Para registrar divisão por O.S./serviço e pagamento parcial, continue usando o pagamento detalhado da Equipe. Deseja continuar?')) return;
    }
    const forma = byId('finLotePgtoV263')?.value || '';
    const data = byId('finLoteDataV263')?.value || todayISO();
    const agora = new Date().toISOString();
    try{
      await batchUpdate(list.map(f=>String(f.id)), () => status === 'Pago'
        ? {status:'Pago', pgto: forma || 'PIX', dataPgto:data, pagoEm:agora, updatedAt:agora}
        : {status:'Pendente', dataPgto:'', pagoEm:'', updatedAt:agora});
      W.audit?.('FINANCEIRO', `${status === 'Pago' ? 'Liquidou' : 'Reabriu'} ${list.length} lançamento(s) em lote`);
      W.toast?.(`✓ ${list.length} LANÇAMENTO(S) ${status === 'Pago' ? 'MARCADOS COMO PAGOS' : 'MARCADO(S) COMO PENDENTES'}`);
      W.limparFinanceiroLoteV263();
    }catch(err){
      console.error('[Financeiro V26.3] ação em lote',err);
      W.toast?.('Erro ao atualizar os lançamentos em lote','err');
    }
  };

  function ensureToolbar(){
    const section = byId('s-financeiro');
    const cardBody = byId('tbFinanceiro')?.closest('.j-card-body');
    if (!section || !cardBody) return;

    const headerControls = section.querySelector('.j-card-header>div:last-child');

    if (headerControls && !byId('filtroFinCategoria')){
      const select = D.createElement('select');
      select.id = 'filtroFinCategoria';
      select.className = 'j-select';
      select.style.width = '180px';
      select.innerHTML = `
        <option value="todos">Todas as categorias</option>
        <option value="comissao">Comissões</option>
        <option value="salario">Salários</option>
        <option value="vale">Vales / adiantamentos</option>
        <option value="gasto_interno">Gastos internos</option>
        <option value="manutencao_interna">Manutenção interna</option>
        <option value="fornecedor">Fornecedores / peças</option>
        <option value="imposto">Impostos / taxas</option>
        <option value="estrutura">Aluguel / estrutura</option>
        <option value="receita">Receitas</option>
        <option value="outros">Outros</option>`;
      select.onchange = () => { W.thiaFinLimitV23 = 100; W.renderFinanceiro?.(); syncQuickChips(); };
      headerControls.insertBefore(select, headerControls.firstChild);
    }

    if (headerControls && !byId('btnGastoInternoV263')){
      const btn = D.createElement('button');
      btn.type = 'button';
      btn.id = 'btnGastoInternoV263';
      btn.className = 'btn-outline fin-v263-gasto-btn';
      btn.textContent = '+ GASTO INTERNO';
      btn.onclick = () => W.abrirGastoInternoV263?.();
      headerControls.appendChild(btn);
    }

    if (!byId('finToolbarV263')){
      const toolbar = D.createElement('div');
      toolbar.id = 'finToolbarV263';
      toolbar.className = 'fin-v263-toolbar';
      toolbar.innerHTML = `
        <div class="fin-v263-quick" id="finQuickV263">
          ${['todos','comissao','salario','vale','gasto_interno','fornecedor','receita'].map(k=>`<button type="button" class="fin-v263-chip" data-fin-cat="${k}" onclick="window.setFiltroFinanceiroV263('${k}')">${CATEGORY_LABELS[k]}</button>`).join('')}
        </div>
        <div class="fin-v263-lote">
          <strong id="finLoteResumoV263">Nenhum lançamento selecionado</strong>
          <button type="button" class="btn-outline" onclick="window.selecionarFinanceiroVisivelV263(true)">Selecionar visíveis</button>
          <button type="button" class="btn-ghost" onclick="window.limparFinanceiroLoteV263()">Limpar</button>
          <select class="j-select" id="finLotePgtoV263" aria-label="Forma de pagamento em lote">
            <option value="PIX">PIX</option><option value="Dinheiro">Dinheiro</option><option value="Transferência">Transferência</option><option value="Cartão Débito">Cartão Débito</option><option value="Cartão Crédito">Cartão Crédito</option><option value="Boleto">Boleto</option>
          </select>
          <input type="date" class="j-input" id="finLoteDataV263" value="${todayISO()}" aria-label="Data de pagamento em lote">
          <button type="button" class="btn-primary" onclick="window.aplicarAcaoFinanceiroLoteV263('Pago')">✓ MARCAR PAGO</button>
          <button type="button" class="btn-warn" onclick="window.aplicarAcaoFinanceiroLoteV263('Pendente')">↶ MARCAR PENDENTE</button>
        </div>`;
      const minibar = cardBody.querySelector('.fin-boleto-minibar');
      cardBody.insertBefore(toolbar, minibar || cardBody.firstChild);
    }
    syncQuickChips();
    refreshBulkSummary();
  }

  W.setFiltroFinanceiroV263 = function(key){
    const sel = byId('filtroFinCategoria');
    if (sel) sel.value = key || 'todos';
    W.thiaFinLimitV23 = 100;
    W.renderFinanceiro?.();
    syncQuickChips();
  };

  function syncQuickChips(){
    const key = byId('filtroFinCategoria')?.value || 'todos';
    D.querySelectorAll('[data-fin-cat]').forEach(btn => btn.classList.toggle('active', btn.dataset.finCat === key));
    const counts = {};
    getFin().forEach(f => { const c=categoryOf(f); counts[c]=(counts[c]||0)+1; counts.todos=(counts.todos||0)+1; });
    D.querySelectorAll('[data-fin-cat]').forEach(btn => {
      const k=btn.dataset.finCat;
      const baseLabel=CATEGORY_LABELS[k]||k;
      const count = k==='gasto_interno'
        ? getFin().filter(f=>matchesCategory(f,'gasto_interno')).length
        : (counts[k]||0);
      btn.innerHTML = `${baseLabel}<span class="fin-v263-count">${count}</span>`;
    });
  }

  function decorateRows(){
    const rows = [...D.querySelectorAll('#tbFinanceiro tr')];
    const visible = [];
    rows.forEach(tr => {
      const cells = [...tr.children];
      if (!cells.length) return;
      if (cells[0]?.hasAttribute('colspan')) return;
      ['Vencimento','Tipo','Descrição','Pagamento','Valor','Status','Selecionar / ações'].forEach((label,i)=>cells[i]?.setAttribute('data-label',label));
      const edit = tr.querySelector('button[onclick*="prepFin"]');
      const code = edit?.getAttribute('onclick') || '';
      const m = code.match(/prepFin\(['\"]([^'\"]+)['\"]\)/);
      const id = m?.[1];
      if (!id) return;
      tr.dataset.finId = String(id);
      const f = getFin().find(x => String(x.id) === String(id));
      const st = norm(f?.status);
      const canBulk = !!f && !['cancelado','cancelada'].includes(st) && f.canceladoPorReemissaoOS !== true && !f.agrupadoNoBoletoId && f.boletoAgrupadoOrigem !== true;
      if (canBulk) visible.push(String(id));
      const actionCell = cells[cells.length-1];
      if (actionCell && !actionCell.querySelector('.fin-v263-rowcheck')){
        const label = D.createElement('label');
        label.className = 'fin-v263-rowcheck';
        label.title = 'Selecionar para ação em lote';
        label.innerHTML = `<input type="checkbox" class="fin-v263-checkbox" value="${String(id).replace(/"/g,'&quot;')}" ${W.financeiroSelecaoLoteV263.has(String(id))?'checked':''} ${canBulk?'':'disabled'} aria-label="Selecionar lançamento">`;
        label.title = canBulk ? 'Selecionar para ação em lote' : 'Lançamento de origem agrupada/cancelado não pode ser alterado em lote';
        label.querySelector('input').onchange = e => W.toggleFinanceiroLoteV263(String(id),e.target.checked);
        actionCell.insertBefore(label, actionCell.firstChild);
      }
      const descCell = cells[2];
      if (f && descCell && !descCell.querySelector('.fin-v263-cat')){
        const tag = D.createElement('span');
        tag.className='fin-v263-cat';
        tag.textContent=categoryLabel(f);
        descCell.appendChild(D.createElement('br'));
        descCell.appendChild(tag);
      }
    });
    W.financeiroVisiveisV263 = visible;
    refreshBulkSummary();
  }

  function wrapRender(){
    if (W.__finRenderV263Wrapped || typeof W.renderFinanceiro !== 'function') return;
    const old = W.renderFinanceiro;
    W.renderFinanceiro = function(){
      ensureToolbar();
      const J = getState();
      const full = Array.isArray(J.financeiro) ? J.financeiro : [];
      const key = byId('filtroFinCategoria')?.value || 'todos';
      const filtered = key === 'todos' ? full : full.filter(f => matchesCategory(f,key));
      J.financeiro = filtered;
      try { old.apply(this,arguments); }
      finally { J.financeiro = full; }

      // DRE sempre permanece global, independentemente do filtro visual.
      let entradas=0,saidas=0;
      full.filter(f=>String(f.status)==='Pago').forEach(f=>String(f.tipo)==='Entrada'?entradas+=num(f.valor):saidas+=num(f.valor));
      if (byId('dreEntradas')) byId('dreEntradas').textContent=money(entradas);
      if (byId('dreSaidas')) byId('dreSaidas').textContent=money(saidas);
      if (byId('dreSaldo')) { byId('dreSaldo').textContent=money(entradas-saidas); byId('dreSaldo').style.color=(entradas-saidas)>=0?'var(--cyan)':'var(--danger)'; }
      decorateRows();
      syncQuickChips();
      W.renderServicosTerceirizadosFinanceiro?.();
    };
    W.__finRenderV263Wrapped = true;
  }

  function wrapExport(){
    if (W.__finExportV263Wrapped || typeof W.exportarFinanceiro !== 'function') return;
    const old = W.exportarFinanceiro;
    W.exportarFinanceiro = function(){
      const J=getState(),full=Array.isArray(J.financeiro)?J.financeiro:[];
      const key=byId('filtroFinCategoria')?.value||'todos';
      J.financeiro=key==='todos'?full:full.filter(f=>matchesCategory(f,key));
      try{return old.apply(this,arguments);}finally{J.financeiro=full;}
    };
    W.__finExportV263Wrapped=true;
  }

  function wrapPrepFin(){
    if (W.__finPrepV263Wrapped || typeof W.prepFin !== 'function') return;
    const old=W.prepFin;
    W.prepFin=function(id){
      const out=old.apply(this,arguments);
      ensureCategoryField();
      const f=id?getFin().find(x=>String(x.id)===String(id)):null;
      const sel=byId('finCategoria');
      if(sel){
        sel.value=f?categoryOf(f):(byId('finTipo')?.value==='Entrada'?'receita':'outros');
        sel.dataset.originalCategory=f?.categoria||f?.category||'';
        sel.dataset.initialValue=sel.value;
      }
      const title=byId('modalFin')?.querySelector('.modal-title');
      if(title) title.textContent=id?'EDITAR LANÇAMENTO FINANCEIRO':'LANÇAMENTO FINANCEIRO';
      return out;
    };
    W.__finPrepV263Wrapped=true;
  }

  function installSaveFin(){
    if (W.__finSaveV263Installed) return;
    W.salvarFin=async function(){
      const val=id=>byId(id)?.value||'';
      if(!val('finDesc')||!val('finValor')){W.toast?.('⚠ Preencha descrição e valor','warn');return;}
      const catField=byId('finCategoria');
      let categoria=val('finCategoria')||(val('finTipo')==='Entrada'?'receita':'outros');
      if(val('finId') && catField?.dataset.originalCategory && categoria===catField.dataset.initialValue) categoria=catField.dataset.originalCategory;
      const categoriaClassificada = val('finCategoria') || categoryOf({categoria,tipo:val('finTipo'),desc:val('finDesc')});
      const payload={
        tenantId:getState().tid,
        tipo:val('finTipo'),
        desc:val('finDesc'),
        valor:num(val('finValor')),
        pgto:val('finPgto'),
        venc:val('finVenc'),
        status:val('finStatus'),
        nota:val('finNota'),
        vinculo:val('finVinculo')||'',
        categoria,
        isGastoInterno:['gasto_interno','manutencao_interna','imposto','estrutura'].includes(categoriaClassificada),
        updatedAt:new Date().toISOString()
      };
      const id=val('finId');
      try{
        if(id){
          await W.db.collection('financeiro').doc(id).update(payload);
          W.toast?.('✓ LANÇAMENTO ATUALIZADO');
          W.audit?.('FINANCEIRO','Editou '+payload.tipo+': '+payload.desc);
        }else{
          payload.createdAt=new Date().toISOString();
          await W.db.collection('financeiro').add(payload);
          W.toast?.('✓ LANÇAMENTO REGISTRADO');
          W.audit?.('FINANCEIRO','Lançou '+payload.tipo+': '+payload.desc);
        }
        W.fecharModal?.('modalFin');
      }catch(err){
        console.error('[Financeiro V26.3] salvar',err);
        W.toast?.('Erro ao salvar lançamento financeiro','err');
      }
    };
    W.__finSaveV263Installed=true;
  }

  W.abrirGastoInternoV263=function(){
    ensureCategoryField();
    W.abrirModal?.('modalFin');
    W.prepFin?.();
    if(byId('finTipo'))byId('finTipo').value='Saída';
    if(byId('finCategoria'))byId('finCategoria').value='manutencao_interna';
    if(byId('finStatus'))byId('finStatus').value='Pendente';
    if(byId('finDesc')){byId('finDesc').placeholder='Ex: manutenção do elevador, ferramenta, limpeza, reparo interno...';setTimeout(()=>byId('finDesc')?.focus(),60);}
    const title=byId('modalFin')?.querySelector('.modal-title');
    if(title)title.textContent='GASTO INTERNO / MANUTENÇÃO';
  };

  function decorateCotacao(){
    const root=byId('cotacaoPecasOS');
    if(!root||root.dataset.v263==='1')return;
    root.dataset.v263='1';
    root.classList.add('cot-v263');
    const original=[...root.childNodes];
    const firstElement=original.find(n=>n.nodeType===1);
    if(firstElement&&/COTAÇÃO E COMPRA DAS PEÇAS DA O\.S\./i.test(firstElement.textContent||'')) firstElement.remove();
    const head=D.createElement('div');
    head.className='cot-v263-head';
    head.innerHTML=`<div class="cot-v263-title">COTAÇÃO E COMPRA DAS PEÇAS DA O.S.</div><button type="button" class="btn-ghost cot-v263-toggle">MINIMIZAR</button>`;
    const body=D.createElement('div');
    body.className='cot-v263-body';
    [...root.childNodes].forEach(n=>body.appendChild(n));
    root.appendChild(head);
    root.appendChild(body);
    const saved=localStorage.getItem('thia_cotacao_os_recolhida_v263');
    const collapsed=saved==='1';
    root.dataset.collapsed=collapsed?'1':'0';
    const btn=head.querySelector('button');
    const sync=()=>{btn.textContent=root.dataset.collapsed==='1'?'MAXIMIZAR':'MINIMIZAR';btn.setAttribute('aria-expanded',root.dataset.collapsed==='1'?'false':'true');};
    sync();
    btn.onclick=()=>{const next=root.dataset.collapsed==='1'?'0':'1';root.dataset.collapsed=next;localStorage.setItem('thia_cotacao_os_recolhida_v263',next);sync();};
  }

  function watchCotacao(){
    const slot=byId('cotacaoPecasOSSlot');
    if(!slot||slot.dataset.watchV263==='1')return;
    slot.dataset.watchV263='1';
    new MutationObserver(()=>setTimeout(decorateCotacao,0)).observe(slot,{childList:true,subtree:false});
    decorateCotacao();
  }

  function boot(){
    injectStyle();
    ensureCategoryField();
    ensureToolbar();
    wrapRender();
    wrapExport();
    wrapPrepFin();
    installSaveFin();
    watchCotacao();
    if(typeof W.renderFinanceiro==='function'&&byId('s-financeiro')?.classList.contains('active'))W.renderFinanceiro();
  }

  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',boot);else boot();
  [300,800,1500,3000].forEach(ms=>setTimeout(boot,ms));
})();
