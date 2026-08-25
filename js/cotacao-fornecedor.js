(function () {
  'use strict';

  const W = window;
  const D = document;
  const params = new URLSearchParams(W.location.search);
  const token = (params.get('token') || '').trim();
  const tenant = (params.get('tenant') || params.get('t') || '').trim();
  const cfgParam = (params.get('fcfg') || '').trim();
  let db = null;
  let dbCentral = null;
  let dbTenant = null;
  let cotacao = null;

  function $(id) { return D.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function status(msg, type) {
    const box = $('statusMsg');
    if (!box) return;
    box.className = 'status ' + (type || 'warn');
    box.textContent = msg;
  }
  function fmtDate(d) {
    if (!d) return '-';
    const s = String(d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [a, m, dia] = s.split('-');
      return dia + '/' + m + '/' + a;
    }
    return s;
  }
  function isExpired(data) {
    if (!data) return true;
    if (String(data.status || '').toLowerCase() === 'fechada') return true;
    const exp = data.expiraEm || '';
    if (exp && exp < new Date().toISOString().slice(0, 10)) return true;
    return false;
  }
  function itensCotacao(data) {
    const itens = Array.isArray(data?.itens) && data.itens.length ? data.itens : [data?.item || {}];
    return itens.map((item, idx) => Object.assign({ key: item.key || data?.itemKeys?.[idx] || data?.itemKey || ('item-' + idx) }, item));
  }
  function tituloItem(item) {
    return (item.codigo ? '[' + item.codigo + '] ' : '') + (item.desc || item.descricao || 'Peca solicitada');
  }

  function dbProject(database) {
    try { return database?.app?.options?.projectId || ''; } catch (_) { return ''; }
  }
  function addDbUnico(lista, database) {
    if (!database) return;
    const project = dbProject(database);
    if (lista.some(item => dbProject(item) === project && project)) return;
    lista.push(database);
  }
  function decodeFirebaseConfigParam() {
    if (!cfgParam) return null;
    try {
      let b64 = cfgParam.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = decodeURIComponent(escape(atob(b64)));
      const cfg = JSON.parse(json);
      return cfg && cfg.apiKey && cfg.projectId ? cfg : null;
    } catch (err) {
      console.warn('Config Firebase do link invalida', err);
      return null;
    }
  }
  function prepararBancoPorConfig(cfg) {
    if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
    try {
      sessionStorage.setItem('j_firebase_config', JSON.stringify(cfg));
      return W.initFirebase();
    } catch (err) {
      console.warn('Banco informado no link indisponivel', err);
      return null;
    }
  }
  async function prepararPortalPublico() {
    try {
      dbCentral = W.initCentralFirebase ? W.initCentralFirebase() : W.initFirebase();
      db = dbCentral;
    } catch (err) {
      console.warn('Firebase central da cotacao indisponivel', err);
      db = W.initFirebase();
      dbCentral = db;
    }
    const cfg = decodeFirebaseConfigParam();
    if (cfg) dbTenant = prepararBancoPorConfig(cfg);
  }
  function prepararBancoOficina(data) {
    const cfg = data?.firebaseConfig || null;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return;
    try {
      sessionStorage.setItem('j_firebase_config', JSON.stringify(cfg));
      dbTenant = W.initFirebase();
    } catch (err) {
      console.warn('Banco da oficina indisponivel para resposta da cotacao', err);
    }
  }

  function renderCotacao(data) {
    cotacao = data;
    $('loadingCard').classList.add('hide');
    $('cotacaoCard').classList.remove('hide');
    $('formCard').classList.remove('hide');

    const itens = itensCotacao(data);
    const item = itens[0] || {};
    const veic = data.veiculo || {};
    $('oficinaNome').textContent = data.oficinaNome || 'Oficina';
    $('pecaTitulo').innerHTML = itens.length > 1 ? esc(itens.length + ' pecas solicitadas') : esc(tituloItem(item));
    $('pecaObs').textContent = data.observacao || 'Preencha a cotação com os dados reais disponíveis.';
    $('pecaQtd').textContent = itens.length > 1 ? String(itens.length) + ' itens' : String(item.qtd || 1);
    $('veiculoInfo').textContent = [veic.prefixo ? 'Prefixo ' + veic.prefixo : '', veic.placa ? 'Placa ' + veic.placa : '', veic.nome || 'Veiculo'].filter(Boolean).join(' / ');
    if ($('veiculoPlacaPrefixo')) $('veiculoPlacaPrefixo').textContent = [veic.placa ? 'Placa ' + veic.placa : '', veic.prefixo ? 'Prefixo ' + veic.prefixo : ''].filter(Boolean).join(' / ') || '-';
    if ($('veiculoAnoCor')) $('veiculoAnoCor').textContent = [veic.ano || '', veic.cor || ''].filter(Boolean).join(' / ') || '-';
    if ($('veiculoChassi')) $('veiculoChassi').textContent = veic.chassi || veic.chassis || '-';
    if ($('veiculoTipoKm')) $('veiculoTipoKm').textContent = [veic.tipo || '', veic.km ? 'KM ' + veic.km : ''].filter(Boolean).join(' / ') || '-';
    if ($('veiculoCambioMotor')) $('veiculoCambioMotor').textContent = [
      veic.cambioLabel || veic.cambio || veic.transmissao || '',
      veic.valvulasLabel || veic.valvulas || veic.motorValvulas || '',
      veic.complementoTecnico || '',
      veic.infoManualPendente ? 'oficina complementará dados pendentes pelo WhatsApp' : ''
    ].filter(Boolean).join(' / ') || '-';
    $('prioridadeInfo').textContent = data.prioridade || 'normal';
    $('validadeInfo').textContent = fmtDate(data.expiraEm);
    $('respNome').value = data.fornecedorNome || '';
    const itensBox = $('itensCotacao');
    if (itensBox) {
      itensBox.innerHTML = itens.map((it, idx) => `
        <div class="cot-item-resposta" data-item-key="${esc(it.key || '')}">
          <div class="cot-item-head">
            <strong>${esc(tituloItem(it))}</strong>
            <small>Qtd ${esc(it.qtd || 1)}</small>
          </div>
          <div class="grid">
            <div><label>Valor unitário</label><input class="item-valor" inputmode="decimal" placeholder="0,00" ${idx === 0 ? 'autofocus' : ''}></div>
            <div><label>Marca</label><input class="item-marca" placeholder="Marca ofertada"></div>
            <div><label>Modelo / código</label><input class="item-modelo" placeholder="Modelo, linha ou código ofertado"></div>
            <div><label>Disponibilidade</label><select class="item-disponibilidade"><option>Disponível imediato</option><option>Disponível hoje</option><option>Encomenda</option><option>Indisponível</option></select></div>
          </div>
          <div class="grid" style="margin-top:10px;">
            <div><label>Prazo</label><input class="item-prazo" placeholder="Ex: 2h, hoje, 1 dia"></div>
            <div><label>Observação do item</label><input class="item-observacao" placeholder="Garantia, alternativo, original..."></div>
          </div>
        </div>`).join('');
      const legacy = D.querySelector('.legacy-single-fields');
      if (legacy) legacy.classList.add('hide');
    }

    if (isExpired(data)) {
      status('Esta cotação está vencida ou fechada. Fale com a oficina antes de enviar.', 'warn');
      $('btnEnviar').disabled = true;
    }
  }

  async function carregar() {
    if (!token) {
      $('loadingCard').innerHTML = '<strong>Link incompleto.</strong><p class="sub">O token da cotação não foi informado.</p>';
      return;
    }
    await prepararPortalPublico();
    try {
      let snap = await db.collection('cotacoes_publicas').doc(token).get();
      if (!snap.exists && dbTenant && dbProject(dbTenant) !== dbProject(db)) {
        snap = await dbTenant.collection('cotacoes_publicas').doc(token).get();
        if (snap.exists) db = dbTenant;
      }
      if (!snap.exists) {
        $('loadingCard').innerHTML = '<strong>Cotação não encontrada.</strong><p class="sub">Confirme se o link enviado pela oficina está correto.</p>';
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      prepararBancoOficina(data);
      renderCotacao(data);
    } catch (err) {
      console.error(err);
      if (dbTenant && dbProject(dbTenant) !== dbProject(db)) {
        try {
          const snap = await dbTenant.collection('cotacoes_publicas').doc(token).get();
          if (snap.exists) {
            db = dbTenant;
            renderCotacao({ id: snap.id, ...snap.data() });
            return;
          }
        } catch (_) {}
      }
      $('loadingCard').innerHTML = '<strong>Erro ao carregar.</strong><p class="sub">Não foi possível abrir a cotação agora. Tente novamente.</p>';
    }
  }

  W.enviarRespostaCotacaoFornecedor = async function () {
    if (!db || !cotacao || !token) return;
    const itensBase = itensCotacao(cotacao);
    const linhas = Array.from(D.querySelectorAll('.cot-item-resposta'));
    const itensResposta = linhas.length ? linhas.map((row, idx) => {
      const item = itensBase[idx] || {};
      return {
        itemKey: row.getAttribute('data-item-key') || item.key || '',
        item,
        valorUnitario: num(row.querySelector('.item-valor')?.value),
        marca: row.querySelector('.item-marca')?.value.trim() || '',
        modelo: row.querySelector('.item-modelo')?.value.trim() || '',
        disponibilidade: row.querySelector('.item-disponibilidade')?.value || '',
        prazo: row.querySelector('.item-prazo')?.value.trim() || '',
        observacao: row.querySelector('.item-observacao')?.value.trim() || ''
      };
    }).filter(x => x.valorUnitario > 0) : [];
    if (!itensResposta.length) { status('Informe o valor unitário de pelo menos uma peça.', 'err'); return; }
    const primeira = itensResposta[0];
    const valorUnitario = primeira.valorUnitario;
    if (isExpired(cotacao)) { status('Cotação vencida ou fechada. Fale com a oficina.', 'err'); return; }

    const btn = $('btnEnviar');
    btn.disabled = true;
    btn.textContent = 'ENVIANDO...';
    const bancos = [];
    addDbUnico(bancos, dbTenant);
    addDbUnico(bancos, dbCentral || db);
    if (!bancos.length) { status('Banco da cotação indisponível. Recarregue o link.', 'err'); return; }
    const respId = bancos[0].collection('cotacoes_respostas').doc().id;
    const payload = {
      token,
      tenantId: cotacao.tenantId || tenant || '',
      cotacaoId: cotacao.cotacaoId || '',
      osId: cotacao.osId || '',
      itemKey: cotacao.itemKey || primeira.itemKey || '',
      itemKeys: cotacao.itemKeys || itensResposta.map(i => i.itemKey).filter(Boolean),
      fornecedorId: cotacao.fornecedorId || '',
      fornecedorNome: cotacao.fornecedorNome || $('respNome').value.trim() || 'Fornecedor',
      responsavel: $('respNome').value.trim(),
      contato: $('respContato').value.trim(),
      item: cotacao.item || primeira.item || {},
      itens: cotacao.itens || itensBase,
      itensResposta,
      valorUnitario,
      marca: primeira.marca || '',
      modelo: primeira.modelo || '',
      disponibilidade: primeira.disponibilidade || '',
      prazo: primeira.prazo || '',
      frete: num($('frete').value),
      condicao: $('condicao').value.trim(),
      observacao: $('observacao').value.trim(),
      origem: 'portal_fornecedor',
      createdAt: new Date().toISOString()
    };
    try {
      const resultados = await Promise.allSettled(bancos.map(database => {
        const batch = database.batch();
        batch.set(database.collection('cotacoes_publicas').doc(token).collection('respostas').doc(respId), payload);
        batch.set(database.collection('cotacoes_respostas').doc(respId), payload);
        return batch.commit();
      }));
      const ok = resultados.filter(r => r.status === 'fulfilled').length;
      if (!ok) {
        const erro = resultados.find(r => r.status === 'rejected')?.reason;
        throw erro || new Error('Nenhum banco aceitou a resposta.');
      }
      status(ok === bancos.length
        ? 'Cotação enviada. A oficina receberá sua resposta no painel.'
        : 'Cotação enviada no portal público. Se a oficina não visualizar automaticamente, avise pelo WhatsApp.',
        ok === bancos.length ? 'ok' : 'warn');
      D.querySelectorAll('input,select,textarea,button').forEach(el => {
        if (el.id !== 'btnEnviar') el.disabled = true;
      });
      btn.textContent = 'COTAÇÃO ENVIADA';
    } catch (err) {
      console.error(err);
      status('Não foi possível enviar. Verifique a internet ou fale com a oficina.', 'err');
      btn.disabled = false;
      btn.textContent = 'ENVIAR COTAÇÃO';
    }
  };

  D.addEventListener('DOMContentLoaded', carregar);
})();
