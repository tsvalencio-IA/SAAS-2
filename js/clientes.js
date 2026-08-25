/**
 * JARVIS ERP — clientes.js / estoque.js / equipe.js
 * CRM, Veículos, Estoque, NF, Fornecedores, Equipe, RH
 * INCLUI: Comissões Duplas (% Peça e % M.O.) e Endereço Completo.
 */

'use strict';

async function exclusaoAuditadaClientes(collection, id, label, modulo) {
  const role = String(sessionStorage.getItem('j_role') || J?.role || '').toLowerCase();
  if (!['admin', 'gestor', 'gerente', 'superadmin'].includes(role)) {
    toastWarn('Apenas gestor/admin pode excluir registros.');
    return false;
  }
  const nome = label || `${collection}/${id}`;
  const ok = await confirmar(`Excluir ${nome}? Esta acao exige motivo e ficara auditada.`, 'Auditoria obrigatoria');
  if (!ok) return false;
  const motivo = prompt('Informe o motivo da exclusao (obrigatorio):');
  if (!motivo || !motivo.trim()) {
    toastWarn('Exclusao cancelada: motivo obrigatorio.');
    return false;
  }
  const ref = J.db.collection(collection).doc(id);
  const snap = await ref.get().catch(() => null);
  const antes = snap && snap.exists ? snap.data() : null;
  if (typeof window.thiaAudit === 'function') {
    await window.thiaAudit(`exclusao_${modulo || collection}`, collection, id, antes, null, motivo.trim());
  } else {
    await J.db.collection('lixeira_auditoria').add({
      tenantId: J.tid,
      usuario: J.nome || 'Admin',
      perfil: role,
      acao: `EXCLUSAO ${modulo || collection}`,
      entidade: collection,
      entidadeId: id,
      dadosAntes: antes,
      motivo: motivo.trim(),
      createdAt: new Date().toISOString(),
      ts: Date.now()
    });
  }
  await ref.delete();
  return true;
}

// ============================================================
// CLIENTES — FROTISTA / FROTA / CATÁLOGO COMERCIAL (JARVIS)
// Somente gestor/gerente/admin. Cliente oficial permanece protegido.
// ============================================================
function clienteOficialProtegidoCadastro(c) {
  if (!c) return false;
  const tipo = String(c.tipoCliente || c.clienteTipo || c.tipo || '').toLowerCase();
  if (tipo === 'governo' || tipo === 'oficial' || c.clienteOficial === true || c.orgaoPublico === true || c.gov === true) return true;
  const texto = [c.nome, c.razaoSocial, c.nomeFantasia, c.govUnidade, c.categoria, c.segmento]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return /OFICIAL|GOVERNO|PMSP|POLICIA|MILITAR|BPM|PREFEITURA|ESTADO|MUNICIP|SECRETARIA|ORGAO PUBLICO/.test(texto);
}

