/*
 * thIAguinho SaaS V26.6
 * Pesquisa fiscal por peça/destino + IA de vínculos/auditoria
 * + Tabela Tempária automática somente para cliente oficial.
 *
 * Camada aditiva: não substitui O.S., NF, estoque, financeiro ou auditoria.
 * Powered by thIAguinho Soluções Digitais
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const J = () => W.J || {};
  const byId = id => D.getElementById(id);

  function norm(v) {
    return String(v == null ? '' : v)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function compact(v) { return norm(v).replace(/\s+/g, ''); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
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
  function dataISO(v) {
    const raw = String(v || '');
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
    } catch (_) {}
    return '';
  }
  function dataBR(v) {
    const iso = dataISO(v);
    if (!iso) return '-';
    const [a,m,d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }
  function code(v) { return compact(v).replace(/[^a-z0-9]/g, ''); }
  function plate(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  // ─────────────────────────────────────────────────────────────
  // TABELA TEMPÁRIA: automática somente para cliente oficial
  // ─────────────────────────────────────────────────────────────
  function clienteOficialOS() {
    try {
      if (typeof W._osClienteGovernamental === 'function' && W._osClienteGovernamental()) return true;
    } catch (_) {}
    const cliId = String(byId('osCliente')?.value || '').trim();
    const cli = (J().clientes || []).find(c => String(c.id) === cliId) || {};
    const tipo = norm(cli.tipoCliente || cli.clienteTipo || '');
    return tipo === 'governo' || tipo === 'oficial' || cli.clienteOficial === true || cli.governamental === true;
  }

  function setTempaElementVisible(el, visible) {
    if (!el) return;
    if (el.dataset.v266Display === undefined) el.dataset.v266Display = el.style.display || '';
    el.style.display = visible ? el.dataset.v266Display : 'none';
  }

  function limparTempaOSComum() {
    D.querySelectorAll('#modalOS .tempa-inline-box').forEach(el => el.remove());
    D.querySelectorAll('#modalOS .serv-tempa-resultados-list').forEach(el => {
      el.innerHTML = '';
      el.style.display = 'none';
    });
    D.querySelectorAll('#modalOS .serv-tempa-busca,#modalOS .serv-tempa-aplicar,#modalOS [onclick*="_ciliaPesquisarTempaServico"]').forEach(el => {
      setTempaElementVisible(el, false);
    });
  }

  function atualizarVisibilidadeTempaOS() {
    const oficial = clienteOficialOS();
    const btn = D.querySelector('#modalOS [onclick*="_tempaSugerir"]');
    setTempaElementVisible(btn, oficial);
    D.querySelectorAll('#modalOS .serv-tempa-busca,#modalOS .serv-tempa-aplicar,#modalOS [onclick*="_ciliaPesquisarTempaServico"]').forEach(el => {
      setTempaElementVisible(el, oficial);
    });
    if (!oficial) limparTempaOSComum();
    D.body.dataset.tempaOsOficial = oficial ? 'on' : 'off';
  }

  function wrapTempa(name, handler) {
    const old = W[name];
    if (typeof old !== 'function' || old.__v266Oficial) return;
    const wrapped = function () {
      if (!clienteOficialOS()) {
        limparTempaOSComum();
        return handler ? handler.apply(this, arguments) : null;
      }
      return old.apply(this, arguments);
    };
    wrapped.__v266Oficial = true;
    wrapped.__original = old;
    W[name] = wrapped;
  }

  function instalarGuardasTempa() {
    wrapTempa('tempaSugerirInlineOS');
    wrapTempa('_tempaSugerir', function () {
      W.toast?.('Tabela Tempária é usada na O.S. somente para cliente oficial.', 'warn');
      return null;
    });
    wrapTempa('_ciliaAgendarBuscaTempaServico');
    wrapTempa('_ciliaPesquisarTempaServico', function () {
      W.toast?.('Busca Tempária disponível somente para cliente oficial.', 'warn');
      return null;
    });
    wrapTempa('_ciliaAplicarTempaSelecionada');

    const runtime = W.ThiaRuntimeCoreV2613;
    const scheduleVisibility = () => {
      if (runtime?.scheduleDom) runtime.scheduleDom('temparia-visibility-v266', atualizarVisibilidadeTempaOS, { delay:40, maxRetries:4 });
      else setTimeout(atualizarVisibilidadeTempaOS, 40);
    };
    const cli = byId('osCliente');
    if (cli && !cli.dataset.v266Tempa) {
      cli.dataset.v266Tempa = '1';
      if (runtime?.addEventOnce) runtime.addEventOnce(cli, 'change', 'temparia-v266', scheduleVisibility);
      else cli.addEventListener('change', scheduleVisibility);
    }
    const modal = byId('modalOS');
    if (modal && !modal._v266TempaObserver) {
      modal._v266TempaObserver = new MutationObserver(mutations => {
        const relevant = mutations.some(m => m.type === 'attributes' || Array.from(m.addedNodes || []).some(node =>
          node?.nodeType === 1 && (node.matches?.('#osCliente, [data-temparia], .tempa') || node.querySelector?.('#osCliente, [data-temparia], .tempa'))
        ));
        if (relevant) scheduleVisibility();
      });
      modal._v266TempaObserver.observe(modal, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    }
    atualizarVisibilidadeTempaOS();
  }

  // ─────────────────────────────────────────────────────────────
  // PESQUISA DE PEÇAS NAS NOTAS FISCAIS
  // ─────────────────────────────────────────────────────────────
  function destinationsOfItem(item) {
    const arr = Array.isArray(item?.destinosOperacionais) ? item.destinosOperacionais
      : (Array.isArray(item?.destinos) ? item.destinos : []);
    return arr.length ? arr : [item || {}];
  }

  function sameNF(v, n) {
    if (!v || !n) return false;
    if (v.nfId && n.id && String(v.nfId) === String(n.id)) return true;
    if (v.chave && n.chave && String(v.chave) === String(n.chave)) return true;
    if (v.nfNumero && n.numero && String(v.nfNumero) === String(n.numero)) return true;
    return false;
  }

  function linkMatchesItem(v, item, index) {
    const itemIndex = item?.itemFiscalIndex ?? item?.itemIndex ?? index;
    const vincIndex = v?.itemFiscalIndex ?? v?.itemIndex;
    if (vincIndex !== undefined && vincIndex !== null && vincIndex !== '' && itemIndex !== undefined && itemIndex !== null && itemIndex !== '' && String(vincIndex) === String(itemIndex)) return true;
    const numeroItem = item?.numeroItem ?? item?.nItem ?? item?.item;
    const vincNumeroItem = v?.numeroItem ?? v?.nItem ?? v?.item;
    if (numeroItem !== undefined && numeroItem !== null && numeroItem !== '' && vincNumeroItem !== undefined && vincNumeroItem !== null && vincNumeroItem !== '' && String(numeroItem) === String(vincNumeroItem)) return true;
    const itemKeys = [
      item?.nfItemKey, item?.itemNFKey, item?.origemNFItemKey, item?.vinculoKey,
      item?.destinoKey, item?.id
    ].filter(Boolean).map(String);
    const vincKeys = [
      v?.nfItemKey, v?.itemNFKey, v?.origemNFItemKey, v?.vinculoKey,
      v?.destinoKey, v?.itemId
    ].filter(Boolean).map(String);
    if (itemKeys.length && vincKeys.some(x => itemKeys.includes(x))) return true;
    if (Number.isFinite(Number(v?.itemIndex)) && Number(v.itemIndex) === Number(index)) return true;
    const ci = code(item?.codigoFornecedor || item?.codigo || item?.codigoComercial || item?.oem || '');
    const cv = code(v?.codigoFornecedor || v?.codigo || v?.codigoComercial || v?.oem || '');
    if (ci && cv && ci === cv) return true;
    const di = norm(item?.descricao || item?.desc || '');
    const dv = norm(v?.descricao || v?.desc || '');
    return !!(di && dv && (di === dv || (di.length > 8 && (di.includes(dv) || dv.includes(di)))));
  }

  function rawDestination(obj) {
    return norm([
      obj?.destino, obj?.finalidade, obj?.tipo, obj?.vinculo, obj?.observacao,
      obj?.obs, obj?.motivo, obj?.status, obj?.statusVinculo
    ].filter(Boolean).join(' '));
  }

  function classifyDestination(item, links) {
    const all = destinationsOfItem(item).concat(links || []);
    const raw = norm(all.map(rawDestination).join(' '));
    const set = new Set();
    if (/garantia/.test(raw)) set.add('garantia');
    if (/uso interno|interno|manutencao oficina|consumo interno/.test(raw)) set.add('uso_interno');
    if (/devolucao|devolvido/.test(raw) || item?.devolvido) set.add('devolucao');
    if (/venda|saida cliente|autopeca/.test(raw)) set.add('venda');
    if (/outro/.test(raw)) set.add('outro');
    if (all.some(x => ['os','placa'].includes(String(x?.destino || x?.finalidade || '').toLowerCase())) ||
        (links || []).some(x => x?.osId || x?.placa)) set.add('os');
    if (all.some(x => String(x?.destino || x?.finalidade || '').toLowerCase() === 'estoque')) set.add('estoque');
    if (!set.size) {
      if ((links || []).length) {
        if ((links || []).some(x => x?.estoqueBaixadoAutomatico)) set.add('os');
        else set.add('outro');
      } else {
        set.add('sem_vinculo');
      }
    }
    return Array.from(set);
  }

  function classifyStatus(item, links) {
    const raw = norm([item?.status, item?.statusVinculo, ...(links || []).flatMap(v => [v.status, v.statusVinculo])].join(' '));
    if (/cancelad|excluid|estornad/.test(raw)) return 'cancelado';
    if (/devolvid/.test(raw) || item?.devolvido || (links || []).some(v => v.devolvido)) return 'devolvido';
    if ((links || []).some(v => v.estoqueBaixadoAutomatico) || /baixad|aplicad|trocad|executad/.test(raw)) return 'baixado';
    return raw ? 'ativo' : 'sem_status';
  }

  function stockFor(item, stockIndex) {
    const ci = code(item?.codigoFornecedor || item?.codigo || item?.codigoComercial || item?.oem || '');
    const di = norm(item?.descricao || item?.desc || '');
    if (stockIndex) {
      if (ci && stockIndex.byCode.has(ci)) return stockIndex.byCode.get(ci);
      if (di && stockIndex.byDesc.has(di)) return stockIndex.byDesc.get(di);
      return null;
    }
    return (J().estoque || []).find(p => {
      const cp = code(p.codigo || p.codigoFornecedor || p.codigoComercial || p.oem || '');
      if (ci && cp && ci === cp) return true;
      const dp = norm(p.desc || p.descricao || '');
      return !!(di && dp && di === dp);
    }) || null;
  }

  function activeFiscalLink(v) {
    const raw = norm([v?.status, v?.situacao, v?.statusVinculo].filter(Boolean).join(' '));
    return !/cancelad|excluid|estornad|devolvid/.test(raw);
  }

  const fiscalRecordsCacheV270 = { notesRef:null, linksRef:null, stockRef:null, notesLen:-1, linksLen:-1, stockLen:-1, records:[] };
  let fiscalPieceLimitV270 = 80;
  let fiscalFilterSignatureV270 = '';
  let fiscalRenderTimerV270 = null;

  function invalidateFiscalRecordsCacheV270() {
    fiscalRecordsCacheV270.notesRef = null;
    fiscalRecordsCacheV270.linksRef = null;
    fiscalRecordsCacheV270.stockRef = null;
    fiscalRecordsCacheV270.notesLen = -1;
    fiscalRecordsCacheV270.linksLen = -1;
    fiscalRecordsCacheV270.stockLen = -1;
    fiscalRecordsCacheV270.records = [];
  }

  function buildStockIndexV270(stock) {
    const byCode = new Map();
    const byDesc = new Map();
    (stock || []).forEach(p => {
      /* Preserva exatamente a precedência original de código do stockFor(). */
      const k = code(p?.codigo || p?.codigoFornecedor || p?.codigoComercial || p?.oem || '');
      if (k && !byCode.has(k)) byCode.set(k,p);
      const d = norm(p?.desc || p?.descricao || '');
      if (d && !byDesc.has(d)) byDesc.set(d,p);
    });
    return { byCode, byDesc };
  }

  function buildLinkIndexV270(links) {
    const byId = new Map(), byKey = new Map(), byNumber = new Map();
    const add = (map, key, value) => {
      const k = String(key || '');
      if (!k) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(value);
    };
    (links || []).forEach(v => {
      if (!activeFiscalLink(v)) return;
      add(byId, v?.nfId, v);
      add(byKey, v?.chave, v);
      add(byNumber, v?.nfNumero, v);
    });
    return { byId, byKey, byNumber };
  }

  function linksForNoteV270(note, index) {
    const found = [];
    const seen = new Set();
    const add = list => (list || []).forEach(v => { if (!seen.has(v)) { seen.add(v); found.push(v); } });
    add(index.byId.get(String(note?.id || '')));
    add(index.byKey.get(String(note?.chave || '')));
    add(index.byNumber.get(String(note?.numero || '')));
    return found;
  }

  function buildFiscalPieceRecords(force) {
    const state = J();
    const notes = Array.isArray(state.notasFiscaisEntrada) ? state.notasFiscaisEntrada : [];
    const linksSource = Array.isArray(state.nfItensVinculos) ? state.nfItensVinculos : [];
    const stock = Array.isArray(state.estoque) ? state.estoque : [];
    const cached = !force &&
      fiscalRecordsCacheV270.notesRef === notes && fiscalRecordsCacheV270.linksRef === linksSource && fiscalRecordsCacheV270.stockRef === stock &&
      fiscalRecordsCacheV270.notesLen === notes.length && fiscalRecordsCacheV270.linksLen === linksSource.length && fiscalRecordsCacheV270.stockLen === stock.length;
    if (cached) return fiscalRecordsCacheV270.records;

    const linkIndex = buildLinkIndexV270(linksSource);
    const stockIndex = buildStockIndexV270(stock);
    const out = [];
    notes.forEach(n => {
      const nfLinks = linksForNoteV270(n, linkIndex);
      (n.itens || []).forEach((item, index) => {
        const links = nfLinks.filter(v => linkMatchesItem(v, item, index));
        const destinations = classifyDestination(item, links);
        const st = stockFor(item, stockIndex);
        const placas = [...new Set(links.map(v => plate(v.placa)).filter(Boolean))];
        const osIds = [...new Set(links.map(v => v.osNumero || v.osId).filter(Boolean).map(String))];
        out.push({
          id: `${n.id || n.numero || 'nf'}:${index}`,
          nfId:n.id || '', nfNumero:n.numero || '', chave:n.chave || '',
          fornecedor:n.fornecedorSnapshot?.nome || n.fornecedorNome || '',
          data:dataISO(n.dataNF || n.createdAt || n.updatedAt),
          codigo:item.codigoFornecedor || item.codigo || item.codigoComercial || item.oem || '',
          codigoAlt:item.codigoComercial || item.oem || '',
          descricao:item.descricao || item.desc || '',
          marca:item.marca || '',
          quantidade:num(item.quantidadeOperacional ?? item.quantidade ?? item.qtd ?? 1),
          custo:num(item.valorUnitario ?? item.custo ?? 0),
          destinations,
          status:classifyStatus(item, links),
          placas, osIds, links,
          estoqueId:st?.id || '',
          saldoEstoque:st ? num(st.qtd ?? st.quantidade ?? st.saldo ?? 0) : null,
          estoqueEncontrado:!!st,
          item, nota:n
        });
      });
    });
    Object.assign(fiscalRecordsCacheV270, { notesRef:notes, linksRef:linksSource, stockRef:stock, notesLen:notes.length, linksLen:linksSource.length, stockLen:stock.length, records:out });
    return out;
  }

  function scheduleFiscalPiecesV270(delay) {
    clearTimeout(fiscalRenderTimerV270);
    fiscalRenderTimerV270 = setTimeout(() => renderFiscalPieces(), Number(delay ?? 160));
  }

  const DEST_LABEL = {
    estoque:'Estoque', os:'O.S./veículo', garantia:'Garantia', uso_interno:'Uso interno',
    venda:'Venda/saída', devolucao:'Devolução', outro:'Outros', sem_vinculo:'Sem vínculo'
  };
  const STATUS_LABEL = { ativo:'Ativo', baixado:'Baixado/aplicado', devolvido:'Devolvido', cancelado:'Cancelado/estornado', sem_status:'Sem status' };

  function ensureFiscalUI() {
    const panel = byId('docsFiscaisPanel');
    if (!panel || byId('fiscalPecasV266')) return;
    const body = panel.querySelector('.j-card-body');
    if (!body) return;
    const box = D.createElement('div');
    box.id = 'fiscalPecasV266';
    box.innerHTML = `
      <style>
        #fiscalPecasV266{margin:12px 0;border:1px solid rgba(0,212,255,.22);border-radius:5px;padding:12px;background:rgba(0,212,255,.035)}
        .fp-v266-title{font-family:var(--fd);font-weight:800;color:var(--cyan);letter-spacing:.7px;margin-bottom:9px}
        .fp-v266-filters{display:grid;grid-template-columns:minmax(220px,1.6fr) repeat(4,minmax(145px,.7fr)) auto;gap:8px;align-items:end}
        .fp-v266-results{display:grid;gap:8px;margin-top:10px}
        .fp-v266-card{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(240px,1.5fr) minmax(150px,.7fr) minmax(150px,.7fr);gap:10px;border:1px solid var(--border);border-radius:4px;padding:10px;background:var(--surf2);min-width:0}
        .fp-v266-card>*{min-width:0;overflow-wrap:anywhere}
        .fp-v266-label{font-family:var(--fm);font-size:.58rem;color:var(--muted);letter-spacing:.7px;text-transform:uppercase}
        .fp-v266-value{font-size:.76rem;margin-top:3px}
        .fp-v266-chip{display:inline-block;border:1px solid rgba(0,212,255,.28);border-radius:3px;padding:2px 6px;margin:2px 3px 2px 0;font-family:var(--fm);font-size:.58rem;color:var(--cyan)}
        .fp-v266-summary{font-family:var(--fm);font-size:.66rem;color:var(--muted);margin-top:9px}
        @media(max-width:1050px){.fp-v266-filters{grid-template-columns:1fr 1fr 1fr}.fp-v266-card{grid-template-columns:1fr 1fr}}
        @media(max-width:650px){.fp-v266-filters,.fp-v266-card{grid-template-columns:1fr}.fp-v266-filters .btn-ghost{width:100%}#fiscalPecasV266{padding:9px}}
      </style>
      <div class="fp-v266-title">🔎 PESQUISA DE PEÇAS DAS NOTAS FISCAIS</div>
      <div class="fp-v266-filters">
        <div><label class="j-label">Peça, código, NF, fornecedor, placa ou O.S.</label><input class="j-input" id="fiscalPecaBuscaV266" placeholder="Ex.: OC90, filtro, NF 123, ABC1D23" oninput="window.agendarRenderFiscalPecasV270()"></div>
        <div><label class="j-label">Destino</label><select class="j-select" id="fiscalPecaDestinoV266" onchange="window.renderFiscalPecasV266()">
          <option value="">Todos os destinos</option><option value="estoque">Com estoque</option><option value="os">Vinculada a O.S./veículo</option>
          <option value="garantia">Garantia</option><option value="uso_interno">Uso interno</option><option value="venda">Venda/saída</option>
          <option value="devolucao">Devolução</option><option value="outro">Outros</option><option value="sem_vinculo">Sem vínculo</option>
        </select></div>
        <div><label class="j-label">Status</label><select class="j-select" id="fiscalPecaStatusV266" onchange="window.renderFiscalPecasV266()">
          <option value="">Todos</option><option value="ativo">Ativo</option><option value="baixado">Baixado/aplicado</option>
          <option value="devolvido">Devolvido</option><option value="cancelado">Cancelado/estornado</option><option value="sem_status">Sem status</option>
        </select></div>
        <div><label class="j-label">Data inicial</label><input type="date" class="j-input" id="fiscalPecaInicioV266" onchange="window.renderFiscalPecasV266()"></div>
        <div><label class="j-label">Data final</label><input type="date" class="j-input" id="fiscalPecaFimV266" onchange="window.renderFiscalPecasV266()"></div>
        <button type="button" class="btn-ghost" onclick="window.limparFiscalPecasV266()">LIMPAR</button>
      </div>
      <div class="fp-v266-summary" id="fiscalPecaResumoV266">Aguardando dados fiscais...</div>
      <div class="fp-v266-results" id="fiscalPecaResultadosV266"></div>`;
    const tableWrap = body.querySelector('.op-table-wrap');
    if (tableWrap) body.insertBefore(box, tableWrap); else body.appendChild(box);
    renderFiscalPieces();
  }

  function filterFiscalRecords(records, filters) {
    const q = norm(filters?.q || '');
    const dest = filters?.dest || '';
    const status = filters?.status || '';
    const ini = filters?.ini || '';
    const fim = filters?.fim || '';
    return records.filter(r => {
      if (dest && !r.destinations.includes(dest)) return false;
      if (status && r.status !== status) return false;
      if (ini && (!r.data || r.data < ini)) return false;
      if (fim && (!r.data || r.data > fim)) return false;
      if (q) {
        const hay = norm([
          r.nfNumero,r.chave,r.fornecedor,r.codigo,r.codigoAlt,r.descricao,r.marca,
          r.destinations.join(' '),r.status,r.placas.join(' '),r.osIds.join(' ')
        ].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function currentFiscalFilters() {
    return {
      q:byId('fiscalPecaBuscaV266')?.value || '',
      dest:byId('fiscalPecaDestinoV266')?.value || '',
      status:byId('fiscalPecaStatusV266')?.value || '',
      ini:byId('fiscalPecaInicioV266')?.value || '',
      fim:byId('fiscalPecaFimV266')?.value || ''
    };
  }

  function renderFiscalPieces() {
    ensureFiscalUI();
    const target = byId('fiscalPecaResultadosV266');
    const summary = byId('fiscalPecaResumoV266');
    if (!target || !summary) return;
    const filters = currentFiscalFilters();
    const signature = `${norm(filters.q)}|${filters.dest}|${filters.status}|${filters.ini}|${filters.fim}`;
    if (signature !== fiscalFilterSignatureV270) {
      fiscalFilterSignatureV270 = signature;
      fiscalPieceLimitV270 = 80;
    }
    const all = buildFiscalPieceRecords();
    const filtered = filterFiscalRecords(all, filters);
    const totalQtd = filtered.reduce((s,r)=>s+r.quantidade,0);
    const visible = filtered.slice(0, Math.max(80, fiscalPieceLimitV270));
    summary.textContent = `${filtered.length} peça(s) localizada(s) · quantidade ${totalQtd.toLocaleString('pt-BR')} · exibindo ${visible.length} de ${filtered.length}.`;
    target.innerHTML = visible.map(r => `
      <div class="fp-v266-card">
        <div>
          <div class="fp-v266-label">Nota fiscal</div><div class="fp-v266-value"><b>NF ${esc(r.nfNumero || '-')}</b><br>${esc(r.fornecedor || '-')}<br><small>${esc(dataBR(r.data))}</small></div>
        </div>
        <div>
          <div class="fp-v266-label">Peça</div><div class="fp-v266-value"><b>${esc(r.codigo || 'S/CÓDIGO')}</b> ${esc(r.descricao || '-')}<br><small>${esc(r.marca || '')}${r.codigoAlt ? ' · ref. ' + esc(r.codigoAlt) : ''}</small></div>
        </div>
        <div>
          <div class="fp-v266-label">Destino / vínculo</div><div class="fp-v266-value">${r.destinations.map(d=>`<span class="fp-v266-chip">${esc(DEST_LABEL[d] || d)}</span>`).join('')}<br><small>${esc(r.placas.join(', ') || '')}${r.osIds.length ? ' · O.S. ' + esc(r.osIds.join(', ')) : ''}</small></div>
        </div>
        <div>
          <div class="fp-v266-label">Quantidade / estoque / status</div><div class="fp-v266-value">Qtd NF: <b>${esc(r.quantidade)}</b> · ${moeda(r.custo)}<br>Saldo atual: <b>${r.estoqueEncontrado ? esc(r.saldoEstoque) : 'não localizado'}</b><br><small>${esc(STATUS_LABEL[r.status] || r.status)}</small></div>
        </div>
      </div>`).join('') || `<div style="padding:16px;text-align:center;color:var(--muted);">Nenhuma peça encontrada com estes filtros.</div>`;
    if (visible.length < filtered.length) {
      target.insertAdjacentHTML('beforeend', `<div style="padding:10px;text-align:center;"><button type="button" class="btn-outline" onclick="window.carregarMaisFiscalPecasV270()">CARREGAR MAIS RESULTADOS (${visible.length}/${filtered.length})</button></div>`);
    }
  }

  W.agendarRenderFiscalPecasV270 = scheduleFiscalPiecesV270;
  W.carregarMaisFiscalPecasV270 = function () { fiscalPieceLimitV270 += 80; renderFiscalPieces(); };
  W.invalidarCacheFiscalPecasV266 = invalidateFiscalRecordsCacheV270;
  W.renderFiscalPecasV266 = renderFiscalPieces;
  W.limparFiscalPecasV266 = function () {
    ['fiscalPecaBuscaV266','fiscalPecaDestinoV266','fiscalPecaStatusV266','fiscalPecaInicioV266','fiscalPecaFimV266'].forEach(id => {
      const el = byId(id); if (el) el.value = '';
    });
    fiscalPieceLimitV270 = 80;
    fiscalFilterSignatureV270 = '';
    renderFiscalPieces();
  };
  W.thiaFiscalPecasV266 = { build:buildFiscalPieceRecords, filter:filterFiscalRecords, labels:DEST_LABEL, invalidate:invalidateFiscalRecordsCacheV270 };

  function hookFiscalRender() {
    const old = W.renderDocsFiscaisHardening;
    if (typeof old !== 'function' || old.__v266Fiscal) return;
    const wrapped = function () {
      const r = old.apply(this, arguments);
      setTimeout(() => { ensureFiscalUI(); renderFiscalPieces(); }, 0);
      return r;
    };
    wrapped.__v266Fiscal = true;
    wrapped.__original = old;
    W.renderDocsFiscaisHardening = wrapped;
  }

  // ─────────────────────────────────────────────────────────────
  // IA: peças fiscais e auditoria
  // ─────────────────────────────────────────────────────────────
  function parseRange(question) {
    const q = String(question || '');
    const yearNow = new Date().getFullYear();
    const found = [...q.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g)].map(m => {
      let y = m[3] ? Number(m[3]) : yearNow;
      if (y < 100) y += 2000;
      return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
    });
    const nq = norm(q);
    if (/hoje/.test(nq)) {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { ini:iso, fim:iso };
    }
    if (/ontem/.test(nq)) {
      const d = new Date(); d.setDate(d.getDate()-1);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { ini:iso, fim:iso };
    }
    return { ini:found[0] || '', fim:found[1] || found[0] || '' };
  }

  function fiscalIntent(q) {
    const n = norm(q);
    return /peca|peça/.test(String(q).toLowerCase()) &&
      /nota fiscal|\bnf\b|vinculad|garantia|uso interno|devolu|sem vinculo|estoque|outro|onde.*usad|destino/.test(n);
  }
  function auditIntent(q) {
    const n = norm(q);
    return /auditoria|log global|quem alterou|quem excluiu|o que foi excluido|acoes? realizadas|historico de alteracao/.test(n);
  }

  function fiscalFiltersFromQuestion(question) {
    const n = norm(question);
    let dest = '';
    if (/garantia/.test(n)) dest='garantia';
    else if (/uso interno|interno/.test(n)) dest='uso_interno';
    else if (/devolu/.test(n)) dest='devolucao';
    else if (/sem vinculo/.test(n)) dest='sem_vinculo';
    else if (/outro/.test(n)) dest='outro';
    else if (/venda|saida/.test(n)) dest='venda';
    else if (/vinculad.*\bos\b|veiculo|placa/.test(n)) dest='os';
    else if (/com estoque|em estoque|estoque/.test(n)) dest='estoque';
    const range = parseRange(question);
    let term = n
      .replace(/\b(pecas?|peca|notas? fiscais?|\bnf\b|vinculadas?|garantia|uso interno|interno|devolucao|devolucoes|sem vinculo|estoque|outros?|destino|onde|foi|usada|usado|com|em|da|do|de|entre|ate|e)\b/g,' ')
      .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,' ')
      .replace(/\s+/g,' ').trim();
    return { q:term, dest, status:'', ini:range.ini, fim:range.fim };
  }

  function answerFiscal(question) {
    const filters = fiscalFiltersFromQuestion(question);
    const list = filterFiscalRecords(buildFiscalPieceRecords(), filters);
    if (!list.length) return 'Não encontrei peça fiscal com esses filtros nos dados carregados da oficina.';
    const totalQtd = list.reduce((s,r)=>s+r.quantidade,0);
    return `<strong>Peças fiscais localizadas (${list.length}):</strong><br>${list.slice(0,25).map(r => {
      const destino = r.destinations.map(d=>DEST_LABEL[d]||d).join(', ');
      const vinc = [r.placas.length ? 'placa ' + r.placas.join(', ') : '', r.osIds.length ? 'O.S. ' + r.osIds.join(', ') : ''].filter(Boolean).join(' · ');
      return `- <strong>${esc(r.codigo || 'S/CÓDIGO')}</strong> ${esc(r.descricao || '-')} | NF ${esc(r.nfNumero || '-')} | ${esc(r.fornecedor || '-')} | ${esc(destino)}${vinc ? ' | ' + esc(vinc) : ''} | qtd ${esc(r.quantidade)} | saldo atual ${r.estoqueEncontrado ? esc(r.saldoEstoque) : 'não localizado'}`;
    }).join('<br>')}<br><br><strong>Quantidade total:</strong> ${esc(totalQtd.toLocaleString('pt-BR'))}`;
  }

  function auditText(a) {
    let extra = '';
    try {
      extra = JSON.stringify({
        motivo:a.motivo, entidade:a.entidade, entidadeId:a.entidadeId, colRef:a.colRef, docIdRef:a.docIdRef,
        dadosAntes:a.dadosAntes, antes:a.antes, depois:a.depois, efeitos:a.efeitos
      });
    } catch (_) {}
    return norm([a.modulo,a.acao,a.usuario,a.perfil,a.role,a.entidade,a.entidadeId,a.colRef,a.docIdRef,a.motivo,extra].join(' '));
  }

  function answerAudit(question) {
    const range = parseRange(question);
    const n = norm(question);
    let terms = n
      .replace(/\b(auditoria|log global|acoes?|acao|realizadas?|quem|alterou|excluiu|o que|foi|historico|de alteracao|entre|ate|hoje|ontem|da|do|de|no|na|os)\b/g,' ')
      .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,' ')
      .replace(/\s+/g,' ').trim();
    const list = (J().auditoria || []).filter(a => {
      const d = dataISO(a.ts || a.createdAt || a.data);
      if (range.ini && (!d || d < range.ini)) return false;
      if (range.fim && (!d || d > range.fim)) return false;
      if (terms && !auditText(a).includes(terms)) return false;
      return true;
    }).sort((a,b)=>String(b.ts||b.createdAt||'').localeCompare(String(a.ts||a.createdAt||'')));
    if (!list.length) return 'Não encontrei ação de auditoria com esses filtros nos dados carregados.';
    return `<strong>Ações de auditoria localizadas (${list.length}):</strong><br>${list.slice(0,30).map(a => {
      const ref = [a.entidade || a.colRef, a.entidadeId || a.docIdRef].filter(Boolean).join(' #');
      return `- ${esc(dataBR(a.ts || a.createdAt))} ${esc(new Date(a.ts || a.createdAt || Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))} | <strong>${esc(a.usuario || 'Sistema')}</strong> | ${esc(a.modulo || '-')} | ${esc(a.acao || '-')}${ref ? ' | ' + esc(ref) : ''}${a.motivo ? ' | motivo: ' + esc(a.motivo) : ''}`;
    }).join('<br>')}`;
  }

  function wrapIA() {
    const old = W.thiaResponderLocalAsync;
    if (typeof old !== 'function' || old.__v266FiscalAudit) return;
    const wrapped = async function (question, opts) {
      if (auditIntent(question)) {
        await Promise.resolve(W.escutarAuditoria?.());
        return answerAudit(question);
      }
      if (fiscalIntent(question)) {
        await Promise.resolve(W.thiaEnsureDataFor?.('estoque'));
        return answerFiscal(question);
      }
      return old.apply(this, arguments);
    };
    wrapped.__v266FiscalAudit = true;
    wrapped.__original = old;
    W.thiaResponderLocalAsync = wrapped;
  }

  function install() {
    if (D.documentElement.dataset.thiaFiscalIATempariaV266 === '1') return;
    instalarGuardasTempa();
    hookFiscalRender();
    ensureFiscalUI();
    wrapIA();
    D.documentElement.dataset.thiaFiscalIATempariaV266 = '1';
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  W.__THIA_V266_FISCAL_IA_TEMPARIA__ = true;
})();
