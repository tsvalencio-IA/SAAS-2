/*
 * Camada comercial de preservacao e travas de dominio.
 * Nao substitui Firebase Rules: reforca UI, auditoria, notificacoes e contexto por perfil.
 */
(function () {
  'use strict';

  const D = document;
  const moneyRe = /R\$\s*\d|(?:\btotal\b|\bfaturad|\baprovad[oa]\s*R\$|\bcusto\b|\bmargem\b)/i;

  function role() {
    return String(window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  }

  function tenantId() {
    return window.J?.tid || sessionStorage.getItem('j_tid') || sessionStorage.getItem('govTid') || '';
  }

  function userName() {
    return window.J?.nome || sessionStorage.getItem('j_nome') || 'usuario';
  }

  function db() {
    return window.db || window.J?.db || null;
  }

  function isEquipe() {
    const r = role();
    return r === 'mecanico' || r === 'equipe';
  }

  function isCliente() {
    const path = location.pathname.toLowerCase();
    return role() === 'cliente' || path.includes('cliente.html') || path.includes('clienteoficial.html');
  }

  function canSeeFinance() {
    const r = role();
    return ['admin', 'gestor', 'gerente', 'superadmin', 'dono', 'proprietario', 'owner', 'financeiro', 'oficina_admin'].includes(r);
  }

  window.thiaCanSeeFinance = canSeeFinance;

  function segredo177Ativo() {
    return window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
  }

  function pecaRealProtegida(os, peca) {
    const U = window.JOS || window.JarvisOSUtils || {};
    if (typeof U.isBudgetPieceLinkedToRealPart === 'function') return U.isBudgetPieceLinkedToRealPart(os || {}, peca);
    if (typeof U.isProtectedRealPart === 'function') return U.isProtectedRealPart(peca);
    if (!peca || typeof peca !== 'object') return false;
    const origem = String(peca.origem || '').toLowerCase().trim();
    return peca.origemNFVinculada === true || origem === 'nf_entrada_os' || origem === 'nf_entrada' || String(peca.statusAplicacao || '').toLowerCase() === 'comprada_vinculada_nf' || !!String(peca.origemNFItemKey || '').trim();
  }

  function clienteOficialOS(os) {
    const cliente = (window.J?.clientes || []).find(c => String(c.id) === String(os?.clienteId || '')) || {};
    const U = window.JOS || window.JarvisOSUtils || {};
    if (typeof U.isOfficialClient === 'function') return U.isOfficialClient(os, cliente);
    return String(cliente.tipoCliente || os?.tipoCliente || '').toLowerCase() === 'governo';
  }

  function eventoPecaReal(evento) {
    const tipo = String(evento?.tipo || evento?.modulo || '').toLowerCase();
    if (['nf_peca_real','edicao_nf_peca_real','devolucao_nf_peca_real','vinculo_nf_peca_real_os'].includes(tipo)) return true;
    const texto = String(evento?.acao || evento?.descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /peca real|pecas reais|vinculad[ao] por nf|nf.*peca.*real/.test(texto);
  }

  window.thiaAudit = async function (acao, entidade, entidadeId, antes, depois, motivo, extra) {
    const database = db();
    if (!database || !tenantId()) return;
    const payload = {
      tenantId: tenantId(),
      usuario: userName(),
      perfil: role(),
      acao: acao || '',
      entidade: entidade || '',
      entidadeId: entidadeId || '',
      antes: antes || null,
      depois: depois || null,
      motivo: motivo || '',
      extra: extra || null,
      ts: Date.now(),
      createdAt: new Date().toISOString()
    };
    try {
      if (typeof database.batch === 'function') {
        const batch = database.batch();
        const lixeiraRef = database.collection('lixeira_auditoria').doc();
        const auditoriaRef = database.collection('auditoria').doc();
        batch.set(lixeiraRef, payload);
        batch.set(auditoriaRef, payload);
        await batch.commit();
        return;
      }
      await Promise.allSettled([
        database.collection('lixeira_auditoria').add(payload),
        database.collection('auditoria').add(payload)
      ]);
    } catch (e) { console.warn('[thiaAudit]', e); }
  };

  window.thiaNotify = async function (opts) {
    const database = db();
    if (!database || !tenantId()) return;
    const payload = Object.assign({
      tenantId: tenantId(),
      tipo: 'sistema',
      titulo: '',
      mensagem: '',
      destinoPerfil: 'admin',
      destinoUsuario: '',
      entidade: '',
      entidadeId: '',
      prioridade: 'normal',
      acaoSugerida: '',
      lida: false,
      ts: Date.now(),
      createdAt: new Date().toISOString()
    }, opts || {});
    try { await database.collection('notificacoes_live').add(payload); } catch (e) { console.warn('[thiaNotify]', e); }
  };

  function hideInternalAndFinance(root) {
    root = root || D;

    if (isCliente()) {
      root.querySelectorAll('[data-interno], .observacao-interna, .obs-interna, #blocoReais, #containerPecasReais').forEach(el => {
        el.style.display = 'none';
      });
    }

    if (isEquipe() || (isCliente() && !location.pathname.toLowerCase().includes('clienteoficial'))) {
      root.querySelectorAll('[data-financ], [data-role-hide*="financeiro"], #kpiComissao, #modalExtratoFunc').forEach(el => {
        el.style.display = 'none';
      });
    }

    if (isEquipe()) {
      root.querySelectorAll('td, th, span, button, small, b, strong, label').forEach(el => {
        if (!el || (el.children && el.children.length)) return;
        const txt = el.textContent || '';
        if (moneyRe.test(txt)) {
          if (el.id === 'kMinhaComissao') el.textContent = 'OCULTO';
          if (/\bR\$\s*\d/.test(txt)) el.textContent = txt.replace(/R\$\s*[\d.,]+/g, 'OCULTO');
        }
      });
      root.querySelectorAll('input, textarea').forEach(el => {
        if (el === D.activeElement) return;
        const txt = el.value || '';
        if (/\bR\$\s*\d/.test(txt)) el.value = txt.replace(/R\$\s*[\d.,]+/g, 'OCULTO');
      });
    }

    const reais = D.getElementById('blocoReais') || D.getElementById('containerPecasReais');
    if (reais && window._pecasReaisDesbloqueadas !== true) reais.style.display = 'none';
  }

  function installObserver() {
    hideInternalAndFinance(D);
    if (typeof MutationObserver === 'undefined' || !D.body || D.body.dataset.thiaCommercialObserver === '1') return;
    D.body.dataset.thiaCommercialObserver = '1';
    const runtime = window.ThiaRuntimeCoreV2613;
    const pendingRoots = new Set();
    const flush = () => {
      const roots = Array.from(pendingRoots);
      pendingRoots.clear();
      roots.forEach(root => hideInternalAndFinance(root));
    };
    const obs = new MutationObserver(muts => {
      muts.forEach(m => Array.from(m.addedNodes || []).forEach(node => {
        if (node?.nodeType === 1) pendingRoots.add(node);
      }));
      if (!pendingRoots.size) return;
      if (runtime?.scheduleDom) runtime.scheduleDom('commercial-visibility', flush, { delay:80, maxRetries:4 });
      else setTimeout(flush, 80);
    });
    obs.observe(D.body, { childList: true, subtree: true });
    window.__thiaCommercialObserver = obs;
  }

  function patchStatusNotifications() {
    const runtime = window.ThiaRuntimeCoreV2613;
    if (typeof window.moverStatusOS !== 'function') return;
    const factory = old => async function (id, novoStatus) {
      const lista = window.J?.os || window.dbOS || [];
      const antes = lista.find(o => o.id === id) || null;
      const ret = await old.apply(this, arguments);
      const depois = (window.J?.os || window.dbOS || []).find(o => o.id === id) || Object.assign({}, antes || {}, { status: novoStatus });
      if (novoStatus === 'Pronto' && (!antes || antes.status !== 'Pronto')) {
        await window.thiaNotify({
          tipo: 'os_pronta',
          titulo: 'Veiculo pronto',
          mensagem: `O.S. ${String(id || '').slice(-6).toUpperCase()} marcada como pronta. Conferir caixa e avisar cliente.`,
          destinoPerfil: 'admin',
          entidade: 'ordens_servico',
          entidadeId: id,
          prioridade: 'alta',
          acaoSugerida: 'Enviar aviso ao cliente'
        });
      }
      if (antes && antes.status !== novoStatus) {
        await window.thiaAudit('alteracao_status_os', 'ordens_servico', id, { status: antes.status }, { status: novoStatus }, '', { origem: 'moverStatusOS' });
      }
      return ret;
    };
    if (runtime?.wrapOnce) {
      runtime.wrapOnce('moverStatusOS', 'hardening-comercial-status', factory);
    } else if (!window.moverStatusOS.__thiaComercial) {
      const wrapped = factory(window.moverStatusOS);
      wrapped.__thiaComercial = true;
      window.moverStatusOS = wrapped;
    }
  }

  function patchObdMessage() {
    if (!location.pathname.toLowerCase().includes('cliente.html')) return;
    const warn = D.getElementById('obdWarnIOS');
    if (warn) {
      warn.textContent = 'Bluetooth OBD: no iOS/PWA o Web Bluetooth nao e suportado. Use Chrome no Android/Desktop. No APK, Bluetooth classico depende do plugin nativo ELM.';
    }
    if (typeof window.obdConectar === 'function' && !window.obdConectar.__thiaComercial) {
      const old = window.obdConectar;
      window.obdConectar = async function () {
        const hasNative = !!(window.Capacitor?.Plugins?.ELMBluetoothClassic);
        if (!hasNative && !navigator.bluetooth) {
          window.toast?.('Bluetooth indisponivel nesta plataforma. Use Chrome Android/Desktop ou entrada manual.', 'err');
          return;
        }
        return old.apply(this, arguments);
      };
      window.obdConectar.__thiaComercial = true;
    }
  }

  function htmlEscape(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function iaOsList() {
    if (Array.isArray(window.J?.os)) return window.J.os;
    if (Array.isArray(window.dbOS)) return window.dbOS;
    return [];
  }

  function iaVeiculos() {
    if (Array.isArray(window.J?.veiculos)) return window.J.veiculos;
    if (Array.isArray(window.dbVeiculos)) return window.dbVeiculos;
    return [];
  }

  function iaClientes() {
    if (Array.isArray(window.J?.clientes)) return window.J.clientes;
    if (Array.isArray(window.dbClientes)) return window.dbClientes;
    return [];
  }

  function iaArr(nome) {
    return Array.isArray(window.J?.[nome]) ? window.J[nome] : [];
  }

  function iaDateISO(v) {
    return String(v || '').slice(0, 10);
  }

  function iaMoney(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
    return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  function iaTenantSnapshotLines(canFinance) {
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    const osList = iaOsList();
    const estoque = iaArr('estoque');
    const financeiro = iaArr('financeiro');
    const nfs = iaArr('notasFiscaisEntrada');
    const vinculos = iaArr('nfItensVinculos');
    const pacotes = iaArr('pacotesBoletos');
    const fornecedores = iaArr('fornecedores');
    const cotacoes = iaArr('cotacoes') || iaArr('cotacoesPecas');
    const modulos = window.J?.oficina?.modulos || {};
    const abertas = osList.filter(o => !/entreg|cancel|recus|finaliz/i.test(String(o.status || '')));
    const prontas = osList.filter(o => /pronto|caixa|finaliz/i.test(String(o.status || '')));
    const critico = estoque.filter(p => (Number(p.qtd || 0) <= Number(p.min || p.minimo || 0)));
    const vencHoje = financeiro.filter(f => iaDateISO(f.venc || f.vencimento) === hojeISO && !/pago|liquidado|cancelado/i.test(String(f.status || '')));
    const vencido = financeiro.filter(f => {
      const d = iaDateISO(f.venc || f.vencimento);
      return d && d < hojeISO && !/pago|liquidado|cancelado/i.test(String(f.status || ''));
    });
    const linhas = [];
    linhas.push(`Tenant carregado: ${tenantId() || 'sem tenant'} | oficina ${window.J?.tnome || sessionStorage.getItem('j_tnome') || 'nao informada'}.`);
    linhas.push(`Volume carregado: OS ${osList.length}; abertas ${abertas.length}; prontas/finalizadas ${prontas.length}; clientes ${iaClientes().length}; veiculos ${iaVeiculos().length}; estoque ${estoque.length}; fornecedores ${fornecedores.length}; NFs ${nfs.length}; vinculos NF/OS ${vinculos.length}; pacotes boletos ${pacotes.length}; cotacoes ${cotacoes.length}.`);
    const modBloq = Object.entries(modulos).filter(([,v]) => v === false).map(([k]) => k);
    if (modBloq.length) linhas.push(`Modulos bloqueados no tenant: ${modBloq.slice(0,40).join(', ')}.`);
    if (critico.length) linhas.push(`Estoque critico: ${critico.slice(0,20).map(p => `${p.codigo || p.codigoFornecedor || ''} ${p.desc || p.descricao || ''} qtd ${p.qtd || 0} min ${p.min || p.minimo || 0}`).join(' | ')}.`);
    if (canFinance) {
      linhas.push(`Financeiro: vencem hoje ${vencHoje.length}; vencidos ${vencido.length}; total carregado ${financeiro.length}.`);
      if (vencHoje.length) linhas.push(`Boletos/titulos vencendo hoje: ${vencHoje.slice(0,20).map(f => `${f.desc || f.id} ${iaMoney(f.valor)} venc ${f.venc || f.vencimento}`).join(' | ')}.`);
      if (vencido.length) linhas.push(`Titulos vencidos: ${vencido.slice(0,20).map(f => `${f.desc || f.id} ${iaMoney(f.valor)} venc ${f.venc || f.vencimento}`).join(' | ')}.`);
    }
    if (nfs.length) linhas.push(`NFs recentes: ${nfs.slice(-12).map(n => `NF ${n.numero || '-'} ${n.fornecedorSnapshot?.nome || n.fornecedorNome || '-'} ${iaDateISO(n.dataNF || n.createdAt)} ${iaMoney(n.totalNF || n.totalItens)}`).join(' | ')}.`);
    if (pacotes.length && canFinance) linhas.push(`Pacotes de boletos: ${pacotes.slice(-12).map(p => `${p.numero || p.id} ${p.fornecedorNome || '-'} ${iaMoney(p.total)} ${p.status || 'Aberto'}`).join(' | ')}.`);
    return linhas;
  }

  function iaItemLabel(item) {
    return item?.desc || item?.descricao || item?.nome || item?.servico || item?.peca || item?.codigo || 'item sem descricao';
  }

  function iaAprovacaoItem(item) {
    const raw = String(item?.statusAprovacao || item?.aprovacao || item?.status || '').toLowerCase();
    if (item?.aprovado === true || /aprov/.test(raw)) return 'aprovado';
    if (item?.aprovado === false || /reprov|recus|negad|nao aprovado|não aprovado/.test(raw)) return 'nao aprovado';
    return 'orcado/pendente';
  }

  function iaExecucaoItem(item, os) {
    const key = item?.id || item?.uid || item?.codigo || item?.desc || item?.descricao || '';
    const mapa = os?.execucaoItens || os?.execucoesItens || {};
    const exec = item?.execucao || item?.statusExecucao || item?.execStatus || (key && mapa[key]) || null;
    const status = exec && typeof exec === 'object' ? (exec.status || exec.situacao || '') : exec;
    return status ? String(status) : 'sem execucao registrada';
  }

  function iaBuildContext(perfil, pergunta) {
    const osList = iaOsList();
    const veiculos = iaVeiculos();
    const clientes = iaClientes();
    const canFinance = canSeeFinance() && !['equipe', 'mecanico', 'cliente'].includes(perfil);
    const placaRe = /[A-Z]{3}[- ]?[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}[- ]?[0-9]{4}/ig;
    const placas = (String(pergunta || '').match(placaRe) || []).map(p => p.replace(/[^A-Z0-9]/ig, '').toUpperCase());
    const alvo = placas.length
      ? osList.filter(o => {
          const v = veiculos.find(x => x.id === o.veiculoId) || {};
          const placa = String(o.placa || v.placa || '').replace(/[^A-Z0-9]/ig, '').toUpperCase();
          return placas.includes(placa);
        })
      : osList.slice(-30);
    const linhas = [];
    linhas.push(`Perfil: ${perfil || 'admin'}`);
    linhas.push(`Oficina: ${window.J?.tnome || sessionStorage.getItem('j_tnome') || 'nao informada'}`);
    linhas.push('Regra de verdade: item orcado nao e item aprovado; item aprovado nao e item executado; peca comprada nao e peca instalada; so considere executado quando houver status de execucao.');
    linhas.push('Se faltar dado, responda literalmente que nao ha dado registrado.');
    if (perfil === 'equipe' || perfil === 'mecanico') linhas.push('Perfil equipe: nao exponha valores, custos, faturamento, margens, comissoes ou financeiro.');
    linhas.push(...iaTenantSnapshotLines(canFinance));
    if (!alvo.length) linhas.push('Nenhuma O.S. correspondente encontrada no contexto local.');
    alvo.slice(0, 30).forEach(o => {
      const v = veiculos.find(x => x.id === o.veiculoId) || {};
      const c = clientes.find(x => x.id === (o.clienteId || v.clienteId)) || {};
      linhas.push(`OS ${String(o.numero || o.id || '').slice(-8)} | placa ${o.placa || v.placa || 'S/P'} | veiculo ${o.veiculo || v.modelo || o.modelo || o.tipoVeiculo || 'N/I'} | cliente ${c.nome || o.cliente || 'N/I'} | status ${o.status || 'N/I'} | etapa ${o.etapa || 'N/I'} | data ${o.data || o.createdAt || 'N/I'}`);
      if (o.desc || o.relato) linhas.push(`Relato: ${o.desc || o.relato}`);
      if (o.diagnostico) linhas.push(`Diagnostico: ${o.diagnostico}`);
      const pecas = (Array.isArray(o.pecas) ? o.pecas : []).filter(p => !(clienteOficialOS(o) && pecaRealProtegida(o, p)));
      const servicos = Array.isArray(o.servicos) ? o.servicos : [];
      pecas.slice(0, 20).forEach(p => linhas.push(`Peca: ${iaItemLabel(p)} | aprovacao ${iaAprovacaoItem(p)} | execucao ${iaExecucaoItem(p, o)}`));
      servicos.slice(0, 20).forEach(s => linhas.push(`Servico: ${iaItemLabel(s)} | aprovacao ${iaAprovacaoItem(s)} | execucao ${iaExecucaoItem(s, o)}`));
      if (canFinance && segredo177Ativo() && Array.isArray(o.pecasReais) && o.pecasReais.length) {
        o.pecasReais.slice(0, 20).forEach(p => linhas.push(`Auditoria interna peca real: ${iaItemLabel(p)} | codigo ${p.codigo || p.codigoFornecedor || p.codigoComercial || 'N/I'} | NF ${p.nf || p.nfNumero || 'N/I'} | fornecedor ${p.fornecedor || 'N/I'} | compra ${p.dataCompra || p.dataNF || 'N/I'} | status ${p.statusAplicacao || 'comprada/vinculada, nao executada'}`));
      }
      if (Array.isArray(o.timeline) && o.timeline.length) {
        const timelineVisivel = segredo177Ativo() ? o.timeline : o.timeline.filter(t => !eventoPecaReal(t));
        linhas.push('Timeline recente: ' + timelineVisivel.slice(-5).map(t => `${t.data || t.dt || t.createdAt || ''} ${t.acao || t.status || ''}`).join(' | '));
      }
      if (canFinance) {
        const U = window.JOS || window.JarvisOSUtils || {};
        const totalSeguro = clienteOficialOS(o) && typeof U.getValorOrcamento === 'function' ? U.getValorOrcamento(o, c) : (o.total || o.valorTotal || 0);
        const aprovadoSeguro = clienteOficialOS(o) && typeof U.getValorAprovado === 'function' ? U.getValorAprovado(o, c) : (o.totalAprovado || o.valorAprovado || 0);
        linhas.push(`Financeiro OS: total ${totalSeguro}; aprovado ${aprovadoSeguro}; nao aprovado ${o.totalNaoAprovado || 0}.`);
      }
    });
    if (canFinance && Array.isArray(window.J?.financeiro)) {
      linhas.push(`Financeiro geral: ${window.J.financeiro.length} lancamentos carregados no painel.`);
    }
    return linhas.join('\n');
  }

  function iaFallback(pergunta, perfil, erro) {
    let ctx = '';
    try {
      ctx = iaBuildContext(perfil, pergunta);
    } catch (e) {
      console.warn('[thIAguinho IA fallback]', e);
      const msgErro = erro || e?.message || 'falha ao montar contexto local';
      return `API indisponivel (${htmlEscape(msgErro)}). Resposta local: houve uma falha ao cruzar os dados carregados, mas nao vou travar o chat. Revise se ha O.S., estoque e financeiro sincronizados no painel.`;
    }
    const achouOS = !/Nenhuma O\.S\./.test(ctx);
    const intro = erro ? `API indisponivel (${htmlEscape(erro)}). Resposta local com dados carregados:<br>` : 'Resposta local com dados carregados:<br>';
    if (!achouOS) {
      return intro + 'Nao ha dado registrado suficiente para afirmar troca, execucao, compra ou financeiro. Informe placa, numero da O.S. ou abra a O.S. correta para eu cruzar os dados.';
    }
    const resumo = ctx.split('\n').slice(0, 18).map(htmlEscape).join('<br>');
    return intro + resumo + '<br><br><strong>Regra aplicada:</strong> nao vou afirmar que uma peca foi trocada ou instalada sem status de execucao registrado.';
  }

  function iaAddUser(txt) {
    if (typeof window._iaMsgUser === 'function') return window._iaMsgUser(txt);
    if (typeof window.adicionarMsgIA === 'function') return window.adicionarMsgIA('user', htmlEscape(txt));
    const c = D.getElementById('iaMsgs'); if (!c) return;
    const d = D.createElement('div'); d.className = 'ia-msg user'; d.textContent = txt; c.appendChild(d); c.scrollTop = c.scrollHeight;
  }

  function iaAddBot(html) {
    if (typeof window._iaMsgBot === 'function') return window._iaMsgBot(html);
    if (typeof window.adicionarMsgIA === 'function') {
      window.adicionarMsgIA('bot', html);
      return '__legacy_bot__';
    }
    const c = D.getElementById('iaMsgs'); if (!c) return null;
    const id = 'thia-ia-' + Date.now();
    const d = D.createElement('div'); d.id = id; d.className = 'ia-msg bot'; d.innerHTML = '<strong>thIAguinho:</strong> ' + html; c.appendChild(d); c.scrollTop = c.scrollHeight;
    return id;
  }

  function iaReplaceBot(id, html) {
    if (typeof window._iaReplace === 'function' && id && id !== '__legacy_bot__') return window._iaReplace(id, html);
    if (id === '__legacy_bot__') {
      const c = D.getElementById('iaMsgs');
      const el = c?.lastElementChild;
      if (el) el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
      return;
    }
    const el = id ? D.getElementById(id) : null;
    if (el) el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
  }

  async function iaPerguntarComercial(inputId, perfil) {
    const inp = D.getElementById(inputId || 'iaInput');
    const msg = inp?.value?.trim();
    if (!msg) return;
    inp.value = '';
    iaAddUser(msg);
    const lid = iaAddBot('<span class="j-spinner"></span> Analisando contexto real...');
    try {
      if (typeof window.thiaCarregarCerebroGlobal === 'function') await window.thiaCarregarCerebroGlobal();
      const local = typeof window.thiaResponderLocalAsync === 'function'
        ? await window.thiaResponderLocalAsync(msg, { perfil })
        : (typeof window.thiaResponderLocal === 'function' ? window.thiaResponderLocal(msg, { perfil }) : iaFallback(msg, perfil, 'motor local indisponivel'));
      iaReplaceBot(lid, local);
      return;
    } catch (e) {
      console.warn('[thIAguinho IA local]', e);
      iaReplaceBot(lid, iaFallback(msg, perfil, e.message || e));
    }
  }

  function patchIAComercial() {
    const path = location.pathname.toLowerCase();
    const input = D.getElementById('iaInput');
    if (!input) return;
    window.thiaIAAsk = iaPerguntarComercial;
    const bindEnter = (fnName) => {
      if (input.__thiaIAEnterBound === fnName) return;
      input.__thiaIAEnterBound = fnName;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && typeof window[fnName] === 'function') window[fnName]();
      });
    };
    if (path.includes('jarvis')) {
      window.iaPerguntar = function () { return iaPerguntarComercial('iaInput', canSeeFinance() ? 'jarvis' : role()); };
      window.iaPerguntar.__thiaComercial = true;
      bindEnter('iaPerguntar');
    }
    if (path.includes('equipe')) {
      window.iaEnviar = function () { return iaPerguntarComercial('iaInput', 'equipe'); };
      window.iaEnviar.__thiaComercial = true;
      bindEnter('iaEnviar');
    }
    if (path.includes('superadmin')) {
      window.iaPerguntar = function () { return iaPerguntarComercial('iaInput', 'superadmin'); };
      window.iaEnviar = window.iaPerguntar;
      window.iaPerguntar.__thiaComercial = true;
      bindEnter('iaPerguntar');
    }
  }

  function init() {
    if (D.documentElement.dataset.thiaCommercialInit === '1') return;
    D.documentElement.dataset.thiaCommercialInit = '1';
    installObserver();
    patchStatusNotifications();
    patchObdMessage();
    patchIAComercial();
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