function podeGerenciarFrotistaCadastro() {
  const role = String(window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  return ['admin','gestor','gerente','superadmin'].includes(role);
}

function escFrotistaCadastro(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function normalizarFrotistaCadastro(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function clienteEdicaoAtualFrotista() {
  const id = String(_v('cliId') || '');
  return (window.J?.clientes || []).find(c => String(c.id) === id) || null;
}

function catalogoFrotistaCliente(c) {
  return Array.isArray(c?.catalogoPecasFrotista) ? c.catalogoPecasFrotista.slice() : [];
}

function veiculosFrotistaCliente(c) {
  if (!c?.id) return [];
  return (window.J?.veiculos || []).filter(v => String(v.clienteId || '') === String(c.id));
}

function modalClienteHostFrotista() {
  const modal = document.getElementById('modalCliente');
  if (!modal) return null;
  return modal.querySelector('.modal-body,.modal-content,.modal-card,.j-modal-card,.modal-inner') || modal.firstElementChild || modal;
}

function garantirCategoriaComercialCliente() {
  const host = modalClienteHostFrotista();
  if (!host || !podeGerenciarFrotistaCadastro()) return null;
  let wrap = document.getElementById('cliCategoriaComercialWrap');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'cliCategoriaComercialWrap';
  wrap.className = 'form-group';
  wrap.style.cssText = 'margin:12px 0;padding:12px;border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.055);border-radius:8px;';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
      <div>
        <label class="j-label" for="cliCategoriaComercial" style="margin:0;">Tipo comercial do cliente</label>
        <small style="display:block;margin-top:4px;color:var(--muted);font-size:.67rem;line-height:1.35;">Cadastro administrativo do Jarvis. Não altera cliente oficial.</small>
      </div>
      <select class="j-select" id="cliCategoriaComercial" style="min-width:180px;">
        <option value="comum">Cliente comum</option>
        <option value="frotista">Frotista</option>
      </select>
    </div>`;
  const nome = document.getElementById('cliNome');
  const anchor = nome?.closest('.form-group') || nome?.parentElement;
  if (anchor && anchor.parentElement) anchor.insertAdjacentElement('afterend', wrap);
  else host.appendChild(wrap);
  wrap.querySelector('#cliCategoriaComercial')?.addEventListener('change', () => atualizarPainelFrotistaCliente(clienteEdicaoAtualFrotista()));
  return wrap;
}

function opcoesAplicacaoCatalogoFrotista(c, atual = {}) {
  const veics = veiculosFrotistaCliente(c);
  const atualTipo = String(atual.aplicacaoTipo || 'todos');
  const atualValor = String(atual.aplicacaoValor || atual.veiculoModeloKey || atual.veiculoId || '');
  let html = `<option value="todos:*" ${atualTipo === 'todos' ? 'selected' : ''}>Todos os veículos da frota</option>`;
  const modelos = new Map();
  veics.forEach(v => {
    const label = [v.marca, v.modelo].filter(Boolean).join(' ').trim() || v.modelo || v.placa || 'Veículo';
    const key = normalizarFrotistaCadastro(label);
    if (key && !modelos.has(key)) modelos.set(key, label);
  });
  if (modelos.size) {
    html += '<optgroup label="Por modelo">';
    modelos.forEach((label, key) => {
      const sel = atualTipo === 'modelo' && atualValor === key ? 'selected' : '';
      html += `<option value="modelo:${escFrotistaCadastro(key)}" ${sel}>Modelo: ${escFrotistaCadastro(label)}</option>`;
    });
    html += '</optgroup>';
  }
  if (veics.length) {
    html += '<optgroup label="Por veículo específico">';
    veics.forEach(v => {
      const value = String(v.id || '');
      const label = [v.placa, v.modelo].filter(Boolean).join(' • ') || 'Veículo';
      const sel = atualTipo === 'veiculo' && atualValor === value ? 'selected' : '';
      html += `<option value="veiculo:${escFrotistaCadastro(value)}" ${sel}>${escFrotistaCadastro(label)}</option>`;
    });
    html += '</optgroup>';
  }
  return html;
}

function garantirPainelFrotistaCliente() {
  const host = modalClienteHostFrotista();
  if (!host || !podeGerenciarFrotistaCadastro()) return null;
  let painel = document.getElementById('cliFrotistaPainel');
  if (painel) return painel;
  painel = document.createElement('section');
  painel.id = 'cliFrotistaPainel';
  painel.style.cssText = 'display:none;margin:12px 0 4px;padding:13px;border:1px solid rgba(34,211,238,.24);background:linear-gradient(135deg,rgba(34,211,238,.045),rgba(34,197,94,.035));border-radius:8px;';
  painel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <div style="font-weight:800;font-size:.78rem;letter-spacing:.05em;">GESTÃO DO FROTISTA</div>
        <div id="cliFrotistaResumo" style="font-size:.68rem;color:var(--muted);margin-top:3px;"></div>
      </div>
      <button type="button" id="cliFrotistaNovoVeiculo" class="btn btn-ghost btn-sm">+ VEÍCULO DA FROTA</button>
    </div>
    <div id="cliFrotistaVeiculos" style="margin-top:10px;"></div>
    <div style="height:1px;background:rgba(255,255,255,.08);margin:12px 0;"></div>
    <div style="font-weight:700;font-size:.72rem;margin-bottom:6px;">Tabela de peças e preços deste frotista</div>
    <div style="font-size:.66rem;color:var(--muted);line-height:1.4;margin-bottom:9px;">Cadastre por grupo e categoria. Uma categoria pode ter vários códigos equivalentes. Na O.S. o Jarvis usa esta tabela localmente e tenta localizar algum desses códigos no estoque já carregado; se não houver, lança avulso com o preço do frotista.</div>
    <input type="hidden" id="cliFrotistaItemId" value="">
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;" id="cliFrotistaFormGrid">
      <div><label class="j-label">Grupo</label><input id="cliFrotistaGrupo" class="j-input" placeholder="Ex.: Filtros"></div>
      <div><label class="j-label">Categoria / peça</label><input id="cliFrotistaCategoria" class="j-input" placeholder="Ex.: Filtro de óleo"></div>
      <div style="grid-column:1/-1;"><label class="j-label">Códigos equivalentes</label><textarea id="cliFrotistaCodigos" class="j-input" rows="2" placeholder="Ex.: W712/75, PSL55, OC90 — separados por vírgula, ponto e vírgula ou linha"></textarea></div>
      <div><label class="j-label">Aplicação</label><select id="cliFrotistaAplicacao" class="j-select"></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><label class="j-label">Qtd. padrão</label><input id="cliFrotistaQtd" class="j-input" type="number" min="0.01" step="0.01" value="1"></div><div><label class="j-label">Preço venda</label><input id="cliFrotistaVenda" class="j-input" inputmode="decimal" placeholder="0,00"></div></div>
    </div>
    <div style="display:flex;gap:7px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;">
      <button type="button" id="cliFrotistaCancelarItem" class="btn btn-ghost btn-sm" style="display:none;">CANCELAR EDIÇÃO</button>
      <button type="button" id="cliFrotistaSalvarItem" class="btn btn-success btn-sm">SALVAR PEÇA DO FROTISTA</button>
    </div>
    <div id="cliFrotistaCatalogo" style="display:grid;gap:7px;margin-top:11px;"></div>`;
  const categoriaWrap = document.getElementById('cliCategoriaComercialWrap');
  if (categoriaWrap?.parentElement) categoriaWrap.insertAdjacentElement('afterend', painel);
  else host.appendChild(painel);
  painel.querySelector('#cliFrotistaSalvarItem')?.addEventListener('click', () => window.salvarItemCatalogoFrotistaCliente?.());
  painel.querySelector('#cliFrotistaCancelarItem')?.addEventListener('click', () => window.limparFormCatalogoFrotistaCliente?.());
  painel.querySelector('#cliFrotistaNovoVeiculo')?.addEventListener('click', () => window.novoVeiculoFrotistaCliente?.());
  return painel;
}

function renderVeiculosFrotistaCliente(c) {
  const box = document.getElementById('cliFrotistaVeiculos');
  if (!box) return;
  if (!c?.id) {
    box.innerHTML = '<div style="font-size:.68rem;color:var(--warn);padding:8px;border:1px dashed rgba(255,193,7,.3);border-radius:6px;">Salve o cliente como Frotista primeiro. Depois os veículos e a tabela de peças poderão ser vinculados.</div>';
    return;
  }
  const veics = veiculosFrotistaCliente(c);
  box.innerHTML = `<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px;">VEÍCULOS VINCULADOS (${veics.length})</div>` + (veics.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${veics.map(v => `<span class="badge badge-brand" style="padding:6px 8px;">${escFrotistaCadastro(v.placa || 'sem placa')} • ${escFrotistaCadastro(v.modelo || 'modelo não informado')}</span>`).join('')}</div>` : '<div style="font-size:.68rem;color:var(--muted);">Nenhum veículo vinculado. Use “+ Veículo da frota”.</div>');
}

function renderCatalogoFrotistaCliente(c) {
  const box = document.getElementById('cliFrotistaCatalogo');
  if (!box) return;
  const cat = catalogoFrotistaCliente(c);
  if (!cat.length) {
    box.innerHTML = '<div style="font-size:.68rem;color:var(--muted);padding:8px;border:1px dashed rgba(255,255,255,.12);border-radius:6px;">Nenhuma peça cadastrada para este frotista.</div>';
    return;
  }
  const grupos = new Map();
  cat.forEach(item => {
    const grupo = String(item.grupo || 'Sem grupo').trim() || 'Sem grupo';
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(item);
  });
  box.innerHTML = Array.from(grupos.entries()).map(([grupo, itens]) => `
    <div style="border:1px solid rgba(255,255,255,.09);border-radius:7px;padding:8px;">
      <div style="font-size:.64rem;font-weight:800;letter-spacing:.07em;color:var(--cyan);margin-bottom:6px;">${escFrotistaCadastro(grupo.toUpperCase())}</div>
      <div style="display:grid;gap:6px;">${itens.map(item => {
        const codigos = Array.isArray(item.codigos) ? item.codigos : [];
        const aplic = item.aplicacaoLabel || (item.aplicacaoTipo === 'todos' ? 'Toda a frota' : item.veiculoModelo || item.veiculoPlaca || 'Aplicação específica');
        const venda = Number(item.venda || 0);
        return `<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:7px;background:rgba(0,0,0,.12);border-radius:6px;">
          <div style="min-width:0;"><b style="font-size:.72rem;">${escFrotistaCadastro(item.categoria || item.descricao || 'Peça')}</b><div style="font-size:.63rem;color:var(--muted);margin-top:2px;line-height:1.35;">${escFrotistaCadastro(aplic)} • Qtd ${escFrotistaCadastro(item.qtdPadrao || 1)} • R$ ${venda.toFixed(2).replace('.',',')}<br>${codigos.length ? 'Códigos: ' + escFrotistaCadastro(codigos.join(' • ')) : 'Sem código definido'}</div></div>
          <div style="display:flex;gap:5px;"><button type="button" class="btn btn-ghost btn-sm" onclick="window.editarItemCatalogoFrotistaCliente('${escFrotistaCadastro(item.id)}')">✏</button><button type="button" class="btn btn-danger btn-sm" onclick="window.excluirItemCatalogoFrotistaCliente('${escFrotistaCadastro(item.id)}')">×</button></div>
        </div>`;
      }).join('')}</div>
    </div>`).join('');
}

function atualizarCategoriaComercialCliente(c) {
  const wrap = garantirCategoriaComercialCliente();
  if (!wrap) return;
  const protegido = clienteOficialProtegidoCadastro(c);
  wrap.style.display = protegido ? 'none' : '';
  const sel = document.getElementById('cliCategoriaComercial');
  if (!sel) return;
  if (protegido) {
    sel.value = 'comum';
    sel.disabled = true;
  } else {
    sel.disabled = false;
    const categoria = String(c?.categoriaComercial || (c?.frotista === true ? 'frotista' : 'comum')).toLowerCase();
    sel.value = categoria === 'frotista' ? 'frotista' : 'comum';
  }
  atualizarPainelFrotistaCliente(c);
}
window.atualizarCategoriaComercialCliente = atualizarCategoriaComercialCliente;

function atualizarPainelFrotistaCliente(c) {
  const painel = garantirPainelFrotistaCliente();
  if (!painel) return;
  const protegido = clienteOficialProtegidoCadastro(c);
  const frotista = !protegido && String(document.getElementById('cliCategoriaComercial')?.value || (c?.frotista ? 'frotista' : 'comum')).toLowerCase() === 'frotista';
  painel.style.display = frotista ? '' : 'none';
  if (!frotista) return;
  const resumo = document.getElementById('cliFrotistaResumo');
  if (resumo) resumo.textContent = c?.id ? `${veiculosFrotistaCliente(c).length} veículo(s) vinculados • ${catalogoFrotistaCliente(c).length} item(ns) na tabela` : 'Novo frotista — salve o cliente para habilitar vínculos e catálogo.';
  const aplic = document.getElementById('cliFrotistaAplicacao');
  if (aplic) aplic.innerHTML = opcoesAplicacaoCatalogoFrotista(c || {});
  renderVeiculosFrotistaCliente(c);
  renderCatalogoFrotistaCliente(c);
}
window.atualizarPainelFrotistaCliente = atualizarPainelFrotistaCliente;

window.limparFormCatalogoFrotistaCliente = function() {
  _sv('cliFrotistaItemId','');
  _sv('cliFrotistaGrupo','');
  _sv('cliFrotistaCategoria','');
  _sv('cliFrotistaCodigos','');
  _sv('cliFrotistaQtd','1');
  _sv('cliFrotistaVenda','');
  const c = clienteEdicaoAtualFrotista();
  const aplic = document.getElementById('cliFrotistaAplicacao');
  if (aplic) aplic.innerHTML = opcoesAplicacaoCatalogoFrotista(c || {});
  const cancelar = document.getElementById('cliFrotistaCancelarItem');
  if (cancelar) cancelar.style.display = 'none';
};

window.editarItemCatalogoFrotistaCliente = function(id) {
  const c = clienteEdicaoAtualFrotista();
  if (!c || clienteOficialProtegidoCadastro(c)) return;
  const item = catalogoFrotistaCliente(c).find(x => String(x.id) === String(id));
  if (!item) return;
  _sv('cliFrotistaItemId', item.id || '');
  _sv('cliFrotistaGrupo', item.grupo || '');
  _sv('cliFrotistaCategoria', item.categoria || item.descricao || '');
  _sv('cliFrotistaCodigos', Array.isArray(item.codigos) ? item.codigos.join(', ') : '');
  _sv('cliFrotistaQtd', String(item.qtdPadrao || 1).replace('.', ','));
  _sv('cliFrotistaVenda', Number(item.venda || 0).toFixed(2).replace('.', ','));
  const aplic = document.getElementById('cliFrotistaAplicacao');
  if (aplic) aplic.innerHTML = opcoesAplicacaoCatalogoFrotista(c, item);
  const cancelar = document.getElementById('cliFrotistaCancelarItem');
  if (cancelar) cancelar.style.display = '';
};

async function persistirCatalogoFrotistaCliente(c, catalogo, acao) {
  if (!c?.id || !podeGerenciarFrotistaCadastro() || clienteOficialProtegidoCadastro(c)) return false;
  await J.db.collection('clientes').doc(c.id).update({ catalogoPecasFrotista: catalogo, updatedAt: new Date().toISOString() });
  c.catalogoPecasFrotista = catalogo;
  try { audit('CLIENTES', acao || `Atualizou catálogo frotista ${c.nome || c.id}`); } catch (_) {}
  return true;
}

window.salvarItemCatalogoFrotistaCliente = async function() {
  const c = clienteEdicaoAtualFrotista();
  if (!c?.id) { toastWarn('Salve o cliente como Frotista antes de cadastrar peças.'); return; }
  if (!podeGerenciarFrotistaCadastro() || clienteOficialProtegidoCadastro(c)) return;
  if (String(document.getElementById('cliCategoriaComercial')?.value || '').toLowerCase() !== 'frotista') { toastWarn('Marque este cliente como Frotista primeiro.'); return; }
  const grupo = String(_v('cliFrotistaGrupo') || '').trim();
  const categoria = String(_v('cliFrotistaCategoria') || '').trim();
  const venda = typeof numBR === 'function' ? numBR(_v('cliFrotistaVenda') || 0) : Number(String(_v('cliFrotistaVenda') || '0').replace(',','.'));
  const qtd = Math.max(typeof numBR === 'function' ? numBR(_v('cliFrotistaQtd') || 1) : Number(String(_v('cliFrotistaQtd') || '1').replace(',','.')), 0.01);
  if (!grupo || !categoria) { toastWarn('Informe o grupo e a categoria/peça.'); return; }
  if (!(venda >= 0)) { toastWarn('Informe um preço de venda válido.'); return; }
  const codigos = Array.from(new Set(String(_v('cliFrotistaCodigos') || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)));
  const aplicRaw = String(document.getElementById('cliFrotistaAplicacao')?.value || 'todos:*');
  const [aplicacaoTipo, ...rest] = aplicRaw.split(':');
  const aplicacaoValor = rest.join(':') || '*';
  const veics = veiculosFrotistaCliente(c);
  let aplicacaoLabel = 'Toda a frota', veiculoModelo = '', veiculoPlaca = '';
  if (aplicacaoTipo === 'modelo') {
    const v = veics.find(x => normalizarFrotistaCadastro([x.marca, x.modelo].filter(Boolean).join(' ').trim() || x.modelo || x.placa) === aplicacaoValor);
    veiculoModelo = [v?.marca, v?.modelo].filter(Boolean).join(' ').trim() || v?.modelo || aplicacaoValor;
    aplicacaoLabel = `Modelo: ${veiculoModelo}`;
  } else if (aplicacaoTipo === 'veiculo') {
    const v = veics.find(x => String(x.id) === aplicacaoValor);
    veiculoPlaca = v?.placa || '';
    veiculoModelo = v?.modelo || '';
    aplicacaoLabel = [veiculoPlaca, veiculoModelo].filter(Boolean).join(' • ') || 'Veículo específico';
  }
  const idEdit = String(_v('cliFrotistaItemId') || '');
  const catalogo = catalogoFrotistaCliente(c);
  const idx = catalogo.findIndex(x => String(x.id) === idEdit);
  const anterior = idx >= 0 ? catalogo[idx] : null;
  const item = Object.assign({}, anterior || {}, {
    id: anterior?.id || ('cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7)),
    grupo, categoria, descricao: categoria, codigos, qtdPadrao: qtd, venda,
    aplicacaoTipo: ['todos','modelo','veiculo'].includes(aplicacaoTipo) ? aplicacaoTipo : 'todos',
    aplicacaoValor,
    aplicacaoLabel,
    veiculoModeloKey: aplicacaoTipo === 'modelo' ? aplicacaoValor : '',
    veiculoModelo,
    veiculoId: aplicacaoTipo === 'veiculo' ? aplicacaoValor : '',
    veiculoPlaca,
    updatedAt: new Date().toISOString(),
    createdAt: anterior?.createdAt || new Date().toISOString()
  });
  if (idx >= 0) catalogo[idx] = item; else catalogo.push(item);
  await persistirCatalogoFrotistaCliente(c, catalogo, `${idx >= 0 ? 'Atualizou' : 'Cadastrou'} peça frotista ${categoria} (${grupo})`);
  toastOk(idx >= 0 ? 'Peça do frotista atualizada!' : 'Peça cadastrada para o frotista!');
  window.limparFormCatalogoFrotistaCliente();
  atualizarPainelFrotistaCliente(c);
};

window.excluirItemCatalogoFrotistaCliente = async function(id) {
  const c = clienteEdicaoAtualFrotista();
  if (!c?.id || !podeGerenciarFrotistaCadastro() || clienteOficialProtegidoCadastro(c)) return;
  const item = catalogoFrotistaCliente(c).find(x => String(x.id) === String(id));
  if (!item) return;
  const ok = await confirmar(`Excluir ${item.categoria || item.descricao || 'esta peça'} da tabela deste frotista?`, 'Tabela do frotista');
  if (!ok) return;
  const catalogo = catalogoFrotistaCliente(c).filter(x => String(x.id) !== String(id));
  await persistirCatalogoFrotistaCliente(c, catalogo, `Excluiu peça frotista ${item.categoria || item.descricao || id}`);
  toastOk('Peça removida da tabela do frotista.');
  window.limparFormCatalogoFrotistaCliente();
  atualizarPainelFrotistaCliente(c);
};

window.novoVeiculoFrotistaCliente = function() {
  const c = clienteEdicaoAtualFrotista();
  if (!c?.id) { toastWarn('Salve o cliente antes de cadastrar o veículo da frota.'); return; }
  if (!podeGerenciarFrotistaCadastro() || clienteOficialProtegidoCadastro(c)) return;
  try { closeModal('modalCliente'); } catch (_) {}
  window.prepVeiculo?.('add');
  setTimeout(() => {
    _sv('veicDono', c.id);
    try { openModal('modalVeiculo'); } catch (_) {}
  }, 20);
};
// ============================================================
// CLIENTES
// ============================================================
window.renderClientes = function() {
  _sh('tbClientes', J.clientes.map(c => {
    const nVeics = J.veiculos.filter(v => v.clienteId === c.id).length;
    const totalOS = J.os.filter(o => o.clienteId === c.id && o.status === 'Concluido')
      .reduce((a, o) => a + (o.total || 0), 0);
    return `<tr>
      <td>
        <div style="font-weight:600">${c.nome}${String(c.categoriaComercial || (c.frotista === true ? 'frotista' : '')).toLowerCase() === 'frotista' ? ' <span class="badge badge-brand" style="font-size:.52rem;vertical-align:middle;">FROTISTA</span>' : ''}</div>
        <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-muted)">${c.doc || ''}</div>
      </td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${c.wpp || '—'}</td>
      <td><span class="badge badge-brand">${nVeics}</span></td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem;color:var(--success)">${moeda(totalOS)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepCliente('edit','${c.id}');openModal('modalCliente')" style="margin-right:4px">✏</button>
        ${(podeGerenciarFrotistaCadastro() && !clienteOficialProtegidoCadastro(c) && String(c.categoriaComercial || (c.frotista === true ? 'frotista' : '')).toLowerCase() === 'frotista') ? `<button class="btn btn-ghost btn-sm" onclick="prepCliente('edit','${c.id}');openModal('modalCliente');setTimeout(()=>window.atualizarPainelFrotistaCliente?.(J.clientes.find(x=>x.id==='${c.id}')),30)" style="margin-right:4px" title="Gerenciar frota e tabela de peças">🚚 FROTA</button>` : ''}
        ${c.wpp ? `<button class="btn btn-success btn-sm" onclick="_wppCliente('${c.id}')" style="margin-right:4px" title="WhatsApp">💬</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deletarCliente('${c.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(5, '👥', 'Nenhum cliente cadastrado'));
};

window.prepCliente = function(mode, id = null) {
  ['cliId','cliNome','cliWpp','cliDoc','cliEmail','cliLogin','cliPin','cliCep','cliRua','cliNum','cliBairro','cliCidade'].forEach(f => _sv(f, ''));
  _sv('cliPin', randId(6));
  garantirCategoriaComercialCliente();
  atualizarCategoriaComercialCliente(null);

  if (mode === 'edit' && id) {
    const c = J.clientes.find(x => x.id === id);
    if (!c) return;
    atualizarCategoriaComercialCliente(c);
    _sv('cliId',     c.id);
    _sv('cliNome',  c.nome  || '');
    _sv('cliWpp',   c.wpp   || '');
    _sv('cliDoc',   c.doc   || '');
    _sv('cliEmail', c.email || '');
    _sv('cliLogin', c.login || '');
    _sv('cliPin',   c.pin   || '');
    _sv('cliCep',   c.cep   || '');
    _sv('cliRua',   c.rua   || '');
    _sv('cliNum',   c.num   || '');
    _sv('cliBairro',c.bairro|| '');
    _sv('cliCidade',c.cidade|| '');
  }
};

window.salvarCliente = async function() {
  if (!_v('cliNome')) { toastWarn('Nome é obrigatório'); return; }

  // ═══ VALIDAÇÃO FISCAL OFICIAL DO DOCUMENTO (CPF/CNPJ) ═══
  const docRaw = _v('cliDoc');
  const docLimpo = String(docRaw || '').replace(/[^\d]/g, '');
  let docFormatado = docRaw;
  if (docLimpo) {
    if (docLimpo.length === 11) {
      if (typeof window.validarCPF === 'function' && !window.validarCPF(docLimpo)) {
        toastWarn('CPF inválido. Verifique os dígitos verificadores.');
        return;
      }
      docFormatado = window.formatarCPF ? window.formatarCPF(docLimpo) : docRaw;
    } else if (docLimpo.length === 14) {
      if (typeof window.validarCNPJ === 'function' && !window.validarCNPJ(docLimpo)) {
        toastWarn('CNPJ inválido. Verifique os dígitos verificadores.');
        return;
      }
      docFormatado = window.formatarCNPJ ? window.formatarCNPJ(docLimpo) : docRaw;
    } else if (docLimpo.length > 0) {
      toastWarn('Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.');
      return;
    }
    // Verifica duplicidade na base do tenant
    const id = _v('cliId');
    if (typeof window.cpfDuplicado === 'function' && window.cpfDuplicado(docLimpo, J.clientes, id)) {
      toastWarn('Já existe outro cliente cadastrado com este CPF/CNPJ.');
      return;
    }
  }

  const p = {
    tenantId:  J.tid,
    nome:      _v('cliNome'),
    wpp:       _v('cliWpp'),
    doc:       docFormatado,
    docLimpo:  docLimpo,
    email:     _v('cliEmail'),
    login:     _v('cliLogin'),
    pin:       _v('cliPin'),
    senha:     _v('cliPin'),
    password:  _v('cliPin'),
    cep:       _v('cliCep'),
    rua:       _v('cliRua'),
    num:       _v('cliNum'),
    bairro:    _v('cliBairro'),
    cidade:    _v('cliCidade'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('cliId');
  const clienteExistente = id ? J.clientes.find(x => String(x.id) === String(id)) : null;
  if (podeGerenciarFrotistaCadastro() && !clienteOficialProtegidoCadastro(clienteExistente)) {
    const categoriaComercial = String(_v('cliCategoriaComercial') || 'comum').toLowerCase() === 'frotista' ? 'frotista' : 'comum';
    p.categoriaComercial = categoriaComercial;
    p.frotista = categoriaComercial === 'frotista';
  }
  if (id) await J.db.collection('clientes').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('clientes').add(p); }

  toastOk('Cliente salvo!');
  closeModal('modalCliente');
  audit('CLIENTES', `Salvou cliente ${p.nome}`);
};

window.deletarCliente = async function(id) {
  const ok = await confirmar('Deletar este cliente? Esta ação não pode ser desfeita.', 'Atenção');
  if (!ok) return;
  const c = J.clientes?.find(x => x.id === id);
  const auditOk = await exclusaoAuditadaClientes('clientes', id, `cliente ${c?.nome || id}`, 'cliente');
  if (!auditOk) return;
  toastOk('Cliente removido');
  audit('CLIENTES', `Deletou cliente ${id}`);
};

window._wppCliente = function(cid) {
  const c = J.clientes.find(x => x.id === cid);
  if (!c?.wpp) return;
  abrirWpp(c.wpp, `Olá ${c.nome}! Aqui é a ${J.tnome}. 👋`);
};

// ============================================================
// VEÍCULOS
// ============================================================
window.renderVeiculos = function() {
  _sh('tbVeiculos', J.veiculos.map(v => {
    const c = J.clientes.find(x => x.id === v.clienteId);
    return `<tr>
      <td><span class="placa">${v.placa || '—'}</span></td>
      <td>${badgeTipo(v.tipo || 'carro')}</td>
      <td>
        <div style="font-weight:600">${v.modelo || '—'}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${v.ano || ''} ${v.cor ? '· ' + v.cor : ''}</div>
      </td>
      <td>${c?.nome || '—'}</td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${v.km ? Number(v.km).toLocaleString('pt-BR') + ' km' : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepVeiculo('edit','${v.id}');openModal('modalVeiculo')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarVeiculo('${v.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(6, '🚗', 'Nenhum veículo cadastrado'));
};

window.prepVeiculo = function(mode, id = null) {
  ['veicId','veicPlaca','veicModelo','veicAno','veicCor','veicKm','veicObs'].forEach(f => _sv(f, ''));
  _sv('veicTipo', 'carro');
  popularSelects();

  if (mode === 'edit' && id) {
    const v = J.veiculos.find(x => x.id === id);
    if (!v) return;
    _sv('veicId',     v.id);
    _sv('veicTipo',   v.tipo      || 'carro');
    _sv('veicDono',   v.clienteId || '');
    _sv('veicPlaca',  v.placa     || '');
    _sv('veicModelo', v.modelo    || '');
    _sv('veicAno',    v.ano       || '');
    _sv('veicCor',    v.cor       || '');
    _sv('veicKm',     v.km        || '');
    _sv('veicObs',    v.obs       || '');
  }
};

window.salvarVeiculo = async function() {
  if (!_v('veicPlaca') || !_v('veicModelo')) {
    toastWarn('Placa e modelo são obrigatórios');
    return;
  }
  const p = {
    tenantId:  J.tid,
    tipo:      _v('veicTipo'),
    clienteId: _v('veicDono'),
    placa:     _v('veicPlaca').toUpperCase().replace(/\s/g, ''),
    modelo:    _v('veicModelo'),
    ano:       _v('veicAno'),
    cor:       _v('veicCor'),
    km:        _v('veicKm'),
    obs:       _v('veicObs'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('veicId');
  if (id) await J.db.collection('veiculos').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('veiculos').add(p); }

  toastOk('Veículo salvo!');
  closeModal('modalVeiculo');
  audit('VEÍCULOS', `Salvou veículo ${p.placa}`);
};

window.deletarVeiculo = async function(id) {
  const ok = await confirmar('Deletar este veículo?');
  if (!ok) return;
  const v = J.veiculos?.find(x => x.id === id);
  const auditOk = await exclusaoAuditadaClientes('veiculos', id, `veiculo ${v?.placa || id}`, 'veiculo');
  if (!auditOk) return;
  toastOk('Veículo removido');
};

// ============================================================
// ESTOQUE
// ============================================================
window.renderEstoque = function() {
  _sh('tbEstoque', J.estoque.map(p => {
    const crit = (p.qtd || 0) <= (p.min || 0);
    const margem = p.custo > 0 ? (((p.venda - p.custo) / p.custo) * 100).toFixed(0) : 0;
    return `<tr class="${crit ? 'row-critical' : ''}">
      <td style="font-family:var(--ff-mono);font-size:0.72rem;color:var(--text-muted)">${p.codigo || '—'}</td>
      <td>
        <div style="font-weight:600">${p.desc}</div>
        <div style="font-size:0.68rem;color:var(--text-muted)">${p.und || 'UN'}</div>
      </td>
      <td style="font-family:var(--ff-mono)">${moeda(p.custo)}</td>
      <td style="font-family:var(--ff-mono);color:var(--success)">${moeda(p.venda)}</td>
      <td>
        <span style="font-family:var(--ff-mono);font-size:0.75rem;color:${margem >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${margem}%
        </span>
      </td>
      <td style="font-family:var(--ff-mono);font-weight:700;color:${crit ? 'var(--danger)' : 'var(--text-primary)'}">${p.qtd || 0}</td>
      <td style="font-family:var(--ff-mono);color:var(--text-muted)">${p.min || 0}</td>
      <td>${crit ? badgeStatus('Cancelado') : badgeStatus('Concluido')}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepPeca('edit','${p.id}');openModal('modalPeca')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarPeca('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || tableEmpty(9, '📦', 'Nenhum item no estoque'));
};

window.prepPeca = function(mode, id = null) {
  ['pecaId','pecaCodigo','pecaDesc','pecaCusto','pecaVenda','pecaQtd','pecaMin'].forEach(f => _sv(f, ''));
  _sv('pecaUnd', 'UN');
  _st('pecaMargem', '—');

  if (mode === 'edit' && id) {
    const p = J.estoque.find(x => x.id === id);
    if (!p) return;
    _sv('pecaId',     p.id);
    _sv('pecaCodigo', p.codigo || '');
    _sv('pecaDesc',   p.desc   || '');
    _sv('pecaCusto',  p.custo  || 0);
    _sv('pecaVenda',  p.venda  || 0);
    _sv('pecaQtd',    p.qtd    || 0);
    _sv('pecaMin',    p.min    || 0);
    _sv('pecaUnd',    p.und    || 'UN');
    calcMargem();
  }
};

window.calcMargem = function() {
  const c = parseFloat(_v('pecaCusto') || 0);
  const v = parseFloat(_v('pecaVenda') || 0);
  const el = _$('pecaMargem');
  if (!el) return;
  if (c > 0 && v > 0) {
    const m = ((v - c) / c * 100).toFixed(1);
    el.textContent = `${m}% de margem`;
    el.style.color = parseFloat(m) >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    el.textContent = '—';
    el.style.color = 'var(--text-muted)';
  }
};

window.salvarPeca = async function() {
  if (!_v('pecaDesc')) { toastWarn('Descrição é obrigatória'); return; }
  const p = {
    tenantId:  J.tid,
    codigo:    _v('pecaCodigo'),
    desc:      _v('pecaDesc'),
    custo:     parseFloat(_v('pecaCusto') || 0),
    venda:     parseFloat(_v('pecaVenda') || 0),
    qtd:       parseInt(_v('pecaQtd')    || 0),
    min:       parseInt(_v('pecaMin')    || 0),
    und:       _v('pecaUnd'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('pecaId');
  if (id) await J.db.collection('estoqueItems').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('estoqueItems').add(p); }

  toastOk('Peça salva!');
  closeModal('modalPeca');
  audit('ESTOQUE', `Salvou peça ${p.desc}`);
};

window.deletarPeca = async function(id) {
  const ok = await confirmar('Deletar esta peça do estoque?');
  if (!ok) return;
  const p = J.estoque?.find(x => x.id === id);
  const auditOk = await exclusaoAuditadaClientes('estoqueItems', id, `peca ${p?.desc || id}`, 'estoque');
  if (!auditOk) return;
  toastOk('Peça removida');
};

// ============================================================
// FORNECEDORES
// ============================================================
window.renderFornecedores = function() {
  _sh('tbFornec', J.fornecedores.map(f => `
    <tr>
      <td><div style="font-weight:600">${f.nome}</div></td>
      <td style="font-size:0.78rem;color:var(--text-secondary)">${f.segmento || '—'}</td>
      <td style="font-family:var(--ff-mono);font-size:0.78rem">${f.wpp || '—'}</td>
      <td style="white-space:nowrap">
        ${f.wpp ? `<button class="btn btn-success btn-sm" onclick="abrirWpp('${f.wpp}','')" style="margin-right:4px">💬</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="prepFornec('edit','${f.id}');openModal('modalFornec')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarFornec('${f.id}')">🗑</button>
      </td>
    </tr>
  `).join('') || tableEmpty(4, '🏭', 'Nenhum fornecedor cadastrado'));
};

window.prepFornec = function(mode = 'add', id = null) {
  ['fornecId','fornecNome','fornecSeg','fornecWpp','fornecEmail'].forEach(f => _sv(f, ''));
  if (mode === 'edit' && id) {
    const f = J.fornecedores.find(x => x.id === id);
    if (!f) return;
    _sv('fornecId',    f.id);
    _sv('fornecNome',  f.nome      || '');
    _sv('fornecSeg',   f.segmento  || '');
    _sv('fornecWpp',   f.wpp       || '');
    _sv('fornecEmail', f.email     || '');
  }
};

window.salvarFornec = async function() {
  if (!_v('fornecNome')) { toastWarn('Nome é obrigatório'); return; }
  const p = {
    tenantId:  J.tid,
    nome:      _v('fornecNome'),
    segmento:  _v('fornecSeg'),
    wpp:       _v('fornecWpp'),
    email:     _v('fornecEmail'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('fornecId');
  if (id) await J.db.collection('fornecedores').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('fornecedores').add(p); }

  toastOk('Fornecedor salvo!');
  closeModal('modalFornec');
};

window.deletarFornec = async function(id) {
  const ok = await confirmar('Deletar este fornecedor?');
  if (!ok) return;
  const f = J.fornecedores?.find(x => x.id === id);
  const auditOk = await exclusaoAuditadaClientes('fornecedores', id, `fornecedor ${f?.nome || id}`, 'fornecedor');
  if (!auditOk) return;
  toastOk('Fornecedor removido');
};

// ============================================================
// EQUIPE / RH
// ============================================================
window.renderEquipe = function() {
  _sh('tbEquipe', J.equipe.map(f => `
    <tr>
      <td>
        <div style="font-weight:600">${f.nome}</div>
        <div style="font-family:var(--ff-mono);font-size:0.65rem;color:var(--text-muted)">${f.wpp || ''}</div>
      </td>
      <td><span class="badge badge-brand">${JARVIS_CONST.CARGOS[f.cargo] || f.cargo}</span></td>
      <td style="font-family:var(--ff-mono);font-size:0.75rem;color:var(--text-secondary)">${f.usuario}</td>
      <td>
        <span style="font-family:var(--ff-mono);font-size:0.82rem;font-weight:700;color:var(--success)">
          ${f.comissaoPecas || 0}% / ${f.comissaoMO || 0}%
        </span>
      </td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="prepFunc('edit','${f.id}');openModal('modalFunc')" style="margin-right:4px">✏</button>
        <button class="btn btn-danger btn-sm" onclick="deletarFunc('${f.id}')">🗑</button>
      </td>
    </tr>
  `).join('') || tableEmpty(5, '👷', 'Nenhum colaborador cadastrado'));
};

window.prepFunc = function(mode, id = null) {
  ['funcId','funcNome','funcWpp','funcComissaoPecas','funcComissaoMO','funcUser','funcPass'].forEach(f => _sv(f, ''));
  _sv('funcCargo', 'mecanico');
  if (mode === 'edit' && id) {
    const f = J.equipe.find(x => x.id === id);
    if (!f) return;
    _sv('funcId',       f.id);
    _sv('funcNome',     f.nome      || '');
    _sv('funcWpp',      f.wpp       || '');
    _sv('funcCargo',    f.cargo     || 'mecanico');
    _sv('funcComissaoPecas', f.comissaoPecas  || 0);
    _sv('funcComissaoMO',    f.comissaoMO     || 0);
    _sv('funcUser',     f.usuario   || '');
    _sv('funcPass',     f.senha     || '');
  }
};

window.salvarFunc = async function() {
  if (!_v('funcNome') || !_v('funcUser') || !_v('funcPass')) {
    toastWarn('Preencha nome, usuário e senha');
    return;
  }
  const p = {
    tenantId:  J.tid,
    nome:      _v('funcNome'),
    wpp:       _v('funcWpp'),
    cargo:     _v('funcCargo'),
    comissaoPecas:  parseFloat(_v('funcComissaoPecas') || 0),
    comissaoMO:     parseFloat(_v('funcComissaoMO') || 0),
    usuario:   _v('funcUser'),
    senha:     _v('funcPass'),
    updatedAt: new Date().toISOString()
  };
  const id = _v('funcId');
  if (id) await J.db.collection('funcionarios').doc(id).update(p);
  else { p.createdAt = new Date().toISOString(); await J.db.collection('funcionarios').add(p); }

  toastOk('Colaborador salvo!');
  closeModal('modalFunc');
  audit('EQUIPE', `Salvou colaborador ${p.nome}`);
};

window.deletarFunc = async function(id) {
  const ok = await confirmar('Remover este colaborador? O acesso será revogado imediatamente.', 'Atenção');
  if (!ok) return;
  const f = J.equipe?.find(x => x.id === id);
  const auditOk = await exclusaoAuditadaClientes('funcionarios', id, `colaborador ${f?.nome || id}`, 'equipe');
  if (!auditOk) return;
  toastOk('Colaborador removido');
  audit('EQUIPE', `Removeu colaborador ${id}`);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => { garantirCategoriaComercialCliente(); garantirPainelFrotistaCliente(); }, 0));
else setTimeout(() => { garantirCategoriaComercialCliente(); garantirPainelFrotistaCliente(); }, 0);
