/*
 * thIAguinho SaaS — V26.2
 * Usabilidade do painel Equipe:
 * - itens finalizados saem da fila principal e ficam recolhidos;
 * - atalho de um toque para concluir/reabrir;
 * - orçamento completo permanece disponível, porém recolhido;
 * - nenhuma informação é apagada da O.S.
 */
(function (W, D) {
  'use strict';

  const originalApply = W.aplicarMarcadoresAprovacaoEquipe;
  const originalSave = W.salvarExecucaoAprovadosEquipe;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function roleAtual() {
    try { return String(J?.role || J?.cargo || '').toLowerCase(); }
    catch (_) { return ''; }
  }

  function ehGestor() {
    return ['gerente', 'gestor', 'admin', 'superadmin', 'dono'].includes(roleAtual());
  }

  function statusFinalizado(status) {
    return /^(executado|executado_obs|executado_com_observacao|concluido|finalizado|feito|realizado|trocada|nao_executado|nao_trocada|nao_encontrada|cancelado)$/i
      .test(String(status || '').trim());
  }

  function statusOptions(tipo, atual) {
    const isPeca = /peca|peça/i.test(String(tipo || ''));
    const opts = isPeca ? [
      ['pendente', 'Pendente'],
      ['em_execucao', 'Separando / aplicando'],
      ['executado', 'Peça aplicada'],
      ['trocada', 'Peça trocada / aplicada'],
      ['executado_obs', 'Aplicada com observação'],
      ['nao_encontrada', 'Peça não encontrada'],
      ['nao_trocada', 'Peça não aplicada'],
      ['nao_executado', 'Não executado'],
      ['cancelado', 'Cancelado']
    ] : [
      ['pendente', 'Pendente'],
      ['em_execucao', 'Em execução'],
      ['executado', 'Serviço executado'],
      ['executado_obs', 'Executado com observação'],
      ['nao_executado', 'Não executado'],
      ['cancelado', 'Cancelado']
    ];
    const valorAtual = String(atual || 'pendente');
    return opts.map(([v, l]) => `<option value="${v}" ${valorAtual === v ? 'selected' : ''}>${l}</option>`).join('');
  }

  function garantirEstilos() {
    if (D.getElementById('equipe-usabilidade-v262-style')) return;
    const style = D.createElement('style');
    style.id = 'equipe-usabilidade-v262-style';
    style.textContent = `
      #resumoAprovacaoEquipe.equipe-tarefas-v262{margin-bottom:14px!important;padding:12px!important;overflow:hidden!important;}
      .equipe-tarefas-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
      .equipe-tarefas-titulo{font-family:var(--fd);font-size:.92rem;font-weight:800;color:var(--cyan);letter-spacing:1px;}
      .equipe-tarefas-chips{display:flex;gap:6px;flex-wrap:wrap;}
      .equipe-tarefa-chip{font-family:var(--fm);font-size:.58rem;letter-spacing:.6px;padding:4px 8px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.03);}
      .equipe-tarefa-chip.pendente{color:var(--warn);border-color:rgba(255,184,0,.28);}
      .equipe-tarefa-chip.ok{color:var(--success);border-color:rgba(0,255,136,.25);}
      .equipe-tarefas-ajuda{font-family:var(--fm);font-size:.62rem;line-height:1.55;color:var(--muted2);margin:0 0 10px;}
      .equipe-tarefas-lista{display:grid;gap:8px;min-width:0;}
      .equipe-tarefa-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:10px;align-items:center;min-width:0;padding:10px;border:1px solid rgba(255,255,255,.11);border-radius:5px;background:rgba(0,0,0,.16);box-sizing:border-box;}
      .equipe-tarefa-row.finalizada{background:rgba(0,255,136,.045);opacity:.9;}
      .equipe-tarefa-desc{min-width:0;overflow-wrap:anywhere;font-size:.78rem;line-height:1.45;color:var(--text);}
      .equipe-tarefa-desc b{color:var(--cyan);font-family:var(--fm);font-size:.62rem;letter-spacing:.7px;}
      .equipe-tarefa-controles{display:grid;grid-template-columns:1fr;gap:6px;min-width:0;}
      .equipe-tarefa-controles .j-select,.equipe-tarefa-controles .j-input{width:100%!important;min-width:0!important;box-sizing:border-box!important;}
      .equipe-tarefa-acoes{display:grid;grid-template-columns:1fr 1fr;gap:6px;min-width:0;}
      .equipe-tarefa-acoes button{width:100%;min-width:0;min-height:36px;white-space:normal;line-height:1.15;}
      .equipe-finalizados details,.equipe-nao-aprovados details{border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:8px 10px;background:rgba(0,0,0,.10);}
      .equipe-finalizados summary,.equipe-nao-aprovados summary{cursor:pointer;font-family:var(--fm);font-size:.65rem;letter-spacing:.7px;color:var(--muted2);font-weight:700;}
      .equipe-orcamento-toggle{display:flex;justify-content:flex-end;margin-top:10px;}
      .equipe-orcamento-toggle button{max-width:100%;white-space:normal;}
      .equipe-save-bar{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px;}
      .equipe-save-bar button{min-height:40px;}
      @media(max-width:760px){
        .equipe-tarefa-row{grid-template-columns:1fr!important;padding:9px!important;}
        .equipe-tarefa-acoes{grid-template-columns:1fr!important;}
        .equipe-tarefas-head{align-items:flex-start!important;}
        .equipe-tarefas-chips{width:100%;}
        .equipe-save-bar{display:grid!important;grid-template-columns:1fr!important;}
        .equipe-save-bar button,.equipe-orcamento-toggle button{width:100%!important;}
      }
    `;
    D.head.appendChild(style);
  }

  function caixasOrcamento() {
    return [
      D.getElementById('containerServicos')?.parentElement,
      D.getElementById('containerPecas')?.parentElement
    ].filter(Boolean);
  }

  function aplicarVisibilidadeOrcamento() {
    const aberto = !!W._equipeOrcamentoDetalhadoAbertoV262;
    caixasOrcamento().forEach(el => {
      el.style.display = aberto ? '' : 'none';
      el.setAttribute('data-equipe-detalhe-orcamento', '1');
    });
    const btn = D.getElementById('btnToggleOrcamentoEquipeV262');
    if (btn) btn.textContent = aberto ? 'OCULTAR EDIÇÃO DO ORÇAMENTO' : 'EDITAR / ADICIONAR SERVIÇO OU PEÇA';
  }

  W.toggleOrcamentoEquipeV262 = function () {
    W._equipeOrcamentoDetalhadoAbertoV262 = !W._equipeOrcamentoDetalhadoAbertoV262;
    aplicarVisibilidadeOrcamento();
    if (W._equipeOrcamentoDetalhadoAbertoV262) {
      caixasOrcamento()[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  function mecanicoNome(os, mecId) {
    try {
      const lista = typeof W.mecanicosEquipeDaOS === 'function' ? W.mecanicosEquipeDaOS(os) : [];
      return lista.find(m => String(m.id) === String(mecId || ''))?.nome || '';
    } catch (_) { return ''; }
  }

  function itemRowHTML(it, registro, os, finalizado) {
    const mecId = registro?.mecId || registro?.responsavelId || it?.mecId || it?.responsavelId || os?.mecId || '';
    const nomeMec = mecanicoNome(os, mecId);
    const tipoLabel = it.labelTipo || it.tipo || 'ITEM';
    const codigo = it.codigo ? `[${esc(it.codigo)}] ` : '';
    const tempo = it.tempo ? `<br><small style="color:var(--muted);">TMO ${esc(String(it.tempo).replace('.', ','))}h</small>` : '';
    const acaoRapida = finalizado
      ? `<button type="button" class="btn-outline" onclick="window.reabrirItemEquipeV262(this)">↩ REABRIR</button>`
      : `<button type="button" class="btn-success" onclick="window.concluirItemEquipeV262(this)">✓ CONCLUIR</button>`;
    return `<div class="execucao-aprovado-row equipe-tarefa-row ${finalizado ? 'finalizada' : ''}" data-key="${esc(it.key)}" data-tipo="${esc(it.tipo)}" data-mec-id="${esc(mecId)}">
      <div class="equipe-tarefa-desc">
        <b>${esc(tipoLabel)}</b><br>${codigo}${esc(it.desc || '-')}${tempo}
        ${nomeMec ? `<br><small style="color:var(--muted2);">Responsável: ${esc(nomeMec)}</small>` : ''}
      </div>
      <div class="equipe-tarefa-controles">
        <input type="hidden" class="exec-mec" value="${esc(mecId)}">
        <select class="j-select exec-status" onchange="window.reorganizarExecucaoEquipeV262()">${statusOptions(it.tipo, registro?.status || 'pendente')}</select>
        <input class="j-input exec-obs" value="${esc(registro?.obs || '')}" placeholder="Observação interna (se necessário)">
        <div class="equipe-tarefa-acoes">
          ${acaoRapida}
          <button type="button" class="btn-ghost" onclick="window.salvarExecucaoAprovadosEquipe('${esc(os?.id || '')}')">SALVAR</button>
        </div>
      </div>
    </div>`;
  }

  W.reorganizarExecucaoEquipeV262 = function () {
    const pend = D.getElementById('execPendentesEquipeV262');
    const fin = D.getElementById('execFinalizadosListaEquipeV262');
    if (!pend || !fin) return;
    D.querySelectorAll('#resumoAprovacaoEquipe .execucao-aprovado-row').forEach(row => {
      const st = row.querySelector('.exec-status')?.value || 'pendente';
      const destino = statusFinalizado(st) ? fin : pend;
      destino.appendChild(row);
      row.classList.toggle('finalizada', statusFinalizado(st));
      const quick = row.querySelector('.equipe-tarefa-acoes button:first-child');
      if (quick) {
        if (statusFinalizado(st)) {
          quick.className = 'btn-outline';
          quick.textContent = '↩ REABRIR';
          quick.setAttribute('onclick', 'window.reabrirItemEquipeV262(this)');
        } else {
          quick.className = 'btn-success';
          quick.textContent = '✓ CONCLUIR';
          quick.setAttribute('onclick', 'window.concluirItemEquipeV262(this)');
        }
      }
    });
    const qtdPend = pend.querySelectorAll('.execucao-aprovado-row').length;
    const qtdFin = fin.querySelectorAll('.execucao-aprovado-row').length;
    const cPend = D.getElementById('execPendentesCountEquipeV262');
    if (cPend) cPend.textContent = String(qtdPend);
    D.querySelectorAll('[data-equipe-final-count-v262]').forEach(el => { el.textContent = String(qtdFin); });
    const empty = D.getElementById('execPendentesEmptyEquipeV262');
    if (empty) empty.style.display = qtdPend ? 'none' : 'block';
  };

  W.concluirItemEquipeV262 = async function (btn) {
    const row = btn?.closest('.execucao-aprovado-row');
    if (!row) return;
    const select = row.querySelector('.exec-status');
    if (select) select.value = 'executado';
    btn.disabled = true;
    try { await W.salvarExecucaoAprovadosEquipe(W._equipeOSAtual?.id || D.getElementById('osId')?.value || ''); }
    finally { btn.disabled = false; }
  };

  W.reabrirItemEquipeV262 = async function (btn) {
    const row = btn?.closest('.execucao-aprovado-row');
    if (!row) return;
    const select = row.querySelector('.exec-status');
    if (select) select.value = 'pendente';
    btn.disabled = true;
    try { await W.salvarExecucaoAprovadosEquipe(W._equipeOSAtual?.id || D.getElementById('osId')?.value || ''); }
    finally { btn.disabled = false; }
  };

  W.aplicarMarcadoresAprovacaoEquipe = function (os) {
    garantirEstilos();
    if (ehGestor()) {
      caixasOrcamento().forEach(el => { el.style.display = ''; });
      return typeof originalApply === 'function' ? originalApply(os) : undefined;
    }

    // Mantém os badges e todas as regras existentes; troca apenas a apresentação da área de execução.
    if (typeof originalApply === 'function') originalApply(os);
    D.getElementById('resumoAprovacaoEquipe')?.remove();

    const U = W.JOS || W.JarvisOSUtils || {};
    if (!U.hasApproval?.(os)) {
      caixasOrcamento().forEach(el => { el.style.display = ''; });
      return;
    }

    if (W._equipeOrcamentoOsIdV262 !== String(os?.id || '')) {
      W._equipeOrcamentoOsIdV262 = String(os?.id || '');
      W._equipeOrcamentoDetalhadoAbertoV262 = false;
    }

    const keys = U.getApprovedKeys?.(os) || new Set();
    const cliente = (typeof dbClientes !== 'undefined' ? dbClientes : []).find(c => String(c.id) === String(os?.clienteId || ''));
    const todos = U.buildBudgetItems?.(os, cliente) || [];
    const itens = todos.filter(it => {
      if (String(it.tipo || '').toLowerCase().includes('serv')) {
        return W.equipeServicoPertenceAoUsuarioV22?.((os?.servicos || [])[it.index], os) !== false;
      }
      return true;
    });
    const aprovados = itens.filter(it => keys.has(it.key));
    const naoAprovados = itens.filter(it => !keys.has(it.key));
    const exec = os?.execucaoItens || {};
    const pendentes = aprovados.filter(it => !statusFinalizado(exec[it.key]?.status));
    const finalizados = aprovados.filter(it => statusFinalizado(exec[it.key]?.status));

    const box = D.createElement('div');
    box.id = 'resumoAprovacaoEquipe';
    box.className = 'equipe-tarefas-v262';
    box.style.cssText = 'background:rgba(0,212,255,.055);border:1px solid rgba(0,212,255,.22);border-radius:5px;';
    box.innerHTML = `
      <div class="equipe-tarefas-head">
        <div class="equipe-tarefas-titulo">MINHAS TAREFAS DESTA O.S.</div>
        <div class="equipe-tarefas-chips">
          <span class="equipe-tarefa-chip pendente"><span id="execPendentesCountEquipeV262">${pendentes.length}</span> A FAZER</span>
          <span class="equipe-tarefa-chip ok"><span data-equipe-final-count-v262>${finalizados.length}</span> CONCLUÍDO(S)</span>
        </div>
      </div>
      <p class="equipe-tarefas-ajuda">Use <b>CONCLUIR</b> para finalizar rapidamente. O item sai da fila principal, mas continua registrado no histórico e pode ser reaberto.</p>
      <div id="execPendentesEquipeV262" class="equipe-tarefas-lista">
        ${pendentes.map(it => itemRowHTML(it, exec[it.key] || {}, os, false)).join('')}
      </div>
      <div id="execPendentesEmptyEquipeV262" style="${pendentes.length ? 'display:none;' : ''}padding:16px;text-align:center;color:var(--success);font-family:var(--fm);font-size:.68rem;border:1px dashed rgba(0,255,136,.25);border-radius:4px;">✓ TODOS OS ITENS VISÍVEIS FORAM CONCLUÍDOS</div>
      <div class="equipe-finalizados" style="margin-top:10px;">
        <details>
          <summary>CONCLUÍDOS / OCULTOS (<span data-equipe-final-count-v262>${finalizados.length}</span>)</summary>
          <div id="execFinalizadosListaEquipeV262" class="equipe-tarefas-lista" style="margin-top:8px;">${finalizados.map(it => itemRowHTML(it, exec[it.key] || {}, os, true)).join('')}</div>
        </details>
      </div>
      ${naoAprovados.length ? `<div class="equipe-nao-aprovados" style="margin-top:8px;"><details><summary>NÃO APROVADOS — SOMENTE HISTÓRICO (${naoAprovados.length})</summary><div style="display:grid;gap:6px;margin-top:8px;">${naoAprovados.map(it => `<div style="padding:8px;border:1px solid rgba(255,184,0,.18);border-radius:3px;color:var(--muted2);font-size:.72rem;">${esc(it.desc || '-')}</div>`).join('')}</div></details></div>` : ''}
      <div class="equipe-save-bar">
        <button type="button" class="btn-primary" onclick="window.salvarExecucaoAprovadosEquipe('${esc(os?.id || '')}')">SALVAR ALTERAÇÕES</button>
      </div>
      <div class="equipe-orcamento-toggle"><button id="btnToggleOrcamentoEquipeV262" type="button" class="btn-outline" onclick="window.toggleOrcamentoEquipeV262()">EDITAR / ADICIONAR SERVIÇO OU PEÇA</button></div>
    `;

    const alvo = D.getElementById('containerServicos')?.parentElement;
    if (alvo) alvo.insertAdjacentElement('beforebegin', box);
    aplicarVisibilidadeOrcamento();
    W.reorganizarExecucaoEquipeV262();
  };

  W.salvarExecucaoAprovadosEquipe = async function (osId) {
    if (ehGestor() && typeof originalSave === 'function') return originalSave(osId);
    if (!osId) { W.toast?.('Salve a O.S. antes de marcar execução.', 'warn'); return; }

    const osAtual = (typeof dbOS !== 'undefined' ? dbOS : []).find(x => String(x.id) === String(osId)) || W._equipeOSAtual || {};
    const execucaoItens = { ...(osAtual.execucaoItens || {}) };
    const rows = D.querySelectorAll('#resumoAprovacaoEquipe .execucao-aprovado-row');
    if (!rows.length) { W.toast?.('Nenhum item aprovado para atualizar.', 'warn'); return; }

    for (const row of rows) {
      const st = row.querySelector('.exec-status')?.value || 'pendente';
      const obs = (row.querySelector('.exec-obs')?.value || '').trim();
      if (['executado_obs', 'nao_executado', 'cancelado'].includes(st) && !obs) {
        W.toast?.('Informe uma observação para este status.', 'warn');
        row.querySelector('.exec-obs')?.focus();
        return;
      }
    }

    let alterados = 0;
    rows.forEach(row => {
      const key = row.dataset.key;
      if (!key) return;
      const anterior = execucaoItens[key] || {};
      const mecId = row.querySelector('.exec-mec')?.value || row.dataset.mecId || anterior.mecId || J?.fid || '';
      const obs = (row.querySelector('.exec-obs')?.value || '').trim();
      const status = row.querySelector('.exec-status')?.value || 'pendente';
      const nome = mecanicoNome(osAtual, mecId) || anterior.mecNome || J?.nome || '';
      if (String(anterior.status || 'pendente') !== String(status) || String(anterior.obs || '') !== obs || String(anterior.mecId || '') !== String(mecId)) alterados++;
      execucaoItens[key] = {
        ...anterior,
        key,
        tipo: row.dataset.tipo || anterior.tipo || '',
        status,
        obs,
        mecId,
        mecNome: nome,
        responsavelId: mecId,
        responsavelNome: nome,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorId: J?.fid || '',
        atualizadoPor: J?.nome || 'Equipe',
        atualizadoPorTipo: J?.role || 'equipe'
      };
    });

    if (!alterados) {
      W.reorganizarExecucaoEquipeV262();
      W.toast?.('Nenhuma alteração nova para salvar.', 'warn');
      return;
    }

    const agora = new Date().toISOString();
    const timeline = Array.isArray(osAtual.timeline) ? osAtual.timeline.slice() : [];
    timeline.push({ dt: agora, user: J?.nome || 'Equipe', acao: `Atualizou ${alterados} item(ns) da execução da O.S.` });

    try {
      await db.collection('ordens_servico').doc(osId).update({ execucaoItens, timeline, updatedAt: agora });
      osAtual.execucaoItens = execucaoItens;
      osAtual.timeline = timeline;
      osAtual.updatedAt = agora;
      W._equipeOSAtual = osAtual;
      W.aplicarMarcadoresAprovacaoEquipe(osAtual);
      W.toast?.('✓ Execução atualizada. Itens concluídos foram recolhidos.', 'ok');
    } catch (erro) {
      console.error('[V26.2] Falha ao salvar execução da equipe:', erro);
      W.toast?.('Não foi possível salvar a execução. Tente novamente.', 'err');
      throw erro;
    }
  };

  garantirEstilos();
})(window, document);
