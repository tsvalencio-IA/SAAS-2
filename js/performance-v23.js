/**
 * OFICIN-IA V23 — Camada de desempenho do Jarvis
 * - Carregamento de coleções apenas quando a tela precisa delas.
 * - Atualização incremental via docChanges, sem remontar arrays em cada alteração.
 * - Renderização com debounce e somente na tela ativa.
 * - Paginação visual de clientes, veículos, estoque, financeiro e O.S. entregues.
 * - Bibliotecas pesadas de PDF/ExcelJS carregadas somente quando usadas.
 * Não altera regras de negócio, documentos, cálculos, permissões ou gravações.
 */
(function (W) {
  'use strict';
  if (W.__THIA_PERFORMANCE_V23__) return;
  W.__THIA_PERFORMANCE_V23__ = true;

  const V = '23.0.0';
  const J = () => W.J || {};
  const byId = id => document.getElementById(id);
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const activeSectionKey = () => {
    const id = document.querySelector('.section.active')?.id || '';
    const map = {
      's-dashboard':'dashboard','s-agenda':'agenda','s-kanban':'kanban','s-clientes':'clientes',
      's-estoque':'estoque','s-vendas':'vendas','s-financeiro':'financeiro','s-equipe':'equipe',
      's-chat':'chat','s-chatequipe':'chatequipe','s-ia':'ia','s-tabelatempa':'tabelatempa',
      's-auditoria':'auditoria','s-oficina':'oficina'
    };
    return map[id] || 'dashboard';
  };
  const modalOpen = id => byId(id)?.classList.contains('open');

  // A persistência é configurada uma única vez em config.js, antes da primeira consulta.
  // Mantemos aqui apenas o pedido idempotente para páginas antigas que carreguem esta camada isoladamente.
  try { W.thiaConfigurarPersistenciaFirestore?.(W.db); } catch (_) {}

  const renderTimers = new Map();
  function debounce(name, fn, wait = 90) {
    clearTimeout(renderTimers.get(name));
    renderTimers.set(name, setTimeout(() => {
      renderTimers.delete(name);
      try { fn(); } catch (err) { console.warn('[V23 render ' + name + ']', err?.message || err); }
    }, wait));
  }

  const idx = W.thiaIndexesV23 = {
    clientePorId: new Map(), veiculoPorId: new Map(), veiculosPorCliente: new Map(),
    osPorVeiculo: new Map(), osPorPlaca: new Map()
  };
  function placaKey(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function rebuildIndexes(kind) {
    const data = J();
    if (!kind || kind === 'clientes') {
      idx.clientePorId = new Map((data.clientes || []).map(c => [String(c.id), c]));
    }
    if (!kind || kind === 'veiculos' || kind === 'clientes') {
      idx.veiculoPorId = new Map(); idx.veiculosPorCliente = new Map();
      (data.veiculos || []).forEach(v => {
        idx.veiculoPorId.set(String(v.id), v);
        const cid = String(v.clienteId || v.donoId || v.ownerId || '');
        if (cid) {
          if (!idx.veiculosPorCliente.has(cid)) idx.veiculosPorCliente.set(cid, []);
          idx.veiculosPorCliente.get(cid).push(v);
        }
      });
    }
    if (!kind || kind === 'os' || kind === 'veiculos') {
      idx.osPorVeiculo = new Map(); idx.osPorPlaca = new Map();
      (data.os || []).forEach(o => {
        const vid = String(o.veiculoId || '');
        if (vid) {
          if (!idx.osPorVeiculo.has(vid)) idx.osPorVeiculo.set(vid, []);
          idx.osPorVeiculo.get(vid).push(o);
        }
        const pk = placaKey(o.placa || idx.veiculoPorId.get(vid)?.placa);
        if (pk) {
          if (!idx.osPorPlaca.has(pk)) idx.osPorPlaca.set(pk, []);
          idx.osPorPlaca.get(pk).push(o);
        }
      });
    }
  }
  W.thiaRebuildIndexesV23 = rebuildIndexes;

  const listenerState = new Map();
  function incrementalListener(opts) {
    const { key, collection, target, sort, onChange } = opts;
    if (listenerState.has(key)) return listenerState.get(key).unsubscribe;
    const current = new Map((J()[target] || []).map(x => [String(x.id), x]));
    const query = W.db.collection(collection).where('tenantId', '==', J().tid);
    const state = { current, ready: false, unsubscribe: null };
    listenerState.set(key, state);
    state.unsubscribe = query.onSnapshot(snap => {
      if (!state.ready) {
        current.clear();
        snap.docs.forEach(d => current.set(String(d.id), { id:d.id, ...d.data() }));
        state.ready = true;
      } else {
        snap.docChanges().forEach(change => {
          const id = String(change.doc.id);
          if (change.type === 'removed') current.delete(id);
          else current.set(id, { id:change.doc.id, ...change.doc.data() });
        });
      }
      let list = Array.from(current.values());
      if (W.thiaRuntimeCore?.dedupeById) list = W.thiaRuntimeCore.dedupeById(list);
      if (typeof sort === 'function') list.sort(sort);
      J()[target] = list;
      rebuildIndexes(target);
      debounce(key, () => onChange?.(list, snap), 80);
    }, err => {
      console.warn('[V23 listener ' + collection + ']', err?.message || err);
      listenerState.delete(key);
    });
    return state.unsubscribe;
  }

  function renderFor(key) {
    const active = activeSectionKey();
    const is = (...keys) => keys.includes(active);
    if (key === 'os') {
      if (is('kanban')) W.renderKanban?.();
      if (is('dashboard')) W.renderDashboard?.();
      if (is('equipe','financeiro')) W.calcComissoes?.();
      if (is('clientes') && W.renderVeiculos) W.renderVeiculos();
    }
    if (key === 'clientes') {
      if (is('clientes')) W.renderClientes?.();
      if (is('kanban','agenda') || modalOpen('modalOS') || modalOpen('modalVeiculo')) W.popularSelects?.();
      if (is('dashboard')) W.renderDashboard?.();
    }
    if (key === 'veiculos') {
      if (is('clientes')) { W.renderVeiculos?.(); W.renderClientes?.(); }
      if (is('kanban')) W.renderKanban?.();
      if (is('dashboard')) W.renderDashboard?.();
      if (is('agenda') || modalOpen('modalOS') || modalOpen('modalVeiculo')) W.popularSelects?.();
    }
    if (key === 'estoque') {
      if (is('estoque')) W.renderEstoque?.();
      if (is('dashboard')) W.renderDashboard?.();
      if (is('vendas')) W.renderVendasAutopecas?.();
    }
    if (key === 'financeiro') {
      if (is('financeiro')) W.renderFinanceiro?.();
      if (is('equipe','financeiro')) W.calcComissoes?.();
      if (is('dashboard')) W.renderDashboard?.();
    }
    if (key === 'equipe') {
      if (is('equipe')) W.renderEquipe?.();
      if (is('equipe','financeiro')) W.calcComissoes?.();
      if (is('chatequipe')) W.renderChatEquipeLista?.();
      if (modalOpen('modalOS') || is('agenda','vendas')) W.popularSelects?.();
    }
    if (key === 'fornecedores') {
      if (is('estoque','financeiro')) W.renderFornecedores?.();
      if (modalOpen('modalNF') || modalOpen('modalFin')) W.popularSelects?.();
    }
  }

  // Substitui somente os listeners mais volumosos. As coleções menores continuam com a lógica original.
  W.escutarOS = function () {
    return incrementalListener({
      key:'os', collection:'ordens_servico', target:'os',
      sort:(a,b) => String(b.updatedAt || b.createdAt || b.data || '').localeCompare(String(a.updatedAt || a.createdAt || a.data || '')),
      onChange:() => renderFor('os')
    });
  };
  W.escutarClientes = function () {
    return incrementalListener({ key:'clientes', collection:'clientes', target:'clientes', sort:(a,b)=>norm(a.nome).localeCompare(norm(b.nome)), onChange:()=>renderFor('clientes') });
  };
  W.escutarVeiculos = function () {
    return incrementalListener({ key:'veiculos', collection:'veiculos', target:'veiculos', sort:(a,b)=>placaKey(a.placa).localeCompare(placaKey(b.placa)), onChange:()=>renderFor('veiculos') });
  };
  W.escutarEstoque = function () {
    return incrementalListener({ key:'estoque', collection:'estoqueItems', target:'estoque', sort:(a,b)=>norm(a.desc || a.descricao).localeCompare(norm(b.desc || b.descricao)), onChange:()=>renderFor('estoque') });
  };
  W.escutarFinanceiro = function () {
    return incrementalListener({ key:'financeiro', collection:'financeiro', target:'financeiro', sort:(a,b)=>String(b.venc || b.data || b.createdAt || '').localeCompare(String(a.venc || a.data || a.createdAt || '')), onChange:()=>renderFor('financeiro') });
  };
  W.escutarEquipe = function () {
    return incrementalListener({ key:'equipe', collection:'funcionarios', target:'equipe', sort:(a,b)=>norm(a.nome).localeCompare(norm(b.nome)), onChange:()=>renderFor('equipe') });
  };
  W.escutarFornecedores = function () {
    return incrementalListener({ key:'fornecedores', collection:'fornecedores', target:'fornecedores', sort:(a,b)=>norm(a.nome).localeCompare(norm(b.nome)), onChange:()=>renderFor('fornecedores') });
  };

  // Paginação somente visual: todos os dados continuam na memória e disponíveis para pesquisa, cálculos e gravações.
  const limits = W.thiaListLimitsV23 = { clientes:50, veiculos:60, estoque:80, entregues:30 };
  function appendMore(tbodyId, colspan, shown, total, action, label) {
    const tb = byId(tbodyId);
    if (!tb || shown >= total) return;
    const tr = document.createElement('tr');
    tr.className = 'thia-v23-more-row';
    tr.innerHTML = `<td colspan="${colspan}" style="padding:12px;text-align:center;white-space:normal;"><button type="button" class="btn-outline" style="max-width:100%;white-space:normal;" onclick="${action}">CARREGAR MAIS ${label} (${shown}/${total})</button></td>`;
    tb.appendChild(tr);
  }
  function clientMatches(c, term) {
    if (!term) return true;
    const vehicles = idx.veiculosPorCliente.get(String(c.id)) || [];
    const text = [c.nome,c.razaoSocial,c.nomeFantasia,c.doc,c.cpf,c.cnpj,c.wpp,c.telefone,c.celular,c.email,c.login,c.pin,c.tipoCliente,c.govUnidade,c.govFiscal,
      vehicles.map(v => [v.placa,v.modelo,v.marca,v.prefixo,v.frota,v.chassis,v.chassi,v.patrimonio,v.km].join(' ')).join(' ')].join(' ');
    return norm(text).includes(term);
  }
  function vehicleMatches(v, term) {
    if (!term) return true;
    const c = idx.clientePorId.get(String(v.clienteId)) || {};
    return norm([v.placa,v.tipo,v.modelo,v.marca,v.ano,v.cor,v.km,v.prefixo,v.frota,v.chassis,v.chassi,v.patrimonio,v.obs,c.nome,c.doc,c.wpp,c.login].join(' ')).includes(term);
  }
  function stockMatches(p, term) {
    if (!term) return true;
    return norm([p.codigo,p.codigoFornecedor,p.codigoComercial,p.oem,p.ean,p.desc,p.descricao,p.marca,p.fornecedorNome,p.ultimaFornecedor,p.ultimaNF].join(' ')).includes(term);
  }
  function wrapPaged(name, target, limitKey, inputId, tbodyId, colspan, matcher, label) {
    const original = W[name];
    if (typeof original !== 'function' || original.__thiaV23Paged) return;
    const wrapped = function () {
      const all = Array.isArray(J()[target]) ? J()[target] : [];
      const term = norm(byId(inputId)?.value || (limitKey === 'estoque' ? W._estoqueBuscaPecas : ''));
      const matched = all.filter(item => matcher(item, term));
      const visible = matched.slice(0, limits[limitKey]);
      J()[target] = visible;
      try { original.apply(this, arguments); }
      finally { J()[target] = all; }
      appendMore(tbodyId, colspan, visible.length, matched.length,
        `window.thiaListLimitsV23.${limitKey}+=${limitKey === 'estoque' ? 80 : 50};window.${name}();`, label);
    };
    wrapped.__thiaV23Paged = true;
    if (original.__thiaV20) wrapped.__thiaV20 = true;
    wrapped.__original = original;
    W[name] = wrapped;
  }

  function wrapDashboardLoadingState() {
    const original = W.renderDashboard;
    if (typeof original !== 'function' || original.__thiaV23Loading) return;
    const wrapped = function () {
      const out = original.apply(this, arguments);
      if (!listenerState.get('estoque')?.ready) {
        const el = byId('kStock'); if (el) { el.textContent = '—'; el.title = 'Estoque ainda não carregado. Abra o módulo Estoque ou aguarde o carregamento progressivo.'; }
      }
      if (!listenerState.get('financeiro')?.ready) {
        const el = byId('kVenc'); if (el) { el.textContent = '—'; el.title = 'Financeiro ainda não carregado. Abra o módulo Financeiro ou aguarde o carregamento progressivo.'; }
      }
      return out;
    };
    wrapped.__thiaV23Loading = true; wrapped.__original = original; W.renderDashboard = wrapped;
  }

  function wrapKanbanDelivered() {
    const original = W.renderKanban;
    if (typeof original !== 'function' || original.__thiaV23Paged) return;
    const wrapped = function () {
      const all = Array.isArray(J().os) ? J().os : [];
      const hasSearch = !!norm(byId('searchOS')?.value || byId('buscaEntreguesKanban')?.value || '');
      let visible = all;
      let deliveredTotal = 0;
      if (!hasSearch) {
        const delivered = [], others = [];
        all.forEach(o => {
          const status = norm(o.status);
          if (status === 'entregue' || status === 'concluido') delivered.push(o); else others.push(o);
        });
        deliveredTotal = delivered.length;
        visible = others.concat(delivered.slice(0, limits.entregues));
      }
      J().os = visible;
      try { original.apply(this, arguments); }
      finally { J().os = all; }
      if (!hasSearch && deliveredTotal > limits.entregues) {
        const col = byId('kb-Entregue');
        if (col) {
          const box = document.createElement('div');
          box.style.cssText = 'padding:10px;text-align:center;width:100%;box-sizing:border-box;';
          box.innerHTML = `<button type="button" class="btn-outline" style="width:100%;white-space:normal;" onclick="window.thiaListLimitsV23.entregues+=30;window.renderKanban()">CARREGAR MAIS ENTREGUES (${Math.min(limits.entregues, deliveredTotal)}/${deliveredTotal})</button>`;
          col.appendChild(box);
        }
      }
    };
    wrapped.__thiaV23Paged = true;
    wrapped.__original = original;
    W.renderKanban = wrapped;
  }

  // Bibliotecas pesadas são baixadas somente no momento da exportação.
  const libPromises = {};
  function loadScript(id, src) {
    if (document.getElementById(id)) return Promise.resolve();
    if (libPromises[id]) return libPromises[id];
    libPromises[id] = new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.id = id; s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
    return libPromises[id];
  }
  W.thiaLoadPdfLibsV23 = async function () {
    if (!W.jspdf) await loadScript('thia-jspdf-v23','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!W.jspdf?.jsPDF?.API?.autoTable) await loadScript('thia-jspdf-autotable-v23','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
  };
  W.thiaLoadExcelJSLibV23 = async function () {
    if (!W.ExcelJS) await loadScript('thia-exceljs-v23','https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
  };
  W.thiaLoadSheetJSLibV23 = async function () {
    if (!W.XLSX) await loadScript('thia-sheetjs-v23','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  };
  function wrapAsyncLibrary(name, loader) {
    const original = W[name];
    if (typeof original !== 'function' || original.__thiaV23Lazy) return;
    const wrapped = async function () {
      try { await loader(); return await original.apply(this, arguments); }
      catch (err) { W.toast?.('Erro ao carregar biblioteca de exportação: ' + (err?.message || err), 'err'); }
    };
    wrapped.__thiaV23Lazy = true; wrapped.__original = original; W[name] = wrapped;
  }

  function install() {
    rebuildIndexes();
    wrapPaged('renderClientes','clientes','clientes','buscaClientesCadastro','tbClientes',4,clientMatches,'CLIENTES');
    wrapPaged('renderVeiculos','veiculos','veiculos','buscaVeiculosCadastro','tbVeiculos',6,vehicleMatches,'VEÍCULOS');
    wrapPaged('renderEstoque','estoque','estoque','buscaEstoquePecas','tbEstoque',8,stockMatches,'ITENS');
    wrapDashboardLoadingState();
    wrapKanbanDelivered();
    wrapAsyncLibrary('gerarPDFOS', W.thiaLoadPdfLibsV23);
    wrapAsyncLibrary('exportarOrcamentoPMSP', W.thiaLoadExcelJSLibV23);
    wrapAsyncLibrary('exportarOrcamentoPMSPItens', W.thiaLoadExcelJSLibV23);
    wrapAsyncLibrary('importarOrcamentoOSArquivo', W.thiaLoadSheetJSLibV23);

    // Ao abrir uma O.S., inicia apenas os dados auxiliares necessários ao formulário.
    if (typeof W.prepOS === 'function' && !W.prepOS.__thiaV23Data) {
      const original = W.prepOS;
      const wrapped = function () {
        W.thiaEnsureDataFor?.('osModal');
        return original.apply(this, arguments);
      };
      wrapped.__thiaV23Data = true; if (original.__thiaV20) wrapped.__thiaV20 = true; wrapped.__original = original; W.prepOS = wrapped;
    }

    // Renderiza imediatamente a tela ao navegar, caso seus dados já estejam em memória.
    if (typeof W.ir === 'function' && !W.ir.__thiaV23) {
      const original = W.ir;
      const wrapped = function (key, el) {
        const out = original.apply(this, arguments);
        setTimeout(() => {
          if (key === 'dashboard') W.renderDashboard?.();
          else if (key === 'kanban') W.renderKanban?.();
          else if (key === 'clientes') { W.renderClientes?.(); W.renderVeiculos?.(); }
          else if (key === 'estoque') W.renderEstoque?.();
          else if (key === 'financeiro') W.renderFinanceiro?.();
          else if (key === 'equipe') { W.renderEquipe?.(); W.calcComissoes?.(); }
          else if (key === 'vendas') W.renderVendasAutopecas?.();
        }, 0);
        return out;
      };
      wrapped.__thiaV23 = true; wrapped.__original = original; W.ir = wrapped;
    }

    // Se o usuário permanecer no dashboard, os indicadores pesados entram em etapas,
    // depois que a interface e as O.S. já estiverem utilizáveis.
    setTimeout(() => { if (activeSectionKey() === 'dashboard') W.thiaEnsureDataFor?.('estoque'); }, 3000);
    setTimeout(() => { if (activeSectionKey() === 'dashboard') W.thiaEnsureDataFor?.('financeiro'); }, 6000);

    W.renderDashboard?.();
    document.documentElement.dataset.thiaPerformance = V;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})(window);
