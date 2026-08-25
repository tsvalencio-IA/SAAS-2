/*
 * Jarvis CRM / Veículos v20
 * Camada isolada para:
 * - impedir placa duplicada;
 * - pesquisar cliente antes de cadastrar;
 * - expandir cliente -> veículos;
 * - localizar cliente/veículo por placa ao abrir O.S.;
 * - exibir histórico de O.S. dentro do cadastro do veículo;
 * - abrir estoque e O.S. em novas abas sem fechar a O.S. atual.
 *
 * Não altera o formato dos documentos nem substitui o fluxo original de salvamento.
 */
(function () {
  'use strict';

  if (window.__THIA_JARVIS_CRM_V20__) return;
  window.__THIA_JARVIS_CRM_V20__ = true;

  const VERSION = '20.1.1';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const norm = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const digits = (value) => String(value || '').replace(/\D+/g, '');
  const plateKey = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const money = (value) => {
    const n = Number(value || 0);
    return Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'R$ 0,00';
  };
  const toast = (message, type) => {
    if (typeof window.toast === 'function') window.toast(message, type || 'ok');
    else console.log('[Jarvis CRM v20]', message);
  };
  const JData = () => window.J || { clientes: [], veiculos: [], os: [] };

  function segredo177Ativo() {
    return window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
  }

  function pecaRealProtegida(order, peca) {
    const U = window.JOS || window.JarvisOSUtils || {};
    if (typeof U.isBudgetPieceLinkedToRealPart === 'function') return U.isBudgetPieceLinkedToRealPart(order || {}, peca);
    if (typeof U.isProtectedRealPart === 'function') return U.isProtectedRealPart(peca);
    if (!peca || typeof peca !== 'object') return false;
    const origem = String(peca.origem || '').toLowerCase().trim();
    return peca.origemNFVinculada === true || origem === 'nf_entrada_os' || origem === 'nf_entrada' || String(peca.statusAplicacao || '').toLowerCase() === 'comprada_vinculada_nf' || !!String(peca.origemNFItemKey || '').trim();
  }

  function clienteDaOS(order) {
    const data = JData();
    return (data.clientes || []).find(c => String(c.id) === String(order?.clienteId || order?.cliente || '')) || null;
  }

  function clienteOficialDaOS(order) {
    const cliente = clienteDaOS(order) || {};
    const U = window.JOS || window.JarvisOSUtils || {};
    if (typeof U.isOfficialClient === 'function') return U.isOfficialClient(order, cliente);
    return ['governo','oficial'].includes(String(cliente.tipoCliente || order?.tipoCliente || '').toLowerCase());
  }

  function injectStyles() {
    if ($('thiaJarvisCrmV20Styles')) return;
    const style = document.createElement('style');
    style.id = 'thiaJarvisCrmV20Styles';
    style.textContent = `
      .thia-v20-panel{background:rgba(0,212,255,.045);border:1px solid rgba(0,212,255,.22);border-radius:5px;padding:12px;margin-bottom:14px;position:relative}
      .thia-v20-title{font-family:var(--fm);font-size:.68rem;letter-spacing:1.2px;font-weight:800;color:var(--cyan);margin-bottom:7px}
      .thia-v20-help{font-family:var(--fm);font-size:.61rem;color:var(--muted);line-height:1.45;margin:5px 0 8px}
      .thia-v20-results{display:none;margin-top:8px;max-height:270px;overflow:auto;border:1px solid var(--border);border-radius:4px;background:var(--surf2)}
      .thia-v20-results.open{display:block}
      .thia-v20-result{padding:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}
      .thia-v20-result:last-child{border-bottom:0}
      .thia-v20-result:hover{background:rgba(0,212,255,.07)}
      .thia-v20-result strong{display:block;font-size:.76rem}
      .thia-v20-result small{display:block;font-family:var(--fm);font-size:.59rem;color:var(--muted);margin-top:3px;line-height:1.35}
      .thia-v20-alert{display:none;margin-top:7px;padding:9px;border-radius:4px;font-family:var(--fm);font-size:.63rem;line-height:1.45}
      .thia-v20-alert.show{display:block}
      .thia-v20-alert.warn{background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.38);color:#FBBF24}
      .thia-v20-alert.ok{background:rgba(0,255,136,.07);border:1px solid rgba(0,255,136,.3);color:var(--success)}
      .thia-v20-mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px}
      .thia-v20-mini-card{border:1px solid var(--border);background:var(--surf3);border-radius:4px;padding:10px;min-width:0}
      .thia-v20-mini-card strong{font-size:.76rem;display:block;overflow-wrap:anywhere}
      .thia-v20-mini-card small{font-family:var(--fm);font-size:.58rem;color:var(--muted);line-height:1.45;display:block;margin-top:4px;overflow-wrap:anywhere}
      .thia-v20-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .thia-v20-actions button{font-size:.6rem;padding:5px 8px}
      .thia-v20-client-detail td{padding:0!important;border-top:0!important}
      .thia-v20-client-detail-box{padding:10px 12px 14px;background:rgba(0,212,255,.025);border-bottom:1px solid var(--border)}
      .thia-v20-history{margin-top:15px;border-top:1px solid var(--border);padding-top:14px}
      .thia-v20-history-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
      .thia-v20-history-title{font-family:var(--fm);font-size:.68rem;color:var(--cyan);letter-spacing:1.2px;font-weight:800}
      .thia-v20-os-card{border-left:3px solid var(--cyan)}
      .thia-v20-os-summary{font-family:var(--fm);font-size:.6rem;color:var(--muted);line-height:1.5;margin-top:5px;white-space:normal}
      .thia-v20-row-click{cursor:pointer}
      .thia-v20-row-click:hover{background:rgba(0,212,255,.035)}
      .thia-v20-newtab{white-space:nowrap}
      @media(max-width:760px){
        .thia-v20-result{align-items:flex-start;flex-direction:column}
        .thia-v20-result .thia-v20-actions{width:100%}
        .thia-v20-result .thia-v20-actions button{flex:1}
        .thia-v20-mini-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function clientName(client) {
    return String(client?.nome || client?.razaoSocial || client?.nomeFantasia || 'Cliente sem nome');
  }

  function vehicleOwner(vehicle) {
    const data = JData();
    const directIds = [vehicle?.clienteId, vehicle?.donoId, vehicle?.ownerId, vehicle?.cliente, vehicle?.clienteRef]
      .filter(Boolean).map(String);
    let found = (data.clientes || []).find((client) => directIds.includes(String(client.id)));
    if (found) return found;

    const vehicleDoc = digits(vehicle?.clienteDoc || vehicle?.cpf || vehicle?.cnpj);
    if (vehicleDoc) {
      found = (data.clientes || []).find((client) => digits(client.doc || client.cpf || client.cnpj) === vehicleDoc);
      if (found) return found;
    }

    const ownerName = norm(vehicle?.clienteNome || vehicle?.dono || vehicle?.proprietario);
    if (ownerName) {
      found = (data.clientes || []).find((client) => norm(clientName(client)) === ownerName);
    }
    return found || null;
  }

  function vehiclesForClient(client) {
    if (!client) return [];
    const data = JData();
    const clientId = String(client.id || '');
    const clientDoc = digits(client.doc || client.cpf || client.cnpj);
    const clientNormName = norm(clientName(client));
    return (data.veiculos || []).filter((vehicle) => {
      const ids = [vehicle.clienteId, vehicle.donoId, vehicle.ownerId, vehicle.cliente, vehicle.clienteRef]
        .filter(Boolean).map(String);
      if (clientId && ids.includes(clientId)) return true;
      const vehicleDoc = digits(vehicle.clienteDoc || vehicle.cpf || vehicle.cnpj);
      if (clientDoc && vehicleDoc && clientDoc === vehicleDoc) return true;
      const ownerName = norm(vehicle.clienteNome || vehicle.dono || vehicle.proprietario);
      return Boolean(clientNormName && ownerName && clientNormName === ownerName);
    });
  }

  function osForVehicle(vehicle) {
    if (!vehicle) return [];
    const data = JData();
    const key = plateKey(vehicle.placa || vehicle.identificacao);
    return (data.os || []).filter((order) => {
      if (String(order.veiculoId || order.veiculo || '') === String(vehicle.id || '')) return true;
      return Boolean(key && plateKey(order.placa || order.veiculoSnapshot?.placa) === key);
    }).sort((a, b) => {
      const da = new Date(a.updatedAt || a.data || a.createdAt || 0).getTime();
      const db = new Date(b.updatedAt || b.data || b.createdAt || 0).getTime();
      return db - da;
    });
  }

  function descriptionsFromOrder(order, type) {
    const values = [];
    const push = (value) => {
      const text = String(value || '').trim();
      if (text && !values.includes(text)) values.push(text);
    };

    if (type === 'service') {
      (Array.isArray(order?.servicos) ? order.servicos : []).forEach((item) => push(item?.desc || item?.descricao || item?.nome || item?.servico));
      (Array.isArray(order?.itens) ? order.itens : []).filter((item) => /serv|mao|mão/i.test(String(item?.tipo || item?.t || '')))
        .forEach((item) => push(item?.desc || item?.descricao || item?.nome));
      (Array.isArray(order?.servicosExecutados) ? order.servicosExecutados : []).forEach((item) => push(item?.desc || item?.descricao || item?.nome || item));
      if (!values.length && Number(order?.maoObra || 0) > 0) push('Mão de obra registrada');
    } else {
      (Array.isArray(order?.pecas) ? order.pecas : [])
        .filter(item => !(clienteOficialDaOS(order) && pecaRealProtegida(order, item)))
        .forEach((item) => push([item?.codigo, item?.desc || item?.descricao || item?.nome].filter(Boolean).join(' — ')));
      if (segredo177Ativo()) {
        (Array.isArray(order?.pecasReais) ? order.pecasReais : []).forEach((item) => push([item?.codigo, item?.desc || item?.descricao || item?.nome].filter(Boolean).join(' — ')));
      }
      (Array.isArray(order?.itens) ? order.itens : []).filter((item) => /peca|peça|produto/i.test(String(item?.tipo || item?.t || '')))
        .forEach((item) => push([item?.codigo, item?.desc || item?.descricao || item?.nome].filter(Boolean).join(' — ')));
    }
    return values;
  }

  function orderShortId(order) {
    return String(order?.numero || order?.numeroOS || order?.id || '').replace(/^#/, '').slice(-8).toUpperCase() || 'SEM-ID';
  }

  function formatDate(value) {
    if (!value) return 'sem data';
    const raw = String(value).slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
  }

  function findDuplicatePlate(value, ignoreId) {
    const key = plateKey(value);
    if (!key) return null;
    return (JData().veiculos || []).find((vehicle) => String(vehicle.id) !== String(ignoreId || '') && plateKey(vehicle.placa || vehicle.identificacao) === key) || null;
  }

  function exactDuplicateClient() {
    const currentId = String($('cliId')?.value || '');
    const doc = digits($('cliDoc')?.value);
    const phone = digits($('cliWpp')?.value);
    const login = norm($('cliLogin')?.value);
    return (JData().clientes || []).find((client) => {
      if (String(client.id) === currentId) return false;
      if (doc && digits(client.doc || client.cpf || client.cnpj) === doc) return true;
      if (login && norm(client.login) === login) return true;
      if (!doc && phone && digits(client.wpp || client.telefone || client.celular) === phone) return true;
      return false;
    }) || null;
  }

  function openClient(clientId) {
    if (!clientId) return;
    if (typeof window.prepCliente === 'function') window.prepCliente('edit', clientId);
    if (typeof window.abrirModal === 'function') window.abrirModal('modalCliente');
  }

  function openVehicle(vehicleId) {
    if (!vehicleId) return;
    if (typeof window.prepVeiculo === 'function') window.prepVeiculo('edit', vehicleId);
    if (typeof window.abrirModal === 'function') window.abrirModal('modalVeiculo');
  }

  function openOrder(orderId) {
    if (!orderId) return;
    if (typeof window.fecharModal === 'function') {
      window.fecharModal('modalVeiculo');
      window.fecharModal('modalCliente');
    }
    if (typeof window.ir === 'function') window.ir('kanban');
    if (typeof window.prepOS === 'function') window.prepOS('edit', orderId);
    if (typeof window.abrirModal === 'function') window.abrirModal('modalOS');
  }

  function openNewTab(params) {
    try {
      const url = new URL(window.location.href);
      ['v20view', 'v20os', 'v20veiculo', 'v20cliente'].forEach((key) => url.searchParams.delete(key));
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value != null && value !== '') url.searchParams.set(key, String(value));
      });
      const opened = window.open(url.toString(), '_blank');
      try { if (opened) opened.opener = null; } catch (_) {}
      if (!opened) toast('O navegador bloqueou a nova aba. Libere pop-ups para este site.', 'warn');
      return opened;
    } catch (error) {
      console.warn('[Jarvis CRM v20] nova aba', error);
      return null;
    }
  }

  function selectVehicleForOS(vehicle) {
    if (!vehicle) return;
    const owner = vehicleOwner(vehicle);
    const clientSelect = $('osCliente');
    const vehicleSelect = $('osVeiculo');
    if (clientSelect && owner) {
      clientSelect.value = owner.id;
      if (typeof window.filtrarVeiculosOS === 'function') window.filtrarVeiculosOS({ preservarVeiculo: true, origem: 'buscaPlacaV20' });
    }
    if (vehicleSelect) {
      vehicleSelect.value = vehicle.id;
      if (!vehicleSelect.value) {
        const option = document.createElement('option');
        option.value = vehicle.id;
        option.textContent = `${vehicle.placa || 'S/PLACA'} - ${vehicle.modelo || 'Veículo'}`;
        vehicleSelect.appendChild(option);
        vehicleSelect.value = vehicle.id;
      }
    }
    if ($('osBuscaPlacaV20')) $('osBuscaPlacaV20').value = vehicle.placa || vehicle.prefixo || '';
    if ($('osKm') && !$('osKm').value && vehicle.km != null) $('osKm').value = vehicle.km;
    if ($('osTipoVeiculo') && !$('osTipoVeiculo').value) $('osTipoVeiculo').value = vehicle.tipoVeiculo || vehicle.tipo || '';
    if ($('osCelular') && owner && !$('osCelular').value) $('osCelular').value = owner.wpp || owner.telefone || owner.celular || '';
    if ($('osCpf') && owner && !$('osCpf').value) $('osCpf').value = owner.doc || owner.cpf || owner.cnpj || '';
    if (typeof window.atualizarIdentificacaoVeiculoOS === 'function') window.atualizarIdentificacaoVeiculoOS();
    const results = $('osBuscaPlacaResultadosV20');
    if (results) { results.innerHTML = ''; results.classList.remove('open'); }
    toast(`Veículo ${vehicle.placa || vehicle.modelo || ''} e cliente preenchidos na O.S.`);
  }

  function newOrderForVehicle(vehicleId) {
    const vehicle = (JData().veiculos || []).find((item) => String(item.id) === String(vehicleId));
    if (!vehicle) return;
    if (typeof window.fecharModal === 'function') {
      window.fecharModal('modalVeiculo');
      window.fecharModal('modalCliente');
    }
    if (typeof window.ir === 'function') window.ir('kanban');
    if (typeof window.prepOS === 'function') window.prepOS('add');
    if (typeof window.abrirModal === 'function') window.abrirModal('modalOS');
    setTimeout(() => selectVehicleForOS(vehicle), 80);
  }

  function beginVehicleForClient(clientId, plate) {
    window.__THIA_V20_VEHICLE_FROM_CLIENT__ = String(clientId || '');
    if (typeof window.prepVeiculo === 'function') window.prepVeiculo('add');
    if (typeof window.abrirModal === 'function') window.abrirModal('modalVeiculo');
    setTimeout(() => {
      if ($('veicDono') && clientId) $('veicDono').value = clientId;
      if ($('veicPlaca') && plate) {
        $('veicPlaca').value = String(plate).toUpperCase();
        $('veicPlaca').dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 60);
  }

  function installVehicleDuplicateUi() {
    const input = $('veicPlaca');
    if (!input || $('veicPlacaDuplicadaV20')) return;
    const alert = document.createElement('div');
    alert.id = 'veicPlacaDuplicadaV20';
    alert.className = 'thia-v20-alert warn';
    input.insertAdjacentElement('afterend', alert);

    const check = () => {
      const duplicate = findDuplicatePlate(input.value, $('veicId')?.value);
      if (!plateKey(input.value)) {
        alert.className = 'thia-v20-alert warn';
        alert.innerHTML = '';
        return;
      }
      if (!duplicate) {
        alert.className = 'thia-v20-alert ok show';
        alert.textContent = '✓ Nenhum outro veículo com esta placa foi localizado.';
        return;
      }
      const owner = vehicleOwner(duplicate);
      alert.className = 'thia-v20-alert warn show';
      alert.innerHTML = `<strong>⚠ VEÍCULO JÁ CADASTRADO</strong><br>${esc(duplicate.placa || '')} — ${esc(duplicate.modelo || 'Modelo não informado')}<br>Cliente: ${esc(clientName(owner))}<div class="thia-v20-actions"><button type="button" class="btn-outline" data-v20-open-vehicle="${esc(duplicate.id)}">ABRIR CADASTRO</button></div>`;
      alert.querySelector('[data-v20-open-vehicle]')?.addEventListener('click', () => openVehicle(duplicate.id));
    };
    input.addEventListener('input', check);
    input.addEventListener('blur', check);
  }

  function installClientSearchUi() {
    const body = $('modalCliente')?.querySelector('.modal-body');
    if (!body || $('cliBuscaExistenteV20')) return;
    const panel = document.createElement('div');
    panel.className = 'thia-v20-panel';
    panel.innerHTML = `
      <div class="thia-v20-title">🔎 PESQUISAR CLIENTE ANTES DE CADASTRAR</div>
      <input class="j-input" id="cliBuscaExistenteV20" type="search" autocomplete="off" placeholder="Nome, CPF/CNPJ, WhatsApp, e-mail, placa ou veículo...">
      <div class="thia-v20-help">Se o cliente já existir, abra o cadastro em vez de criar outro. A pesquisa também encontra os veículos vinculados.</div>
      <div id="cliBuscaResultadosV20" class="thia-v20-results"></div>
      <div id="cliDuplicadoAvisoV20" class="thia-v20-alert warn"></div>`;
    const hidden = body.querySelector('#cliId');
    if (hidden) hidden.insertAdjacentElement('afterend', panel);
    else body.prepend(panel);

    const input = $('cliBuscaExistenteV20');
    const results = $('cliBuscaResultadosV20');
    const duplicateAlert = $('cliDuplicadoAvisoV20');

    function searchClients() {
      const query = norm(input?.value);
      results.innerHTML = '';
      if (query.length < 2) {
        results.classList.remove('open');
        return;
      }
      const found = (JData().clientes || []).filter((client) => {
        const vehicles = vehiclesForClient(client);
        const text = [
          clientName(client), client.doc, client.cpf, client.cnpj, client.wpp, client.telefone,
          client.celular, client.email, client.login,
          vehicles.map((vehicle) => [vehicle.placa, vehicle.modelo, vehicle.marca, vehicle.prefixo, vehicle.chassis, vehicle.chassi].filter(Boolean).join(' ')).join(' ')
        ].filter(Boolean).join(' ');
        return norm(text).includes(query);
      }).slice(0, 10);

      if (!found.length) {
        results.innerHTML = '<div class="thia-v20-result"><div><strong>Nenhum cliente encontrado</strong><small>Você pode continuar com o novo cadastro.</small></div></div>';
        results.classList.add('open');
        return;
      }

      found.forEach((client) => {
        const vehicles = vehiclesForClient(client);
        const row = document.createElement('div');
        row.className = 'thia-v20-result';
        row.innerHTML = `<div><strong>${esc(clientName(client))}</strong><small>${esc(client.doc || client.cpf || client.cnpj || 'sem documento')} • ${esc(client.wpp || client.telefone || 'sem WhatsApp')}<br>${vehicles.length ? esc(vehicles.map((vehicle) => `${vehicle.placa || 'S/PLACA'} ${vehicle.modelo || ''}`).join(' • ')) : 'Sem veículos vinculados'}</small></div><div class="thia-v20-actions"><button type="button" class="btn-primary">ABRIR CLIENTE</button></div>`;
        row.querySelector('button')?.addEventListener('click', () => openClient(client.id));
        row.addEventListener('dblclick', () => openClient(client.id));
        results.appendChild(row);
      });
      results.classList.add('open');
    }

    input?.addEventListener('input', searchClients);
    input?.addEventListener('focus', searchClients);

    const updateDuplicate = () => {
      const duplicate = exactDuplicateClient();
      if (!duplicate) {
        duplicateAlert.className = 'thia-v20-alert warn';
        duplicateAlert.innerHTML = '';
        return;
      }
      duplicateAlert.className = 'thia-v20-alert warn show';
      duplicateAlert.innerHTML = `<strong>⚠ POSSÍVEL CLIENTE JÁ CADASTRADO</strong><br>${esc(clientName(duplicate))} — ${esc(duplicate.doc || duplicate.wpp || duplicate.login || '')}<div class="thia-v20-actions"><button type="button" class="btn-outline">ABRIR CADASTRO EXISTENTE</button></div>`;
      duplicateAlert.querySelector('button')?.addEventListener('click', () => openClient(duplicate.id));
    };
    ['cliDoc', 'cliWpp', 'cliLogin'].forEach((id) => $(id)?.addEventListener('input', updateDuplicate));
  }

  function installOSPlateSearchUi() {
    const clientSelect = $('osCliente');
    if (!clientSelect || $('osBuscaPlacaV20')) return;
    const row = clientSelect.closest('.form-row');
    if (!row) return;

    const panel = document.createElement('div');
    panel.className = 'thia-v20-panel';
    panel.id = 'osBuscaPlacaPanelV20';
    panel.innerHTML = `
      <div class="thia-v20-title">🔎 LOCALIZAR VEÍCULO E CLIENTE PELA PLACA</div>
      <input class="j-input" id="osBuscaPlacaV20" type="search" autocomplete="off" autocapitalize="characters" placeholder="Digite a placa, prefixo, modelo ou nome do cliente..." style="text-transform:uppercase;font-family:var(--fm);font-weight:700;letter-spacing:1px">
      <div class="thia-v20-help">Ao selecionar, o Jarvis preenche automaticamente o cliente e o veículo. Se não existir, use os botões de cadastro sem fechar a O.S.</div>
      <div id="osBuscaPlacaResultadosV20" class="thia-v20-results"></div>`;
    row.insertAdjacentElement('beforebegin', panel);

    const input = $('osBuscaPlacaV20');
    const results = $('osBuscaPlacaResultadosV20');

    function renderVehicleSearch() {
      const queryRaw = String(input?.value || '').trim();
      const query = norm(queryRaw);
      const plateQuery = plateKey(queryRaw);
      results.innerHTML = '';
      if (query.length < 2) {
        results.classList.remove('open');
        return;
      }
      const found = (JData().veiculos || []).filter((vehicle) => {
        const owner = vehicleOwner(vehicle);
        const text = [vehicle.placa, vehicle.prefixo, vehicle.frota, vehicle.modelo, vehicle.marca, vehicle.ano, vehicle.chassis, vehicle.chassi, clientName(owner), owner?.doc, owner?.wpp].filter(Boolean).join(' ');
        return norm(text).includes(query) || (plateQuery && plateKey(vehicle.placa).includes(plateQuery));
      }).slice(0, 12);

      if (!found.length) {
        const noResult = document.createElement('div');
        noResult.className = 'thia-v20-result';
        noResult.innerHTML = `<div><strong>Nenhum veículo cadastrado foi encontrado</strong><small>Placa pesquisada: ${esc(queryRaw.toUpperCase())}</small></div><div class="thia-v20-actions"><button type="button" class="btn-outline" data-new-client>NOVO CLIENTE</button><button type="button" class="btn-primary" data-new-vehicle>NOVO VEÍCULO</button></div>`;
        noResult.querySelector('[data-new-client]')?.addEventListener('click', () => {
          if (typeof window.prepCliente === 'function') window.prepCliente('add');
          if (typeof window.abrirModal === 'function') window.abrirModal('modalCliente');
          setTimeout(() => { if ($('cliBuscaExistenteV20')) $('cliBuscaExistenteV20').value = queryRaw; }, 50);
        });
        noResult.querySelector('[data-new-vehicle]')?.addEventListener('click', () => beginVehicleForClient($('osCliente')?.value || '', queryRaw));
        results.appendChild(noResult);
        results.classList.add('open');
        return;
      }

      found.forEach((vehicle) => {
        const owner = vehicleOwner(vehicle);
        const rowResult = document.createElement('div');
        rowResult.className = 'thia-v20-result';
        rowResult.innerHTML = `<div><strong>${esc(vehicle.placa || vehicle.prefixo || 'SEM IDENTIFICAÇÃO')} — ${esc(vehicle.modelo || 'Veículo')}</strong><small>Cliente: ${esc(clientName(owner))} • ${esc(vehicle.ano || 'ano não informado')} • KM ${esc(vehicle.km || '—')}</small></div><div class="thia-v20-actions"><button type="button" class="btn-primary">USAR NA O.S.</button></div>`;
        rowResult.querySelector('button')?.addEventListener('click', () => selectVehicleForOS(vehicle));
        rowResult.addEventListener('dblclick', () => selectVehicleForOS(vehicle));
        results.appendChild(rowResult);
      });
      results.classList.add('open');
    }

    input?.addEventListener('input', renderVehicleSearch);
    input?.addEventListener('focus', renderVehicleSearch);
    input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const first = results.querySelector('.thia-v20-result button.btn-primary');
      if (first) { event.preventDefault(); first.click(); }
    });
    $('osVeiculo')?.addEventListener('change', () => {
      const vehicle = (JData().veiculos || []).find((item) => String(item.id) === String($('osVeiculo')?.value || ''));
      if (vehicle && input) input.value = vehicle.placa || vehicle.prefixo || '';
    });
  }

  function injectVehicleHistoryContainer() {
    const body = $('modalVeiculo')?.querySelector('.modal-body');
    if (!body || $('veicHistoricoOSV20')) return;
    const container = document.createElement('div');
    container.id = 'veicHistoricoOSV20';
    container.className = 'thia-v20-history';
    body.appendChild(container);
  }

  function renderVehicleHistory(vehicleId) {
    injectVehicleHistoryContainer();
    const container = $('veicHistoricoOSV20');
    if (!container) return;
    const vehicle = (JData().veiculos || []).find((item) => String(item.id) === String(vehicleId || $('veicId')?.value || ''));
    if (!vehicle) {
      container.innerHTML = '<div class="thia-v20-history-title">HISTÓRICO DE O.S.</div><div class="thia-v20-help">Salve o veículo para visualizar o histórico.</div>';
      return;
    }
    const orders = osForVehicle(vehicle);
    container.innerHTML = `
      <div class="thia-v20-history-head">
        <div><div class="thia-v20-history-title">🧾 HISTÓRICO DE O.S. — ${esc(vehicle.placa || vehicle.prefixo || '')}</div><div class="thia-v20-help">${orders.length} ordem(ns) localizada(s). Toque para abrir sem perder o vínculo do veículo.</div></div>
        <div class="thia-v20-actions"><button type="button" class="btn-primary" data-v20-new-os>+ NOVA O.S. DESTE VEÍCULO</button></div>
      </div>
      <div class="thia-v20-mini-grid" id="veicHistoricoCardsV20"></div>`;
    container.querySelector('[data-v20-new-os]')?.addEventListener('click', () => newOrderForVehicle(vehicle.id));
    const grid = $('veicHistoricoCardsV20');
    if (!orders.length) {
      grid.innerHTML = '<div class="thia-v20-mini-card"><strong>Nenhuma O.S. encontrada</strong><small>O veículo está cadastrado, mas ainda não possui histórico de O.S. neste tenant.</small></div>';
      return;
    }
    orders.forEach((order) => {
      const services = descriptionsFromOrder(order, 'service');
      const pieces = descriptionsFromOrder(order, 'piece');
      const card = document.createElement('div');
      card.className = 'thia-v20-mini-card thia-v20-os-card';
      card.innerHTML = `
        <strong>O.S. #${esc(orderShortId(order))} • ${esc(order.status || 'Sem status')}</strong>
        <small>${esc(formatDate(order.data || order.createdAt))} • Total: ${esc(money(order.total || order.valorTotal || 0))}</small>
        <div class="thia-v20-os-summary"><b>Serviços:</b> ${esc(services.slice(0, 2).join('; ') || 'sem serviço descrito')}${services.length > 2 ? ` +${services.length - 2}` : ''}<br><b>Peças:</b> ${esc(pieces.slice(0, 2).join('; ') || 'sem peça descrita')}${pieces.length > 2 ? ` +${pieces.length - 2}` : ''}</div>
        <div class="thia-v20-actions"><button type="button" class="btn-primary" data-open>ABRIR O.S.</button><button type="button" class="btn-outline thia-v20-newtab" data-newtab>O.S. EM NOVA ABA</button></div>`;
      card.querySelector('[data-open]')?.addEventListener('click', () => openOrder(order.id));
      card.querySelector('[data-newtab]')?.addEventListener('click', () => openNewTab({ v20os: order.id }));
      grid.appendChild(card);
    });
  }

  function filteredClientsForCurrentSearch() {
    const query = norm($('buscaClientesCadastro')?.value || '');
    return (JData().clientes || []).filter((client) => {
      if (!query) return true;
      const vehicles = vehiclesForClient(client);
      const text = [
        clientName(client), client.doc, client.cpf, client.cnpj, client.wpp, client.telefone, client.celular,
        client.email, client.login, client.pin, client.tipoCliente, client.govUnidade, client.govFiscal,
        vehicles.map((vehicle) => [vehicle.placa, vehicle.modelo, vehicle.marca, vehicle.prefixo, vehicle.frota, vehicle.chassis, vehicle.chassi, vehicle.patrimonio, vehicle.km].filter(Boolean).join(' ')).join(' ')
      ].filter(Boolean).join(' ');
      return norm(text).includes(query);
    });
  }

  function toggleClientVehicles(clientId, row) {
    const existing = document.querySelector(`tr.thia-v20-client-detail[data-client-id="${CSS.escape(String(clientId))}"]`);
    if (existing) { existing.remove(); return; }
    document.querySelectorAll('tr.thia-v20-client-detail').forEach((item) => item.remove());
    const client = (JData().clientes || []).find((item) => String(item.id) === String(clientId));
    if (!client || !row) return;
    const vehicles = vehiclesForClient(client);
    const detail = document.createElement('tr');
    detail.className = 'thia-v20-client-detail';
    detail.dataset.clientId = String(clientId);
    const cell = document.createElement('td');
    cell.colSpan = 4;
    const box = document.createElement('div');
    box.className = 'thia-v20-client-detail-box';
    box.innerHTML = `<div class="thia-v20-history-head"><div><div class="thia-v20-history-title">🚗 VEÍCULOS DE ${esc(clientName(client))}</div><div class="thia-v20-help">${vehicles.length} veículo(s) vinculado(s).</div></div><div class="thia-v20-actions"><button type="button" class="btn-primary" data-new>+ CADASTRAR VEÍCULO</button></div></div><div class="thia-v20-mini-grid"></div>`;
    box.querySelector('[data-new]')?.addEventListener('click', () => beginVehicleForClient(client.id, ''));
    const grid = box.querySelector('.thia-v20-mini-grid');
    if (!vehicles.length) {
      grid.innerHTML = '<div class="thia-v20-mini-card"><strong>Nenhum veículo vinculado</strong><small>Use o botão acima para cadastrar o primeiro veículo deste cliente.</small></div>';
    } else {
      vehicles.forEach((vehicle) => {
        const orders = osForVehicle(vehicle);
        const card = document.createElement('div');
        card.className = 'thia-v20-mini-card';
        card.innerHTML = `<strong>${esc(vehicle.placa || vehicle.prefixo || 'S/PLACA')} — ${esc(vehicle.modelo || 'Veículo')}</strong><small>${esc(vehicle.ano || 'ano não informado')} • KM ${esc(vehicle.km || '—')} • ${orders.length} O.S.</small><div class="thia-v20-actions"><button type="button" class="btn-outline" data-open>ABRIR / HISTÓRICO</button><button type="button" class="btn-primary" data-os>NOVA O.S.</button></div>`;
        card.querySelector('[data-open]')?.addEventListener('click', () => openVehicle(vehicle.id));
        card.querySelector('[data-os]')?.addEventListener('click', () => newOrderForVehicle(vehicle.id));
        grid.appendChild(card);
      });
    }
    cell.appendChild(box);
    detail.appendChild(cell);
    row.insertAdjacentElement('afterend', detail);
  }

  function enhanceClientRows() {
    const body = $('tbClientes');
    if (!body) return;
    const clients = filteredClientsForCurrentSearch();
    const rows = Array.from(body.children).filter((row) => row.tagName === 'TR' && !row.classList.contains('thia-v20-client-detail'));
    rows.forEach((row, index) => {
      const client = clients[index];
      if (!client || row.dataset.v20Enhanced === '1') return;
      row.dataset.v20Enhanced = '1';
      row.dataset.clientId = client.id;
      row.classList.add('thia-v20-row-click');
      const actions = row.lastElementChild;
      if (actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-outline';
        button.style.marginRight = '4px';
        button.title = 'Mostrar veículos deste cliente';
        button.textContent = '🚗';
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          toggleClientVehicles(client.id, row);
        });
        actions.insertBefore(button, actions.firstChild);
      }
      row.firstElementChild?.addEventListener('click', () => toggleClientVehicles(client.id, row));
    });
  }

  function wrapCoreFunctions() {
    if (typeof window.salvarVeiculo === 'function' && !window.salvarVeiculo.__thiaV20) {
      const original = window.salvarVeiculo;
      const wrapped = async function () {
        const plate = $('veicPlaca')?.value || '';
        const currentId = $('veicId')?.value || '';
        const duplicate = findDuplicatePlate(plate, currentId);
        if (duplicate) {
          const owner = vehicleOwner(duplicate);
          toast(`⚠ Veículo já cadastrado: ${duplicate.placa || plate} — ${clientName(owner)}.`, 'warn');
          $('veicPlaca')?.dispatchEvent(new Event('input', { bubbles: true }));
          return false;
        }
        const wasNew = !currentId;
        const targetPlate = plateKey(plate);
        const contextClient = String($('veicDono')?.value || window.__THIA_V20_VEHICLE_FROM_CLIENT__ || $('osCliente')?.value || '');
        const result = await original.apply(this, arguments);
        window.__THIA_V20_VEHICLE_FROM_CLIENT__ = '';
        if (wasNew && targetPlate && $('modalOS')?.classList.contains('open')) {
          let attempts = 0;
          const timer = setInterval(() => {
            attempts += 1;
            const saved = (JData().veiculos || []).find((vehicle) => plateKey(vehicle.placa) === targetPlate && (!contextClient || String(vehicle.clienteId || '') === contextClient));
            if (saved) {
              clearInterval(timer);
              selectVehicleForOS(saved);
            } else if (attempts >= 30) clearInterval(timer);
          }, 250);
        }
        return result;
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.salvarVeiculo = wrapped;
    }

    if (typeof window.salvarCliente === 'function' && !window.salvarCliente.__thiaV20) {
      const original = window.salvarCliente;
      const wrapped = async function () {
        const duplicate = exactDuplicateClient();
        if (duplicate && !$('cliId')?.value) {
          toast(`⚠ Cliente já cadastrado: ${clientName(duplicate)}. Abra o cadastro existente.`, 'warn');
          const alert = $('cliDuplicadoAvisoV20');
          if (alert) {
            alert.className = 'thia-v20-alert warn show';
            alert.innerHTML = `<strong>⚠ CLIENTE JÁ CADASTRADO</strong><br>${esc(clientName(duplicate))}<div class="thia-v20-actions"><button type="button" class="btn-outline">ABRIR CADASTRO</button></div>`;
            alert.querySelector('button')?.addEventListener('click', () => openClient(duplicate.id));
          }
          return false;
        }
        return original.apply(this, arguments);
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.salvarCliente = wrapped;
    }

    if (typeof window.prepVeiculo === 'function' && !window.prepVeiculo.__thiaV20) {
      const original = window.prepVeiculo;
      const wrapped = function (mode, id) {
        const osClient = $('modalOS')?.classList.contains('open') ? $('osCliente')?.value : '';
        const osSearch = $('modalOS')?.classList.contains('open') ? $('osBuscaPlacaV20')?.value : '';
        const result = original.apply(this, arguments);
        setTimeout(() => {
          installVehicleDuplicateUi();
          if (mode === 'add') {
            if ($('veicDono') && (window.__THIA_V20_VEHICLE_FROM_CLIENT__ || osClient)) $('veicDono').value = window.__THIA_V20_VEHICLE_FROM_CLIENT__ || osClient;
            if ($('veicPlaca') && osSearch && !$('veicPlaca').value) $('veicPlaca').value = String(osSearch).toUpperCase();
            renderVehicleHistory('');
          } else if (id) renderVehicleHistory(id);
          $('veicPlaca')?.dispatchEvent(new Event('input', { bubbles: true }));
        }, 20);
        return result;
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.prepVeiculo = wrapped;
    }

    if (typeof window.prepCliente === 'function' && !window.prepCliente.__thiaV20) {
      const original = window.prepCliente;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          if ($('cliBuscaExistenteV20')) $('cliBuscaExistenteV20').value = '';
          $('cliBuscaResultadosV20')?.classList.remove('open');
          if ($('cliDuplicadoAvisoV20')) {
            $('cliDuplicadoAvisoV20').className = 'thia-v20-alert warn';
            $('cliDuplicadoAvisoV20').innerHTML = '';
          }
        }, 10);
        return result;
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.prepCliente = wrapped;
    }

    if (typeof window.prepOS === 'function' && !window.prepOS.__thiaV20) {
      const original = window.prepOS;
      const wrapped = function (mode, id) {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          const input = $('osBuscaPlacaV20');
          if (!input) return;
          if (mode === 'edit') {
            const order = (JData().os || []).find((item) => String(item.id) === String(id || ''));
            const vehicle = (JData().veiculos || []).find((item) => String(item.id) === String(order?.veiculoId || order?.veiculo || ''));
            input.value = vehicle?.placa || order?.placa || $('osPlacaView')?.value || '';
          } else input.value = '';
          $('osBuscaPlacaResultadosV20')?.classList.remove('open');
        }, 150);
        return result;
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.prepOS = wrapped;
    }

    if (typeof window.renderClientes === 'function' && !window.renderClientes.__thiaV20) {
      const original = window.renderClientes;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        setTimeout(enhanceClientRows, 0);
        return result;
      };
      wrapped.__thiaV20 = true;
      wrapped.__original = original;
      window.renderClientes = wrapped;
      setTimeout(() => window.renderClientes(), 0);
    }
  }

  function installNewTabButtons() {
    const headerTools = $('modalOS')?.querySelector('.modal-head > div:last-child');
    if (headerTools && !$('btnEstoqueNovaAbaV20')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'btnEstoqueNovaAbaV20';
      button.className = 'btn-outline thia-v20-newtab';
      button.style.cssText = 'padding:6px 9px;font-size:.62rem;';
      button.textContent = '📦 ESTOQUE EM NOVA ABA';
      button.title = 'Abre outra tela do Jarvis no estoque sem fechar esta O.S.';
      button.addEventListener('click', () => openNewTab({ v20view: 'estoque' }));
      headerTools.insertBefore(button, headerTools.firstChild);
    }

    const topbar = document.querySelector('.topbar');
    if (topbar && !$('btnNovaTelaJarvisV20')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'btnNovaTelaJarvisV20';
      button.className = 'btn-ghost thia-v20-newtab';
      button.style.cssText = 'margin-left:auto;font-size:.62rem;padding:6px 9px;';
      button.textContent = '↗ NOVA TELA';
      button.title = 'Abre o Jarvis em outra aba para trabalhar em duas telas.';
      button.addEventListener('click', () => openNewTab({ v20view: 'dashboard' }));
      topbar.appendChild(button);
    }
  }

  function handleDeepLinks() {
    let url;
    try { url = new URL(window.location.href); } catch (_) { return; }
    const view = url.searchParams.get('v20view');
    const orderId = url.searchParams.get('v20os');
    const vehicleId = url.searchParams.get('v20veiculo');
    const clientId = url.searchParams.get('v20cliente');
    if (!view && !orderId && !vehicleId && !clientId) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const data = JData();
      if (view && typeof window.ir === 'function') window.ir(view);
      if (orderId && (data.os || []).some((item) => String(item.id) === String(orderId)) && typeof window.prepOS === 'function') {
        clearInterval(timer);
        openOrder(orderId);
        return;
      }
      if (vehicleId && (data.veiculos || []).some((item) => String(item.id) === String(vehicleId)) && typeof window.prepVeiculo === 'function') {
        clearInterval(timer);
        if (typeof window.ir === 'function') window.ir('clientes');
        openVehicle(vehicleId);
        return;
      }
      if (clientId && (data.clientes || []).some((item) => String(item.id) === String(clientId)) && typeof window.prepCliente === 'function') {
        clearInterval(timer);
        if (typeof window.ir === 'function') window.ir('clientes');
        openClient(clientId);
        return;
      }
      if (!orderId && !vehicleId && !clientId && view) clearInterval(timer);
      if (attempts >= 80) clearInterval(timer);
    }, 250);
  }

  function installGlobalApi() {
    window.thiaJarvisV20 = Object.freeze({
      version: VERSION,
      openClient,
      openVehicle,
      openOrder,
      newOrderForVehicle,
      selectVehicleForOS,
      renderVehicleHistory,
      openNewTab,
      findDuplicatePlate,
      vehiclesForClient,
      osForVehicle
    });
  }

  function boot() {
    injectStyles();
    installClientSearchUi();
    installVehicleDuplicateUi();
    installOSPlateSearchUi();
    injectVehicleHistoryContainer();
    wrapCoreFunctions();
    installNewTabButtons();
    installGlobalApi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  [250, 800, 1600, 3200].forEach((delay) => setTimeout(boot, delay));
  setTimeout(handleDeepLinks, 600);
})();
