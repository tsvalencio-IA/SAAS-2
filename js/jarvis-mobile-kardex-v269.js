/**
 * thIAguinho SaaS V26.11 — correção mobile cumulativa do inventário, Kardex e responsividade.
 * Corrige a V26.9 sem alterar Firebase, regras de negócio, notas fiscais, clientes ou fornecedores.
 * Powered by thIAguinho Soluções Digitais.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_JARVIS_INVENTARIO_V2610__) return;
  W.__THIA_JARVIS_INVENTARIO_V2610__ = true;

  const VERSION = '26.11.0';
  const byId = id => D.getElementById(id);
  const num = value => {
    const n = Number(String(value == null ? 0 : value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const norm = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const moeda = value => {
    try { return num(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
    catch (_) { return `R$ ${num(value).toFixed(2).replace('.', ',')}`; }
  };

  function markInventoryCard() {
    const tbody = byId('tbEstoque');
    const card = tbody?.closest?.('.j-card');
    if (!card) return null;
    const section = byId('s-estoque');
    section?.querySelectorAll?.('.j-card-inventario-v2611').forEach(el => {
      if (el !== card) el.classList.remove('j-card-inventario-v2611');
    });
    card.classList.add('j-card-inventario-v2611');
    card.dataset.thiaInventoryCard = '26.11';
    return card;
  }

  function installCSS() {
    markInventoryCard();
    byId('jarvisMobileKardexV269CSS')?.remove();
    if (byId('jarvisInventarioV2610CSS')) return;
    const style = D.createElement('style');
    style.id = 'jarvisInventarioV2610CSS';
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box;}
      .content,.section,.j-card,.j-card-header,.j-card-body{min-width:0!important;max-width:100%!important;}
      .j-input,.j-select,input,select,textarea,button{max-width:100%;}

      /* Grade automática: evita apertar Inventário e Fornecedores em colunas estreitas. */
      #s-estoque>div{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,720px),1fr))!important;
        gap:16px!important;
        align-items:start!important;
        width:100%!important;
        min-width:0!important;
      }
      #s-estoque>div>.j-card{width:100%!important;min-width:0!important;max-width:100%!important;}

      /* Filtros reais do inventário. */
      #estoqueFiltrosV269{
        display:grid;
        grid-template-columns:minmax(240px,1fr) minmax(190px,260px);
        gap:10px;
        padding:12px;
        border-bottom:1px solid var(--border);
        background:rgba(0,212,255,.025);
      }
      #estoqueFiltrosV269 .ef-v269-field{min-width:0;}
      #estoqueFiltrosV269 label{
        display:block;margin-bottom:5px;font-family:var(--fm);font-size:.58rem;
        letter-spacing:1px;text-transform:uppercase;color:var(--muted);
      }
      #estoqueFiltrosV269 input,#estoqueFiltrosV269 select{width:100%!important;min-width:0!important;}
      #estoqueResumoV269{
        grid-column:1/-1;font-family:var(--fm);font-size:.64rem;color:var(--muted);
        line-height:1.45;overflow-wrap:anywhere;
      }
      #tbEstoqueBusca{display:none!important;}
      #estoqueMobileCardsFix,#estoqueMobileV269{display:none!important;}
      .btn-kardex-v269{border-color:rgba(0,212,255,.48)!important;color:var(--cyan)!important;}
      .kardex-highlight-v269{animation:kardexPulseV269 1.7s ease 2;}
      @keyframes kardexPulseV269{
        0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,0);}
        50%{box-shadow:0 0 0 4px rgba(0,212,255,.25),0 0 28px rgba(0,212,255,.18);}
      }

      /* Inventário desktop: tabela inteira cabe na largura disponível. */
      #s-estoque .j-card-inventario-v2611 .j-card-body{overflow-x:hidden!important;}
      #s-estoque .j-card-inventario-v2611 table.j-table{
        display:table!important;width:100%!important;max-width:100%!important;
        min-width:0!important;table-layout:fixed!important;
      }
      #s-estoque .j-card-inventario-v2611 table.j-table>thead{display:table-header-group!important;}
      #s-estoque .j-card-inventario-v2611 #tbEstoque{display:table-row-group!important;width:100%!important;}
      #s-estoque #tbEstoque tr{display:table-row!important;}
      #s-estoque .j-card-inventario-v2611 #tbEstoque td{
        display:table-cell!important;min-width:0!important;max-width:100%!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;
        vertical-align:middle!important;padding:10px 8px!important;
      }
      #s-estoque .j-card-inventario-v2611 th{white-space:normal!important;overflow-wrap:anywhere!important;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(1),#s-estoque #tbEstoque td:nth-child(1){width:12%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(2),#s-estoque #tbEstoque td:nth-child(2){width:28%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(3),#s-estoque #tbEstoque td:nth-child(3){width:10%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(4),#s-estoque #tbEstoque td:nth-child(4){width:10%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(5),#s-estoque #tbEstoque td:nth-child(5){width:6%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(6),#s-estoque #tbEstoque td:nth-child(6){width:6%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(7),#s-estoque #tbEstoque td:nth-child(7){width:10%;}
      #s-estoque .j-card-inventario-v2611 th:nth-child(8),#s-estoque #tbEstoque td:nth-child(8){width:18%;}
      .acoes-estoque-v2610{
        display:grid!important;grid-template-columns:1fr!important;gap:6px!important;
        width:100%!important;min-width:0!important;
      }
      .acoes-estoque-v2610 button{
        width:100%!important;min-width:0!important;max-width:100%!important;
        margin:0!important;padding:7px 5px!important;white-space:normal!important;
        line-height:1.15!important;overflow-wrap:anywhere!important;
      }

      /* Fornecedores: tabela ou cards, nunca conteúdo cortado. */
      .j-card-fornecedores,.j-card-fornecedores .j-card-body{min-width:0!important;max-width:100%!important;overflow:hidden!important;}
      .j-card-fornecedores table.j-table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;}
      .j-card-fornecedores th,.j-card-fornecedores td{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;min-width:0!important;}
      .j-card-fornecedores td:last-child button{display:block;width:100%!important;min-width:0!important;margin:4px 0!important;white-space:normal!important;}

      /* Clientes e veículos no computador também respeitam a largura do card. */
      #s-clientes table.j-table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;}
      #s-clientes th,#s-clientes td{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;min-width:0!important;}

      @container (max-width:620px){
        .j-card-fornecedores table.j-table,.j-card-fornecedores table.j-table tbody,
        .j-card-fornecedores table.j-table tr,.j-card-fornecedores table.j-table td{
          display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
        }
        .j-card-fornecedores table.j-table thead{display:none!important;}
        .j-card-fornecedores #tbFornec{padding:10px!important;}
        .j-card-fornecedores #tbFornec tr{padding:12px!important;margin:0 0 12px!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--surf2)!important;overflow:hidden!important;}
        .j-card-fornecedores #tbFornec td{padding:8px 0!important;border:0!important;}
        .j-card-fornecedores #tbFornec td::before{content:attr(data-label);display:block;margin-bottom:4px;font-family:var(--fm);font-size:.56rem;color:var(--muted);letter-spacing:1.1px;text-transform:uppercase;}
        .j-card-fornecedores #tbFornec td:last-child{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
        .j-card-fornecedores #tbFornec td:last-child::before{grid-column:1/-1;}
        .j-card-fornecedores #tbFornec td:last-child button{margin:0!important;min-height:44px!important;}
      }

      @media(max-width:900px){
        #s-clientes>div,#s-estoque>div{grid-template-columns:1fr!important;width:100%!important;min-width:0!important;}
      }

      @media(max-width:768px){
        html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;}
        .content{padding-left:10px!important;padding-right:10px!important;overflow-x:hidden!important;}
        .section{width:100%!important;min-width:0!important;overflow-x:hidden!important;}
        .j-card{width:100%!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;}
        .j-card-header{flex-direction:column!important;align-items:stretch!important;gap:10px!important;}
        .j-collapse-tools{width:100%!important;grid-template-columns:1fr!important;}
        .j-card-header button,.j-collapse-tools button{width:100%!important;min-width:0!important;min-height:44px!important;}

        #estoqueFiltrosV269{grid-template-columns:1fr!important;padding:10px!important;}
        #estoqueFiltrosV269 input,#estoqueFiltrosV269 select{font-size:16px!important;min-height:46px!important;}

        /* Inventário mobile usa as próprias linhas reais como cards: sem segunda lista paralela. */
        #s-estoque .j-card-inventario-v2611{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;}
        #s-estoque .j-card-inventario-v2611 .j-card-body{display:block!important;overflow:hidden!important;padding:0!important;width:100%!important;max-width:100%!important;min-width:0!important;}
        #s-estoque .j-card-inventario-v2611 .j-card-body > table.j-table{min-width:0!important;}
        #s-estoque .j-card-inventario-v2611 table.j-table{
          display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
          table-layout:auto!important;overflow:hidden!important;
        }
        #s-estoque .j-card-inventario-v2611 table.j-table>thead{display:none!important;}
        #s-estoque .j-card-inventario-v2611 #tbEstoque{
          display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;padding:10px!important;
        }
        #s-estoque .j-card-inventario-v2611 #tbEstoque tr{
          display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:100%!important;min-width:0!important;
          margin:0 0 12px!important;padding:12px!important;border:1px solid var(--border)!important;
          border-radius:12px!important;background:var(--surf2)!important;overflow:hidden!important;
        }
        #s-estoque .j-card-inventario-v2611 #tbEstoque td{
          display:grid!important;grid-template-columns:minmax(92px,34%) minmax(0,1fr)!important;
          gap:10px!important;width:100%!important;max-width:100%!important;min-width:0!important;
          padding:7px 0!important;border:0!important;white-space:normal!important;
          overflow-wrap:anywhere!important;word-break:break-word!important;text-align:left!important;
        }
        #s-estoque .j-card-inventario-v2611 #tbEstoque td::before{
          content:attr(data-label);font-family:var(--fm);font-size:.56rem;color:var(--muted);
          letter-spacing:1px;text-transform:uppercase;min-width:0;
        }
        #s-estoque .j-card-inventario-v2611 #tbEstoque td:last-child{display:block!important;}
        #s-estoque .j-card-inventario-v2611 #tbEstoque td:last-child::before{display:block;margin-bottom:7px;}
        .acoes-estoque-v2610{grid-template-columns:1fr!important;gap:8px!important;}
        .acoes-estoque-v2610 button{min-height:44px!important;}

        /* Clientes e veículos: cards verticais completos. */
        #s-clientes .j-card-body{overflow:hidden!important;padding:0!important;}
        #s-clientes table,#s-clientes tbody{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;}
        #s-clientes thead{display:none!important;}
        #tbClientesBusca,#tbVeiculosBusca{display:block!important;padding:10px!important;}
        #tbClientesBusca tr,#tbVeiculosBusca tr,#tbClientesBusca td,#tbVeiculosBusca td{display:block!important;width:100%!important;max-width:100%!important;padding:0!important;border:0!important;}
        #buscaClientesCadastro,#buscaVeiculosCadastro{width:100%!important;min-width:0!important;max-width:100%!important;font-size:16px!important;}
        #tbClientes,#tbVeiculos{padding:10px!important;}
        #tbClientes tr,#tbVeiculos tr{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0 0 12px!important;padding:12px!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--surf2)!important;overflow:hidden!important;}
        #tbClientes td,#tbVeiculos td{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;padding:8px 0!important;border:0!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;text-align:left!important;}
        #tbClientes td::before,#tbVeiculos td::before{content:attr(data-label);display:block;margin-bottom:4px;font-family:var(--fm);font-size:.56rem;color:var(--muted);letter-spacing:1.1px;text-transform:uppercase;}
        #tbClientes td:last-child,#tbVeiculos td:last-child{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
        #tbClientes td:last-child::before,#tbVeiculos td:last-child::before{grid-column:1/-1;}
        #tbClientes td:last-child button,#tbVeiculos td:last-child button{width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;}

        /* Fallback iOS para fornecedores. */
        .j-card-fornecedores table.j-table,.j-card-fornecedores table.j-table tbody,
        .j-card-fornecedores table.j-table tr,.j-card-fornecedores table.j-table td{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;}
        .j-card-fornecedores table.j-table thead{display:none!important;}
        .j-card-fornecedores #tbFornec{padding:10px!important;}
        .j-card-fornecedores #tbFornec tr{padding:12px!important;margin:0 0 12px!important;border:1px solid var(--border)!important;border-radius:10px!important;background:var(--surf2)!important;overflow:hidden!important;}
        .j-card-fornecedores #tbFornec td{padding:8px 0!important;border:0!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
        .j-card-fornecedores #tbFornec td::before{content:attr(data-label);display:block;margin-bottom:4px;font-family:var(--fm);font-size:.56rem;color:var(--muted);letter-spacing:1.1px;text-transform:uppercase;}
        .j-card-fornecedores #tbFornec td:last-child{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
        .j-card-fornecedores #tbFornec td:last-child::before{grid-column:1/-1;}
        .j-card-fornecedores #tbFornec td:last-child button{width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;}
      }

      @media(max-width:420px){
        #tbClientes td:last-child,#tbVeiculos td:last-child,.j-card-fornecedores #tbFornec td:last-child{grid-template-columns:1fr!important;}
        #s-estoque .j-card-inventario-v2611 #tbEstoque td{grid-template-columns:1fr!important;gap:4px!important;}
      }
    `;
    D.head.appendChild(style);
  }

  function labelRows(tbodyId, labels) {
    const tbody = byId(tbodyId);
    if (!tbody) return;
    Array.from(tbody.rows || []).forEach(row => {
      Array.from(row.cells || []).forEach((cell, index) => {
        if (!cell.hasAttribute('colspan')) cell.dataset.label = labels[index] || `Campo ${index + 1}`;
      });
    });
  }

  function labelAllResponsiveRows() {
    labelRows('tbClientes', ['Nome / acesso', 'WhatsApp', 'Veículos', 'Ações']);
    labelRows('tbVeiculos', ['Placa', 'Tipo', 'Modelo', 'Dono', 'KM', 'Ações']);
    const supplierHeaders = Array.from(byId('tbFornec')?.closest('table')?.querySelectorAll('thead th') || []).map(th => th.textContent.trim());
    labelRows('tbFornec', supplierHeaders.length ? supplierHeaders : ['Razão social', 'Documento / contato', 'Endereço', 'Ações']);
    byId('tbFornec')?.closest('.j-card')?.classList.add('j-card-fornecedores');
  }

  function stockCode(p) {
    return p?.codigo || p?.codigoFornecedor || p?.codigoComercial || p?.oem || p?.ean || '';
  }

  function stockText(p) {
    return norm([
      p?.codigo,p?.codigoFornecedor,p?.codigoComercial,p?.oem,p?.ean,
      p?.desc,p?.descricao,p?.marca,p?.fornecedor,p?.fornecedorNome,p?.nomeFornecedor,
      p?.ultimaFornecedor,p?.ultimaNF,p?.nfNumero,p?.notaFiscal,p?.ncm,p?.cfop
    ].filter(Boolean).join(' '));
  }

  function stockStatus(p) {
    const qtd = num(p?.qtd ?? p?.quantidade ?? p?.saldo ?? 0);
    const min = num(p?.min ?? p?.minimo ?? 0);
    if (qtd === 0) return 'zero';
    if (qtd <= min) return 'critical';
    return 'stock';
  }

  function currentStockFilters() {
    return {
      raw:byId('estoqueBuscaV269')?.value || W._estoqueBuscaPecas || '',
      q:norm(byId('estoqueBuscaV269')?.value || W._estoqueBuscaPecas || ''),
      status:byId('estoqueStatusV269')?.value || 'all'
    };
  }

  function filteredStockList(source) {
    const filters = currentStockFilters();
    return (Array.isArray(source) ? source : []).filter(p => {
      if (filters.q && !stockText(p).includes(filters.q)) return false;
      const qtd = num(p?.qtd ?? p?.quantidade ?? p?.saldo ?? 0);
      const st = stockStatus(p);
      if (filters.status === 'stock' && qtd <= 0) return false;
      if (filters.status === 'zero' && qtd !== 0) return false;
      if (filters.status === 'critical' && !['zero','critical'].includes(st)) return false;
      return true;
    });
  }

  function ensureStockFilters() {
    markInventoryCard();
    const tbody = byId('tbEstoque');
    const table = tbody?.closest('table');
    const body = tbody?.closest('.j-card-body');
    if (!tbody || !table || !body) return false;

    let toolbar = byId('estoqueFiltrosV269');
    if (!toolbar) {
      toolbar = D.createElement('div');
      toolbar.id = 'estoqueFiltrosV269';
      toolbar.innerHTML = `
        <div class="ef-v269-field">
          <label for="estoqueBuscaV269">Pesquisar peça</label>
          <input class="j-input" id="estoqueBuscaV269" type="search"
            placeholder="Código, descrição, marca, fornecedor ou NF..." autocomplete="off">
        </div>
        <div class="ef-v269-field">
          <label for="estoqueStatusV269">Situação do saldo</label>
          <select class="j-select" id="estoqueStatusV269">
            <option value="all">Todas as peças</option>
            <option value="stock">Em estoque</option>
            <option value="zero">Zeradas</option>
            <option value="critical">Críticas / abaixo do mínimo</option>
          </select>
        </div>
        <div id="estoqueResumoV269">Aguardando estoque...</div>`;
      body.insertBefore(toolbar, table);
      const oldSearch = byId('buscaEstoquePecas');
      if (oldSearch?.value) byId('estoqueBuscaV269').value = oldSearch.value;
      byId('estoqueBuscaV269')?.addEventListener('input', () => {
        W._estoqueBuscaPecas = byId('estoqueBuscaV269').value;
        renderStockStable();
      });
      byId('estoqueStatusV269')?.addEventListener('change', renderStockStable);
    }
    return true;
  }

  function renderStockStable() {
    markInventoryCard();
    const tbody = byId('tbEstoque');
    if (!tbody || !ensureStockFilters()) return;
    const all = Array.isArray(W.J?.estoque) ? W.J.estoque : [];
    const filters = currentStockFilters();
    W._estoqueBuscaPecas = filters.raw;
    const list = filteredStockList(all);

    tbody.innerHTML = list.map(p => {
      const id = esc(p?.id || '');
      const qtd = num(p?.qtd ?? p?.quantidade ?? p?.saldo ?? 0);
      const min = num(p?.min ?? p?.minimo ?? 0);
      const st = stockStatus(p);
      const critical = st === 'zero' || st === 'critical';
      const detail = [p?.marca,p?.ncm,p?.cfop].filter(Boolean).map(esc).join(' | ');
      return `<tr class="${critical ? 'stock-critical' : ''}" data-stock-id="${id}">
        <td data-label="Ref / Código" style="font-family:var(--fm);font-size:.75rem;color:var(--muted)">${esc(stockCode(p) || '-')}</td>
        <td data-label="Descrição"><strong>${esc(p?.desc || p?.descricao || '-')}</strong>${detail ? `<br><small>${detail}</small>` : ''}</td>
        <td data-label="Custo" style="font-family:var(--fm)">${esc(moeda(p?.custo || p?.valorCompra || p?.precoCusto || 0))}</td>
        <td data-label="Venda" style="font-family:var(--fm);color:var(--success)">${esc(moeda(p?.venda || p?.precoVenda || 0))}</td>
        <td data-label="Quantidade" style="font-family:var(--fm);font-weight:700;color:${critical ? 'var(--danger)' : 'var(--text)'}">${esc(qtd)}</td>
        <td data-label="Mínimo" style="font-family:var(--fm);color:var(--muted)">${esc(min)}</td>
        <td data-label="Status">${critical ? '<span class="pill pill-danger">CRÍTICO</span>' : '<span class="pill pill-green">OK</span>'}</td>
        <td data-label="Ações"><div class="acoes-estoque-v2610">
          <button type="button" class="btn-ghost" data-stock-action="edit" data-stock-id="${id}">EDITAR</button>
          <button type="button" class="btn-danger" data-stock-action="delete" data-stock-id="${id}">EXCLUIR</button>
          <button type="button" class="btn-ghost btn-kardex-v269" data-stock-action="kardex" data-stock-id="${id}">KARDEX</button>
        </div></td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">${filters.q || filters.status !== 'all' ? 'Nenhuma peça encontrada para a pesquisa e o filtro selecionados' : 'Nenhum item'}</td></tr>`;

    const summary = byId('estoqueResumoV269');
    if (summary) {
      const positive = list.filter(p => num(p?.qtd ?? p?.quantidade ?? p?.saldo ?? 0) > 0).length;
      const zero = list.filter(p => stockStatus(p) === 'zero').length;
      const critical = list.filter(p => ['zero','critical'].includes(stockStatus(p))).length;
      summary.textContent = `${list.length} peça(s) localizada(s) de ${all.length} · em estoque ${positive} · zeradas ${zero} · críticas ${critical}`;
    }
  }
  renderStockStable.__thiaV2610Stock = true;
  renderStockStable.__thiaV2611Stock = true;
  renderStockStable.__estoqueMobileFixWrap = true;

  function installStableRenderer() {
    installCSS();
    ensureStockFilters();
    if (W.renderEstoque !== renderStockStable) W.renderEstoque = renderStockStable;
    renderStockStable();
  }

  function ensureStockActions() {
    const tbody = byId('tbEstoque');
    if (!tbody || tbody.dataset.thiaV2610Actions === '1') return;
    tbody.dataset.thiaV2610Actions = '1';
    tbody.addEventListener('click', event => {
      const button = event.target.closest?.('[data-stock-action]');
      if (!button || !tbody.contains(button)) return;
      event.preventDefault();
      const id = button.dataset.stockId || '';
      const action = button.dataset.stockAction;
      if (action === 'edit') {
        W.prepPeca?.('edit', id);
        W.abrirModal?.('modalPeca');
      } else if (action === 'delete') {
        W.excluirPecaDef?.(id);
      } else if (action === 'kardex') {
        W.rastrearPecaKardexV269?.(id);
      }
    });
  }

  function ensureKardexBanner(p, code) {
    const box = byId('fiscalPecasV266');
    if (!box) return;
    let banner = byId('kardexResumoV269');
    if (!banner) {
      banner = D.createElement('div');
      banner.id = 'kardexResumoV269';
      banner.style.cssText = 'margin:0 0 10px;padding:10px;border:1px solid rgba(0,212,255,.35);border-radius:6px;background:rgba(0,212,255,.06);font-family:var(--fm);font-size:.68rem;line-height:1.55;overflow-wrap:anywhere;';
      const filters = box.querySelector('.fp-v266-filters');
      if (filters) box.insertBefore(banner, filters); else box.insertBefore(banner, box.firstChild);
    }
    const qtd = num(p?.qtd ?? p?.quantidade ?? p?.saldo ?? 0);
    const min = num(p?.min ?? p?.minimo ?? 0);
    const st = stockStatus(p);
    const label = st === 'zero' ? 'ZERADA' : st === 'critical' ? 'CRÍTICA / ABAIXO DO MÍNIMO' : 'EM ESTOQUE';
    banner.innerHTML = `<strong>KARDEX — ${esc(code || 'SEM CÓDIGO')}</strong><br>${esc(p?.desc || p?.descricao || 'Peça sem descrição')}<br>Saldo atual: <strong>${esc(qtd)}</strong> · Mínimo: <strong>${esc(min)}</strong> · Situação: <strong>${label}</strong><br><span style="color:var(--muted)">Abaixo estão as compras, notas fiscais, aplicações, O.S., veículos, devoluções e vínculos encontrados nos dados fiscais carregados.</span>`;
  }

  function openFiscalCardAndSearch(p, attempt) {
    const code = stockCode(p) || p?.desc || p?.descricao || '';
    const search = byId('fiscalPecaBuscaV266');
    const card = byId('fiscalPecasCardV268') || byId('fiscalPecasV266');
    if (!search || !card) {
      if ((attempt || 0) < 30) setTimeout(() => openFiscalCardAndSearch(p, (attempt || 0) + 1), 160);
      return;
    }
    const independentCard = card.closest?.('.j-card') || card;
    independentCard.classList?.remove('j-minimized');
    card.classList?.remove('minimized');
    const toggle = independentCard.querySelector?.('.j-collapse-toggle');
    if (toggle) {
      toggle.textContent = '−';
      toggle.setAttribute('aria-expanded', 'true');
    }
    ['fiscalPecaDestinoV266','fiscalPecaStatusV266','fiscalPecaInicioV266','fiscalPecaFimV266'].forEach(id => {
      const el = byId(id); if (el) el.value = '';
    });
    search.value = code;
    ensureKardexBanner(p, code);
    search.dispatchEvent(new Event('input', { bubbles:true }));
    W.renderFiscalPecasV266?.();
    independentCard.classList.add('kardex-highlight-v269');
    independentCard.scrollIntoView({ behavior:'smooth', block:'start', inline:'nearest' });
    setTimeout(() => {
      independentCard.classList.remove('kardex-highlight-v269');
      try { search.focus({ preventScroll:true }); } catch (_) { search.focus?.(); }
    }, 2800);
  }

  W.rastrearPecaKardexV269 = function (id) {
    const p = (W.J?.estoque || []).find(item => String(item.id) === String(id));
    if (!p) {
      W.toast?.('Peça não localizada no estoque carregado.', 'warn');
      return;
    }
    try { W.ir?.('estoque'); } catch (_) {}
    setTimeout(() => openFiscalCardAndSearch(p, 0), 80);
  };

  function observeResponsiveTables() {
    ['tbClientes','tbVeiculos','tbFornec'].forEach(id => {
      const el = byId(id);
      if (!el || el.dataset.thiaV2610Observed === '1') return;
      el.dataset.thiaV2610Observed = '1';
      new MutationObserver(labelAllResponsiveRows).observe(el, { childList:true, subtree:true });
    });
  }

  function boot() {
    markInventoryCard();
    installCSS();
    labelAllResponsiveRows();
    observeResponsiveTables();
    ensureStockActions();
    installStableRenderer();
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  [100,300,700,1400,2800,5200,9200,11000].forEach(ms => setTimeout(boot, ms));
  W.addEventListener('resize', labelAllResponsiveRows);
  W.addEventListener('orientationchange', () => setTimeout(boot, 250));

  W.thiaRenderEstoqueV269 = renderStockStable;
  W.thiaRenderEstoqueV2610 = renderStockStable;
  console.info('[OFICIN-IA] Inventário, Kardex e responsividade V' + VERSION + ' instalados');
})(window, document);
