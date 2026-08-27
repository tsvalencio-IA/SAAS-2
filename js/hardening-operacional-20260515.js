/*
 * thIAguinho SaaS - hardening operacional/fiscal/financeiro 2026-05-15
 * Camada conservadora: nao substitui os motores existentes; corrige fluxos
 * criticos de lote, auditoria interna, exibicao e IA local.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const byId = id => D.getElementById(id);
  const J = () => W.J || {};
  const db = () => W.db || null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function num(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function moeda(v) {
    return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(num(v));
  }
  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function placaNorm(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function vinculoFiscalReal(v) {
    const status = norm(v?.status || v?.statusVinculo || '');
    if (/(cancelad|excluid|estornad)/.test(status)) return false;
    const destino = String(v?.finalidade || v?.destino || '').toLowerCase().trim();
    if (destino === 'os' || destino === 'placa') return true;
    if (destino) return v?.estoqueBaixadoAutomatico === true;
    return !!(v?.estoqueBaixadoAutomatico || v?.osId || v?.placa);
  }
  function destinoFiscalResumo(v) {
    if (!vinculoFiscalReal(v)) return 'Estoque';
    const placa = v?.placa ? placaNorm(v.placa) : '';
    const os = v?.osId ? `OS #${String(v.osId).slice(-6).toUpperCase()}` : '';
    return [placa, os].filter(Boolean).join(' ') || 'Vinculado';
  }
  function pecaRealFiscalValida(p) {
    const nfId = String(p?.nfId || '').trim();
    const nfNumero = String(p?.nfNumero || p?.nf || p?.notaFiscal || '').trim();
    if (!nfId && !nfNumero) return true;
    const codP = codigoPecaNormalizado(p?.codigoFornecedor || p?.codigo || p?.codigoComercial || p?.oem || '');
    const descP = norm(p?.desc || p?.descricao || '');
    const candidatos = (J().nfItensVinculos || []).filter(v =>
      (!nfId || String(v.nfId || '').trim() === nfId) &&
      (!nfNumero || String(v.nfNumero || '').trim() === nfNumero)
    );
    const vinc = candidatos.find(v => {
      const codV = codigoPecaNormalizado(v.codigoFornecedor || v.codigo || v.codigoComercial || v.oem || '');
      const descV = norm(v.desc || v.descricao || '');
      return (codP && codV && codP === codV) || (descP && descV && descP === descV);
    });
    return !vinc || vinculoFiscalReal(vinc);
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function toast(msg, type) {
    if (typeof W.toast === 'function') W.toast(msg, type || 'ok');
    else console.log('[thIAguinho]', msg);
  }
  function modEnabled(key) {
    try { return typeof W.thiaModEnabled === 'function' ? W.thiaModEnabled(key) : (J().oficina?.modulos?.[key] !== false); }
    catch (_) { return true; }
  }
  function secret177() {
    return W._pecasReaisDesbloqueadas === true || D.body?.dataset?.secret177 === 'on';
  }
  function osUtils() {
    return W.JarvisOSUtils || W.JOS || {};
  }
  function clienteNome(id) {
    return (J().clientes || []).find(c => c.id === id)?.nome || '';
  }
  function veiculoByOS(os) {
    return (J().veiculos || []).find(v => v.id === (os?.veiculoId || os?.veiculo)) || {};
  }
  function osLabel(os) {
    const v = veiculoByOS(os);
    const c = (J().clientes || []).find(x => x.id === (os?.clienteId || v.clienteId)) || {};
    const placa = (os?.placa || v.placa || 'S/PLACA').toUpperCase();
    const prefixo = os?.prefixo || v.prefixo || '';
    const modelo = [v.marca, v.modelo || os?.veiculo].filter(Boolean).join(' ') || 'Veiculo';
    return `${prefixo ? 'Prefixo ' + prefixo + ' - ' : ''}${placa} - ${modelo} - ${c.nome || os?.cliente || 'Cliente'} - OS #${String(os?.id || '').slice(-6).toUpperCase()} - ${os?.status || 'sem status'}`;
  }
  function osEmAtendimento(os) {
    const st = norm([os?.status, os?.etapa].filter(Boolean).join(' '));
    if (!st) return true;
    return !/(cancelad|entreg|finaliz|encerrad|recusad|arquivad|excluid)/.test(st);
  }

  function installCSS() {
    if (byId('hardeningOperacionalCss')) return;
    const st = D.createElement('style');
    st.id = 'hardeningOperacionalCss';
    st.textContent = `
      .op-card{border:1px solid var(--border);background:var(--surf2);border-radius:4px;padding:12px;margin:12px 0;}
      .op-title{font-family:var(--fd);font-weight:800;letter-spacing:.8px;color:var(--cyan);font-size:.78rem;margin-bottom:8px;}
      .op-grid{display:grid;gap:8px;}
      .op-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:var(--fm);font-size:.62rem;margin:2px;background:rgba(255,255,255,.04);}
      .op-chip.ok{color:var(--success);border-color:rgba(0,255,170,.28);}
      .op-chip.warn{color:var(--warn);border-color:rgba(255,184,0,.35);}
      .op-chip.danger{color:var(--danger);border-color:rgba(255,59,59,.35);}
      .op-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:4px;}
      .op-table{width:100%;border-collapse:collapse;min-width:720px;}
      .op-table th,.op-table td{padding:8px;border-bottom:1px solid var(--border);text-align:left;font-size:.74rem;vertical-align:top;}
      .op-table th{font-family:var(--fm);font-size:.62rem;color:var(--muted);letter-spacing:.8px;background:rgba(0,0,0,.12);}
      .nf-batch-tools{border:1px solid rgba(0,194,255,.22);background:rgba(0,194,255,.06);border-radius:4px;padding:10px;margin-bottom:10px;}
      .nf-real-row{position:relative;}
      .nf-batch-check{position:absolute;right:44px;top:8px;z-index:2;font-family:var(--fm);font-size:.6rem;color:var(--cyan);display:flex;align-items:center;gap:4px;background:var(--surf2);border:1px solid var(--border);border-radius:3px;padding:3px 6px;}
      .hist-os-card summary{list-style:none;cursor:pointer;}
      .hist-os-card summary::-webkit-details-marker{display:none;}
      .hist-os-chevron{font-family:var(--fm);font-size:.78rem;color:var(--cyan);transition:transform .16s ease;display:inline-block;}
      .hist-os-card[open] .hist-os-chevron{transform:rotate(90deg);}
      .exec-finalizados details{border:1px solid rgba(0,255,170,.18);background:rgba(0,255,170,.035);border-radius:4px;padding:8px;}
      .exec-finalizados summary{cursor:pointer;font-family:var(--fm);font-size:.7rem;color:var(--success);font-weight:800;letter-spacing:.8px;}
      #docsFiscaisPanel,#consultaServicosTerceirizadosFin{width:100%;max-width:100%;min-width:0;}
      #docsFiscaisPanel .j-card-body,#consultaServicosTerceirizadosFin .j-card-body{min-width:0;max-width:100%;}
      #consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270{display:grid;grid-template-columns:minmax(260px,1fr) minmax(135px,150px) minmax(135px,150px) minmax(145px,160px);gap:8px;align-items:end;margin-bottom:8px;min-width:0;}
      #consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270>*{min-width:0;}
      #consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270 input,#consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270 select{width:100%;min-width:0;max-width:100%;}
      @media(max-width:1050px){#consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270{grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media(max-width:900px){.op-table{min-width:640px}.nf-batch-tools .form-row{grid-template-columns:1fr!important}.execucao-aprovado-row{grid-template-columns:1fr!important}}
      @media(max-width:620px){#consultaServicosTerceirizadosFin .fin-terceiro-filtros-v270{grid-template-columns:1fr;}#consultaServicosTerceirizadosFin .op-table{min-width:760px;}}
    `;
    D.head.appendChild(st);
  }

  function osOptionsHTML(selected, filtro) {
    const termo = norm(filtro || '');
    const placaBusca = placaNorm(filtro || '');
    return `<option value="">Selecione placa / O.S. / cliente em atendimento...</option>` + (J().os || [])
      .filter(o => osEmAtendimento(o) || String(o.id || '') === String(selected || ''))
      .filter(o => {
        if (!termo && !placaBusca) return true;
        const v = veiculoByOS(o);
        const placa = placaNorm(o.placa || v.placa || '');
        if (placaBusca && placa && (placa.includes(placaBusca) || placaBusca.includes(placa))) return true;
        return norm(osLabel(o)).includes(termo);
      })
      .sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .map(o => `<option value="${esc(o.id)}" ${String(selected||'')===String(o.id)?'selected':''}>${esc(osLabel(o))}</option>`)
      .join('');
  }

  function addNFRowCheckbox(row) {
    if (!row) return;
    row.querySelectorAll('.nf-batch-check').forEach(el => el.remove());
    row.querySelectorAll('.nf-item-check').forEach(el => el.remove());
  }

  function ensureNFBatchTools() {
    const cont = byId('containerItensNF');
    if (!cont) return;
    byId('nfBatchVinculoTools')?.remove();
    cont.querySelectorAll('.nf-real-row').forEach(addNFRowCheckbox);
  }
  W.nfBatchFiltrarOS = function () {
    const sel = byId('nfBatchOSSelect');
    if (!sel) return;
    const old = sel.value;
    sel.innerHTML = osOptionsHTML(old, byId('nfBatchOSBusca')?.value || '');
    if (old && Array.from(sel.options).some(opt => opt.value === old)) sel.value = old;
  };

  W.nfBatchMarcarTodos = function (on) {
    D.querySelectorAll('#containerItensNF .nf-item-check').forEach(ch => { ch.checked = !!on; });
  };
  W.nfBatchAplicar = function (modo) {
    const osId = byId('nfBatchOSSelect')?.value || '';
    if (!osId) { toast('Selecione uma O.S./veiculo para vincular.', 'warn'); return; }
    const os = (J().os || []).find(o => String(o.id) === String(osId));
    const rows = Array.from(D.querySelectorAll('#containerItensNF .nf-real-row'))
      .filter(row => modo === 'todos' || row.querySelector('.nf-item-check')?.checked);
    if (!rows.length) { toast('Nenhuma peca marcada para vincular.', 'warn'); return; }
    rows.forEach(row => {
      const finalidade = row.querySelector('.nf-finalidade');
      if (finalidade) { finalidade.value = 'os'; W._nfeProToggleDestino?.(finalidade); }
      const osSel = row.querySelector('.nf-os-select');
      if (osSel) osSel.value = osId;
      const v = veiculoByOS(os);
      const vinc = row.querySelector('.nf-vinculo');
      if (vinc) vinc.value = [os?.prefixo || v.prefixo, os?.placa || v.placa, 'OS ' + String(osId).slice(-6).toUpperCase()].filter(Boolean).join(' / ');
      const chk = row.querySelector('.nf-item-check');
      if (chk) chk.checked = false;
    });
    toast(`${rows.length} peca(s) vinculada(s). Finalize a entrada para gravar NF, baixa e auditoria.`, 'ok');
  };
  W.nfBatchEstoqueSelecionados = function () {
    const rows = Array.from(D.querySelectorAll('#containerItensNF .nf-real-row')).filter(row => row.querySelector('.nf-item-check')?.checked);
    rows.forEach(row => {
      const finalidade = row.querySelector('.nf-finalidade');
      if (finalidade) { finalidade.value = 'estoque'; W._nfeProToggleDestino?.(finalidade); }
      const osSel = row.querySelector('.nf-os-select');
      if (osSel) osSel.value = '';
      const vinc = row.querySelector('.nf-vinculo');
      if (vinc) vinc.value = '';
      row.querySelector('.nf-item-check').checked = false;
    });
    toast(`${rows.length} peca(s) marcada(s) para saldo de estoque.`, 'ok');
  };

  function wrapNFOpeners() {
    ['prepNF','lerXMLNFe','adicionarItemNF'].forEach(name => {
      const old = W[name];
      if (typeof old !== 'function' || old._hardeningWrapped) return;
      const wrapped = function () {
        const r = old.apply(this, arguments);
        setTimeout(ensureNFBatchTools, 80);
        setTimeout(ensureNFBatchTools, 320);
        return r;
      };
      wrapped._hardeningWrapped = true;
      W[name] = wrapped;
    });
    const cont = byId('containerItensNF');
    if (cont && !cont._nfBatchObserver) {
      cont._nfBatchObserver = new MutationObserver(() => ensureNFBatchTools());
      cont._nfBatchObserver.observe(cont, { childList:true, subtree:false });
    }
  }

  function statusOptions(tipo, atual) {
    const isPeca = String(tipo || '').toLowerCase().includes('peca');
    const opts = isPeca
      ? [['pendente','Pendente'],['em_execucao','Separando/comprando'],['trocada','Trocada/aplicada'],['nao_encontrada','Peca nao encontrada'],['nao_trocada','Nao aplicada'],['cancelado','Cancelado']]
      : [['pendente','Pendente'],['em_execucao','Em execucao'],['executado','Executado'],['executado_obs','Executado com observacao'],['nao_executado','Nao executado'],['cancelado','Cancelado']];
    return opts.map(([v,l]) => `<option value="${v}" ${String(atual||'pendente')===v?'selected':''}>${l}</option>`).join('');
  }
  function statusFinalizado(st) {
    return /^(executado|executado_obs|executado_com_observacao|trocada|nao_executado|nao_trocada|nao_encontrada|cancelado)$/i.test(String(st || ''));
  }
  function itemHTML(it, e) {
    const st = e?.status || 'pendente';
    const finalizado = statusFinalizado(st);
    return `<div class="execucao-aprovado-row" data-key="${esc(it.key)}" data-tipo="${esc(it.tipo)}" style="display:grid;grid-template-columns:minmax(230px,1fr) 190px minmax(200px,1fr);gap:7px;align-items:center;background:${finalizado?'rgba(0,255,170,.045)':'rgba(0,0,0,.16)'};border:1px solid rgba(255,255,255,.10);border-radius:3px;padding:8px;">
      <div style="font-size:.75rem;color:var(--text);"><b>${esc(it.labelTipo || it.tipo)}</b> ${it.codigo ? '[' + esc(it.codigo) + '] ' : ''}${esc(it.desc || '-')}${it.tempo ? `<br><small style="color:var(--muted);">TMO ${String(it.tempo).replace('.', ',')}h</small>` : ''}</div>
      <select class="j-select exec-status" style="font-size:.72rem;" onchange="window.reorganizarExecucaoAprovadosOS()">${statusOptions(it.tipo, st)}</select>
      <input class="j-input exec-obs" value="${esc(e?.obs || '')}" placeholder="Observacao interna obrigatoria quando houver excecao">
    </div>`;
  }

  W.reorganizarExecucaoAprovadosOS = function () {
    const pend = byId('execPendentesOS');
    const fin = byId('execFinalizadosListaOS');
    if (!pend || !fin) return;
    Array.from(D.querySelectorAll('#resumoAprovacaoOS .execucao-aprovado-row')).forEach(row => {
      const st = row.querySelector('.exec-status')?.value || 'pendente';
      (statusFinalizado(st) ? fin : pend).appendChild(row);
    });
    const count = fin.querySelectorAll('.execucao-aprovado-row').length;
    const lbl = byId('execFinalizadosCountOS');
    if (lbl) lbl.textContent = String(count);
  };

  function overrideAprovacaoOS() {
    if (typeof W.aplicarMarcadoresAprovacaoOS !== 'function' || W.aplicarMarcadoresAprovacaoOS._hardeningExec) return;
    W.aplicarMarcadoresAprovacaoOS = function (os) {
      const U = osUtils();
      byId('resumoAprovacaoOS')?.remove();
      D.querySelectorAll('#containerServicosOS .aprovacao-item-badge,#containerPecasOS .aprovacao-item-badge').forEach(el => el.remove());
      const temAprovacao = U.hasApproval?.(os);
      W.atualizarCotacaoPecasOrcamentoAtualOS?.(os);
      if (!temAprovacao) return;
      const keys = U.getApprovedKeys?.(os) || new Set();
      const itens = U.buildBudgetItems?.(os, (J().clientes || []).find(c => c.id === os?.clienteId)) || [];
      const aprovados = itens.filter(it => keys.has(it.key));
      const nao = itens.filter(it => !keys.has(it.key));
      const exec = os?.execucaoItens || {};
      const pendentes = aprovados.filter(it => !statusFinalizado(exec[it.key]?.status));
      const finalizados = aprovados.filter(it => statusFinalizado(exec[it.key]?.status));
      const totalAprovado = os?.totalAprovado != null ? num(os.totalAprovado) : aprovados.reduce((s,it)=>s+num(it.valorFinal),0);
      const resumo = D.createElement('div');
      resumo.id = 'resumoAprovacaoOS';
      resumo.className = 'aprovacao-resumo';
      resumo.innerHTML = `
        <h4>ORCAMENTO APROVADO - ${aprovados.length}/${itens.length} ITEM(NS) - ${moeda(totalAprovado)}</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px;">
          <span class="op-chip ok">${aprovados.length} aprovados</span>
          <span class="op-chip warn">${nao.length} nao aprovados</span>
          <span class="op-chip">${pendentes.length} pendentes/em execucao</span>
          <span class="op-chip ok">${finalizados.length} finalizados</span>
        </div>
        <div class="aprovacao-resumo-grid">
          ${aprovados.map(it => `<div class="aprovacao-resumo-item"><strong style="color:var(--success);">APROVADO</strong><br>${esc(it.labelTipo || it.tipo)} ${it.codigo ? '[' + esc(it.codigo) + '] ' : ''}${esc(it.desc || '-')}<br><b>${moeda(it.valorFinal)}</b></div>`).join('')}
          ${nao.map(it => `<div class="aprovacao-resumo-item nao"><strong style="color:var(--warn);">NAO APROVADO</strong><br>${esc(it.labelTipo || it.tipo)} ${it.codigo ? '[' + esc(it.codigo) + '] ' : ''}${esc(it.desc || '-')}<br><small>Mantido apenas como historico do orcamento.</small></div>`).join('')}
        </div>
        <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px;">
          <div class="op-title">EXECUCAO INTERNA DOS ITENS APROVADOS</div>
          <div style="font-family:var(--fm);font-size:.60rem;color:var(--muted);margin-bottom:8px;">Ao marcar como executado/trocado/cancelado, o item sai da fila principal e vai para Finalizados. Cliente nao ve observacao interna.</div>
          <div id="execPendentesOS" style="display:grid;gap:7px;">${pendentes.map(it => itemHTML(it, exec[it.key] || {})).join('')}</div>
          <div class="exec-finalizados" style="margin-top:10px;">
            <details id="execFinalizadosOS"><summary>FINALIZADOS / OCULTOS (<span id="execFinalizadosCountOS">${finalizados.length}</span>)</summary><div id="execFinalizadosListaOS" style="display:grid;gap:7px;margin-top:8px;">${finalizados.map(it => itemHTML(it, exec[it.key] || {})).join('')}</div></details>
          </div>
          <button type="button" class="btn-primary" style="margin-top:10px;" onclick="window.salvarExecucaoAprovadosOS('${esc(os?.id || '')}')">SALVAR EXECUCAO INTERNA</button>
        </div>`;
      const alvo = byId('containerServicosOS')?.closest('div');
      if (alvo) alvo.insertAdjacentElement('beforebegin', resumo);
    };
    W.aplicarMarcadoresAprovacaoOS._hardeningExec = true;
  }

  function gruposHistorico(os) {
    const U = osUtils();
    const cli = (J().clientes || []).find(c => c.id === os?.clienteId);
    const itens = U.buildBudgetItems?.(os, cli) || [];
    const hasApproval = U.hasApproval?.(os);
    const keys = U.getApprovedKeys?.(os) || new Set();
    const groups = {
      servAprov: [], pecAprov: [], servNao: [], pecNao: [], reais: []
    };
    itens.forEach(it => {
      const aprovado = !hasApproval ? false : keys.has(it.key);
      const isServico = String(it.tipo || '').toLowerCase().includes('serv');
      const target = aprovado
        ? (isServico ? groups.servAprov : groups.pecAprov)
        : (isServico ? groups.servNao : groups.pecNao);
      target.push(it);
    });
    if (secret177()) groups.reais = Array.isArray(os?.pecasReais) ? os.pecasReais : [];
    return groups;
  }
  function groupText(groups) {
    return Object.values(groups).flat().map(x => [x.desc,x.descricao,x.codigo,x.codigoFornecedor,x.codigoComercial,x.oem,x.marca,x.nf,x.nfNumero,x.fornecedor].join(' ')).join(' ');
  }
  function itemTextHistorico(item) {
    return [item?.desc,item?.descricao,item?.codigo,item?.codigoFornecedor,item?.codigoComercial,item?.oem,item?.ean,item?.marca,item?.nf,item?.nfNumero,item?.fornecedor].join(' ');
  }
  function itemCombinaTermoHistorico(item, termoRaw) {
    const raw = String(termoRaw || '').trim();
    if (!raw) return true;
    if (termoPareceCodigoPeca(raw)) return itemTemCodigoPeca(item, codigoPecaNormalizado(raw));
    return norm(itemTextHistorico(item)).includes(norm(raw));
  }
  function filtrarGruposHistorico(groups, termoRaw) {
    const raw = String(termoRaw || '').trim();
    if (!raw) return groups;
    const out = {};
    Object.keys(groups).forEach(k => {
      out[k] = (groups[k] || []).filter(item => itemCombinaTermoHistorico(item, raw));
    });
    return out;
  }
  function renderGroup(title, arr, cls) {
    if (!arr.length) return '';
    return `<div style="margin-top:8px;"><strong class="op-chip ${cls||''}">${esc(title)}</strong><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px;margin-top:6px;">${arr.map(it => `<div style="border:1px solid var(--border);background:rgba(255,255,255,.03);border-radius:3px;padding:7px;font-size:.72rem;"><b>${it.codigo ? '[' + esc(it.codigo) + '] ' : ''}${esc(it.desc || it.descricao || '-')}</b>${it.qtd ? `<br><small>Qtd ${esc(it.qtd)}</small>`:''}${it.nf || it.nfNumero ? `<br><small>NF ${esc(it.nf || it.nfNumero)} - ${esc(it.fornecedor || '')}</small>`:''}</div>`).join('')}</div></div>`;
  }
  function qtdCustoReal(item) {
    const q = num(item?.qtd || item?.quantidade || item?.qtde || 1);
    return q > 0 ? q : 1;
  }
  function totalCustoReal(item) {
    const total = num(item?.totalCompra || item?.valorLiquido || item?.totalCusto || item?.custoTotal || item?.valorTotal || item?.total);
    if (total > 0) return total;
    const unit = num(item?.valorCompra || item?.custo || item?.valorUnitario || item?.custoUnit || item?.valorCusto || item?.precoCusto || item?.unitario);
    return unit * qtdCustoReal(item);
  }
  function codigoCustoReal(item) {
    return item?.codigoComercial || item?.codigoFornecedor || item?.codigo || item?.oem || item?.ean || '';
  }
  function nfKeyCustoReal(item) {
    return item?.nfId || item?.idNF || item?.notaFiscalId || item?.chaveNFe || item?.chave || item?.nfNumero || item?.nf || item?.notaFiscal || '';
  }
  function chaveCustoReal(item, osId, placa) {
    const desc = norm(item?.desc || item?.descricao || item?.descricaoOriginal || '');
    const origem = item?.origemNFItemKey || item?.nfItemKey || item?.itemNFKey || item?.vinculoKey || '';
    const nf = nfKeyCustoReal(item);
    const codigo = codigoPecaNormalizado(codigoCustoReal(item) || item?.codigoFornecedor || '');
    const destino = item?.destinoKey || item?.destinoIndice || item?.destinoIndex || '';
    if (nf && (codigo || desc)) return [
      nf,
      codigo,
      desc,
      osId || '',
      placa || ''
    ].join('|');
    if (origem) return [
      origem,
      osId || item?.osId || '',
      placa || item?.placa || '',
      destino || ''
    ].join('|');
    return [
      nf,
      codigo,
      desc,
      osId || '',
      placa || ''
    ].join('|');
  }
  function prioridadeOrigemCustoReal(origem) {
    const o = norm(origem || '');
    if (o.includes('nf vinculada')) return 30;
    if (o.includes('o s') || o.includes('pecas reais')) return 20;
    if (o.includes('item de nf')) return 10;
    return 0;
  }
  function qualidadeCustoReal(row) {
    return prioridadeOrigemCustoReal(row?.origem) * 100000
      + (row?.nfNumero ? 1000 : 0)
      + (row?.fornecedor ? 500 : 0)
      + (row?.osId ? 100 : 0)
      + (num(row?.total) > 0 ? 10 : 0)
      + (num(row?.qtd) > 0 ? 1 : 0);
  }
  function registrarCustoReal(rowsByKey, row) {
    const key = row?._key || '';
    if (!key) return;
    const atual = rowsByKey.get(key);
    if (!atual || qualidadeCustoReal(row) > qualidadeCustoReal(atual)) rowsByKey.set(key, row);
  }
  function nfNormCustoReal(v) {
    return String(v || '').toUpperCase().replace(/^NF\s+/i, '').replace(/[^A-Z0-9]/g, '');
  }
  function textoCompatCustoReal(row) {
    return norm([row?.codigo, row?.desc].filter(Boolean).join(' '));
  }
  function tokensCustoReal(row) {
    const stop = new Set(['de','da','do','das','dos','com','para','por','peca','pecas','kit','un','unit']);
    return textoCompatCustoReal(row).split(/\s+/).filter(t => t.length >= 3 && !stop.has(t));
  }
  function overlapCustoReal(a, b) {
    const ta = new Set(tokensCustoReal(a));
    const tb = new Set(tokensCustoReal(b));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    ta.forEach(t => { if (tb.has(t)) inter += 1; });
    return inter / Math.min(ta.size, tb.size);
  }
  function mesmoDestinoCustoReal(a, b) {
    const osA = String(a?.osId || '');
    const osB = String(b?.osId || '');
    const placaA = placaNorm(a?.placa || '');
    const placaB = placaNorm(b?.placa || '');
    return (osA && osB && osA === osB) || (placaA && placaB && (placaA === placaB || placaA.includes(placaB) || placaB.includes(placaA)));
  }
  function mesmoNFCustoReal(a, b) {
    const nfA = nfNormCustoReal(a?.nfNumero || '');
    const nfB = nfNormCustoReal(b?.nfNumero || '');
    return nfA && nfB && nfA === nfB;
  }
  function codigoCompatCustoReal(a, b) {
    const ca = codigoPecaNormalizado(a?.codigo || '');
    const cb = codigoPecaNormalizado(b?.codigo || '');
    const ta = codigoPecaNormalizado(textoCompatCustoReal(a));
    const tb = codigoPecaNormalizado(textoCompatCustoReal(b));
    if (ca && cb && ca === cb) return true;
    if (ca && tb && tb.includes(ca)) return true;
    if (cb && ta && ta.includes(cb)) return true;
    return false;
  }
  function valorCompatCustoReal(a, b) {
    const totalA = Math.round(num(a?.total) * 100);
    const totalB = Math.round(num(b?.total) * 100);
    const unitA = Math.round(num(a?.custoUnit) * 100);
    const unitB = Math.round(num(b?.custoUnit) * 100);
    return (totalA > 0 && totalA === totalB) || (unitA > 0 && unitA === unitB);
  }
  function rowsCustoRealEquivalentes(a, b) {
    if (!mesmoNFCustoReal(a, b) || !mesmoDestinoCustoReal(a, b)) return false;
    if (codigoCompatCustoReal(a, b)) return true;
    const overlap = overlapCustoReal(a, b);
    return overlap >= 0.55 && valorCompatCustoReal(a, b);
  }
  function consolidarCustosReais(rows) {
    const out = [];
    (rows || []).forEach(row => {
      const idx = out.findIndex(atual => rowsCustoRealEquivalentes(atual, row));
      if (idx < 0) { out.push(row); return; }
      if (qualidadeCustoReal(row) > qualidadeCustoReal(out[idx])) out[idx] = row;
    });
    return out;
  }
  function renderResumoCustosReaisVeiculo(placaFiltro, hits, termoRaw) {
    if (!secret177() || !placaFiltro) return '';
    const osList = Array.isArray(hits) ? hits : [];
    const osIds = new Set(osList.map(o => String(o.id || '')).filter(Boolean));
    const osComPecasReais = new Set(osList
      .filter(o => Array.isArray(o.pecasReais) && o.pecasReais.length)
      .map(o => String(o.id || ''))
      .filter(Boolean));
    const osById = id => (J().os || []).find(o => String(o.id || '') === String(id || '')) || {};
    const rows = [];
    const chavesEspelhadasNaOS = new Set();
    const chavesComplementares = new Set();
    const placaOk = value => {
      const p = placaNorm(value || '');
      return p && (p === placaFiltro || p.includes(placaFiltro) || placaFiltro.includes(p));
    };
    const add = (origem, item, osBase, extra, opts) => {
      const os = osBase || {};
      const v = veiculoByOS(os);
      const placa = placaNorm(item?.placa || os.placa || v.placa || '');
      const osId = item?.osId || os.id || '';
      if (!osIds.has(String(osId || '')) && !placaOk(placa)) return;
      if (opts?.skipIfOSHasReais && osId && osComPecasReais.has(String(osId))) return;
      const key = chaveCustoReal(item, osId, placa);
      if (opts?.skipIfInOS && key && chavesEspelhadasNaOS.has(key)) return;
      if (opts?.complementar && key && chavesComplementares.has(key)) return;
      const qtd = qtdCustoReal(item);
      const origemOSReal = norm(origem || '').includes('pecas reais');
      const unitOSReal = num(item?.valorCompra || item?.custo || item?.valorUnitario || item?.custoUnit || item?.valorCusto || item?.precoCusto || item?.unitario);
      const total = origemOSReal && unitOSReal > 0 ? unitOSReal * qtd : totalCustoReal(item);
      rows.push(Object.assign({
        _key: key,
        origem,
        codigo: codigoCustoReal(item),
        desc: item?.desc || item?.descricao || item?.descricaoOriginal || '-',
        qtd,
        total,
        custoUnit: total / qtd,
        placa: placa || os.placa || v.placa || '',
        osId,
        estoqueId: item?.estoqueId || item?.estoqueItemId || '',
        nfId: item?.nfId || item?.ultimaNFId || '',
        nfNumero: item?.nfNumero || item?.nf || item?.notaFiscal || item?.ultimaNF || '',
        fornecedor: item?.fornecedorNome || item?.fornecedor || item?.ultimaFornecedor || '',
        data: item?.dataCompra || item?.dataNF || item?.dataMov || item?.createdAt || ''
      }, extra || {}));
      if (opts?.markOS && key) chavesEspelhadasNaOS.add(key);
      if (opts?.complementar && key) chavesComplementares.add(key);
    };
    osList.forEach(os => (Array.isArray(os.pecasReais) ? os.pecasReais : []).forEach(p => add('O.S. / pecas reais', p, os, null, { markOS: true })));
    (J().nfItensVinculos || []).forEach(v => add('NF vinculada a O.S.', v, osById(v.osId), null, { skipIfOSHasReais: true, skipIfInOS: true, complementar: true }));
    (J().notasFiscaisEntrada || []).forEach(n => {
      (Array.isArray(n.itens) ? n.itens : []).forEach(i => add('Item de NF', Object.assign({}, i, {
        nfId: n.id || i.nfId,
        nfNumero: n.numero || i.nfNumero,
        fornecedor: n.fornecedorSnapshot?.nome || n.fornecedorNome || i.fornecedor,
        dataCompra: n.dataNF || n.dataEmissao || n.createdAt || i.dataCompra
      }), osById(i.osId), null, { skipIfOSHasReais: true, skipIfInOS: true, complementar: true }));
    });
    const rowsLimpas = rows.map(r => {
      const copy = Object.assign({}, r);
      delete copy._key;
      return copy;
    });
    rowsLimpas.sort((a,b) => String(b.data || '').localeCompare(String(a.data || '')));
    const filtradas = String(termoRaw || '').trim()
      ? rowsLimpas.filter(r => itemCombinaTermoHistorico(r, termoRaw))
      : rowsLimpas.slice();
    if (!filtradas.length) {
      return `<div class="op-card" style="border-color:rgba(255,59,59,.35);background:rgba(255,59,59,.045);">
        <div class="op-title">RESUMO DE CUSTOS REAIS *177</div>
        <div style="font-family:var(--fm);font-size:.72rem;color:var(--muted);">Nenhum custo real de peca/NF carregado para a placa ${esc(placaFiltro)}. O historico de O.S. abaixo continua disponivel.</div>
      </div>`;
    }
    const total = filtradas.reduce((s,r) => s + num(r.total), 0);
    const qtd = filtradas.reduce((s,r) => s + num(r.qtd), 0);
    const nfs = Array.from(new Set(filtradas.map(r => r.nfNumero).filter(Boolean)));
    const fornecedores = Array.from(new Set(filtradas.map(r => r.fornecedor).filter(Boolean))).slice(0, 6);
    W._relatorioCustosReais177 = {
      placa: placaFiltro,
      termo: String(termoRaw || '').trim(),
      rows: filtradas.map(r => Object.assign({}, r)),
      total,
      qtd,
      nfs: nfs.slice(),
      fornecedores: fornecedores.slice(),
      geradoEm: new Date().toISOString()
    };
    return `<div class="op-card" style="border-color:rgba(255,59,59,.35);background:rgba(255,59,59,.045);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <div class="op-title" style="margin-bottom:0;">RESUMO DE CUSTOS REAIS *177 - ${esc(placaFiltro)}</div>
        <button type="button" class="btn-outline" onclick="window.imprimirRelatorioCustosReais177 && window.imprimirRelatorioCustosReais177()" style="border-color:rgba(255,59,59,.38);color:var(--danger);">IMPRIMIR RELATÓRIO DE PEÇAS REAIS</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:10px;">
        <div><small style="color:var(--muted);font-family:var(--fm);">Itens reais</small><br><b>${esc(filtradas.length)}</b></div>
        <div><small style="color:var(--muted);font-family:var(--fm);">Quantidade</small><br><b>${esc(qtd)}</b></div>
        <div><small style="color:var(--muted);font-family:var(--fm);">Custo real conhecido</small><br><b style="color:var(--danger);">${moeda(total)}</b></div>
        <div><small style="color:var(--muted);font-family:var(--fm);">NFs ligadas</small><br><b>${esc(nfs.length)}</b></div>
      </div>
      <div style="font-family:var(--fm);font-size:.64rem;color:var(--muted);margin-bottom:8px;">Fornecedores: ${esc(fornecedores.join(', ') || 'nao informado')}. Valores restritos a peca real/NF carregada nesta sessao.</div>
      <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Origem</th><th>Codigo / peca</th><th>O.S.</th><th>NF / fornecedor</th><th>Qtd</th><th>Custo real</th><th>Data</th></tr></thead><tbody>
      ${filtradas.slice(0, 80).map(r => `<tr>
        <td>${esc(r.origem || '-')}</td>
        <td><b>${esc(r.codigo || '-')}</b><br>${esc(r.desc || '-')}</td>
        <td>${r.osId ? `<button class="btn-ghost" onclick="window.editarOS && window.editarOS('${esc(r.osId)}')">OS #${esc(String(r.osId).slice(-6).toUpperCase())}</button>` : '-'}<br><small>${esc(r.placa || '')}</small></td>
        <td>NF ${esc(r.nfNumero || '-')}<br><small>${esc(r.fornecedor || '-')}</small></td>
        <td>${esc(r.qtd || 1)}</td>
        <td><b>${moeda(r.total)}</b><br><small>${moeda(r.custoUnit || 0)} un.</small></td>
        <td>${esc(String(r.data || '-').slice(0,10))}</td>
      </tr>`).join('')}</tbody></table></div>
    </div>`;
  }
  function dataHoraRelatorio177(value) {
    if (!value) return 'Não registrada';
    let dt = null;
    try {
      if (value && typeof value.toDate === 'function') dt = value.toDate();
      else if (value && Number.isFinite(Number(value.seconds))) dt = new Date(Number(value.seconds) * 1000);
      else {
        const txt = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
          const [ano, mes, dia] = txt.split('-');
          return `${dia}/${mes}/${ano} — hora não registrada`;
        }
        dt = new Date(value);
      }
    } catch (_) { dt = null; }
    if (!dt || Number.isNaN(dt.getTime())) return String(value || 'Não registrada');
    try {
      return dt.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (_) { return dt.toLocaleString('pt-BR'); }
  }

  function dataCurtaRelatorio177(value) {
    if (!value) return '-';
    const raw = String(value).slice(0, 10);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
  }

  W.imprimirRelatorioCustosReais177 = async function() {
    if (!secret177()) { toast('Área restrita. Libere primeiro com o código *177.', 'warn'); return; }
    const win = W.open('', '_blank');
    if (!win) { toast('O navegador bloqueou a janela do relatório. Libere pop-ups e tente novamente.', 'warn'); return; }
    try {
      win.document.open();
      win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparando relatório</title></head><body style="font-family:Arial,sans-serif;padding:20px">Preparando relatório e rastreando o Kardex...</body></html>');
      win.document.close();
    } catch (_) {}
    try {
      if (typeof W.thiaLoadFiscalV2612 === 'function') await W.thiaLoadFiscalV2612(false);
      else if (typeof W.thiaEnsureKeyV2612 === 'function') await W.thiaEnsureKeyV2612('fiscal', { force:false });
    } catch (erro) {
      console.warn('[RELATÓRIO CONSOLIDADO *177] Cache fiscal não atualizado; usando dados já carregados.', erro);
    }
    const rel = W._relatorioCustosReais177 || {};
    const rows = Array.isArray(rel.rows) ? rel.rows : [];
    if (!rows.length) { try { win.close?.(); } catch (_) {} toast('Faça primeiro a pesquisa por placa para gerar o relatório de peças reais.', 'warn'); return; }

    const oficina = J().oficina || {};
    const nomeOficina = J().tnome || oficina.nomeFantasia || oficina.razaoSocial || oficina.nome || 'OFICIN-IA';
    const enderecoOficina = [oficina.endereco || oficina.rua || oficina.logradouro, oficina.numero, oficina.bairro, oficina.cidade, oficina.uf].filter(Boolean).join(', ');
    const osById = id => (J().os || []).find(o => String(o.id || '') === String(id || '')) || {};
    const linhas = rows.map((r, index) => {
      const os = osById(r.osId);
      const v = veiculoByOS(os);
      const c = (J().clientes || []).find(x => String(x.id || '') === String(os.clienteId || v.clienteId || '')) || {};
      const placa = placaNorm(r.placa || os.placa || v.placa || rel.placa || '');
      const prefixo = os.prefixo || v.prefixo || '';
      const modelo = [v.marca, v.modelo || os.veiculoSnapshot?.modelo || os.modelo].filter(Boolean).join(' ') || '-';
      const osNumero = r.osId ? `#${String(r.osId).slice(-6).toUpperCase()}` : '-';
      const qtdItem = num(r.qtd || 1) || 1;
      const rastreio = typeof W.rastrearOrigemEstoquePeca177 === 'function'
        ? W.rastrearOrigemEstoquePeca177(r, os)
        : null;
      const veioDoEstoque = !!(r.estoqueId || rastreio?.veioDoEstoque);
      const nfNumero = String(r.nfNumero || rastreio?.nfNumero || '').trim();
      const fornecedor = String(r.fornecedor || rastreio?.fornecedor || '').trim();
      const dataCompra = r.data || rastreio?.dataEntrada || '';
      const origemRastreada = veioDoEstoque
        ? `${r.origem || 'O.S. / peças reais'} · ${rastreio?.origemTexto || 'ESTOQUE • NF de entrada não localizada no Kardex'}`
        : (r.origem || '-');
      const nfExibicao = nfNumero
        ? `NF ${nfNumero}${rastreio && !rastreio.rastreioExato ? ' · referência Kardex' : ''}`
        : (veioDoEstoque ? 'ESTOQUE · NF não localizada' : 'NF não informada');
      const fornecedorExibicao = fornecedor || (veioDoEstoque ? 'Fornecedor não localizado no Kardex' : 'Não informado');
      return `<tr>
        <td data-label="#">${index + 1}</td>
        <td data-label="Origem / rastreio">${esc(origemRastreada)}</td>
        <td data-label="Código / peça real"><b>${esc(r.codigo || '-')}</b><br>${esc(r.desc || '-')}</td>
        <td data-label="Onde foi instalada / O.S."><b>${esc([prefixo, placa].filter(Boolean).join(' / ') || '-')}</b><br>${esc(modelo)}<br>O.S. ${esc(osNumero)} · ${esc(os.status || '-')} · KM ${esc(os.km || v.km || '-')}</td>
        <td data-label="Cliente e local da troca">${esc(c.nome || c.razaoSocial || os.clienteNome || '-')}<br><small>${esc([nomeOficina, enderecoOficina].filter(Boolean).join(' — '))}</small></td>
        <td data-label="Onde comprou / NF">${esc(nfExibicao)}<br><b>${esc(fornecedorExibicao)}</b></td>
        <td data-label="Quantidade" class="num">${esc(qtdItem)}</td>
        <td data-label="Custo unitário / total" class="num">${moeda(r.custoUnit || 0)}<br><b>${moeda(r.total || 0)}</b></td>
        <td data-label="Data compra / entrada">${esc(dataCurtaRelatorio177(dataCompra))}</td>
        <td data-label="Abertura da O.S.">${esc(dataHoraRelatorio177(os.createdAt || os.abertaEm || os.dataAbertura || os.data))}</td>
      </tr>`;
    }).join('');
    const total = rows.reduce((s, r) => s + num(r.total), 0);
    const qtd = rows.reduce((s, r) => s + num(r.qtd || 0), 0);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>Relatório Peças Reais ${esc(rel.placa || '')}</title><style>
      @page{size:A4 landscape;margin:7mm}
      *{box-sizing:border-box}
      html,body{width:100%;max-width:100%;margin:0;padding:0;overflow-x:hidden}
      body{font-family:Arial,sans-serif;color:#111;background:#fff;font-size:9px}
      .page{width:100%;max-width:100%;padding:9px;overflow:hidden}
      .no-print{display:flex;justify-content:flex-end;margin-bottom:7px}
      .no-print button{max-width:100%;padding:8px 14px;font-weight:700;white-space:normal}
      header{width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #111;padding-bottom:7px;margin-bottom:8px;min-width:0}
      header>div{min-width:0;overflow-wrap:anywhere}
      .oficina{text-align:right;max-width:48%;overflow-wrap:anywhere}
      h1{font-size:17px;line-height:1.12;margin:0 0 3px;overflow-wrap:anywhere}
      .restrito{font-size:8px;color:#a00;font-weight:700;overflow-wrap:anywhere}
      .meta{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-bottom:8px;width:100%;min-width:0}
      .box{border:1px solid #777;padding:5px;min-height:35px;min-width:0;overflow-wrap:anywhere}
      .box b{display:block;font-size:8px;text-transform:uppercase;margin-bottom:2px}
      .table-wrap{width:100%;max-width:100%;overflow:hidden}
      table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #777;padding:4px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;min-width:0}
      th{background:#e8e8e8;font-size:7px;text-transform:uppercase}
      td.num{text-align:right;white-space:nowrap}
      tfoot td{background:#f0f0f0;font-size:11px}
      .total-geral{text-align:right}.total-geral b:first-child{margin-right:18px}
      .foot{display:flex;justify-content:space-between;gap:10px;margin-top:7px;font-size:8px;color:#555;overflow-wrap:anywhere}
      @media screen and (max-width:860px){
        body{font-size:12px}
        .page{padding:8px}
        .no-print{justify-content:stretch}
        .no-print button{width:100%;font-size:14px;min-height:44px}
        header{display:block;gap:0}
        .oficina{max-width:100%;text-align:left!important;margin-top:8px;font-size:10px}
        h1{font-size:16px}
        .meta{grid-template-columns:1fr}
        .box{min-height:0;font-size:11px}
        .table-wrap{overflow:visible}
        table,tbody,tfoot,tr,td{display:block;width:100%;max-width:100%}
        thead{display:none}
        tbody{display:grid;gap:10px}
        tbody tr{border:1px solid #777;border-radius:4px;overflow:hidden;background:#fff}
        tbody td{border:0;border-bottom:1px solid #ddd;display:grid;grid-template-columns:minmax(108px,38%) minmax(0,1fr);gap:8px;padding:7px;text-align:left!important;white-space:normal!important;font-size:11px}
        tbody td:last-child{border-bottom:0}
        tbody td::before{content:attr(data-label);font-weight:700;text-transform:uppercase;font-size:9px;line-height:1.25;color:#444;overflow-wrap:anywhere}
        tfoot{margin-top:10px}
        tfoot tr{border:1px solid #777}
        tfoot td{border:0}
        .total-geral{display:flex;justify-content:space-between;gap:10px;font-size:12px;text-align:left}.total-geral b:first-child{margin-right:0}
        .foot{display:block;line-height:1.5}
        .foot span{display:block}
      }
      @media print{
        html,body{overflow:visible}
        .page{padding:0;overflow:visible}
        .no-print{display:none}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }
    </style></head><body><main class="page"><div class="no-print"><button onclick="window.print()">IMPRIMIR / SALVAR PDF</button></div><header><div><h1>RELATÓRIO CONSOLIDADO DE PEÇAS REAIS</h1><div class="restrito">ACESSO RESTRITO DO PROPRIETÁRIO — CÓDIGO *177</div></div><div class="oficina"><b>${esc(nomeOficina)}</b><br>${esc(enderecoOficina || 'Local da oficina não informado')}</div></header><section class="meta"><div class="box"><b>Placa pesquisada</b>${esc(rel.placa || '-')}</div><div class="box"><b>Filtro pesquisado</b>${esc(rel.termo || 'Todos os itens reais')}</div><div class="box"><b>Itens reais</b>${esc(rows.length)}</div><div class="box"><b>Quantidade</b>${esc(qtd)}</div><div class="box"><b>Emitido em</b>${esc(dataHoraRelatorio177(new Date()))}</div></section><div class="table-wrap"><table><colgroup><col style="width:3%"><col style="width:9%"><col style="width:14%"><col style="width:18%"><col style="width:14%"><col style="width:11%"><col style="width:4%"><col style="width:9%"><col style="width:8%"><col style="width:10%"></colgroup><thead><tr><th>#</th><th>Origem / rastreio</th><th>Código / peça real</th><th>Onde foi instalada / O.S.</th><th>Cliente e local da troca</th><th>Onde comprou / NF</th><th>Qtd.</th><th>Custo unit. / total</th><th>Data compra / entrada</th><th>Abertura da O.S.</th></tr></thead><tbody>${linhas}</tbody><tfoot><tr><td colspan="10" class="total-geral"><b>CUSTO REAL TOTAL CONSOLIDADO</b><b>${moeda(total)}</b></td></tr></tfoot></table></div><div class="foot"><span>Relatório interno baseado nas peças reais, vínculos fiscais e movimentos do Kardex carregados nesta sessão.</span><span>Powered by thIAguinho Soluções Digitais</span></div></main></body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch (_) {} }, 350);
  };

  function codigoPecaNormalizado(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function termoPareceCodigoPeca(termoRaw) {
    const c = codigoPecaNormalizado(termoRaw);
    return c.length >= 4 && /[0-9]/.test(c) && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(c);
  }
  function itemTemCodigoPeca(item, codigo) {
    const campos = [item?.codigo, item?.codigoFornecedor, item?.codigoComercial, item?.oem, item?.ean, item?.codigoOEM];
    return campos.some(v => {
      const c = codigoPecaNormalizado(v);
      return c && (c === codigo || c.includes(codigo) || codigo.includes(c));
    });
  }
  function dataISO(v) {
    return String(v || '').slice(0, 10);
  }
  function dentroPeriodo(data, ini, fim) {
    const d = dataISO(data);
    if (!d) return true;
    if (ini && d < ini) return false;
    if (fim && d > fim) return false;
    return true;
  }
  function ensureKardexPeriodControls(opts) {
    const termoEl = byId(opts?.termoId || 'histBuscaTermo');
    if (!termoEl || byId('kardexPeriodoWrap')) return;
    const wrap = D.createElement('div');
    wrap.id = 'kardexPeriodoWrap';
    wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;align-items:end;';
    wrap.innerHTML = `
      <div class="form-group" style="min-width:150px;"><label class="j-label">Periodo inicial</label><input type="date" class="j-input" id="kardexDataIni"></div>
      <div class="form-group" style="min-width:150px;"><label class="j-label">Periodo final</label><input type="date" class="j-input" id="kardexDataFim"></div>
      <span style="font-family:var(--fm);font-size:.62rem;color:var(--muted);padding-bottom:10px;">Opcional para rastrear Kardex da peca.</span>`;
    const host = termoEl.closest('.op-card') || termoEl.parentElement;
    host?.appendChild(wrap);
  }
  function renderRastreioPecaCodigo(codigo, termoRaw, placaFiltro) {
    const rows = [];
    const seen = new Set();
    const add = (origem, data) => {
      const placa = placaNorm(data.placa || '');
      if (placaFiltro && !(placa === placaFiltro || placa.includes(placaFiltro))) return;
      const key = [origem, data.osId || '', data.nfId || '', data.nfNumero || '', data.codigo || '', data.placa || ''].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ origem, ...data });
    };
    (J().nfItensVinculos || []).forEach(v => {
      if (!itemTemCodigoPeca(v, codigo)) return;
      if (!vinculoFiscalReal(v)) return;
      const os = (J().os || []).find(o => o.id === v.osId) || {};
      const veic = veiculoByOS(os);
      const cli = (J().clientes || []).find(c => c.id === (os.clienteId || veic.clienteId)) || {};
      add('NF/VINCULO', {
        codigo: v.codigoFornecedor || v.codigo || v.codigoComercial || termoRaw,
        desc: v.desc || v.descricao || '',
        marca: v.marca || '',
        placa: v.placa || os.placa || veic.placa || '',
        prefixo: veic.prefixo || os.prefixo || '',
        veiculo: veic.modelo || os.veiculo || os.modelo || '',
        cliente: cli.nome || os.cliente || '',
        osId: v.osId || '',
        nfId: v.nfId || '',
        nfNumero: v.nfNumero || '',
        fornecedor: v.fornecedorNome || v.fornecedor || '',
        dataCompra: v.dataCompra || v.dataNF || v.createdAt || '',
        qtd: v.qtd || v.quantidade || 1,
        baixa: v.estoqueBaixadoAutomatico,
        custo: v.custo || v.valorUnitario || 0
      });
    });
    (J().os || []).forEach(os => {
      const veic = veiculoByOS(os);
      const cli = (J().clientes || []).find(c => c.id === (os.clienteId || veic.clienteId)) || {};
      (Array.isArray(os.pecasReais) ? os.pecasReais : []).forEach(p => {
        if (!pecaRealFiscalValida(p)) return;
        if (!itemTemCodigoPeca(p, codigo)) return;
        add('OS/PECAS REAIS', {
          codigo: p.codigoFornecedor || p.codigo || p.codigoComercial || p.oem || termoRaw,
          desc: p.desc || p.descricao || '',
          marca: p.marca || '',
          placa: os.placa || veic.placa || p.placa || '',
          prefixo: veic.prefixo || os.prefixo || '',
          veiculo: veic.modelo || os.veiculo || os.modelo || '',
          cliente: cli.nome || os.cliente || '',
          osId: os.id || '',
          nfId: p.nfId || '',
          nfNumero: p.nfNumero || p.nf || p.notaFiscal || '',
          fornecedor: p.fornecedor || p.fornecedorNome || '',
          dataCompra: p.dataCompra || p.dataNF || '',
          qtd: p.qtd || p.quantidade || 1,
          baixa: p.estoqueBaixadoAutomatico,
          custo: p.custo || p.valorUnitario || 0
        });
      });
      const groups = gruposHistorico(os);
      ['pecAprov','pecNao'].forEach(k => (groups[k] || []).forEach(p => {
        if (!itemTemCodigoPeca(p, codigo)) return;
        add('OS/ORCAMENTO', 'ORCAMENTO DA O.S.', {
          codigo: p.codigoFornecedor || p.codigo || p.codigoComercial || p.oem || termoRaw,
          desc: p.desc || p.descricao || '',
          marca: p.marca || '',
          placa: os.placa || veic.placa || p.placa || '',
          prefixo: veic.prefixo || os.prefixo || '',
          veiculo: veic.modelo || os.veiculo || os.modelo || '',
          cliente: cli.nome || os.cliente || '',
          osId: os.id || '',
          nfId: p.nfId || '',
          nfNumero: p.nfNumero || p.nf || p.notaFiscal || '',
          fornecedor: p.fornecedor || p.fornecedorNome || '',
          dataCompra: p.dataCompra || p.dataNF || os.updatedAt || os.createdAt || '',
          qtd: p.qtd || p.quantidade || 1,
          baixa: p.estoqueBaixadoAutomatico,
          custo: p.custo || p.valorUnitario || 0
        });
      }));
    });
    if (!rows.length) {
      return `<div style="color:var(--muted);font-family:var(--fm);font-size:.8rem;padding:10px 0;">Nenhum uso interno encontrado para o codigo ${esc(termoRaw)}.</div>`;
    }
    rows.sort((a,b)=>String(b.dataCompra||'').localeCompare(String(a.dataCompra||'')));
    return `<div style="font-family:var(--fm);font-size:.65rem;color:var(--muted);margin-bottom:8px;">${rows.length} uso(s) encontrado(s) para o codigo <b>${esc(termoRaw)}</b>. Exibindo somente a peça pesquisada.</div>
      <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Codigo / peça</th><th>Usado em</th><th>O.S.</th><th>NF / fornecedor</th><th>Compra</th><th>Qtd / baixa</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td><b>${esc(r.codigo || termoRaw)}</b><br>${esc(r.desc || '-')}<br><small>${esc(r.marca || '')}</small></td>
        <td><b>${esc(r.placa || '-')}</b> ${r.prefixo ? '<span class="op-chip">'+esc(r.prefixo)+'</span>' : ''}<br>${esc(r.veiculo || '-')}<br><small>${esc(r.cliente || '')}</small></td>
        <td>${r.osId ? `<button class="btn-primary" onclick="window.editarOS && window.editarOS('${esc(r.osId)}')">ABRIR O.S. #${esc(String(r.osId).slice(-6).toUpperCase())}</button>` : '-'}</td>
        <td>NF ${esc(r.nfNumero || '-')}<br><small>${esc(r.fornecedor || '-')}</small></td>
        <td>${esc(String(r.dataCompra || '-').slice(0,10))}<br><small>${esc(r.origem || '')}</small></td>
        <td>${esc(r.qtd || 1)}<br><small>${r.baixa ? 'baixado automaticamente' : 'sem baixa automatica registrada'}</small></td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  function renderKardexPecaCodigo(codigo, termoRaw, placaFiltro) {
    const ini = byId('kardexDataIni')?.value || '';
    const fim = byId('kardexDataFim')?.value || '';
    const rows = [];
    const seen = new Map();
    const add = (tipo, origem, data) => {
      const placa = placaNorm(data.placa || '');
      if (placaFiltro && !(placa === placaFiltro || placa.includes(placaFiltro))) return;
      if (!dentroPeriodo(data.dataMov || data.dataCompra || data.createdAt, ini, fim)) return;
      const key = [tipo, data.osId || '', data.nfId || '', data.nfNumero || '', codigoPecaNormalizado(data.codigo || termoRaw), placa, dataISO(data.dataMov || data.dataCompra || data.createdAt), norm(data.desc || '')].join('|');
      if (seen.has(key)) {
        const old = seen.get(key);
        old.origens = Array.from(new Set([...(old.origens || [old.origem]), origem].filter(Boolean)));
        old.qtd = Math.max(num(old.qtd || 0), num(data.qtd || 0)) || old.qtd || data.qtd || 1;
        return;
      }
      const row = { tipo, origem, origens:[origem], ...data };
      seen.set(key, row);
      rows.push(row);
    };
    (J().notasFiscaisEntrada || []).forEach(n => {
      (Array.isArray(n.itens) ? n.itens : []).forEach(i => {
        if (!itemTemCodigoPeca(i, codigo)) return;
        const destinoItem = String(i.destino || i.finalidade || 'estoque').toLowerCase();
        const itemVinculado = destinoItem === 'os' || destinoItem === 'placa';
        add('ENTRADA', 'NF', {
          codigo: i.codigoFornecedor || i.codigo || i.codigoComercial || termoRaw,
          desc: i.descricao || i.desc || '',
          marca: i.marca || '',
          placa: itemVinculado ? (i.placa || '') : '',
          prefixo: '',
          veiculo: itemVinculado ? 'Entrada fiscal vinculada' : 'Estoque / entrada fiscal',
          cliente: '',
          osId: itemVinculado ? (i.osId || '') : '',
          nfId: n.id || '',
          nfNumero: n.numero || i.nfNumero || '',
          fornecedor: n.fornecedorSnapshot?.nome || n.fornecedorNome || i.fornecedor || '',
          dataCompra: n.dataNF || n.dataEmissao || n.createdAt || '',
          dataMov: n.dataNF || n.dataEmissao || n.createdAt || '',
          qtd: i.quantidade || i.qtd || 1,
          baixa: false,
          custo: i.valorUnitario || i.custo || 0
        });
      });
    });
    (J().nfItensVinculos || []).forEach(v => {
      if (!itemTemCodigoPeca(v, codigo)) return;
      if (!vinculoFiscalReal(v)) return;
      const os = (J().os || []).find(o => o.id === v.osId) || {};
      const veic = veiculoByOS(os);
      const cli = (J().clientes || []).find(c => c.id === (os.clienteId || veic.clienteId)) || {};
      add('SAIDA', 'NF/VINCULO OS', {
        codigo: v.codigoFornecedor || v.codigo || v.codigoComercial || termoRaw,
        desc: v.desc || v.descricao || '',
        marca: v.marca || '',
        placa: v.placa || os.placa || veic.placa || '',
        prefixo: veic.prefixo || os.prefixo || '',
        veiculo: veic.modelo || os.veiculo || os.modelo || '',
        cliente: cli.nome || os.cliente || '',
        osId: v.osId || '',
        nfId: v.nfId || '',
        nfNumero: v.nfNumero || '',
        fornecedor: v.fornecedorNome || v.fornecedor || '',
        dataCompra: v.dataCompra || v.dataNF || v.createdAt || '',
        dataMov: v.dataBaixa || v.vinculadoEm || v.dataCompra || v.dataNF || v.createdAt || '',
        qtd: v.qtd || v.quantidade || 1,
        baixa: v.estoqueBaixadoAutomatico,
        custo: v.custo || v.valorUnitario || 0
      });
    });
    (J().os || []).forEach(os => {
      const veic = veiculoByOS(os);
      const cli = (J().clientes || []).find(c => c.id === (os.clienteId || veic.clienteId)) || {};
      (Array.isArray(os.pecasReais) ? os.pecasReais : []).forEach(p => {
        if (!pecaRealFiscalValida(p)) return;
        if (!itemTemCodigoPeca(p, codigo)) return;
        add('SAIDA', 'OS/PECAS REAIS', {
          codigo: p.codigoFornecedor || p.codigo || p.codigoComercial || p.oem || termoRaw,
          desc: p.desc || p.descricao || '',
          marca: p.marca || '',
          placa: os.placa || veic.placa || p.placa || '',
          prefixo: veic.prefixo || os.prefixo || '',
          veiculo: veic.modelo || os.veiculo || os.modelo || '',
          cliente: cli.nome || os.cliente || '',
          osId: os.id || '',
          nfId: p.nfId || '',
          nfNumero: p.nfNumero || p.nf || p.notaFiscal || '',
          fornecedor: p.fornecedor || p.fornecedorNome || '',
          dataCompra: p.dataCompra || p.dataNF || '',
          dataMov: p.dataAplicacao || p.dataCompra || p.dataNF || os.updatedAt || os.createdAt || '',
          qtd: p.qtd || p.quantidade || 1,
          baixa: p.estoqueBaixadoAutomatico,
          custo: p.custo || p.valorUnitario || 0
        });
      });
      const groups = gruposHistorico(os);
      ['pecAprov','pecNao'].forEach(k => (groups[k] || []).forEach(p => {
        if (!itemTemCodigoPeca(p, codigo)) return;
        add('OS/ORCAMENTO', {
          codigo: p.codigoFornecedor || p.codigo || p.codigoComercial || p.oem || termoRaw,
          desc: p.desc || p.descricao || '',
          marca: p.marca || '',
          placa: os.placa || veic.placa || p.placa || '',
          prefixo: veic.prefixo || os.prefixo || '',
          veiculo: veic.modelo || os.veiculo || os.modelo || '',
          cliente: cli.nome || os.cliente || '',
          osId: os.id || '',
          nfId: p.nfId || '',
          nfNumero: p.nfNumero || p.nf || p.notaFiscal || '',
          fornecedor: p.fornecedor || p.fornecedorNome || '',
          dataCompra: p.dataCompra || p.dataNF || os.updatedAt || os.createdAt || '',
          qtd: p.qtd || p.quantidade || 1,
          baixa: p.estoqueBaixadoAutomatico,
          custo: p.custo || p.valorUnitario || 0
        });
      }));
    });
    if (!rows.length) {
      return `<div style="color:var(--muted);font-family:var(--fm);font-size:.8rem;padding:10px 0;">Nenhum movimento encontrado para o codigo ${esc(termoRaw)}.</div>`;
    }
    const saldo = rows.reduce((s, r) => s + (r.tipo === 'ENTRADA' ? num(r.qtd || 0) : -num(r.qtd || 0)), 0);
    rows.sort((a,b)=>String(b.dataMov || b.dataCompra || '').localeCompare(String(a.dataMov || a.dataCompra || '')));
    return `<div style="font-family:var(--fm);font-size:.65rem;color:var(--muted);margin-bottom:8px;">Kardex interno do codigo <b>${esc(termoRaw)}</b>: ${rows.length} movimento(s). Saldo calculado pelos movimentos carregados: <b>${esc(saldo)}</b>. ${ini || fim ? `Periodo: ${esc(ini || 'inicio')} a ${esc(fim || 'hoje')}.` : 'Periodo: todos.'}</div>
      <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Movimento</th><th>Codigo / peca</th><th>Veiculo / destino</th><th>O.S.</th><th>NF / fornecedor</th><th>Data</th><th>Qtd / baixa</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td><span class="op-chip ${r.tipo === 'ENTRADA' ? 'ok' : 'warn'}">${esc(r.tipo || '-')}</span><br><small>${esc((r.origens || [r.origem]).join(' + '))}</small></td>
        <td><b>${esc(r.codigo || termoRaw)}</b><br>${esc(r.desc || '-')}<br><small>${esc(r.marca || '')}</small></td>
        <td><b>${esc(r.placa || '-')}</b> ${r.prefixo ? '<span class="op-chip">'+esc(r.prefixo)+'</span>' : ''}<br>${esc(r.veiculo || '-')}<br><small>${esc(r.cliente || '')}</small></td>
        <td>${r.osId ? `<button class="btn-ghost" onclick="window.editarOS && window.editarOS('${esc(r.osId)}')">OS #${esc(String(r.osId).slice(-6).toUpperCase())}</button>` : '-'}</td>
        <td>NF ${esc(r.nfNumero || '-')}<br><small>${esc(r.fornecedor || '-')}</small></td>
        <td>${esc(String(r.dataMov || r.dataCompra || '-').slice(0,10))}<br><small>compra ${esc(String(r.dataCompra || '-').slice(0,10))}</small></td>
        <td>${esc(r.qtd || 1)}<br><small>${r.baixa ? 'baixado automaticamente' : 'sem baixa automatica registrada'}</small></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function overrideHistoricoOS() {
    W.buscarHistoricoOS = function (opts = {}) {
      const placaId = opts.placaId || 'histBuscaPlaca';
      const termoId = opts.termoId || 'histBuscaTermo';
      const resultadoId = opts.resultadoId || 'histBuscaResultado';
      ensureKardexPeriodControls(opts);
      const placa = placaNorm(byId(placaId)?.value || '');
      const termoRaw = byId(termoId)?.value || '';
      const termo = norm(termoRaw);
      const el = byId(resultadoId);
      if (!el) return;
      if (!placa && !termo) { el.innerHTML = '<div style="color:var(--muted);font-size:.8rem;">Digite placa e/ou peca/servico.</div>'; return; }
      if (termoRaw && termoPareceCodigoPeca(termoRaw)) {
        const codigo = codigoPecaNormalizado(termoRaw);
        const rastreio = renderRastreioPecaCodigo(codigo, termoRaw, placa);
        const kardex = secret177()
          ? `<details class="op-card hist-os-card"><summary style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><b style="font-family:var(--fd);color:var(--danger);">KARDEX INTERNO *177 DO CODIGO ${esc(termoRaw)}</b><span class="hist-os-chevron">›</span></summary><div style="margin-top:10px;">${renderKardexPecaCodigo(codigo, termoRaw, placa)}</div></details>`
          : '';
        el.innerHTML = rastreio + kardex;
        return;
      }
      const hits = (J().os || []).filter(o => {
        const v = veiculoByOS(o);
        const p = placaNorm(o.placa || v.placa || '');
        if (placa && !(p === placa || p.includes(placa))) return false;
        if (!termo) return true;
        const groups = gruposHistorico(o);
        return norm(groupText(groups)).includes(termo);
      });
      if (!hits.length) { el.innerHTML = `<div style="color:var(--muted);font-family:var(--fm);font-size:.8rem;padding:10px 0;">Nenhuma O.S. encontrada.</div>`; return; }
      el.innerHTML = renderResumoCustosReaisVeiculo(placa, hits, termoRaw) + `<div style="font-family:var(--fm);font-size:.65rem;color:var(--muted);margin-bottom:6px;">${hits.length} O.S. encontrada(s)${termoRaw ? ` - exibindo somente itens que batem com "${esc(termoRaw)}"` : ''}</div>` + hits.map(o => {
        const v = veiculoByOS(o);
        const c = (J().clientes || []).find(x => x.id === o.clienteId) || {};
        const g = filtrarGruposHistorico(gruposHistorico(o), termoRaw);
        const aberta = hits.length === 1 ? ' open' : '';
        return `<details class="op-card hist-os-card"${aberta}>
          <summary style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">
            <div><b style="color:var(--cyan);font-family:var(--fm);">OS #${esc(String(o.numero || o.id || '').slice(-6).toUpperCase())}</b> <span class="op-chip">${esc(v.prefixo || o.prefixo || '')}</span> <span class="op-chip">${esc(o.placa || v.placa || '')}</span> <span class="op-chip">${esc(v.modelo || o.veiculo || '')}</span></div>
            <div style="font-family:var(--fm);font-size:.68rem;color:var(--muted);">${esc(c.nome || o.cliente || '')} - ${esc(o.status || '')} <span class="hist-os-chevron">›</span></div>
          </summary>
          <div style="margin-top:10px;">
            ${renderGroup('SERVICOS APROVADOS', g.servAprov, 'ok')}
            ${renderGroup('PECAS APROVADAS', g.pecAprov, 'ok')}
            ${renderGroup('SERVICOS NAO APROVADOS', g.servNao, 'warn')}
            ${renderGroup('PECAS NAO APROVADAS', g.pecNao, 'warn')}
            ${secret177() ? renderGroup('PECAS REAIS / AUDITORIA *177', g.reais, 'danger') : ''}
          </div>
        </details>`;
      }).join('');
    };
  }

  function installFiscalListeners() {
    if (W.__THIA_FIRESTORE_ECONOMICO_V265__) { W._hardeningFiscalListeners = true; return; }
    if (W._hardeningFiscalListeners || !db() || !J().tid) return;
    W._hardeningFiscalListeners = true;
    const listen = (col, target, renderer) => {
      try {
        return db().collection(col).where('tenantId','==',J().tid).onSnapshot(snap => {
          J()[target] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
          renderer?.();
        }, err => console.warn('[hardening fiscal]', col, err.message));
      } catch (e) { console.warn('[hardening fiscal]', col, e.message); return null; }
    };
    listen('notas_fiscais_entrada','notasFiscaisEntrada', renderDocsFiscais);
    listen('nf_itens_vinculos','nfItensVinculos', renderDocsFiscais);
    listen('estoque_movimentos','estoqueMovimentos', renderDocsFiscais);
    // Painel de pacotes removido da interface por decisão operacional.
    // Dados existentes em pacotes_boletos são preservados; não mantemos listener sem uso.
  }

  function installDocsFiscaisPanel() {
    const sec = byId('s-estoque');
    if (!sec || byId('docsFiscaisPanel')) return;
    const panel = D.createElement('div');
    panel.id = 'docsFiscaisPanel';
    panel.className = 'op-card j-card';
    panel.innerHTML = `
      <div class="j-card-header">
        <div class="j-card-title">NOTAS FISCAIS / ENTRADAS / SAIDAS</div>
        <div class="j-collapse-tools"><button type="button" class="btn-ghost j-collapse-toggle" onclick="window.toggleJarvisCollapse(this)" title="Minimizar ou expandir notas fiscais">−</button></div>
      </div>
      <div class="j-card-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <input class="j-input" id="fiscalDocBusca" placeholder="Buscar por NF, fornecedor, codigo, placa, O.S." style="min-width:260px;flex:1;" oninput="window.agendarRenderDocsFiscaisV270?.()">
          <select class="j-select" id="fiscalDocTipo" onchange="window.renderDocsFiscaisHardening()" style="width:180px;"><option value="">Todos</option><option value="entrada">Entradas NF</option><option value="mov">Movimentos estoque</option><option value="saida">Saidas/vendas</option></select>
        </div>
        <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Tipo</th><th>Documento</th><th>Fornecedor/Cliente</th><th>Data</th><th>Valor/Qtd</th><th>Vinculos</th><th>Acoes</th></tr></thead><tbody id="tbDocsFiscais"></tbody></table></div>
      </div>
      `;
    sec.prepend(panel);
    ensureFiscalModal();
  }
  const fiscalDocsCacheV270 = { notesRef:null, movsRef:null, vendasRef:null, rows:[], linksRef:null, linksByNf:new Map() };
  let fiscalDocsLimitV270 = 80;
  let fiscalDocsFilterSignatureV270 = '';
  let fiscalDocsTimerV270 = null;

  function agendarRenderDocsFiscaisV270(delay) {
    clearTimeout(fiscalDocsTimerV270);
    fiscalDocsTimerV270 = setTimeout(() => renderDocsFiscais(), Number(delay ?? 160));
  }

  function fiscalDocsBaseRowsV270() {
    const state = J();
    const notes = Array.isArray(state.notasFiscaisEntrada) ? state.notasFiscaisEntrada : [];
    const movsSrc = Array.isArray(state.estoqueMovimentos) ? state.estoqueMovimentos : [];
    const vendasSrc = Array.isArray(state.vendasAutopecas) ? state.vendasAutopecas : [];
    if (fiscalDocsCacheV270.notesRef === notes && fiscalDocsCacheV270.movsRef === movsSrc && fiscalDocsCacheV270.vendasRef === vendasSrc) return fiscalDocsCacheV270.rows;
    const notas = notes.map(n => { const texto=[n.numero,n.chave,n.fornecedorSnapshot?.nome,n.fornecedorNome,n.totalNF].join(' '); return { kind:'entrada', doc:n, texto, textoNorm:norm(texto) }; });
    const movs = movsSrc.map(m => { const texto=[m.tipo,m.nfNumero,m.desc,m.codigo,m.placa,m.osId].join(' '); return { kind:'mov', doc:m, texto, textoNorm:norm(texto) }; });
    const vendas = vendasSrc.map(v => { const texto=[v.clienteNome,v.id,v.pagamento,(v.itens||[]).map(i=>i.desc).join(' ')].join(' '); return { kind:'saida', doc:v, texto, textoNorm:norm(texto) }; });
    fiscalDocsCacheV270.notesRef = notes;
    fiscalDocsCacheV270.movsRef = movsSrc;
    fiscalDocsCacheV270.vendasRef = vendasSrc;
    fiscalDocsCacheV270.rows = notas.concat(movs, vendas);
    return fiscalDocsCacheV270.rows;
  }

  function fiscalLinksByNfV270() {
    const links = Array.isArray(J().nfItensVinculos) ? J().nfItensVinculos : [];
    if (fiscalDocsCacheV270.linksRef === links) return fiscalDocsCacheV270.linksByNf;
    const map = new Map();
    links.forEach(x => {
      const id = String(x?.nfId || '');
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(x);
    });
    fiscalDocsCacheV270.linksRef = links;
    fiscalDocsCacheV270.linksByNf = map;
    return map;
  }

  function renderDocsFiscais() {
    const tb = byId('tbDocsFiscais');
    if (!tb) return;
    const q = norm(byId('fiscalDocBusca')?.value || '');
    const tipoFiltro = byId('fiscalDocTipo')?.value || '';
    const signature = `${q}|${tipoFiltro}`;
    if (signature !== fiscalDocsFilterSignatureV270) {
      fiscalDocsFilterSignatureV270 = signature;
      fiscalDocsLimitV270 = 80;
    }
    const rows = fiscalDocsBaseRowsV270().filter(r => (!tipoFiltro || r.kind === tipoFiltro) && (!q || r.textoNorm.includes(q)));
    const visible = rows.slice(0, Math.max(80, fiscalDocsLimitV270));
    const linksByNf = fiscalLinksByNfV270();
    tb.innerHTML = visible.map(r => {
      const d = r.doc;
      if (r.kind === 'entrada') {
        const vinc = linksByNf.get(String(d.id || '')) || [];
        const vincReais = vinc.filter(vinculoFiscalReal);
        const excluida = d.excluidaAuditada || /excluida|cancelada/i.test(String(d.statusFiscal || d.statusConferencia || ''));
        return `<tr><td><span class="op-chip ${excluida?'danger':'ok'}">${excluida?'Excluida auditada':'Entrada NF'}</span></td><td><b>NF ${esc(d.numero || '-')}</b><br><small>${esc(d.chave || '')}</small></td><td>${esc(d.fornecedorSnapshot?.nome || d.fornecedorNome || '-')}</td><td>${esc(d.dataNF || d.createdAt || '-')}</td><td>${moeda(d.totalNF || d.totalItens || 0)}<br><small>${(d.itens||[]).length} item(ns)</small></td><td>${vincReais.length} vinculo(s)<br><small>${vinc.filter(x=>x.estoqueBaixadoAutomatico).length} baixa(s) auto</small></td><td><button class="btn-ghost" onclick="window.editarDocFiscal('${esc(d.id)}')">EDITAR</button>${excluida?'':`<button class="btn-danger" onclick="window.excluirNFAuditada ? window.excluirNFAuditada('${esc(d.id)}') : window.excluirNFDef('${esc(d.id)}')" style="margin-left:4px;">EXCLUIR</button>`}</td></tr>`;
      }
      if (r.kind === 'saida') {
        return `<tr><td><span class="op-chip">Saida/venda</span></td><td><b>${esc(String(d.id||'').slice(-6).toUpperCase())}</b></td><td>${esc(d.clienteNome || '-')}</td><td>${esc(d.data || d.createdAt || '-')}</td><td>${moeda(d.total || 0)}<br><small>${(d.itens||[]).length} item(ns)</small></td><td>${esc(d.canal || '')}</td><td>-</td></tr>`;
      }
      return `<tr><td><span class="op-chip warn">${esc(d.tipo || 'Movimento')}</span></td><td>${esc(d.nfNumero || d.nfId || '-')}</td><td>${esc(d.fornecedorId || '-')}</td><td>${esc(d.createdAt || '-')}</td><td>${esc(d.qtd || 0)}<br><small>${moeda(d.total || 0)}</small></td><td>${esc(d.placa || '')} ${d.osId ? 'OS #' + esc(String(d.osId).slice(-6).toUpperCase()) : ''}<br>${esc(d.desc || '')}</td><td>-</td></tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:18px;">Nenhum documento fiscal/movimento encontrado.</td></tr>';
    if (visible.length < rows.length) {
      tb.insertAdjacentHTML('beforeend', `<tr><td colspan="7" style="padding:12px;text-align:center;white-space:normal;"><button type="button" class="btn-outline" onclick="window.carregarMaisDocsFiscaisV270?.()">CARREGAR MAIS DOCUMENTOS (${visible.length}/${rows.length})</button></td></tr>`);
    }
  }
  W.agendarRenderDocsFiscaisV270 = agendarRenderDocsFiscaisV270;
  W.carregarMaisDocsFiscaisV270 = function () { fiscalDocsLimitV270 += 80; renderDocsFiscais(); };
  W.renderDocsFiscaisHardening = renderDocsFiscais;
  function ensureFiscalModal() {
    if (byId('modalFiscalDocHardening')) return;
    D.body.insertAdjacentHTML('beforeend', `<div class="overlay" id="modalFiscalDocHardening"><div class="modal" style="max-width:620px;"><div class="modal-head"><div class="modal-title">CONFERIR / EDITAR NF</div><button class="modal-close" onclick="fecharModal('modalFiscalDocHardening')">x</button></div><div class="modal-body"><input type="hidden" id="fdId"><div class="form-row cols-2"><div class="form-group"><label class="j-label">Numero</label><input class="j-input" id="fdNumero"></div><div class="form-group"><label class="j-label">Data</label><input type="date" class="j-input" id="fdData"></div></div><div class="form-row cols-2"><div class="form-group"><label class="j-label">Fornecedor</label><select class="j-select" id="fdFornecedor"></select></div><div class="form-group"><label class="j-label">Status conferencia</label><select class="j-select" id="fdStatus"><option>Conferida</option><option>Pendente</option><option>Divergencia</option></select></div></div><div class="form-group"><label class="j-label">Observacao</label><textarea class="j-input" id="fdObs" rows="3"></textarea></div><div id="fdResumoItens" style="font-size:.72rem;color:var(--muted);"></div></div><div class="modal-foot"><button class="btn-ghost" onclick="fecharModal('modalFiscalDocHardening')">CANCELAR</button><button class="btn-primary" onclick="window.salvarDocFiscalHardening()">SALVAR</button></div></div></div>`);
  }
  W.editarDocFiscal = function (id) {
    const n = (J().notasFiscaisEntrada || []).find(x => x.id === id);
    if (!n) return;
    ensureFiscalModal();
    byId('fdId').value = id;
    byId('fdNumero').value = n.numero || '';
    byId('fdData').value = n.dataNF || '';
    byId('fdObs').value = n.obsConferencia || n.observacao || '';
    byId('fdStatus').value = n.statusConferencia || 'Pendente';
    byId('fdFornecedor').innerHTML = '<option value="">Fornecedor XML/snapshot</option>' + (J().fornecedores || []).map(f => `<option value="${esc(f.id)}" ${n.fornecedorId===f.id?'selected':''}>${esc(f.nome || f.razaoSocial || f.id)}</option>`).join('');
    const vinculos = (J().nfItensVinculos || []).filter(v => v.nfId === id || (n.chave && v.chave === n.chave) || (n.numero && v.nfNumero === n.numero));
    const fins = (J().financeiro || []).filter(f => f.notaFiscalId === id || f.nfId === id || (n.chave && f.chaveNFe === n.chave) || (n.numero && String(f.desc || '').includes('NF ' + n.numero)));
    byId('fdResumoItens').innerHTML = `
      <div style="border:1px solid var(--border);border-radius:4px;padding:10px;margin:8px 0;background:var(--surf2);">
        <b>Espelho fiscal bloqueado para edicao livre</b><br>
        Chave: ${esc(n.chave || '-')}<br>
        Serie: ${esc(n.serie || '-')} | Natureza: ${esc(n.natureza || '-')} | Total NF: ${moeda(n.totalNF || n.totalItens || 0)}<br>
        A nota XML deve ser preservada. Edite apenas conferencia, vinculos internos, estoque e financeiro com auditoria.
      </div>
      <div class="op-table-wrap" style="margin-top:8px;"><table class="op-table"><thead><tr><th>Codigo</th><th>Descricao</th><th>NCM/CFOP/CEST</th><th>Qtd</th><th>Custo</th><th>Destino</th></tr></thead><tbody>
        ${(n.itens || []).slice(0,80).map(i => {
          const dest = String(i.destino || i.finalidade || 'estoque').toLowerCase();
          const complemento = (dest === 'os' || dest === 'placa') ? (i.placa || i.vinculo || '') : '';
          return `<tr><td>${esc(i.codigoFornecedor || i.codigo || '')}<br><small>${esc(i.codigoComercial || i.oem || '')}</small></td><td>${esc(i.descricao || i.desc || '')}<br><small>${esc(i.marca || '')}</small></td><td>${esc(i.ncm || '-')} / ${esc(i.cfop || '-')} / ${esc(i.cest || '-')}</td><td>${esc(i.quantidade || i.qtd || 1)}</td><td>${moeda(i.valorUnitario || i.custo || 0)}</td><td>${esc(dest || 'estoque')} ${esc(complemento)}</td></tr>`;
        }).join('') || '<tr><td colspan="6">Sem itens registrados.</td></tr>'}
      </tbody></table></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        <div style="border:1px solid var(--border);border-radius:4px;padding:10px;background:var(--surf2);"><b>Vinculos / baixas</b><br>${vinculos.slice(0,40).map(v=>`- ${esc(v.codigoFornecedor || v.codigo || '')} ${esc(v.desc || '')} | ${esc(destinoFiscalResumo(v))} | baixa: ${v.estoqueBaixadoAutomatico?'sim':'nao'}`).join('<br>') || 'Nenhum vinculo registrado.'}</div>
        <div style="border:1px solid var(--border);border-radius:4px;padding:10px;background:var(--surf2);"><b>Financeiro da NF</b><br>${fins.slice(0,40).map(f=>`- ${esc(f.desc || f.id)} | ${moeda(f.valor || 0)} | ${esc(f.venc || '')} | ${esc(f.status || '')}${f.pacoteBoletoNumero ? ' | pacote ' + esc(f.pacoteBoletoNumero) : ''}`).join('<br>') || 'Nenhum lancamento vinculado.'}</div>
      </div>`;
    W.abrirModal?.('modalFiscalDocHardening');
  };
  W.salvarDocFiscalHardening = async function () {
    const id = byId('fdId')?.value;
    if (!id || !db()) return;
    await db().collection('notas_fiscais_entrada').doc(id).update({ numero:byId('fdNumero').value, dataNF:byId('fdData').value, fornecedorId:byId('fdFornecedor').value || '', statusConferencia:byId('fdStatus').value, obsConferencia:byId('fdObs').value, updatedAt:new Date().toISOString() });
    toast('NF atualizada para conferencia.', 'ok');
    W.fecharModal?.('modalFiscalDocHardening');
  };

  function installPacotesPanel() {
    // O antigo quadro superior de pacotes/duplicatas foi retirado da tela financeira.
    // Nenhum documento é excluído. O agrupamento direto da lista financeira permanece intacto.
    const antigo = byId('pacotesBoletosPanel');
    if (antigo) antigo.remove();
  }

  function instalarConsultaServicosTerceirizadosFinanceiro() {
    const sec = byId('s-financeiro');
    if (!sec || byId('consultaServicosTerceirizadosFin')) return;
    const fluxo = byId('tbFinanceiro')?.closest('.j-card');
    if (!fluxo) return;
    const card = D.createElement('div');
    card.id = 'consultaServicosTerceirizadosFin';
    card.className = 'op-card j-card';
    card.innerHTML = `
      <div class="j-card-header">
        <div><div class="j-card-title">SERVIÇOS TERCEIRIZADOS — CONSULTA FINANCEIRA</div>
        <div style="font-family:var(--fm);font-size:.58rem;color:var(--muted);margin-top:3px;">Consulta os serviços terceirizados lançados nas O.S. e os custos reais informados no controle interno. Usa a O.S. já carregada no sistema e não cria leitura extra no Firebase.</div></div>
        <div class="j-collapse-tools"><button type="button" class="btn-ghost j-collapse-toggle" onclick="window.toggleJarvisCollapse(this)" title="Minimizar ou expandir">−</button></div>
      </div>
      <div class="j-card-body">
        <div class="fin-terceiro-filtros-v270">
          <div class="form-group"><label class="j-label">Pesquisar</label><input class="j-input" id="finTerceiroBusca" placeholder="Serviço, fornecedor, placa, O.S., pedido ou NF" oninput="window.agendarRenderServicosTerceirizadosV270?.()"></div>
          <div class="form-group"><label class="j-label">De</label><input type="date" class="j-input" id="finTerceiroInicio" onchange="window.renderServicosTerceirizadosFinanceiro?.()"></div>
          <div class="form-group"><label class="j-label">Até</label><input type="date" class="j-input" id="finTerceiroFim" onchange="window.renderServicosTerceirizadosFinanceiro?.()"></div>
          <div class="form-group"><label class="j-label">Origem</label><select class="j-select" id="finTerceiroOrigem" onchange="window.renderServicosTerceirizadosFinanceiro?.()"><option value="">Todos</option><option value="os">Serviço da O.S.</option><option value="real">Custo real / documento</option></select></div>
        </div>
        <div id="finTerceiroResumo" style="font-family:var(--fm);font-size:.62rem;color:var(--muted);margin:4px 0 8px;">Nenhum filtro aplicado.</div>
        <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Data</th><th>O.S. / Placa</th><th>Cliente</th><th>Serviço</th><th>Prestador / Fornecedor</th><th>Pedido / NF / Documento</th><th>Valor / Custo</th><th>Status O.S.</th></tr></thead><tbody id="tbServicosTerceirizadosFin"></tbody></table></div>
      </div>`;
    fluxo.insertAdjacentElement('afterend', card);
    W.renderServicosTerceirizadosFinanceiro?.();
  }

  function dataTerceiroFinanceiro(valor) {
    if (!valor) return '';
    if (typeof valor === 'string') return valor.slice(0,10);
    try { if (valor.toDate) return valor.toDate().toISOString().slice(0,10); } catch (_) {}
    return '';
  }

  const terceirosCacheV270 = { osRef:null, clientesRef:null, veiculosRef:null, linhas:[] };
  let terceirosLimitV270 = 80;
  let terceirosFilterSignatureV270 = '';
  let terceirosTimerV270 = null;

  function agendarRenderServicosTerceirizadosV270(delay) {
    clearTimeout(terceirosTimerV270);
    terceirosTimerV270 = setTimeout(() => W.renderServicosTerceirizadosFinanceiro?.(), Number(delay ?? 160));
  }

  function linhasServicosTerceirizadosV270() {
    const state = J();
    const osList = Array.isArray(state.os) ? state.os : [];
    const clientes = Array.isArray(state.clientes) ? state.clientes : [];
    const veiculos = Array.isArray(state.veiculos) ? state.veiculos : [];
    if (terceirosCacheV270.osRef === osList && terceirosCacheV270.clientesRef === clientes && terceirosCacheV270.veiculosRef === veiculos) return terceirosCacheV270.linhas;
    const clientesById = new Map(clientes.map(c => [String(c.id || ''), c]));
    const veiculosById = new Map(veiculos.map(v => [String(v.id || ''), v]));
    const linhas = [];
    osList.forEach(o => {
      const v = veiculosById.get(String(o?.veiculoId || o?.veiculo || '')) || {};
      const cliente = clientesById.get(String(o?.clienteId || '')) || {};
      const baseData = dataTerceiroFinanceiro(o.updatedAt || o.createdAt || o.dataAbertura || o.data);
      (o.servicos || []).forEach(sv => {
        const terceirizado = String(sv.tipoExecucao || sv.execucaoTipo || '').toLowerCase() === 'terceirizada' || sv.terceirizado === true || sv.servicoTerceirizado === true || !!(sv.terceirizadoNome || sv.prestadorNome || sv.fornecedorServicoNome);
        if (!terceirizado) return;
        const pedidoTerceiro = sv.terceirizadoPedidoFornecedor || sv.pedidoFornecedor || sv.numeroPedidoFornecedor || sv.pedidoTerceirizado || '';
        const documentoTerceiro = sv.terceirizadoDocumento || sv.nfServicoTerceirizado || sv.documentoServicoTerceirizado || '';
        const docExibicao = [pedidoTerceiro ? `Pedido ${pedidoTerceiro}` : '', documentoTerceiro ? `NF/Doc ${documentoTerceiro}` : ''].filter(Boolean).join(' · ');
        const custoTerceiroInformado = sv.terceirizadoValor ?? sv.custoTerceirizado ?? sv.valorServicoTerceirizado ?? sv.valorFornecedorTerceirizado;
        const valorEhCustoTerceiro = custoTerceiroInformado != null && String(custoTerceiroInformado) !== '';
        linhas.push({ origem:'os', data:dataTerceiroFinanceiro(sv.terceirizadoData || sv.dataServicoTerceirizado || sv.dataLancamentoTerceirizado || sv.dataServico || sv.dataLancamento || sv.createdAt) || baseData, os:o, v, cliente, descricao:sv.descricao || sv.desc || '', fornecedor:sv.terceirizadoNome || sv.prestadorNome || sv.fornecedorServicoNome || '', documento:docExibicao || sv.pedido || sv.nf || sv.nfNumero || '', valor:valorEhCustoTerceiro ? num(custoTerceiroInformado) : 0, valorEhCustoTerceiro });
      });
      (o.servicosReais || o.servicosTerceirizadosReais || []).forEach(sv => {
        linhas.push({ origem:'real', data:dataTerceiroFinanceiro(sv.dataCompra || sv.dataServico || sv.data || sv.createdAt) || baseData, os:o, v, cliente, descricao:sv.descricao || sv.desc || '', fornecedor:sv.fornecedor || sv.fornecedorNome || sv.terceirizadoNome || '', documento:sv.pedidoFornecedor || sv.numeroPedidoFornecedor || sv.pedido || sv.nf || sv.nfNumero || sv.documento || '', valor:num(sv.valorCompra || sv.custo || sv.valorReal || sv.valor || 0) });
      });
    });
    terceirosCacheV270.osRef = osList;
    terceirosCacheV270.clientesRef = clientes;
    terceirosCacheV270.veiculosRef = veiculos;
    terceirosCacheV270.linhas = linhas;
    return linhas;
  }

  W.agendarRenderServicosTerceirizadosV270 = agendarRenderServicosTerceirizadosV270;
  W.carregarMaisServicosTerceirizadosV270 = function () { terceirosLimitV270 += 80; W.renderServicosTerceirizadosFinanceiro?.(); };
  W.renderServicosTerceirizadosFinanceiro = function () {
    instalarConsultaServicosTerceirizadosFinanceiro();
    const tb = byId('tbServicosTerceirizadosFin');
    if (!tb) return;
    const busca = norm(byId('finTerceiroBusca')?.value || '');
    const ini = byId('finTerceiroInicio')?.value || '';
    const fim = byId('finTerceiroFim')?.value || '';
    const origemFiltro = byId('finTerceiroOrigem')?.value || '';
    const signature = `${busca}|${ini}|${fim}|${origemFiltro}`;
    if (signature !== terceirosFilterSignatureV270) {
      terceirosFilterSignatureV270 = signature;
      terceirosLimitV270 = 80;
    }
    const filtradas = linhasServicosTerceirizadosV270().filter(x => {
      if (origemFiltro && x.origem !== origemFiltro) return false;
      if (ini && x.data && x.data < ini) return false;
      if (fim && x.data && x.data > fim) return false;
      if (busca) {
        const alvo = norm([x.descricao,x.fornecedor,x.documento,x.os?.numero,x.os?.id,x.os?.placa,x.v?.placa,x.cliente?.nome,x.os?.status].filter(Boolean).join(' '));
        if (!busca.split(/\s+/).filter(Boolean).every(t => alvo.includes(t))) return false;
      }
      return true;
    }).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
    const totalReal = filtradas.filter(x=>x.origem==='real').reduce((s,x)=>s+num(x.valor),0);
    const totalTerceirosOS = filtradas.filter(x=>x.origem==='os' && x.valorEhCustoTerceiro).reduce((s,x)=>s+num(x.valor),0);
    const visible = filtradas.slice(0, Math.max(80, terceirosLimitV270));
    const resumo = byId('finTerceiroResumo');
    if (resumo) resumo.innerHTML = `<b style="color:var(--cyan)">${filtradas.length} registro(s)</b> • exibindo <b>${visible.length}</b> • serviços terceiros informados: <b style="color:var(--warn)">${moeda(totalTerceirosOS)}</b> • custos reais documentados: <b style="color:var(--warn)">${moeda(totalReal)}</b>`;
    tb.innerHTML = visible.map(x => `<tr><td>${esc(x.data || '-')}</td><td><b>${esc(String(x.os?.numero || x.os?.id || '').slice(-8).toUpperCase())}</b><br><small>${esc(x.os?.placa || x.v?.placa || '-')}</small></td><td>${esc(x.cliente?.nome || x.os?.cliente || '-')}</td><td>${esc(x.descricao || '-')}<br><small>${x.origem==='real'?'CUSTO REAL / DOCUMENTO':'SERVIÇO LANÇADO NA O.S.'}</small></td><td>${esc(x.fornecedor || '-')}</td><td>${esc(x.documento || '-')}</td><td>${x.origem==='os' && !x.valorEhCustoTerceiro ? '<span style="color:var(--muted)">NÃO INFORMADO</span>' : moeda(x.valor || 0)}</td><td>${esc(x.os?.status || '-')}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:18px;">Nenhum serviço terceirizado encontrado para os filtros informados.</td></tr>';
    if (visible.length < filtradas.length) {
      tb.insertAdjacentHTML('beforeend', `<tr><td colspan="8" style="padding:12px;text-align:center;white-space:normal;"><button type="button" class="btn-outline" onclick="window.carregarMaisServicosTerceirizadosV270?.()">CARREGAR MAIS SERVIÇOS (${visible.length}/${filtradas.length})</button></td></tr>`);
    }
  };

  function fornecedorNomePacote(id) {
    const f = (J().fornecedores || []).find(x => String(x.id) === String(id));
    return f?.nome || f?.razaoSocial || f?.razao || f?.fantasia || id || '-';
  }

  function renderPacotesBoletos() {
    const sel = byId('pkgFornecedor');
    if (sel) {
      const old = sel.value || '';
      sel.innerHTML = '<option value="">Selecione um fornecedor</option>' + (J().fornecedores || []).map(f => `<option value="${esc(f.id)}">${esc(f.nome || f.razaoSocial || f.id)}</option>`).join('');
      if (old) sel.value = old;
    }
    atualizarEstadoPacoteBoletos();
    const tb = byId('tbPacotesBoletos');
    if (!tb) return;
    tb.innerHTML = (J().pacotesBoletos || []).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(p => {
      const fechado = /fechado|pago|baixado/i.test(String(p.status || ''));
      const boletos = Array.isArray(p.boletos) ? p.boletos : [];
      return `<tr><td><b>${esc(p.numero || String(p.id||'').slice(-6).toUpperCase())}</b></td><td>${esc(p.fornecedorNome || p.fornecedorId || '-')}</td><td>${esc(p.inicio || '-')} a ${esc(p.fim || '-')}</td><td>${(p.titulos || []).length}</td><td>${boletos.length}<br><small>${boletos.map(b => esc((b.numero || 's/n') + ' ' + (b.vencimento || ''))).join('<br>')}</small></td><td>${moeda(p.total || p.totalBoletos || 0)}</td><td><span class="op-chip ${fechado?'ok':'warn'}">${esc(p.status || 'Aberto')}</span></td><td><button class="btn-ghost" onclick="window.verTitulosPacoteBoletos('${esc(p.id)}')">VER</button>${fechado?'':`<button class="btn-outline" onclick="window.baixarPacoteBoletosHardening('${esc(p.id)}')" style="margin-left:4px;">BAIXAR BOLETOS</button>`}</td></tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:18px;">Nenhum pacote criado.</td></tr>';
  }

  function numeroNFLancamentoPacote(f) {
    const direto = f?.nfNumero || f?.numeroNota || f?.numeroNF || f?.nf || f?.notaFiscalNumero || '';
    if (direto) return String(direto);
    const txt = String(f?.desc || f?.descricao || f?.nota || '');
    const m = txt.match(/\bNF\s*(?:N[º°o.]?\s*)?([0-9][0-9./-]{0,24})/i);
    return m?.[1] || String(f?.notaFiscalId || f?.nfId || '').slice(-10) || '-';
  }

  function fornecedorIdLancamentoPacote(f) {
    if (!f) return '';
    if (f.fornecedorId) return String(f.fornecedorId);
    if (f.fornecedor && typeof f.fornecedor !== 'object') {
      const direto = (J().fornecedores || []).find(fr => String(fr.id) === String(f.fornecedor));
      if (direto) return String(direto.id);
    }
    const vinc = String(f.vinculo || '');
    if (vinc.startsWith('F_')) return vinc.slice(2);
    const texto = norm([f.desc,f.nota,f.nfNumero,f.numeroNota,f.fornecedorNome,f.fornecedor].filter(Boolean).join(' '));
    const achado = (J().fornecedores || []).find(fr => {
      const nomes = [fr.nome,fr.razaoSocial,fr.razao,fr.fantasia,fr.nomeFantasia].map(norm).filter(Boolean);
      return nomes.some(nome => nome.length >= 3 && texto.includes(nome));
    });
    return achado ? String(achado.id) : '';
  }

  W.reiniciarSelecaoPacoteBoletos = function () {
    W._pkgBoletosSelIds = [];
    const preview = byId('pkgPreview');
    const editor = byId('pkgBoletosEditor');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (editor) { editor.style.display = 'none'; editor.innerHTML = ''; }
    atualizarEstadoPacoteBoletos();
  };

  function atualizarEstadoPacoteBoletos() {
    const selecionados = titulosSelecionadosPacote();
    const btn = byId('pkgBtnPreparar');
    const btnListar = byId('pkgBtnListar');
    const resumo = byId('pkgSelecaoResumo');
    const total = selecionados.reduce((s,f)=>s+num(f.valor),0);
    if (btnListar) {
      const fornecedorSelecionado = !!(byId('pkgFornecedor')?.value || '');
      btnListar.disabled = !fornecedorSelecionado;
      btnListar.title = fornecedorSelecionado ? 'Listar NFs/contas pendentes deste fornecedor' : 'Selecione primeiro um fornecedor';
    }
    if (btn) {
      btn.disabled = selecionados.length === 0;
      btn.title = selecionados.length ? 'Continuar para informar os boletos reais recebidos' : 'Liste os títulos e marque ao menos um antes de continuar';
    }
    if (resumo) resumo.innerHTML = selecionados.length
      ? `<b style="color:var(--cyan)">${selecionados.length} título(s) selecionado(s)</b> • ${moeda(total)}`
      : 'Nenhum título selecionado.';
  }
  W.atualizarEstadoPacoteBoletos = atualizarEstadoPacoteBoletos;

  function titulosElegiveisPacote() {
    const fornecedorId = byId('pkgFornecedor')?.value || '';
    const ini = byId('pkgInicio')?.value || '0000-01-01';
    const fim = byId('pkgFim')?.value || '9999-12-31';
    return (J().financeiro || []).filter(f => {
      const status = norm(f.status);
      const venc = String(f.venc || f.vencimento || f.dataNF || f.createdAt || '').slice(0,10) || todayISO();
      const boleto = f.aguardaBoletoAgrupado || f.agrupamentoPeriodo || /(boleto|duplicata|nf|fornecedor|parcelado|agrupamento)/i.test([f.pgto,f.desc,f.categoria,f.origem].join(' '));
      const forn = fornecedorIdLancamentoPacote(f);
      const fornOk = fornecedorId && String(forn) === String(fornecedorId);
      // "Aguardando boleto agrupado" é justamente um título elegível.
      // Antes o termo "agrupado" no status fazia o painel esconder esses lançamentos.
      const encerrado = /pago|liquidado|cancelado/.test(status) || (/(^|\s)agrupado($|\s)/.test(status) && !/aguardando.*agrupado/.test(status));
      return boleto && fornOk && venc >= ini && venc <= fim && !encerrado && !f.pacoteBoletoId && !f.boletoRealDoPacote;
    });
  }

  function titulosSelecionadosPacote() {
    const ids = Array.from(D.querySelectorAll('input[name="pkgTituloSel"]:checked')).map(x => x.value);
    return (J().financeiro || []).filter(f => ids.includes(String(f.id)));
  }

  W.toggleSelecionarTitulosPacote = function (checked) {
    D.querySelectorAll('input[name="pkgTituloSel"]').forEach(i => { i.checked = !!checked; });
    atualizarEstadoPacoteBoletos();
  };

  W.previewPacoteBoletosHardening = function () {
    const box = byId('pkgPreview');
    if (!box) return;
    const fornecedorId = byId('pkgFornecedor')?.value || '';
    if (!fornecedorId) { toast('Selecione o fornecedor para agrupar boletos.', 'warn'); return; }
    W._pkgBoletosSelIds = [];
    const editor = byId('pkgBoletosEditor');
    if (editor) { editor.style.display = 'none'; editor.innerHTML = ''; }
    const lista = titulosElegiveisPacote();
    box.style.display = 'block';
    const total = lista.reduce((s,f)=>s+num(f.valor),0);
    box.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;"><b>${lista.length} titulo(s) elegivel(is) - ${moeda(total)}</b><label style="font-family:var(--fm);font-size:.68rem;color:var(--cyan);"><input type="checkbox" onchange="window.toggleSelecionarTitulosPacote(this.checked)"> selecionar todos</label></div>` +
      (lista.length ? `<div class="op-table-wrap"><table class="op-table"><thead><tr><th></th><th>Descrição / NF</th><th>Vencimento previsto</th><th>Valor</th><th>Status</th></tr></thead><tbody>${lista.map(f=>`<tr><td><input type="checkbox" name="pkgTituloSel" value="${esc(f.id)}" onchange="window.atualizarEstadoPacoteBoletos?.()"></td><td>${esc(f.desc || f.id)}<br><small>NF: ${esc(numeroNFLancamentoPacote(f))}</small></td><td>${esc(f.venc || f.vencimento || '-')}</td><td>${moeda(f.valor || 0)}</td><td>${esc(f.status || '-')}</td></tr>`).join('')}</tbody></table></div>` : 'Nenhum título elegível para este fornecedor/período. Confira se as contas estão pendentes e vinculadas ao fornecedor.');
    atualizarEstadoPacoteBoletos();
  };

  W.addLinhaBoletoPacote = function (valor) {
    const tbody = byId('pkgBoletosRows');
    if (!tbody) return;
    const idx = tbody.querySelectorAll('tr').length + 1;
    tbody.insertAdjacentHTML('beforeend', `<tr><td><input class="j-input pkg-boleto-numero" placeholder="Numero" value="${idx}"></td><td><input type="date" class="j-input pkg-boleto-venc"></td><td><input class="j-input pkg-boleto-valor" inputmode="decimal" placeholder="0,00" value="${valor ? moeda(valor).replace('R$ ','') : ''}"></td><td><input class="j-input pkg-boleto-obs" placeholder="Observacao"></td><td><button class="btn-danger" onclick="this.closest('tr').remove()">X</button></td></tr>`);
  };

  W.prepararPacoteBoletosHardening = function () {
    const selecionados = titulosSelecionadosPacote();
    if (!selecionados.length) { toast('Selecione os titulos/NFs que vieram no agrupamento do fornecedor.', 'warn'); return; }
    const fornecedores = Array.from(new Set(selecionados.map(f => fornecedorIdLancamentoPacote(f)))).filter(Boolean);
    if (fornecedores.length !== 1) { toast('O pacote deve conter titulos de um unico fornecedor.', 'warn'); return; }
    const total = selecionados.reduce((s,f)=>s+num(f.valor),0);
    const box = byId('pkgBoletosEditor');
    if (!box) return;
    W._pkgBoletosSelIds = selecionados.map(f => f.id);
    box.style.display = 'block';
    box.innerHTML = `<div style="font-family:var(--fd);font-weight:800;color:var(--cyan);margin-bottom:8px;">BOLETOS REAIS RECEBIDOS - ${esc(fornecedorNomePacote(fornecedores[0]))} - ${moeda(total)}</div>
      <div class="op-table-wrap"><table class="op-table"><thead><tr><th>Numero</th><th>Vencimento</th><th>Valor</th><th>Obs.</th><th></th></tr></thead><tbody id="pkgBoletosRows"></tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button class="btn-outline" onclick="window.addLinhaBoletoPacote()">+ BOLETO</button><button class="btn-primary" onclick="window.confirmarPacoteBoletosHardening()">CONFIRMAR PACOTE</button></div>
      <div class="form-group" style="margin-top:8px;"><label class="j-label">Justificativa para divergencia de valores</label><textarea class="j-input" id="pkgJustificativa" rows="2" placeholder="Obrigatoria se a soma dos boletos nao bater com os titulos selecionados."></textarea></div>`;
    W.addLinhaBoletoPacote(total);
  };

  function coletarBoletosPacote() {
    return Array.from(D.querySelectorAll('#pkgBoletosRows tr')).map(tr => ({
      numero: tr.querySelector('.pkg-boleto-numero')?.value?.trim() || '',
      vencimento: tr.querySelector('.pkg-boleto-venc')?.value || '',
      valor: num(tr.querySelector('.pkg-boleto-valor')?.value || 0),
      obs: tr.querySelector('.pkg-boleto-obs')?.value?.trim() || ''
    })).filter(b => b.valor > 0 || b.vencimento || b.numero);
  }

  W.confirmarPacoteBoletosHardening = async function () {
    const ids = W._pkgBoletosSelIds || [];
    const titulos = (J().financeiro || []).filter(f => ids.includes(f.id));
    if (!titulos.length || !db()) { toast('Selecao do pacote expirou. Liste e selecione novamente.', 'warn'); return; }
    const fornecedores = Array.from(new Set(titulos.map(f => fornecedorIdLancamentoPacote(f)))).filter(Boolean);
    if (fornecedores.length !== 1) { toast('O pacote deve conter titulos de um unico fornecedor.', 'warn'); return; }
    const boletos = coletarBoletosPacote();
    if (!boletos.length || boletos.some(b => !b.vencimento || b.valor <= 0)) { toast('Informe vencimento e valor de todos os boletos reais.', 'warn'); return; }
    const totalTitulos = Math.round(titulos.reduce((s,f)=>s+num(f.valor),0)*100)/100;
    const totalBoletos = Math.round(boletos.reduce((s,b)=>s+num(b.valor),0)*100)/100;
    const justificativa = byId('pkgJustificativa')?.value?.trim() || '';
    if (Math.abs(totalTitulos - totalBoletos) >= 0.02 && justificativa.length < 8) {
      toast('A soma dos boletos nao bate com as NFs selecionadas. Informe justificativa.', 'warn');
      return;
    }
    const fornecedorId = fornecedores[0];
    const ini = titulos.map(f => String(f.venc || f.vencimento || '').slice(0,10)).filter(Boolean).sort()[0] || todayISO();
    const fim = titulos.map(f => String(f.venc || f.vencimento || '').slice(0,10)).filter(Boolean).sort().pop() || ini;
    const ref = db().collection('pacotes_boletos').doc();
    const numero = `PCT-${todayISO().replace(/-/g,'')}-${String(ref.id).slice(-4).toUpperCase()}`;
    const batch = db().batch();
    batch.set(ref, { tenantId:J().tid, numero, fornecedorId, fornecedorNome:fornecedorNomePacote(fornecedorId), inicio:ini, fim, titulos:titulos.map(f=>({id:f.id, desc:f.desc, valor:num(f.valor), venc:f.venc||f.vencimento||'', notaFiscalId:f.notaFiscalId||f.nfId||''})), boletos, total:totalTitulos, totalTitulos, totalBoletos, status:'Aberto', divergenciaValor:Math.round((totalBoletos-totalTitulos)*100)/100, justificativaDivergencia:justificativa, createdAt:new Date().toISOString(), usuario:J().nome || 'Sistema' });
    titulos.forEach(f => batch.update(db().collection('financeiro').doc(f.id), { status:'Agrupado', pacoteBoletoId:ref.id, pacoteBoletoNumero:numero, bloqueadoPagamentoIndividual:true, agrupadoEm:new Date().toISOString(), updatedAt:new Date().toISOString() }));
    boletos.forEach((b, idx) => {
      batch.set(db().collection('financeiro').doc(), { tenantId:J().tid, tipo:'Saida', status:'Pendente', desc:`Boleto agrupado ${numero} (${idx+1}/${boletos.length}) - ${fornecedorNomePacote(fornecedorId)}`, valor:num(b.valor), pgto:'Boleto agrupado', venc:b.vencimento, fornecedorId, fornecedorNome:fornecedorNomePacote(fornecedorId), pacoteBoletoId:ref.id, pacoteBoletoNumero:numero, boletoRealDoPacote:true, boletoNumero:b.numero || String(idx+1), obs:b.obs || '', titulosOrigem:titulos.map(t=>t.id), createdAt:new Date().toISOString() });
    });
    await batch.commit();
    toast(`Pacote ${numero} criado com ${titulos.length} titulo(s) e ${boletos.length} boleto(s) real(is).`, 'ok');
    const editor = byId('pkgBoletosEditor'); if (editor) editor.style.display = 'none';
    W._pkgBoletosSelIds = [];
    W.previewPacoteBoletosHardening();
  };

  W.verTitulosPacoteBoletos = function (id) {
    const p = (J().pacotesBoletos || []).find(x => x.id === id);
    const box = byId('pkgPreview');
    if (!p || !box) return;
    box.style.display = 'block';
    box.innerHTML = `<b>${esc(p.numero || p.id)} - ${esc(p.status || 'Aberto')} - ${moeda(p.total || 0)}</b><br><br><b>Titulos agrupados</b><br>` +
      ((p.titulos || []).map(t => `- ${esc(t.desc || t.id)} | venc. ${esc(t.venc || '-')} | ${moeda(t.valor || 0)}`).join('<br>') || 'Sem titulos no pacote.') +
      `<br><br><b>Boletos reais</b><br>` + ((p.boletos || []).map(b => `- ${esc(b.numero || 's/n')} | venc. ${esc(b.vencimento || '-')} | ${moeda(b.valor || 0)} ${b.obs ? '| ' + esc(b.obs) : ''}`).join('<br>') || 'Sem boletos reais registrados.');
  };

  W.baixarPacoteBoletosHardening = async function (id) {
    const p = (J().pacotesBoletos || []).find(x => x.id === id);
    if (!p || !db()) return;
    const forma = prompt('Forma de pagamento dos boletos reais do pacote:', 'PIX') || 'PIX';
    const dataBaixa = prompt('Data da baixa (YYYY-MM-DD):', todayISO()) || todayISO();
    const motivo = prompt('Observacao/comprovante da baixa:', 'Baixa de pacote de boletos') || 'Baixa de pacote de boletos';
    const boletosReais = (J().financeiro || []).filter(f => f.pacoteBoletoId === id && f.boletoRealDoPacote && !/pago|liquidado|baixado/i.test(String(f.status || '')));
    const batch = db().batch();
    boletosReais.forEach(f => batch.update(db().collection('financeiro').doc(f.id), { status:'Pago', pgto:forma, dataBaixa, baixaPacoteEm:new Date().toISOString(), baixaPacotePor:J().nome || 'Sistema', baixaPacoteObs:motivo, updatedAt:new Date().toISOString() }));
    batch.update(db().collection('pacotes_boletos').doc(id), { status:'Fechado', formaBaixa:forma, dataBaixa, obsBaixa:motivo, fechadoEm:new Date().toISOString(), fechadoPor:J().nome || 'Sistema', updatedAt:new Date().toISOString() });
    await batch.commit();
    toast(`Pacote ${p.numero || id} baixado pelos boletos reais. Titulos originais permanecem agrupados.`, 'ok');
  };

  W.renderPacotesBoletosHardening = renderPacotesBoletos;

  function wrapToggleFinanceiroAgrupado() {
    if (typeof W.toggleStatusFin !== 'function' || W.toggleStatusFin.__thiaAgrupadoWrap) return;
    const old = W.toggleStatusFin;
    W.toggleStatusFin = function (id) {
      const f = (J().financeiro || []).find(x => String(x.id) === String(id));
      if (f && (f.bloqueadoPagamentoIndividual || /agrupado/i.test(String(f.status || '')) || (f.pacoteBoletoId && !f.boletoRealDoPacote))) {
        toast('Titulo agrupado nao pode ser baixado individualmente. Use o pacote de boletos.', 'warn');
        return;
      }
      return old.apply(this, arguments);
    };
    W.toggleStatusFin.__thiaAgrupadoWrap = true;
  }
  function overrideEstoqueFornecedores() {
    W.renderEstoque = function () {
      const tb = byId('tbEstoque'); if (!tb) return;
      const termoEstoque = norm((byId('buscaEstoquePecas')?.value || W._estoqueBuscaPecas || '').trim());
      const listaEstoque = (J().estoque || []).filter(p => {
        if (!termoEstoque) return true;
        return norm([
          p.codigo,
          p.codigoFornecedor,
          p.codigoComercial,
          p.oem,
          p.ean,
          p.desc,
          p.descricao,
          p.marca,
          p.ncm,
          p.cfop,
          p.fornecedor,
          p.fornecedorNome,
          p.nfNumero,
          p.notaFiscal
        ].filter(Boolean).join(' ')).includes(termoEstoque);
      });
      tb.innerHTML = listaEstoque.map(p => {
        const crit = num(p.qtd) <= num(p.min);
        return `<tr class="${crit?'stock-critical':''}"><td style="font-family:var(--fm);font-size:.75rem;color:var(--muted)">${esc(p.codigo||p.codigoFornecedor||'-')}</td><td><strong>${esc(p.desc||p.descricao||'-')}</strong><br><small>${esc([p.marca,p.ncm,p.cfop].filter(Boolean).join(' | '))}</small></td><td style="font-family:var(--fm)">${moeda(p.custo)}</td><td style="font-family:var(--fm);color:var(--success)">${moeda(p.venda)}</td><td style="font-family:var(--fm);font-weight:700;color:${crit?'var(--danger)':'var(--text)'}">${esc(p.qtd||0)}</td><td style="font-family:var(--fm);color:var(--muted)">${esc(p.min||0)}</td><td>${crit?'<span class="pill pill-danger">CRITICO</span>':'<span class="pill pill-green">OK</span>'}</td><td><button class="btn-ghost" onclick="window.prepPeca && window.prepPeca('edit','${esc(p.id)}');abrirModal('modalPeca')">EDITAR</button><button class="btn-danger" onclick="window.excluirPecaDef && window.excluirPecaDef('${esc(p.id)}')" style="margin-left:4px;">EXCLUIR</button></td></tr>`;
      }).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">${termoEstoque ? 'Nenhuma peça encontrada para a busca' : 'Nenhum item'}</td></tr>`;
    };
    W.prepFornec = function (mode, id) {
      if (arguments.length === 1) { id = mode; mode = id ? 'edit' : 'add'; }
      ['fornecId','fornecNome','fornecSeg','fornecWpp'].forEach(f => { const el = byId(f); if (el) el.value=''; });
      if (mode === 'edit' && id) {
        const f = (J().fornecedores || []).find(x => x.id === id); if (!f) return;
        if (byId('fornecId')) byId('fornecId').value = f.id;
        if (byId('fornecNome')) byId('fornecNome').value = f.nome || f.razaoSocial || f.razao || '';
        if (byId('fornecSeg')) byId('fornecSeg').value = f.segmento || f.cidade || '';
        if (byId('fornecWpp')) byId('fornecWpp').value = f.wpp || f.telefone || '';
      }
    };
    W.renderFornecedores = function () {
      const tb = byId('tbFornec'); if (!tb) return;
      tb.innerHTML = (J().fornecedores || []).map(f => `<tr><td><strong>${esc(f.nome || f.razaoSocial || '-')}</strong><br><small>${esc(f.cnpj || f.doc || '')}</small></td><td>${esc(f.segmento || '-')}<br><small>${esc([f.cidade,f.uf].filter(Boolean).join('/'))}</small></td><td>${esc(f.wpp || f.telefone || '-')}</td><td><button class="btn-ghost" onclick="window.prepFornec('edit','${esc(f.id)}');abrirModal('modalFornec')">EDITAR</button><button class="btn-danger" onclick="window.excluirFornecedorDef && window.excluirFornecedorDef('${esc(f.id)}')" style="margin-left:4px;">EXCLUIR</button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">Nenhum fornecedor cadastrado</td></tr>';
    };
  }

  function corrigirPagamentoOS() {
    const forma = byId('osPgtoForma')?.value || '';
    const parcelas = byId('osPgtoParcelas');
    if (!parcelas) return;
    if (!/(boleto|crediario|crediário|credito|crédito|parcel)/i.test(forma)) parcelas.value = '1';
  }
  function wrapSalvarOS() {
    const factory = old => async function () {
      corrigirPagamentoOS();
      return old.apply(this, arguments);
    };
    if (W.thiaRuntimeCore?.wrapOnce) W.thiaRuntimeCore.wrapOnce('salvarOS', 'hardening-pagamento-v2613', factory);
    else {
      const old = W.salvarOS;
      if (typeof old === 'function' && !old._hardeningPgto) {
        const wrapped = factory(old);
        wrapped._hardeningPgto = true;
        wrapped.__original = old;
        W.salvarOS = wrapped;
      }
    }
    if (W.thiaRuntimeCore?.addEventOnce) {
      W.thiaRuntimeCore.addEventOnce(D, 'change', 'hardening-pagamento-os', e => {
        if (e.target?.id === 'osPgtoForma') corrigirPagamentoOS();
      });
    } else if (!D.__hardeningPagamentoOSChange) {
      D.__hardeningPagamentoOSChange = true;
      D.addEventListener('change', e => { if (e.target?.id === 'osPgtoForma') corrigirPagamentoOS(); });
    }
  }

  function installOrcamentoAuto() {
    const cont = byId('containerServicosOS');
    if (!cont || byId('orcamentoAutoBarOS')) return;
    const bar = D.createElement('div');
    bar.id = 'orcamentoAutoBarOS';
    bar.setAttribute('data-module', 'orcamentoAutomatizado');
    bar.className = 'op-card';
    bar.innerHTML = `<div class="op-title">ORCAMENTO AUTOMATIZADO</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button type="button" id="btnOrcamentoAutomatizadoOS" class="btn-primary" onclick="window.gerarOrcamentoAutomatizadoOS()">ANALISAR PECAS / RELATO E SUGERIR SERVICOS</button><span style="font-family:var(--fm);font-size:.62rem;color:var(--muted);">Nao apaga nada: apenas cria sugestoes deterministicas e usa a Temparia quando encontrar correspondencia.</span></div>`;
    cont.parentElement?.insertBefore(bar, cont);
    W.thiaApplyModuleVisibility?.(D);
  }
  function termosPecasOS() {
    return Array.from(D.querySelectorAll('#containerPecasOS .peca-desc-livre, #containerPecasOS .peca-sel option:checked')).map(el => el.value || el.textContent || '').filter(Boolean);
  }
  function servicoJaExiste(desc) {
    const n = norm(desc);
    return Array.from(D.querySelectorAll('#containerServicosOS .serv-desc')).some(el => norm(el.value).includes(n) || n.includes(norm(el.value)));
  }
  function regraServicos(txt) {
    const regras = [
      { rx:/pastilha|disco|freio|sapata|cilindro|pinca|pinça/, serv:['Inspecao e reparo do sistema de freio','Sangria/teste do sistema de freio'] },
      { rx:/amortec|batente|coifa|mola|bandeja|pivo|pivô|bieleta|coxim/, serv:['Diagnostico e substituicao de componentes da suspensao','Alinhamento apos servico de suspensao'] },
      { rx:/bateria|alternador|arranque|motor de partida|lampada|lâmpada|farol|sensor/, serv:['Diagnostico eletrico e teste de carga'] },
      { rx:/bomba combust|filtro|oleo|óleo|vela|correia|motor/, serv:['Diagnostico do sistema de motor/alimentacao'] },
      { rx:/radiador|ventoinha|reservatorio|mangueira|agua|arrefecimento/, serv:['Diagnostico e reparo do sistema de arrefecimento'] },
      { rx:/embreagem|cambio|câmbio|homocinet|semieixo/, serv:['Diagnostico do sistema de transmissao'] },
      { rx:/pneu|roda|cubo|rolamento/, serv:['Balanceamento/conferencia de rodas e cubos'] }
    ];
    const out = [];
    regras.forEach(r => { if (r.rx.test(txt)) out.push(...r.serv); });
    return [...new Set(out)];
  }
  W.gerarOrcamentoAutomatizadoOS = async function () {
    if (!modEnabled('orcamentoAutomatizado')) { toast('Modulo de orcamento automatizado bloqueado pelo Superadmin.', 'warn'); return; }
    const texto = norm([byId('osDesc')?.value, byId('osDiagnostico')?.value, byId('osRelato')?.value, termosPecasOS().join(' ')].join(' '));
    if (!texto) { toast('Inclua relato, diagnostico ou pecas para analisar.', 'warn'); return; }
    const sugestoes = regraServicos(texto).filter(s => !servicoJaExiste(s));
    if (!sugestoes.length) { toast('Nao encontrei nova sugestao segura pelas regras locais.', 'warn'); return; }
    if (typeof W.tempaCarregar === 'function') { try { await W.tempaCarregar(); } catch (_) {} }
    sugestoes.forEach(desc => {
      W.adicionarServicoOS?.();
      const row = D.querySelector('#containerServicosOS > div:last-child');
      if (!row) return;
      const descEl = row.querySelector('.serv-desc');
      if (descEl) descEl.value = desc;
      const achados = typeof W.tempaBuscarPorTexto === 'function' ? (W.tempaBuscarPorTexto(desc, { limite:3, preciso:true }) || []) : [];
      const it = achados[0];
      if (it) {
        row.dataset.codigoTabela = it.codigo || it.cod || '';
        row.dataset.sistemaTabela = it.sistema || it.grupo || '';
        const tempo = row.querySelector('.serv-tempo'); if (tempo && (it.tempo || it.tmo)) tempo.value = String(it.tempo || it.tmo).replace('.', ',');
        const servDesc = row.querySelector('.serv-desc'); if (servDesc && it.item) servDesc.value = it.item;
      }
    });
    W.calcOSTotal?.();
    toast(`${sugestoes.length} servico(s) sugerido(s) sem apagar o orcamento atual.`, 'ok');
  };

  function extendIALocal() {
    if (W.thiaResponderLocal?._hardeningLocal) return;
    const old = W.thiaResponderLocal;
    W.thiaResponderLocal = function (pergunta) {
      const base = typeof old === 'function' ? old(pergunta) : null;
      if (base) return base;
      const q = norm(pergunta);
      const fin = J().financeiro || [];
      if (/boleto|conta|titulo|duplicata|venc/.test(q) && /hoje/.test(q)) {
        const hoje = todayISO();
        const lista = fin.filter(f => {
          const venc = String(f.venc || f.vencimento || '').slice(0,10);
          const status = norm(f.status);
          const ehBoleto = /(boleto|duplicata|nf|fornecedor|titulo|pagar|receber)/i.test([f.pgto,f.forma,f.desc,f.categoria,f.origem,f.tipo].join(' '));
          return venc === hoje && ehBoleto && !/pago|liquidado|cancelado/.test(status);
        });
        if (!lista.length) return 'Nao ha boleto/duplicata vencendo hoje nos dados carregados deste tenant.';
        const total = lista.reduce((s,f)=>s+num(f.valor),0);
        return `Boletos/duplicatas vencendo hoje (${lista.length}) - total ${moeda(total)}:<br>${lista.slice(0,30).map(f=>`- ${esc(f.desc || f.id)} | ${moeda(f.valor)} | ${esc(f.fornecedorNome || f.clienteNome || f.vinculo || '-')} | status ${esc(f.status || 'Aberto')}`).join('<br>')}`;
      }
      if (/vencid|atrasad/.test(q) && /boleto|conta|titulo|duplicata|financeiro/.test(q)) {
        const hoje = todayISO();
        const lista = fin.filter(f => {
          const venc = String(f.venc || f.vencimento || '').slice(0,10);
          const status = norm(f.status);
          return venc && venc < hoje && !/pago|liquidado|cancelado/.test(status);
        });
        if (!lista.length) return 'Nao ha titulo vencido nos dados carregados deste tenant.';
        const total = lista.reduce((s,f)=>s+num(f.valor),0);
        return `Titulos vencidos (${lista.length}) - total ${moeda(total)}:<br>${lista.slice(0,30).map(f=>`- ${esc(f.desc || f.id)} | ${moeda(f.valor)} | venc. ${esc(f.venc || f.vencimento || '-')} | ${esc(f.fornecedorNome || f.clienteNome || f.vinculo || '-')}`).join('<br>')}`;
      }
      if (/resumo|contexto|dados.*oficina|tenant|oficina/.test(q) && /oficina|tenant|dados|geral|completo|resumo/.test(q)) {
        const estoqueCritico = (J().estoque || []).filter(p => num(p.qtd) <= num(p.min || p.minimo));
        const abertas = (J().os || []).filter(o => !/entreg|cancel|recus|finaliz/i.test(String(o.status || '')));
        return `Resumo local do tenant ${esc(J().tid || '-')}:<br>- O.S. carregadas: ${(J().os || []).length} (${abertas.length} abertas)<br>- Clientes: ${(J().clientes || []).length}<br>- Veiculos: ${(J().veiculos || []).length}<br>- Estoque: ${(J().estoque || []).length} itens (${estoqueCritico.length} criticos)<br>- Financeiro: ${fin.length} lancamentos<br>- NFs: ${(J().notasFiscaisEntrada || []).length}<br>- Vinculos NF/O.S.: ${(J().nfItensVinculos || []).length}<br>- Pacotes de boletos: ${(J().pacotesBoletos || []).length}`;
      }
      if (/pix|parcel/.test(q)) {
        const suspeitos = fin.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (/\(\d+\/\d+\)/.test(String(f.desc || '')) || num(f.pgtoParcelas) > 1));
        if (suspeitos.length) return `Encontrei possivel inconsistencia: recebimento PIX parcelado em ${suspeitos.length} lancamento(s).<br>${suspeitos.slice(0,12).map(f=>`- ${esc(f.desc||'-')} | ${moeda(f.valor)} | ${esc(f.venc||'')}`).join('<br>')}<br><br>Regra correta: PIX/Dinheiro/Debito sempre 1 lancamento pago.`;
        return 'Nao encontrei PIX parcelado nos dados carregados.';
      }
      if (/nota fiscal|\bnf\b|xml|fornecedor/.test(q)) {
        const docs = (J().notasFiscaisEntrada || []).filter(n => !q || norm([n.numero,n.chave,n.fornecedorSnapshot?.nome,n.fornecedorNome].join(' ')).includes(q.replace(/\bnf\b/g,'').trim()) || /nota fiscal|\bnf\b|xml/.test(q));
        if (!docs.length) return 'Nao ha nota fiscal carregada/localizada para essa pergunta.';
        return `Notas fiscais carregadas:<br>${docs.slice(0,15).map(n=>`- NF ${esc(n.numero||'-')} | ${esc(n.fornecedorSnapshot?.nome||n.fornecedorNome||'-')} | ${esc(n.dataNF||'-')} | ${moeda(n.totalNF||n.totalItens||0)} | ${(n.itens||[]).length} item(ns)`).join('<br>')}`;
      }
      if (/pacote.*boleto|boletos.*pacote/.test(q)) {
        const pac = J().pacotesBoletos || [];
        if (!pac.length) return 'Nao ha pacote de boletos criado.';
        return `Pacotes de boletos:<br>${pac.slice(0,15).map(p=>`- ${esc(p.numero||p.id)} | ${esc(p.fornecedorNome||'-')} | ${esc(p.inicio||'-')} a ${esc(p.fim||'-')} | ${moeda(p.total||0)} | ${(p.titulos||[]).length} titulo(s)`).join('<br>')}`;
      }
      if (/onde.*peca|historico.*peca|estoque.*peca|usada/.test(q)) {
        const termo = q.replace(/onde|peca|peça|historico|estoque|usada|foi|em|qual/g,'').trim();
        const vinc = (J().nfItensVinculos || []).filter(v => norm([v.desc,v.codigo,v.codigoFornecedor,v.codigoComercial,v.placa,v.nfNumero].join(' ')).includes(termo));
        if (!vinc.length) return 'Nao ha vinculo de peca localizado nos dados carregados.';
        return `Vinculos encontrados:<br>${vinc.slice(0,20).map(v=>`- ${esc(v.codigo||v.codigoFornecedor||'')} ${esc(v.desc||'-')} | NF ${esc(v.nfNumero||'-')} | ${esc(destinoFiscalResumo(v))} | baixa auto: ${v.estoqueBaixadoAutomatico?'sim':'nao'}`).join('<br>')}`;
      }
      if (/ajuda|o que voce|o que consegue|comandos/.test(q)) {
        return 'Posso responder localmente sobre: boletos vencendo hoje, contas vencidas, estoque critico, O.S. por placa, notas fiscais importadas, pacotes de boletos, vinculos de pecas por NF/O.S., historico tecnico e inconsistencias de PIX parcelado. Quando faltar contexto, vou pedir placa, modelo, periodo ou cliente.';
      }
      return null;
    };
    W.thiaResponderLocal._hardeningLocal = true;
  }

  function isPixParceladoInconsistente(f) {
    const status = norm(f?.status);
    if (/cancel|estorn/.test(status)) return false;
    const forma = String(f?.pgto || f?.forma || f?.formaPagamento || '').toLowerCase();
    const desc = String(f?.desc || f?.descricao || '');
    return /pix/.test(forma) && (/\(\d+\s*\/\s*\d+\)/.test(desc) || num(f?.pgtoParcelas || f?.parcelas || 1) > 1);
  }

  function descSemMarcadorParcela(f) {
    return String(f?.desc || f?.descricao || '')
      .replace(/\s*\(\d+\s*\/\s*\d+\)\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function ordemParcelaPix(f) {
    const m = String(f?.desc || f?.descricao || '').match(/\((\d+)\s*\/\s*\d+\)/);
    return m ? parseInt(m[1], 10) || 999 : 999;
  }

  function chaveGrupoPixParcelado(f) {
    if (f?.notaFiscalId) return 'nf:' + f.notaFiscalId;
    if (f?.chaveNFe) return 'chave:' + f.chaveNFe;
    if (f?.osId) return 'os:' + f.osId;
    return 'desc:' + norm(descSemMarcadorParcela(f));
  }

  function grupoPixParcelado(f) {
    const chave = chaveGrupoPixParcelado(f);
    return (J().financeiro || [])
      .filter(x => isPixParceladoInconsistente(x) && chaveGrupoPixParcelado(x) === chave)
      .sort((a,b) => ordemParcelaPix(a) - ordemParcelaPix(b));
  }

  function installAuditoriaFinanceiraLocal() {
    W.thiaListarPixParcelado = function () {
      const lista = (J().financeiro || []).filter(isPixParceladoInconsistente);
      console.table(lista.map(f => ({
        id: f.id,
        desc: f.desc || f.descricao || '',
        valor: num(f.valor || 0),
        venc: f.venc || f.vencimento || '',
        status: f.status || '',
        pgto: f.pgto || f.forma || f.formaPagamento || '',
        parcelas: f.pgtoParcelas || f.parcelas || '',
        grupo: chaveGrupoPixParcelado(f),
        comando: `thiaCorrigirPixParcelado("${f.id}")`
      })));
      return lista;
    };
    W.thiaCorrigirPixParcelado = async function (id, motivo) {
      if (!id || !db()) { toast('Informe o ID do lancamento financeiro.', 'warn'); return false; }
      const f = (J().financeiro || []).find(x => x.id === id);
      if (!f) { toast('Lancamento nao encontrado nos dados carregados.', 'warn'); return false; }
      if (!isPixParceladoInconsistente(f)) { toast('Este lancamento nao parece PIX parcelado.', 'warn'); return false; }
      motivo = motivo || prompt('Motivo da correcao do PIX parcelado:', 'Correcao de inconsistencia: PIX nao deve gerar parcelas') || '';
      if (!motivo.trim()) { toast('Motivo obrigatorio para auditoria.', 'warn'); return false; }
      const grupo = grupoPixParcelado(f);
      const manter = grupo.find(x => ordemParcelaPix(x) === 1) || f;
      const cancelar = grupo.filter(x => x.id !== manter.id);
      const totalGrupo = grupo.reduce((s,x) => s + num(x.valor || 0), 0) || num(f.valor || 0);
      const descLimpa = descSemMarcadorParcela(manter) || descSemMarcadorParcela(f);
      const patch = {
        desc: descLimpa || f.desc || '',
        valor: totalGrupo,
        status: 'Pago',
        pgtoParcelas: 1,
        parcelas: 1,
        inconsistenciaFinanceiraCorrigida: true,
        pixParceladoConsolidado: grupo.length > 1,
        pixParceladoIdsConsolidados: grupo.map(x => x.id).filter(Boolean),
        corrigidoEm: new Date().toISOString(),
        corrigidoPor: J().nome || 'Jarvis',
        motivoCorrecao: motivo,
        updatedAt: new Date().toISOString()
      };
      await db().collection('financeiro').doc(manter.id).update(patch);
      Object.assign(manter, patch);
      for (const item of cancelar) {
        const cancelPatch = {
          status: 'Cancelado',
          canceladoPorConsolidacaoPixParcelado: true,
          pixParceladoConsolidadoEm: manter.id,
          valorAntesCancelamento: num(item.valor || 0),
          motivoCancelamento: motivo,
          updatedAt: new Date().toISOString()
        };
        await db().collection('financeiro').doc(item.id).update(cancelPatch);
        Object.assign(item, cancelPatch);
      }
      try {
        await db().collection('auditoria').add({
          tenantId: J().tid,
          usuario: J().nome || 'Jarvis',
          perfil: J().role || '',
          acao: 'correcao_pix_parcelado',
          entidade: 'financeiro',
          entidadeId: manter.id,
          antes: grupo,
          depois: { mantido: manter.id, atualizado: patch, cancelados: cancelar.map(x => x.id) },
          motivo,
          createdAt: new Date().toISOString(),
          ts: Date.now()
        });
      } catch (_) {}
      toast(`PIX corrigido com auditoria: ${grupo.length} lancamento(s) consolidado(s).`, 'ok');
      return true;
    };
    W.thiaCorrigirTodosPixParcelado = async function (motivo) {
      const lista = (J().financeiro || []).filter(isPixParceladoInconsistente);
      if (!lista.length) { toast('Nenhum PIX parcelado encontrado.', 'ok'); return 0; }
      motivo = motivo || prompt('Motivo da correcao em lote do PIX parcelado:', 'Correcao em lote: PIX nao deve gerar parcelas') || '';
      if (!motivo.trim()) { toast('Motivo obrigatorio para auditoria.', 'warn'); return 0; }
      const grupos = [];
      const vistos = new Set();
      lista.forEach(f => {
        const chave = chaveGrupoPixParcelado(f);
        if (vistos.has(chave)) return;
        vistos.add(chave);
        grupos.push(f.id);
      });
      for (const pixId of grupos) await W.thiaCorrigirPixParcelado(pixId, motivo);
      return grupos.length;
    };
  }

  function tick() {
    installCSS();
    wrapNFOpeners();
    ensureNFBatchTools();
    overrideAprovacaoOS();
    overrideHistoricoOS();
    installFiscalListeners();
    installDocsFiscaisPanel();
    installPacotesPanel();
    instalarConsultaServicosTerceirizadosFinanceiro();
    wrapToggleFinanceiroAgrupado();
    overrideEstoqueFornecedores();
    wrapSalvarOS();
    installOrcamentoAuto();
    extendIALocal();
    installAuditoriaFinanceiraLocal();
    W.thiaApplyModuleVisibility?.(D);
  }

  D.addEventListener('DOMContentLoaded', function () {
    tick();
    if (!W.__THIA_HARDENING_MAINTENANCE_V2613__) {
      W.__THIA_HARDENING_MAINTENANCE_V2613__ = setInterval(() => {
        if (D.hidden) return;
        if (J().tid && !W._hardeningFiscalListeners) installFiscalListeners();
        if (byId('s-estoque')?.classList.contains('active')) ensureNFBatchTools();
        if (byId('modalOS')?.classList.contains('open') && !W.thiaRuntimeCore?.activeEditor?.('#modalOS')) installOrcamentoAuto();
      }, 5000);
    }
  }, { once:true });
})();
