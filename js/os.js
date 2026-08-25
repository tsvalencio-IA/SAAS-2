/**
 * JARVIS ERP — os.js
 * Motor de Ordens de Serviço, Kanban Chevron 7 Etapas, WhatsApp B2C, Laudos PDF
 *
 * Powered by thIAguinho Soluções Digitais
 */

'use strict';

function dataLocalISOOS(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function somarDiasISOOS(iso, dias) {
  const [y,m,d] = String(iso || '').slice(0,10).split('-').map(Number);
  if (!y || !m || !d) return dataLocalISOOS();
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(dias || 0));
  return dataLocalISOOS(dt);
}
function somarMesesISOOS(iso, meses) {
  const [y,m,d] = String(iso || '').slice(0,10).split('-').map(Number);
  if (!y || !m || !d) return dataLocalISOOS();
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + Number(meses || 0));
  return dataLocalISOOS(dt);
}
function financeiroOSLiquidadoOS(fin) {
  const st = normalizarStatusFluxoOS(fin?.status || '');
  return st === 'pago' || st === 'liquidado' || st === 'baixado' || st === 'parcial' || !!fin?.dataPgto || !!fin?.pagoEm;
}
function financeiroOSCanceladoOS(fin) {
  const st = normalizarStatusFluxoOS(fin?.status || '');
  return st === 'cancelado' || st === 'cancelada' || fin?.canceladoPorReemissaoOS === true;
}

const OSU = () => window.JarvisOSUtils || window.JOS || {};
const numBR = value => (OSU().parseNumberBR ? OSU().parseNumberBR(value) : (parseFloat(String(value || 0).replace(',', '.')) || 0));
const taxaDescontoOS = value => {
  const v = numBR(value);
  return v > 1 ? +(v / 100).toFixed(6) : v;
};

function combinarDescontosOS(geral, individual) {
  const g = Math.min(1, Math.max(0, taxaDescontoOS(geral || 0)));
  const i = Math.min(1, Math.max(0, taxaDescontoOS(individual || 0)));
  return +(1 - ((1 - g) * (1 - i))).toFixed(6);
}

function descontoIndividualLinhaOS(row, tipo) {
  // Cliente oficial usa exclusivamente o percentual geral congelado na O.S.
  // Desconto individual em reais continua existindo apenas para os demais clientes.
  if (clienteGovernamentalAtualOS()) return 0;
  const seletor = tipo === 'servico' ? '.serv-desc-individual' : '.peca-desc-individual';
  return Math.max(0, numBR(row?.querySelector?.(seletor)?.value || row?.dataset?.descontoIndividualValor || 0));
}

function descontoIndividualSalvoValorOS(item, bruto) {
  if (OSU().getItemIndividualDiscountValue) return OSU().getItemIndividualDiscountValue(item || {}, bruto || 0);
  const base = Math.max(0, numBR(bruto || 0));
  if (item?.descontoIndividualTipo === 'valor' || item?.descontoIndividualValor != null || item?.descIndividualValor != null) {
    return Math.min(base, Math.max(0, numBR(item.descontoIndividualValor ?? item.descIndividualValor ?? item.descontoIndividual ?? 0)));
  }
  const taxaLegada = taxaDescontoOS(item?.descIndividualPct ?? item?.descIndividual ?? item?.descontoIndividual ?? 0);
  return +(base * taxaLegada).toFixed(2);
}

function calcularDescontosValorOS(bruto, taxaGeral, descontoIndividualValor) {
  if (OSU().calculateDiscountBreakdown) return OSU().calculateDiscountBreakdown(bruto, taxaGeral, descontoIndividualValor);
  const original = +Math.max(0, numBR(bruto || 0)).toFixed(2);
  const geralPct = Math.min(1, Math.max(0, taxaDescontoOS(taxaGeral || 0)));
  const descontoGeralValor = +(original * geralPct).toFixed(2);
  const individual = +Math.min(Math.max(0, original - descontoGeralValor), Math.max(0, numBR(descontoIndividualValor || 0))).toFixed(2);
  const descontoValor = +(descontoGeralValor + individual).toFixed(2);
  const valorFinal = +Math.max(0, original - descontoValor).toFixed(2);
  return { valorOriginal: original, valorBruto: original, bruto: original, descontoGeralValor, descontoIndividualValor: individual, descontoValor, valorFinal, total: valorFinal, descGeralPct: geralPct, descPct: original > 0 ? +(descontoValor/original).toFixed(6) : 0 };
}

function garantirEstilosOSV22() {
  if (document.getElementById('os-v22-estilos')) return;
  const style = document.createElement('style');
  style.id = 'os-v22-estilos';
  style.textContent = `
    .desconto-individual-os-wrap{grid-column:1/-1;display:grid;grid-template-columns:minmax(150px,1fr) minmax(105px,130px) minmax(150px,1fr) minmax(105px,130px);gap:7px;align-items:center;width:100%;min-width:0;padding-top:4px;font-family:var(--fm);font-size:.58rem;color:var(--muted)}
    .desconto-individual-os-wrap .j-input{width:100%!important;min-width:0;text-align:right;min-height:34px}
    .desconto-individual-os-wrap .os-money-field{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px;align-items:center;min-width:0}
    .serv-rateio-wrap{grid-column:1/-1;width:100%;min-width:0;border:1px solid rgba(0,212,255,.18);background:rgba(0,212,255,.035);border-radius:5px;padding:8px;box-sizing:border-box}
    .serv-rateio-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
    .serv-rateio-list{display:grid;gap:6px;min-width:0}
    .serv-rateio-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(120px,150px) 34px;gap:7px;align-items:center;min-width:0}
    .serv-rateio-row .j-select,.serv-rateio-row .j-input{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
    .serv-rateio-help{font-family:var(--fm);font-size:.56rem;color:var(--muted);line-height:1.35}
    .serv-terceirizado-wrap{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(145px,190px) minmax(250px,1fr);gap:7px;align-items:center;width:100%;min-width:0;border:1px solid rgba(255,184,0,.20);background:rgba(255,184,0,.035);border-radius:5px;padding:8px;box-sizing:border-box;font-family:var(--fm)}
    .serv-terceirizado-wrap>label{font-size:.58rem;color:var(--muted);font-weight:700;letter-spacing:.35px;white-space:nowrap}
    .serv-terceirizado-wrap .j-select,.serv-terceirizado-wrap .j-input{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
    .serv-terceirizado-campo{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:center;min-width:0}
    .serv-terceirizado-campo>label{font-size:.58rem;color:var(--warn);font-weight:700;letter-spacing:.35px;white-space:nowrap}
    .serv-terceirizado-campo[hidden]{display:none!important}
    .serv-terceirizado-financeiro{grid-column:1/-1;display:grid;grid-template-columns:minmax(150px,1fr) minmax(150px,1fr) minmax(125px,.75fr) minmax(135px,.8fr);gap:7px;align-items:end;min-width:0;padding-top:4px;border-top:1px dashed rgba(255,184,0,.18)}
    .serv-terceirizado-financeiro[hidden]{display:none!important}
    .serv-terceirizado-financeiro .serv-terceirizado-fin-item{display:grid;gap:4px;min-width:0}
    .serv-terceirizado-financeiro .serv-terceirizado-fin-item>label{font-size:.55rem;color:var(--muted);font-weight:700;letter-spacing:.35px;white-space:normal}
    .serv-terceirizado-financeiro .serv-terceirizado-valor{color:var(--warn);font-family:var(--fm);font-weight:800}
    .serv-terceirizado-status{grid-column:1/-1;font-size:.56rem;color:var(--muted);line-height:1.35}
    @media(max-width:720px){
      .desconto-individual-os-wrap{grid-template-columns:1fr;gap:4px}
      .desconto-individual-os-wrap label{margin-top:3px}
      .serv-rateio-row{grid-template-columns:1fr;gap:5px;border:1px solid rgba(255,255,255,.08);padding:7px;border-radius:4px}
      .serv-rateio-row .serv-rateio-remove{width:100%!important;height:34px!important}
      .serv-rateio-head button{width:100%}
      .serv-terceirizado-wrap{grid-template-columns:1fr;gap:5px}
      .serv-terceirizado-wrap>label,.serv-terceirizado-campo>label{white-space:normal;margin-top:2px}
      .serv-terceirizado-campo{grid-template-columns:1fr;gap:4px}
      .serv-terceirizado-financeiro{grid-template-columns:1fr;gap:6px}
      #containerServicosOS>div,#containerPecasOS>div{max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box}
    }
  `;
  document.head.appendChild(style);
}

function atualizarDescontoServicoPorValorCobradoOS(input) {
  const row = input?.closest?.('#containerServicosOS > div, .cilia-serv-relac');
  if (!row) return;
  const bruto = Math.max(0, numBR(row.querySelector('.serv-valor')?.value || 0));
  const geral = Math.min(1, Math.max(0, taxaDescontoOS(descontoMaoObraAtualOS?.() || 0)));
  const aposGeral = Math.max(0, +(bruto * (1 - geral)).toFixed(2));
  const cobrado = Math.max(0, Math.min(aposGeral, numBR(input.value || 0)));
  const descontoIndividual = Math.max(0, +(aposGeral - cobrado).toFixed(2));
  const campoDesc = row.querySelector('.serv-desc-individual');
  if (campoDesc) campoDesc.value = descontoIndividual ? descontoIndividual.toFixed(2).replace('.', ',') : '';
  row.dataset.descontoIndividualValor = descontoIndividual || '';
  row.dataset.valorCobradoManual = '1';
  window.calcOSTotal?.();
}
window.atualizarDescontoServicoPorValorCobradoOS = atualizarDescontoServicoPorValorCobradoOS;

function instalarDescontoIndividualLinhaOS(row, tipo, valor) {
  if (!row) return;
  // Regra do cliente oficial: somente desconto percentual geral da O.S.;
  // não exibir nem aplicar desconto individual em reais nas linhas.
  if (clienteGovernamentalAtualOS()) {
    row.querySelector('.desconto-individual-os-wrap')?.remove();
    row.dataset.descontoIndividualValor = '';
    row.dataset.valorCobradoManual = '';
    return;
  }
  if (row.querySelector('.desconto-individual-os-wrap')) return;
  garantirEstilosOSV22();
  const classe = tipo === 'servico' ? 'serv-desc-individual' : 'peca-desc-individual';
  const label = tipo === 'servico' ? 'DESCONTO DESTE SERVIÇO (R$)' : 'DESCONTO DESTA PEÇA (R$)';
  const descontoValor = Math.max(0, numBR(valor || 0));
  const box = document.createElement('div');
  box.className = 'desconto-individual-os-wrap';
  if (tipo === 'servico') {
    const bruto = Math.max(0, numBR(row.querySelector('.serv-valor')?.value || 0));
    const calc = calcularDescontosValorOS(bruto, descontoMaoObraAtualOS?.() || 0, descontoValor);
    box.innerHTML = `<label>${label}</label><div class="os-money-field"><b style="color:var(--warn)">R$</b><input type="text" inputmode="decimal" class="j-input ${classe}" value="${descontoValor ? descontoValor.toFixed(2).replace('.', ',') : ''}" placeholder="0,00" oninput="this.closest('#containerServicosOS > div, .cilia-serv-relac').dataset.descontoIndividualValor=this.value;this.closest('#containerServicosOS > div, .cilia-serv-relac').dataset.valorCobradoManual='';window.calcOSTotal()" title="Valor em reais descontado deste serviço."></div><label>VALOR COBRADO (R$)</label><div class="os-money-field"><b style="color:var(--ok)">R$</b><input type="text" inputmode="decimal" class="j-input serv-valor-cobrado" value="${calc.valorFinal.toFixed(2).replace('.', ',')}" placeholder="0,00" oninput="window.atualizarDescontoServicoPorValorCobradoOS(this)" title="Valor final cobrado neste serviço. Ao editar, o desconto em reais é recalculado."></div>`;
  } else {
    box.innerHTML = `<label>${label}</label><div class="os-money-field"><b style="color:var(--warn)">R$</b><input type="text" inputmode="decimal" class="j-input ${classe}" value="${descontoValor ? descontoValor.toFixed(2).replace('.', ',') : ''}" placeholder="0,00" oninput="this.closest('[data-cilia-piece-index],#containerPecasOS > div').dataset.descontoIndividualValor=this.value;window.calcOSTotal()" title="Valor em reais descontado desta peça."></div><label>VALOR COBRADO</label><div class="os-money-field"><b style="color:var(--ok)">R$</b><input type="text" class="j-input peca-valor-cobrado" value="0,00" readonly tabindex="-1" title="Valor final cobrado após descontos."></div>`;
  }
  row.dataset.descontoIndividualValor = descontoValor || '';
  row.appendChild(box);
}

function focarLinhaNovaOS(row, seletor) {
  if (!row || !window.event?.isTrusted) return;
  try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { try { row.scrollIntoView(); } catch(__){} }
  setTimeout(() => {
    const campo = row.querySelector(seletor) || row.querySelector('input,select,textarea');
    try { campo?.focus({ preventScroll: true }); } catch (_) { try { campo?.focus(); } catch(__){} }
  }, 120);
}
const escOS = value => (OSU().escapeHtml ? OSU().escapeHtml(value) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

function setTextOS(el, value) {
  if (!el) return false;
  if (window.thiaRuntimeCore?.setText) return window.thiaRuntimeCore.setText(el, value);
  const next = String(value ?? '');
  if (el.textContent === next) return false;
  el.textContent = next;
  return true;
}
function setHTMLOS(el, value) {
  if (!el) return false;
  if (window.thiaRuntimeCore?.setHTML) return window.thiaRuntimeCore.setHTML(el, value);
  const next = String(value ?? '');
  if (el.innerHTML === next) return false;
  el.innerHTML = next;
  return true;
}
function setValueOS(el, value, preserveActive = true) {
  if (!el || (preserveActive && document.activeElement === el)) return false;
  if (window.thiaRuntimeCore?.setValue) return window.thiaRuntimeCore.setValue(el, value, preserveActive);
  const next = String(value ?? '');
  if (String(el.value ?? '') === next) return false;
  el.value = next;
  return true;
}

function normalizarNomeTerceirizadoOS(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function nomeFornecedorTerceirizadoOS(fornecedor) {
  return String(
    fornecedor?.nome || fornecedor?.razaoSocial || fornecedor?.razao ||
    fornecedor?.fantasia || fornecedor?.nomeFantasia || fornecedor?.id || ''
  ).trim();
}

const cacheFornecedoresTerceirizadoOS = {
  fonte: null,
  tamanho: -1,
  lista: []
};

function fornecedoresTerceirizadoOS() {
  const fonte = window.J?.fornecedores || [];
  if (cacheFornecedoresTerceirizadoOS.fonte === fonte && cacheFornecedoresTerceirizadoOS.tamanho === fonte.length) {
    return cacheFornecedoresTerceirizadoOS.lista;
  }
  const vistos = new Set();
  const lista = fonte
    .map(f => ({
      id: String(f?.id || '').trim(),
      nome: nomeFornecedorTerceirizadoOS(f),
      fantasia: String(f?.fantasia || f?.nomeFantasia || '').trim(),
      cnpj: String(f?.cnpj || '').trim()
    }))
    .filter(f => {
      const chave = `${f.id}|${normalizarNomeTerceirizadoOS(f.nome)}`;
      if (!f.nome || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  cacheFornecedoresTerceirizadoOS.fonte = fonte;
  cacheFornecedoresTerceirizadoOS.tamanho = fonte.length;
  cacheFornecedoresTerceirizadoOS.lista = lista;
  return lista;
}

function localizarFornecedorTerceirizadoOS(nome, idPreferido) {
  const lista = fornecedoresTerceirizadoOS();
  const id = String(idPreferido || '').trim();
  const chaveNome = normalizarNomeTerceirizadoOS(nome);
  if (chaveNome) {
    const correspondencias = lista.filter(f => normalizarNomeTerceirizadoOS(f.nome) === chaveNome);
    if (id) {
      const porNomeEId = correspondencias.find(f => f.id === id);
      if (porNomeEId) return porNomeEId;
    }
    return correspondencias[0] || null;
  }
  return id ? (lista.find(f => f.id === id) || null) : null;
}

window.atualizarListaTerceirizadosOS = function() {
  if (!document.body) return null;
  let list = document.getElementById('os-lista-terceirizados');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'os-lista-terceirizados';
    document.body.appendChild(list);
  }
  const fornecedores = fornecedoresTerceirizadoOS();
  const assinatura = fornecedores.map(f => `${f.id}:${f.nome}:${f.fantasia}:${f.cnpj}`).join('|');
  if (list.dataset.assinatura === assinatura) return list;
  list.dataset.assinatura = assinatura;
  list.innerHTML = fornecedores.map(f => {
    const complemento = [f.fantasia && f.fantasia !== f.nome ? f.fantasia : '', f.cnpj].filter(Boolean).join(' · ');
    return `<option value="${escOS(f.nome)}" data-fornecedor-id="${escOS(f.id)}"${complemento ? ` label="${escOS(complemento)}"` : ''}></option>`;
  }).join('');
  return list;
};

function linhaServicoTerceirizadoOS(elemento) {
  return elemento?.closest?.('#containerServicosOS > div, #containerPecasOS .cilia-serv-relac, .cilia-serv-relac') || null;
}

function normalizarTipoExecucaoServicoOS(value, item) {
  const raw = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (raw === 'terceirizada' || raw === 'terceirizado' || raw === 'externa' || raw === 'externo') return 'terceirizada';
  if (item?.terceirizado === true || item?.servicoTerceirizado === true || item?.terceirizadoNome || item?.prestadorNome || item?.fornecedorServicoNome) return 'terceirizada';
  return 'interna';
}

window.atualizarTerceirizadoServicoOS = function(input) {
  const row = linhaServicoTerceirizadoOS(input);
  if (!row) return;
  const nome = String(input?.value || '').trim();
  const nomeAnterior = String(row.dataset.terceirizadoNomeOriginal || row.dataset.terceirizadoNome || '').trim();
  let fornecedor = localizarFornecedorTerceirizadoOS(nome, '');
  if (!fornecedor && row.dataset.terceirizadoId && normalizarNomeTerceirizadoOS(nome) === normalizarNomeTerceirizadoOS(nomeAnterior)) {
    fornecedor = localizarFornecedorTerceirizadoOS('', row.dataset.terceirizadoId);
  }
  row.dataset.terceirizadoNome = nome;
  row.dataset.terceirizadoId = fornecedor?.id || '';
  row.dataset.terceirizadoOrigem = nome ? (fornecedor ? 'fornecedor_cadastrado' : 'digitado') : '';
  row.dataset.terceirizadoNomeOriginal = nome;
  const status = row.querySelector('.serv-terceirizado-status');
  if (status) {
    status.textContent = !nome
      ? 'Selecione um fornecedor cadastrado ou digite livremente o nome do prestador.'
      : (fornecedor
          ? `Fornecedor cadastrado selecionado: ${fornecedor.nome}.`
          : 'Prestador digitado livremente. Nenhum novo fornecedor será cadastrado automaticamente.');
    status.style.color = fornecedor ? 'var(--success)' : 'var(--muted)';
  }
};

function dadosFinanceirosTerceirizadoOrigemOS(origem) {
  const o = origem || {};
  const pedidoFornecedor = String(o.terceirizadoPedidoFornecedor ?? o.pedidoFornecedor ?? o.numeroPedidoFornecedor ?? o.pedidoTerceirizado ?? o.pedido ?? '').trim();
  const documento = String(o.terceirizadoDocumento ?? o.terceirizadoNF ?? o.nfServicoTerceirizado ?? o.documentoServicoTerceirizado ?? o.nfNumero ?? o.nf ?? o.documento ?? '').trim();
  const data = String(o.terceirizadoData ?? o.dataServicoTerceirizado ?? o.dataLancamentoTerceirizado ?? o.dataServico ?? o.dataLancamento ?? '').slice(0, 10);
  const valor = numBR(o.terceirizadoValor ?? o.custoTerceirizado ?? o.valorServicoTerceirizado ?? o.valorFornecedorTerceirizado ?? 0);
  return { pedidoFornecedor, documento, data, valor };
}

function financeiroTerceirizadoClienteComumOS() {
  try { return !clienteOficialAtualReaisOS(); } catch (_) { return true; }
}

window.alternarTipoExecucaoServicoOS = function(select) {
  const row = linhaServicoTerceirizadoOS(select);
  if (!row) return;
  const tipoExecucao = normalizarTipoExecucaoServicoOS(select?.value || 'interna');
  row.dataset.tipoExecucao = tipoExecucao;
  const campo = row.querySelector('.serv-terceirizado-campo');
  const financeiro = row.querySelector('.serv-terceirizado-financeiro');
  const input = row.querySelector('.serv-terceirizado-nome');
  const status = row.querySelector('.serv-terceirizado-status');
  const terceirizada = tipoExecucao === 'terceirizada';
  const financeiroVisivel = terceirizada && financeiroTerceirizadoClienteComumOS();
  if (campo) campo.hidden = !terceirizada;
  if (financeiro) financeiro.hidden = !financeiroVisivel;
  if (status) status.hidden = !terceirizada;
  if (input) {
    input.disabled = !terceirizada;
    if (terceirizada) {
      window.atualizarListaTerceirizadosOS?.();
      window.atualizarTerceirizadoServicoOS?.(input);
    }
  }
  row.querySelectorAll('.serv-terceirizado-financeiro input').forEach(el => { el.disabled = !financeiroVisivel; });
};

function lerTerceirizadoLinhaServicoOS(row) {
  const select = row?.querySelector?.('.serv-tipo-execucao');
  const tipoExecucao = normalizarTipoExecucaoServicoOS(select?.value || row?.dataset?.tipoExecucao || 'interna');
  if (tipoExecucao !== 'terceirizada') {
    return { tipoExecucao: 'interna', terceirizadoId: '', terceirizadoNome: '', terceirizadoOrigem: '', terceirizadoPedidoFornecedor: '', terceirizadoDocumento: '', terceirizadoData: '', terceirizadoValor: 0 };
  }
  const nome = String(row?.querySelector?.('.serv-terceirizado-nome')?.value || row?.dataset?.terceirizadoNome || '').trim();
  let fornecedor = localizarFornecedorTerceirizadoOS(nome, '');
  const nomeOriginal = String(row?.dataset?.terceirizadoNomeOriginal || row?.dataset?.terceirizadoNome || '').trim();
  if (!fornecedor && row?.dataset?.terceirizadoId && normalizarNomeTerceirizadoOS(nome) === normalizarNomeTerceirizadoOS(nomeOriginal)) {
    fornecedor = localizarFornecedorTerceirizadoOS('', row.dataset.terceirizadoId);
  }
  const pedidoFornecedor = String(row?.querySelector?.('.serv-terceirizado-pedido')?.value || row?.dataset?.terceirizadoPedidoFornecedor || '').trim();
  const documento = String(row?.querySelector?.('.serv-terceirizado-documento')?.value || row?.dataset?.terceirizadoDocumento || '').trim();
  const data = String(row?.querySelector?.('.serv-terceirizado-data')?.value || row?.dataset?.terceirizadoData || '').slice(0, 10);
  const valor = numBR(row?.querySelector?.('.serv-terceirizado-valor')?.value || row?.dataset?.terceirizadoValor || 0);
  return {
    tipoExecucao: 'terceirizada',
    terceirizadoId: nome ? (fornecedor?.id || '') : '',
    terceirizadoNome: nome,
    terceirizadoOrigem: nome ? (fornecedor ? 'fornecedor_cadastrado' : 'digitado') : '',
    terceirizadoPedidoFornecedor: pedidoFornecedor,
    terceirizadoDocumento: documento,
    terceirizadoData: data,
    terceirizadoValor: +valor.toFixed(2)
  };
}

function instalarTerceirizadoLinhaServicoOS(row, item) {
  if (!row?.querySelector?.('.serv-desc') || row.querySelector('.serv-terceirizado-wrap')) return;
  garantirEstilosOSV22();
  window.atualizarListaTerceirizadosOS?.();
  const origem = item || {};
  const tipoExecucao = normalizarTipoExecucaoServicoOS(origem.tipoExecucao || origem.execucaoTipo, origem);
  const terceirizadoId = String(origem.terceirizadoId || origem.prestadorId || origem.fornecedorServicoId || '').trim();
  const fornecedor = localizarFornecedorTerceirizadoOS('', terceirizadoId);
  const terceirizadoNome = String(
    origem.terceirizadoNome || origem.prestadorNome || origem.fornecedorServicoNome || fornecedor?.nome || ''
  ).trim();
  const financeiroTerceirizado = dadosFinanceirosTerceirizadoOrigemOS(origem);
  const exibirFinanceiroTerceirizado = tipoExecucao === 'terceirizada' && financeiroTerceirizadoClienteComumOS();
  row.dataset.tipoExecucao = tipoExecucao;
  row.dataset.terceirizadoId = terceirizadoId || fornecedor?.id || '';
  row.dataset.terceirizadoNome = terceirizadoNome;
  row.dataset.terceirizadoNomeOriginal = terceirizadoNome;
  row.dataset.terceirizadoOrigem = String(origem.terceirizadoOrigem || (terceirizadoNome ? (fornecedor ? 'fornecedor_cadastrado' : 'digitado') : '')).trim();
  row.dataset.terceirizadoPedidoFornecedor = financeiroTerceirizado.pedidoFornecedor;
  row.dataset.terceirizadoDocumento = financeiroTerceirizado.documento;
  row.dataset.terceirizadoData = financeiroTerceirizado.data;
  row.dataset.terceirizadoValor = String(financeiroTerceirizado.valor || '');
  const wrap = document.createElement('div');
  wrap.className = 'serv-terceirizado-wrap';
  wrap.innerHTML = `
    <label>EXECUÇÃO DO SERVIÇO</label>
    <select class="j-select serv-tipo-execucao" onchange="window.alternarTipoExecucaoServicoOS(this)" title="Define se este serviço é executado internamente ou por terceiro. Para cliente comum, a opção terceirizada libera fornecedor, pedido/NF, data e valor do terceiro sem alterar o valor cobrado do serviço.">
      <option value="interna" ${tipoExecucao === 'interna' ? 'selected' : ''}>INTERNA</option>
      <option value="terceirizada" ${tipoExecucao === 'terceirizada' ? 'selected' : ''}>TERCEIRIZADA</option>
    </select>
    <div class="serv-terceirizado-campo" ${tipoExecucao === 'terceirizada' ? '' : 'hidden'}>
      <label>TERCEIRIZADO / FORNECEDOR / PRESTADOR</label>
      <input type="text" class="j-input serv-terceirizado-nome" list="os-lista-terceirizados" value="${escOS(terceirizadoNome)}" placeholder="Selecione um cadastrado ou digite livremente" autocomplete="off" ${tipoExecucao === 'terceirizada' ? '' : 'disabled'} onfocus="window.atualizarListaTerceirizadosOS()" oninput="window.atualizarTerceirizadoServicoOS(this)" onchange="window.atualizarTerceirizadoServicoOS(this)">
    </div>
    <div class="serv-terceirizado-financeiro" ${exibirFinanceiroTerceirizado ? '' : 'hidden'}>
      <div class="serv-terceirizado-fin-item"><label>PEDIDO DO FORNECEDOR</label><input type="text" class="j-input serv-terceirizado-pedido" value="${escOS(financeiroTerceirizado.pedidoFornecedor)}" placeholder="Nº do pedido" ${exibirFinanceiroTerceirizado ? '' : 'disabled'}></div>
      <div class="serv-terceirizado-fin-item"><label>NF / DOCUMENTO DO SERVIÇO</label><input type="text" class="j-input serv-terceirizado-documento" value="${escOS(financeiroTerceirizado.documento)}" placeholder="NF, recibo ou documento" ${exibirFinanceiroTerceirizado ? '' : 'disabled'}></div>
      <div class="serv-terceirizado-fin-item"><label>DATA DO SERVIÇO / DOCUMENTO</label><input type="date" class="j-input serv-terceirizado-data" value="${escOS(financeiroTerceirizado.data)}" ${exibirFinanceiroTerceirizado ? '' : 'disabled'}></div>
      <div class="serv-terceirizado-fin-item"><label>VALOR DO TERCEIRO (R$)</label><input type="text" inputmode="decimal" class="j-input serv-terceirizado-valor" value="${financeiroTerceirizado.valor ? escOS(financeiroTerceirizado.valor.toFixed(2).replace('.', ',')) : ''}" placeholder="0,00" ${exibirFinanceiroTerceirizado ? '' : 'disabled'}></div>
    </div>
    <div class="serv-terceirizado-status" ${tipoExecucao === 'terceirizada' ? '' : 'hidden'}></div>
  `;
  row.appendChild(wrap);
  const input = wrap.querySelector('.serv-terceirizado-nome');
  if (tipoExecucao === 'terceirizada') window.atualizarTerceirizadoServicoOS?.(input);
}
window.instalarTerceirizadoLinhaServicoOS = instalarTerceirizadoLinhaServicoOS;

function isFirestoreSentinelOS(value) {
  if (!value || typeof value !== 'object') return false;
  const ctor = String(value.constructor?.name || '');
  // Compat Firebase v8/v9: FieldValue.delete(), serverTimestamp(), arrayUnion(), etc.
  // Esses objetos NÃO podem ser percorridos/limpos, senão o update perde o sentinel.
  return Boolean(
    value._methodName ||
    value._delegate?._methodName ||
    value._toFieldTransform ||
    /FieldValue|DeleteFieldValue|ServerTimestamp|ArrayUnion|ArrayRemove/i.test(ctor)
  );
}

function limparUndefinedFirestoreOS(value) {
  if (value === undefined) return undefined;
  if (isFirestoreSentinelOS(value)) return value;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) {
    return value
      .map(item => limparUndefinedFirestoreOS(item))
      .filter(item => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      const cleaned = limparUndefinedFirestoreOS(val);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return value;
}

function firestoreDeleteFieldOS() {
  try {
    return window.firebase?.firestore?.FieldValue?.delete?.() || firebase.firestore.FieldValue.delete();
  } catch(e) {
    console.warn('FieldValue.delete indisponível; usando null como fallback.', e);
    return null;
  }
}

function normalizarStatusFluxoOS(status) {
  return String(status || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function statusReabreEdicaoOrcamentoOS(status) {
  const s = normalizarStatusFluxoOS(status);
  // Só reabre orçamento real. Não inclui Orcamento_Enviado porque esse status ainda é envio ao cliente.
  return s === 'triagem' || s === 'orcamento' || s === 'em_orcamento' || s === 'em orcamento';
}

function osTemAprovacaoAtivaOS(os) {
  if (!os) return false;
  if (typeof OSU().hasApproval === 'function') return !!OSU().hasApproval(os);
  return Boolean(
    os.aprovacao ||
    os.totalAprovado != null ||
    (Array.isArray(os.itensAprovados) && os.itensAprovados.length > 0) ||
    (os.execucaoItens && Object.keys(os.execucaoItens || {}).length > 0)
  );
}

function montarRegistroReaberturaAprovacaoOS(osAntes, statusDestino, origem) {
  return {
    reabertoEm: new Date().toISOString(),
    reabertoPor: window.J?.nome || 'Gestor',
    reabertoPorTipo: 'jarvis',
    origem: origem || 'os',
    statusAnterior: osAntes?.status || '',
    statusDestino: statusDestino || '',
    aprovacaoAnterior: osAntes?.aprovacao || null,
    itensAprovadosAnteriores: Array.isArray(osAntes?.itensAprovados) ? osAntes.itensAprovados : [],
    totalAprovadoAnterior: osAntes?.totalAprovado ?? null,
    execucaoItensAnterior: osAntes?.execucaoItens || null
  };
}

function aplicarReaberturaAprovacaoNoPayloadOS(payload, osAntes, statusDestino, origem) {
  const historico = Array.isArray(osAntes?.aprovacaoHistorico) ? osAntes.aprovacaoHistorico.slice() : [];
  historico.push(montarRegistroReaberturaAprovacaoOS(osAntes, statusDestino, origem));
  payload.aprovacaoHistorico = historico;
  payload.aprovacao = firestoreDeleteFieldOS();
  payload.itensAprovados = firestoreDeleteFieldOS();
  payload.totalAprovado = firestoreDeleteFieldOS();
  payload.execucaoItens = firestoreDeleteFieldOS();
  payload.aprovacaoAtiva = false;
  payload.reabertoParaEdicaoEm = new Date().toISOString();
  payload.reabertoParaEdicaoPor = window.J?.nome || 'Gestor';
  return historico[historico.length - 1];
}

function usuarioPodeDispararWppProntoOS() {
  const role = String(window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  return ['admin', 'gestor', 'gerente', 'superadmin', 'dono'].includes(role);
}

function normalizarPagamentoOS(forma) {
  return String(forma || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formaPagamentoParcelaClienteOS(forma) {
  const n = normalizarPagamentoOS(forma);
  if (!n) return false;
  return n.includes('boleto') || n.includes('crediario');
}

function formaPagamentoParcelaOperadoraOS(forma) {
  const n = normalizarPagamentoOS(forma);
  if (!n) return false;
  return n.includes('parcelado') && (n.includes('credito') || n.includes('cartao') || n.includes('cr'));
}

function formaPagamentoPermiteParcelasOS(forma) {
  return formaPagamentoParcelaClienteOS(forma) || formaPagamentoParcelaOperadoraOS(forma);
}

function formaPagamentoCombinadaOS(forma) {
  const n = normalizarPagamentoOS(forma);
  return n.includes('combinado') || n.includes('misto');
}

function parcelasPagamentoOS(forma, rawParcelas) {
  if (!formaPagamentoPermiteParcelasOS(forma)) return 1;
  const n = parseInt(rawParcelas || 1, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parcelasPagamentoComponenteOS(forma, rawParcelas) {
  if (!formaPagamentoPermiteParcelasOS(forma)) return 1;
  const n = parseInt(rawParcelas || 1, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function atualizarParcelaPagamentoCombinadoRowOS(row) {
  if (!row) return;
  const forma = row.querySelector('.os-combo-forma')?.value || '';
  const wrap = row.querySelector('.os-combo-parcelas-wrap');
  const sel = row.querySelector('.os-combo-parcelas');
  const permite = formaPagamentoPermiteParcelasOS(forma);
  if (wrap) wrap.style.display = permite ? 'block' : 'none';
  if (sel && !permite) sel.value = '1';
}

function pagamentoCombinadoRowHtmlOS(dados = {}) {
  const forma = dados.forma || 'Dinheiro';
  const valor = dados.valor != null ? String(dados.valor).replace('.', ',') : '';
  const parcelas = parcelasPagamentoComponenteOS(forma, dados.parcelas || 1);
  const data = dados.data || dados.venc || document.getElementById('osPgtoData')?.value || dataLocalISOOS();
  const opts = ['Dinheiro','PIX','Débito','Crédito à Vista','Crédito Parcelado','Boleto','Crediário']
    .map(f => `<option value="${escOS(f)}"${normalizarPagamentoOS(f) === normalizarPagamentoOS(forma) ? ' selected' : ''}>${escOS(f)}</option>`).join('');
  const parcOpts = [1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}"${n === parcelas ? ' selected' : ''}>${n}x</option>`).join('');
  return `<div class="os-combo-row" style="display:grid;grid-template-columns:1.2fr 120px 110px 110px 34px;gap:8px;align-items:end;">
    <div><label class="j-label">Forma</label><select class="j-select os-combo-forma" onchange="window.atualizarParcelaPagamentoCombinadoOS(this)">${opts}</select></div>
    <div><label class="j-label">Valor</label><input class="j-input os-combo-valor" inputmode="decimal" value="${escOS(valor)}" placeholder="0,00"></div>
    <div class="os-combo-parcelas-wrap"><label class="j-label">Parcelas</label><select class="j-select os-combo-parcelas">${parcOpts}</select></div>
    <div><label class="j-label">Data</label><input type="date" class="j-input os-combo-data" value="${escOS(data)}"></div>
    <button type="button" class="btn-danger" onclick="this.closest('.os-combo-row').remove()">x</button>
  </div>`;
}

function renderPagamentosCombinadosOS(lista = []) {
  const box = document.getElementById('osPgtoCombinadoRows');
  if (!box) return;
  box.innerHTML = '';
  (Array.isArray(lista) ? lista : []).forEach(item => {
    box.insertAdjacentHTML('beforeend', pagamentoCombinadoRowHtmlOS(item));
  });
  Array.from(box.querySelectorAll('.os-combo-row')).forEach(atualizarParcelaPagamentoCombinadoRowOS);
}

window.adicionarPagamentoCombinadoOS = function(dados) {
  const box = document.getElementById('osPgtoCombinadoRows');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', pagamentoCombinadoRowHtmlOS(dados || {}));
  atualizarParcelaPagamentoCombinadoRowOS(box.lastElementChild);
};

window.atualizarParcelaPagamentoCombinadoOS = function(el) {
  atualizarParcelaPagamentoCombinadoRowOS(el?.closest?.('.os-combo-row'));
};

function coletarPagamentosCombinadosOS() {
  return Array.from(document.querySelectorAll('#osPgtoCombinadoRows .os-combo-row')).map((row, idx) => {
    const forma = row.querySelector('.os-combo-forma')?.value || '';
    const valor = numBR(row.querySelector('.os-combo-valor')?.value || 0);
    const parcelas = parcelasPagamentoComponenteOS(forma, row.querySelector('.os-combo-parcelas')?.value || 1);
    const data = row.querySelector('.os-combo-data')?.value || document.getElementById('osPgtoData')?.value || dataLocalISOOS();
    return { indice: idx + 1, forma, valor, parcelas, data };
  }).filter(p => p.forma && p.valor > 0);
}

function assinaturaPagamentoCombinadoOS(lista) {
  return JSON.stringify((Array.isArray(lista) ? lista : []).map(p => ({
    forma: normalizarPagamentoOS(p.forma || ''),
    valor: +numBR(p.valor || 0).toFixed(2),
    parcelas: parcelasPagamentoComponenteOS(p.forma || '', p.parcelas || 1),
    data: String(p.data || p.venc || '').slice(0, 10)
  })));
}

function aplicarRegraParcelasPagamentoOS() {
  const forma = document.getElementById('osPgtoForma')?.value || '';
  const div = document.getElementById('divParcelasOS');
  const sel = document.getElementById('osPgtoParcelas');
  const combinado = formaPagamentoCombinadaOS(forma);
  const comboBox = document.getElementById('osPgtoCombinadoBox');
  const permite = !combinado && formaPagamentoPermiteParcelasOS(forma);
  if (comboBox) comboBox.style.display = combinado ? 'block' : 'none';
  if (combinado && !document.querySelector('#osPgtoCombinadoRows .os-combo-row')) {
    window.adicionarPagamentoCombinadoOS?.({ forma: 'Dinheiro' });
    window.adicionarPagamentoCombinadoOS?.({ forma: 'Crédito Parcelado' });
  }
  if (div) div.style.display = permite ? 'block' : 'none';
  if (sel && !permite) sel.value = '1';
  if (sel && permite && !sel.value) sel.value = '1';
  return permite;
}

function primeiroNomeClienteOS(cliente) {
  const nome = String(cliente?.nome || '').trim();
  return nome ? nome.split(/\s+/)[0] : 'cliente';
}

function credenciaisPortalClienteOS(os, cliente, veiculo) {
  const login = String(
    cliente?.login ||
    cliente?.usuario ||
    os?.loginCliente ||
    os?.login ||
    os?.placa ||
    veiculo?.placa ||
    ''
  ).trim();
  const pin = String(
    cliente?.pin ||
    cliente?.senha ||
    cliente?.password ||
    os?.pin ||
    os?.senha ||
    ''
  ).trim();
  return { login, pin };
}

function linhasCredenciaisPortalClienteOS(os, cliente, veiculo) {
  const cred = credenciaisPortalClienteOS(os, cliente, veiculo);
  const linhas = [];
  if (cred.login) linhas.push(`Usuário: *${cred.login}*`);
  if (cred.pin) linhas.push(`PIN: *${cred.pin}*`);
  return linhas;
}

function descricaoPecaGeradaSistemaOS(value) {
  const n = String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return n === 'peca' || n === 'peca cilia' || n === 'peca sem descricao';
}

function descricaoPecaLinhaOS(row, opt, estoqueId) {
  const manual = row?.querySelector?.('.peca-desc-livre')?.value?.trim() || '';
  if (manual) return manual;
  if (!estoqueId) return '';
  const dataDesc = opt?.dataset?.desc || '';
  if (dataDesc) return String(dataDesc).trim();
  return String(opt?.text || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+[—-]\s+R\$\s*[\d.,]+.*$/i, '')
    .trim();
}

function estoqueItemOS(estoqueId) {
  if (!estoqueId) return null;
  return (window.J?.estoque || []).find(p => String(p.id) === String(estoqueId)) || null;
}

function codigoPecaEstoqueOS(p) {
  return String(p?.codigo || p?.codigoFornecedor || p?.codigoComercial || p?.oem || p?.ean || p?.ref || '').trim();
}

function fornecedorPecaEstoqueOS(p) {
  return String(p?.fornecedor || p?.fornecedorNome || p?.ultimaFornecedor || p?.nomeFornecedor || p?.forn || '').trim();
}

function nfPecaEstoqueOS(p) {
  return String(p?.nfNumero || p?.ultimaNF || p?.notaFiscal || p?.nf || p?.numeroNF || p?.pedido || '').trim();
}

function dataCompraPecaEstoqueOS(p) {
  const raw = p?.dataCompra || p?.dataNF || p?.ultimaDataNF || p?.dataUltimaEntrada || p?.dataEntrada || p?.createdAt || '';
  return String(raw || '').slice(0, 10);
}

function valorCompraPecaEstoqueOS(p) {
  return numBR(p?.valorCompra || p?.custo || p?.valorUnitario || p?.precoCusto || 0);
}

function optionPecaEstoqueOS(p, selected) {
  const qtd = numBR(p?.qtd || 0);
  const codigo = codigoPecaEstoqueOS(p);
  const desc = String(p?.desc || p?.descricao || '').trim();
  const fornecedor = fornecedorPecaEstoqueOS(p);
  const nf = nfPecaEstoqueOS(p);
  const custo = valorCompraPecaEstoqueOS(p);
  const venda = numBR(p?.venda || p?.precoVenda || 0);
  const detalhes = [
    `${qtd}un`,
    codigo || 'sem codigo',
    desc || 'sem descricao',
    fornecedor ? `Forn: ${fornecedor}` : '',
    nf ? `NF: ${nf}` : '',
    `Custo: ${moedaOS(custo)}`,
    `Venda: ${moedaOS(venda)}`
  ].filter(Boolean).join(' | ');
  return `<option value="${escOS(p.id || '')}" data-codigo="${escOS(codigo)}" data-desc="${escOS(desc)}" data-custo="${custo}" data-venda="${venda}" data-fornecedor="${escOS(fornecedor)}" data-nf="${escOS(nf)}" data-data-compra="${escOS(dataCompraPecaEstoqueOS(p))}" data-ean="${escOS(p?.ean || '')}" data-ncm="${escOS(p?.ncm || '')}" data-cfop="${escOS(p?.cfop || '')}" ${selected ? 'selected' : ''}>${escOS(detalhes)}</option>`;
}


// Busca assistida de peças cadastradas dentro da O.S.
// Importante: esta camada NÃO altera o formato salvo da O.S., NÃO salva nada sozinha,
// NÃO baixa estoque e NÃO muda financeiro. Ela apenas filtra visualmente a lista já existente.
function normalizarBuscaPecaOS(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textoBuscaPecaEstoqueOS(p) {
  return normalizarBuscaPecaOS([
    p?.codigo,
    p?.codigoFornecedor,
    p?.codigoComercial,
    p?.oem,
    p?.ean,
    p?.ref,
    p?.desc,
    p?.descricao,
    p?.marca,
    p?.fornecedor,
    p?.fornecedorNome,
    p?.nomeFornecedor,
    p?.nfNumero,
    p?.notaFiscal,
    p?.nf,
    p?.numeroNF,
    p?.pedido
  ].filter(Boolean).join(' '));
}

function pecasEstoqueFiltradasOS(termo, selecionado, incluirSemSaldo) {
  const busca = normalizarBuscaPecaOS(termo);
  const termos = busca ? busca.split(/\s+/).filter(Boolean) : [];
  return (window.J?.estoque || []).filter(p => {
    const id = String(p?.id || '');
    const qtd = numBR(p?.qtd || 0);
    const manterSelecionada = selecionado && id === String(selecionado);
    if (!incluirSemSaldo && qtd <= 0 && !manterSelecionada) return false;
    if (!termos.length) return true;
    const alvo = textoBuscaPecaEstoqueOS(p);
    return termos.every(t => alvo.includes(t));
  }).slice(0, 80);
}

function optionsPecasEstoqueFiltradasOS(selecionado, termo, incluirSemSaldo) {
  const lista = pecasEstoqueFiltradasOS(termo, selecionado, incluirSemSaldo);
  const temSelecionado = selecionado && lista.some(p => String(p?.id || '') === String(selecionado));
  const itemSelecionado = selecionado && !temSelecionado ? estoqueItemOS(selecionado) : null;
  const itens = itemSelecionado ? [itemSelecionado].concat(lista) : lista;
  return '<option value="">Selecionar peca...</option>'
    + itens.map(p => optionPecaEstoqueOS(p, String(p?.id || '') === String(selecionado))).join('')
    + '<option value="__avulsa__" data-venda="0" data-desc="">+ Peca nao cadastrada (digitar manualmente)</option>';
}

window.filtrarPecasOS = function(input) {
  const row = input?.closest?.('div');
  if (!row) return;
  const sel = row.querySelector('.peca-sel');
  if (!sel) return;
  const atual = sel.value || '';
  sel.innerHTML = optionsPecasEstoqueFiltradasOS(atual, input.value || '', false);
  if (atual && Array.from(sel.options).some(o => String(o.value) === String(atual))) sel.value = atual;
  const info = row.querySelector('.peca-estoque-info');
  if (info && normalizarBuscaPecaOS(input.value)) {
    const qtd = Math.max(0, sel.options.length - 2);
    info.innerHTML = `<b>Busca:</b> ${escOS(input.value)} &nbsp; | &nbsp; <b>Resultados:</b> ${qtd}`;
  } else {
    atualizarPecaOSInfoRow(row);
  }
};

window.selecionarPrimeiraPecaFiltradaOS = function(input, ev) {
  if (ev && ev.key !== 'Enter') return;
  ev?.preventDefault?.();
  const row = input?.closest?.('div');
  const sel = row?.querySelector?.('.peca-sel');
  if (!row || !sel) return;
  const primeira = Array.from(sel.options).find(o => o.value && o.value !== '__avulsa__');
  if (!primeira) return;
  sel.value = primeira.value;
  window.selecionarPecaOS?.(sel);
};

function optionsPecasReaisEstoqueFiltradasOS(selecionado, termo) {
  const lista = pecasEstoqueFiltradasOS(termo, selecionado, true);
  const temSelecionado = selecionado && lista.some(p => String(p?.id || '') === String(selecionado));
  const itemSelecionado = selecionado && !temSelecionado ? estoqueItemOS(selecionado) : null;
  const itens = itemSelecionado ? [itemSelecionado].concat(lista) : lista;
  return '<option value="">Nao baixar estoque</option>' + itens.map(e => {
    const codigo = codigoPecaEstoqueOS(e);
    const desc = String(e?.desc || e?.descricao || '').trim();
    const custo = valorCompraPecaEstoqueOS(e);
    const fornecedor = fornecedorPecaEstoqueOS(e);
    const nf = nfPecaEstoqueOS(e);
    const label = [codigo, desc, fornecedor ? `Forn: ${fornecedor}` : '', nf ? `NF: ${nf}` : '', `Saldo: ${numBR(e?.qtd || 0)}`].filter(Boolean).join(' | ');
    const dataCompra = dataCompraPecaEstoqueOS(e);
    return `<option value="${escOS(e?.id || '')}" data-codigo="${escOS(codigo)}" data-desc="${escOS(desc)}" data-custo="${custo}" data-fornecedor="${escOS(fornecedor)}" data-nf="${escOS(nf)}" data-data-compra="${escOS(dataCompra)}" ${String(e?.id || '') === String(selecionado) ? 'selected' : ''}>${escOS(label || 'Peca sem descricao')}</option>`;
  }).join('');
}

window.filtrarPecaRealEstoqueOS = function(input) {
  const row = input?.closest?.('div');
  if (!row) return;
  const sel = row.querySelector('.pr-estoque');
  if (!sel) return;
  const atual = sel.value || '';
  sel.innerHTML = optionsPecasReaisEstoqueFiltradasOS(atual, input.value || '');
  if (atual && Array.from(sel.options).some(o => String(o.value) === String(atual))) sel.value = atual;
};

window.selecionarPrimeiraPecaRealFiltradaOS = function(input, ev) {
  if (ev && ev.key !== 'Enter') return;
  ev?.preventDefault?.();
  const row = input?.closest?.('div');
  const sel = row?.querySelector?.('.pr-estoque');
  if (!row || !sel) return;
  const primeira = Array.from(sel.options).find(o => o.value);
  if (!primeira) return;
  sel.value = primeira.value;
  window.selecionarPecaRealEstoque?.(sel);
};

function aplicarPecaEstoqueSelecionadaOS(row, item, marcarBaixa) {
  if (!row) return;
  const info = row.querySelector('.peca-estoque-info');
  if (!item) {
    row.dataset.pecaCodigo = '';
    row.dataset.pecaFornecedor = '';
    row.dataset.pecaNf = '';
    row.dataset.pecaDataCompra = '';
    if (info) info.innerHTML = '';
    return;
  }
  const codigo = codigoPecaEstoqueOS(item);
  const desc = String(item.desc || item.descricao || '').trim();
  const fornecedor = fornecedorPecaEstoqueOS(item);
  const nf = nfPecaEstoqueOS(item);
  const dataCompra = dataCompraPecaEstoqueOS(item);
  const custo = valorCompraPecaEstoqueOS(item);
  const venda = numBR(item.venda || item.precoVenda || 0);
  row.dataset.pecaCodigo = codigo;
  row.dataset.pecaFornecedor = fornecedor;
  row.dataset.pecaNf = nf;
  row.dataset.pecaDataCompra = dataCompra;
  const codigoInput = row.querySelector('.peca-codigo');
  const descInput = row.querySelector('.peca-desc-livre');
  const custoInput = row.querySelector('.peca-custo');
  const vendaInput = row.querySelector('.peca-venda');
  if (codigoInput && (marcarBaixa || !String(codigoInput.value || '').trim())) codigoInput.value = codigo;
  if (descInput && (marcarBaixa || !String(descInput.value || '').trim())) descInput.value = desc;
  if (custoInput && (marcarBaixa || !String(custoInput.value || '').trim() || numBR(custoInput.value) <= 0)) custoInput.value = custo.toFixed(2).replace('.', ',');
  if (vendaInput && (marcarBaixa || !String(vendaInput.value || '').trim() || numBR(vendaInput.value) <= 0)) vendaInput.value = venda.toFixed(2).replace('.', ',');
  const baixa = row.querySelector('.peca-baixa-real');
  if (baixa && marcarBaixa) baixa.checked = true;
  if (info) {
    info.innerHTML = [
      codigo ? `<b>Codigo:</b> ${escOS(codigo)}` : '<b>Codigo:</b> sem codigo',
      desc ? `<b>Descricao:</b> ${escOS(desc)}` : '',
      fornecedor ? `<b>Fornecedor:</b> ${escOS(fornecedor)}` : '',
      nf ? `<b>NF/Pedido:</b> ${escOS(nf)}` : '',
      dataCompra ? `<b>Data compra:</b> ${escOS(dataCompra)}` : '',
      `<b>Custo:</b> ${moedaOS(custo)}`,
      `<b>Venda:</b> ${moedaOS(venda)}`,
      `<b>Saldo:</b> ${numBR(item.qtd || 0)}`
    ].filter(Boolean).join(' &nbsp; | &nbsp; ');
  }
}

function atualizarPecaOSInfoRow(row) {
  const sel = row?.querySelector?.('.peca-sel');
  if (!sel || !sel.value) return aplicarPecaEstoqueSelecionadaOS(row, null, false);
  aplicarPecaEstoqueSelecionadaOS(row, estoqueItemOS(sel.value), false);
}
window.atualizarPecaOSInfoRow = atualizarPecaOSInfoRow;

function pecaOSBaixaRealAtiva(row) {
  const sel = row?.querySelector?.('.peca-sel');
  if (!sel || !sel.value || sel.value === '__avulsa__') return false;
  return !!row.querySelector('.peca-baixa-real')?.checked;
}

function pecaRealFromEstoqueOS(row, idx) {
  if (!pecaOSBaixaRealAtiva(row)) return null;
  const sel = row.querySelector('.peca-sel');
  const item = estoqueItemOS(sel.value);
  if (!item) return null;
  const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
  const valorCompra = numBR(row.querySelector('.peca-custo')?.value || valorCompraPecaEstoqueOS(item));
  const codigo = row.dataset.pecaCodigo || codigoPecaEstoqueOS(item);
  const desc = descricaoPecaLinhaOS(row, sel.options?.[sel.selectedIndex], sel.value) || item.desc || item.descricao || '';
  return {
    origem: 'os_estoque',
    origemAutoOS: true,
    origemAutoKey: `os-estoque-${idx}`,
    estoqueId: sel.value,
    codigo,
    desc,
    descricao: desc,
    qtd,
    fornecedor: row.dataset.pecaFornecedor || fornecedorPecaEstoqueOS(item),
    nf: row.dataset.pecaNf || nfPecaEstoqueOS(item),
    nfNumero: row.dataset.pecaNf || nfPecaEstoqueOS(item),
    dataCompra: row.dataset.pecaDataCompra || dataCompraPecaEstoqueOS(item),
    valorCompra,
    custo: valorCompra,
    venda: numBR(row.querySelector('.peca-venda')?.value || item.venda || 0)
  };
}

function pecasReaisAutomaticasOS() {
  const out = [];
  document.querySelectorAll('#containerPecasOS > div:not(.cilia-peca-wrap)').forEach((row, idx) => {
    if (row.dataset?.pecaAvulsa === '1') return;
    const pr = pecaRealFromEstoqueOS(row, idx);
    if (pr) out.push(pr);
  });
  return out;
}

function montarMensagemStatusClienteOS(os, status, cliente, veiculo) {
  os = os || {};
  cliente = cliente || {};
  veiculo = veiculo || {};
  const idCurto = os.id ? String(os.id).slice(-6).toUpperCase() : '';
  const placa = os.placa || veiculo.placa || 'seu veiculo';
  const modelo = veiculo.modelo || os.veiculoSnapshot?.modelo || os.veiculoModelo || os.veiculo || '';
  const veiculoTxt = [placa, modelo].filter(Boolean).join(' - ');
  const oficina = window.J?.tnome || 'oficina';
  const portal = montarLinkPortalClienteOS(os, cliente, veiculo);
  const credenciaisPortal = linhasCredenciaisPortalClienteOS(os, cliente, veiculo);
  if (status === 'Orcamento_Enviado' || status === 'Orçamento enviado' || status === 'Orcamento enviado') {
    const total = Number(os.total || os.totalAprovado || 0);
    return [
      `Olá ${primeiroNomeClienteOS(cliente)}.`,
      '',
      `O orçamento do veículo ${veiculoTxt} referente à O.S. ${idCurto ? '#' + idCurto : ''} está disponível pela ${oficina}.`,
      total ? `Total do orçamento: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : '',
      `Acesse o portal para conferir e responder: ${portal}`,
      ...credenciaisPortal,
      '',
      'Se tiver qualquer dúvida, responda por aqui ou pelo portal.'
    ].filter(Boolean).join('\n');
  }
  if (status === 'Entregue') {
    const retirado = String(os.entreguePara || '').trim();
    return [
      `Olá ${primeiroNomeClienteOS(cliente)}.`,
      '',
      `Confirmamos a entrega do veículo ${veiculoTxt} referente à O.S. ${idCurto ? '#' + idCurto : ''} na ${oficina}.`,
      retirado ? `Retirado por: ${retirado}.` : '',
      `Você pode consultar o histórico autorizado pelo portal: ${portal}`,
      ...credenciaisPortal,
      '',
      'Obrigado pela confiança.'
    ].filter(Boolean).join('\n');
  }
  return [
    `Olá ${primeiroNomeClienteOS(cliente)}.`,
    '',
    `Seu veículo ${veiculoTxt} está pronto para retirada na ${oficina}.`,
    idCurto ? `A O.S. #${idCurto} foi encaminhada para conferência/caixa.` : '',
    `Você pode acompanhar pelo portal: ${portal}`,
    ...credenciaisPortal,
    '',
    'Quando chegar, procure o atendimento.'
  ].filter(Boolean).join('\n');
}

window.scrollOSModal = function(destino = 'top') {
  const pane = document.querySelector('#modalOS .tab-pane.active') || document.getElementById('tabOS1');
  if (!pane) return;
  const top = destino === 'bottom' ? pane.scrollHeight : 0;
  pane.scrollTo({ top, behavior: 'smooth' });
};

function classificarSecaoResumoOS(input) {
  const normalizar = OSU().normalizeText || (v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  const descTexto = normalizar([
    input?.operacao,
    input?.item,
    input?.desc,
    input?.descricao
  ].filter(Boolean).join(' '));
  const metaTexto = normalizar([
    input?.secaoHoraLabel,
    input?.sistemaTabela,
    input?.sistema
  ].filter(Boolean).join(' '));
  const texto = [descTexto, metaTexto].filter(Boolean).join(' ');
  const labelBase = String(input?.secaoHoraLabel || input?.sistemaTabela || input?.sistema || '').trim();
  const mecanicaForte = /\b(amortecedor(?:es)?|mola(?:s)?|suspensao|semi[\s-]*eixo|semieixo|homocinetica|coifa|bieleta|bandeja|pivo|terminal|barra axial|freio|pastilha|disco de freio|tambor|cambio|embreagem|motor|junta|radiador|arrefecimento|direcao|retifica|rolamento|cubo|correia|polia|bomba d[ae] agua)\b/;

  // Prioriza a descrição real digitada/selecionada. Metadados amplos como
  // "MECÂNICA ELÉTRICA GERAL" só entram como fallback.
  if (/\b(funilaria|lanternagem|pintura|pintar|lataria|parachoque|para choque)\b/.test(descTexto)) return 'FUNILARIA / PINTURA';
  if (/\b(tapecaria|capotaria|banco|assento|encosto|forro|estof)\b/.test(descTexto)) return 'TAPECARIA / CAPOTARIA';
  if (/\b(borracharia|pneu|pneus|roda|rodas|calota|balanceamento)\b/.test(descTexto)) return 'BORRACHARIA';
  if (/\b(lavagem|higienizacao|higienizar|limpeza interna|polimento)\b/.test(descTexto)) return 'LAVAGEM / HIGIENIZACAO';
  if (mecanicaForte.test(descTexto)) return 'MECANICA';
  if (/\b(injecao|bico|bicos|injetor(?:es)?|combustivel|alimentacao|tanque)\b/.test(descTexto)) return 'INJECAO / ALIMENTACAO';
  if (/\b(eletrica|eletrico|eletronica|alternador|bateria|lampada|farol|sensor|chicote|fusivel|modulo)\b/.test(descTexto)) return 'ELETRICA';

  if (/\b(funilaria|lanternagem|pintura|pintar|lataria|parachoque|para choque)\b/.test(texto)) return 'FUNILARIA / PINTURA';
  if (/\b(tapecaria|capotaria|banco|assento|encosto|forro|estof)\b/.test(texto)) return 'TAPECARIA / CAPOTARIA';
  if (/\b(borracharia|pneu|pneus|roda|rodas|calota|balanceamento)\b/.test(texto)) return 'BORRACHARIA';
  if (/\b(lavagem|higienizacao|higienizar|limpeza interna|polimento)\b/.test(texto)) return 'LAVAGEM / HIGIENIZACAO';
  if (mecanicaForte.test(texto)) return 'MECANICA';
  if (/\b(injecao|bico|bicos|injetor(?:es)?|combustivel|alimentacao|tanque)\b/.test(texto)) return 'INJECAO / ALIMENTACAO';
  if (/\b(eletrica|eletrico|eletronica|alternador|bateria|lampada|farol|sensor|chicote|fusivel|modulo)\b/.test(texto)) return 'ELETRICA';
  if (/\b(mecanica|motor|cambio|transmissao|arrefecimento|suspensao|freio|direcao|retifica)\b/.test(texto)) return 'MECANICA';
  return labelBase ? labelBase.toUpperCase().slice(0, 54) : 'OUTROS SERVICOS';
}

function extrairTipoVeiculoTempaOS(input, veiculoAtual = {}) {
  const base = String(
    input?.tipoVeiculoTabela || input?.tipoVeiculoTempa || input?.tipoVeiculo || input?.tipo ||
    input?.sistemaTabela || input?.sistema || input?.secaoHoraLabel || ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const direto = String(input?.tipoVeiculoTabela || input?.tipoVeiculoTempa || '').trim();
  if (direto) return direto;
  if (/CAMINHAO|CAMINHÕES|CAMINHOES/.test(base)) return 'CAMINHÃO';
  if (/SUV/.test(base)) return 'SUV';
  if (/COMPACTO/.test(base)) return 'VEÍCULO COMPACTO';
  if (/PEQUENOS? E MEDIOS?|MEDIO/.test(base)) return 'VEÍCULOS PEQUENOS E MÉDIOS';
  if (/UTILITARIO|UTILITÁRIA|VAN/.test(base)) return 'UTILITÁRIO / VAN';
  if (/MOTOCICLETA|MOTO/.test(base)) return 'MOTO';
  if (/DIESEL/.test(base)) return 'DIESEL';
  if (/CICLO OTTO|OTTO/.test(base)) return 'CICLO OTTO';
  const tipoAtual = String(veiculoAtual?.tipo || veiculoAtual?.categoria || '').trim();
  return tipoAtual ? tipoAtual.toUpperCase() : '';
}

function metaServicoResumoOS(input, veiculoAtual = {}) {
  const codigoInterno = String(input?.codigoInterno || input?.codInterno || input?.codigoServicoInterno || '').trim();
  const codigoTabela = String(input?.codigoTabela || input?.codigoTempa || input?.codigoSiafisico || '').trim();
  const codigoLegado = String(input?.codigo || '').trim();
  const codigo = codigoInterno || codigoTabela || codigoLegado;
  const sistema = String(input?.sistemaTabela || input?.sistema || input?.secaoHoraLabel || '').trim();
  const tipoVeiculo = extrairTipoVeiculoTempaOS(input, veiculoAtual);
  return { codigo, codigoInterno, codigoTabela, sistema, tipoVeiculo };
}

function addMetaResumoServicoOS(bucket, meta) {
  if (!bucket || !meta) return;
  if (!bucket.codigos) bucket.codigos = new Set();
  if (!bucket.sistemas) bucket.sistemas = new Set();
  if (!bucket.tiposVeiculo) bucket.tiposVeiculo = new Set();
  if (meta.codigo) bucket.codigos.add(meta.codigo);
  if (meta.sistema) bucket.sistemas.add(meta.sistema);
  if (meta.tipoVeiculo) bucket.tiposVeiculo.add(meta.tipoVeiculo);
}

function listaResumoOS(values, limite = 5) {
  const arr = Array.from(values || []).filter(Boolean);
  if (!arr.length) return '';
  return arr.slice(0, limite).join(', ') + (arr.length > limite ? ` +${arr.length - limite}` : '');
}


function roleDonoOficinaOS() {
  const role = String(window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  return ['admin', 'gestor', 'gerente', 'superadmin', 'dono', 'proprietario', 'owner'].includes(role);
}

function clienteGovernamentalAtualOS() {
  const cliId = document.getElementById('osCliente')?.value || '';
  const cli = (window.J?.clientes || []).find(c => c.id === cliId);
  return cli?.tipoCliente === 'governo';
}

function clienteOficialAtualReaisOS() {
  const cliId = document.getElementById('osCliente')?.value || '';
  const cli = (window.J?.clientes || []).find(c => String(c.id) === String(cliId)) || {};
  const tipo = String(cli.tipoCliente || cli.tipo || '').toLowerCase();
  if (tipo === 'governo' || tipo === 'oficial' || cli.clienteOficial === true) return true;
  const texto = [cli.nome, cli.razaoSocial, cli.nomeFantasia, cli.categoria, cli.segmento].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  return /OFICIAL|GOVERNO|PMSP|POLICIA|MILITAR|BPM|PREFEITURA|ESTADO|MUNICIP|SECRETARIA|ORGAO PUBLICO/.test(texto);
}
window.clienteOficialAtualReaisOS = clienteOficialAtualReaisOS;

window.atualizarVisibilidadeReaisOS = function() {
  const desbloqueado = window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
  const oficial = clienteOficialAtualReaisOS();
  const bloco = document.getElementById('blocoReais');
  const blocoServ = document.getElementById('blocoServicosReais');
  const btnServ = document.getElementById('btnAdicionarServicoReal');
  if (bloco) bloco.style.display = desbloqueado ? 'block' : 'none';
  if (blocoServ) blocoServ.style.display = desbloqueado && oficial ? 'block' : 'none';
  if (btnServ) btnServ.style.display = desbloqueado && oficial ? '' : 'none';
};

window.atualizarVisibilidadeDescontosOS = function() {
  const bloco = document.getElementById('blocoDescontoOS');
  const oficial = clienteGovernamentalAtualOS();
  if (bloco) {
    const podeVer = roleDonoOficinaOS() || oficial;
    bloco.style.display = podeVer ? 'block' : 'none';
  }
  // Ao trocar para cliente oficial, elimina apenas os controles individuais em R$.
  // Os percentuais gerais da O.S. permanecem no bloco oficial e são a única regra de desconto.
  if (oficial) {
    document.querySelectorAll('#containerServicosOS .desconto-individual-os-wrap, #containerPecasOS .desconto-individual-os-wrap').forEach(el => el.remove());
    document.querySelectorAll('#containerServicosOS > div, #containerPecasOS [data-cilia-piece-index], #containerPecasOS > div').forEach(row => {
      if (row?.dataset) {
        row.dataset.descontoIndividualValor = '';
        row.dataset.valorCobradoManual = '';
      }
    });
  }
  window.atualizarVisibilidadeReaisOS?.();
};


function _osCampoValor(id) {
  return document.getElementById(id)?.value ?? '';
}
function _osSetCampo(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value == null ? '' : String(value);
}
function _osCampoVazio(id) {
  return String(_osCampoValor(id) || '').trim() === '';
}
function _osPctParaCampo(value) {
  if (value === undefined || value === null || value === '') return '';
  const taxa = taxaDescontoOS(value);
  return (taxa * 100).toFixed(1).replace('.', ',');
}
function _osNumeroParaCampo(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = numBR(value);
  return n ? n.toFixed(2).replace('.', ',') : '0';
}
function _osPickPrimeiro() {
  for (const value of arguments) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return '';
}
window.preencherDadosOficiaisOSPadrao = function(cli, opts = {}) {
  const force = !!opts.force;
  cli = cli || null;
  if (!cli || cli.tipoCliente !== 'governo') {
    if (force) {
      ['osModeloOS','osCabecalhoOS','osValorHoraOS','osDescMO','osDescPeca'].forEach(id => _osSetCampo(id, ''));
    }
    return;
  }
  if (force || _osCampoVazio('osModeloOS')) _osSetCampo('osModeloOS', _osPickPrimeiro(cli.govOesModelo, cli.oesModelo, ''));
  if (force || _osCampoVazio('osCabecalhoOS')) _osSetCampo('osCabecalhoOS', _osPickPrimeiro(cli.govCabecalho, cli.cabecalhoInstitucional, ''));
  if (force || _osCampoVazio('osValorHoraOS')) _osSetCampo('osValorHoraOS', _osNumeroParaCampo(_osPickPrimeiro(cli.govValorHora, cli.valorHora, 0)));
  if (force || _osCampoVazio('osDescMO')) _osSetCampo('osDescMO', _osPctParaCampo(_osPickPrimeiro(cli.govDescMO, cli.descMO, 0)));
  if (force || _osCampoVazio('osDescPeca')) _osSetCampo('osDescPeca', _osPctParaCampo(_osPickPrimeiro(cli.govDescPeca, cli.descPeca, 0)));
};
window.aplicarDadosOficiaisDaOS = function(os, cli) {
  os = os || {};
  cli = cli || {};
  const modelo = _osPickPrimeiro(os.modeloOS, os.oesModelo, os.govOesModelo, cli.govOesModelo, cli.oesModelo, '');
  const cabecalho = _osPickPrimeiro(os.cabecalhoOS, os.govCabecalhoOS, os.govCabecalho, cli.govCabecalho, cli.cabecalhoInstitucional, '');
  const valorHora = _osPickPrimeiro(os.valorHoraOS, os.govValorHoraOS, os.valorHora, cli.govValorHora, cli.valorHora, 0);
  const descMO = _osPickPrimeiro(os.descMO, os.govDescMOOS, cli.govDescMO, cli.descMO, 0);
  const descPeca = _osPickPrimeiro(os.descPeca, os.govDescPecaOS, cli.govDescPeca, cli.descPeca, 0);
  _osSetCampo('osModeloOS', modelo);
  _osSetCampo('osCabecalhoOS', cabecalho);
  _osSetCampo('osValorHoraOS', _osNumeroParaCampo(valorHora));
  _osSetCampo('osDescMO', _osPctParaCampo(descMO));
  _osSetCampo('osDescPeca', _osPctParaCampo(descPeca));
};

function moedaOS(v) {
  return 'R$ ' + numBR(v).toFixed(2).replace('.', ',');
}

function pctOS(v) {
  return (taxaDescontoOS(v) * 100).toFixed(1).replace('.', ',') + '%';
}

function garantirResumoDescontoOS() {
  const bloco = document.getElementById('blocoDescontoOS');
  if (!bloco) return null;
  let el = document.getElementById('osResumoDescontosLive');
  if (!el) {
    el = document.createElement('div');
    el.id = 'osResumoDescontosLive';
    el.style.cssText = 'margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:10px;font-family:var(--fm);';
    bloco.appendChild(el);
  }
  return el;
}

function atualizarResumoDescontosOS(dados) {
  window.atualizarVisibilidadeDescontosOS?.();
  const el = garantirResumoDescontoOS();
  if (!el) return;
  const brutoServicos = numBR(dados?.brutoServicos || 0);
  const liquidoServicos = numBR(dados?.liquidoServicos || 0);
  const brutoPecas = numBR(dados?.brutoPecas || 0);
  const liquidoPecas = numBR(dados?.liquidoPecas || 0);
  const descontoServicos = Math.max(0, brutoServicos - liquidoServicos);
  const descontoPecas = Math.max(0, brutoPecas - liquidoPecas);
  const card = (titulo, pct, bruto, desc, liquido) => `
    <div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.22);border-radius:6px;padding:10px;line-height:1.35;">
      <div style="font-size:.66rem;color:#A78BFA;font-weight:800;letter-spacing:.8px;text-transform:uppercase;">${escOS(titulo)}${pct ? ` · ${escOS(pct)}` : ``}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:.68rem;"><span>Bruto</span><b>${moedaOS(bruto)}</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--warn);font-size:.68rem;"><span>Desconto</span><b>- ${moedaOS(desc)}</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--success);font-size:.72rem;"><span>Líquido</span><b>${moedaOS(liquido)}</b></div>
    </div>`;
  el.innerHTML =
    card('Mão de obra', pctOS(dados?.descMO || 0), brutoServicos, descontoServicos, liquidoServicos) +
    card('Peças', pctOS(dados?.descPeca || 0), brutoPecas, descontoPecas, liquidoPecas) +
    card('Desconto total', '', brutoServicos + brutoPecas, descontoServicos + descontoPecas, liquidoServicos + liquidoPecas);
}
window.atualizarResumoDescontosOS = atualizarResumoDescontosOS;

function garantirResumoDescontoTopoOS() {
  const totalsGrid = document.querySelector('.os-totals-inline') || document.getElementById('osTotalValMirror')?.closest('.os-totals-grid');
  if (!totalsGrid) return null;
  let el = document.getElementById('osResumoDescontosTopoLive');
  if (!el) {
    el = document.createElement('div');
    el.id = 'osResumoDescontosTopoLive';
    el.style.cssText = 'margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:8px;font-family:var(--fm);grid-column:1/-1;';
    totalsGrid.insertAdjacentElement('afterend', el);
  }
  return el;
}

function renderResumoDescontoCardsOS(el, dados) {
  if (!el) return;
  const brutoServicos = numBR(dados?.brutoServicos || 0);
  const liquidoServicos = numBR(dados?.liquidoServicos || 0);
  const brutoPecas = numBR(dados?.brutoPecas || 0);
  const liquidoPecas = numBR(dados?.liquidoPecas || 0);
  const descontoServicos = Math.max(0, brutoServicos - liquidoServicos);
  const descontoPecas = Math.max(0, brutoPecas - liquidoPecas);
  const card = (titulo, pct, bruto, desc, liquido) => `
    <div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.22);border-radius:6px;padding:9px;line-height:1.35;min-width:0;">
      <div style="font-size:.62rem;color:#A78BFA;font-weight:900;letter-spacing:.8px;text-transform:uppercase;margin-bottom:2px;">${escOS(titulo)}${pct ? ` · ${escOS(pct)}` : ``}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:.66rem;"><span>Bruto</span><b>${moedaOS(bruto)}</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--warn);font-size:.66rem;"><span>Desconto</span><b>- ${moedaOS(desc)}</b></div>
      <div style="display:flex;justify-content:space-between;gap:8px;color:var(--success);font-size:.70rem;"><span>Líquido</span><b>${moedaOS(liquido)}</b></div>
    </div>`;
  el.innerHTML =
    card('Mão de obra / serviços', pctOS(dados?.descMO || 0), brutoServicos, descontoServicos, liquidoServicos) +
    card('Peças', pctOS(dados?.descPeca || 0), brutoPecas, descontoPecas, liquidoPecas) +
    card('Total com desconto', '', brutoServicos + brutoPecas, descontoServicos + descontoPecas, liquidoServicos + liquidoPecas);
}

function atualizarResumoDescontosCompletoOS(dados) {
  atualizarResumoDescontosOS(dados);
  renderResumoDescontoCardsOS(garantirResumoDescontoTopoOS(), dados);
}
window.atualizarResumoDescontosCompletoOS = atualizarResumoDescontosCompletoOS;

function garantirBoxDescontoLinhaOS(row, tipo) {
  if (!row) return null;
  let box = row.querySelector(`.${tipo}-desc-box`);
  if (!box) {
    box = document.createElement('div');
    box.className = `${tipo}-desc-box`;
    box.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px 12px;align-items:center;max-width:100%;min-width:0;font-family:var(--fm);font-size:.66rem;color:var(--muted);border-top:1px dashed rgba(255,255,255,.10);padding-top:5px;margin-top:2px;';
    box.innerHTML = `
      <span class="${tipo}-bruto-val">Bruto: R$ 0,00</span>
      <span class="${tipo}-desc-pct" style="color:var(--warn);">Desconto: R$ 0,00</span>
      <span class="${tipo}-desc-econ" style="display:none;"></span>
      <strong class="${tipo}-desc-val" style="color:var(--success);">Líquido: R$ 0,00</strong>`;
    row.appendChild(box);
  }
  return box;
}

function atualizarBoxDescontoLinhaOS(row, tipo, bruto, liquido, taxa) {
  const box = garantirBoxDescontoLinhaOS(row, tipo);
  if (!box) return;
  const desconto = Math.max(0, numBR(bruto) - numBR(liquido));
  const brutoEl = box.querySelector(`.${tipo}-bruto-val`);
  const pctEl = box.querySelector(`.${tipo}-desc-pct`);
  const econEl = box.querySelector(`.${tipo}-desc-econ`);
  const liqEl = box.querySelector(`.${tipo}-desc-val`);
  if (brutoEl) setTextOS(brutoEl, `Bruto: ${moedaOS(bruto)}`);
  if (pctEl) setTextOS(pctEl, clienteGovernamentalAtualOS() ? `Desconto: ${pctOS(taxa || 0)}` : `Desconto: ${moedaOS(desconto)}`);
  if (econEl) setTextOS(econEl, `Desc.: ${moedaOS(desconto)}`);
  if (liqEl) setTextOS(liqEl, `Líquido: ${moedaOS(liquido)}`);
}

function atualizarMetaServicoLinhaOS(row) {
  if (!row) return;
  const veiculoAtual = window._osVeiculoAtual?.() || {};
  const meta = metaServicoResumoOS({
    codigoInterno: row.dataset?.codigoInterno,
    codigoTabela: row.dataset?.codigoTabela,
    sistemaTabela: row.dataset?.sistemaTabela || row.dataset?.secaoHoraLabel,
    secaoHoraLabel: row.dataset?.secaoHoraLabel,
    tipoVeiculoTabela: row.dataset?.tipoVeiculoTabela
  }, veiculoAtual);
  if (meta.tipoVeiculo && !row.dataset.tipoVeiculoTabela) row.dataset.tipoVeiculoTabela = meta.tipoVeiculo;
  const temMeta = meta.codigo || meta.sistema || meta.tipoVeiculo;
  let el = row.querySelector('.serv-tempa-info-os');
  if (!temMeta) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'serv-tempa-info-os';
    el.style.cssText = 'grid-column:1/-1;font-family:var(--fm);font-size:0.60rem;letter-spacing:.35px;color:var(--muted);background:rgba(0,212,255,.045);border:1px solid rgba(0,212,255,.14);border-radius:4px;padding:5px 7px;line-height:1.35;';
    row.appendChild(el);
  }
  const codigos = [];
  if (meta.codigoInterno) codigos.push(`<b style="color:var(--cyan);">COD. INTERNO: ${escOS(meta.codigoInterno)}</b>`);
  if (meta.codigoTabela) codigos.push(`<b style="color:var(--warn);">COD. SIAFISICO: ${escOS(meta.codigoTabela)}</b>`);
  if (!codigos.length && meta.codigo) codigos.push(`<b style="color:var(--cyan);">COD. ${escOS(meta.codigo)}</b>`);
  el.innerHTML = `${codigos.join(' &middot; ')}${meta.sistema ? ` &middot; Sistema: ${escOS(meta.sistema)}` : ''}${meta.tipoVeiculo ? ` &middot; Tipo veiculo: ${escOS(meta.tipoVeiculo)}` : ''}`;
}

async function auditGeralOS(osId, acao, extra = {}) {
  try {
    const idCurto = osId ? String(osId).slice(-6).toUpperCase() : 'NOVA';
    const texto = `OS #${idCurto} — ${acao}`;
    if (typeof window.audit === 'function') {
      await window.audit('OS', texto, { osId: osId || null, origem: 'jarvis_campos_editaveis', ...extra });
    } else if (typeof audit === 'function') {
      await audit('OS', texto);
    }
  } catch(e) {}
}

function statusLabelOS(status) {
  const map = {
    Triagem: 'Triagem / avaliacao',
    Orcamento: 'Em orcamento',
    Orcamento_Enviado: 'Orcamento enviado',
    Aprovado: 'Aprovado',
    Andamento: 'Em servico',
    Pronto: 'Pronto para retirada',
    Entregue: 'Veiculo entregue / concluido',
    Cancelado: 'Cancelado'
  };
  return map[status] || STATUS_MAP_LEGACY[status] || status || '-';
}

function solicitarMotivoStatusOS(statusAntes, statusNovo, os, origem) {
  if (!statusNovo || statusAntes === statusNovo) return '';
  const ident = os?.placa || os?.prefixo || (os?.id ? ('OS #' + String(os.id).slice(-6).toUpperCase()) : 'O.S.');
  const msg = [
    `Informe o motivo/comentario para mudar ${ident}:`,
    '',
    `${statusLabelOS(statusAntes)} -> ${statusLabelOS(statusNovo)}`,
    '',
    'Esse registro fica na auditoria interna da O.S. e no historico operacional.'
  ].join('\n');
  const motivo = prompt(msg, origem === 'kanban' ? 'Atualizacao operacional do patio.' : '');
  if (motivo === null) return null;
  const limpo = String(motivo || '').trim();
  if (!limpo) {
    window.toast?.('Mudanca de status cancelada: comentario/motivo obrigatorio.', 'warn');
    return null;
  }
  return limpo;
}

function solicitarFinalizacaoOS(os) {
  const resp = prompt([
    'Como deseja finalizar esta O.S. em ENTREGUE?',
    '',
    '1 - Servico executado e veiculo entregue',
    '2 - Somente orcamento finalizado',
    '3 - Orcamento nao aprovado / recusado',
    '',
    'Digite 1, 2 ou 3.'
  ].join('\n'), '1');
  if (resp === null) return null;
  const val = String(resp || '').trim();
  if (val === '2') return { tipo: 'somente_orcamento', label: 'Somente orcamento finalizado' };
  if (val === '3') return { tipo: 'orcamento_nao_aprovado', label: 'Orcamento nao aprovado / recusado' };
  return { tipo: 'servico_entregue', label: 'Servico executado e veiculo entregue' };
}

function solicitarRetiradaOS(os) {
  const atual = String(os?.entreguePara || '').trim();
  const resp = prompt([
    'Informe quem retirou o veiculo:',
    '',
    'Ex.: Joao Silva - proprietario, motorista, responsavel autorizado.'
  ].join('\n'), atual);
  if (resp === null) return null;
  const limpo = String(resp || '').trim();
  if (!limpo) {
    window.toast?.('Entrega cancelada: informe quem retirou o veiculo.', 'warn');
    return null;
  }
  return limpo;
}

function montarEventoStatusOS(statusAntes, statusNovo, motivo, origem, extra) {
  const labelAntes = statusLabelOS(statusAntes);
  const labelNovo = statusLabelOS(statusNovo);
  const finalizacao = extra?.finalizacaoLabel ? ` | Finalizacao: ${extra.finalizacaoLabel}` : '';
  return {
    dt: new Date().toISOString(),
    user: J?.nome || 'Usuario',
    acao: `Status: ${labelAntes} -> ${labelNovo}. Motivo: ${motivo}${finalizacao}`,
    tipo: 'status_os',
    statusAnterior: statusAntes || '',
    statusNovo: statusNovo || '',
    motivo: motivo || '',
    origem: origem || 'os',
    finalizacaoOS: extra?.finalizacaoTipo || '',
    interno: true,
    visivelCliente: true
  };
}

function montarLinkPortalClienteOS(os, cliente, veiculo) {
  const tenantPublico = J?.oficina?.slug || J?.oficina?.publicSlug || J?.oficina?.oficinaSlug || J?.tid || '';
  if (typeof window.thiaGetClientePortalUrl === 'function') {
    return window.thiaGetClientePortalUrl({
      tenant: tenantPublico,
      cliente,
      os,
      veiculo,
      tipoCliente: cliente?.tipoCliente
    });
  }
  const isGov = cliente?.tipoCliente === 'governo';
  const page = isGov ? 'clienteOficial.html' : 'cliente.html';
  const params = new URLSearchParams({
    tenant: tenantPublico,
    os: os?.id || '',
    placa: os?.placa || veiculo?.placa || '',
    login: cliente?.login || os?.placa || veiculo?.placa || ''
  });
  return `https://tsvalencio-ia.github.io/OFICIN-IA/${page}?${params.toString()}`;
}

const KANBAN_STATUSES = ['Triagem', 'Orcamento', 'Orcamento_Enviado', 'Aprovado', 'Andamento', 'Pronto', 'Entregue'];

const STATUS_MAP_LEGACY = { 
    'Aguardando': 'Triagem', 
    'Concluido': 'Entregue', 
    'patio': 'Triagem', 
    'aprovacao': 'Orcamento_Enviado', 
    'box': 'Andamento', 
    'faturado': 'Pronto', 
    'cancelado': 'Cancelado', 
    'orcamento': 'Orcamento', 
    'pronto': 'Pronto', 
    'entregue': 'Entregue',
    'Triagem': 'Triagem',
    'Orcamento': 'Orcamento',
    'Orcamento_Enviado': 'Orcamento_Enviado',
    'Aprovado': 'Aprovado',
    'Andamento': 'Andamento',
    'Pronto': 'Pronto',
    'Entregue': 'Entregue'
};

window.escutarOS = function() {
  db.collection('ordens_servico').where('tenantId', '==', J.tid).onSnapshot(snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    J.os = window.thiaRuntimeCore?.dedupeOSForDisplay
      ? window.thiaRuntimeCore.dedupeOSForDisplay(docs)
      : (window.thiaRuntimeCore?.dedupeById ? window.thiaRuntimeCore.dedupeById(docs) : docs);
    if(typeof window.renderKanban === 'function') window.renderKanban(); 
    if(typeof window.renderDashboard === 'function') window.renderDashboard(); 
    if(typeof window.calcComissoes === 'function') window.calcComissoes();
  });
};

window.renderKanban = function() {
  const busca = ($v('searchOS') || '').trim().toLowerCase();
  const buscaEntregues = ($v('buscaEntreguesKanban') || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const filtroNicho = $v('filtroNichoKanban');
  const cols = {}; const cnts = {};
  KANBAN_STATUSES.forEach(s => { cols[s] = []; cnts[s] = 0; });

  const listaOSKanban = window.thiaRuntimeCore?.dedupeOSForDisplay
    ? window.thiaRuntimeCore.dedupeOSForDisplay(Array.isArray(J.os) ? J.os : [])
    : (window.thiaRuntimeCore?.dedupeById
      ? window.thiaRuntimeCore.dedupeById(Array.isArray(J.os) ? J.os : [])
      : (Array.isArray(J.os) ? J.os : []));
  listaOSKanban.filter(o => (o.status || '').toLowerCase() !== 'cancelado').forEach(o => {
    const stRaw = o.status || 'Triagem';
    const st = STATUS_MAP_LEGACY[stRaw] || 'Triagem'; 
    
    const v = (Array.isArray(J.veiculos) ? J.veiculos : []).find(x => x.id === o.veiculoId) || { placa: o.placa, modelo: o.veiculo, tipo: o.tipoVeiculo };
    const c = (Array.isArray(J.clientes) ? J.clientes : []).find(x => x.id === o.clienteId) || { nome: o.cliente };
    
    const identBusca = identidadeVeiculoOS(o, v);
    const modeloBusca = modeloVeiculoOS(o, v).toLowerCase();
    if (busca && !(v.placa||'').toLowerCase().includes(busca) && !(identBusca.prefixo||'').toLowerCase().includes(busca) && !modeloBusca.includes(busca) && !(c.nome||'').toLowerCase().includes(busca) && !(o.placa||'').toLowerCase().includes(busca) && !String(o.prisma || o.numeroPrisma || '').toLowerCase().includes(busca)) return;
    if (filtroNicho && v.tipo !== filtroNicho) return;
    if (st === 'Entregue' && buscaEntregues) {
      const txtEntregue = [identBusca.placa, identBusca.prefixo, c.nome, o.cliente, o.desc, o.finalizacaoLabel, o.finalizacaoOS, o.entreguePara]
        .filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!txtEntregue.includes(buscaEntregues)) return;
    }
    
    if (cols[st]) { cols[st].push({ os: o, v, c }); cnts[st]++; }
  });

  KANBAN_STATUSES.forEach(s => {
    const cntEl = $('cnt-' + s); if (cntEl) cntEl.innerText = cnts[s];
    const colEl = $('kb-' + s); if (!colEl) return;
    
    colEl.innerHTML = cols[s].sort((a, b) => new Date(b.os.updatedAt || 0) - new Date(a.os.updatedAt || 0)).map(({ os, v, c }) => {
      const tipoCls = v?.tipo || 'carro';
      const tipoLabel = { carro: '🚗 CARRO', moto: '🏍️ MOTO', bicicleta: '🚲 BICICLETA' }[tipoCls] || '🚗 VEÍCULO';
      const cor = { Triagem: 'var(--muted)', Orcamento: 'var(--warn)', Orcamento_Enviado: 'var(--purple)', Aprovado: 'var(--cyan)', Andamento: '#FF8C00', Pronto: 'var(--success)', Entregue: 'var(--green2)' }[s];
      
      const idx = KANBAN_STATUSES.indexOf(s);
      const sPrev = idx > 0 ? KANBAN_STATUSES[idx - 1] : null;
      const sNext = idx < KANBAN_STATUSES.length - 1 ? KANBAN_STATUSES[idx + 1] : null;
      
      const btnPrev = sPrev ? `<button onclick="event.stopPropagation(); window.moverStatusOS('${os.id}', '${sPrev}')" title="Mover para ${sPrev}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 18l-6-6 6-6"/></svg></button>` : '<div></div>';
      const btnNext = sNext ? `<button onclick="event.stopPropagation(); window.moverStatusOS('${os.id}', '${sNext}')" title="Mover para ${sNext}" style="background:transparent;border:none;color:var(--muted2);cursor:pointer;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg></button>` : '<div></div>';

      // Sanitização defensiva contra HTML/script em campos de texto livres
      const esc = s => String(s == null ? '' : s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
      const nomeCli = esc(c?.nome || os.cliente || 'Cliente Avulso').trim() || 'Cliente Avulso';
      const ident = identidadeVeiculoOS(os, v);
      const placaFmt = esc(ident.placa || 'S/PLACA');
      const prefixoFmt = esc(ident.prefixo || '');
      const modeloFmt = esc(modeloVeiculoOS(os, v));
      const prismaAtual = String(os.prisma || os.numeroPrisma || '').trim();
      const prismaFmt = prismaAtual && s !== 'Entregue'
        ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-family:var(--fm);font-size:.58rem;color:#111;background:var(--warn);border-radius:999px;padding:2px 7px;font-weight:900;letter-spacing:.8px;">PRISMA ${esc(prismaAtual)}</div>`
        : '';
      const UOS = window.JarvisOSUtils || window.JOS || {};
      const resumoValores = UOS.getBudgetSummary
        ? UOS.getBudgetSummary(os, c, J.financeiro)
        : { orcamento: os.total || 0, aprovado: os.totalAprovado || 0, faturado: 0, pagamento: {} };
      const valoresHtml = `
        <div style="display:grid;grid-template-columns:repeat(3,minmax(38px,1fr));gap:3px;margin:7px 0;">
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);padding:4px;border-radius:3px;min-width:0;">
            <small style="display:block;font-family:var(--fm);font-size:.44rem;color:var(--muted);letter-spacing:.45px;">ORC.</small>
            <strong style="display:block;font-family:var(--fm);font-size:.54rem;color:var(--warn);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${moeda(resumoValores.orcamento || 0)}</strong>
          </div>
          <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.12);padding:4px;border-radius:3px;min-width:0;">
            <small style="display:block;font-family:var(--fm);font-size:.44rem;color:var(--muted);letter-spacing:.45px;">APROV.</small>
            <strong style="display:block;font-family:var(--fm);font-size:.54rem;color:var(--cyan);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${resumoValores.aprovado ? moeda(resumoValores.aprovado) : '-'}</strong>
          </div>
          <div style="background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.12);padding:4px;border-radius:3px;min-width:0;">
            <small style="display:block;font-family:var(--fm);font-size:.44rem;color:var(--muted);letter-spacing:.45px;">FAT.</small>
            <strong style="display:block;font-family:var(--fm);font-size:.54rem;color:var(--success);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${resumoValores.faturado ? moeda(resumoValores.faturado) : '-'}</strong>
          </div>
        </div>`;
      const descFmt = esc(os.desc || os.relato || 'Sem descrição inicial...').substring(0, 120);
      const finalizacaoHtml = s === 'Entregue' && (os.finalizacaoLabel || os.finalizacaoOS)
        ? `<div style="font-family:var(--fm);font-size:.58rem;color:var(--green2);letter-spacing:.45px;margin:-2px 0 6px;">${esc(os.finalizacaoLabel || os.finalizacaoOS)}</div>`
        : '';

      // Botão de exclusão definitiva — visível apenas para admin/gestor/superadmin
      const role = (sessionStorage.getItem('j_role') || '').toLowerCase();
      const ehGestor = ['admin','gestor','gerente','superadmin'].includes(role);
      const btnExcluir = ehGestor
        ? `<button title="Excluir definitivamente esta O.S." onclick="event.stopPropagation();window.excluirOSDef('${os.id}')" style="background:transparent;border:1px solid var(--danger);color:var(--danger);font-family:var(--fm);font-size:0.6rem;padding:3px 7px;border-radius:3px;cursor:pointer;">🗑</button>`
        : '';

      return `<div class="k-card" data-os-id="${esc(os.id)}" style="border-left-color:${cor}" onclick="window.thiaAbrirOS('${os.id}','edit')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:6px;">
            <div>
              ${prefixoFmt ? `<div style="font-family:var(--fm);font-size:.58rem;color:var(--warn);letter-spacing:.8px;font-weight:800;margin-bottom:2px;">PREFIXO ${prefixoFmt}</div>` : ''}
              <div class="k-placa" style="color:${cor};margin:0;font-size:1rem;">${placaFmt}</div>
              ${modeloFmt ? `<div class="k-modelo" title="${modeloFmt}" style="font-family:var(--fm);font-size:.62rem;color:var(--muted2);letter-spacing:.45px;font-weight:700;margin-top:2px;max-width:126px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${modeloFmt}</div>` : ''}
              ${prismaFmt}
            </div>
            ${btnExcluir}
        </div>
        <div class="k-cliente" style="font-size:0.85rem;font-weight:700;color:var(--text);margin-bottom:2px;">${nomeCli}</div>
        ${finalizacaoHtml}
        <div class="k-desc" style="margin-bottom:8px;">${descFmt}</div>
        ${valoresHtml}
        <div class="k-footer" style="margin-bottom:8px;">
          <span class="k-tipo ${tipoCls}">${tipoLabel}</span>
          <span style="font-family:var(--fm);font-size:0.68rem;color:var(--muted);font-weight:700;">${resumoValores.pagamento?.forma ? esc(resumoValores.pagamento.forma).slice(0, 24) : 'Sem pgto'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">
          ${btnPrev}
          <span class="k-date">${dtBr(os.createdAt || os.data)}</span>
          ${btnNext}
        </div>
      </div>`;
    }).join('');
  });
};

window.moverStatusOS = async function(id, novoStatus) {
    // Captura status antigo ANTES de atualizar (para comparar)
    const osAntes = J.os.find(x => x.id === id);
    const statusAntes = osAntes?.status || '';
    const motivoStatus = solicitarMotivoStatusOS(statusAntes, novoStatus, osAntes, 'kanban');
    if (motivoStatus === null) return;
    let finalizacaoOS = null;
    let entregueParaOS = '';
    if (novoStatus === 'Entregue' && statusAntes !== 'Entregue') {
        finalizacaoOS = solicitarFinalizacaoOS(osAntes);
        if (finalizacaoOS === null) return;
        entregueParaOS = solicitarRetiradaOS(osAntes);
        if (entregueParaOS === null) return;
    }

    if ((novoStatus === 'Aprovado' || novoStatus === 'Andamento') && osAntes && !OSU().hasApproval?.(osAntes)) {
        try {
            const res = await OSU().aprovarOrcamentoComSelecao?.({
                db,
                osId: id,
                novoStatus: novoStatus === 'Andamento' ? 'Aprovado' : novoStatus,
                clientes: J.clientes,
                actorName: J.nome || 'Gestor',
                actorType: 'jarvis',
                motivoStatus,
                origemStatus: 'kanban',
                toast: window.toast
            });
            if (res) {
                window.toast(`✓ Orçamento aprovado: ${moeda(res.totalAprovado || 0)}`);
                audit('KANBAN', `Aprovou OS ${id.slice(-6)} com seleção de itens`);
            }
        } catch(e) {
            window.toast('Erro ao aprovar itens: ' + e.message, 'err');
        }
        return;
    }

    const updateStatus = { status: novoStatus, updatedAt: new Date().toISOString() };
    const tlStatus = Array.isArray(osAntes?.timeline) ? osAntes.timeline.slice() : [];
    if (statusAntes !== novoStatus) {
        tlStatus.push(montarEventoStatusOS(statusAntes, novoStatus, motivoStatus, 'kanban', {
            finalizacaoTipo: finalizacaoOS?.tipo,
            finalizacaoLabel: finalizacaoOS?.label
        }));
        updateStatus.timeline = tlStatus;
    }
    if (finalizacaoOS) {
        const prismaParaLiberar = String(osAntes?.prisma || osAntes?.numeroPrisma || '').trim();
        if (prismaParaLiberar) {
            updateStatus.prismaHistorico = osAntes?.prismaHistorico || osAntes?.numeroPrismaHistorico || prismaParaLiberar;
            updateStatus.numeroPrismaHistorico = osAntes?.numeroPrismaHistorico || osAntes?.prismaHistorico || prismaParaLiberar;
            updateStatus.prismaLiberado = true;
            updateStatus.prismaLiberadoEm = new Date().toISOString();
            updateStatus.prismaLiberadoPor = J.nome || 'Gestor';
            updateStatus.prisma = '';
            updateStatus.numeroPrisma = '';
        }
        updateStatus.finalizacaoOS = finalizacaoOS.tipo;
        updateStatus.finalizacaoLabel = finalizacaoOS.label;
        updateStatus.finalizacaoMotivo = motivoStatus;
        updateStatus.finalizadoEm = new Date().toISOString();
        updateStatus.finalizadoPor = J.nome || 'Gestor';
        updateStatus.entreguePara = entregueParaOS || osAntes?.entreguePara || '';
    }

    if (statusReabreEdicaoOrcamentoOS(novoStatus) && osTemAprovacaoAtivaOS(osAntes)) {
        aplicarReaberturaAprovacaoNoPayloadOS(updateStatus, osAntes, novoStatus, 'kanban');
        const tl = Array.isArray(updateStatus.timeline) ? updateStatus.timeline.slice() : (Array.isArray(osAntes.timeline) ? osAntes.timeline.slice() : []);
        tl.push({
            dt: new Date().toISOString(),
            user: J.nome || 'Gestor',
            acao: `Reabriu a O.S. para edição/reorçamento. Aprovação ativa arquivada ao voltar para ${novoStatus}.`
        });
        updateStatus.timeline = tl;
    }

    await db.collection('ordens_servico').doc(id).update(limparUndefinedFirestoreOS(updateStatus));
    window.toast(`✓ Movido para ${novoStatus.replace('_', ' ')}`);
    audit('KANBAN', `Moveu OS ${id.slice(-6)} de "${statusAntes}" para "${novoStatus}"`);

    if (novoStatus === 'Orcamento_Enviado') {
        window.registrarAvisoClienteCRMOS?.(id, novoStatus, { origem: 'kanban', osPatch: updateStatus });
        if (usuarioPodeDispararWppProntoOS()) {
            setTimeout(() => window.dispararAvisoEntregaAutomatico?.(id, novoStatus), 300);
        }
    }

    // No Jarvis, gestor/admin pode mover para Pronto e avisar cliente.
    // Chat interno como "equipe" so deve nascer quando a equipe.html fizer a mudanca.
    if (novoStatus === 'Pronto' && statusAntes !== 'Pronto') {
        window.registrarAvisoClienteCRMOS?.(id, novoStatus, { origem: 'kanban', osPatch: updateStatus });
        if (usuarioPodeDispararWppProntoOS()) {
            setTimeout(() => window.dispararAvisoEntregaAutomatico?.(id, novoStatus), 300);
        }
        return;
    }

    // WhatsApp automatico somente para entrega confirmada pelo gestor/caixa.
    if ((novoStatus === 'Entregue') && statusAntes !== 'Entregue') {
        window.registrarAvisoClienteCRMOS?.(id, novoStatus, { origem: 'kanban', osPatch: updateStatus });
        if (usuarioPodeDispararWppProntoOS()) {
            setTimeout(() => window.dispararAvisoEntregaAutomatico?.(id, novoStatus), 300);
        }
    }
};

/**
 * Dispara aviso via WhatsApp quando a O.S. fica Pronta ou Entregue.
 * Abre o WhatsApp Web/App com mensagem pré-preenchida. Cliente confirma envio.
 */
window.dispararAvisoEntregaAutomatico = function(id, novoStatus) {
    const os = J.os.find(x => x.id === id);
    if (!os) return;
    const c = J.clientes.find(x => x.id === os.clienteId);
    if (!c?.wpp) {
        window.toast('Cliente sem WhatsApp cadastrado — aviso automático não enviado.', 'warn');
        return;
    }
    const v = J.veiculos.find(x => x.id === os.veiculoId);
    const placaFmt = os.placa || v?.placa || 'seu veículo';
    const modelo = v?.modelo ? ` ${v.modelo}` : '';
    const fone = String(c.wpp).replace(/\D/g, '');

    let msg = '';
    if (novoStatus === 'Pronto') {
        msg = `Olá ${c.nome}! 👋\n\nAqui é da ${J.tnome}.\n\n✅ Seu veículo ${placaFmt}${modelo} está *PRONTO PARA RETIRADA*!\n\nPassamos a O.S. #${id.slice(-6).toUpperCase()} para conferência do caixa. Pode vir buscar quando for melhor pra você.\n\nAguardamos!`;
    } else if (novoStatus === 'Entregue') {
        msg = `Olá ${c.nome}! 👋\n\nAqui é da ${J.tnome}.\n\n🚘 Confirmamos a *ENTREGA* do seu veículo ${placaFmt}${modelo} referente à O.S. #${id.slice(-6).toUpperCase()}.\n\nMuito obrigado pela confiança! Qualquer dúvida pós-serviço, é só chamar por aqui.\n\nBoa estrada! 🛣️`;
    }
    if (!msg) return;

    // Confirma com o usuário antes de abrir o WhatsApp (evita spam involuntário)
    if (confirm(`Enviar aviso automático para ${c.nome} via WhatsApp?\n\n"${msg.substring(0, 200)}..."`)) {
        if (typeof window.thiaOpenWhatsApp === 'function') window.thiaOpenWhatsApp(fone, msg);
        else window.open(`https://web.whatsapp.com/send?phone=55${fone}&text=${encodeURIComponent(msg)}`, '_blank');
        audit('WHATSAPP', `Aviso ${novoStatus === 'Pronto' ? 'PRONTO P/ RETIRADA' : 'ENTREGA CONFIRMADA'} enviado para ${c.nome} (OS ${id.slice(-6).toUpperCase()})`);
    }
};

window.registrarAvisoClienteCRMOS = async function(id, novoStatus, opts = {}) {
    try {
        const osBase = (window.J?.os || []).find(x => x.id === id);
        if (!osBase || !window.db) return { ok: false, motivo: 'os_nao_encontrada' };
        const os = { ...osBase, ...(opts.osPatch || {}) };
        const c = (window.J?.clientes || []).find(x => x.id === os.clienteId);
        if (!c?.id) return { ok: false, motivo: 'cliente_nao_encontrado' };
        const v = (window.J?.veiculos || []).find(x => x.id === os.veiculoId) || os.veiculoSnapshot || {};
        const msg = opts.mensagem || montarMensagemStatusClienteOS({ ...os, id }, novoStatus, c, v);
        const avisoKey = `${id}:${novoStatus}`;
        const jaExiste = (window.J?.mensagens || []).some(m =>
          m.tipo === 'aviso_status_os' &&
          m.avisoStatusKey === avisoKey &&
          m.clienteId === c.id &&
          m.osId === id
        );
        if (!jaExiste) {
          await db.collection('mensagens').add({
              tenantId: J.tid,
              clienteId: c.id,
              sender: 'admin',
              msg,
              lidaAdmin: true,
              lidaCliente: false,
              ts: Date.now(),
              osId: id,
              tipo: 'aviso_status_os',
              statusOS: novoStatus,
              avisoStatusKey: avisoKey,
              origem: opts.origem || 'status_os',
              placa: os.placa || v.placa || '',
              prefixo: os.prefixo || v.prefixo || '',
              criadoPor: J.nome || 'Jarvis'
          });
          audit?.('CRM', `Aviso ${novoStatus} registrado no chat do cliente ${c.nome || c.id} (OS ${String(id).slice(-6).toUpperCase()})`);
        }
        return { ok: true, msg, cliente: c, veiculo: v, os };
    } catch(e) {
        console.warn('Aviso CRM cliente:', e);
        window.toast?.('Nao consegui registrar o aviso no CRM do cliente.', 'warn');
        return { ok: false, erro: e };
    }
};

window.dispararAvisoEntregaAutomatico = function(id, novoStatus) {
    const os = (window.J?.os || []).find(x => x.id === id);
    if (!os) return;
    const c = (window.J?.clientes || []).find(x => x.id === os.clienteId);
    if (!c?.id) {
        window.toast?.('Esta O.S. nao tem cliente vinculado para receber aviso.', 'warn');
        return;
    }
    const v = (window.J?.veiculos || []).find(x => x.id === os.veiculoId) || os.veiculoSnapshot || {};
    const msg = montarMensagemStatusClienteOS(os, novoStatus, c, v);
    const crmPromise = window.registrarAvisoClienteCRMOS
      ? window.registrarAvisoClienteCRMOS(id, novoStatus, { origem: 'botao_whatsapp', mensagem: msg })
      : Promise.resolve({ ok: false });

    if (!c?.wpp) {
        crmPromise.finally(() => window.toast('Aviso registrado no CRM. Cliente sem WhatsApp cadastrado.', 'warn'));
        return;
    }
    const fone = String(c.wpp).replace(/\D/g, '');
    if (!fone) {
        crmPromise.finally(() => window.toast('Aviso registrado no CRM. WhatsApp do cliente esta invalido.', 'warn'));
        return;
    }
    const rotulo = novoStatus === 'Orcamento_Enviado' ? 'ORCAMENTO ENVIADO' : (novoStatus === 'Pronto' ? 'PRONTO P/ RETIRADA' : 'ENTREGA CONFIRMADA');
    if (confirm(`Registrar aviso no CRM e abrir WhatsApp para ${c.nome || 'cliente'}?\n\n"${msg.substring(0, 220)}..."`)) {
        const aberto = typeof window.thiaOpenWhatsApp === 'function'
          ? window.thiaOpenWhatsApp(fone, msg)
          : !!window.open(`https://web.whatsapp.com/send?phone=55${fone}&text=${encodeURIComponent(msg)}`, '_blank');
        audit('WHATSAPP', `Aviso ${rotulo} enviado para ${c.nome} (OS ${id.slice(-6).toUpperCase()})`);
        crmPromise.finally(() => window.toast(aberto ? 'Aviso registrado no CRM e WhatsApp aberto.' : 'Aviso registrado no CRM. Se o navegador bloquear a aba, use o link aberto na tela atual.', 'ok'));
    } else {
        crmPromise.finally(() => window.toast('Aviso registrado somente no CRM.', 'ok'));
    }
};

window.notificarAdminOSPronta = async function(id, origem) {
    try {
        const os = (window.J?.os || []).find(x => x.id === id);
        if (!os || !window.db) return;
        const v = (window.J?.veiculos || []).find(x => x.id === os.veiculoId) || {};
        const c = (window.J?.clientes || []).find(x => x.id === os.clienteId) || {};
        const placa = os.placa || v.placa || 'S/PLACA';
        const msg = `OS #${String(id).slice(-6).toUpperCase()} marcada como PRONTO para retirada. Veiculo: ${placa}${v.modelo ? ' - ' + v.modelo : ''}. Cliente: ${c.nome || os.cliente || '-'}. Conferir e enviar WhatsApp ao cliente quando autorizado.`;
        await db.collection('chat_equipe').add({
            tenantId: J.tid,
            de: os.mecId || J.uid || 'sistema',
            para: 'admin',
            sender: 'equipe',
            msg,
            lidaAdmin: false,
            lidaEquipe: true,
            origem: origem || 'status_pronto',
            osId: id,
            ts: Date.now()
        });
        window.toast?.('Admin avisado no chat da equipe.', 'ok');
    } catch(e) {
        console.warn('Aviso interno OS pronta:', e);
    }
};

window.enviarWppB2C = function(id) {
    const os = J.os.find(x => x.id === id);
    if (!os) return;

    // Busca dados REAIS do cliente no Firebase (J.clientes já carregado)
    const cli = J.clientes.find(x => x.id === os.clienteId);
    const veic = J.veiculos.find(x => x.id === os.veiculoId);

    const cel = cli?.wpp || os.celular || '';
    const cliNome = cli?.nome || os.cliente || 'Cliente';
    const veicLabel = veic ? `${veic.modelo} (${veic.placa})` : (os.veiculo || 'Veículo');

    if (!cel) { window.toast('⚠ Cliente sem WhatsApp cadastrado', 'warn'); return; }

    const fone = cel.replace(/\D/g, '');

    // ✅ Login e PIN REAIS do cadastro do cliente no Firebase
    const loginUser = cli?.login || os.placa || cliNome.split(' ')[0].toLowerCase();
    const pin = cli?.pin || os.pin || '';

    // Link publico centralizado: governo -> clienteOficial, demais -> cliente.
    // Inclui tenant, O.S., placa e login para reduzir erro no atendimento.
    const link = montarLinkPortalClienteOS(os, cli, veic);

    const totalFmt = (os.total || 0).toFixed(2).replace('.', ',');

    const msg =
        `Olá ${cliNome.split(' ')[0]}! 👋\n\n` +
        `O orçamento do seu *${veicLabel}* está pronto na *${J.tnome}*.\n\n` +
        `💰 *Total: R$ ${totalFmt}*\n\n` +
        `Acesse seu portal exclusivo para aprovar o serviço:\n` +
        `🔗 Link: ${link}\n` +
        `👤 Usuário: *${loginUser}*\n` +
        `🔑 PIN: *${pin}*\n\n` +
        `_(Em conformidade com a LGPD, seus dados estão protegidos conosco.)_`;

    if (typeof window.thiaOpenWhatsApp === 'function') window.thiaOpenWhatsApp(fone, msg);
    else window.open(`https://web.whatsapp.com/send?phone=55${fone}&text=${encodeURIComponent(msg)}`, '_blank');
    window.toast('✓ Redirecionando WhatsApp B2C');
    audit('WHATSAPP', `Enviou Link/PIN para ${os.placa || veicLabel}`);
};

let mediaOSAtual = []; 
let timelineOSAtual = [];


// ═══════════════════════════════════════════════════════════════
// DESLOCAMENTO / GUINCHO — cálculo congelado por O.S.
// Referência: saída até 15 km + adicional por km excedente.
// Leve: saída 253,22 + 8,51/km. Pesado: saída 463,86 + 16,66/km.
// Desconto do guincho é separado de mão de obra e peças.
// ═══════════════════════════════════════════════════════════════
function _numGuinchoOS(value) {
  return numBR(value || 0);
}
function _moedaGuinchoOS(value) {
  return 'R$ ' + _numGuinchoOS(value).toFixed(2).replace('.', ',');
}
function _round2GuinchoOS(value) {
  return Math.round((_numGuinchoOS(value) + Number.EPSILON) * 100) / 100;
}
function _trunc2GuinchoOS(value) {
  value = _numGuinchoOS(value);
  return Math.trunc((value + Number.EPSILON) * 100) / 100;
}
function _pctGuinchoOS(value) {
  const pct = _numGuinchoOS(value || 0);
  if (!isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}
window.atualizarGuinchoCamposPorTipo = function() {
  const tipo = ($('osGuinchoTipo')?.value || 'leve');
  const saida = $('osGuinchoSaida');
  const kmValor = $('osGuinchoKmValor');
  if (!saida || !kmValor) return;
  if (tipo === 'pesado') {
    saida.value = '463,86';
    kmValor.value = '16,66';
  } else {
    saida.value = '253,22';
    kmValor.value = '8,51';
  }
};
window.calcularDeslocamentoGuinchoOS = function() {
  const ativo = !!$('osGuinchoAtivo')?.checked;
  const tipo = $('osGuinchoTipo')?.value || 'leve';
  const kmTotal = _numGuinchoOS($('osGuinchoKm')?.value || 0);
  const franquiaKm = _numGuinchoOS($('osGuinchoFranquia')?.value || 0) || 0;
  const valorSaida = _numGuinchoOS($('osGuinchoSaida')?.value || (tipo === 'pesado' ? 463.86 : 253.22));
  const valorKmAdicional = _numGuinchoOS($('osGuinchoKmValor')?.value || (tipo === 'pesado' ? 16.66 : 8.51));
  const descontoPct = _pctGuinchoOS($('osGuinchoDesconto')?.value || $('osGuinchoAjuste')?.value || 0);
  const idaVolta = $('osGuinchoIdaVolta') ? !!$('osGuinchoIdaVolta').checked : true;
  const abaterFranquia = $('osGuinchoAbaterFranquia') ? !!$('osGuinchoAbaterFranquia').checked : false;
  const kmCobrado = ativo ? Math.max(kmTotal - (abaterFranquia ? franquiaKm : 0), 0) : 0;
  const fator = Math.max(0, 1 - (descontoPct / 100));
  const saidaLiquida = ativo ? _round2GuinchoOS(valorSaida * fator) : 0;
  // A regra operacional informada pela oficina trunca o valor líquido por km em 2 casas.
  // Ex.: 8,51 com 51% => 4,16, e não 4,17.
  const kmLiquido = ativo ? _trunc2GuinchoOS(valorKmAdicional * fator) : 0;
  const valorIda = ativo ? _round2GuinchoOS(saidaLiquida + (kmCobrado * kmLiquido)) : 0;
  const total = ativo ? _round2GuinchoOS(valorIda * (idaVolta ? 2 : 1)) : 0;
  const subtotal = ativo ? _round2GuinchoOS(valorSaida + (kmCobrado * valorKmAdicional)) : 0;
  const descontoValor = ativo ? _round2GuinchoOS(subtotal - (total / (idaVolta ? 2 : 1))) : 0;
  const obj = {
    ativo,
    tipo,
    tipoLabel: tipo === 'pesado' ? 'Pesado acima de 1.500 kg / van / coletivo / carga / semirreboque acima de 750 kg' : 'Leve até 1.500 kg / moto / semirreboque até 750 kg',
    kmTotal,
    franquiaKm,
    abaterFranquia,
    kmExcedente: kmCobrado,
    kmCobrado,
    cobrarIdaVolta: idaVolta,
    idaVolta,
    valorSaida,
    valorKmAdicional,
    descontoPct,
    descPct: descontoPct,
    ajustePct: descontoPct,
    saidaLiquida,
    kmLiquido,
    valorIda,
    subtotal,
    descontoValor,
    total,
    obs: $('osGuinchoObs')?.value?.trim() || ''
  };
  if ($('osGuinchoSaidaLiquida')) $('osGuinchoSaidaLiquida').value = _moedaGuinchoOS(saidaLiquida);
  if ($('osGuinchoKmLiquido')) $('osGuinchoKmLiquido').value = _moedaGuinchoOS(kmLiquido);
  if ($('osGuinchoValorIda')) $('osGuinchoValorIda').value = _moedaGuinchoOS(valorIda);
  if ($('osGuinchoTotal')) $('osGuinchoTotal').value = _moedaGuinchoOS(total);
  if ($('osTotalGuinchoVal')) $('osTotalGuinchoVal').innerText = total.toFixed(2).replace('.', ',');
  return obj;
};
window.setDeslocamentoGuinchoOS = function(g) {
  g = g || {};
  if ($('osGuinchoAtivo')) $('osGuinchoAtivo').checked = !!g.ativo;
  if ($('osGuinchoTipo')) $('osGuinchoTipo').value = g.tipo || 'leve';
  if ($('osGuinchoKm')) $('osGuinchoKm').value = g.kmTotal != null ? String(g.kmTotal).replace('.', ',') : '';
  if ($('osGuinchoFranquia')) $('osGuinchoFranquia').value = g.franquiaKm != null ? String(g.franquiaKm).replace('.', ',') : '15';
  if ($('osGuinchoSaida')) $('osGuinchoSaida').value = g.valorSaida != null ? Number(g.valorSaida).toFixed(2).replace('.', ',') : (g.tipo === 'pesado' ? '463,86' : '253,22');
  if ($('osGuinchoKmValor')) $('osGuinchoKmValor').value = g.valorKmAdicional != null ? Number(g.valorKmAdicional).toFixed(2).replace('.', ',') : (g.tipo === 'pesado' ? '16,66' : '8,51');
  const desc = g.descontoPct ?? g.descPct ?? g.ajustePct ?? 0;
  if ($('osGuinchoDesconto')) $('osGuinchoDesconto').value = desc != null ? String(desc).replace('.', ',') : '';
  if ($('osGuinchoAjuste')) $('osGuinchoAjuste').value = desc != null ? String(desc).replace('.', ',') : '';
  if ($('osGuinchoIdaVolta')) $('osGuinchoIdaVolta').checked = g.cobrarIdaVolta ?? g.idaVolta ?? true;
  if ($('osGuinchoAbaterFranquia')) $('osGuinchoAbaterFranquia').checked = !!(g.abaterFranquia || g.usarFranquia || g.abaterKmFranquia);
  if ($('osGuinchoObs')) $('osGuinchoObs').value = g.obs || '';
  window.calcularDeslocamentoGuinchoOS?.();
};

async function salvarBlobArquivoOS(blob, fileName, mimeType) {
  const nomeSeguro = String(fileName || ('arquivo_' + Date.now()))
    .replace(/[\/:*?"<>|#%{}$!`&@+=]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  const capacitor = window.Capacitor;
  const plugins = capacitor?.Plugins || {};
  const Filesystem = plugins.Filesystem;
  const Share = plugins.Share;
  const isNative = !!(capacitor?.isNativePlatform?.() || capacitor?.getPlatform?.() === 'android' || capacitor?.getPlatform?.() === 'ios');
  async function baixarFallback() {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeSeguro;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { uri: url, fallback: true };
  }
  if (isNative && Filesystem) {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const Directory = Filesystem.Directory || {};
      const directory = Directory.Cache || Directory.Documents || 'CACHE';
      const saved = await Filesystem.writeFile({ path: nomeSeguro, data: base64, directory, recursive: true });
      if (Share && saved?.uri) {
        try { await Share.share({ title: nomeSeguro, text: nomeSeguro, url: saved.uri, dialogTitle: 'Compartilhar arquivo' }); } catch(e) {}
      }
      return saved;
    } catch (e) {
      console.warn('[ARQUIVO/APK] Falha no salvamento nativo; usando fallback.', e);
      window.toast?.('Salvamento nativo falhou; tentando download/compartilhamento alternativo', 'warn');
      return baixarFallback();
    }
  }
  return baixarFallback();
}
window.salvarBlobArquivoOS = salvarBlobArquivoOS;

function idsUnicosMecanicosOS(valores) {
  return Array.from(new Set((valores || []).map(v => String(v || '').trim()).filter(Boolean)));
}

function idsMecanicosDocumentoOS(os) {
  return idsUnicosMecanicosOS([
    os?.mecId,
    ...(Array.isArray(os?.mecIds) ? os.mecIds : []),
    ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.id || m?.mecId) : []),
    ...(Array.isArray(os?.servicos) ? os.servicos.flatMap(s => [s?.mecId || s?.mecanicoId || s?.responsavelId, ...(Array.isArray(s?.rateiosComissao) ? s.rateiosComissao.map(r => r?.mecId || r?.id) : [])]) : [])
  ]);
}

function snapshotMecanicoOS(id, origem) {
  const mec = (window.J?.equipe || []).find(f => String(f.id) === String(id));
  const salvo = (Array.isArray(origem?.mecanicos) ? origem.mecanicos : [])
    .find(f => String(f?.id || f?.mecId) === String(id));
  const base = mec || salvo || {};
  return {
    id: String(base.id || base.mecId || id || ''),
    nome: base.nome || base.usuario || base.mecNome || '',
    cargo: base.cargo || '',
    comissaoServico: numBR(base.comissaoServico ?? base.comissao ?? 0),
    comissaoPeca: numBR(base.comissaoPeca || 0)
  };
}

window.obterMecanicosSelecionadosOS = function() {
  const ids = [];
  const principal = document.getElementById('osMec')?.value || '';
  if (principal) ids.push(principal);
  document.querySelectorAll('#osMecanicosEquipe input[type="checkbox"]:checked').forEach(chk => ids.push(chk.value));
  document.querySelectorAll('#containerServicosOS .serv-mec, #containerPecasOS .cilia-serv-relac .serv-mec').forEach(sel => {
    if (sel.value) ids.push(sel.value);
  });
  return idsUnicosMecanicosOS(ids);
};

window.renderMecanicosEquipeOS = function(selectedIds) {
  const box = document.getElementById('osMecanicosEquipe');
  if (!box) return;
  const principal = document.getElementById('osMec')?.value || '';
  const atuais = selectedIds === undefined ? window.obterMecanicosSelecionadosOS() : idsUnicosMecanicosOS(selectedIds);
  const selecionados = new Set(idsUnicosMecanicosOS([principal, ...atuais]));
  const equipe = Array.isArray(window.J?.equipe) ? window.J.equipe : [];
  box.innerHTML = equipe
    .filter(f => String(f.id) !== String(principal))
    .map(f => {
      const checked = selecionados.has(String(f.id)) ? 'checked' : '';
      return `<label style="display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(0,212,255,.22);background:rgba(0,212,255,.06);padding:5px 7px;border-radius:3px;font-family:var(--fm);font-size:.62rem;color:var(--text);cursor:pointer;">
        <input type="checkbox" value="${escOS(f.id)}" ${checked} onchange="window.atualizarResponsaveisServicoOS?.()"> ${escOS(f.nome || f.usuario || f.id)}
      </label>`;
    }).join('') || '<span style="font-family:var(--fm);font-size:.60rem;color:var(--muted);">Nenhum mecânico adicional cadastrado.</span>';
};

function opcoesResponsavelServicoOS(selectedId) {
  const equipe = Array.isArray(window.J?.equipe) ? window.J.equipe : [];
  const opcoes = ['<option value="">Selecione o mecânico</option>'];
  equipe.forEach(mec => {
    const id = String(mec?.id || '').trim();
    if (!id) return;
    opcoes.push(`<option value="${escOS(id)}" ${id === String(selectedId || '') ? 'selected' : ''}>${escOS(mec.nome || mec.usuario || id)}</option>`);
  });
  return opcoes.join('');
}

function normalizarRateiosServicoOS(rateios, fallbackId, valorFinal) {
  const vistos = new Set();
  const lista = (Array.isArray(rateios) ? rateios : []).map(r => {
    const mecId = String(r?.mecId || r?.id || '').trim();
    if (!mecId || vistos.has(mecId)) return null;
    vistos.add(mecId);
    const mec = (window.J?.equipe || []).find(f => String(f.id) === mecId);
    return {
      mecId,
      mecNome: r?.mecNome || r?.nome || mec?.nome || '',
      valorBase: Math.max(0, numBR(r?.valorBase ?? r?.valorDividido ?? r?.baseComissao ?? 0)),
      automatico: r?.automatico === true
    };
  }).filter(Boolean);
  if (!lista.length && fallbackId) {
    const mec = (window.J?.equipe || []).find(f => String(f.id) === String(fallbackId));
    lista.push({ mecId: String(fallbackId), mecNome: mec?.nome || '', valorBase: Math.max(0, numBR(valorFinal || 0)), automatico: true });
  }
  return lista;
}

function valorFinalAtualLinhaServicoOS(row) {
  try {
    const calc = calcularServicoLinhaOS(row, descontoMaoObraAtualOS());
    return Math.max(0, numBR(calc?.valorFinal || 0));
  } catch (_) {
    return Math.max(0, numBR(row?.querySelector?.('.serv-valor-cobrado')?.value || row?.querySelector?.('.serv-valor')?.value || 0));
  }
}

function criarLinhaRateioServicoOS(row, rateio) {
  const linha = document.createElement('div');
  linha.className = 'serv-rateio-row';
  linha.dataset.autoValor = rateio?.automatico ? '1' : '';
  linha.innerHTML = `<select class="j-select serv-mec" aria-label="Mecânico que realizou o serviço">${opcoesResponsavelServicoOS(rateio?.mecId || '')}</select><input type="text" inputmode="decimal" class="j-input serv-rateio-valor" value="${numBR(rateio?.valorBase || 0) ? numBR(rateio.valorBase).toFixed(2).replace('.', ',') : ''}" placeholder="Base dividida R$" title="Parte do valor cobrado atribuída a este mecânico. Informação interna, exibida somente no financeiro."><button type="button" class="serv-rateio-remove" title="Remover mecânico" style="width:34px;height:34px;border:1px solid rgba(255,59,59,.35);background:rgba(255,59,59,.09);color:var(--danger);border-radius:3px;cursor:pointer;">✕</button>`;
  const sel = linha.querySelector('.serv-mec');
  const valor = linha.querySelector('.serv-rateio-valor');
  sel.addEventListener('change', () => {
    const adicional = Array.from(document.querySelectorAll('#osMecanicosEquipe input[type="checkbox"]')).find(chk => String(chk.value) === String(sel.value || ''));
    if (adicional && sel.value) adicional.checked = true;
    window.sincronizarRateiosServicoOS?.(row);
  });
  valor.addEventListener('input', () => {
    linha.dataset.autoValor = '';
    window.sincronizarRateiosServicoOS?.(row);
  });
  linha.querySelector('.serv-rateio-remove').addEventListener('click', () => {
    const lista = linha.parentElement;
    if (lista?.querySelectorAll('.serv-rateio-row').length <= 1) {
      sel.value = '';
      valor.value = '';
      linha.dataset.autoValor = '';
    } else linha.remove();
    window.sincronizarRateiosServicoOS?.(row);
  });
  return linha;
}

window.obterRateiosLinhaServicoOS = function(row, valorFinalInformado) {
  if (!row) return [];
  const valorFinal = Math.max(0, numBR(valorFinalInformado ?? valorFinalAtualLinhaServicoOS(row)));
  const linhas = Array.from(row.querySelectorAll('.serv-rateio-row'));
  const rateios = [];
  const vistos = new Set();
  linhas.forEach((linha, index) => {
    const sel = linha.querySelector('.serv-mec');
    const mecId = String(sel?.value || '').trim();
    if (!mecId || vistos.has(mecId)) return;
    vistos.add(mecId);
    let valorBase = Math.max(0, numBR(linha.querySelector('.serv-rateio-valor')?.value || 0));
    if (linhas.length === 1 && valorBase <= 0) valorBase = valorFinal;
    const mec = (window.J?.equipe || []).find(f => String(f.id) === mecId);
    rateios.push({ mecId, mecNome: mec?.nome || mec?.usuario || '', valorBase: +valorBase.toFixed(2), ordem: index });
  });
  return rateios;
};

window.sincronizarRateiosServicoOS = function(row) {
  if (!row) return;
  const rateios = window.obterRateiosLinhaServicoOS(row);
  const primeiro = rateios[0] || {};
  row.dataset.mecId = primeiro.mecId || '';
  row.dataset.mecNome = primeiro.mecNome || '';
  row.dataset.mecIds = rateios.map(r => r.mecId).join(',');
  row._rateiosComissaoAtual = rateios;
  window.renderMecanicosEquipeOS?.();
};

window.adicionarRateioServicoOS = function(row, rateio) {
  if (!row) return;
  const lista = row.querySelector('.serv-rateio-list');
  if (!lista) return;
  lista.appendChild(criarLinhaRateioServicoOS(row, rateio || {}));
  window.sincronizarRateiosServicoOS(row);
  setTimeout(() => lista.lastElementChild?.querySelector('.serv-mec')?.focus(), 30);
};

window.garantirResponsavelLinhaServicoOS = function(row, selectedId) {
  if (!row?.querySelector?.('.serv-desc')) return;
  garantirEstilosOSV22();
  const mecanicoPrincipal = document.getElementById('osMec')?.value || '';
  const idAtual = selectedId || row.dataset?.mecId || mecanicoPrincipal;
  let wrap = row.querySelector('.serv-rateio-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'serv-rateio-wrap';
    wrap.innerHTML = `<div class="serv-rateio-head"><div><b style="font-family:var(--fd);font-size:.68rem;color:var(--cyan);letter-spacing:.5px;">MECÂNICOS E DIVISÃO DO SERVIÇO</b><div class="serv-rateio-help">Interno: serve somente para calcular e pagar comissões. Não aparece na O.S., no PDF ou nas planilhas.</div></div><button type="button" class="btn-ghost serv-rateio-add" style="padding:6px 9px;font-size:.62rem;">+ DIVIDIR COM OUTRO MECÂNICO</button></div><div class="serv-rateio-list"></div>`;
    row.appendChild(wrap);
    wrap.querySelector('.serv-rateio-add').addEventListener('click', () => window.adicionarRateioServicoOS(row, {}));
    const valorFinal = valorFinalAtualLinhaServicoOS(row);
    const salvos = normalizarRateiosServicoOS(row._rateiosComissaoInicial, idAtual, valorFinal);
    const lista = wrap.querySelector('.serv-rateio-list');
    (salvos.length ? salvos : [{ mecId: idAtual, valorBase: valorFinal, automatico: true }]).forEach(r => lista.appendChild(criarLinhaRateioServicoOS(row, r)));
    delete row._rateiosComissaoInicial;
  } else {
    wrap.querySelectorAll('.serv-mec').forEach(sel => {
      const atual = sel.value;
      sel.innerHTML = opcoesResponsavelServicoOS(atual);
      sel.value = atual;
    });
  }
  window.sincronizarRateiosServicoOS(row);
};

window.atualizarValorAutomaticoRateioServicoOS = function(row, valorFinal) {
  const linhas = Array.from(row?.querySelectorAll?.('.serv-rateio-row') || []);
  if (linhas.length !== 1) return;
  const linha = linhas[0];
  const input = linha.querySelector('.serv-rateio-valor');
  if (!input) return;
  if (linha.dataset.autoValor === '1' || !String(input.value || '').trim()) {
    input.value = Math.max(0, numBR(valorFinal || 0)).toFixed(2).replace('.', ',');
    linha.dataset.autoValor = '1';
    window.sincronizarRateiosServicoOS(row);
  }
};

window.atualizarResponsaveisServicoOS = function() {
  document.querySelectorAll('#containerServicosOS > div, #containerPecasOS .cilia-serv-relac').forEach(row => {
    window.garantirResponsavelLinhaServicoOS(row, row.dataset?.mecId || '');
  });
};

window.atualizarEquipeMecanicosOS = function() {
  const principalAnterior = String(window._osMecPrincipalAnterior || '');
  const principalAtual = String(document.getElementById('osMec')?.value || '');
  document.querySelectorAll('#containerServicosOS > div, #containerPecasOS .cilia-serv-relac').forEach(row => {
    window.garantirResponsavelLinhaServicoOS(row, row.dataset?.mecId || principalAtual);
    const linhas = Array.from(row.querySelectorAll('.serv-rateio-row'));
    if (linhas.length === 1) {
      const sel = linhas[0].querySelector('.serv-mec');
      const atual = String(sel?.value || '');
      if (!atual || (principalAnterior && atual === principalAnterior)) {
        sel.value = principalAtual;
        window.sincronizarRateiosServicoOS(row);
      }
    }
  });
  window.renderMecanicosEquipeOS();
  window._osMecPrincipalAnterior = principalAtual;
};


window.prepOS = function(mode, id = null) {
  ['osId', 'osPlaca', 'osPlacaView', 'osPrefixo', 'osVeiculo', 'osCliente', 'osCelular', 'osCpf', 'osDiagnostico', 'osRelato', 'osDescricao', 'chkObs', 'osKm', 'osData', 'osPrisma'].forEach(f => { if ($(f)) $(f).value = ''; });
  // Limpa apenas os marcadores de vínculo da O.S. anterior. Eles serão definidos novamente
  // ao abrir uma O.S. existente e usados para impedir que listeners apaguem cliente/veículo.
  if ($('osCliente')) delete $('osCliente').dataset.osClienteSalvo;
  if ($('osVeiculo')) delete $('osVeiculo').dataset.osVeiculoSalvo;
  // Checklist tri-state: limpa valor hidden + botões ativos
  ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(f => {
    if ($(f)) $(f).value = '';
    if (typeof window._chkTriApply === 'function') window._chkTriApply(f, '');
  });
  
  if ($('osStatus')) $('osStatus').value = 'Triagem';
  if ($('osTipoVeiculo')) $('osTipoVeiculo').value = '';
  if ($('osMec')) $('osMec').value = '';
  if ($('osData')) $('osData').value = dataLocalISOOS();
  if ($('containerItensOS')) $('containerItensOS').innerHTML = '';
  if ($('containerServicosOS')) $('containerServicosOS').innerHTML = '';
  if ($('containerPecasOS')) $('containerPecasOS').innerHTML = '';
  if ($('containerPecasReais')) $('containerPecasReais').innerHTML = '';
  if ($('containerServicosReais')) $('containerServicosReais').innerHTML = '';
  document.getElementById('resumoAprovacaoOS')?.remove();
  if ($('osTotalVal')) $('osTotalVal').innerText = '0,00';
  if ($('osTotalServicosVal')) $('osTotalServicosVal').innerText = '0,00';
  if ($('osTotalPecasVal')) $('osTotalPecasVal').innerText = '0,00';
  if ($('osTotalGuinchoVal')) $('osTotalGuinchoVal').innerText = '0,00';
  if ($('osTotalValMirror')) $('osTotalValMirror').innerText = '0,00';
  if ($('osSecaoKpisOS')) $('osSecaoKpisOS').innerHTML = '';
  if ($('osTotalHidden')) $('osTotalHidden').value = '0';
  ['osProxRev','osProxKm','osPgtoForma','osPgtoData','osPgtoParcelas','osModeloOS','osCabecalhoOS','osValorHoraOS','osDescMO','osDescPeca','osEntregueA','osGuinchoKm','osGuinchoAjuste','osGuinchoDesconto','osGuinchoObs','osGuinchoKm','osGuinchoAjuste','osGuinchoObs'].forEach(f => { if ($(f)) $(f).value = ''; });
  if ($('osPgtoParcelas')) $('osPgtoParcelas').value = '1';
  renderPagamentosCombinadosOS([]);
  aplicarRegraParcelasPagamentoOS();
  window.setDeslocamentoGuinchoOS?.({ ativo: false, tipo: 'leve', franquiaKm: 0, valorSaida: 253.22, valorKmAdicional: 8.51, ajustePct: 0, descontoPct: 0, kmTotal: 0, cobrarIdaVolta: true, abaterFranquia: false, obs: '' });
  if ($('osMediaGrid')) $('osMediaGrid').innerHTML = ''; 
  if ($('osMediaArray')) $('osMediaArray').value = '[]';
  if ($('osTimeline')) $('osTimeline').innerHTML = ''; 
  if ($('osTimelineData')) $('osTimelineData').value = '[]';
  if ($('osIdBadge')) $('osIdBadge').innerText = 'NOVA O.S.';
  window.atualizarVisibilidadeDescontosOS?.();
  atualizarResumoDescontosOS({ descMO: 0, descPeca: 0, brutoServicos: 0, liquidoServicos: 0, brutoPecas: 0, liquidoPecas: 0 });
  if ($('btnVisualizarPDFOS')) $('btnVisualizarPDFOS').style.display = 'none';
  if ($('btnGerarPDFOS')) $('btnGerarPDFOS').style.display = 'none'; 
  if ($('btnExcluirOS')) $('btnExcluirOS').style.display = 'none';   // só aparece editando OS existente
  if ($('areaPgtoOS')) $('areaPgtoOS').style.display = 'none'; 
  if ($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = 'none';
  
  window.osPecas = [];
  window.osFotos = [];

  // Limpa também o preview local do batch upload (correção #4)
  if (typeof window.limparOsMediaPreview === 'function') window.limparOsMediaPreview();

  if (typeof window.popularSelects === 'function') window.popularSelects();
  window._osMecPrincipalAnterior = '';
  window.renderMecanicosEquipeOS?.([]);

  if (mode === 'add') { 
      if(typeof window.adicionarServicoOS === 'function') window.adicionarServicoOS();
      if(typeof window.adicionarPecaOS === 'function') window.adicionarPecaOS();
      setTimeout(() => window.inicializarAutoLinhasOS?.(), 0);
  }

  if (mode === 'edit' && id) {
    const o = J.os.find(x => x.id === id);
    if (!o) return;

    if ($('osId')) $('osId').value = o.id;
    if ($('osIdBadge')) $('osIdBadge').innerText = 'OS #' + o.id.slice(-6).toUpperCase();
    if ($('osPlaca')) $('osPlaca').value = o.placa || '';
    if ($('osTipoVeiculo')) {
      const _vinc = (window.J?.veiculos || []).find(v => v.id === (o.veiculoId || o.veiculo));
      $('osTipoVeiculo').value = o.tipoVeiculoOS || o.tipoVeiculoTabela || o.tipoVeiculo || _vinc?.tipoVeiculo || _vinc?.tipo || o.tipo || '';
    }
    
    const _clienteVinculadoOS = String(o.clienteId || '');
    const _veiculoVinculadoOS = String(o.veiculoId || o.veiculo || '');
    if ($('osCliente')) {
        $('osCliente').dataset.osClienteSalvo = _clienteVinculadoOS;
        $('osCliente').value = _clienteVinculadoOS;
        if(typeof window.filtrarVeiculosOS === 'function') window.filtrarVeiculosOS({ preservarVeiculoId: _veiculoVinculadoOS, osFallback: o, origem: 'abrirOSEdit' });
    }
    if ($('osVeiculo')) $('osVeiculo').dataset.osVeiculoSalvo = _veiculoVinculadoOS;
    setTimeout(() => {
      if ($('osCliente') && _clienteVinculadoOS && !$('osCliente').value) $('osCliente').value = _clienteVinculadoOS;
      if (typeof window.filtrarVeiculosOS === 'function') window.filtrarVeiculosOS({ preservarVeiculoId: _veiculoVinculadoOS, osFallback: o, origem: 'abrirOSEditFallback' });
      if ($('osVeiculo') && _veiculoVinculadoOS) $('osVeiculo').value = _veiculoVinculadoOS;
      window.atualizarIdentificacaoVeiculoOS?.(o);
    }, 100);

    if ($('osMec')) $('osMec').value = o.mecId || idsMecanicosDocumentoOS(o)[0] || '';
    window._osMecPrincipalAnterior = $('osMec')?.value || '';
    window.renderMecanicosEquipeOS?.(idsMecanicosDocumentoOS(o));
    if ($('osCelular')) $('osCelular').value = o.celular || '';
    if ($('osCpf')) $('osCpf').value = o.cpf || '';
    if ($('osStatus')) $('osStatus').value = STATUS_MAP_LEGACY[o.status] || o.status || 'Triagem';
    if ($('osDiagnostico')) $('osDiagnostico').value = o.diagnostico || '';
    if ($('osRelato')) $('osRelato').value = o.relato || '';
    if ($('osDescricao')) $('osDescricao').value = o.desc || o.relato || '';
    if ($('osData')) $('osData').value = o.data || ''; 
    if ($('osKm')) $('osKm').value = o.km || '';
    if ($('osPrisma')) $('osPrisma').value = o.prisma || o.numeroPrisma || '';
    if ($('osEntregueA')) {
      $('osEntregueA').value = o.entreguePara || '';
      const r = document.getElementById('rowEntregueA');
      if (r) r.style.display = (o.status === 'Entregue') ? 'flex' : 'none';
    }
    // Dados oficiais personalizados desta OS: carrega primeiro a OS e usa o cadastro do cliente só como fallback.
    const _cli_oficial_os = (window.J?.clientes||[]).find(cl=>cl.id===o.clienteId) || {};
    window.aplicarDadosOficiaisDaOS?.(o, _cli_oficial_os);
    window.setDeslocamentoGuinchoOS?.(o.deslocamentoGuincho || o.guincho || {});
    // Mostra blocos governo se cliente for gov
    const _cli_load = (window.J?.clientes||[]).find(cl=>cl.id===o.clienteId);
    const _ehGov_load = _cli_load?.tipoCliente === 'governo';
    const _blocoDesc = document.getElementById('blocoDescontoOS');
    const _blocoReais = document.getElementById('blocoReais');
    if (_blocoDesc) window.atualizarVisibilidadeDescontosOS?.();
    if (_blocoReais) window.atualizarVisibilidadeReaisOS?.();
    // Carregar peças e serviços reais sem alterar o orçamento do cliente.
    if ($('containerPecasReais')) {
      $('containerPecasReais').innerHTML = '';
      (o.pecasReais || []).forEach(p => window.adicionarPecaRealRow(p, { focus:false, scroll:false, carregando:true }));
    }
    if ($('containerServicosReais')) {
      $('containerServicosReais').innerHTML = '';
      (o.servicosReais || o.servicosTerceirizadosReais || []).forEach(s => window.adicionarServicoRealRow?.(s, { focus:false, scroll:false, carregando:true }));
    }
    window.atualizarResumoPecasReais177?.();
    // LOTE C — Traz próxima revisão ao editar
    if ($('osProxRev')) $('osProxRev').value = o.proxRev || '';
    if ($('osProxKm'))  $('osProxKm').value  = o.proxKm  || '';
    // LOTE B — Traz forma de pagamento e parcelas
    if ($('osPgtoForma')) $('osPgtoForma').value = o.pgtoForma || '';
    if ($('osPgtoData'))  $('osPgtoData').value  = o.pgtoData  || '';
    if ($('osPgtoParcelas')) $('osPgtoParcelas').value = String(parcelasPagamentoOS(o.pgtoForma || '', o.pgtoParcelas || 1));
    const _temFinanceiroOS = (window.J?.financeiro || []).some(f => f.osId === o.id && !financeiroOSCanceladoOS(f));
    const _pgtoLegadoSemLastro = !!(o.pgtoForma && !o.pgtoData && !_temFinanceiroOS);
    const _formaPgtoLoad = _pgtoLegadoSemLastro ? '' : (o.pgtoForma || '');
    if ($('osPgtoForma')) $('osPgtoForma').value = _formaPgtoLoad;
    if ($('osPgtoData')) $('osPgtoData').value = _pgtoLegadoSemLastro ? '' : (o.pgtoData || '');
    if ($('osPgtoParcelas')) $('osPgtoParcelas').value = String(parcelasPagamentoOS(_formaPgtoLoad, o.pgtoParcelas || 1));
    renderPagamentosCombinadosOS(o.pgtoCombinado || []);
    aplicarRegraParcelasPagamentoOS();
    
    const _pecasReconciliadasOS = osReconciliarPecasReaisParaClienteComumOS(o, Array.isArray(o.pecas) ? o.pecas : [], Array.isArray(o.pecasReais) ? o.pecasReais : []);
    const pecasOS = osPecasOrcamentoVisiveisOS(o, _pecasReconciliadasOS);
    o.pecas = _pecasReconciliadasOS; // preserva integralmente os registros internos já gravados
    window.osPecas = pecasOS;
    window.osFotos = o.media || o.fotos || [];

    if(typeof window.renderItensOS === 'function') window.renderItensOS();

    const servicosOS = Array.isArray(o.servicos) ? o.servicos : [];
    const servicosCiliaPorPeca = {};
    const servicosNormais = [];
    servicosOS.forEach(s => {
        if (s && s.relacionadoCilia && s.ciliaPieceIndex !== undefined && s.ciliaPieceIndex !== null && String(s.ciliaPieceIndex) !== '') {
            const key = String(s.ciliaPieceIndex);
            if (!servicosCiliaPorPeca[key]) servicosCiliaPorPeca[key] = [];
            servicosCiliaPorPeca[key].push(s);
        } else {
            servicosNormais.push(s);
        }
    });

    if (servicosNormais.length > 0 && typeof window.renderServicoOSRow === 'function') {
        servicosNormais.forEach(s => window.renderServicoOSRow(s));
    } else if (o.maoObra > 0 && typeof window.renderServicoOSRow === 'function' && servicosOS.length === 0) {
        window.renderServicoOSRow({ desc: 'Mão de Obra Geral', valor: o.maoObra });
    }

    if (pecasOS.length > 0 && typeof window.renderPecaOSRow === 'function') {
        pecasOS.forEach(p => {
            const isCilia = p && p.ciliaPieceIndex !== undefined && p.ciliaPieceIndex !== null && String(p.ciliaPieceIndex) !== '';
            if (isCilia && typeof window.renderCiliaPecaOSRow === 'function') {
                window.renderCiliaPecaOSRow(p, servicosCiliaPorPeca[String(p.ciliaPieceIndex)] || []);
            } else {
                window.renderPecaOSRow(p);
            }
        });
    }
    window.atualizarResponsaveisServicoOS?.();

    if (typeof window.aplicarMarcadoresAprovacaoOS === 'function') {
      window.aplicarMarcadoresAprovacaoOS(o);
    }

    if ($('chkComb')) $('chkComb').value = o.chkComb || 'N/A'; 
    if ($('chkPneuDia')) $('chkPneuDia').value = o.chkPneuDia || ''; 
    if ($('chkPneuTra')) $('chkPneuTra').value = o.chkPneuTra || ''; 
    if ($('chkObs')) $('chkObs').value = o.chkObs || '';
    
    // LOTE 1.5 — Checklist tri-state: aceita formato antigo (boolean) e novo (string 'ok'/'atencao'/'critico')
    const _toTri = v => (v === true || v === 'ok') ? 'ok' : (v === 'atencao' || v === 'critico') ? v : '';
    if (typeof window._chkTriApply === 'function') {
      window._chkTriApply('chkPainel',     _toTri(o.chkPainel));
      window._chkTriApply('chkPressao',    _toTri(o.chkPressao));
      window._chkTriApply('chkCarroceria', _toTri(o.chkCarroceria));
      window._chkTriApply('chkDocumentos', _toTri(o.chkDocumentos));
    } else {
      // Fallback compatível com versão antiga
      if (o.chkPainel && $('chkPainel')) $('chkPainel').value = _toTri(o.chkPainel);
      if (o.chkPressao && $('chkPressao')) $('chkPressao').value = _toTri(o.chkPressao);
      if (o.chkCarroceria && $('chkCarroceria')) $('chkCarroceria').value = _toTri(o.chkCarroceria);
      if (o.chkDocumentos && $('chkDocumentos')) $('chkDocumentos').value = _toTri(o.chkDocumentos);
    }

    if($('osTimelineData') && o.timeline) {
        $('osTimelineData').value = JSON.stringify(o.timeline);
        window.renderTimelineOS();
    }
    
    if($('osMediaArray')) {
        $('osMediaArray').value = JSON.stringify(window.osFotos);
        window.renderMediaOS();
    }
    
    window.calcOSTotal();
    window.verificarStatusOS();
    
    // Auto-preenche placa na busca histórica com a placa desta OS
    const _elBuscaPlaca = document.getElementById('histBuscaPlaca');
    if (_elBuscaPlaca && o.placa) _elBuscaPlaca.value = (o.placa||'').toUpperCase();
    const _elBuscaRes = document.getElementById('histBuscaResultado');
    if (_elBuscaRes) _elBuscaRes.innerHTML = '';

    if ($('btnVisualizarPDFOS')) $('btnVisualizarPDFOS').style.display = 'block';
    if ($('btnGerarPDFOS')) $('btnGerarPDFOS').style.display = 'block';

    // Botão de exclusão só aparece se for admin/gestor (e estiver editando OS existente)
    if ($('btnExcluirOS')) {
      const role = (sessionStorage.getItem('j_role') || '').toLowerCase();
      const ehGestor = ['admin','gestor','gerente','superadmin'].includes(role);
      $('btnExcluirOS').style.display = ehGestor ? 'block' : 'none';
      $('btnExcluirOS').dataset.osId = id;
    }

    // Botão Exportar Orçamento PMSP — aparece SOMENTE se cliente é governamental
    if ($('btnExportarPMSP')) {
      const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
      $('btnExportarPMSP').style.display = ehGov ? 'block' : 'none';
      $('btnExportarPMSP').dataset.osId = id;
      if ($('btnExportarPMSPItens')) {
        $('btnExportarPMSPItens').style.display = ehGov ? 'block' : 'none';
        $('btnExportarPMSPItens').dataset.osId = id;
      }
    }
  }
  // CHECKLIST INTELIGENTE V15.11 — hook cirúrgico para renderizar o checklist técnico
  // dentro da aba "Provas & Checklist" sempre que a O.S. for aberta/preparada.
  // Não altera peças, serviços, financeiro, provas Cloudinary ou fluxo de salvamento.
  setTimeout(() => {
    try { window.renderChecklistInteligenteOS?.(); } catch (e) { console.warn('[Checklist Inteligente OS] render hook prepOS', e); }
  }, 220);
  setTimeout(() => window.scrollOSModal?.('top'), 80);
};

// Helper para o botão "EXCLUIR O.S." dentro do modal — pega o ID do dataset e chama excluirOSDef
window._excluirOSDoModal = async function() {
  const btn = document.getElementById('btnExcluirOS');
  const id = btn?.dataset?.osId;
  if (!id) return;
  if (typeof window.excluirOSDef === 'function') {
    const ok = await window.excluirOSDef(id);
    if (ok && typeof window.fecharModal === 'function') {
      window.fecharModal('modalOS');
    }
  }
};

window.adicionarItemOS = function(item = null) {
    const div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 60px 80px 80px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
        <input class="j-input os-item-desc" value="${item ? item.desc : ''}" placeholder="Descrição">
        <input type="number" class="j-input os-item-qtd" value="${item ? item.q : 1}" min="1" oninput="window.calcOSTotal()">
        <input type="number" class="j-input os-item-venda" value="${item ? (item.v || item.venda) : 0}" step="0.01" oninput="window.calcOSTotal()">
        <select class="j-select os-item-tipo" onchange="window.calcOSTotal()">
            <option value="peca" ${item && item.t === 'peca' ? 'selected' : ''}>Peça</option>
            <option value="servico" ${item && item.t === 'servico' ? 'selected' : ''}>M.O.</option>
        </select>
        <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    if($('containerItensOS')) $('containerItensOS').appendChild(div);
};

window.renderItensOS = function() {
    if (!$('containerItensOS')) return;
    $('containerItensOS').innerHTML = '';
    window.osPecas.forEach(p => window.adicionarItemOS(p));
    window.calcOSTotal();
};

window._osValorHoraCliente = function() {
  const dadosGov = typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const cliId = document.getElementById('osCliente')?.value;
  const cli = (window.J?.clientes || []).find(c => c.id === cliId) || null;
  return numBR(dadosGov?.valorHora || cli?.govValorHora || cli?.valorHora || window.J?.valorHoraMecanica || 0);
};

window._osVeiculoAtual = function() {
  const id = document.getElementById('osVeiculo')?.value;
  return (window.J?.veiculos || []).find(v => v.id === id) || {};
};

function placaFormatadaOS(placa) {
  const raw = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  return raw.length === 7 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

function identidadeVeiculoOS(os, veic) {
  const v = veic || {};
  const o = os || {};
  const placa = o.placa || v.placa || '';
  const prefixo = o.prefixo || o.prefixoVeiculo || v.prefixo || '';
  return {
    placa: placaFormatadaOS(placa),
    placaRaw: String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    prefixo: String(prefixo || '').toUpperCase().trim(),
    label: [prefixo, placaFormatadaOS(placa)].filter(Boolean).join(' / ')
  };
}

function modeloVeiculoOS(os, veic) {
  const v = veic || {};
  const o = os || {};
  const placaRaw = String(o.placa || v.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const candidatos = [
    v.modelo,
    v.nome,
    o.veiculoSnapshot?.modelo,
    o.veiculoModelo,
    o.modeloVeiculo,
    o.modelo,
    o.veiculoNome,
    o.veiculo
  ];
  for (const item of candidatos) {
    const txt = String(item || '').trim().replace(/\s+/g, ' ');
    if (!txt) continue;
    const norm = txt.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!norm || norm === placaRaw || norm === String(o.veiculoId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')) continue;
    if (/^(VEICULO|VEÍCULO|CARRO|MOTO|BICICLETA)$/i.test(txt)) continue;
    return txt;
  }
  return '';
}

window.atualizarIdentificacaoVeiculoOS = function(osFallback) {
  const veic = window._osVeiculoAtual?.() || {};
  const ident = identidadeVeiculoOS(osFallback || {}, veic);
  const placaEl = document.getElementById('osPlacaView');
  const prefixoEl = document.getElementById('osPrefixo');
  if (placaEl) placaEl.value = ident.placa || '';
  if (prefixoEl) prefixoEl.value = ident.prefixo || '';
  return ident;
};

function fmtHoraOS(value) {
  return numBR(value).toFixed(2).replace('.', ',');
}

window._osSecaoHoraOptions = function(selected) {
  const rates = OSU().getPMSPValoresHora?.() || [];
  const opts = ['<option value="">Sem selecao / manual</option>'];
  rates.forEach(rate => {
    opts.push(`<option value="${escOS(rate.key)}" ${rate.key === selected ? 'selected' : ''}>${escOS(rate.label)} - R$ ${fmtHoraOS(rate.valor)}/h</option>`);
  });
  return opts.join('');
};

window.aplicarSecaoMaoObraOS = function(row, key, options) {
  if (!row) return null;
  const opts = options || {};
  const select = row.querySelector('.serv-secao-hora');
  const horaInput = row.querySelector('.serv-valor-hora');
  const rate = key ? OSU().getPMSPValorHora?.(key) : null;

  if (select) select.value = rate ? rate.key : '';
  row.dataset.secaoHora = rate ? rate.key : '';
  row.dataset.secaoHoraLabel = rate ? rate.label : '';
  row.dataset.valorHoraSecao = rate ? String(rate.valor) : '';

  if (horaInput && opts.preserveValorHora !== true) {
    horaInput.value = rate ? fmtHoraOS(rate.valor) : '';
    row.dataset.valorHoraManual = rate ? '0' : '';
  }
  if (opts.recalcular !== false) window.atualizarValorServicoPorHora(row);
  return rate;
};

window.atualizarSecaoMaoObraOS = function(select) {
  const row = select?.closest('div');
  if (!row) return;
  window.aplicarSecaoMaoObraOS(row, select.value, { recalcular: true });
};

function descontoMaoObraAtualOS() {
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const campo = document.getElementById('osDescMO')?.value?.trim();
  return campo !== '' && campo != null ? taxaDescontoOS(campo) : taxaDescontoOS(dadosGov?.descMO || 0);
}

function descontoPecasAtualOS() {
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const campo = document.getElementById('osDescPeca')?.value?.trim();
  return campo !== '' && campo != null ? taxaDescontoOS(campo) : taxaDescontoOS(dadosGov?.descPeca || 0);
}

function dadosServicoLinhaOS(row) {
  const sel = row?.querySelector?.('.serv-secao-hora');
  const secaoHora = sel?.value || row?.dataset?.secaoHora || '';
  const secaoInfo = secaoHora ? OSU().getPMSPValorHora?.(secaoHora) : null;
  const valorHoraCampo = row?.querySelector?.('.serv-valor-hora')?.value;
  const sistemaSelect = sel?.options?.[sel.selectedIndex]?.text?.replace(/\s+-\s+R\$.*/, '') || '';
  const sistemaTabela = row?.dataset?.sistemaTabela || sistemaSelect || row?.dataset?.secaoHoraLabel || '';
  const tipoVeiculoTabela = row?.dataset?.tipoVeiculoTabela || extrairTipoVeiculoTempaOS({
    sistemaTabela,
    sistema: sistemaTabela,
    secaoHoraLabel: row?.dataset?.secaoHoraLabel
  }, window._osVeiculoAtual?.() || {});
  const terceirizado = lerTerceirizadoLinhaServicoOS(row);
  return {
    desc: row?.querySelector?.('.serv-desc')?.value || '',
    valor: numBR(row?.querySelector?.('.serv-valor')?.value || 0),
    tempo: numBR(row?.querySelector?.('.serv-tempo')?.value || 0),
    valorHora: numBR(valorHoraCampo || row?.dataset?.valorHoraSecao || secaoInfo?.valor || 0),
    valorHoraSecao: row?.dataset?.valorHoraSecao || secaoInfo?.valor || '',
    valorHoraTabela: secaoInfo ? numBR(secaoInfo.valor) : numBR(row?.dataset?.valorHoraSecao || 0),
    codigoInterno: row?.dataset?.codigoInterno || '',
    codigoTabela: row?.dataset?.codigoTabela || '',
    sistemaTabela,
    tipoVeiculoTabela,
    secaoHora,
    secaoHoraLabel: secaoInfo?.label || row?.dataset?.secaoHoraLabel || sistemaSelect || '',
    valorManual: row?.dataset?.valorManual === '1' ? '1' : '',
    valorHoraManual: row?.dataset?.valorHoraManual === '1' ? '1' : '',
    tempaManual: row?.dataset?.tempaManual === '1',
    mecId: row?.querySelector?.('.serv-mec')?.value || row?.dataset?.mecId || '',
    mecNome: row?.dataset?.mecNome || '',
    responsavelId: row?.querySelector?.('.serv-mec')?.value || row?.dataset?.mecId || '',
    responsavelNome: row?.dataset?.mecNome || '',
    relacionadoCilia: row?.dataset?.servRelacionado === '1',
    origemServico: row?.dataset?.servRelacionado === '1'
      ? ((row?.dataset?.codigoTabela || '') ? (row?.dataset?.tempaManual === '1' ? 'cilia_tabela_tempa_editado' : 'cilia_tabela_tempa') : 'cilia_manual')
      : ((row?.dataset?.codigoTabela || row?.dataset?.codigoInterno || row?.dataset?.secaoHora) ? 'tabela_tempa' : 'manual'),
    ciliaPieceIndex: row?.closest?.('.cilia-peca-wrap')?.dataset?.ciliaPieceIndex || row?.dataset?.ciliaPieceIndex || '',
    tipoExecucao: terceirizado.tipoExecucao,
    terceirizadoId: terceirizado.terceirizadoId,
    terceirizadoNome: terceirizado.terceirizadoNome,
    terceirizadoOrigem: terceirizado.terceirizadoOrigem,
    terceirizadoPedidoFornecedor: terceirizado.terceirizadoPedidoFornecedor,
    terceirizadoDocumento: terceirizado.terceirizadoDocumento,
    terceirizadoData: terceirizado.terceirizadoData,
    terceirizadoValor: terceirizado.terceirizadoValor
  };
}

function calcularServicoLinhaOS(row, descMO) {
  const dados = dadosServicoLinhaOS(row);
  const descGeral = taxaDescontoOS(descMO || 0);
  const descontoIndividualValor = descontoIndividualLinhaOS(row, 'servico');
  dados.descontoIndividualTipo = 'valor';
  dados.descontoIndividualValor = descontoIndividualValor;
  dados.descIndividualValor = descontoIndividualValor;
  const calc = OSU().calcularServicoMaoObra
    ? OSU().calcularServicoMaoObra(dados, null, {
        descMO: descGeral,
        veiculo: window._osVeiculoAtual?.(),
        fallbackValorHora: window._osValorHoraCliente?.(),
        usarHoraQuandoDisponivel: true
      })
    : Object.assign({
        tempo: dados.tempo,
        valorHora: dados.valorHora,
        valorHoraTabela: dados.valorHoraTabela,
        usaCalculoHora: false
      }, calcularDescontosValorOS(dados.valor, descGeral, descontoIndividualValor));
  const valorInput = row?.querySelector?.('.serv-valor');
  if (valorInput && calc.usaCalculoHora && document.activeElement !== valorInput) {
    valorInput.value = calc.valorBruto.toFixed(2).replace('.', ',');
  }
  return Object.assign(dados, calc, {
    descGeralPct: descGeral,
    descontoIndividualTipo: 'valor',
    descontoIndividualValor: numBR(calc.descontoIndividualValor ?? descontoIndividualValor),
    descIndividualValor: numBR(calc.descontoIndividualValor ?? descontoIndividualValor),
    descIndividualPct: numBR(calc.valorBruto || calc.bruto || 0) > 0 ? +(numBR(calc.descontoIndividualValor ?? descontoIndividualValor) / numBR(calc.valorBruto || calc.bruto || 0)).toFixed(6) : 0,
    descontoValor: numBR(calc.descontoValor ?? (numBR(calc.valorBruto || calc.bruto || 0) - numBR(calc.valorFinal || 0))),
    descPct: numBR(calc.descPct || 0)
  });
}

window.atualizarValorServicoPorHora = function(row) {
  if (!row) return;
  calcularServicoLinhaOS(row, descontoMaoObraAtualOS());
  window.calcOSTotal?.();
};

// Snapshot exclusivamente para exportação: lê os valores que estão na O.S. aberta
// sem salvar, sem disparar financeiro/comissão/estoque e sem alterar o estado do formulário.
window.obterSnapshotOSExportacaoAtual = function(osBase) {
  if (!osBase || !document.getElementById('containerServicosOS')) return osBase;
  const idAberto = String(document.getElementById('osId')?.value || '');
  if (!idAberto || idAberto !== String(osBase.id || '')) return osBase;

  const snapshot = { ...osBase };
  snapshot.modeloOS = document.getElementById('osModeloOS')?.value || osBase.modeloOS || '';
  snapshot.oesModelo = snapshot.modeloOS;
  snapshot.cabecalhoOS = document.getElementById('osCabecalhoOS')?.value || osBase.cabecalhoOS || '';
  snapshot.govCabecalhoOS = snapshot.cabecalhoOS;
  snapshot.valorHoraOS = numBR(document.getElementById('osValorHoraOS')?.value || osBase.valorHoraOS || osBase.govValorHoraOS || 0);
  snapshot.govValorHoraOS = snapshot.valorHoraOS;
  snapshot.descMO = descontoMaoObraAtualOS();
  snapshot.descPeca = descontoPecasAtualOS();

  const anteriores = Array.isArray(osBase.servicos) ? osBase.servicos : [];
  const linhas = [
    ...document.querySelectorAll('#containerServicosOS > div'),
    ...document.querySelectorAll('#containerPecasOS .cilia-serv-relac')
  ];
  const atuais = [];

  linhas.forEach((row, index) => {
    const dadosAtuais = dadosServicoLinhaOS(row);
    const desc = String(dadosAtuais.desc || '').trim();
    const valorBruto = numBR(dadosAtuais.valor || 0);
    const tempo = numBR(dadosAtuais.tempo || 0);
    const descontoIndividual = clienteGovernamentalAtualOS() ? 0 : descontoIndividualLinhaOS(row, 'servico');
    const calc = calcularDescontosValorOS(valorBruto, snapshot.descMO, descontoIndividual);
    const valorFinal = numBR(calc.valorFinal || 0);
    if (!desc && valorBruto <= 0 && valorFinal <= 0 && tempo <= 0) return;

    const anterior = anteriores[index] && typeof anteriores[index] === 'object' ? anteriores[index] : {};
    const valorManual = row.dataset?.valorManual === '1';
    const valorHoraManual = row.dataset?.valorHoraManual === '1';
    atuais.push({
      ...anterior,
      ...dadosAtuais,
      desc,
      valor: valorBruto,
      valorBruto,
      bruto: valorBruto,
      valorFinal,
      total: valorFinal,
      valorManual,
      valorHoraManual,
      valorHora: numBR(dadosAtuais.valorHora || 0),
      valorHoraTabela: numBR(dadosAtuais.valorHoraTabela || 0),
      descGeralPct: numBR(snapshot.descMO || 0),
      descontoGeralValor: numBR(calc.descontoGeralValor || Math.max(0, valorBruto * snapshot.descMO)),
      descontoIndividualTipo: 'valor',
      descontoIndividualValor: clienteGovernamentalAtualOS() ? 0 : numBR(calc.descontoIndividualValor || 0),
      descIndividualValor: clienteGovernamentalAtualOS() ? 0 : numBR(calc.descontoIndividualValor || 0),
      descontoIndividual: clienteGovernamentalAtualOS() ? 0 : numBR(calc.descontoIndividualValor || 0),
      descIndividualPct: clienteGovernamentalAtualOS() ? 0 : (valorBruto > 0 ? +(numBR(calc.descontoIndividualValor || 0) / valorBruto).toFixed(6) : 0),
      descontoValor: numBR(calc.descontoValor || Math.max(0, valorBruto - valorFinal)),
      descPct: numBR(calc.descPct || (valorBruto > 0 ? (valorBruto - valorFinal) / valorBruto : 0)),
      relacionadoCilia: row.dataset?.servRelacionado === '1',
      ciliaPieceIndex: row.closest?.('.cilia-peca-wrap')?.dataset?.ciliaPieceIndex || row.dataset?.ciliaPieceIndex || '',
      pecaCodigo: row.dataset?.pecaCodigo || anterior.pecaCodigo || anterior.codigoPeca || '',
      pecaDesc: row.dataset?.pecaDesc || anterior.pecaDesc || anterior.descricaoPeca || ''
    });
  });

  snapshot.servicos = atuais;
  return snapshot;
};

window.adicionarServicoOS = function(options = {}) {
  const sel = document.createElement('div');
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descMO = dadosGov ? taxaDescontoOS(dadosGov.descMO || 0) : 0;
  if (ehGov) {
    sel.style.cssText = 'display:grid;grid-template-columns:minmax(150px,0.9fr) minmax(210px,1.4fr) 70px 90px 110px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    sel.innerHTML = `
      <select class="j-select serv-secao-hora" onchange="window.atualizarSecaoMaoObraOS(this)" title="Secao oficial da mao de obra PMSP. Use Sem selecao/manual quando nao houver correspondencia segura.">${window._osSecaoHoraOptions('')}</select>
      <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor-hora" value="" placeholder="R$/h" oninput="this.closest('div').dataset.valorHoraManual='1';window.atualizarValorServicoPorHora(this.closest('div'))" title="Valor da hora trabalhada desta seção. Vem da tabela oficial quando selecionada, mas é editável pelo admin." style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--cyan);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="0,00" placeholder="Total serv." oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto total do serviço. Calculado por TMO x valor/hora quando não estiver manual.">
      <div class="serv-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="serv-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descMO*100).toFixed(0)}%</div>
        <div class="serv-desc-val">R$ 0,00</div>
      </div>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    sel.style.cssText = 'display:grid;grid-template-columns:1fr 70px 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    sel.innerHTML = `
      <input type="text" class="j-input serv-desc" placeholder="Ex: Alinhamento, Troca de Freio..." oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="0,00" placeholder="R$ 0,00" oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto do serviço. Editável pelo admin.">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerServicosOS')) $('containerServicosOS').appendChild(sel);
  instalarDescontoIndividualLinhaOS(sel, 'servico', 0);
  window.garantirResponsavelLinhaServicoOS?.(sel, '');
  instalarTerceirizadoLinhaServicoOS(sel, { tipoExecucao: 'interna' });
  window.calcOSTotal?.();
  if (options.focus !== false) focarLinhaNovaOS(sel, '.serv-desc');
  return sel;
};

window.renderServicoOSRow = function(s) {
  const div = document.createElement('div');
  div.dataset.mecId = s.mecId || s.mecanicoId || s.responsavelId || '';
  div.dataset.mecNome = s.mecNome || s.mecanicoNome || s.responsavelNome || '';
  div._rateiosComissaoInicial = Array.isArray(s.rateiosComissao) ? s.rateiosComissao : [];
  div.dataset.codigoInterno = s.codigoInterno || s.codInterno || s.codigoServicoInterno || '';
  div.dataset.codigoTabela = s.codigoTabela || s.codigo || '';
  div.dataset.sistemaTabela = s.sistemaTabela || s.sistema || '';
  div.dataset.tipoVeiculoTabela = s.tipoVeiculoTabela || s.tipoVeiculoTempa || s.tipoVeiculo || extrairTipoVeiculoTempaOS(s, window._osVeiculoAtual?.() || {});
  div.dataset.tempoTabela = s.tempoTabela || s.tempo || '';
  div.dataset.valorManual = s.valorManual === true || s.valorManual === '1' ? '1' : '';
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descMO = dadosGov ? taxaDescontoOS(dadosGov.descMO || 0) : 0;
  const calcRender = OSU().calcularServicoMaoObra
    ? OSU().calcularServicoMaoObra(s, null, {
        descMO,
        veiculo: window._osVeiculoAtual?.(),
        fallbackValorHora: window._osValorHoraCliente?.(),
        usarHoraQuandoDisponivel: true
      })
    : {
        tempo: numBR(s.tempo || 0),
        valorHora: numBR(s.valorHora || s.valorHoraSecao || 0),
        valorBruto: numBR(s.valor || 0),
        valorFinal: +(numBR(s.valor || 0) * (1 - descMO)).toFixed(2)
      };
  const vBruto = numBR(calcRender.valorBruto || calcRender.bruto || 0);
  const vFinal = numBR(calcRender.valorFinal || 0);
  if (ehGov) {
    const resolvido = OSU().resolvePMSPServico?.(s, { veiculo: window._osVeiculoAtual?.(), fallbackValorHora: window._osValorHoraCliente?.() }) || {};
    const secaoKey = s.secaoHora || resolvido.secaoHora || '';
    const valorHora = numBR(calcRender.valorHora || s.valorHora || s.valorHoraSecao || resolvido.valorHora || 0);
    div.dataset.secaoHora = secaoKey;
    div.dataset.secaoHoraLabel = s.secaoHoraLabel || resolvido.secaoHoraLabel || '';
    div.dataset.valorHoraSecao = s.valorHoraTabela || resolvido.valorHoraTabela || '';
    div.dataset.valorHoraManual = s.valorHoraManual ? '1' : '';
    div.style.cssText = 'display:grid;grid-template-columns:minmax(150px,0.9fr) minmax(210px,1.4fr) 70px 90px 110px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
      <select class="j-select serv-secao-hora" onchange="window.atualizarSecaoMaoObraOS(this)" title="Secao oficial da mao de obra PMSP. Use Sem selecao/manual quando nao houver correspondencia segura.">${window._osSecaoHoraOptions(secaoKey)}</select>
      <input type="text" class="j-input serv-desc" value="${escOS(s.desc || '')}" placeholder="Descrição do Serviço" oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" value="${String(s.tempo || '').replace('.', ',')}" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor-hora" value="${valorHora ? valorHora.toFixed(2).replace('.', ',') : ''}" placeholder="R$/h" oninput="this.closest('div').dataset.valorHoraManual='1';window.atualizarValorServicoPorHora(this.closest('div'))" title="Valor da hora trabalhada desta seção. Vem da tabela oficial quando selecionada, mas é editável pelo admin." style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--cyan);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Total serv." oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto total do serviço. Calculado por TMO x valor/hora quando não estiver manual.">
      <div class="serv-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="serv-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descMO*100).toFixed(0)}%</div>
        <div class="serv-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    div.style.cssText = 'display:grid;grid-template-columns:1fr 70px 100px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
      <input type="text" class="j-input serv-desc" value="${escOS(s.desc || '')}" placeholder="Descrição do Serviço" oninput="window.calcOSTotal()">
      <input type="text" inputmode="decimal" class="j-input serv-tempo" value="${String(s.tempo || '').replace('.', ',')}" placeholder="TMO h" title="Tempo de Mão de Obra (horas)" oninput="window.atualizarValorServicoPorHora(this.closest('div'))" style="text-align:center;font-family:var(--fm);font-size:0.78rem;color:var(--warn);">
      <input type="text" inputmode="decimal" class="j-input serv-valor" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="R$ 0,00" oninput="this.closest('div').dataset.valorManual='1';window.calcOSTotal()" title="Valor bruto do serviço. Editável pelo admin.">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  }
  if($('containerServicosOS')) $('containerServicosOS').appendChild(div);
  instalarDescontoIndividualLinhaOS(div, 'servico', descontoIndividualSalvoValorOS(s, vBruto));
  window.garantirResponsavelLinhaServicoOS?.(div, div.dataset.mecId || '');
  instalarTerceirizadoLinhaServicoOS(div, s || {});
  atualizarMetaServicoLinhaOS(div);
};

window.adicionarPecaOS = function(options = {}) {
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const existeFluxoAgrupado = !!document.querySelector('#containerPecasOS .cilia-peca-wrap');
  if (existeFluxoAgrupado && options.auto === true) return null;
  if (existeFluxoAgrupado && typeof window.renderCiliaPecaOSRow === 'function') {
    const idx = document.querySelectorAll('#containerPecasOS [data-cilia-piece-index]').length;
    window.renderCiliaPecaOSRow({
      codigo: '',
      desc: '',
      qtd: 1,
      venda: 0,
      ciliaPieceIndex: idx,
      ciliaGrupo: 'OUTROS',
      ciliaGrupoOrdem: 900,
      ciliaAgrupador: 'manual',
      ciliaPosicaoOrdem: 9000,
      ciliaManual: true
    }, []);
    window.toast?.('Peca manual criada com grupo editavel e servicos vinculados.', 'ok');
    return document.querySelector('#containerPecasOS [data-cilia-piece-index]:last-of-type') || null;
  }
  const sel = document.createElement('div');

  if (ehGov) {
    // Cliente governamental — peça AVULSA com badge de desconto
    const dadosGovP = typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
    const descPecaP = dadosGovP ? taxaDescontoOS(dadosGovP.descPeca || 0) : 0;
    const colsGov = descPecaP > 0
      ? '120px 1fr 60px 100px 80px 32px'
      : '120px 1fr 60px 100px 32px';
    sel.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;background:rgba(167,139,250,0.06);padding:8px;border-radius:3px;border:1px solid rgba(167,139,250,0.2);`;
    sel.dataset.pecaAvulsa = '1';
    const badgePeca = descPecaP > 0 ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="peca-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPecaP*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ 0,00</div>
      </div>` : '';
    sel.innerHTML = `
      <input type="text" class="j-input peca-codigo" placeholder="Código original" title="Código original do fabricante (ex: 5207381)" style="font-family:var(--fm);font-size:0.78rem;">
      <input type="text" class="j-input peca-desc-livre" placeholder="Descrição da peça (ex: AMORTECEDOR DIANT. DIREITO)" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Valor unit. registrado" oninput="window.calcOSTotal()" title="Valor unitário da ata de registro de preço">
      ${badgePeca}
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else {
    // Cliente normal — usa estoque, mas permite peça avulsa se não tiver no estoque
    sel.style.cssText = 'display:grid;grid-template-columns:minmax(190px,.85fr) minmax(90px,.28fr) minmax(280px,1.25fr) 58px 82px 82px 150px 32px;gap:7px;align-items:center;background:rgba(34,197,94,0.04);padding:6px;border-radius:3px;border:1px solid rgba(34,197,94,0.14);';
    const optsCompleto = optionsPecasEstoqueFiltradasOS('', '', false);
    sel.innerHTML = `
      <input type="search" class="j-input peca-busca-estoque" placeholder="Buscar peça cadastrada por código, descrição, fornecedor ou NF..." oninput="window.filtrarPecasOS(this)" onkeydown="window.selecionarPrimeiraPecaFiltradaOS(this,event)" style="grid-column:1/-1;font-family:var(--fm);font-size:.72rem;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.22);" autocomplete="off">
      <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${optsCompleto}</select>
      <input type="text" class="j-input peca-codigo" placeholder="Código O.S." oninput="window.calcOSTotal()" title="Código exibido para o cliente na O.S.">
      <input type="text" class="j-input peca-desc-livre" placeholder="Descrição na O.S." oninput="window.calcOSTotal()" title="Descrição exibida para o cliente na O.S.">
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="0,00" placeholder="Custo" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Venda" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <label style="display:flex;align-items:center;gap:5px;font-family:var(--fm);font-size:.58rem;color:var(--ok);line-height:1.15;"><input type="checkbox" class="peca-baixa-real" checked style="width:auto;min-height:0;"> peça real</label>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
      <div class="peca-estoque-info" style="grid-column:1/-1;font-family:var(--fm);font-size:.62rem;color:var(--muted);line-height:1.45;"></div>
    `;
  }
  if($('containerPecasOS')) $('containerPecasOS').appendChild(sel);
  instalarDescontoIndividualLinhaOS(sel, 'peca', 0);
  window.calcOSTotal();
  if (options.focus !== false) focarLinhaNovaOS(sel, '.peca-busca-estoque, .peca-desc-livre, .peca-codigo');
  return sel;
};


function osTextoNormalizadoCliente(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function osClienteOficialSeguroOS(os) {
  const o = os || {};
  const cli = (window.J?.clientes || []).find(c => String(c.id) === String(o.clienteId || o.cliente || '')) ||
    (window.J?.clientes || []).find(c => osTextoNormalizadoCliente(c.nome) === osTextoNormalizadoCliente(o.cliente || o.clienteNome));
  const nome = osTextoNormalizadoCliente(cli?.nome || o.clienteNome || o.cliente || '');
  if (!nome || nome === 'CONSUMIDOR') return false;
  const tipoCliente = String(cli?.tipoCliente || o.tipoCliente || o.clienteTipo || '').toLowerCase();
  if (tipoCliente === 'governo' || tipoCliente === 'oficial') return true;
  const indicadores = [
    nome,
    cli?.clienteOficial === true ? 'OFICIAL' : '',
    cli?.orgaoPublico === true ? 'ORGAO PUBLICO' : '',
    cli?.publico === true ? 'PUBLICO' : '',
    cli?.gov === true ? 'GOVERNO' : '',
    cli?.tipoCliente,
    cli?.govUnidade,
    o.clienteOficial === true ? 'OFICIAL' : '',
    o.orgaoPublico === true ? 'ORGAO PUBLICO' : '',
    o.gov === true ? 'GOVERNO' : '',
    o.tipoCliente,
    o.clienteTipo,
    o.fiscalContrato,
    o.contrato,
    o.orgao,
    o.unidade
  ].filter(Boolean).join('|').toUpperCase();
  return /OFICIAL|GOVERNO|PMSP|POLICIA|POLÍCIA|MILITAR|BPM|PREFEITURA|ESTADO|MUNICIP|SECRETARIA|ORGAO PUBLICO/.test(indicadores);
}

function osSegredo177AtivoOS() {
  return window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
}

function osPecaRealProtegidaOS(peca) {
  if (!peca || typeof peca !== 'object') return false;
  if (typeof OSU().isProtectedRealPart === 'function') return OSU().isProtectedRealPart(peca);
  const origem = String(peca.origem || '').toLowerCase().trim();
  const status = String(peca.statusAplicacao || '').toLowerCase().trim();
  const chaveNF = String(peca.origemNFItemKey || '').trim();
  const referenciaNF = String(peca.nfId || peca.nf || peca.nfNumero || peca.numeroNF || '').trim();
  return peca.origemNFVinculada === true ||
    origem === 'nf_entrada_os' ||
    origem === 'nf_entrada' ||
    status === 'comprada_vinculada_nf' ||
    (!!chaveNF && (!!referenciaNF || origem.includes('nf_entrada')));
}

function osPecaRealProtegidaNoContextoOS(os, peca) {
  if (!peca || typeof peca !== 'object') return false;
  if (typeof OSU().isBudgetPieceLinkedToRealPart === 'function') {
    return OSU().isBudgetPieceLinkedToRealPart(os || {}, peca);
  }
  return osPecaRealProtegidaOS(peca);
}

function osLinhaPecaRealProtegidaOS(row, os) {
  if (!row) return false;
  const peca = {
    origem: row.dataset?.origemPecaOS || '',
    origemNFVinculada: row.dataset?.origemNFVinculada === '1',
    origemNFItemKey: row.dataset?.origemNFItemKey || '',
    nfId: row.dataset?.pecaNfId || '',
    nf: row.dataset?.pecaNf || '',
    codigo: row.querySelector?.('.peca-codigo')?.value?.trim() || row.dataset?.pecaCodigo || '',
    desc: row.querySelector?.('.peca-desc-livre')?.value?.trim() || row.dataset?.pecaDesc || '',
    qtd: numBR(row.querySelector?.('.peca-qtd')?.value || 1) || 1,
    custo: numBR(row.querySelector?.('.peca-custo')?.value || 0),
    venda: numBR(row.querySelector?.('.peca-venda')?.value || 0)
  };
  return osPecaRealProtegidaNoContextoOS(os || {}, peca);
}

function osContextoClienteAtualOS(base) {
  const clienteId = document.getElementById('osCliente')?.value || base?.clienteId || '';
  const cliente = (window.J?.clientes || []).find(c => String(c.id) === String(clienteId)) || {};
  return Object.assign({}, base || {}, {
    clienteId,
    clienteNome: cliente.nome || cliente.razaoSocial || cliente.govUnidade || base?.clienteNome || base?.cliente || '',
    cliente: cliente.nome || base?.cliente || '',
    tipoCliente: cliente.tipoCliente || base?.tipoCliente || base?.clienteTipo || '',
    clienteOficial: cliente.clienteOficial ?? base?.clienteOficial,
    orgaoPublico: cliente.orgaoPublico ?? base?.orgaoPublico,
    gov: cliente.gov ?? base?.gov
  });
}

function osPecasOrcamentoVisiveisOS(os, pecas) {
  const lista = Array.isArray(pecas) ? pecas : [];
  if (!osClienteOficialSeguroOS(os)) return lista.slice();
  const contexto = Object.assign({}, os || {}, { pecas: lista });
  return lista.filter(peca => !osPecaRealProtegidaNoContextoOS(contexto, peca));
}

function osMesclarPecasProtegidasClienteOficialOS(osAnterior, contextoAtual, pecasEditadas) {
  const visiveis = Array.isArray(pecasEditadas) ? pecasEditadas.slice() : [];
  const contexto = Object.assign({}, osAnterior || {}, contextoAtual || {}, { pecas: visiveis });
  if (!osClienteOficialSeguroOS(contexto)) return visiveis;
  // Os registros internos permanecem integralmente em pecasReais. Aqui, no campo
  // público pecas, removemos inclusive duplicatas antigas que perderam os metadados
  // de NF ao serem salvas como peça avulsa depois da troca de cliente/placa.
  return osPecasOrcamentoVisiveisOS(contexto, visiveis);
}

function osEventoPecaRealProtegidoOS(evento) {
  if (!evento || typeof evento !== 'object') return false;
  const tipo = String(evento.tipo || evento.modulo || '').toLowerCase();
  if (['nf_peca_real','edicao_nf_peca_real','devolucao_nf_peca_real','vinculo_nf_peca_real_os'].includes(tipo)) return true;
  const texto = String(evento.acao || evento.descricao || evento.mensagem || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /peca real|pecas reais|vinculad[ao] por nf|nf.*peca.*real|peca.*nf.*vinculad/.test(texto);
}

window.thiaPecaRealProtegidaOS = osPecaRealProtegidaOS;
window.thiaPecaRealProtegidaNoContextoOS = osPecaRealProtegidaNoContextoOS;
window.thiaClienteOficialSeguroOS = osClienteOficialSeguroOS;
window.thiaSegredo177AtivoOS = osSegredo177AtivoOS;
window.thiaEventoPecaRealProtegidoOS = osEventoPecaRealProtegidoOS;

function osChavePecaAtendimentoOS(p) {
  if (!p) return '';
  const principais = [
    p.origemNFItemKey,
    p.idReal,
    p.pecaRealId,
    p.nfId && (p.numeroItem || p.codigo || p.codigoComercial || p.codigoFornecedor || p.desc || p.descricao)
      ? [p.nfId, p.numeroItem || '', p.codigo || p.codigoComercial || p.codigoFornecedor || '', p.desc || p.descricao || ''].join('|')
      : '',
    [p.nf || p.nfNumero || '', p.codigo || p.codigoComercial || p.codigoFornecedor || p.oem || '', p.desc || p.descricao || ''].join('|')
  ].filter(Boolean);
  return osTextoNormalizadoCliente(principais[0] || principais.join('|'));
}


function osArrayPecasOcultasNaOS(o) {
  const origem = o || {};
  const listas = [
    origem.pecasReaisOcultasNaOS,
    origem.pecasNFRemovidasDaOS,
    origem.pecasOcultasNaOS,
    origem.pecasOSOcultas
  ];
  const out = [];
  listas.forEach(lista => {
    if (Array.isArray(lista)) lista.forEach(v => {
      const k = osTextoNormalizadoCliente(typeof v === 'string' ? v : (v?.key || v?.chave || v?.origemNFItemKey || v?.nfItemKey || ''));
      if (k && !out.includes(k)) out.push(k);
    });
  });
  return out;
}

function osPecaNFKeyOcultaNaOS(p, o) {
  const key = osTextoNormalizadoCliente(osChavePecaAtendimentoOS(p));
  if (!key) return false;
  return osArrayPecasOcultasNaOS(o).includes(key);
}

function osAtualizarOcultasPecasNFRemovidasOS(oldOS, pecasVisiveisAtuais) {
  const antigo = oldOS || {};
  const visiveisAtuais = Array.isArray(pecasVisiveisAtuais) ? pecasVisiveisAtuais : [];
  const ocultas = new Set(osArrayPecasOcultasNaOS(antigo));
  const antigasVisiveis = Array.isArray(antigo.pecas) ? antigo.pecas : [];
  antigasVisiveis.forEach(p => {
    const origemNF = p && (p.origem === 'nf_entrada_os' || p.origem === 'nf_entrada' || p.origemNFVinculada === true || p.nfId || p.origemNFItemKey);
    if (!origemNF) return;
    const key = osTextoNormalizadoCliente(osChavePecaAtendimentoOS(p));
    if (!key) return;
    if (!osPecaRealTemCorrespondenteVisivelOS(p, visiveisAtuais)) ocultas.add(key);
  });
  visiveisAtuais.forEach(p => {
    const origemNF = p && (p.origem === 'nf_entrada_os' || p.origem === 'nf_entrada' || p.origemNFVinculada === true || p.nfId || p.origemNFItemKey);
    if (!origemNF) return;
    const key = osTextoNormalizadoCliente(osChavePecaAtendimentoOS(p));
    if (key) ocultas.delete(key);
  });
  return Array.from(ocultas).filter(Boolean);
}

function osPecaRealTemCorrespondenteVisivelOS(real, visiveis) {
  const cr = osChavePecaAtendimentoOS(real);
  const codigos = [real?.codigo, real?.codigoComercial, real?.codigoFornecedor, real?.oem].filter(Boolean).map(osTextoNormalizadoCliente);
  const nf = osTextoNormalizadoCliente(real?.nf || real?.nfNumero || real?.numeroNF);
  const descReal = osTextoNormalizadoCliente(real?.desc || real?.descricao);
  return (Array.isArray(visiveis) ? visiveis : []).some(v => {
    if (!v) return false;
    const cv = osChavePecaAtendimentoOS(v);
    if (cr && cv && (cv === cr || cv.includes(cr.slice(0, 18)) || cr.includes(cv.slice(0, 18)))) return true;
    const rawVis = osTextoNormalizadoCliente([v.origemNFItemKey, v.nfId, v.nf, v.nfNumero, v.codigo, v.codigoComercial, v.codigoFornecedor, v.oem, v.desc, v.descricao, v.codigoExibicao, v.descricaoExibicao].filter(Boolean).join('|'));
    if (codigos.some(c => c && rawVis.includes(c))) return true;
    if (nf && rawVis.includes(nf)) return true;
    const descVis = osTextoNormalizadoCliente(v.desc || v.descricao || v.descricaoExibicao);
    return !!(descReal && descVis && descReal.length > 10 && descVis.length > 10 && (descReal.includes(descVis.slice(0, 14)) || descVis.includes(descReal.slice(0, 14))));
  });
}

function osVendaNFParaPecaRealOS(real) {
  const nfId = String(real?.nfId || '').trim();
  const nfNumero = String(real?.nf || real?.nfNumero || real?.numeroNF || '').trim();
  const codigo = osTextoNormalizadoCliente(real?.codigo || real?.codigoComercial || real?.codigoFornecedor || real?.oem);
  const desc = osTextoNormalizadoCliente(real?.desc || real?.descricao);
  const notas = Array.isArray(window.J?.notasFiscaisEntrada) ? window.J.notasFiscaisEntrada : [];
  for (const nf of notas) {
    if (nfId && String(nf.id || '') !== nfId) continue;
    if (!nfId && nfNumero && String(nf.numero || nf.nf || nf.numeroNF || '') !== nfNumero) continue;
    const itens = Array.isArray(nf.itens) ? nf.itens : Array.isArray(nf.produtos) ? nf.produtos : Array.isArray(nf.pecas) ? nf.pecas : [];
    for (const item of itens) {
      const raw = osTextoNormalizadoCliente([item.codigo, item.codigoComercial, item.codigoFornecedor, item.oem, item.desc, item.descricao].filter(Boolean).join('|'));
      if ((codigo && raw.includes(codigo)) || (desc && raw.includes(desc.slice(0, 16)))) {
        const venda = numBR(item.venda || item.valorVenda || item.precoVenda || 0);
        if (venda > 0) return venda;
      }
    }
  }
  const vendaReal = numBR(real?.venda || real?.valorVenda || real?.precoVenda || 0);
  if (vendaReal > 0) return vendaReal;
  return numBR(real?.valorCompra || real?.custo || real?.valorUnitarioFiscal || 0);
}

function osPecaVisivelFromRealOS(real) {
  const desc = real?.desc || real?.descricao || '';
  const codigo = real?.codigoComercial || real?.codigoFornecedor || real?.codigo || real?.oem || '';
  if (!desc && !codigo) return null;
  return {
    origem: 'nf_entrada_os',
    origemNFVinculada: true,
    origemNFItemKey: real?.origemNFItemKey || '',
    pecaRealId: real?.origemNFItemKey || '',
    nfId: real?.nfId || '',
    nf: real?.nf || real?.nfNumero || '',
    nfNumero: real?.nfNumero || real?.nf || '',
    estoqueId: '',
    codigo,
    codigoExibicao: codigo,
    desc,
    descricao: desc,
    descricaoExibicao: desc,
    qtd: numBR(real?.qtd || real?.quantidadeOperacionalTotal || real?.quantidadeFiscal || 1) || 1,
    custo: numBR(real?.valorCompra || real?.custo || real?.valorUnitarioFiscal || 0),
    venda: osVendaNFParaPecaRealOS(real),
    baixarEstoqueReal: false,
    estoqueBaixadoAutomatico: true,
    fornecedor: real?.fornecedor || real?.fornecedorNome || '',
    dataCompra: real?.dataCompra || real?.dataNF || '',
    codigoFornecedor: real?.codigoFornecedor || '',
    codigoComercial: real?.codigoComercial || '',
    marca: real?.marca || ''
  };
}

function osReconciliarPecasReaisParaClienteComumOS(os, pecasAtuais, pecasReaisAtuais) {
  const o = os || {};
  const visiveis = Array.isArray(pecasAtuais) ? pecasAtuais.slice() : [];
  const reais = Array.isArray(pecasReaisAtuais) ? pecasReaisAtuais : (Array.isArray(o.pecasReais) ? o.pecasReais : []);
  if (osClienteOficialSeguroOS(o)) return visiveis;
  reais.forEach(real => {
    const origemNF = real && (real.origem === 'nf_entrada' || real.statusAplicacao === 'comprada_vinculada_nf' || real.nfId || real.origemNFItemKey);
    if (!origemNF) return;
    if (osPecaNFKeyOcultaNaOS(real, o)) return;
    if (osPecaRealTemCorrespondenteVisivelOS(real, visiveis)) return;
    const nova = osPecaVisivelFromRealOS(real);
    if (nova) visiveis.push(nova);
  });
  return visiveis;
}

function osAplicarLayoutPecaClienteNormalOS(row) {
  if (!row || row.dataset.layoutPecaClienteNormal === '1') return;
  row.dataset.layoutPecaClienteNormal = '1';
  row.style.cssText = 'display:grid;grid-template-columns:minmax(190px,.85fr) minmax(90px,.28fr) minmax(280px,1.25fr) 58px 82px 82px 150px 32px;gap:7px;align-items:center;background:rgba(34,197,94,0.04);padding:6px;border-radius:3px;border:1px solid rgba(34,197,94,0.14);';
  const info = row.querySelector('.peca-estoque-info');
  if (info) info.style.gridColumn = '1/-1';
}

window.renderPecaOSRow = function(p) {
  const div = document.createElement('div');
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descPeca = dadosGov ? taxaDescontoOS(dadosGov.descPeca || 0) : 0;
  const pecaManualSalva = p?.avulsa === true || (!p?.estoqueId && (p?.desc || p?.codigo));

  if (ehGov && p.codigo !== undefined) {
    // Peça avulsa (governo) — mostra código + desc + qtd + valor + badge desconto
    const vBruto = numBR(p.venda || p.v || 0);
    const qtd = numBR(p.qtd || p.q || 1) || 1;
    const vFinal = +((qtd * vBruto) * (1 - descPeca)).toFixed(2);
    const colsGov = descPeca > 0 ? '120px 1fr 60px 100px 80px 32px' : '120px 1fr 60px 100px 32px';
    div.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;background:rgba(167,139,250,0.06);padding:8px;border-radius:3px;border:1px solid rgba(167,139,250,0.2);`;
    div.dataset.pecaAvulsa = '1';
    const badgePeca = descPeca > 0 ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="peca-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPeca*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>` : '';
    div.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${escOS(p.codigo || '')}" placeholder="Código original" style="font-family:var(--fm);font-size:0.78rem;" title="Código original/OEM da peça">
      <input type="text" class="j-input peca-desc-livre" value="${escOS(p.desc || '')}" placeholder="Descrição da peça" oninput="window.calcOSTotal()" title="Descrição da peça no orçamento">
      <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Valor unit. registrado" oninput="window.calcOSTotal()" title="Valor unitário da peça no orçamento">
      ${badgePeca}
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
  } else if (pecaManualSalva) {
    // Peça manual de cliente normal precisa reabrir como manual; se reabrir como
    // select de estoque, a próxima mudança de status regrava a O.S. sem descrição.
    const vBruto = numBR(p.venda || p.v || 0);
    const custo = numBR(p.custo || p.c || 0);
    const qtd = numBR(p.qtd || p.q || 1) || 1;
    div.dataset.pecaAvulsa = '1';
    div.dataset.pecaNf = p.nf || p.nfNumero || '';
    div.dataset.pecaNfId = p.nfId || '';
    div.dataset.origemNFItemKey = p.origemNFItemKey || '';
    div.dataset.origemNFVinculada = p.origemNFVinculada ? '1' : '';
    div.dataset.origemPecaOS = p.origem || '';
    div.style.cssText = 'display:grid;grid-template-columns:minmax(100px,.32fr) minmax(320px,1.4fr) 58px 82px 82px 32px;gap:7px;align-items:center;background:rgba(255,165,0,0.06);padding:6px;border-radius:3px;border:1px solid rgba(255,165,0,0.25);';
    div.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${escOS(p.codigoExibicao || p.codigo || '')}" placeholder="Código na O.S." oninput="window.calcOSTotal()" title="Código exibido na O.S. Pode ser abreviado sem alterar a peça real.">
      <input type="text" class="j-input peca-desc-livre" value="${escOS(p.descricaoExibicao || p.desc || p.descricao || '')}" placeholder="Descrição da peça na O.S." oninput="window.calcOSTotal()" title="Descrição exibida na O.S. Pode ser editada sem alterar NF/peça real.">
      <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peÃ§a no orÃ§amento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="${custo.toFixed(2).replace('.', ',')}" placeholder="Custo" oninput="window.calcOSTotal()" title="Custo unitÃ¡rio interno da peÃ§a">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Venda" oninput="window.calcOSTotal()" title="Valor unitÃ¡rio de venda/orÃ§amento da peÃ§a">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">âœ•</button>
    `;
  } else {
    // Cliente normal (estoque)
    const vBruto = numBR(p.venda || p.v || 0);
    div.style.cssText = 'display:grid;grid-template-columns:minmax(190px,.85fr) minmax(90px,.28fr) minmax(280px,1.25fr) 58px 82px 82px 150px 32px;gap:7px;align-items:center;background:rgba(34,197,94,0.04);padding:6px;border-radius:3px;border:1px solid rgba(34,197,94,0.14);';
    div.dataset.pecaCodigo = p.codigo || p.codigoExibicao || '';
    div.dataset.pecaFornecedor = p.fornecedor || p.fornecedorNome || '';
    div.dataset.pecaNf = p.nf || p.nfNumero || '';
    div.dataset.pecaNfId = p.nfId || '';
    div.dataset.origemNFItemKey = p.origemNFItemKey || '';
    div.dataset.origemNFVinculada = p.origemNFVinculada ? '1' : '';
    div.dataset.origemPecaOS = p.origem || '';
    div.dataset.pecaDataCompra = p.dataCompra || '';
    const opts = optionsPecasEstoqueFiltradasOS(p.estoqueId || '', '', false);
    div.innerHTML = `
      <input type="search" class="j-input peca-busca-estoque" value="${escOS(p.codigoExibicao || p.codigo || p.desc || p.descricao || '')}" placeholder="Buscar peça cadastrada por código, descrição, fornecedor ou NF..." oninput="window.filtrarPecasOS(this)" onkeydown="window.selecionarPrimeiraPecaFiltradaOS(this,event)" style="grid-column:1/-1;font-family:var(--fm);font-size:.72rem;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.22);" autocomplete="off">
      <select class="j-select peca-sel" onchange="window.selecionarPecaOS(this)">${opts}</select>
      <input type="text" class="j-input peca-codigo" value="${escOS(p.codigoExibicao || p.codigo || '')}" placeholder="Código O.S." oninput="window.calcOSTotal()" title="Código exibido para o cliente na O.S.">
      <input type="text" class="j-input peca-desc-livre" value="${escOS(p.descricaoExibicao || p.desc || p.descricao || '')}" placeholder="Descrição na O.S." oninput="window.calcOSTotal()" title="Descrição exibida para o cliente na O.S.">
      <input type="number" class="j-input peca-qtd" value="${p.qtd || p.q || 1}" min="1" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="${numBR(p.custo || p.c || 0).toFixed(2).replace('.', ',')}" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <label style="display:flex;align-items:center;gap:5px;font-family:var(--fm);font-size:.58rem;color:var(--ok);line-height:1.15;"><input type="checkbox" class="peca-baixa-real" ${p.baixarEstoqueReal === true ? 'checked' : ''} style="width:auto;min-height:0;"> peça real</label>
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
      <div class="peca-estoque-info" style="grid-column:1/-1;font-family:var(--fm);font-size:.62rem;color:var(--muted);line-height:1.45;"></div>
    `;
  }
  if($('containerPecasOS')) $('containerPecasOS').appendChild(div);
  instalarDescontoIndividualLinhaOS(div, 'peca', descontoIndividualSalvoValorOS(p, numBR(p.valorBruto || ((p.qtd || p.q || 1) * numBR(p.venda || p.v || p.valor || 0)))));
  atualizarPecaOSInfoRow(div);
};

window.selecionarPecaOS = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (opt.value === '__avulsa__') {
    // Transforma a linha em entrada manual (igual ao modo governo, mas sem código original)
    const row = sel.parentElement;
    row.dataset.pecaAvulsa = '1';
    row.style.cssText = 'display:grid;grid-template-columns:minmax(100px,.32fr) minmax(320px,1.4fr) 58px 82px 82px 32px;gap:7px;align-items:center;background:rgba(255,165,0,0.06);padding:6px;border-radius:3px;border:1px solid rgba(255,165,0,0.25);';
    row.innerHTML = `
      <input type="text" class="j-input peca-codigo" placeholder="Código O.S." oninput="window.calcOSTotal()" title="Código exibido na O.S.">
      <input type="text" class="j-input peca-desc-livre" placeholder="Descrição da peça" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()" title="Quantidade da peça no orçamento">
      <input type="text" inputmode="decimal" class="j-input peca-custo" value="0,00" placeholder="Custo" oninput="window.calcOSTotal()" title="Custo unitário interno da peça">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Venda" oninput="window.calcOSTotal()" title="Valor unitário de venda/orçamento da peça">
      <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    row.querySelector('.peca-desc-livre').focus();
  } else {
    aplicarPecaEstoqueSelecionadaOS(sel.parentElement, estoqueItemOS(opt.value), true);
  }
  window.calcOSTotal();
};

function osRowsDiretas(containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return [];
  return Array.from(cont.children || []).filter(row =>
    row?.nodeType === 1 &&
    !row.classList?.contains('cilia-peca-wrap') &&
    !row.classList?.contains('os-auto-row-hint')
  );
}

function osCampoTemValor(row, selector) {
  const el = row?.querySelector?.(selector);
  return !!String(el?.value || '').trim();
}

function osCampoDecimalPositivo(row, selector) {
  const el = row?.querySelector?.(selector);
  return numBR(el?.value || 0) > 0;
}

function osServicoLinhaPreenchida(row) {
  if (!row) return false;
  const secao = row.querySelector('.serv-secao-hora')?.value || '';
  return osCampoTemValor(row, '.serv-desc') ||
    osCampoDecimalPositivo(row, '.serv-tempo') ||
    osCampoDecimalPositivo(row, '.serv-valor') ||
    !!secao;
}

function osPecaLinhaPreenchida(row) {
  if (!row) return false;
  const sel = row.querySelector('.peca-sel');
  const estoqueSelecionado = sel && sel.value && sel.value !== '__avulsa__';
  return !!estoqueSelecionado ||
    osCampoTemValor(row, '.peca-codigo') ||
    osCampoTemValor(row, '.peca-desc-livre') ||
    osCampoDecimalPositivo(row, '.peca-custo') ||
    osCampoDecimalPositivo(row, '.peca-venda') ||
    numBR(row.querySelector('.peca-qtd')?.value || 1) > 1;
}

function osAdicionarLinhaAutomatica(tipo) {
  const containerId = tipo === 'servico' ? 'containerServicosOS' : 'containerPecasOS';
  const cont = document.getElementById(containerId);
  if (!cont || cont.dataset.autoRowLock === '1') return null;
  cont.dataset.autoRowLock = '1';
  const antes = osRowsDiretas(containerId);
  try {
    const criada = tipo === 'servico'
      ? window.adicionarServicoOS?.({ focus:false, scroll:false, auto:true })
      : window.adicionarPecaOS?.({ focus:false, scroll:false, auto:true });
    const rows = osRowsDiretas(containerId);
    const nova = rows.length > antes.length ? rows[rows.length - 1] : (criada || null);
    if (nova) nova.dataset.autoLinhaOS = '1';
    return nova;
  } finally {
    setTimeout(() => { if (cont) delete cont.dataset.autoRowLock; }, 80);
  }
}

function osGarantirProximaLinha(tipo) {
  const containerId = tipo === 'servico' ? 'containerServicosOS' : 'containerPecasOS';
  const rows = osRowsDiretas(containerId);
  if (!rows.length) return osAdicionarLinhaAutomatica(tipo);
  const ultima = rows[rows.length - 1];
  const preenchida = tipo === 'servico' ? osServicoLinhaPreenchida(ultima) : osPecaLinhaPreenchida(ultima);
  if (preenchida) return osAdicionarLinhaAutomatica(tipo);
  return null;
}

function osFocarProximaLinha(row, tipo) {
  const containerId = tipo === 'servico' ? 'containerServicosOS' : 'containerPecasOS';
  osGarantirProximaLinha(tipo);
  setTimeout(() => {
    const rows = osRowsDiretas(containerId);
    const idx = rows.indexOf(row);
    const next = rows[idx + 1];
    if (!next) return;
    const alvo = tipo === 'servico'
      ? next.querySelector('.serv-desc')
      : (next.querySelector('.peca-desc-livre') || next.querySelector('.peca-sel'));
    alvo?.focus?.();
    next.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, 30);
}

function osPecaRealLinhaPreenchida(row) {
  if (!row) return false;
  return osCampoTemValor(row,'.pr-codigo') || osCampoTemValor(row,'.pr-desc') || osCampoTemValor(row,'.pr-fornec') || osCampoTemValor(row,'.pr-nf') || osCampoDecimalPositivo(row,'.pr-valor') || !!row.querySelector('.pr-estoque')?.value;
}
function osServicoRealLinhaPreenchida(row) {
  if (!row) return false;
  return osCampoTemValor(row,'.sr-desc') || osCampoTemValor(row,'.sr-fornec') || osCampoTemValor(row,'.sr-nf') || osCampoDecimalPositivo(row,'.sr-valor');
}
function osGarantirProximaLinhaReal(tipo) {
  const id = tipo === 'peca' ? 'containerPecasReais' : 'containerServicosReais';
  const ct = document.getElementById(id);
  if (!ct || ct.dataset.autoRowLock === '1') return null;
  const seletor = tipo === 'peca' ? '.real-item-row' : '.real-service-row';
  const rows = Array.from(ct.children).filter(el => el.matches?.(seletor));
  if (!rows.length) return null;
  const ultima = rows[rows.length-1];
  const preenchida = tipo === 'peca' ? osPecaRealLinhaPreenchida(ultima) : osServicoRealLinhaPreenchida(ultima);
  if (!preenchida) return null;
  ct.dataset.autoRowLock='1';
  try {
    return tipo === 'peca'
      ? window.adicionarPecaRealRow?.({}, { focus:false,scroll:false,auto:true })
      : (clienteOficialAtualReaisOS() ? window.adicionarServicoRealRow?.({}, { focus:false,scroll:false,auto:true }) : null);
  } finally {
    setTimeout(()=>{ if(ct) delete ct.dataset.autoRowLock; },100);
  }
}

window.inicializarAutoLinhasOS = function() {
  const serv = document.getElementById('containerServicosOS');
  const pec = document.getElementById('containerPecasOS');
  if (serv && serv.dataset.autoRowsInit !== '1') {
    serv.dataset.autoRowsInit = '1';
    let autoRowTimerServico = null;
    const onEdit = ev => {
      if (ev?.isComposing) return;
      clearTimeout(autoRowTimerServico);
      autoRowTimerServico = setTimeout(() => osGarantirProximaLinha('servico'), 90);
    };
    serv.addEventListener('input', onEdit);
    serv.addEventListener('change', onEdit);
    serv.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey) return;
      const alvo = ev.target;
      if (!alvo?.matches?.('.serv-desc,.serv-tempo,.serv-valor,.serv-valor-hora')) return;
      ev.preventDefault();
      osFocarProximaLinha(alvo.closest('#containerServicosOS > div'), 'servico');
    });
  }
  if (pec && pec.dataset.autoRowsInit !== '1') {
    pec.dataset.autoRowsInit = '1';
    let autoRowTimerPeca = null;
    const onEdit = ev => {
      if (ev?.isComposing) return;
      clearTimeout(autoRowTimerPeca);
      autoRowTimerPeca = setTimeout(() => osGarantirProximaLinha('peca'), 90);
    };
    pec.addEventListener('input', onEdit);
    pec.addEventListener('change', onEdit);
    pec.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey) return;
      const alvo = ev.target;
      if (!alvo?.matches?.('.peca-codigo,.peca-desc-livre,.peca-qtd,.peca-custo,.peca-venda')) return;
      ev.preventDefault();
      osFocarProximaLinha(alvo.closest('#containerPecasOS > div'), 'peca');
    });
  }
  const pecReal = document.getElementById('containerPecasReais');
  if (pecReal && pecReal.dataset.autoRowsInit !== '1') {
    pecReal.dataset.autoRowsInit = '1';
    let timer = null;
    const onEdit = ev => {
      if (ev?.isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(() => osGarantirProximaLinhaReal('peca'), 100);
      window.atualizarResumoPecasReais177?.();
    };
    pecReal.addEventListener('input', onEdit);
    pecReal.addEventListener('change', onEdit);
  }
  const servReal = document.getElementById('containerServicosReais');
  if (servReal && servReal.dataset.autoRowsInit !== '1') {
    servReal.dataset.autoRowsInit = '1';
    let timer = null;
    const onEdit = ev => {
      if (ev?.isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(() => osGarantirProximaLinhaReal('servico'), 100);
      window.atualizarResumoPecasReais177?.();
    };
    servReal.addEventListener('input', onEdit);
    servReal.addEventListener('change', onEdit);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.inicializarAutoLinhasOS?.());
} else {
  window.inicializarAutoLinhasOS?.();
}

window.renderResumoSecoesOS = function(resumoSecoes) {
    const el = $('osSecaoKpisOS');
    if (!el) return;
    const rows = Object.entries(resumoSecoes || {})
      .filter(([, item]) => item.horas || item.total)
      .sort((a, b) => b[1].total - a[1].total);
    if (!rows.length) { setHTMLOS(el, ''); return; }
    const moedaLocal = v => 'R$ ' + numBR(v).toFixed(2).replace('.', ',');
    const html = rows.map(([secao, item]) => {
      const codigos = listaResumoOS(item.codigos, 8);
      const tipos = listaResumoOS(item.tiposVeiculo, 3);
      const sistemas = listaResumoOS(item.sistemas, 3);
      return `
      <div class="os-secao-kpi">
        <small>${escOS(secao)}</small>
        <strong>${moedaLocal(item.total)}</strong>
        <span>${item.horas.toFixed(2).replace('.', ',')}h em ${item.qtd} servico(s)</span>
        ${codigos ? `<span style="display:block;margin-top:3px;color:var(--cyan);">Cód.: ${escOS(codigos)}</span>` : ''}
        ${tipos ? `<span style="display:block;color:var(--muted);">Tipo veículo: ${escOS(tipos)}</span>` : ''}
        ${sistemas ? `<span style="display:block;color:var(--muted);">Sistema: ${escOS(sistemas)}</span>` : ''}
      </div>`;
    }).join('');
    setHTMLOS(el, html);
};

function atualizarCamposValorCobradoLinhaOS(row, tipo, valorFinal) {
  if (!row) return;
  const seletor = tipo === 'servico' ? '.serv-valor-cobrado' : '.peca-valor-cobrado';
  const campo = row.querySelector(seletor);
  if (campo) setValueOS(campo, Math.max(0, numBR(valorFinal || 0)).toFixed(2).replace('.', ','), true);
  if (tipo === 'servico') window.atualizarValorAutomaticoRateioServicoOS?.(row, valorFinal);
}

function calcularOSTotalAgora() {
    let total = 0;
    let totalServicos = 0;
    let totalPecas = 0;
    let brutoServicos = 0;
    let brutoPecas = 0;
    const resumoSecoesOS = {};

    // Desconto: prioriza campo da OS; fallback para padrão do cadastro do cliente
    const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
    const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
    const _osDescMOField = document.getElementById('osDescMO');
    const _osDescPecaField = document.getElementById('osDescPeca');
    const _osDescMOVal = _osDescMOField?.value?.trim();
    const _osDescPecaVal = _osDescPecaField?.value?.trim();
    // Se preenchido na OS, usa ele; senão usa padrão do cliente (já em decimal 0-1)
    const descMO   = _osDescMOVal   !== '' && _osDescMOVal   != null ? taxaDescontoOS(_osDescMOVal)   : taxaDescontoOS(dadosGov?.descMO   || 0);
    const descPeca = _osDescPecaVal !== '' && _osDescPecaVal != null ? taxaDescontoOS(_osDescPecaVal) : taxaDescontoOS(dadosGov?.descPeca || 0);
    window.atualizarVisibilidadeDescontosOS?.();

    document.querySelectorAll('#containerItensOS > div').forEach(div => {
        const q = numBR(div.querySelector('.os-item-qtd')?.value || 0);
        const v = numBR(div.querySelector('.os-item-venda')?.value || 0);
        const bruto = q * v;
        brutoPecas += bruto;
        totalPecas += bruto;
    });

    document.querySelectorAll('#containerServicosOS > div').forEach(row => {
        const calc = calcularServicoLinhaOS(row, descMO);
        const vBruto = numBR(calc.valorBruto || calc.bruto || 0);
        const vFinal = numBR(calc.valorFinal || 0);
        brutoServicos += vBruto;
        const tempo = numBR(calc.tempo || 0);
        const desc = String(calc.desc || '').trim();
        // Atualiza badge de desconto em tempo real
        const descBox = row.querySelector('.serv-desc-val');
        const pctBox = row.querySelector('.serv-desc-pct');
        if (pctBox) setTextOS(pctBox, '- ' + moedaOS(calc.descontoValor || Math.max(0, vBruto - vFinal)));
        if (descBox) setTextOS(descBox, 'R$ ' + vFinal.toFixed(2).replace('.', ','));
        atualizarCamposValorCobradoLinhaOS(row, 'servico', vFinal);
        atualizarBoxDescontoLinhaOS(row, 'serv', vBruto, vFinal, calc.descPct || 0);
        totalServicos += vFinal;
        if (desc || vBruto || tempo) {
            const sel = row.querySelector('.serv-secao-hora');
            const sistema = sel?.options?.[sel.selectedIndex]?.text?.replace(/\s+-\s+R\$.*/, '') || row.dataset.secaoHoraLabel || row.dataset.sistemaTabela || '';
            const categoria = classificarSecaoResumoOS({
                secaoHoraLabel: sistema,
                sistemaTabela: row.dataset.sistemaTabela,
                sistema: row.dataset.sistemaTabela,
                codigoInterno: row.dataset.codigoInterno,
                codigoTabela: row.dataset.codigoTabela,
                tipoVeiculoTabela: row.dataset.tipoVeiculoTabela,
                desc
            });
            if (!resumoSecoesOS[categoria]) resumoSecoesOS[categoria] = { horas: 0, total: 0, qtd: 0, codigos: new Set(), sistemas: new Set(), tiposVeiculo: new Set() };
            resumoSecoesOS[categoria].horas += tempo;
            resumoSecoesOS[categoria].total += vFinal;
            resumoSecoesOS[categoria].qtd += 1;
            addMetaResumoServicoOS(resumoSecoesOS[categoria], metaServicoResumoOS({
                codigoInterno: row.dataset.codigoInterno,
                codigoTabela: row.dataset.codigoTabela,
                sistemaTabela: row.dataset.sistemaTabela || sistema,
                secaoHoraLabel: sistema,
                tipoVeiculoTabela: row.dataset.tipoVeiculoTabela
            }, window._osVeiculoAtual?.() || {}));
            atualizarMetaServicoLinhaOS(row);
        }
    });

    // Serviços relacionados a peças importadas do Cília também entram no total e no resumo por seção
    document.querySelectorAll('#containerPecasOS .cilia-serv-relac').forEach(row => {
        const calc = calcularServicoLinhaOS(row, descMO);
        const vBruto = numBR(calc.valorBruto || calc.bruto || 0);
        const vFinal = numBR(calc.valorFinal || 0);
        brutoServicos += vBruto;
        const tempo = numBR(calc.tempo || 0);
        const desc = String(calc.desc || '').trim();
        const descBox = row.querySelector('.serv-desc-val');
        const pctBox = row.querySelector('.serv-desc-pct');
        if (pctBox) setTextOS(pctBox, '- ' + moedaOS(calc.descontoValor || Math.max(0, vBruto - vFinal)));
        if (descBox) setTextOS(descBox, 'R$ ' + vFinal.toFixed(2).replace('.', ','));
        atualizarCamposValorCobradoLinhaOS(row, 'servico', vFinal);
        atualizarBoxDescontoLinhaOS(row, 'serv', vBruto, vFinal, calc.descPct || 0);
        totalServicos += vFinal;
        if (desc || vBruto || tempo) {
            const sel = row.querySelector('.serv-secao-hora');
            const sistema = sel?.options?.[sel.selectedIndex]?.text?.replace(/\s+-\s+R\$.*/, '') || row.dataset.secaoHoraLabel || row.dataset.sistemaTabela || '';
            const categoria = classificarSecaoResumoOS({
                secaoHora: row.dataset.secaoHora || sel?.value || '',
                secaoHoraLabel: sistema,
                sistemaTabela: row.dataset.sistemaTabela,
                sistema: row.dataset.sistemaTabela,
                codigoInterno: row.dataset.codigoInterno,
                codigoTabela: row.dataset.codigoTabela,
                tipoVeiculoTabela: row.dataset.tipoVeiculoTabela,
                desc
            });
            if (!resumoSecoesOS[categoria]) resumoSecoesOS[categoria] = { horas: 0, total: 0, qtd: 0, codigos: new Set(), sistemas: new Set(), tiposVeiculo: new Set() };
            resumoSecoesOS[categoria].horas += tempo;
            resumoSecoesOS[categoria].total += vFinal;
            resumoSecoesOS[categoria].qtd += 1;
            addMetaResumoServicoOS(resumoSecoesOS[categoria], metaServicoResumoOS({
                codigoInterno: row.dataset.codigoInterno,
                codigoTabela: row.dataset.codigoTabela,
                sistemaTabela: row.dataset.sistemaTabela || sistema,
                secaoHoraLabel: sistema,
                tipoVeiculoTabela: row.dataset.tipoVeiculoTabela
            }, window._osVeiculoAtual?.() || {}));
        }
    });

    document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)').forEach(row => {
        const qtd   = numBR(row.querySelector('.peca-qtd')?.value   || 0);
        const venda = numBR(row.querySelector('.peca-venda')?.value  || 0);
        const vBruto = qtd * venda;
        const descontoIndividualValor = descontoIndividualLinhaOS(row, 'peca');
        const calcDesconto = calcularDescontosValorOS(vBruto, descPeca, descontoIndividualValor);
        const descEfetivo = calcDesconto.descPct;
        const vFinal = calcDesconto.valorFinal;
        brutoPecas += vBruto;
        // Atualiza badge de desconto em tempo real
        const descBox = row.querySelector('.peca-desc-val');
        const pctBox = row.querySelector('.peca-desc-pct') || row.querySelector('.peca-desc-box div:first-child');
        if (pctBox) setTextOS(pctBox, '- ' + moedaOS(calcDesconto.descontoValor || Math.max(0, vBruto - vFinal)));
        if (descBox) setTextOS(descBox, 'R$ ' + vFinal.toFixed(2).replace('.', ','));
        atualizarCamposValorCobradoLinhaOS(row, 'peca', vFinal);
        atualizarBoxDescontoLinhaOS(row, 'peca', vBruto, vFinal, descEfetivo);
        totalPecas += vFinal;
    });

    const guinchoOS = window.calcularDeslocamentoGuinchoOS?.() || { total: 0 };
    const totalGuincho = guinchoOS.ativo ? _numGuinchoOS(guinchoOS.total || 0) : 0;
    total = +(totalServicos + totalPecas + totalGuincho).toFixed(2);
    setTextOS($('osTotalVal'), total.toFixed(2).replace('.', ','));
    setTextOS($('osTotalServicosVal'), totalServicos.toFixed(2).replace('.', ','));
    setTextOS($('osTotalPecasVal'), totalPecas.toFixed(2).replace('.', ','));
    setTextOS($('osTotalValMirror'), total.toFixed(2).replace('.', ','));
    setValueOS($('osTotalHidden'), total, false);
    atualizarResumoDescontosCompletoOS({
      descMO,
      descPeca,
      brutoServicos,
      liquidoServicos: totalServicos,
      brutoPecas,
      liquidoPecas: totalPecas,
      totalGuincho: (typeof totalGuincho !== 'undefined' ? totalGuincho : 0),
      total
    });
    window.renderResumoSecoesOS(resumoSecoesOS);
    window.atualizarCotacaoPecasOrcamentoAtualOS?.();
    return { total, totalServicos, totalPecas, brutoServicos, brutoPecas };
}

let _calcOSTotalTimer = null;
let _calcOSTotalFrame = null;
window.calcOSTotalAgora = function() {
  clearTimeout(_calcOSTotalTimer);
  _calcOSTotalTimer = null;
  if (_calcOSTotalFrame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_calcOSTotalFrame);
  _calcOSTotalFrame = null;
  return calcularOSTotalAgora();
};
window.calcOSTotal = function(options) {
  if (options === true || options?.imediato === true) return window.calcOSTotalAgora();
  clearTimeout(_calcOSTotalTimer);
  _calcOSTotalTimer = setTimeout(() => {
    _calcOSTotalTimer = null;
    const executar = () => {
      _calcOSTotalFrame = null;
      calcularOSTotalAgora();
    };
    if (typeof requestAnimationFrame === 'function') _calcOSTotalFrame = requestAnimationFrame(executar);
    else executar();
  }, 55);
};

window.verificarStatusOS = function() {
  const s = $v('osStatus');
  if($('areaPgtoOS')) $('areaPgtoOS').style.display = (s === 'Pronto' || s === 'Entregue' || s === 'pronto' || s === 'entregue') ? 'block' : 'none';
  if($('btnEnviarWppOS')) $('btnEnviarWppOS').style.display = (s === 'Orcamento_Enviado' || s === 'orcamento' || s === 'aprovacao') && $v('osId') ? 'flex' : 'none';
  if($('btnAvisarProntoOS')) {
    const podeAvisar = ['Orcamento_Enviado','orcamento_enviado','Pronto','pronto','Entregue','entregue'].includes(s) && $v('osId');
    $('btnAvisarProntoOS').style.display = podeAvisar ? 'inline-flex' : 'none';
    $('btnAvisarProntoOS').textContent = (s === 'Orcamento_Enviado' || s === 'orcamento_enviado') ? 'AVISAR CLIENTE: ORCAMENTO ENVIADO' : ((s === 'Entregue' || s === 'entregue') ? 'AVISAR CLIENTE: ENTREGA CONFIRMADA' : 'AVISAR CLIENTE: VEICULO PRONTO');
    $('btnAvisarProntoOS').onclick = function() { window.dispararAvisoEntregaAutomatico($v('osId'), $v('osStatus')); };
  }
  aplicarRegraParcelasPagamentoOS();
};

window.checkPgtoOS = function() {
  aplicarRegraParcelasPagamentoOS();
};

function statusExecucaoComissaoOS(status) {
  return /^(executado|executado_obs|concluido|finalizado|feito|realizado|trocada)$/i.test(String(status || '').trim());
}

function calcularComissoesPorMecanicoOS(payload, totalPecasFallback) {
  const U = OSU();
  const cliente = (window.J?.clientes || []).find(c => c.id === payload?.clienteId);
  const itens = U.buildBudgetItems?.(payload, cliente) || [];
  const temAprovacao = U.hasApproval?.(payload);
  const aprovados = U.getApprovedKeys?.(payload) || new Set();
  const execucao = payload?.execucaoItens || {};
  const temExecucaoServico = Object.entries(execucao).some(([key, registro]) =>
    String(key).startsWith('servico-') && registro && String(registro.status || '').trim()
  );
  const mapa = new Map();
  const garantir = id => {
    const mecId = String(id || '').trim();
    if (!mecId) return null;
    if (!mapa.has(mecId)) {
      mapa.set(mecId, { mecId, mec: snapshotMecanicoOS(mecId, payload), baseServico: 0, basePecas: 0, servicos: [] });
    }
    return mapa.get(mecId);
  };

  itens.filter(item => item.tipo === 'servico').forEach(item => {
    if (temAprovacao && !aprovados.has(item.key)) return;
    const registro = execucao[item.key] || {};
    if (temExecucaoServico && !statusExecucaoComissaoOS(registro.status)) return;
    const origemServico = (payload?.servicos || [])[item.index] || {};
    let rateios = Array.isArray(origemServico.rateiosComissao) ? origemServico.rateiosComissao : [];
    rateios = rateios.map(r => ({
      mecId: String(r?.mecId || r?.id || '').trim(),
      mecNome: r?.mecNome || r?.nome || '',
      valorBase: Math.max(0, numBR(r?.valorBase ?? r?.valorDividido ?? r?.baseComissao ?? 0))
    })).filter(r => r.mecId && r.valorBase > 0);
    if (!rateios.length) {
      const mecId = registro.mecId || registro.responsavelId || item.mecId || item.responsavelId || payload.mecId || '';
      if (mecId) rateios = [{ mecId: String(mecId), mecNome: item.mecNome || '', valorBase: Math.max(0, numBR(item.valorFinal || 0)) }];
    }
    const vistos = new Set();
    rateios.forEach(rateio => {
      if (vistos.has(rateio.mecId)) return;
      vistos.add(rateio.mecId);
      const grupo = garantir(rateio.mecId);
      if (!grupo) return;
      const baseRateada = +Math.min(Math.max(0, numBR(item.valorFinal || 0)), Math.max(0, numBR(rateio.valorBase || 0))).toFixed(2);
      if (baseRateada <= 0) return;
      grupo.baseServico += baseRateada;
      const percentual = numBR(grupo.mec.comissaoServico ?? grupo.mec.comissao ?? 0);
      grupo.servicos.push({
        key: item.key,
        desc: item.desc || '',
        valor: baseRateada,
        valorBase: baseRateada,
        valorServicoCobrado: numBR(item.valorFinal || 0),
        percentual,
        valorComissao: +(baseRateada * (percentual / 100)).toFixed(2),
        statusExecucao: registro.status || (temExecucaoServico ? 'sem_confirmacao' : 'legado_finalizado')
      });
    });
  });

  const principal = garantir(payload?.mecId || payload?.mecIds?.[0] || '');
  if (principal) {
    const pecasItens = itens.filter(item => item.tipo === 'peca' && (!temAprovacao || aprovados.has(item.key)));
    principal.basePecas = pecasItens.length
      ? pecasItens.reduce((soma, item) => soma + numBR(item.valorFinal || 0), 0)
      : numBR(totalPecasFallback || 0);
  }

  return Array.from(mapa.values()).map(grupo => {
    const percServico = numBR(grupo.mec.comissaoServico ?? grupo.mec.comissao ?? 0);
    const percPeca = numBR(grupo.mec.comissaoPeca || 0);
    const baseServico = +grupo.baseServico.toFixed(2);
    const basePecas = +grupo.basePecas.toFixed(2);
    const valorServico = +grupo.servicos.reduce((soma, servico) => soma + numBR(servico.valorComissao || 0), 0).toFixed(2);
    const valorPeca = +(basePecas * (percPeca / 100)).toFixed(2);
    return {
      mecId: grupo.mecId,
      mecNome: grupo.mec.nome || grupo.mecId,
      baseServico,
      basePecas,
      percServico,
      percPeca,
      valorServico,
      valorPeca,
      valorTotal: +(valorServico + valorPeca).toFixed(2),
      servicos: grupo.servicos
    };
  }).filter(item => item.valorTotal > 0);
}

async function reconciliarComissoesOS(osId, payload, calculos) {
  if (!osId || !window.db || !window.J?.tid) return;
  const snap = await db.collection('financeiro')
    .where('tenantId', '==', J.tid)
    .where('osId', '==', osId)
    .get();
  const existentes = snap.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    .filter(fin => fin.isComissao === true);
  const alvos = new Map((calculos || []).map(calc => [String(calc.mecId), calc]));
  const mecanicos = new Set([
    ...alvos.keys(),
    ...existentes.map(fin => String(fin.mecId || '')).filter(Boolean)
  ]);
  const agora = new Date().toISOString();
  const batch = db.batch();
  let operacoes = 0;
  const atualizar = (ref, dados) => { batch.update(ref, limparUndefinedFirestoreOS(dados)); operacoes += 1; };
  const criar = dados => {
    const ref = db.collection('financeiro').doc();
    batch.set(ref, limparUndefinedFirestoreOS(dados));
    operacoes += 1;
  };

  for (const mecId of mecanicos) {
    const calc = alvos.get(mecId);
    const registros = existentes.filter(fin => String(fin.mecId || '') === mecId && !financeiroOSCanceladoOS(fin));
    const pagos = registros.filter(fin => financeiroOSLiquidadoOS(fin));
    const pendentes = registros.filter(fin => !financeiroOSLiquidadoOS(fin));
    const totalPago = +pagos.reduce((soma, fin) => soma + numBR(fin.valor || 0), 0).toFixed(2);
    const alvoTotal = numBR(calc?.valorTotal || 0);
    const saldoPendente = +(alvoTotal - totalPago).toFixed(2);

    if (Math.abs(saldoPendente) < 0.01 || !calc) {
      for (const pendente of pendentes) {
        const saldoManualDividido = pendente.origem === 'saldo_pagamento_comissao_detalhado' || pendente.categoria === 'comissao_os_servico_parcial';
        if (!calc && saldoManualDividido) continue;
        atualizar(pendente.ref, {
          status: 'Cancelado',
          canceladoEm: agora,
          motivoCancelamento: calc
            ? 'Comissão já liquidada no valor calculado'
            : 'Comissão removida após alteração dos responsáveis/serviços da O.S.',
          updatedAt: agora
        });
      }
      continue;
    }

    const dados = {
      tenantId: J.tid,
      tipo: 'Saída',
      status: 'Pendente',
      desc: `${saldoPendente < 0 ? 'Ajuste de ' : ''}Comissão O.S. ${payload.placa || ''} — ${calc.mecNome} (Serv: ${moeda(calc.valorServico)} | Peça: ${moeda(calc.valorPeca)})`,
      valor: saldoPendente,
      pgto: 'A Combinar',
      venc: dataLocalISOOS(),
      osId,
      isComissao: true,
      isAjusteComissao: saldoPendente < 0,
      mecId,
      mecNome: calc.mecNome,
      vinculo: `E_${mecId}`,
      origem: saldoPendente < 0 ? 'comissao_os_ajuste' : 'comissao_os_por_servico',
      chaveComissao: `${osId}:${mecId}`,
      baseServico: calc.baseServico,
      basePecas: calc.basePecas,
      percServico: calc.percServico,
      percPeca: calc.percPeca,
      valorComissaoServico: calc.valorServico,
      valorComissaoPeca: calc.valorPeca,
      totalComissaoCalculada: calc.valorTotal,
      totalComissaoJaPago: totalPago,
      servicosComissao: calc.servicos,
      updatedAt: agora
    };
    if (pendentes.length) {
      atualizar(pendentes[0].ref, dados);
      for (const duplicada of pendentes.slice(1)) {
        atualizar(duplicada.ref, {
          status: 'Cancelado',
          canceladoEm: agora,
          motivoCancelamento: 'Comissão duplicada reconciliada por mecânico e serviço',
          updatedAt: agora
        });
      }
    } else {
      criar({ ...dados, createdAt: agora });
    }
  }
  if (operacoes) await batch.commit();
}

window.salvarOS = async function() {
  window.calcOSTotalAgora?.();
  const osId = $v('osId');
  const osRefSalvar = osId ? db.collection('ordens_servico').doc(osId) : db.collection('ordens_servico').doc();
  const targetOsId = osRefSalvar.id;
  const batchSalvarOS = db.batch();
  let operacoesBatchSalvarOS = 0;
  const auditoriasFinanceiroDepoisCommitOS = [];
  const queueFinanceiroAddOS = dados => {
    if (operacoesBatchSalvarOS >= 450) throw new Error('A O.S. excedeu o limite seguro de operações financeiras em uma única gravação.');
    const ref = db.collection('financeiro').doc();
    batchSalvarOS.set(ref, limparUndefinedFirestoreOS({ ...dados, osId: dados?.osId || targetOsId }));
    operacoesBatchSalvarOS += 1;
    return ref;
  };
  const queueFinanceiroUpdateOS = (ref, dados) => {
    if (operacoesBatchSalvarOS >= 450) throw new Error('A O.S. excedeu o limite seguro de operações financeiras em uma única gravação.');
    batchSalvarOS.update(ref, limparUndefinedFirestoreOS(dados));
    operacoesBatchSalvarOS += 1;
  };
  const prismaInformadoOS = ($v('osPrisma') || '').trim();
  if ($('osPlaca') && !$v('osPlaca')) { window.toast('⚠ Preencha a Placa', 'warn'); return; }
  if ($('osCliente') && $('osVeiculo') && !$v('osCliente') && !$v('osVeiculo')) { window.toast('⚠ Selecione cliente e veículo', 'warn'); return; }

  const itens = [];
  document.querySelectorAll('#containerItensOS > div').forEach(div => {
    const desc = div.querySelector('.os-item-desc').value.trim();
    const q = numBR(div.querySelector('.os-item-qtd').value || 0);
    const v = numBR(div.querySelector('.os-item-venda').value || 0);
    const t = div.querySelector('.os-item-tipo').value;
    if (desc && q > 0) itens.push({ desc, q, v, t });
  });

  const servicos = []; 
  let totalMaoObra = 0;
  let erroRateioOS = '';

  // Função local que lê uma linha de serviço e empurra pro array
  const _lerLinhaServico = (row) => {
    const calc = calcularServicoLinhaOS(row, descontoMaoObraAtualOS());
    const desc = calc.desc || '';
    const valor = numBR(calc.valorBruto || calc.bruto || 0);
    const valorFinal = numBR(calc.valorFinal || 0);
    const tempo = numBR(calc.tempo || 0);
    const codigoInterno = calc.codigoInterno || row.dataset?.codigoInterno || '';
    const codigoTabela = calc.codigoTabela || row.dataset?.codigoTabela || '';
    const sistemaTabela = calc.sistemaTabela || row.dataset?.sistemaTabela || '';
    const tipoVeiculoTabela = row.dataset?.tipoVeiculoTabela || extrairTipoVeiculoTempaOS({ sistemaTabela, sistema: sistemaTabela, secaoHoraLabel: row.dataset?.secaoHoraLabel }, window._osVeiculoAtual?.() || {});
    if (tipoVeiculoTabela && !row.dataset.tipoVeiculoTabela) row.dataset.tipoVeiculoTabela = tipoVeiculoTabela;
    const secaoHora = calc.secaoHora || row.querySelector('.serv-secao-hora')?.value || row.dataset?.secaoHora || '';
    const secaoInfo = secaoHora ? OSU().getPMSPValorHora?.(secaoHora) : null;
    const valorHora = numBR(calc.valorHora || row.querySelector('.serv-valor-hora')?.value || row.dataset?.valorHoraSecao || (tempo > 0 ? valor / tempo : 0));
    const valorHoraTabela = numBR(calc.valorHoraTabela || (secaoInfo ? secaoInfo.valor : row.dataset?.valorHoraSecao || 0));
    const secaoHoraLabel = calc.secaoHoraLabel || secaoInfo?.label || row.dataset?.secaoHoraLabel || '';
    const valorHoraManual = row.dataset?.valorHoraManual === '1' || (valorHoraTabela > 0 && valorHora > 0 && Math.abs(valorHora - valorHoraTabela) > 0.009);
    const idsRateioBrutos = Array.from(row.querySelectorAll('.serv-rateio-row .serv-mec')).map(sel => String(sel.value || '').trim()).filter(Boolean);
    if (new Set(idsRateioBrutos).size !== idsRateioBrutos.length && !erroRateioOS) erroRateioOS = `O serviço "${desc || 'sem descrição'}" possui o mesmo mecânico selecionado mais de uma vez.`;
    const rateiosComissao = window.obterRateiosLinhaServicoOS?.(row, valorFinal) || [];
    const somaRateios = +rateiosComissao.reduce((soma, r) => soma + numBR(r.valorBase || 0), 0).toFixed(2);
    if (rateiosComissao.length > 1 && rateiosComissao.some(r => numBR(r.valorBase || 0) <= 0) && !erroRateioOS) erroRateioOS = `Informe o valor dividido para cada mecânico no serviço "${desc || 'sem descrição'}".`;
    if (somaRateios - valorFinal > 0.011 && !erroRateioOS) erroRateioOS = `A divisão interna do serviço "${desc || 'sem descrição'}" (${moeda(somaRateios)}) supera o valor cobrado (${moeda(valorFinal)}).`;
    const mecIdServico = rateiosComissao[0]?.mecId || calc.mecId || row.querySelector('.serv-mec')?.value || row.dataset?.mecId || '';
    const mecServico = (window.J?.equipe || []).find(f => String(f.id) === String(mecIdServico));
    const mecNomeServico = rateiosComissao[0]?.mecNome || mecServico?.nome || calc.mecNome || row.dataset?.mecNome || '';
    if (desc || valor > 0 || valorFinal > 0 || tempo > 0) {
      servicos.push({
        desc,
        valor,
        valorBruto: valor,
        bruto: valor,
        valorFinal,
        total: valorFinal,
        descGeralPct: numBR(calc.descGeralPct || 0),
        descontoGeralValor: numBR(calc.descontoGeralValor || 0),
        descontoIndividualTipo: 'valor',
        descontoIndividualValor: numBR(calc.descontoIndividualValor || 0),
        descIndividualValor: numBR(calc.descontoIndividualValor || 0),
        descontoIndividual: numBR(calc.descontoIndividualValor || 0),
        descIndividualPct: numBR(calc.descIndividualPct || 0),
        descontoValor: numBR(calc.descontoValor || Math.max(0, valor - valorFinal)),
        descPct: numBR(calc.descPct || 0),
        tempo,
        codigoInterno,
        codigoTabela,
        sistemaTabela,
        tipoVeiculoTabela,
        secaoHora,
        secaoHoraLabel,
        valorHora,
        valorHoraTabela,
        valorHoraManual,
        valorManual: row.dataset?.valorManual === '1',
        mecId: mecIdServico,
        mecNome: mecNomeServico,
        responsavelId: mecIdServico,
        responsavelNome: mecNomeServico,
        mecIds: rateiosComissao.map(r => r.mecId),
        rateiosComissao: rateiosComissao.map(r => ({ mecId: r.mecId, mecNome: r.mecNome || '', valorBase: +numBR(r.valorBase || 0).toFixed(2) })),
        tipoExecucao: calc.tipoExecucao === 'terceirizada' ? 'terceirizada' : 'interna',
        terceirizadoId: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoId || '') : '',
        terceirizadoNome: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoNome || '') : '',
        terceirizadoOrigem: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoOrigem || '') : '',
        terceirizadoPedidoFornecedor: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoPedidoFornecedor || '') : '',
        pedidoFornecedor: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoPedidoFornecedor || '') : '',
        numeroPedidoFornecedor: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoPedidoFornecedor || '') : '',
        terceirizadoDocumento: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoDocumento || '') : '',
        nfServicoTerceirizado: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoDocumento || '') : '',
        documentoServicoTerceirizado: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoDocumento || '') : '',
        terceirizadoData: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoData || '') : '',
        dataServicoTerceirizado: calc.tipoExecucao === 'terceirizada' ? String(calc.terceirizadoData || '') : '',
        terceirizadoValor: calc.tipoExecucao === 'terceirizada' ? +numBR(calc.terceirizadoValor || 0).toFixed(2) : 0,
        custoTerceirizado: calc.tipoExecucao === 'terceirizada' ? +numBR(calc.terceirizadoValor || 0).toFixed(2) : 0,
        tempaManual: row.dataset?.tempaManual === '1',
        relacionadoCilia: row.dataset?.servRelacionado === '1',
        origemServico: row.dataset?.servRelacionado === '1'
          ? (codigoTabela ? (row.dataset?.tempaManual === '1' ? 'cilia_tabela_tempa_editado' : 'cilia_tabela_tempa') : 'cilia_manual')
          : 'manual',
        ciliaPieceIndex: row.closest?.('.cilia-peca-wrap')?.dataset?.ciliaPieceIndex || row.dataset?.ciliaPieceIndex || ''
      });
      totalMaoObra += valorFinal;
    }
  };

  document.querySelectorAll('#containerServicosOS > div').forEach(_lerLinhaServico);
  // CORREÇÃO 6: também lê serviços relacionados Cilia (dentro das peças)
  document.querySelectorAll('#containerPecasOS .cilia-serv-relac').forEach(_lerLinhaServico);
  if (erroRateioOS) { window.toast(erroRateioOS, 'warn'); return; }

  let mecanicoIdsOS = idsUnicosMecanicosOS([
    ...window.obterMecanicosSelecionadosOS(),
    ...servicos.flatMap(s => [s.mecId, ...(Array.isArray(s.rateiosComissao) ? s.rateiosComissao.map(r => r.mecId) : [])])
  ]);
  let mecanicoPrincipalOS = $v('osMec') || mecanicoIdsOS[0] || '';
  if (mecanicoPrincipalOS) {
    mecanicoIdsOS = idsUnicosMecanicosOS([mecanicoPrincipalOS, ...mecanicoIdsOS]);
    if ($('osMec') && !$v('osMec')) $('osMec').value = mecanicoPrincipalOS;
  }
  if (mecanicoIdsOS.length === 1) {
    const unico = snapshotMecanicoOS(mecanicoIdsOS[0]);
    servicos.forEach(s => {
      if (!s.mecId) {
        s.mecId = unico.id;
        s.mecNome = unico.nome;
        s.responsavelId = unico.id;
        s.responsavelNome = unico.nome;
        s.mecIds = [unico.id];
        s.rateiosComissao = [{ mecId: unico.id, mecNome: unico.nome, valorBase: +numBR(s.valorFinal || 0).toFixed(2) }];
      } else if (!Array.isArray(s.rateiosComissao) || !s.rateiosComissao.length) {
        s.mecIds = [s.mecId];
        s.rateiosComissao = [{ mecId: s.mecId, mecNome: s.mecNome || snapshotMecanicoOS(s.mecId).nome || '', valorBase: +numBR(s.valorFinal || 0).toFixed(2) }];
      }
    });
  }
  const statusFinalComissaoOS = ['Pronto','Entregue','pronto','entregue','Concluido','Faturado','Pronto_Retirada'].includes($v('osStatus'));
  const servicosSemResponsavelOS = servicos.filter(s => !s.mecId);
  if (statusFinalComissaoOS && mecanicoIdsOS.length > 1 && servicosSemResponsavelOS.length) {
    window.toast(`Defina o mecânico responsável em ${servicosSemResponsavelOS.length} serviço(s) antes de finalizar a O.S.`, 'warn');
    return;
  }

  const _oldOSProtecaoPecas = osId ? (window.J?.os || []).find(x => x.id === osId) : null;
  const _contextoProtecaoPecas = osContextoClienteAtualOS(_oldOSProtecaoPecas || {});
  const _protegerPecasReaisNoOrcamento = osClienteOficialSeguroOS(_contextoProtecaoPecas);

  const pecas = [];
  let totalPecas = 0;
  document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)').forEach(row => {
    if (_protegerPecasReaisNoOrcamento && osLinhaPecaRealProtegidaOS(row, _contextoProtecaoPecas)) return;
    const wrapCilia = row.closest?.('.cilia-peca-wrap') || row;
    // Peça AVULSA (cliente governo)
    if (row.dataset?.pecaAvulsa === '1') {
      const codigo = row.querySelector('.peca-codigo')?.value || '';
      const descLivre = row.querySelector('.peca-desc-livre')?.value || '';
      const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
      const venda = numBR(row.querySelector('.peca-venda')?.value || 0);
      const descontoIndividualValor = descontoIndividualLinhaOS(row, 'peca');
      const valorBrutoItem = +(qtd * venda).toFixed(2);
      const calcDescontoItem = calcularDescontosValorOS(valorBrutoItem, descontoPecasAtualOS(), descontoIndividualValor);
      const descEfetivo = calcDescontoItem.descPct;
      const valorFinalItem = calcDescontoItem.valorFinal;
      if (descLivre || codigo) {
        totalPecas += valorFinalItem;
        pecas.push({
          avulsa: true,        // marcador
          estoqueId: '',       // não baixa estoque
          codigo: codigo,
          codigoExibicao: codigo,
          desc: descLivre,
          descricao: descLivre,
          descricaoExibicao: descLivre,
          qtd: qtd,
          custo: 0,
          venda: venda,
          valorBruto: valorBrutoItem,
          valorFinal: valorFinalItem,
          total: valorFinalItem,
          descontoGeralValor: calcDescontoItem.descontoGeralValor,
          descontoIndividualTipo: 'valor',
          descontoIndividualValor: calcDescontoItem.descontoIndividualValor,
          descIndividualValor: calcDescontoItem.descontoIndividualValor,
          descontoIndividual: calcDescontoItem.descontoIndividualValor,
          descIndividualPct: valorBrutoItem > 0 ? +(calcDescontoItem.descontoIndividualValor / valorBrutoItem).toFixed(6) : 0,
          descontoValor: calcDescontoItem.descontoValor,
          descPct: descEfetivo,
          origem: row.dataset?.origemPecaOS || 'manual',
          origemNFItemKey: row.dataset?.origemNFItemKey || '',
          nfId: row.dataset?.pecaNfId || '',
          nf: row.dataset?.pecaNf || '',
          nfNumero: row.dataset?.pecaNf || '',
          origemNFVinculada: row.dataset?.origemNFVinculada === '1',
          ciliaBruto: numBR(row.dataset?.ciliaBruto || venda),
          ciliaValorLiquido: numBR(row.dataset?.ciliaLiquido || 0),
          ciliaDesconto: numBR(row.dataset?.ciliaDesconto || 0),
          ciliaPieceIndex: row.dataset?.ciliaPieceIndex || wrapCilia?.dataset?.ciliaPieceIndex || '',
          ciliaGrupo: row.dataset?.ciliaGrupo || wrapCilia?.dataset?.ciliaGrupo || '',
          ciliaGrupoOrdem: numBR(row.dataset?.ciliaGrupoOrdem || wrapCilia?.dataset?.ciliaGrupoOrdem || 0),
          ciliaAgrupador: row.dataset?.ciliaAgrupador || wrapCilia?.dataset?.ciliaAgrupador || '',
          ciliaPosicaoOrdem: numBR(row.dataset?.ciliaPosicaoOrdem || wrapCilia?.dataset?.ciliaPosicaoOrdem || 0)
        });
      }
      return;
    }
    // Peça normal (estoque)
    const sel = row.querySelector('.peca-sel');
    const opt = sel?.options[sel.selectedIndex];
    const estoqueId = sel?.value || '';
    const codigo = row.querySelector('.peca-codigo')?.value?.trim() || row.dataset?.pecaCodigo || opt?.dataset?.codigo || '';
    const descPeca = row.querySelector('.peca-desc-livre')?.value?.trim() || descricaoPecaLinhaOS(row, opt, estoqueId);
    const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
    const venda = numBR(row.querySelector('.peca-venda')?.value || 0);
    const custo = numBR(row.querySelector('.peca-custo')?.value || 0);
    const descontoIndividualValor = descontoIndividualLinhaOS(row, 'peca');
    const valorBrutoItem = +(qtd * venda).toFixed(2);
    const calcDescontoItem = calcularDescontosValorOS(valorBrutoItem, descontoPecasAtualOS(), descontoIndividualValor);
    const descEfetivo = calcDescontoItem.descPct;
    const valorFinalItem = calcDescontoItem.valorFinal;
    if (!estoqueId && !venda && !custo && !descPeca && !codigo) return;
    totalPecas += valorFinalItem;

    pecas.push({
      estoqueId,
      codigo,
      codigoExibicao: codigo,
      desc: descPeca,
      descricao: descPeca,
      descricaoExibicao: descPeca,
      qtd: qtd, custo: custo, venda: venda,
      valorBruto: valorBrutoItem,
      valorFinal: valorFinalItem,
      total: valorFinalItem,
      descontoGeralValor: calcDescontoItem.descontoGeralValor,
      descontoIndividualTipo: 'valor',
      descontoIndividualValor: calcDescontoItem.descontoIndividualValor,
      descIndividualValor: calcDescontoItem.descontoIndividualValor,
      descontoIndividual: calcDescontoItem.descontoIndividualValor,
      descIndividualPct: valorBrutoItem > 0 ? +(calcDescontoItem.descontoIndividualValor / valorBrutoItem).toFixed(6) : 0,
      descontoValor: calcDescontoItem.descontoValor,
      descPct: descEfetivo,
      baixarEstoqueReal: pecaOSBaixaRealAtiva(row),
      fornecedor: row.dataset?.pecaFornecedor || opt?.dataset?.fornecedor || '',
      nf: row.dataset?.pecaNf || opt?.dataset?.nf || '',
      nfNumero: row.dataset?.pecaNf || opt?.dataset?.nf || '',
      nfId: row.dataset?.pecaNfId || '',
      origemNFItemKey: row.dataset?.origemNFItemKey || '',
      origemNFVinculada: row.dataset?.origemNFVinculada === '1',
      origem: row.dataset?.origemPecaOS || (row.dataset?.origemNFVinculada === '1' ? 'nf_entrada_os' : (estoqueId ? 'os_estoque' : 'manual')),
      dataCompra: row.dataset?.pecaDataCompra || opt?.dataset?.dataCompra || ''
    });
  });

  const totalFormatado = $('osTotalVal') ? $('osTotalVal').innerText : 0;
  const total = numBR(totalFormatado);
  
  const payload = {
    tenantId: J.tid,
    status: $v('osStatus'),
    total: total,
    updatedAt: new Date().toISOString()
  };

  const guinchoPayload = window.calcularDeslocamentoGuinchoOS?.() || { ativo: false, total: 0 };
  payload.deslocamentoGuincho = guinchoPayload;
  payload.totalGuincho = guinchoPayload.ativo ? _numGuinchoOS(guinchoPayload.total || 0) : 0;

  const _oldOSPreservar = _oldOSProtecaoPecas;

  // Prisma da O.S.: persiste enquanto o veículo estiver no pátio.
  // Ao entregar, preserva o último número no histórico e libera o prisma para reutilização.
  const _prismaAnteriorOS = String(_oldOSPreservar?.prisma || _oldOSPreservar?.numeroPrisma || '').trim();
  const _prismaAtualOS = String(prismaInformadoOS || _prismaAnteriorOS || '').trim();
  payload.prisma = _prismaAtualOS;
  payload.numeroPrisma = _prismaAtualOS;
  if (payload.status === 'Entregue' && _prismaAtualOS) {
    payload.prismaHistorico = _oldOSPreservar?.prismaHistorico || _oldOSPreservar?.numeroPrismaHistorico || _prismaAtualOS;
    payload.numeroPrismaHistorico = _oldOSPreservar?.numeroPrismaHistorico || _oldOSPreservar?.prismaHistorico || _prismaAtualOS;
    payload.prismaLiberado = true;
    payload.prismaLiberadoEm = new Date().toISOString();
    payload.prismaLiberadoPor = J.nome || 'Gestor';
    payload.prisma = '';
    payload.numeroPrisma = '';
  } else if (_prismaAtualOS) {
    payload.prismaLiberado = false;
  }

  const _veiculoSelecionadoOS = (window.J?.veiculos || []).find(v => v.id === $v('osVeiculo')) || {};
  if ($v('osPlaca')) payload.placa = $v('osPlaca').toUpperCase();
  else if (_veiculoSelecionadoOS?.placa) payload.placa = String(_veiculoSelecionadoOS.placa || '').toUpperCase();
  else if (_oldOSPreservar?.placa) payload.placa = _oldOSPreservar.placa;
  const _prefixoOS = $v('osPrefixo') || _veiculoSelecionadoOS?.prefixo || _oldOSPreservar?.prefixo || _oldOSPreservar?.prefixoVeiculo || '';
  if (_prefixoOS) {
    payload.prefixo = String(_prefixoOS).toUpperCase();
    payload.prefixoVeiculo = payload.prefixo;
  }
  if (_veiculoSelecionadoOS?.id) {
    payload.veiculoSnapshot = {
      id: _veiculoSelecionadoOS.id,
      placa: _veiculoSelecionadoOS.placa || '',
      prefixo: _veiculoSelecionadoOS.prefixo || '',
      modelo: _veiculoSelecionadoOS.modelo || '',
      marca: _veiculoSelecionadoOS.marca || '',
      ano: _veiculoSelecionadoOS.ano || '',
      chassis: _veiculoSelecionadoOS.chassis || _veiculoSelecionadoOS.chassi || ''
    };
  }
  const _tipoVeiculoOS = $v('osTipoVeiculo') || _oldOSPreservar?.tipoVeiculoOS || _oldOSPreservar?.tipoVeiculo || _oldOSPreservar?.tipo || '';
  if (_tipoVeiculoOS) {
    payload.tipoVeiculoOS = _tipoVeiculoOS;
    payload.tipoVeiculo = _tipoVeiculoOS;
  }
  if ($v('osVeiculo')) payload.veiculo = $v('osVeiculo');
  if ($('osVeiculo') && $('osVeiculo').tagName === 'SELECT') payload.veiculoId = $v('osVeiculo');
  if ($v('osCliente')) payload.cliente = $v('osCliente');
  if ($('osCliente') && $('osCliente').tagName === 'SELECT') payload.clienteId = $v('osCliente');
  if ($v('osCelular')) payload.celular = $v('osCelular');
  if ($v('osCpf')) payload.cpf = $v('osCpf');
  if ($v('osDiagnostico')) payload.diagnostico = $v('osDiagnostico');
  if ($v('osRelato')) payload.relato = $v('osRelato');
  if ($v('osDescricao')) payload.desc = $v('osDescricao');
  payload.mecId = mecanicoPrincipalOS || _oldOSPreservar?.mecId || '';
  payload.mecNome = snapshotMecanicoOS(payload.mecId, _oldOSPreservar).nome || _oldOSPreservar?.mecNome || '';
  payload.mecIds = idsUnicosMecanicosOS([payload.mecId, ...mecanicoIdsOS, ...servicos.flatMap(s => [s.mecId, ...(Array.isArray(s.rateiosComissao) ? s.rateiosComissao.map(r => r.mecId) : [])])]);
  payload.mecanicos = payload.mecIds.map(id => snapshotMecanicoOS(id, _oldOSPreservar));
  if ($v('osData')) payload.data = $v('osData');
  if ($v('osKm')) payload.km = $v('osKm');
  if ($v('osEntregueA')) payload.entreguePara = $v('osEntregueA');
  if (payload.status === 'Entregue' && !payload.entreguePara) {
    const retiradoPor = solicitarRetiradaOS(_oldOSPreservar || payload);
    if (retiradoPor === null) return;
    payload.entreguePara = retiradoPor;
    if ($('osEntregueA')) $('osEntregueA').value = retiradoPor;
  }
  // Dados oficiais desta OS: ficam congelados na própria OS e não dependem mais do cadastro raiz do cliente.
  payload.modeloOS = $v('osModeloOS') || '';
  payload.oesModelo = payload.modeloOS;
  payload.cabecalhoOS = $v('osCabecalhoOS') || '';
  payload.govCabecalhoOS = payload.cabecalhoOS;
  payload.valorHoraOS = numBR($v('osValorHoraOS') || 0);
  payload.govValorHoraOS = payload.valorHoraOS;
  payload.descMO = taxaDescontoOS($v('osDescMO') || 0);
  payload.descPeca = taxaDescontoOS($v('osDescPeca') || 0);
  payload.dadosOficiaisCongelados = true;
  // Peças realmente instaladas (somente dono)
  const _pecasReais = [];
  document.querySelectorAll('#containerPecasReais > div').forEach(row => {
    let metaPecaReal = {};
    try { metaPecaReal = JSON.parse(row.querySelector('.pr-meta')?.value || '{}') || {}; } catch (_) { metaPecaReal = {}; }
    if (metaPecaReal.origemAutoOS === true) return;
    const pr = Object.assign({}, metaPecaReal, {
      codigo: row.querySelector('.pr-codigo')?.value?.trim() || '',
      desc: row.querySelector('.pr-desc')?.value?.trim() || '',
      qtd: numBR(row.querySelector('.pr-qtd')?.value || 1) || 1,
      fornecedor: row.querySelector('.pr-fornec')?.value?.trim() || '',
      nf: row.querySelector('.pr-nf')?.value?.trim() || '',
      dataCompra: row.querySelector('.pr-datacompra')?.value?.trim() || '',
      valorCompra: numBR(row.querySelector('.pr-valor')?.value || 0),
      estoqueId: row.querySelector('.pr-estoque')?.value || ''
    });
    pr.descricao = pr.desc;
    pr.nfNumero = pr.nf;
    if (pr.desc || pr.codigo) _pecasReais.push(pr);
  });
  const _pecasReaisAutoOS = pecasReaisAutomaticasOS();
  _pecasReaisAutoOS.forEach(pr => _pecasReais.push(pr));
  if (document.getElementById('containerPecasReais') && (window._pecasReaisDesbloqueadas === true || _pecasReaisAutoOS.length)) payload.pecasReais = _pecasReais;

  // Serviços terceirizados reais: controle interno exclusivo de cliente oficial.
  // Não entram em payload.servicos, orçamento, comissão ou portal do cliente.
  const _servicosReais = [];
  document.querySelectorAll('#containerServicosReais > .real-service-row').forEach(row => {
    let meta = {};
    try { meta = JSON.parse(row.querySelector('.sr-meta')?.value || '{}') || {}; } catch (_) { meta = {}; }
    const descricao = row.querySelector('.sr-desc')?.value?.trim() || '';
    const fornecedor = row.querySelector('.sr-fornec')?.value?.trim() || '';
    const fornecedorId = row.dataset?.fornecedorId || '';
    const nf = row.querySelector('.sr-nf')?.value?.trim() || '';
    const dataCompra = row.querySelector('.sr-data')?.value?.trim() || '';
    const valorCompra = numBR(row.querySelector('.sr-valor')?.value || 0);
    if (!descricao && !fornecedor && !nf && valorCompra <= 0) return;
    _servicosReais.push(Object.assign({}, meta, {
      tipo: 'servico_terceirizado_real', tipoExecucao: 'terceirizada', descricao, desc: descricao,
      fornecedorId, fornecedor, fornecedorNome: fornecedor, nf, nfNumero: nf,
      dataCompra, dataServico: dataCompra, valorCompra, custo: valorCompra, valorReal: valorCompra,
      origem: meta.origem || 'os_servico_real_manual'
    }));
  });
  if (osSegredo177AtivoOS() && clienteOficialAtualReaisOS()) {
    payload.servicosReais = _servicosReais;
  } else if (Array.isArray(_oldOSPreservar?.servicosReais) || Array.isArray(_oldOSPreservar?.servicosTerceirizadosReais)) {
    // Preserva histórico caso a OS deixe de estar em contexto oficial ou a área restrita esteja fechada.
    payload.servicosReais = Array.isArray(_oldOSPreservar?.servicosReais)
      ? _oldOSPreservar.servicosReais
      : _oldOSPreservar.servicosTerceirizadosReais;
  }
  // LOTE C — Persistir próxima revisão (data e/ou KM) para o cliente ver
  if ($v('osProxRev')) payload.proxRev = $v('osProxRev');
  if ($v('osProxKm'))  payload.proxKm  = $v('osProxKm');
  // Checklist tri-state (cada campo vale '', 'ok', 'atencao' ou 'critico')
  ['chkPainel','chkPressao','chkCarroceria','chkDocumentos'].forEach(f => {
    const v = $v(f);
    if (v) payload[f] = v;
  });
  if ($v('chkObs')) payload.chkObs = $v('chkObs');
  if ($v('chkPneuDia')) payload.chkPneuDia = $v('chkPneuDia');
  if ($v('chkPneuTra')) payload.chkPneuTra = $v('chkPneuTra');
  if ($v('chkComb')) payload.chkComb = $v('chkComb');
  
  // GRAVA ARRAYS SEMPRE. Se o usuário removeu todos os serviços/peças e salvar,
  // o Firestore precisa receber [] para apagar o que existia antes.
  // Antes só gravava quando length > 0, por isso exclusão visual voltava ao reabrir a OS.
  payload.pecasLegacy = itens;
  payload.servicos = servicos;
  const _pecasReaisOcultasNaOS = osAtualizarOcultasPecasNFRemovidasOS(_oldOSPreservar || {}, pecas);
  payload.pecasReaisOcultasNaOS = _pecasReaisOcultasNaOS;
  payload.pecasNFRemovidasDaOS = _pecasReaisOcultasNaOS;
  const _contextoFinalPecasOS = Object.assign({}, _oldOSPreservar || {}, payload);
  const _pecasOrcamentoReconciliadasOS = osReconciliarPecasReaisParaClienteComumOS(_contextoFinalPecasOS, pecas, payload.pecasReais || _pecasReais || []);
  payload.pecas = osMesclarPecasProtegidasClienteOficialOS(_oldOSPreservar || {}, _contextoFinalPecasOS, _pecasOrcamentoReconciliadasOS);
  payload.maoObra = totalMaoObra;

  // Mapeia media para o payload antes do Deep Diff para podermos comparar
  if ($('osMediaArray')) {
      payload.media = JSON.parse($('osMediaArray').value || '[]');
  }

  // ── Assinatura do responsável por esta O.S. (thIAgui) ──────────────
  // Injetada no payload principal — UMA escrita, zero race condition.
  try {
    if (typeof window._osSignGetPayload === 'function') {
      const _ass = window._osSignGetPayload();
      if (_ass && (_ass.url || _ass.nomeResponsavel)) {
        payload.assinaturaResponsavel = _ass;
        payload.assinaturaOS          = _ass; // alias para compatibilidade
      }
    }
  } catch (_e) {
    console.warn('[OS] assinatura não anexada:', _e);
  }
  // ───────────────────────────────────────────────────────────────────

  const oldOSParaAprovacao = osId ? (J.os.find(x => x.id === osId) || {}) : {};
  const statusPedeAprovacao = ['Aprovado', 'Andamento'].includes(payload.status);
  const reabrindoParaEdicaoOS = !!(osId && statusReabreEdicaoOrcamentoOS(payload.status) && osTemAprovacaoAtivaOS(oldOSParaAprovacao));
  let registroReaberturaAprovacaoOS = null;

  if (reabrindoParaEdicaoOS) {
      // Ao voltar uma O.S. aprovada para Triagem/Orçamento, ela precisa ficar editável.
      // A aprovação NÃO é apagada da história: ela é arquivada em aprovacaoHistorico.
      // Os campos ativos são removidos para não manter "aprovação fantasma" bloqueando serviços/peças.
      registroReaberturaAprovacaoOS = aplicarReaberturaAprovacaoNoPayloadOS(payload, oldOSParaAprovacao, payload.status, 'salvar_os');
  } else if (statusPedeAprovacao && !osTemAprovacaoAtivaOS(oldOSParaAprovacao)) {
      const cliAprov = (J.clientes || []).find(c => c.id === payload.clienteId);
      const aprov = await OSU().openApprovalModal?.({ id: osId || 'nova-os', ...oldOSParaAprovacao, ...payload }, {
          clientes: J.clientes,
          cliente: cliAprov,
          toast: window.toast
      });
      if (!aprov) return;
      payload.status = 'Aprovado';
      payload.aprovacao = {
          status: aprov.status,
          aprovadoEm: new Date().toISOString(),
          aprovadoPor: J.nome || 'Gestor',
          aprovadoPorTipo: 'jarvis',
          totalOrcamento: aprov.totalOrcamento,
          totalAprovado: aprov.totalAprovado,
          itens: aprov.itens
      };
      payload.itensAprovados = aprov.keys;
      payload.totalAprovado = aprov.totalAprovado;
      payload.aprovacaoAtiva = true;
  } else if (!statusReabreEdicaoOrcamentoOS(payload.status) && osTemAprovacaoAtivaOS(oldOSParaAprovacao)) {
      payload.totalAprovado = oldOSParaAprovacao.totalAprovado;
      payload.aprovacao = oldOSParaAprovacao.aprovacao;
      payload.itensAprovados = oldOSParaAprovacao.itensAprovados || oldOSParaAprovacao.aprovacao?.itens?.map(i => i.key) || [];
      if (oldOSParaAprovacao.execucaoItens) payload.execucaoItens = oldOSParaAprovacao.execucaoItens;
      payload.aprovacaoAtiva = oldOSParaAprovacao.aprovacaoAtiva !== false;
  }

  // --- INÍCIO: DEEP DIFF E GATILHOS (AUDITORIA E WHATSAPP) ---
  const funcUser = J.nome || 'Mecânico/Gestor';
  let tl = [];
  let dispararAvisoEntrega = false;
  let dispararAvisoPronto = false;
  let motivoStatusSalvarOS = '';
  let finalizacaoSalvarOS = null;
  const auditoriaGeralOS = [];
  const agoraAuditoriaOS = new Date().toISOString();
  const usuarioAuditoriaOS = {
      id: String(J.uid || J.userId || J.usuarioId || ''),
      nome: funcUser,
      perfil: String(J.role || J.perfil || 'gestor')
  };
  const eventoEstruturadoOS = (tipoEvento, acao, extra = {}) => Object.assign({
      dt: agoraAuditoriaOS,
      user: funcUser,
      acao,
      tipoEvento,
      usuarioId: usuarioAuditoriaOS.id,
      usuarioNome: usuarioAuditoriaOS.nome,
      usuarioPerfil: usuarioAuditoriaOS.perfil,
      osId: targetOsId,
      placa: payload.placa || _oldOSPreservar?.placa || ''
  }, extra || {});
  const preservarMetaLancamentoOS = (novo, antigo, tipo) => {
      const n = novo || {};
      const a = antigo || {};
      ['lancadoEm','lancadoPorId','lancadoPorNome','lancadoPorPerfil'].forEach(k => {
          if ((n[k] == null || n[k] === '') && a[k] != null && a[k] !== '') n[k] = a[k];
      });
      if (!antigo) {
          n.lancadoEm = n.lancadoEm || agoraAuditoriaOS;
          n.lancadoPorId = n.lancadoPorId || usuarioAuditoriaOS.id;
          n.lancadoPorNome = n.lancadoPorNome || usuarioAuditoriaOS.nome;
          n.lancadoPorPerfil = n.lancadoPorPerfil || usuarioAuditoriaOS.perfil;
          n.tipoRegistroAuditoria = n.tipoRegistroAuditoria || tipo;
      }
      return n;
  };

  if (osId) {
      const oldOS = J.os.find(x => x.id === osId) || {};
      tl = oldOS.timeline ? [...oldOS.timeline] : JSON.parse($('osTimelineData')?.value || '[]');
      let registouAlgo = false;
      let alterouCampoAuditavel = false;
      const addAuditoriaCampo = acao => {
          auditoriaGeralOS.push(acao);
          alterouCampoAuditavel = true;
      };
      const fmtAudit = v => {
          if (v == null || v === '') return 'vazio';
          if (typeof v === 'number') return String(v).replace('.', ',');
          return String(v);
      };
      const normAudit = v => JSON.stringify(v == null ? '' : v);
      const auditCampoSeMudou = (key, label) => {
          if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
          if (normAudit(oldOS[key]) !== normAudit(payload[key])) {
              addAuditoriaCampo(`${label}: "${fmtAudit(oldOS[key])}" -> "${fmtAudit(payload[key])}"`);
          }
      };

      // 1. Mudança de Status e Gatilhos de Notificação
      if (oldOS.status !== payload.status) {
          motivoStatusSalvarOS = solicitarMotivoStatusOS(oldOS.status, payload.status, oldOS, 'salvar_os');
          if (motivoStatusSalvarOS === null) return;
          if (payload.status === 'Entregue' && oldOS.status !== 'Entregue') {
              finalizacaoSalvarOS = solicitarFinalizacaoOS(oldOS);
              if (finalizacaoSalvarOS === null) return;
              payload.finalizacaoOS = finalizacaoSalvarOS.tipo;
              payload.finalizacaoLabel = finalizacaoSalvarOS.label;
              payload.finalizacaoMotivo = motivoStatusSalvarOS;
              payload.finalizadoEm = new Date().toISOString();
              payload.finalizadoPor = funcUser;
          }
          const novoStatusLegivel = STATUS_MAP_LEGACY[payload.status] || payload.status;
          tl.push(montarEventoStatusOS(oldOS.status, payload.status, motivoStatusSalvarOS, 'salvar_os', {
              finalizacaoTipo: finalizacaoSalvarOS?.tipo,
              finalizacaoLabel: finalizacaoSalvarOS?.label
          }));
          registouAlgo = true;
          
          // No Jarvis, gestor/admin pode marcar Pronto e abrir WhatsApp ao cliente.
          // Nao gera mensagem fingindo origem do mecanico; equipe.html cuida desse aviso.
          if (payload.status === 'Orcamento_Enviado' && oldOS.status !== 'Orcamento_Enviado') {
              setTimeout(() => {
                  window.registrarAvisoClienteCRMOS?.(osId, 'Orcamento_Enviado', { origem: 'salvar_os', osPatch: payload });
                  if (usuarioPodeDispararWppProntoOS()) window.dispararAvisoEntregaAutomatico?.(osId, 'Orcamento_Enviado');
              }, 500);
          }
          if (payload.status === 'Pronto' && oldOS.status !== 'Pronto') {
              payload.prontoEm = new Date().toISOString();
              payload.prontoPor = funcUser;
              dispararAvisoPronto = true;
          }
          if ((payload.status === 'Entregue') && oldOS.status !== 'Entregue') {
              dispararAvisoEntrega = true;
          }
      }

      // 2. Mudança de Diagnóstico (Texto exato)
      const oldDiag = (oldOS.diagnostico || '').trim();
      const novoDiag = (payload.diagnostico || '').trim();
      if (novoDiag && novoDiag !== oldDiag) {
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Diagnóstico Técnico preenchido/atualizado: "${novoDiag}"` });
          registouAlgo = true;
      }

      // 3. Verificação Individual de Checklist (agora tri-state: ok/atencao/critico)
      const mapCheck = { 
          chkPainel: 'Painel/Instrumentos', 
          chkPressao: 'Pressão dos Pneus', 
          chkCarroceria: 'Carroceria/Pintura', 
          chkDocumentos: 'Documentos' 
      };
      const mapEstadoLabel = { ok: '✓ OK', atencao: '⚠ ATENÇÃO', critico: '✕ CRÍTICO', '': 'neutro' };
      ['chkPainel', 'chkPressao', 'chkCarroceria', 'chkDocumentos'].forEach(chk => {
          // Compatibilidade: antigo era boolean (true/false), novo é string ('ok'/'atencao'/'critico')
          const oldValRaw = oldOS[chk];
          const newValRaw = payload[chk];
          const oldVal = (oldValRaw === true || oldValRaw === 'ok') ? 'ok'
                       : (oldValRaw === 'atencao' || oldValRaw === 'critico') ? oldValRaw : '';
          const newVal = newValRaw || '';
          if (oldVal !== newVal) {
              const labelDe = mapEstadoLabel[oldVal] || 'neutro';
              const labelPara = mapEstadoLabel[newVal] || 'neutro';
              addAuditoriaCampo(`Checklist "${mapCheck[chk]}": ${labelDe} -> ${labelPara}`);
          }
      });

      // 3b. Mudança da equipe de mecânicos da O.S.
      const idsMecOld = idsMecanicosDocumentoOS(oldOS).sort();
      const idsMecNovo = idsMecanicosDocumentoOS(payload).sort();
      if (idsMecOld.join('|') !== idsMecNovo.join('|')) {
          const nomesOld = idsMecOld.map(id => snapshotMecanicoOS(id).nome || id).join(', ') || '-';
          const nomesNovo = idsMecNovo.map(id => snapshotMecanicoOS(id).nome || id).join(', ') || '-';
          addAuditoriaCampo(`Equipe mecânica da O.S.: ${nomesOld} -> ${nomesNovo}`);
          idsMecNovo.filter(id => !idsMecOld.includes(id)).forEach(id => {
              const mec = snapshotMecanicoOS(id, payload);
              tl.push(eventoEstruturadoOS('mecanico_relacionado_os', `Relacionou o mecânico ${mec.nome || id} à O.S.`, {
                  mecanicoId: id, mecanicoNome: mec.nome || id, origemEvento: 'salvar_os'
              }));
              registouAlgo = true;
          });
          idsMecOld.filter(id => !idsMecNovo.includes(id)).forEach(id => {
              const mec = snapshotMecanicoOS(id, oldOS);
              tl.push(eventoEstruturadoOS('mecanico_removido_os', `Removeu o mecânico ${mec.nome || id} da O.S.`, {
                  mecanicoId: id, mecanicoNome: mec.nome || id, origemEvento: 'salvar_os'
              }));
              registouAlgo = true;
          });
      } else if (oldOS.mecId !== payload.mecId && payload.mecId) {
          const mecOld = (J.equipe || []).find(m => m.id === oldOS.mecId);
          const mecNovo = (J.equipe || []).find(m => m.id === payload.mecId);
          addAuditoriaCampo(`Mecânico principal: ${mecOld?.nome || '-'} -> ${mecNovo?.nome || '-'}`);
          tl.push(eventoEstruturadoOS('mecanico_principal_alterado', `Alterou mecânico principal de ${mecOld?.nome || '-'} para ${mecNovo?.nome || payload.mecId}.`, {
              mecanicoId: payload.mecId, mecanicoNome: mecNovo?.nome || payload.mecNome || payload.mecId,
              mecanicoAnteriorId: oldOS.mecId || '', mecanicoAnteriorNome: mecOld?.nome || ''
          }));
          registouAlgo = true;
      }

      // 3c. Mudança de KM
      if (oldOS.km && payload.km && String(oldOS.km).trim() !== String(payload.km).trim()) {
          addAuditoriaCampo(`KM do veiculo: ${oldOS.km} -> ${payload.km}`);
      }

      // 3d. Mudança de cliente vinculado
      if (oldOS.clienteId && payload.clienteId && oldOS.clienteId !== payload.clienteId) {
          const cOld = (J.clientes || []).find(c => c.id === oldOS.clienteId);
          const cNovo = (J.clientes || []).find(c => c.id === payload.clienteId);
          addAuditoriaCampo(`Cliente vinculado: "${cOld?.nome || '-'}" -> "${cNovo?.nome || '-'}"`);
      }

      [
          ['placa', 'Placa'],
          ['veiculo', 'Veiculo'],
          ['veiculoId', 'Veiculo vinculado'],
          ['celular', 'Celular'],
          ['cpf', 'CPF/Documento'],
          ['relato', 'Relato/queixa'],
          ['desc', 'Descricao geral'],
          ['data', 'Data da OS'],
          ['entreguePara', 'Entregue para'],
          ['descMO', 'Desconto mao de obra'],
          ['descPeca', 'Desconto pecas'],
          ['totalGuincho', 'Deslocamento/guincho'],
          ['proxRev', 'Proxima revisao - data'],
          ['proxKm', 'Proxima revisao - KM'],
          ['chkObs', 'Observacoes do checklist'],
          ['chkPneuDia', 'Pneu dianteiro'],
          ['chkPneuTra', 'Pneu traseiro'],
          ['chkComb', 'Nivel combustivel']
      ].forEach(([key, label]) => auditCampoSeMudou(key, label));

      // 4. Identificação de Peças (Adições, Remoções, Alterações de Qtd/Valor)
      const oldPecas = oldOS.pecas || [];
      const newPecas = payload.pecas || [];
      
      newPecas.forEach(newP => {
          const descNovo = (newP.desc || '').toLowerCase().trim();
          const oldP = oldPecas.find(p => (p.desc || '').toLowerCase().trim() === descNovo);
          
          preservarMetaLancamentoOS(newP, oldP || null, 'peca');
          if (!oldP) {
              tl.push(eventoEstruturadoOS('peca_adicionada', `Adicionou peça: ${newP.desc} (Qtd: ${newP.qtd})`, {
                  pecaCodigo: newP.codigo || newP.codigoExibicao || '', pecaDescricao: newP.desc || newP.descricao || '',
                  quantidade: numBR(newP.qtd || 0), estoqueId: newP.estoqueId || '', nf: newP.nf || newP.nfNumero || '',
                  fornecedor: newP.fornecedor || ''
              }));
              registouAlgo = true;
          } else {
              if (numBR(oldP.qtd || 0) !== numBR(newP.qtd || 0) || numBR(oldP.venda || 0) !== numBR(newP.venda || 0)) {
                  addAuditoriaCampo(`Alterou peca "${newP.desc}" para Qtd: ${newP.qtd} / Valor: R$ ${(newP.venda||0).toFixed(2).replace('.', ',')}`);
              }
          }
      });
      
      oldPecas.forEach(oldP => {
           const descOld = (oldP.desc || '').toLowerCase().trim();
           const newP = newPecas.find(p => (p.desc || '').toLowerCase().trim() === descOld);
           if (!newP) {
               tl.push(eventoEstruturadoOS('peca_removida', `Removeu peça: ${oldP.desc}`, {
                   pecaCodigo: oldP.codigo || oldP.codigoExibicao || '', pecaDescricao: oldP.desc || oldP.descricao || '',
                   quantidade: numBR(oldP.qtd || 0), estoqueId: oldP.estoqueId || ''
               }));
               registouAlgo = true;
           }
      });

      // 5. Identificação de Serviços (Adições, Remoções, Alterações de Valor)
      const oldServicos = oldOS.servicos || [];
      const newServicos = payload.servicos || [];
      
      newServicos.forEach(newS => {
          const descNovo = (newS.desc || '').toLowerCase().trim();
          const oldS = oldServicos.find(s => (s.desc || '').toLowerCase().trim() === descNovo);
          
          preservarMetaLancamentoOS(newS, oldS || null, 'servico');
          const mecanicoNovoServicoInicial = newS.mecId || newS.mecanicoId || newS.responsavelId || '';
          if (!oldS) {
              if (mecanicoNovoServicoInicial) {
                  const mec = snapshotMecanicoOS(mecanicoNovoServicoInicial, payload);
                  newS.mecAtribuidoEm = newS.mecAtribuidoEm || agoraAuditoriaOS;
                  newS.mecAtribuidoPorId = newS.mecAtribuidoPorId || usuarioAuditoriaOS.id;
                  newS.mecAtribuidoPorNome = newS.mecAtribuidoPorNome || usuarioAuditoriaOS.nome;
                  newS.mecAtribuidoPorPerfil = newS.mecAtribuidoPorPerfil || usuarioAuditoriaOS.perfil;
                  newS.mecNome = newS.mecNome || mec.nome || '';
              }
              tl.push(eventoEstruturadoOS('servico_adicionado', `Adicionou serviço: ${newS.desc}`, {
                  servicoDescricao: newS.desc || newS.descricao || '', servicoValor: numBR(newS.valorFinal ?? newS.valor ?? 0),
                  mecanicoId: mecanicoNovoServicoInicial, mecanicoNome: newS.mecNome || snapshotMecanicoOS(mecanicoNovoServicoInicial, payload).nome || ''
              }));
              if (mecanicoNovoServicoInicial) {
                  const mecNome = newS.mecNome || snapshotMecanicoOS(mecanicoNovoServicoInicial, payload).nome || mecanicoNovoServicoInicial;
                  tl.push(eventoEstruturadoOS('mecanico_relacionado_servico', `Relacionou o mecânico ${mecNome} ao serviço "${newS.desc}".`, {
                      servicoDescricao: newS.desc || newS.descricao || '', mecanicoId: mecanicoNovoServicoInicial, mecanicoNome: mecNome
                  }));
              }
              registouAlgo = true;
          } else {
              ['mecAtribuidoEm','mecAtribuidoPorId','mecAtribuidoPorNome','mecAtribuidoPorPerfil'].forEach(k => {
                  if ((newS[k] == null || newS[k] === '') && oldS[k] != null && oldS[k] !== '') newS[k] = oldS[k];
              });
              if (numBR(oldS.valor || 0) !== numBR(newS.valor || 0)) {
                  addAuditoriaCampo(`Alterou valor do servico "${newS.desc}" para R$ ${(newS.valor||0).toFixed(2).replace('.', ',')}`);
              }
              if (numBR(oldS.tempo || 0) !== numBR(newS.tempo || 0)) {
                  addAuditoriaCampo(`Alterou horas/TMO do servico "${newS.desc}" de ${String(oldS.tempo || 0).replace('.', ',')}h para ${String(newS.tempo || 0).replace('.', ',')}h`);
              }
              if ((oldS.secaoHora || '') !== (newS.secaoHora || '') || (oldS.secaoHoraLabel || '') !== (newS.secaoHoraLabel || '')) {
                  addAuditoriaCampo(`Alterou secao de mao de obra do servico "${newS.desc}" de "${oldS.secaoHoraLabel || oldS.sistemaTabela || '-'}" para "${newS.secaoHoraLabel || newS.sistemaTabela || '-'}"`);
              }
              if (numBR(oldS.valorHora || 0) !== numBR(newS.valorHora || 0)) {
                  addAuditoriaCampo(`Alterou valor/hora do servico "${newS.desc}" de R$ ${numBR(oldS.valorHora || 0).toFixed(2).replace('.', ',')} para R$ ${numBR(newS.valorHora || 0).toFixed(2).replace('.', ',')}`);
              }
              const oldMecServico = oldS.mecId || oldS.mecanicoId || oldS.responsavelId || oldOS.mecId || '';
              const newMecServico = newS.mecId || newS.mecanicoId || newS.responsavelId || payload.mecId || '';
              if (String(oldMecServico) !== String(newMecServico)) {
                  const oldMecNome = snapshotMecanicoOS(oldMecServico, oldOS).nome || '-';
                  const newMecNome = snapshotMecanicoOS(newMecServico, payload).nome || '-';
                  addAuditoriaCampo(`Alterou responsável do serviço "${newS.desc}" de "${oldMecNome}" para "${newMecNome}"`);
                  newS.mecAtribuidoEm = agoraAuditoriaOS;
                  newS.mecAtribuidoPorId = usuarioAuditoriaOS.id;
                  newS.mecAtribuidoPorNome = usuarioAuditoriaOS.nome;
                  newS.mecAtribuidoPorPerfil = usuarioAuditoriaOS.perfil;
                  tl.push(eventoEstruturadoOS('mecanico_relacionado_servico', `Alterou responsável do serviço "${newS.desc}" de ${oldMecNome} para ${newMecNome}.`, {
                      servicoDescricao: newS.desc || newS.descricao || '', mecanicoId: newMecServico, mecanicoNome: newMecNome,
                      mecanicoAnteriorId: oldMecServico, mecanicoAnteriorNome: oldMecNome
                  }));
                  registouAlgo = true;
              }
          }
      });
      
      oldServicos.forEach(oldS => {
           const descOld = (oldS.desc || '').toLowerCase().trim();
           const newS = newServicos.find(s => (s.desc || '').toLowerCase().trim() === descOld);
           if (!newS) {
               tl.push(eventoEstruturadoOS('servico_removido', `Removeu serviço: ${oldS.desc}`, {
                   servicoDescricao: oldS.desc || oldS.descricao || '', mecanicoId: oldS.mecId || oldS.mecanicoId || oldS.responsavelId || '',
                   mecanicoNome: oldS.mecNome || oldS.mecanicoNome || oldS.responsavelNome || ''
               }));
               registouAlgo = true;
           }
      });

      // 6. Novas Fotos/Evidências
      const oldMediaLength = (oldOS.media || oldOS.fotos || []).length;
      const newMediaLength = (payload.media || []).length;
      if (newMediaLength > oldMediaLength) {
          const adicionadas = newMediaLength - oldMediaLength;
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Anexou ${adicionadas} nova(s) foto(s)/vídeo(s) de evidência.` });
          registouAlgo = true;
      } else if (newMediaLength < oldMediaLength) {
          const removidas = oldMediaLength - newMediaLength;
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Removeu ${removidas} foto(s)/vídeo(s) de evidência.` });
          registouAlgo = true;
      }

      // Fallback operacional: se nada entrou no histórico da OS e também não foi
      // alteração de campo auditável, mantém um registro mínimo de edição.
      if (!registouAlgo && !alterouCampoAuditavel) {
          tl.push({ dt: new Date().toISOString(), user: funcUser, acao: `Atualizou os detalhes gerais da Ordem de Serviço.` });
      }
      
  } else {
      // Criação de Nova O.S. — preserva o evento legado e acrescenta auditoria estruturada dos dados iniciais.
      tl = JSON.parse($('osTimelineData')?.value || '[]');
      tl.push(eventoEstruturadoOS('os_aberta', `Abriu a O.S. (Status inicial: ${STATUS_MAP_LEGACY[payload.status] || payload.status})`, {
          statusNovo: payload.status || ''
      }));
      idsMecanicosDocumentoOS(payload).forEach(id => {
          const mec = snapshotMecanicoOS(id, payload);
          tl.push(eventoEstruturadoOS('mecanico_relacionado_os', `Relacionou o mecânico ${mec.nome || id} à O.S.`, {
              mecanicoId: id, mecanicoNome: mec.nome || id, origemEvento: 'criacao_os'
          }));
      });
      (payload.pecas || []).forEach(p => {
          preservarMetaLancamentoOS(p, null, 'peca');
          tl.push(eventoEstruturadoOS('peca_adicionada', `Adicionou peça: ${p.desc || p.descricao || '-'} (Qtd: ${p.qtd || 0})`, {
              pecaCodigo: p.codigo || p.codigoExibicao || '', pecaDescricao: p.desc || p.descricao || '',
              quantidade: numBR(p.qtd || 0), estoqueId: p.estoqueId || '', nf: p.nf || p.nfNumero || '', fornecedor: p.fornecedor || ''
          }));
      });
      (payload.servicos || []).forEach(sv => {
          preservarMetaLancamentoOS(sv, null, 'servico');
          const mid = sv.mecId || sv.mecanicoId || sv.responsavelId || '';
          const mn = sv.mecNome || sv.mecanicoNome || sv.responsavelNome || snapshotMecanicoOS(mid, payload).nome || '';
          if (mid) {
              sv.mecAtribuidoEm = sv.mecAtribuidoEm || agoraAuditoriaOS;
              sv.mecAtribuidoPorId = sv.mecAtribuidoPorId || usuarioAuditoriaOS.id;
              sv.mecAtribuidoPorNome = sv.mecAtribuidoPorNome || usuarioAuditoriaOS.nome;
              sv.mecAtribuidoPorPerfil = sv.mecAtribuidoPorPerfil || usuarioAuditoriaOS.perfil;
          }
          tl.push(eventoEstruturadoOS('servico_adicionado', `Adicionou serviço: ${sv.desc || sv.descricao || '-'}`, {
              servicoDescricao: sv.desc || sv.descricao || '', servicoValor: numBR(sv.valorFinal ?? sv.valor ?? 0), mecanicoId: mid, mecanicoNome: mn
          }));
          if (mid) tl.push(eventoEstruturadoOS('mecanico_relacionado_servico', `Relacionou o mecânico ${mn || mid} ao serviço "${sv.desc || sv.descricao || '-'}".`, {
              servicoDescricao: sv.desc || sv.descricao || '', mecanicoId: mid, mecanicoNome: mn || mid
          }));
      });
      if (payload.status === 'Entregue') {
          payload.finalizadoEm = payload.finalizadoEm || agoraAuditoriaOS;
          payload.finalizadoPor = payload.finalizadoPor || funcUser;
      }
  }

  if (registroReaberturaAprovacaoOS) {
      tl.push({
          dt: new Date().toISOString(),
          user: funcUser,
          acao: `Reabriu a O.S. para edição/reorçamento. Aprovação ativa arquivada ao voltar para ${payload.status}.`
      });
  }

  if (payload.aprovacao && !isFirestoreSentinelOS(payload.aprovacao) && !oldOSParaAprovacao.aprovacao) {
      tl.push({
          dt: new Date().toISOString(),
          user: funcUser,
          acao: `Orcamento aprovado (${payload.aprovacao.status}) - ${(payload.aprovacao.itens || []).length} item(ns) - Total aprovado ${moeda(payload.aprovacao.totalAprovado || 0)}`
      });
  }

  payload.timeline = tl;
  // --- FIM: DEEP DIFF ---

  // ═══════════════════════════════════════════════════════════════════
  // CORREÇÃO 2: Persistir campos de pagamento SEMPRE no payload,
  //             independente de status ou mecânico atribuído.
  //             Antes: só persistia dentro do gating Pronto+mecId,
  //             então OS sem mecânico perdia a forma de pagamento.
  // ═══════════════════════════════════════════════════════════════════
  payload.pgtoForma    = $v('osPgtoForma') || '';
  payload.pgtoData     = $v('osPgtoData') || '';
  payload.pgtoParcelas = parcelasPagamentoOS(payload.pgtoForma, $v('osPgtoParcelas') || 1);
  payload.pgtoCombinado = formaPagamentoCombinadaOS(payload.pgtoForma) ? coletarPagamentosCombinadosOS() : [];
  if (formaPagamentoCombinadaOS(payload.pgtoForma)) payload.pgtoParcelas = 1;

  // Comissão por serviço e mecânico. mecId continua sendo o responsável
  // principal para compatibilidade e para a comissão de peças.
  const _statusFinal = statusFinalComissaoOS;
  const payloadBaseComissaoOS = Object.assign({}, oldOSParaAprovacao || {}, payload, {
    servicos: payload.servicos || oldOSParaAprovacao.servicos || [],
    pecas: payload.pecas || oldOSParaAprovacao.pecas || [],
    execucaoItens: payload.execucaoItens || oldOSParaAprovacao.execucaoItens || {},
    aprovacao: isFirestoreSentinelOS(payload.aprovacao) ? oldOSParaAprovacao.aprovacao : (payload.aprovacao || oldOSParaAprovacao.aprovacao),
    itensAprovados: isFirestoreSentinelOS(payload.itensAprovados)
      ? (oldOSParaAprovacao.itensAprovados || [])
      : (payload.itensAprovados || oldOSParaAprovacao.itensAprovados || [])
  });
  const comissoesOSCalculadas = _statusFinal
    ? calcularComissoesPorMecanicoOS(payloadBaseComissaoOS, totalPecas)
    : [];
  payload.comissoesCalculadas = comissoesOSCalculadas;

  // ═══════════════════════════════════════════════════════════════════
  // BLOCO RECEBIMENTO FINANCEIRO (CORREÇÃO 1)
  // Grava SEMPRE que o usuário preencheu Forma de Pagamento + Data,
  // independente de status, independente de mecânico atribuído.
  // Esta é a regra correta: "registrei o recebimento" = vai pro caixa.
  // ═══════════════════════════════════════════════════════════════════
  const recebimentosAtivosMesmoPlanoOS = osId ? (window.J?.financeiro || []).filter(f =>
    f?.osId === osId &&
    !financeiroOSCanceladoOS(f) &&
    /^recebimento_os_/i.test(String(f.origem || ''))
  ) : [];
  const somaRecebimentosAtivosMesmoPlanoOS = +recebimentosAtivosMesmoPlanoOS.reduce((acc, f) => acc + numBR(f.valor || 0), 0).toFixed(2);
  const totalPlanoFinanceiroOS = numBR(
    (!isFirestoreSentinelOS(payload.totalAprovado) && payload.totalAprovado != null)
      ? payload.totalAprovado
      : (oldOSParaAprovacao.totalFaturado ?? oldOSParaAprovacao.totalAprovado ?? oldOSParaAprovacao.total ?? payload.total)
  );
  const pagamentoCombinadoAtualOS = formaPagamentoCombinadaOS(payload.pgtoForma);
  const financeiroCombinadoAtivoMesmoPlanoOS = pagamentoCombinadoAtualOS && recebimentosAtivosMesmoPlanoOS.length > 0 &&
    normalizarPagamentoOS(oldOSParaAprovacao.pgtoForma || '') === normalizarPagamentoOS(payload.pgtoForma || '') &&
    assinaturaPagamentoCombinadoOS(oldOSParaAprovacao.pgtoCombinado || []) === assinaturaPagamentoCombinadoOS(payload.pgtoCombinado || []) &&
    Math.abs(somaRecebimentosAtivosMesmoPlanoOS - totalPlanoFinanceiroOS) < 0.01;
  const financeiroAtivoMesmoPlanoOS = financeiroCombinadoAtivoMesmoPlanoOS || (!pagamentoCombinadoAtualOS && recebimentosAtivosMesmoPlanoOS.length > 0 &&
    normalizarPagamentoOS(oldOSParaAprovacao.pgtoForma || '') === normalizarPagamentoOS(payload.pgtoForma || '') &&
    String(oldOSParaAprovacao.pgtoData || '') === String(payload.pgtoData || '') &&
    parcelasPagamentoOS(oldOSParaAprovacao.pgtoForma || '', oldOSParaAprovacao.pgtoParcelas || 1) === payload.pgtoParcelas &&
    Math.abs(somaRecebimentosAtivosMesmoPlanoOS - totalPlanoFinanceiroOS) < 0.01);

  if (payload.pgtoForma && (payload.pgtoData || pagamentoCombinadoAtualOS) && !financeiroAtivoMesmoPlanoOS) {
      // Conceitos:
      //  • formaRecebimento (como cliente pagou): Dinheiro, PIX, Débito,
      //    Crédito (1x / 2x / 3x...), Boleto, Crediário próprio
      //  • Do ponto de vista do CLIENTE, se pagou no cartão, está QUITADO
      //  • Do ponto de vista da OFICINA, se foi cartão de crédito Nx, ela
      //    vai receber N parcelas DA OPERADORA (não do cliente)
      //  • Se foi Boleto/Crediário próprio, aí sim o CLIENTE deve em N parcelas
      const formasAVistaCliente = ['Dinheiro', 'PIX', 'Débito'];     // cliente paga e pronto
      const formasCartaoCredito = ['Crédito à Vista', 'Crédito', 'Crédito Parcelado']; // cliente quita, operadora paga a oficina em parcelas
      const formasCreditoOficina = ['Boleto', 'Crediário', 'Boleto (Pendente)']; // cliente DEVE parcelas à oficina

      {
        const parcelas = parcelasPagamentoOS(payload.pgtoForma, payload.pgtoParcelas);
        // Valor financeiro real da OS:
        // - Quando há aprovação, totalAprovado representa somente itens aprovados do orçamento.
        // - Deslocamento/guincho é uma cobrança independente e deve entrar no financeiro quando ativo.
        // - Quando não há aprovação, payload.total já é o total geral da OS e já inclui guincho, então não soma novamente.
        const possuiTotalAprovadoAtual = !isFirestoreSentinelOS(payload.totalAprovado) && payload.totalAprovado != null;
        const possuiTotalAprovadoAnterior = oldOSParaAprovacao && oldOSParaAprovacao.totalAprovado != null;
        const baseFinanceiro = numBR(possuiTotalAprovadoAtual ? payload.totalAprovado : (reabrindoParaEdicaoOS ? payload.total : (possuiTotalAprovadoAnterior ? oldOSParaAprovacao.totalAprovado : payload.total)));
        const guinchoFinanceiro = (possuiTotalAprovadoAtual || possuiTotalAprovadoAnterior)
          ? numBR((payload.deslocamentoGuincho && payload.deslocamentoGuincho.ativo) ? (payload.totalGuincho || payload.deslocamentoGuincho.total || 0) : 0)
          : 0;
        const valorFinanceiro = +(baseFinanceiro + guinchoFinanceiro).toFixed(2);
        payload.totalFaturado = valorFinanceiro;
        payload.totalGuinchoFinanceiro = guinchoFinanceiro;
        if (guinchoFinanceiro > 0 && (possuiTotalAprovadoAtual || possuiTotalAprovadoAnterior)) {
          payload.totalAprovadoComGuincho = valorFinanceiro;
        }
        if (pagamentoCombinadoAtualOS) {
          const somaCombinadaOS = +(payload.pgtoCombinado || []).reduce((s, p) => s + numBR(p.valor || 0), 0).toFixed(2);
          if (!payload.pgtoCombinado.length) {
            window.toast('Informe pelo menos uma forma no recebimento combinado.', 'warn');
            return;
          }
          if (Math.abs(somaCombinadaOS - valorFinanceiro) > 0.01) {
            window.toast(`Recebimento combinado divergente: soma ${moeda(somaCombinadaOS)} e total da O.S. ${moeda(valorFinanceiro)}.`, 'warn');
            return;
          }
        }
        const placaRef  = payload.placa || J.veiculos.find(v => v.id === payload.veiculoId)?.placa || '';
        const cliRef    = J.clientes.find(c => c.id === payload.clienteId)?.nome || payload.cliente || '';

        const pgtoBase = payload.pgtoForma.trim();
        const pgtoNorm = normalizarPagamentoOS(pgtoBase);
        const ehAVistaCliente = pgtoNorm.includes('pix') || pgtoNorm.includes('dinheiro') || pgtoNorm.includes('debito');
        const ehCreditoOperadora = formaPagamentoParcelaOperadoraOS(pgtoBase) || (pgtoNorm.includes('credito') && !pgtoNorm.includes('boleto') && !pgtoNorm.includes('crediario'));
        const ehCreditoOficina = formaPagamentoParcelaClienteOS(pgtoBase);
        let valorJaLiquidadoOS = 0;

        // Preserva histórico financeiro: nunca apaga recebimento pago/liquidado.
        // Lançamentos pendentes antigos são cancelados com auditoria de reemissão.
        if (osId) {
          try {
            const snap = await db.collection('financeiro')
              .where('tenantId', '==', J.tid)
              .where('osId', '==', osId)
              .get();
            for (const docSnap of snap.docs) {
              const finAntes = { id: docSnap.id, ...docSnap.data() };
              if (financeiroOSLiquidadoOS(finAntes)) {
                valorJaLiquidadoOS += numBR(finAntes.valor || 0);
                continue;
              }
              if (financeiroOSCanceladoOS(finAntes)) continue;
              queueFinanceiroUpdateOS(db.collection('financeiro').doc(docSnap.id), {
                status: 'Cancelado',
                canceladoPorReemissaoOS: true,
                canceladoEm: new Date().toISOString(),
                motivoCancelamento: 'Reemissão/atualização financeira da O.S. sem apagar histórico',
                dadosAntesCancelamento: finAntes
              });
              if (typeof window.thiaAudit === 'function') {
                auditoriasFinanceiroDepoisCommitOS.push(() => window.thiaAudit(
                  'cancelou_financeiro_pendente_por_reemissao_os',
                  'financeiro',
                  docSnap.id,
                  finAntes,
                  { status: 'Cancelado' },
                  'Reemissão financeira da O.S.',
                  { osId: targetOsId }
                ));
              }
            }
          } catch(e) { console.warn('Reconciliação financeiro OS:', e); }
        }

        const valorFinanceiroLancamentoOS = Math.max(+(valorFinanceiro - valorJaLiquidadoOS).toFixed(2), 0);
        const deveLancarFinanceiroOS = valorFinanceiroLancamentoOS > 0.009;
        const complementoFinanceiroOS = valorJaLiquidadoOS > 0 && deveLancarFinanceiroOS;
        const valorParc = valorFinanceiroLancamentoOS / parcelas;
        const descBaseFinanceiroOS = `${complementoFinanceiroOS ? 'Complemento O.S.' : 'O.S.'} ${placaRef} — ${cliRef}`;

        if (!deveLancarFinanceiroOS) {
          payload.pgtoResumoCliente = payload.pgtoResumoCliente || 'Financeiro já liquidado anteriormente';
        }

        if (deveLancarFinanceiroOS) {
        // Decide o tipo de fluxo financeiro pela forma de pagamento
        if (pagamentoCombinadoAtualOS) {
          const partes = payload.pgtoCombinado || [];
          const temCreditoCliente = partes.some(p => formaPagamentoParcelaClienteOS(p.forma));
          payload.pgtoQuitado = !temCreditoCliente;
          payload.pgtoResumoCliente = partes.map(p => `${p.forma}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''}: ${moeda(p.valor)}`).join(' + ');

          for (const parte of partes) {
            const formaParte = parte.forma || 'A Combinar';
            const formaNormParte = normalizarPagamentoOS(formaParte);
            const parcParte = parcelasPagamentoComponenteOS(formaParte, parte.parcelas || 1);
            const valorParte = numBR(parte.valor || 0);
            const dataParte = parte.data || payload.pgtoData || dataLocalISOOS();
            const parteAVista = formaNormParte.includes('pix') || formaNormParte.includes('dinheiro') || formaNormParte.includes('debito');
            const parteCartao = formaPagamentoParcelaOperadoraOS(formaParte) || (formaNormParte.includes('credito') && !formaNormParte.includes('boleto') && !formaNormParte.includes('crediario'));
            const parteCreditoOficina = formaPagamentoParcelaClienteOS(formaParte);
            if (parteAVista) {
              queueFinanceiroAddOS({
                tenantId: J.tid, tipo: 'Entrada', status: 'Pago',
                desc: `${descBaseFinanceiroOS} — parte ${parte.indice || ''} (${formaParte})`,
                valor: valorParte, pgto: formaParte, venc: dataParte, dataPgto: dataParte,
                osId: targetOsId, clienteId: payload.clienteId || null,
                quitadoPeloCliente: true, origem: 'recebimento_os_combinado',
                parteCombinada: parte, valorTotalOS: valorFinanceiro, valorJaLiquidadoOS, complementoFinanceiroOS,
                createdAt: new Date().toISOString()
              });
            } else if (parteCartao) {
              const valorParcelaParte = valorParte / parcParte;
              for (let i = 0; i < parcParte; i++) {
                queueFinanceiroAddOS({
                  tenantId: J.tid, tipo: 'Entrada', status: 'A Receber',
                  desc: `Recebimento operadora — ${descBaseFinanceiroOS} — ${formaParte} ${parcParte > 1 ? `(${i + 1}/${parcParte})` : ''}`,
                  valor: valorParcelaParte, pgto: formaParte, venc: somarDiasISOOS(dataParte, 30 * (i + 1)),
                  osId: targetOsId, clienteId: payload.clienteId || null,
                  quitadoPeloCliente: true, aReceberDe: 'Operadora de Cartão', origem: 'recebimento_os_combinado',
                  parteCombinada: parte, valorTotalOS: valorFinanceiro, valorJaLiquidadoOS, complementoFinanceiroOS,
                  createdAt: new Date().toISOString()
                });
              }
            } else if (parteCreditoOficina) {
              const valorParcelaParte = valorParte / parcParte;
              for (let i = 0; i < parcParte; i++) {
                queueFinanceiroAddOS({
                  tenantId: J.tid, tipo: 'Entrada', status: 'Pendente',
                  desc: `${descBaseFinanceiroOS} — ${formaParte} ${parcParte > 1 ? `(${i + 1}/${parcParte})` : ''}`,
                  valor: valorParcelaParte, pgto: formaParte, venc: somarMesesISOOS(dataParte, i),
                  osId: targetOsId, clienteId: payload.clienteId || null,
                  quitadoPeloCliente: false, aReceberDe: 'Cliente', origem: 'recebimento_os_combinado',
                  parteCombinada: parte, valorTotalOS: valorFinanceiro, valorJaLiquidadoOS, complementoFinanceiroOS,
                  createdAt: new Date().toISOString()
                });
              }
            } else {
              queueFinanceiroAddOS({
                tenantId: J.tid, tipo: 'Entrada', status: 'Pendente',
                desc: `${descBaseFinanceiroOS} — parte ${parte.indice || ''} (${formaParte})`,
                valor: valorParte, pgto: formaParte, venc: dataParte,
                osId: targetOsId, clienteId: payload.clienteId || null,
                quitadoPeloCliente: false, origem: 'recebimento_os_combinado',
                parteCombinada: parte, valorTotalOS: valorFinanceiro, valorJaLiquidadoOS, complementoFinanceiroOS,
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (ehAVistaCliente || formasAVistaCliente.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ CLIENTE PAGOU À VISTA (Dinheiro/PIX/Débito) ═══
          payload.pgtoQuitado = true;
          payload.pgtoResumoCliente = `${pgtoBase} à vista`;
          queueFinanceiroAddOS({
            tenantId:  J.tid,
            tipo:      'Entrada',
            status:    'Pago',
            desc:      descBaseFinanceiroOS,
            valor:     valorFinanceiroLancamentoOS,
            pgto:      pgtoBase,
            venc:      payload.pgtoData,
            dataPgto:  payload.pgtoData,
            osId:      osId || null,
            clienteId: payload.clienteId || null,
            quitadoPeloCliente: true,
            origem: 'recebimento_os_avista',
            valorTotalOS: valorFinanceiro,
            valorJaLiquidadoOS,
            complementoFinanceiroOS,
            createdAt: new Date().toISOString()
          });

        } else if (ehCreditoOperadora || formasCartaoCredito.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ CARTÃO DE CRÉDITO Nx ═══
          payload.pgtoQuitado = true;
          payload.pgtoResumoCliente = parcelas > 1
            ? `Cartão de Crédito em ${parcelas}x`
            : `Cartão de Crédito à vista`;

          for (let i = 0; i < parcelas; i++) {
            const vencParcela = somarDiasISOOS(payload.pgtoData, 30 * (i + 1));
            queueFinanceiroAddOS({
              tenantId:   J.tid,
              tipo:       'Entrada',
              status:     'A Receber',
              desc:       `Recebimento operadora — ${descBaseFinanceiroOS} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
              valor:      valorParc,
              pgto:       pgtoBase,
              venc:       vencParcela,
              osId:       osId || null,
              clienteId:  payload.clienteId || null,
              quitadoPeloCliente: true,
              aReceberDe: 'Operadora de Cartão',
              origem: 'recebimento_os_cartao',
              valorTotalOS: valorFinanceiro,
              valorJaLiquidadoOS,
              complementoFinanceiroOS,
              createdAt: new Date().toISOString()
            });
          }

        } else if (ehCreditoOficina || formasCreditoOficina.some(f => pgtoBase.toLowerCase().includes(f.toLowerCase()))) {
          // ═══ BOLETO / CREDIÁRIO PRÓPRIO ═══
          payload.pgtoQuitado = false;
          payload.pgtoResumoCliente = parcelas > 1
            ? `${pgtoBase} em ${parcelas}x (pendente)`
            : `${pgtoBase} (pendente)`;

          for (let i = 0; i < parcelas; i++) {
            const vencParcela = somarMesesISOOS(payload.pgtoData, i);
            queueFinanceiroAddOS({
              tenantId:   J.tid,
              tipo:       'Entrada',
              status:     'Pendente',
              desc:       `${descBaseFinanceiroOS} ${parcelas > 1 ? `(${i + 1}/${parcelas})` : ''}`,
              valor:      valorParc,
              pgto:       pgtoBase,
              venc:       vencParcela,
              osId:       osId || null,
              clienteId:  payload.clienteId || null,
              quitadoPeloCliente: false,
              aReceberDe: 'Cliente',
              origem: 'recebimento_os_credito_oficina',
              valorTotalOS: valorFinanceiro,
              valorJaLiquidadoOS,
              complementoFinanceiroOS,
              createdAt: new Date().toISOString()
            });
          }

        } else {
          // ═══ OUTRAS FORMAS / INDEFINIDO ═══
          payload.pgtoQuitado = false;
          payload.pgtoResumoCliente = `${pgtoBase} — verificar`;
          queueFinanceiroAddOS({
            tenantId:  J.tid,
            tipo:      'Entrada',
            status:    'Pendente',
            desc:      descBaseFinanceiroOS,
            valor:     valorFinanceiroLancamentoOS,
            pgto:      pgtoBase,
            venc:      payload.pgtoData,
            osId:      osId || null,
            clienteId: payload.clienteId || null,
            quitadoPeloCliente: false,
            origem: 'recebimento_os_outros',
            valorTotalOS: valorFinanceiro,
            valorJaLiquidadoOS,
            complementoFinanceiroOS,
            createdAt: new Date().toISOString()
          });
        }
        }
      }
  }
  // FIM bloco recebimento financeiro

  if (!osId) {
    payload.createdAt = new Date().toISOString();
    payload.pin = Math.floor(1000 + Math.random() * 9000).toString();
  }
  const payloadFirestore = limparUndefinedFirestoreOS(payload);
  if (osId) batchSalvarOS.update(osRefSalvar, payloadFirestore);
  else batchSalvarOS.set(osRefSalvar, payloadFirestore);
  operacoesBatchSalvarOS += 1;

  await batchSalvarOS.commit();
  const savedOsId = targetOsId;
  if (document.getElementById('osId')) document.getElementById('osId').value = savedOsId;

  if (osId) {
    window.toast('✓ O.S. ATUALIZADA');
    audit('OS', `Editou OS ${savedOsId.slice(-6)}`);
  } else {
    window.toast('✓ O.S. CRIADA');
    audit('OS', `Criou OS para ${payload.placa || payload.cliente || J.clientes.find(c => c.id === payload.clienteId)?.nome}`);
  }

  const tarefasPosGravacaoOS = [
    reconciliarComissoesOS(savedOsId, payload, comissoesOSCalculadas)
  ];
  if (auditoriasFinanceiroDepoisCommitOS.length) {
    tarefasPosGravacaoOS.push(Promise.allSettled(
      auditoriasFinanceiroDepoisCommitOS.map(executar => Promise.resolve().then(executar))
    ));
  }
  if (auditoriaGeralOS.length) {
    tarefasPosGravacaoOS.push(Promise.allSettled(
      auditoriaGeralOS.map(acao => auditGeralOS(savedOsId, acao))
    ));
  }
  if (_pecasReais.length > 0 || (oldOSParaAprovacao.pecasReais || []).length > 0) {
    tarefasPosGravacaoOS.push(
      Promise.resolve(window.baixarEstoquePecasReais?.(savedOsId, oldOSParaAprovacao.pecasReais || [], _pecasReais))
    );
  }
  await Promise.all(tarefasPosGravacaoOS);

  // CHECKLIST INTELIGENTE V15.11 — após salvar a O.S., atualiza o bloco do checklist
  // se o modal permanecer aberto em "Salvar e continuar". O update do Firestore preserva
  // checklistId/checklistResumo/checklistAtualizadoEm quando estes campos já existem.
  setTimeout(() => {
    try { window.renderChecklistInteligenteOS?.(); } catch (e) { console.warn('[Checklist Inteligente OS] render hook salvarOS', e); }
  }, 350);

  if (!window._salvarContinuarOSAtivo && typeof window.fecharModal === 'function') window.fecharModal('modalOS');
  if (window._salvarContinuarOSAtivo) {
    window.toast('✓ O.S. SALVA — continue editando', 'ok');
    window._salvarContinuarOSAtivo = false;
  }

  // Disparo de WhatsApp quando o gestor/admin confirmar que esta pronto.
  if (dispararAvisoPronto && savedOsId) {
      setTimeout(() => {
          window.registrarAvisoClienteCRMOS?.(savedOsId, 'Pronto', { origem: 'salvar_os', osPatch: payload });
          if (usuarioPodeDispararWppProntoOS()) window.dispararAvisoEntregaAutomatico?.(savedOsId, 'Pronto');
      }, 500);
  }

  // Disparo de WhatsApp quando o gestor/caixa confirmar entrega.
  if (dispararAvisoEntrega && payload.clienteId) {
      setTimeout(() => {
          window.registrarAvisoClienteCRMOS?.(savedOsId, 'Entregue', { origem: 'salvar_os', osPatch: payload });
          if (usuarioPodeDispararWppProntoOS()) window.dispararAvisoEntregaAutomatico?.(savedOsId, 'Entregue');
          return;
          if (confirm('A O.S. foi marcada como ENTREGUE. Deseja avisar o cliente via WhatsApp agora?')) {
              const cli = J.clientes.find(c => c.id === payload.clienteId);
              if (cli && cli.wpp) {
                  const fone = cli.wpp.replace(/\D/g, '');
                  const vLabel = payload.placa || J.veiculos.find(v => v.id === payload.veiculoId)?.placa || 'seu veículo';
                  const msg = `Olá ${cli.nome.split(' ')[0]}! 👋\n\nPassando para avisar que o serviço no *${vLabel}* já foi concluído e está *${STATUS_MAP_LEGACY[payload.status]}* na oficina ${J.tnome}.\n\nAgradecemos a confiança!`;
                  if (typeof window.thiaOpenWhatsApp === 'function') window.thiaOpenWhatsApp(fone, msg);
                  else window.open(`https://web.whatsapp.com/send?phone=55${fone}&text=${encodeURIComponent(msg)}`, '_blank');
              } else {
                  window.toast('⚠ Cliente não possui WhatsApp cadastrado.', 'warn');
              }
          }
      }, 500);
  }
};

window.salvarOSContinuar = async function() {
  window._salvarContinuarOSAtivo = true;
  try { await window.salvarOS(); }
  finally { window._salvarContinuarOSAtivo = false; }
};

// ═══════════════════════════════════════════════════════════════
// GALERIA DE PROVAS — UPLOAD LEGADO (1 por vez) — MANTIDO COMO FALLBACK
// ═══════════════════════════════════════════════════════════════
window.uploadOsMedia = async function() {
  const f = $('osFileInput')?.files[0]; if (!f) return;
  const btn = $('btnUploadMedia'); btn.innerText = 'ENVIANDO...'; btn.disabled = true;
  try {
    const fd = new FormData(); fd.append('file', f); fd.append('upload_preset', J.cloudPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.secure_url) {
      const media = JSON.parse($('osMediaArray').value || '[]');
      media.push({ url: data.secure_url, type: data.resource_type });
      $('osMediaArray').value = JSON.stringify(media); window.renderMediaOS(); window.toast('✓ UPLOAD CONCLUÍDO');
    }
  } catch (e) { window.toast('✕ ERRO UPLOAD', 'err'); }
  btn.innerText = 'ENVIAR FILA'; btn.disabled = false;
};

// ═══════════════════════════════════════════════════════════════
// CORREÇÃO #4: GALERIA DE PROVAS — BATCH UPLOAD
// Powered by thIAguinho Soluções Digitais
// ═══════════════════════════════════════════════════════════════

// Estado local do preview (arquivos ainda não enviados).
// Acumulativo: o mecânico pode bater foto, bater outra, abrir novamente
// sem perder as anteriores.
window._osBatchFiles = [];

window.abrirCameraOS = function() {
  const input = $('osFileInput');
  if (!input) return;
  input.setAttribute('accept', 'image/*');
  input.setAttribute('capture', 'environment');
  input.multiple = false;
  try { input.value = ''; } catch(e){}
  input.click();
};

window.abrirGaleriaOS = function() {
  const input = $('osFileInput');
  if (!input) return;
  input.setAttribute('accept', 'image/*,video/*');
  input.removeAttribute('capture');
  input.multiple = true;
  try { input.value = ''; } catch(e){}
  input.click();
};

window.comprimirImagemOS = async function(file) {
  if (!file || !/^image\//.test(file.type || '') || /gif$/i.test(file.type || '')) return file;
  if (file.size && file.size < 380 * 1024) return file;
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob || (file.size && blob.size >= file.size)) return resolve(file);
          const safeName = String(file.name || 'foto-os.jpg').replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], safeName, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', 0.74);
      } catch(e) {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

window.uploadCloudinaryOSFile = async function(file) {
  const finalFile = await window.comprimirImagemOS(file);
  const fd = new FormData();
  fd.append('file', finalFile);
  fd.append('upload_preset', J.cloudPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/auto/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data || !data.secure_url) throw new Error(data?.error?.message || 'Falha no upload.');
  return {
    url: data.secure_url,
    type: data.resource_type || (/^video\//.test(file.type || '') ? 'video' : 'image'),
    name: file.name || '',
    bytes: data.bytes || finalFile.size || file.size || 0,
    uploadedAt: new Date().toISOString()
  };
};

window.uploadOsMediaComLimite = async function(files, limit, onProgress) {
  const fila = Array.from(files || []);
  const results = new Array(fila.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < fila.length) {
      const idx = cursor++;
      try {
        results[idx] = { ok: true, item: await window.uploadCloudinaryOSFile(fila[idx]) };
      } catch (e) {
        results[idx] = { ok: false, error: e };
      }
      done++;
      if (typeof onProgress === 'function') onProgress(done, fila.length);
    }
  }
  const workers = Array.from({ length: Math.min(limit || 2, fila.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

// Dispara quando o mecânico seleciona 1+ arquivos no input.
// Acumula em _osBatchFiles e renderiza grid de prévia.
window.previewOsMediaBatch = function(input) {
  if (!input || !input.files || !input.files.length) { window.renderOsMediaPreview(); return; }
  const novos = Array.from(input.files);
  window._osBatchFiles = window._osBatchFiles.concat(novos);
  // Libera o input para que o usuário possa selecionar/tirar mais fotos
  try { input.value = ''; } catch(e){}
  window.renderOsMediaPreview();
};

window.renderOsMediaPreview = function() {
  const wrap = $('osMediaPreviewLocal');
  const grid = $('osMediaPreviewGrid');
  const count = $('osMediaPreviewCount');
  if (!wrap || !grid) return;

  if (!window._osBatchFiles || !window._osBatchFiles.length) {
    wrap.style.display = 'none';
    grid.innerHTML = '';
    if (count) count.innerText = '0';
    return;
  }

  wrap.style.display = 'block';
  if (count) count.innerText = window._osBatchFiles.length;

  grid.innerHTML = window._osBatchFiles.map((f, i) => {
    const isVideo = /^video\//.test(f.type || '');
    const url = URL.createObjectURL(f);
    const mediaEl = isVideo
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="prévia">`;
    return `<div class="media-item" data-idx="${i}">
      ${mediaEl}
      <button class="media-del" type="button" onclick="window.removerOsMediaPreview(${i})" title="Remover">✕</button>
    </div>`;
  }).join('');
};

window.removerOsMediaPreview = function(idx) {
  if (!window._osBatchFiles || idx < 0 || idx >= window._osBatchFiles.length) return;
  window._osBatchFiles.splice(idx, 1);
  window.renderOsMediaPreview();
};

window.limparOsMediaPreview = function() {
  window._osBatchFiles = [];
  try { const f = $('osFileInput'); if (f) f.value = ''; } catch(e){}
  window.renderOsMediaPreview();
  const prog = $('osMediaProgress'); if (prog) { prog.style.display = 'none'; prog.innerText = ''; }
};

// Sobe todos os arquivos do preview em lote, concatena com os já gravados,
// atualiza o hidden array e re-renderiza a galeria. Grava no Firestore
// somente quando o usuário clicar "SALVAR O.S." (via salvarOS).
window.uploadOsMediaBatch = async function() {
  // Se o input ainda tem seleção não absorvida, incorpora agora
  const fInput = $('osFileInput');
  if (fInput && fInput.files && fInput.files.length) {
    window._osBatchFiles = (window._osBatchFiles || []).concat(Array.from(fInput.files));
    try { fInput.value = ''; } catch(e){}
    window.renderOsMediaPreview();
  }

  if (!window._osBatchFiles || !window._osBatchFiles.length) {
    window.toast('⚠ Selecione ao menos um arquivo.', 'warn');
    return;
  }

  const btn = $('btnUploadMedia');
  const prog = $('osMediaProgress');
  if (btn) { btn.disabled = true; btn.innerText = 'ENVIANDO...'; }
  if (prog) { prog.style.display = 'inline'; prog.innerText = '0/' + window._osBatchFiles.length; }

  const total = window._osBatchFiles.length;
  const resultados = await window.uploadOsMediaComLimite(window._osBatchFiles, 2, (done, all) => {
    if (prog) prog.innerText = done + '/' + all;
  });
  const novasUrls = resultados.filter(r => r && r.ok && r.item).map(r => r.item);
  const sucesso = novasUrls.length;
  const falhas = total - sucesso;

  // Concatena com o que já estava gravado no hidden (em caso de edição de O.S.)
  const jaSalvo = JSON.parse($('osMediaArray').value || '[]');
  const final = jaSalvo.concat(novasUrls);
  $('osMediaArray').value = JSON.stringify(final);
  window.renderMediaOS();

  // Limpa o preview local (as prévias já viraram itens reais da galeria)
  window._osBatchFiles = [];
  window.renderOsMediaPreview();

  if (btn) { btn.disabled = false; btn.innerText = 'ENVIAR FILA'; }
  if (prog) { prog.style.display = 'none'; prog.innerText = ''; }

  if (sucesso && !falhas) window.toast(`✓ ${sucesso} arquivo(s) enviado(s). Salve a O.S. para persistir.`);
  else if (sucesso && falhas) window.toast(`⚠ ${sucesso} ok, ${falhas} falhou. Salve a O.S. para persistir o que deu certo.`, 'warn');
  else window.toast('✕ Nenhum arquivo enviado.', 'err');
};

window._osGaleriaFotoIndex = 0;
window._osGaleriaFotos = [];

window.fecharGaleriaFotosOS = function() {
  const overlay = document.getElementById('osGaleriaFotosOverlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', window._osGaleriaKeydown || (()=>{}));
};

window.renderGaleriaFotoOS = function() {
  const fotos = window._osGaleriaFotos || [];
  const overlay = document.getElementById('osGaleriaFotosOverlay');
  if (!overlay || !fotos.length) return;
  const idx = Math.max(0, Math.min(window._osGaleriaFotoIndex || 0, fotos.length - 1));
  window._osGaleriaFotoIndex = idx;
  const foto = fotos[idx];
  const img = overlay.querySelector('[data-os-galeria-img]');
  const count = overlay.querySelector('[data-os-galeria-count]');
  const prev = overlay.querySelector('[data-os-galeria-prev]');
  const next = overlay.querySelector('[data-os-galeria-next]');
  if (img) { img.src = foto.url; img.alt = `Foto ${idx + 1} da O.S.`; }
  if (count) count.textContent = `Foto ${idx + 1} de ${fotos.length}`;
  if (prev) prev.style.visibility = fotos.length > 1 ? 'visible' : 'hidden';
  if (next) next.style.visibility = fotos.length > 1 ? 'visible' : 'hidden';
};

window.navegarGaleriaFotosOS = function(delta) {
  const fotos = window._osGaleriaFotos || [];
  if (fotos.length <= 1) return;
  window._osGaleriaFotoIndex = (window._osGaleriaFotoIndex + Number(delta || 0) + fotos.length) % fotos.length;
  window.renderGaleriaFotoOS();
};

window.baixarFotoGaleriaOS = async function() {
  const foto = (window._osGaleriaFotos || [])[window._osGaleriaFotoIndex || 0];
  if (!foto?.url) return;
  const nomeUrl = String(foto.url).split('?')[0].split('/').pop() || `foto_os_${Date.now()}.jpg`;
  const nome = /\.[a-z0-9]{2,5}$/i.test(nomeUrl) ? nomeUrl : `${nomeUrl}.jpg`;
  try {
    const res = await fetch(foto.url, { mode:'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    await salvarBlobArquivoOS(blob, nome, blob.type || 'image/jpeg');
  } catch (e) {
    console.warn('[OS GALERIA] download via blob falhou; usando link direto.', e);
    const a = document.createElement('a');
    a.href = foto.url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
};

window.abrirGaleriaFotosOS = function(indiceMedia) {
  let media = [];
  try { media = JSON.parse($('osMediaArray')?.value || '[]'); } catch (_) { media = []; }
  const fotos = media.map((m, mediaIndex) => ({ ...m, mediaIndex }))
    .filter(m => m?.url && !/^video$/i.test(String(m.type || 'image')) && !/^video\//i.test(String(m.type || '')));
  if (!fotos.length) return;
  const pos = Math.max(0, fotos.findIndex(f => Number(f.mediaIndex) === Number(indiceMedia)));
  window._osGaleriaFotos = fotos;
  window._osGaleriaFotoIndex = pos;
  window.fecharGaleriaFotosOS();

  const overlay = document.createElement('div');
  overlay.id = 'osGaleriaFotosOverlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <div style="width:min(1100px,100%);height:min(90vh,850px);display:flex;flex-direction:column;position:relative;background:#090d12;border:1px solid rgba(0,212,255,.28);border-radius:8px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.65);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);">
        <strong data-os-galeria-count style="font-family:var(--fm);font-size:.75rem;color:var(--cyan);">Foto</strong>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn-ghost" onclick="window.baixarFotoGaleriaOS()">BAIXAR FOTO</button>
          <button type="button" class="btn-ghost" onclick="window.fecharGaleriaFotosOS()" aria-label="Fechar galeria">✕</button>
        </div>
      </div>
      <div data-os-galeria-area style="position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:pan-y;">
        <button data-os-galeria-prev type="button" onclick="window.navegarGaleriaFotosOS(-1)" aria-label="Foto anterior" style="position:absolute;left:10px;z-index:2;width:48px;height:64px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.55);color:#fff;font-size:30px;border-radius:6px;cursor:pointer;">‹</button>
        <img data-os-galeria-img alt="Foto da O.S." style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;user-select:none;-webkit-user-drag:none;">
        <button data-os-galeria-next type="button" onclick="window.navegarGaleriaFotosOS(1)" aria-label="Próxima foto" style="position:absolute;right:10px;z-index:2;width:48px;height:64px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.55);color:#fff;font-size:30px;border-radius:6px;cursor:pointer;">›</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) window.fecharGaleriaFotosOS(); });
  let touchX = null;
  const area = overlay.querySelector('[data-os-galeria-area]');
  area?.addEventListener('touchstart', e => { touchX = e.changedTouches?.[0]?.clientX ?? null; }, { passive:true });
  area?.addEventListener('touchend', e => {
    if (touchX == null) return;
    const fim = e.changedTouches?.[0]?.clientX ?? touchX;
    const dx = fim - touchX; touchX = null;
    if (Math.abs(dx) >= 45) window.navegarGaleriaFotosOS(dx < 0 ? 1 : -1);
  }, { passive:true });
  document.body.appendChild(overlay);
  window._osGaleriaKeydown = e => {
    if (!document.getElementById('osGaleriaFotosOverlay')) return;
    if (e.key === 'Escape') window.fecharGaleriaFotosOS();
    if (e.key === 'ArrowLeft') window.navegarGaleriaFotosOS(-1);
    if (e.key === 'ArrowRight') window.navegarGaleriaFotosOS(1);
  };
  document.addEventListener('keydown', window._osGaleriaKeydown);
  window.renderGaleriaFotoOS();
};

window.renderMediaOS = function() {
  const media = JSON.parse($('osMediaArray')?.value || '[]');
  if($('osMediaGrid')) {
      $('osMediaGrid').innerHTML = media.map((m, i) => {
        const url = String(m?.url || '').replace(/"/g, '&quot;');
        const isVideo = /^video$/i.test(String(m?.type || '')) || /^video\//i.test(String(m?.type || ''));
        return `<div class="media-item">
          ${isVideo ? `<video src="${url}" controls preload="metadata"></video>` : `<img src="${url}" loading="lazy" referrerpolicy="no-referrer" onclick="window.abrirGaleriaFotosOS(${i})" style="cursor:zoom-in" alt="Foto ${i + 1} da O.S.">`}
          <button type="button" class="media-del" onclick="event.stopPropagation();window.removerMediaOS(${i})" title="Remover">✕</button>
        </div>`;
      }).join('');
  }
};

window.removerMediaOS = function(idx) {
  const media = JSON.parse($('osMediaArray').value || '[]');
  media.splice(idx, 1); $('osMediaArray').value = JSON.stringify(media); window.renderMediaOS();
};

window.renderTimelineOS = function() {
  if(!$('osTimeline')) return;
  const tl = JSON.parse($('osTimelineData')?.value || '[]');
  const visiveis = osSegredo177AtivoOS() ? tl : tl.filter(e => !osEventoPecaRealProtegidoOS(e));
  $('osTimeline').innerHTML = [...visiveis].reverse().map(e => `<div class="tl-item"><div class="tl-date">${dtHrBr(e.dt)}</div><div class="tl-user">${e.user}</div><div class="tl-action">${e.acao}</div></div>`).join('');
};


window.abrirVisualizadorPdfOS = function(urlPdf, tituloPdf) {
  const tituloSeguro = String(tituloPdf || 'Orçamento da O.S.').replace(/[<>]/g, '');
  let overlay = document.getElementById('visualizadorPdfOSOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'visualizadorPdfOSOverlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:999999',
    'background:rgba(2,6,23,.82)',
    'display:flex',
    'flex-direction:column',
    'padding:14px',
    'box-sizing:border-box'
  ].join(';');

  const barra = document.createElement('div');
  barra.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:10px',
    'background:#0f172a',
    'color:#e5eefc',
    'border:1px solid rgba(148,163,184,.35)',
    'border-radius:14px 14px 0 0',
    'padding:10px 12px',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
  ].join(';');

  const titulo = document.createElement('div');
  titulo.textContent = 'Visualização do orçamento — impressão econômica';
  titulo.style.cssText = 'font-weight:700;font-size:14px;';

  const acoes = document.createElement('div');
  acoes.style.cssText = 'display:flex;gap:8px;align-items:center;';

  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.textContent = 'ABRIR EM NOVA ABA';
  abrir.style.cssText = 'border:1px solid rgba(34,211,238,.45);background:rgba(34,211,238,.12);color:#e0f2fe;border-radius:10px;padding:8px 10px;font-weight:700;cursor:pointer;';
  abrir.onclick = function() {
    try { window.open(urlPdf, '_blank'); } catch (_) {}
  };

  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.textContent = 'FECHAR';
  fechar.style.cssText = 'border:1px solid rgba(248,113,113,.45);background:rgba(248,113,113,.12);color:#fee2e2;border-radius:10px;padding:8px 10px;font-weight:700;cursor:pointer;';
  fechar.onclick = function() {
    try { overlay.remove(); } catch (_) {}
  };

  acoes.appendChild(abrir);
  acoes.appendChild(fechar);
  barra.appendChild(titulo);
  barra.appendChild(acoes);

  const iframe = document.createElement('iframe');
  iframe.title = tituloSeguro;
  iframe.src = urlPdf;
  iframe.style.cssText = [
    'width:100%',
    'height:100%',
    'border:1px solid rgba(148,163,184,.35)',
    'border-top:0',
    'border-radius:0 0 14px 14px',
    'background:#fff'
  ].join(';');

  overlay.appendChild(barra);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  return overlay;
};


window.gerarPDFOS = async function(opcoes = {}) {
  const visualizarPDF = opcoes === 'visualizar' || opcoes?.visualizar === true;
  const visualizacaoEconomicaPDF = visualizarPDF === true;
  // Visualização: mantém logo/timbrado, mas remove fotos/evidências/assinatura em imagem e usa cabeçalhos brancos para impressão.
  const incluirImagensPDF = !(visualizarPDF || opcoes?.semImagens === true || opcoes?.semImagem === true);
  const incluirLogoPDF = opcoes?.semLogo !== true;
  const headStylesPadraoPDF = visualizacaoEconomicaPDF
    ? { fillColor: [255, 255, 255], textColor: [20, 30, 45], fontStyle: 'normal' }
    : { fillColor: [28, 39, 58], textColor: [255, 255, 255], fontStyle: 'bold' };
  const headStylesInfoPDF = visualizacaoEconomicaPDF
    ? { fillColor: [255, 255, 255], textColor: [20, 30, 45], fontStyle: 'normal' }
    : { fillColor: [228, 233, 240], textColor: [0, 0, 0], fontStyle: 'bold' };
  const headStylesGarantiaPDF = visualizacaoEconomicaPDF
    ? { fillColor: [255, 255, 255], textColor: [20, 30, 45], fontStyle: 'normal' }
    : { fillColor: [120, 80, 20], textColor: [255, 255, 255], fontStyle: 'bold' };
  let janelaVisualizacaoPDF = null;
  if (visualizarPDF) {
    try {
      janelaVisualizacaoPDF = window.open('about:blank', '_blank');
      if (janelaVisualizacaoPDF && !janelaVisualizacaoPDF.closed) {
        janelaVisualizacaoPDF.document.open();
        janelaVisualizacaoPDF.document.write('<!doctype html><html><head><title>Gerando orçamento...</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f172a;color:#e5eefc;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;"><div><h2 style="margin:0 0 8px;">Gerando orçamento...</h2><p style="opacity:.8;margin:0;">A visualização será aberta nesta aba, com logo e sem fotos.</p></div></body></html>');
        janelaVisualizacaoPDF.document.close();
      }
    } catch (_) {
      janelaVisualizacaoPDF = null;
    }
  }
  if (typeof window.jspdf === 'undefined') { window.toast('jsPDF nao carregado', 'err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margem = 12;
  const larguraUtilPdf = pw - margem * 2;
  let y = 12;

  const U = OSU();
  const moedaPdf = value => (U.moeda ? U.moeda(value) : ('R$ ' + numBR(value).toFixed(2).replace('.', ',')));
  const texto = value => String(value == null || value === '' ? '-' : value);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const v = J.veiculos.find(x => x.id === $v('osVeiculo')) || {};
  const c = J.clientes.find(x => x.id === $v('osCliente')) || {};
  const osAtual = (J.os || []).find(x => x.id === $v('osId')) || {};
  const pdfClienteOficialProtegido = osClienteOficialSeguroOS(osContextoClienteAtualOS(osAtual));
  const gapTabelaPDF = pdfClienteOficialProtegido ? 6 : 3.5;
  const osId = ($v('osId') || '').slice(-6).toUpperCase() || 'NOVA';
  const pickPdf = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (String(value).trim() !== '') return value;
    }
    return '';
  };
  const upperPdf = (...values) => String(pickPdf(...values) || '').toUpperCase();
  function dadoOficinaPdf(...keys) {
    const fontes = [osAtual.dadosOficina, osAtual.oficinaDados, osAtual.oficina, J.oficina, J].filter(Boolean);
    for (const fonte of fontes) {
      for (const key of keys) {
        const value = fonte && fonte[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
    }
    return '';
  }
  function enderecoOficinaPdf() {
    return pickPdf(
      dadoOficinaPdf('enderecoCompleto'),
      [
        dadoOficinaPdf('endereco', 'rua', 'logradouro'),
        dadoOficinaPdf('numero', 'num'),
        dadoOficinaPdf('bairro'),
        dadoOficinaPdf('cidade', 'municipio'),
        dadoOficinaPdf('uf'),
        dadoOficinaPdf('cep')
      ].filter(v => String(v || '').trim()).join(', ')
    );
  }
  const clientePdf = {
    nome: pickPdf(c.govUnidade, c.razaoSocial, c.nome, osAtual.cliente, $v('osCliente')),
    doc: pickPdf(c.doc, c.cnpj, c.cpf, osAtual.cpf, $v('osCpf')),
    telefone: pickPdf(c.wpp, c.telefone, c.celular, osAtual.celular, $v('osCelular')),
    fiscal: pickPdf(c.govFiscal, c.fiscalContrato, c.fiscal, c.responsavel)
  };
  const veiculoPdf = {
    marca: upperPdf(v.marca, osAtual.marca),
    modelo: pickPdf(v.modelo, osAtual.veiculo, osAtual.modelo, $v('osVeiculo')),
    placa: upperPdf(v.placa, osAtual.placa, $v('osPlaca')),
    ano: pickPdf(v.ano, osAtual.ano),
    km: pickPdf($v('osKm'), osAtual.km, v.km),
    chassis: upperPdf(v.chassis, v.chassi, osAtual.chassis, osAtual.chassi),
    patrimonio: pickPdf(v.patrimonio, v.patrimonioNumero, v.patrimonioId, osAtual.patrimonio, osAtual.patrimonioNumero),
    prefixo: upperPdf(v.prefixo, osAtual.prefixo)
  };
  const oficinaNomePdf = String(pickPdf(dadoOficinaPdf('nomeFantasia', 'tnome', 'nome'), dadoOficinaPdf('razaoSocial', 'razao'), J.nomeFantasia, J.tnome, J.razaoSocial, J.nome, 'OFICINA')).toUpperCase();
  const oficinaTimbradoPdf = {
    nome: oficinaNomePdf,
    cnpj: pickPdf(dadoOficinaPdf('cnpj', 'doc', 'documento')),
    endereco: enderecoOficinaPdf(),
    telefone: pickPdf(dadoOficinaPdf('telefone', 'celular', 'wpp', 'whatsapp')),
    email: pickPdf(dadoOficinaPdf('email')),
    site: pickPdf(dadoOficinaPdf('site', 'website')),
    logoUrl: pickPdf(dadoOficinaPdf('logoUrl', 'logotipoUrl', 'logoOficinaUrl', 'logoOficina', 'timbradoLogoUrl', 'timbradoUrl', 'marcaUrl', 'imagemLogo', 'urlLogo', 'logo', 'logotipo'))
  };

  function linhaTitulo(titulo) {
    if (y > ph - 30) { doc.addPage(); y = 12; }
    if (visualizacaoEconomicaPDF) {
      doc.setFillColor(255, 255, 255);
      doc.rect(margem, y, pw - margem * 2, 7, 'F');
      doc.setDrawColor(210, 216, 226);
      doc.rect(margem, y, pw - margem * 2, 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(20, 30, 45);
    } else {
      doc.setFillColor(28, 39, 58);
      doc.rect(margem, y, pw - margem * 2, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
    }
    doc.text(titulo, margem + 2, y + 5);
    y += 10;
  }

  function blocoTexto(titulo, conteudo) {
    linhaTitulo(titulo);
    const linhas = doc.splitTextToSize(texto(conteudo), pw - margem * 2 - 4);
    doc.setDrawColor(185, 195, 210);
    doc.rect(margem, y - 1, pw - margem * 2, Math.max(12, linhas.length * 4 + 5));
    doc.setTextColor(20, 30, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(linhas, margem + 2, y + 4);
    y += Math.max(14, linhas.length * 4 + 8);
  }

  async function carregarImagem(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const max = 900;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.82), w: canvas.width, h: canvas.height });
        } catch(e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  const dadosGov = typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descMOField = document.getElementById('osDescMO')?.value?.trim();
  const descPecaField = document.getElementById('osDescPeca')?.value?.trim();
  const descPadrao = OSU().getDescontosCliente ? OSU().getDescontosCliente(c, osAtual) : {
    descMO: taxaDescontoOS(osAtual.descMO ?? dadosGov?.descMO ?? c.govDescMO ?? 0),
    descPeca: taxaDescontoOS(osAtual.descPeca ?? dadosGov?.descPeca ?? c.govDescPeca ?? 0)
  };
  const descMO = descMOField !== '' && descMOField != null ? taxaDescontoOS(descMOField) : taxaDescontoOS(descPadrao.descMO || 0);
  const descPeca = descPecaField !== '' && descPecaField != null ? taxaDescontoOS(descPecaField) : taxaDescontoOS(descPadrao.descPeca || 0);
  const servicos = [];
  const resumoSecoesPDF = {};
  let totalServicos = 0;
  const _coletarServicoParaPDF = row => {
    // FIDELIDADE DA O.S.: gerar PDF jamais recalcula/substitui o serviço pela Tempária.
    // A linha da O.S. (carregada do registro salvo, ou editada pelo usuário) é a fonte de verdade.
    const dados = dadosServicoLinhaOS(row);
    const desc = String(dados.desc || '').trim();
    const tempo = numBR(dados.tempo || 0);
    const valorHora = numBR(dados.valorHora || 0);
    const bruto = numBR(dados.valor || 0);
    const descontoIndividual = clienteGovernamentalAtualOS() ? 0 : descontoIndividualLinhaOS(row, 'servico');
    const calc = calcularDescontosValorOS(bruto, descMO, descontoIndividual);
    const final = numBR(calc.valorFinal || 0);
    const sel = row.querySelector('.serv-secao-hora');
    const sistema = sel?.options?.[sel.selectedIndex]?.text?.replace(/\s+-\s+R\$.*/, '') || row.dataset.secaoHoraLabel || row.dataset.sistemaTabela || '';
    const meta = metaServicoResumoOS({
      codigoInterno: row.dataset.codigoInterno,
      codigoTabela: row.dataset.codigoTabela,
      sistemaTabela: row.dataset.sistemaTabela || sistema,
      secaoHoraLabel: sistema,
      tipoVeiculoTabela: row.dataset.tipoVeiculoTabela
    }, window._osVeiculoAtual?.() || {});
    if (meta.tipoVeiculo && !row.dataset.tipoVeiculoTabela) row.dataset.tipoVeiculoTabela = meta.tipoVeiculo;
    if (desc || bruto || tempo) {
      totalServicos += final;
      const categoria = classificarSecaoResumoOS({
        secaoHora: row.dataset.secaoHora || sel?.value || '',
        secaoHoraLabel: sistema,
        sistemaTabela: row.dataset.sistemaTabela,
        sistema: row.dataset.sistemaTabela,
        codigoInterno: meta.codigoInterno,
        codigoTabela: meta.codigoTabela || meta.codigo,
        tipoVeiculoTabela: meta.tipoVeiculo,
        desc
      });
      if (!resumoSecoesPDF[categoria]) resumoSecoesPDF[categoria] = { horas: 0, total: 0, codigos: new Set(), sistemas: new Set(), tiposVeiculo: new Set() };
      resumoSecoesPDF[categoria].horas += tempo;
      resumoSecoesPDF[categoria].total += final;
      addMetaResumoServicoOS(resumoSecoesPDF[categoria], meta);
      servicos.push({ codigo: meta.codigo || '-', codigoInterno: meta.codigoInterno || '', codigoTabela: meta.codigoTabela || '', sistema: sistema || meta.sistema || '-', tipoVeiculo: meta.tipoVeiculo || '-', desc: desc || '-', tempo, valorHora, bruto, descontoValor: numBR(calc.descontoValor || Math.max(0, bruto - final)), descontoIndividualValor: numBR(calc.descontoIndividualValor || 0), descPct: numBR(calc.descPct || 0), total: final, categoria });
    }
  };
  document.querySelectorAll('#containerServicosOS > div').forEach(_coletarServicoParaPDF);
  document.querySelectorAll('#containerPecasOS .cilia-serv-relac').forEach(_coletarServicoParaPDF);

  const pecas = [];
  let totalPecas = 0;
  const _contextoPDFPecasOS = osContextoClienteAtualOS(osAtual);
  document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)').forEach(row => {
    if (osClienteOficialSeguroOS(_contextoPDFPecasOS) && osLinhaPecaRealProtegidaOS(row, _contextoPDFPecasOS)) return;
    const sel = row.querySelector('.peca-sel');
    const opt = sel?.options?.[sel.selectedIndex];
    const estoqueId = sel?.value || '';
    const codigo = row.querySelector('.peca-codigo')?.value?.trim() || row.dataset?.pecaCodigo || opt?.dataset?.codigo || '';
    const desc = descricaoPecaLinhaOS(row, opt, estoqueId);
    const qtd = numBR(row.querySelector('.peca-qtd')?.value || 0) || 1;
    const unit = numBR(row.querySelector('.peca-venda')?.value || 0);
    const brutoItem = +(qtd * unit).toFixed(2);
    const calcDescontoItem = calcularDescontosValorOS(brutoItem, descPeca, descontoIndividualLinhaOS(row, 'peca'));
    const final = calcDescontoItem.valorFinal;
    if (desc || codigo || unit) {
      totalPecas += final;
      pecas.push([codigo || 'sem oem', desc || '-', qtd, moedaPdf(unit), moedaPdf(brutoItem), moedaPdf(calcDescontoItem.descontoValor), moedaPdf(final)]);
    }
  });

  const pecasTelaPDF = typeof window.pecasCotacaoDaTelaOS === 'function' ? (window.pecasCotacaoDaTelaOS() || []) : [];
  const pecasTelaPorKeyPDF = new Map(pecasTelaPDF.map(it => [it.key, it]));
  const aprovacaoPDFAtiva = U.hasApproval?.(osAtual);
  let itensNaoAprovadosPDF = [];
  if (aprovacaoPDFAtiva && U.buildBudgetItems && U.getApprovedKeys) {
    const keys = U.getApprovedKeys(osAtual);
    const todos = U.buildBudgetItems(osAtual, c);
    const aprovados = todos.filter(it => keys.has(it.key));
    itensNaoAprovadosPDF = todos.filter(it => !keys.has(it.key));
    servicos.length = 0; pecas.length = 0; totalServicos = 0; totalPecas = 0;
    Object.keys(resumoSecoesPDF).forEach(k => delete resumoSecoesPDF[k]);
    aprovados.forEach(it => {
      if (it.tipo === 'servico') {
        const categoria = classificarSecaoResumoOS({ desc: it.desc, sistema: it.sistema, secaoHoraLabel: it.sistema });
        if (!resumoSecoesPDF[categoria]) resumoSecoesPDF[categoria] = { horas: 0, total: 0, codigos: new Set(), sistemas: new Set(), tiposVeiculo: new Set() };
        resumoSecoesPDF[categoria].horas += numBR(it.tempo || 0);
        resumoSecoesPDF[categoria].total += numBR(it.valorFinal || 0);
        servicos.push({ codigo: it.codigo || '-', sistema: it.sistema || '-', tipoVeiculo: '-', desc: it.desc || '-', tempo: numBR(it.tempo || 0), valorHora: numBR(it.valorHora || 0), bruto: numBR(it.valorBruto || it.valorOriginal || 0), descontoValor: numBR(it.descontoValor || Math.max(0, numBR(it.valorBruto || it.valorOriginal || 0) - numBR(it.valorFinal || 0))), descontoIndividualValor: numBR(it.descontoIndividualValor || 0), descPct: numBR(it.descPct || 0), total: numBR(it.valorFinal || 0), categoria });
        totalServicos += numBR(it.valorFinal || 0);
      } else {
        const tela = pecasTelaPorKeyPDF.get(it.key) || {};
        const codigoItem = it.codigo || tela.codigo || 'sem oem';
        const descSalva = descricaoPecaGeradaSistemaOS(it.desc) ? '' : (it.desc || '');
        const descTela = tela.desc || '';
        const descItem = descTela || descSalva || '-';
        const qtdItem = it.qtd || tela.qtd || 1;
        const valorUnitItem = it.valorUnit || tela.valorUnit || 0;
        const valorBrutoItem = numBR(it.valorBruto || it.valorOriginal || tela.valorBruto || (qtdItem * valorUnitItem));
        const valorFinalItem = numBR(it.valorFinal || tela.valorFinal || 0);
        const descontoValorItem = numBR(it.descontoValor || Math.max(0, valorBrutoItem - valorFinalItem));
        pecas.push([codigoItem, descItem, qtdItem, moedaPdf(valorUnitItem), moedaPdf(valorBrutoItem), moedaPdf(descontoValorItem), moedaPdf(valorFinalItem)]);
        totalPecas += numBR(valorFinalItem || 0);
      }
    });
  }

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, 'F');
  const logoOficinaPDF = incluirLogoPDF ? await carregarImagem(oficinaTimbradoPdf.logoUrl) : null;
  const headerLineY = 28;
  doc.setDrawColor(20, 45, 95);
  doc.setLineWidth(0.7);
  doc.line(margem, headerLineY, pw - margem, headerLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(10, 25, 48);
  let headerTextX = margem;
  if (logoOficinaPDF) {
    const logoBoxW = 24;
    const logoBoxH = 16;
    const ratio = Math.min(logoBoxW / logoOficinaPDF.w, logoBoxH / logoOficinaPDF.h);
    const logoW = logoOficinaPDF.w * ratio;
    const logoH = logoOficinaPDF.h * ratio;
    doc.addImage(logoOficinaPDF.data, 'JPEG', margem, 7 + (logoBoxH - logoH) / 2, logoW, logoH);
    headerTextX = margem + logoBoxW + 4;
  }
  doc.text(oficinaTimbradoPdf.nome, headerTextX, 10);
  const linhasTimbradoPdf = [
    [oficinaTimbradoPdf.cnpj ? 'CNPJ: ' + oficinaTimbradoPdf.cnpj : '', oficinaTimbradoPdf.telefone ? 'Tel/Whats: ' + oficinaTimbradoPdf.telefone : ''].filter(Boolean).join('  |  '),
    oficinaTimbradoPdf.endereco,
    [oficinaTimbradoPdf.email, oficinaTimbradoPdf.site].filter(Boolean).join('  |  ')
  ].filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 72, 88);
  linhasTimbradoPdf.slice(0, 3).forEach((linha, idx) => {
    doc.text(doc.splitTextToSize(linha, pw - headerTextX - 70)[0] || '', headerTextX, 14 + idx * 4);
  });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 25, 48);
  doc.text(pdfClienteOficialProtegido ? 'ORÇAMENTO / ORDEM DE SERVIÇO' : 'ORÇAMENTO', pw - margem, 10, { align: 'right' });
  y = headerLineY + 6;

  doc.autoTable({
    startY: y,
    theme: 'grid',
    margin: { left: margem, right: margem },
    styles: { fontSize: 8, cellPadding: 2, textColor: [20, 30, 45], lineColor: [185, 195, 210], lineWidth: 0.15 },
    headStyles: headStylesInfoPDF,
    body: pdfClienteOficialProtegido ? [
      ['OS', osId, 'Emissão', hoje],
      ['Cliente', texto(clientePdf.nome), 'CPF/CNPJ', texto(clientePdf.doc)],
      ['Telefone', texto(clientePdf.telefone), 'Status', texto($v('osStatus') || osAtual.status)],
      ['Veículo', texto([veiculoPdf.marca, veiculoPdf.modelo].filter(Boolean).join(' ')), 'Placa', texto(veiculoPdf.placa)],
      ['Ano', texto(veiculoPdf.ano), 'KM', texto(veiculoPdf.km)],
      ['Chassi', texto(veiculoPdf.chassis), 'Prefixo/Patrimônio', texto([veiculoPdf.prefixo, veiculoPdf.patrimonio].filter(Boolean).join(' / '))],
      ['Fiscal Contrato', texto(clientePdf.fiscal), '', '']
    ] : [
      ['Cliente', texto(clientePdf.nome), 'CPF/CNPJ', texto(clientePdf.doc)],
      ['Telefone', texto(clientePdf.telefone), 'Emissão', hoje],
      ['Veículo', texto([veiculoPdf.marca, veiculoPdf.modelo].filter(Boolean).join(' ')), 'Placa', texto(veiculoPdf.placa)],
      ['Ano', texto(veiculoPdf.ano), 'KM', texto(veiculoPdf.km)]
    ]
  });
  y = doc.lastAutoTable.finalY + 7;

  blocoTexto('DEFEITO RECLAMADO / QUEIXA DO CLIENTE', $v('osRelato') || $v('osDescricao') || '-');
  blocoTexto('DIAGNÓSTICO TÉCNICO', $v('osDiagnostico') || '-');

  const resumoSecoesRows = Object.entries(resumoSecoesPDF)
    .filter(([, item]) => item.horas || item.total)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([secao, item]) => [
      secao,
      listaResumoOS(item.codigos, 8) || '-',
      [listaResumoOS(item.tiposVeiculo, 3), listaResumoOS(item.sistemas, 2)].filter(Boolean).join(' / ') || '-',
      item.horas.toFixed(2).replace('.', ','),
      moedaPdf(item.total)
    ]);
  if (pdfClienteOficialProtegido && resumoSecoesRows.length) {
    linhaTitulo('RESUMO POR SEÇÃO DE MÃO DE OBRA');
    doc.autoTable({
      startY: y,
      head: [['Seção', 'Códigos', 'Tipo veículo / sistema', 'Horas', 'Valor']],
      body: resumoSecoesRows,
      theme: 'grid',
      margin: { left: margem, right: margem },
      tableWidth: larguraUtilPdf,
      styles: { fontSize: 6.8, cellPadding: 1.45, lineColor: [190, 198, 210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesPadraoPDF,
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 34 }, 2: { cellWidth: 66 }, 3: { halign: 'center', cellWidth: 16 }, 4: { halign: 'right', cellWidth: 28 } }
    });
    y = doc.lastAutoTable.finalY + gapTabelaPDF;
  }

  if (servicos.length) {
    linhaTitulo('SERVIÇOS / MÃO DE OBRA');
    doc.autoTable({
      startY: y,
      head: [['Cód.', 'Sistema / tipo veic.', 'Descrição do serviço', 'TMO', 'Valor h', 'Valor original', 'Desconto', 'Valor cobrado']],
      body: servicos.map(s => [
        s.codigo,
        [s.sistema, s.tipoVeiculo && s.tipoVeiculo !== '-' ? `Tipo: ${s.tipoVeiculo}` : ''].filter(Boolean).join('\n'),
        s.desc,
        s.tempo ? s.tempo.toFixed(2).replace('.', ',') : '-',
        moedaPdf(s.valorHora),
        moedaPdf(s.bruto || s.total || 0),
        moedaPdf(s.descontoValor || Math.max(0, numBR(s.bruto || 0) - numBR(s.total || 0))),
        moedaPdf(s.total)
      ]),
      theme: 'grid',
      margin: { left: margem, right: margem },
      tableWidth: larguraUtilPdf,
      styles: { fontSize: 6.7, cellPadding: 1.45, lineColor: [190, 198, 210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesPadraoPDF,
      columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 29 }, 2: { cellWidth: 47 }, 3: { halign: 'center', cellWidth: 11 }, 4: { halign: 'right', cellWidth: 17 }, 5: { halign: 'right', cellWidth: 22 }, 6: { halign: 'right', cellWidth: 21 }, 7: { halign: 'right', cellWidth: 26 } }
    });
    y = doc.lastAutoTable.finalY + gapTabelaPDF;
  }

  const guinchoPdf = window.calcularDeslocamentoGuinchoOS?.() || osAtual.deslocamentoGuincho || { ativo: false, total: 0 };

  if (pecas.length) {
    linhaTitulo('PEÇAS / MATERIAIS');
    doc.autoTable(pdfClienteOficialProtegido ? {
      startY: y,
      head: [['Código da peça', 'Descrição', 'Qtd', 'Valor unit.', 'Valor original', 'Desconto', 'Valor cobrado']],
      body: pecas,
      theme: 'grid',
      margin: { left: margem, right: margem },
      tableWidth: larguraUtilPdf,
      styles: { fontSize: 7.2, cellPadding: 1.55, lineColor: [190, 198, 210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesPadraoPDF,
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 58 }, 2: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right', cellWidth: 21 }, 4: { halign: 'right', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 21 }, 6: { halign: 'right', cellWidth: 26 } }
    } : {
      startY: y,
      head: [['Descrição', 'Qtd', 'Valor unit.', 'Valor original', 'Desconto', 'Valor cobrado']],
      body: pecas.map(item => [item[1], item[2], item[3], item[4], item[5], item[6]]),
      theme: 'grid',
      margin: { left: margem, right: margem },
      tableWidth: larguraUtilPdf,
      styles: { fontSize: 7.4, cellPadding: 1.35, lineColor: [190, 198, 210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesPadraoPDF,
      columnStyles: { 0: { cellWidth: 74 }, 1: { halign: 'center', cellWidth: 12 }, 2: { halign: 'right', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 22 }, 5: { halign: 'right', cellWidth: 28 } }
    });
    y = doc.lastAutoTable.finalY + gapTabelaPDF;
  }

  const totalGuinchoPdf = guinchoPdf?.ativo ? _numGuinchoOS(guinchoPdf.total || 0) : 0;
  if (guinchoPdf?.ativo && totalGuinchoPdf > 0) {
    linhaTitulo('DESLOCAMENTO / GUINCHO');
    doc.autoTable({
      startY: y,
      head: [['Tipo', 'KM total', 'Franquia', 'KM exced.', 'Saida', 'KM adicional', 'Ajuste', 'Total']],
      body: [[
        guinchoPdf.tipoLabel || (guinchoPdf.tipo === 'pesado' ? 'Pesado' : 'Leve'),
        String(guinchoPdf.kmTotal || 0).replace('.', ',') + ' km',
        String(guinchoPdf.franquiaKm || 15).replace('.', ',') + ' km',
        String(guinchoPdf.kmExcedente || 0).replace('.', ',') + ' km',
        moedaPdf(guinchoPdf.valorSaida || 0),
        moedaPdf(guinchoPdf.valorKmAdicional || 0),
        String(guinchoPdf.ajustePct || 0).replace('.', ',') + '%',
        moedaPdf(totalGuinchoPdf)
      ]],
      theme: 'grid',
      margin: { left: margem, right: margem },
      tableWidth: larguraUtilPdf,
      styles: { fontSize: 6.6, cellPadding: 1.35, lineColor: [190, 198, 210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesPadraoPDF,
      columnStyles: { 0: { cellWidth: 34 }, 1: { halign:'center', cellWidth: 22 }, 2: { halign:'center', cellWidth: 22 }, 3: { halign:'center', cellWidth: 22 }, 4: { halign:'right', cellWidth: 23 }, 5: { halign:'right', cellWidth: 25 }, 6: { halign:'center', cellWidth: 18 }, 7: { halign:'right', cellWidth: 20 } }
    });
    y = doc.lastAutoTable.finalY + gapTabelaPDF;
    if (guinchoPdf.obs) blocoTexto('OBSERVAÇÃO DO DESLOCAMENTO', guinchoPdf.obs);
  }

  if (itensNaoAprovadosPDF.length) {
    linhaTitulo('ITENS NÃO APROVADOS - HISTÓRICO DO ORÇAMENTO ORIGINAL');
    doc.autoTable({
      startY: y,
      head: [['Tipo', 'Código', 'Descrição', 'Valor original', 'Desconto', 'Valor cobrado']],
      body: itensNaoAprovadosPDF.map(it => {
        const tela = it.tipo === 'peca' ? (pecasTelaPorKeyPDF.get(it.key) || {}) : {};
        const descSalva = it.tipo === 'peca' && descricaoPecaGeradaSistemaOS(it.desc) ? '' : (it.desc || '');
        const descTela = tela.desc || '';
        const brutoItem = numBR(it.valorBruto || it.valorOriginal || tela.valorBruto || it.valorFinal || tela.valorFinal || 0);
        const finalItem = numBR(it.valorFinal || tela.valorFinal || 0);
        const descontoItem = numBR(it.descontoValor || Math.max(0, brutoItem - finalItem));
        return [it.labelTipo || it.tipo, it.codigo || tela.codigo || '-', descTela || descSalva || '-', moedaPdf(brutoItem), moedaPdf(descontoItem), moedaPdf(finalItem)];
      }),
      theme: 'grid',
      margin: { left: margem, right: margem },
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [190,198,210], lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: headStylesGarantiaPDF,
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 27 }, 2: { cellWidth: 75 }, 3: { cellWidth: 25, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + gapTabelaPDF;
  }

  if (y > ph - (pdfClienteOficialProtegido ? 34 : 25)) { doc.addPage(); y = 12; }
  const totalGeral = +(totalServicos + totalPecas + totalGuinchoPdf).toFixed(2);
  const totalOriginalServicosPDF = +servicos.reduce((sum, item) => sum + numBR(item.bruto || item.total || 0), 0).toFixed(2);
  const totalOriginalPecasPDF = +pecas.reduce((sum, item) => sum + numBR(String(item[4] || '').replace(/R\$|\s|\./g, '').replace(',', '.')), 0).toFixed(2);
  const totalDescontoPDF = +((totalOriginalServicosPDF + totalOriginalPecasPDF) - (totalServicos + totalPecas)).toFixed(2);
    doc.autoTable({
      startY: y,
      theme: 'plain',
    margin: { left: pw - margem - 88, right: margem },
    tableWidth: 88,
    styles: { fontSize: 9, cellPadding: 1.8 },
    body: [
      ['VALOR ORIGINAL DE PEÇAS E SERVIÇOS', moedaPdf(totalOriginalPecasPDF + totalOriginalServicosPDF)],
      ['DESCONTO TOTAL CONCEDIDO', '- ' + moedaPdf(Math.max(0, totalDescontoPDF))],
      ['TOTAL DE PEÇAS COBRADO', moedaPdf(totalPecas)],
      ['TOTAL DE MÃO DE OBRA COBRADO', moedaPdf(totalServicos)],
      ['DESLOCAMENTO / GUINCHO', moedaPdf(totalGuinchoPdf)],
      [aprovacaoPDFAtiva ? 'VALOR APROVADO / CONTRATO' : 'VALOR DO CONTRATO', moedaPdf(totalGeral)]
    ],
    columnStyles: { 0: { fontStyle: visualizacaoEconomicaPDF ? 'normal' : 'bold', halign: 'right', cellWidth: 56 }, 1: { fontStyle: visualizacaoEconomicaPDF ? 'normal' : 'bold', halign: 'right', cellWidth: 32 } },
    didParseCell: data => {
      if (data.row.index === 5) {
        data.cell.styles.fillColor = visualizacaoEconomicaPDF ? [255, 255, 255] : [205, 200, 160];
        data.cell.styles.fontSize = 12;
        data.cell.styles.fontStyle = visualizacaoEconomicaPDF ? 'normal' : 'bold';
        data.cell.styles.textColor = [20, 30, 45];
      }
    }
  });
  y = doc.lastAutoTable.finalY + (pdfClienteOficialProtegido ? 10 : 6);

  let media = [];
  try { media = JSON.parse(document.getElementById('osMediaArray')?.value || '[]'); } catch(e) { media = []; }
  const imagens = media.filter(m => (m.type || 'image') !== 'video' && m.url).slice(0, 12);
  if (incluirImagensPDF && imagens.length) {
    linhaTitulo('EVIDÊNCIAS DIGITAIS');
    const thumbW = 55, thumbH = 38, gap = 5;
    let x = margem;
    let count = 0;
    for (const m of imagens) {
      if (y + thumbH > ph - 18) { doc.addPage(); y = 12; x = margem; }
      const img = await carregarImagem(m.url);
      doc.setDrawColor(190, 198, 210);
      doc.rect(x, y, thumbW, thumbH);
      if (img) {
        const ratio = Math.min(thumbW / img.w, thumbH / img.h);
        const w = img.w * ratio;
        const h = img.h * ratio;
        doc.addImage(img.data, 'JPEG', x + (thumbW - w) / 2, y + (thumbH - h) / 2, w, h);
      } else {
        doc.setFontSize(7);
        doc.setTextColor(120, 130, 145);
        doc.text('Imagem não carregada', x + 3, y + 19);
      }
      count++;
      x += thumbW + gap;
      if (count % 3 === 0) { x = margem; y += thumbH + 8; }
    }
    if (count % 3 !== 0) y += thumbH + 8;
  }

  const assinaturaPDF = (typeof window._osSignGetPayload === 'function' ? window._osSignGetPayload() : null) || osAtual.assinaturaResponsavel || osAtual.assinaturaOS || osAtual.assinaturaUsada || J.oficina?.assinatura || {};
  const urlAssPDF = assinaturaPDF.url || assinaturaPDF.cloudUrl || assinaturaPDF.assinaturaUrl || assinaturaPDF.urlAssinatura || '';
  const imgAssPDF = incluirImagensPDF ? await carregarImagem(urlAssPDF) : null;
  const alturaFechamentoPDF = pdfClienteOficialProtegido ? 55 : 45;
  if (y + alturaFechamentoPDF > ph - (pdfClienteOficialProtegido ? 10 : 6)) { doc.addPage(); y = pdfClienteOficialProtegido ? 18 : 12; }
  const assinaturaLinhaY = y + (pdfClienteOficialProtegido ? 24 : 18);
  doc.setDrawColor(70, 80, 95);
  if (imgAssPDF) {
    const maxW = 70, maxH = 22;
    const ratio = Math.min(maxW / imgAssPDF.w, maxH / imgAssPDF.h);
    const w = imgAssPDF.w * ratio, h = imgAssPDF.h * ratio;
    doc.addImage(imgAssPDF.data, 'JPEG', margem + (70 - w) / 2, assinaturaLinhaY - h - 2, w, h);
  } else {
    doc.line(margem, assinaturaLinhaY, margem + 70, assinaturaLinhaY);
  }
  doc.line(pw - margem - 70, assinaturaLinhaY, pw - margem, assinaturaLinhaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(30, 40, 55);
  doc.text(texto(assinaturaPDF.nomeResponsavel || assinaturaPDF.nome || oficinaNomePdf), margem + 35, assinaturaLinhaY + 5, { align: 'center' });
  doc.text(texto(assinaturaPDF.cargo || assinaturaPDF.funcao || 'RESPONSÁVEL TÉCNICO'), margem + 35, assinaturaLinhaY + 9, { align: 'center' });
  if (assinaturaPDF.documento || assinaturaPDF.cpf || assinaturaPDF.cnpj) doc.text('Doc.: ' + texto(assinaturaPDF.documento || assinaturaPDF.cpf || assinaturaPDF.cnpj), margem + 35, assinaturaLinhaY + 13, { align: 'center' });
  doc.text(texto(clientePdf.nome || 'CLIENTE'), pw - margem - 35, assinaturaLinhaY + 5, { align: 'center' });
  doc.text('ASSINATURA DO CLIENTE', pw - margem - 35, assinaturaLinhaY + 9, { align: 'center' });

  const emitidoEmPDF = new Date();
  const rodapeFechamentoY = assinaturaLinhaY + (pdfClienteOficialProtegido ? 20 : 14);
  doc.setDrawColor(210, 216, 226);
  doc.line(margem, rodapeFechamentoY, pw - margem, rodapeFechamentoY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(90, 100, 115);
  const dataHoraEmissaoPDF = `${emitidoEmPDF.toLocaleDateString('pt-BR')} ${emitidoEmPDF.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(pdfClienteOficialProtegido ? `Emitido em ${dataHoraEmissaoPDF} | O.S. ${osId}` : `Emitido em ${dataHoraEmissaoPDF}`, margem, rodapeFechamentoY + 5);
  doc.text(pdfClienteOficialProtegido ? 'Orçamento/laudo gerado pelo sistema Oficin_IA' : 'Orçamento gerado pelo sistema Oficin_IA', margem, rodapeFechamentoY + 9);
  doc.setFont('helvetica', 'bold');
  doc.text('Powered by thIAguinho Solu\u00e7\u00f5es Digitais', pw - margem, rodapeFechamentoY + 9, { align: 'right' });

  const nomeArquivoPdf = `Laudo_${veiculoPdf.placa || 'OS'}_${Date.now()}.pdf`;
  const pdfBlob = doc.output('blob');
  if (visualizarPDF) {
    const urlPdf = URL.createObjectURL(pdfBlob);
    let abriuEmAba = false;
    try {
      if (janelaVisualizacaoPDF && !janelaVisualizacaoPDF.closed) {
        janelaVisualizacaoPDF.location.href = urlPdf;
        abriuEmAba = true;
      }
    } catch (_) {
      abriuEmAba = false;
    }
    if (!abriuEmAba) {
      window.abrirVisualizadorPdfOS?.(urlPdf, nomeArquivoPdf);
    }
    setTimeout(() => URL.revokeObjectURL(urlPdf), 900000);
    window.toast('ORÇAMENTO ABERTO PARA VISUALIZAÇÃO SEM IMAGENS', 'ok');
    return { blob: pdfBlob, fileName: nomeArquivoPdf, url: urlPdf, visualizacao: abriuEmAba ? 'nova_aba' : 'modal_interno', semImagens: true };
  }
  await salvarBlobArquivoOS(pdfBlob, nomeArquivoPdf, 'application/pdf');
  window.toast('PDF GERADO', 'ok');
};

window.visualizarOrcamentoOS = function() {
  return window.gerarPDFOS({ visualizar: true });
};

/* Powered by thIAguinho Soluções Digitais */




// Proteção final para exportação PDF no navegador/APK: não deixa erro silencioso.
(function(){
  const originalGerarPDFOS = window.gerarPDFOS;
  if (typeof originalGerarPDFOS === 'function' && !originalGerarPDFOS.__protegidoThiaguinho) {
    const protegido = async function() {
      try {
        return await originalGerarPDFOS.apply(this, arguments);
      } catch (e) {
        console.error('[PDF OS] Erro ao gerar PDF:', e);
        window.toast?.('Erro ao gerar PDF: ' + (e?.message || e), 'err');
        alert('Erro ao gerar PDF: ' + (e?.message || e));
        return false;
      }
    };
    protegido.__protegidoThiaguinho = true;
    window.gerarPDFOS = protegido;
  }
})();

// ══════════════════════════════════════════════════════════════════════
// IMPORTAR PEÇAS DO SISTEMA CÍLIA (PDF ou XML)
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// PEÇAS REAIS INSTALADAS — linha editável
// ══════════════════════════════════════════════════════════════════════
function focarItemRealOS(row, selector, options = {}) {
  if (!row) return;
  if (options.scroll !== false) {
    try { row.scrollIntoView({ behavior:'smooth', block:'center' }); } catch (_) { try { row.scrollIntoView(); } catch(__){} }
  }
  if (options.focus === false) return;
  setTimeout(() => {
    const el = row.querySelector(selector) || row.querySelector('input,select,textarea');
    try { el?.focus({ preventScroll:true }); } catch (_) { try { el?.focus(); } catch(__){} }
  }, 140);
}

window.adicionarPecaReal = function(options = {}) {
  const row = window.adicionarPecaRealRow({}, options);
  focarItemRealOS(row, '.pr-busca-estoque,.pr-codigo,.pr-desc', options);
  return row;
};

window.adicionarServicoReal = function(options = {}) {
  if (!clienteOficialAtualReaisOS()) {
    window.toast?.('Serviço real terceirizado fica disponível somente para cliente oficial.', 'warn');
    return null;
  }
  const row = window.adicionarServicoRealRow?.({}, options);
  focarItemRealOS(row, '.sr-busca-historico,.sr-desc', options);
  return row;
};

window.totalizarPecasReais177 = function() {
  const acc = { itens:0, qtd:0, total:0, servicos:0, totalServicos:0, totalGeral:0 };
  Array.from(document.querySelectorAll('#containerPecasReais > .real-item-row')).forEach(row => {
    const temConteudo = !!(row.querySelector('.pr-codigo')?.value || row.querySelector('.pr-desc')?.value);
    const qtd = Math.max(0, numBR(row.querySelector('.pr-qtd')?.value || 0));
    const unit = Math.max(0, numBR(row.querySelector('.pr-valor')?.value || 0));
    if (temConteudo) acc.itens += 1;
    if (temConteudo) acc.qtd += qtd;
    if (temConteudo) acc.total += qtd * unit;
  });
  Array.from(document.querySelectorAll('#containerServicosReais > .real-service-row')).forEach(row => {
    const temConteudo = !!(row.querySelector('.sr-desc')?.value || row.querySelector('.sr-fornec')?.value || row.querySelector('.sr-nf')?.value || numBR(row.querySelector('.sr-valor')?.value || 0));
    if (!temConteudo) return;
    acc.servicos += 1;
    acc.totalServicos += Math.max(0, numBR(row.querySelector('.sr-valor')?.value || 0));
  });
  acc.totalGeral = acc.total + acc.totalServicos;
  return acc;
};

window.atualizarResumoPecasReais177 = function() {
  const ct = document.getElementById('containerPecasReais');
  if (!ct) return;
  let box = document.getElementById('pecasReaisResumo177');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pecasReaisResumo177';
    box.style.cssText = 'display:none;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 10px;font-family:var(--fm);font-size:.68rem;';
    ct.parentElement?.insertBefore(box, ct);
  }
  const ativo177 = window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
  if (!ativo177) { box.style.display = 'none'; return; }
  const r = window.totalizarPecasReais177();
  const moedaLocal = typeof moedaOS === 'function' ? moedaOS : (v => 'R$ ' + numBR(v).toFixed(2).replace('.', ','));
  box.style.display = 'grid';
  box.innerHTML = `
    <div style="border:1px solid rgba(255,59,59,.24);background:rgba(255,59,59,.06);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Peças reais</small><br><b>${r.itens}</b></div>
    <div style="border:1px solid rgba(255,59,59,.24);background:rgba(255,59,59,.06);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Qtd. peças</small><br><b>${r.qtd}</b></div>
    <div style="border:1px solid rgba(255,184,0,.26);background:rgba(255,184,0,.06);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Serviços terceirizados</small><br><b>${r.servicos}</b></div>
    <div style="border:1px solid rgba(255,59,59,.24);background:rgba(255,59,59,.06);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Custo peças</small><br><b style="color:var(--danger);">${moedaLocal(r.total)}</b></div>
    <div style="border:1px solid rgba(255,184,0,.26);background:rgba(255,184,0,.06);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Custo serviços</small><br><b style="color:var(--warn);">${moedaLocal(r.totalServicos)}</b></div>
    <div style="border:1px solid rgba(0,212,255,.25);background:rgba(0,212,255,.05);padding:8px;border-radius:3px;"><small style="color:var(--muted);">Custo real geral</small><br><b style="color:var(--cyan);">${moedaLocal(r.totalGeral)}</b></div>`;
};

function dataHoraRelatorioPecasReaisOS(value) {
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
  if (!dt || Number.isNaN(dt.getTime())) return escOS(String(value));
  try {
    return dt.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch (_) {
    return dt.toLocaleString('pt-BR');
  }
}

function dataRelatorioPecasReaisOS(value) {
  if (!value) return '-';
  const txt = String(value).slice(0, 10);
  const m = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : escOS(txt);
}


function normalizarRastreioEstoqueOS(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function codigoRastreioEstoqueOS(item) {
  return String(item?.codigo || item?.codigoFornecedor || item?.codigoComercial || item?.oem || item?.ean || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function dataMsRastreioEstoqueOS(value) {
  if (!value) return 0;
  try {
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value && Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
  } catch (_) { return 0; }
}

function registroFiscalValidoRastreioEstoqueOS(item) {
  const status = normalizarRastreioEstoqueOS(item?.status || item?.statusVinculo || item?.situacao || '');
  return !/(cancelad|excluid|estornad|devolvid)/.test(status);
}

function movimentoEntradaValidoRastreioEstoqueOS(mov) {
  if (!registroFiscalValidoRastreioEstoqueOS(mov)) return false;
  const tipo = normalizarRastreioEstoqueOS(mov?.tipo || mov?.movimento || '');
  const qtd = numBR(mov?.qtd ?? mov?.quantidade ?? mov?.saldoMovimento ?? 0);
  if (qtd <= 0) return false;
  if (/(baixa|saida|devolucao|estorno|cancelamento)/.test(tipo)) return false;
  return /(entrada|compra|nf)/.test(tipo) || !!(mov?.nfId || mov?.nfNumero || mov?.notaFiscal);
}

function notaFiscalRastreioEstoqueOS(nfId, nfNumero) {
  const id = String(nfId || '').trim();
  const numero = String(nfNumero || '').trim();
  return (window.J?.notasFiscaisEntrada || []).find(n => {
    if (!registroFiscalValidoRastreioEstoqueOS(n)) return false;
    if (id && String(n?.id || '') === id) return true;
    const nNumero = String(n?.numero || n?.nfNumero || n?.numeroNF || n?.nf || '').trim();
    return !!(numero && nNumero && nNumero === numero);
  }) || null;
}

function itemCompativelRastreioEstoqueOS(a, b) {
  const codigoA = codigoRastreioEstoqueOS(a);
  const codigoB = codigoRastreioEstoqueOS(b);
  if (codigoA && codigoB && (codigoA === codigoB || codigoA.includes(codigoB) || codigoB.includes(codigoA))) return true;
  const descA = normalizarRastreioEstoqueOS(a?.desc || a?.descricao || '');
  const descB = normalizarRastreioEstoqueOS(b?.desc || b?.descricao || '');
  if (!descA || !descB) return false;
  return descA === descB || (descA.length >= 10 && descB.length >= 10 && (descA.includes(descB.slice(0, 18)) || descB.includes(descA.slice(0, 18))));
}

function montarResultadoRastreioEstoqueOS(base, fonte, exato, estoqueItem) {
  const nfId = String(base?.nfOrigemId || base?.nfId || base?.ultimaNFId || '').trim();
  const nfNumero = String(base?.nfOrigemNumero || base?.nfNumero || base?.ultimaNF || base?.notaFiscal || base?.nf || base?.numeroNF || '').trim();
  const nota = notaFiscalRastreioEstoqueOS(nfId, nfNumero);
  const fornecedor = String(
    base?.fornecedorOrigemNome || base?.fornecedorNome || base?.fornecedor || base?.ultimaFornecedor ||
    nota?.fornecedorSnapshot?.nome || nota?.fornecedorNome || estoqueItem?.ultimaFornecedor || fornecedorPecaEstoqueOS(estoqueItem) || ''
  ).trim();
  const dataEntrada = base?.dataEntrada || base?.dataNF || base?.dataCompra || base?.createdAt || nota?.dataNF || nota?.dataEmissao || nota?.createdAt || '';
  const numeroFinal = nfNumero || String(nota?.numero || nota?.nfNumero || '').trim();
  const idFinal = nfId || String(nota?.id || '').trim();
  const rotulos = {
    movimento_os: 'ESTOQUE • baixa vinculada à O.S. no Kardex',
    vinculo_os: 'ESTOQUE • vínculo fiscal direto com a O.S.',
    peca_os: 'ESTOQUE • referência fiscal gravada na peça',
    entrada_kardex: 'ESTOQUE • última entrada de NF localizada no Kardex antes da O.S.',
    vinculo_estoque: 'ESTOQUE • entrada fiscal localizada nos vínculos do Kardex',
    cadastro_estoque: 'ESTOQUE • referência fiscal do cadastro atual do item',
    sem_rastreio: 'ESTOQUE • NF de entrada não localizada no Kardex'
  };
  return {
    veioDoEstoque: true,
    rastreado: !!(numeroFinal || idFinal),
    rastreioExato: !!exato,
    fonte,
    nfId: idFinal,
    nfNumero: numeroFinal,
    fornecedor,
    dataEntrada,
    origemTexto: rotulos[fonte] || rotulos.sem_rastreio
  };
}

function rastrearOrigemEstoquePecaOS(peca, osAtual) {
  const pecaAtual = peca || {};
  const os = osAtual || {};
  const estoqueId = String(pecaAtual.estoqueId || pecaAtual.estoqueItemId || '').trim();
  if (!estoqueId) {
    return {
      veioDoEstoque: false,
      rastreado: false,
      rastreioExato: false,
      fonte: 'fora_estoque',
      nfId: String(pecaAtual.nfId || '').trim(),
      nfNumero: String(pecaAtual.nf || pecaAtual.nfNumero || pecaAtual.notaFiscal || '').trim(),
      fornecedor: String(pecaAtual.fornecedor || pecaAtual.fornecedorNome || '').trim(),
      dataEntrada: pecaAtual.dataCompra || pecaAtual.dataNF || '',
      origemTexto: 'Peça sem baixa vinculada ao estoque'
    };
  }

  const estoqueItem = estoqueItemOS(estoqueId) || {};
  const osId = String(os?.id || pecaAtual.osId || '').trim();
  const movimentos = (window.J?.estoqueMovimentos || []).filter(m =>
    registroFiscalValidoRastreioEstoqueOS(m) && String(m?.estoqueId || m?.estoqueItemId || '') === estoqueId
  );
  const vinculos = (window.J?.nfItensVinculos || []).filter(v =>
    registroFiscalValidoRastreioEstoqueOS(v) && String(v?.estoqueId || v?.estoqueItemId || '') === estoqueId
  );

  const movimentoOS = movimentos
    .filter(m => osId && String(m?.osId || '') === osId && numBR(m?.qtd ?? m?.quantidade ?? 0) < 0 && (m?.nfOrigemNumero || m?.nfNumero || m?.nfOrigemId || m?.nfId))
    .sort((a, b) => dataMsRastreioEstoqueOS(b?.createdAt || b?.dataMov) - dataMsRastreioEstoqueOS(a?.createdAt || a?.dataMov))[0];
  if (movimentoOS) return montarResultadoRastreioEstoqueOS(movimentoOS, 'movimento_os', true, estoqueItem);

  const vinculoOS = vinculos
    .filter(v => osId && String(v?.osId || '') === osId && itemCompativelRastreioEstoqueOS(v, pecaAtual))
    .sort((a, b) => dataMsRastreioEstoqueOS(b?.createdAt || b?.dataNF) - dataMsRastreioEstoqueOS(a?.createdAt || a?.dataNF))[0];
  if (vinculoOS) return montarResultadoRastreioEstoqueOS(vinculoOS, 'vinculo_os', true, estoqueItem);

  const nfPeca = String(pecaAtual.nf || pecaAtual.nfNumero || pecaAtual.notaFiscal || '').trim();
  const nfIdPeca = String(pecaAtual.nfId || '').trim();
  if (nfPeca || nfIdPeca) return montarResultadoRastreioEstoqueOS(pecaAtual, 'peca_os', true, estoqueItem);

  const limite = dataMsRastreioEstoqueOS(pecaAtual.dataAplicacao || os.updatedAt || os.finalizadoEm || os.createdAt || new Date());
  const entradas = movimentos
    .filter(m => movimentoEntradaValidoRastreioEstoqueOS(m) && itemCompativelRastreioEstoqueOS(m, pecaAtual.desc || pecaAtual.codigo ? pecaAtual : estoqueItem))
    .sort((a, b) => dataMsRastreioEstoqueOS(b?.createdAt || b?.dataNF) - dataMsRastreioEstoqueOS(a?.createdAt || a?.dataNF));
  const entradaAntesOS = entradas.find(m => !limite || !dataMsRastreioEstoqueOS(m?.createdAt || m?.dataNF) || dataMsRastreioEstoqueOS(m?.createdAt || m?.dataNF) <= limite);
  if (entradaAntesOS || entradas[0]) return montarResultadoRastreioEstoqueOS(entradaAntesOS || entradas[0], 'entrada_kardex', false, estoqueItem);

  const vinculoEstoque = vinculos
    .filter(v => {
      const finalidade = normalizarRastreioEstoqueOS(v?.finalidade || v?.destino || 'estoque');
      return !/(os|placa|veiculo)/.test(finalidade) && itemCompativelRastreioEstoqueOS(v, pecaAtual.desc || pecaAtual.codigo ? pecaAtual : estoqueItem);
    })
    .sort((a, b) => dataMsRastreioEstoqueOS(b?.createdAt || b?.dataNF) - dataMsRastreioEstoqueOS(a?.createdAt || a?.dataNF))[0];
  if (vinculoEstoque) return montarResultadoRastreioEstoqueOS(vinculoEstoque, 'vinculo_estoque', false, estoqueItem);

  if (nfPecaEstoqueOS(estoqueItem) || estoqueItem?.ultimaNFId) return montarResultadoRastreioEstoqueOS(estoqueItem, 'cadastro_estoque', false, estoqueItem);
  return montarResultadoRastreioEstoqueOS({}, 'sem_rastreio', false, estoqueItem);
}
window.rastrearOrigemEstoquePeca177 = rastrearOrigemEstoquePecaOS;

async function garantirDadosKardexRelatorioPecasReaisOS() {
  try {
    if (typeof window.thiaLoadFiscalV2612 === 'function') await window.thiaLoadFiscalV2612(false);
    else if (typeof window.thiaEnsureKeyV2612 === 'function') await window.thiaEnsureKeyV2612('fiscal', { force: false });
  } catch (erro) {
    console.warn('[RELATÓRIO PEÇAS REAIS] Não foi possível atualizar o cache fiscal; será usado somente o conteúdo já carregado.', erro);
  }
}

function enriquecerPecaRelatorioEstoqueOS(peca, osAtual) {
  const p = Object.assign({}, peca || {});
  const estoqueId = p.estoqueId || p.estoqueItemId || '';
  const estoqueItem = estoqueItemOS(estoqueId);
  const rastreio = rastrearOrigemEstoquePecaOS(p, osAtual);
  const codigoEstoque = codigoPecaEstoqueOS(estoqueItem);
  const descEstoque = String(estoqueItem?.desc || estoqueItem?.descricao || '').trim();
  const origemItem = estoqueItem
    ? ['ESTOQUE', codigoEstoque, descEstoque, `Saldo atual: ${numBR(estoqueItem?.qtd || 0)}`].filter(Boolean).join(' | ')
    : (estoqueId ? `ESTOQUE | Item ${estoqueId}` : 'Sem baixa de estoque');
  const nfManual = String(p.nf || p.nfNumero || p.notaFiscal || '').trim();
  const fornecedorManual = String(p.fornecedor || p.fornecedorNome || '').trim();
  const dataManual = p.dataCompra || p.dataNF || p.dataEntrada || '';
  let nfRelatorio = nfManual;
  if (!nfRelatorio && rastreio.veioDoEstoque) {
    nfRelatorio = rastreio.nfNumero
      ? `${rastreio.nfNumero}${rastreio.rastreioExato ? ' • vínculo confirmado' : ' • referência Kardex'}`
      : 'ESTOQUE • NF não localizada';
  }
  return Object.assign(p, {
    rastreioEstoqueRelatorio: rastreio,
    fornecedorRelatorio: fornecedorManual || rastreio.fornecedor || (rastreio.veioDoEstoque ? 'Estoque • fornecedor não localizado' : 'Não informado'),
    nfRelatorio: nfRelatorio || 'Não informada',
    dataCompraRelatorio: dataManual || rastreio.dataEntrada || '',
    estoqueOrigemRelatorio: rastreio.veioDoEstoque ? `${origemItem} | ${rastreio.origemTexto}` : (p.estoqueOrigem || 'Sem baixa de estoque')
  });
}

function pecasReaisAtuaisParaRelatorioOS(osAtual) {
  const rows = Array.from(document.querySelectorAll('#containerPecasReais > div'));
  if (rows.length) {
    return rows.map(row => {
      let meta = {};
      try { meta = JSON.parse(row.querySelector('.pr-meta')?.value || '{}') || {}; } catch (_) { meta = {}; }
      const selEstoque = row.querySelector('.pr-estoque');
      const optEstoque = selEstoque?.options?.[selEstoque.selectedIndex];
      return Object.assign({}, meta, {
        codigo: row.querySelector('.pr-codigo')?.value?.trim() || meta.codigo || '',
        desc: row.querySelector('.pr-desc')?.value?.trim() || meta.desc || meta.descricao || '',
        qtd: numBR(row.querySelector('.pr-qtd')?.value || meta.qtd || 1) || 1,
        fornecedor: row.querySelector('.pr-fornec')?.value?.trim() || meta.fornecedor || meta.fornecedorNome || '',
        nf: row.querySelector('.pr-nf')?.value?.trim() || meta.nf || meta.nfNumero || '',
        dataCompra: row.querySelector('.pr-datacompra')?.value?.trim() || meta.dataCompra || meta.dataNF || '',
        valorCompra: numBR(row.querySelector('.pr-valor')?.value || meta.valorCompra || meta.custo || 0),
        estoqueId: selEstoque?.value || meta.estoqueId || meta.estoqueItemId || '',
        estoqueOrigem: selEstoque?.value ? String(optEstoque?.textContent || selEstoque.value).trim() : 'Sem baixa de estoque'
      });
    }).filter(p => p.codigo || p.desc);
  }
  return (Array.isArray(osAtual?.pecasReais) ? osAtual.pecasReais : []).map(p => {
    const est = estoqueItemOS(p.estoqueId || p.estoqueItemId || '');
    return Object.assign({}, p, {
      desc: p.desc || p.descricao || '',
      fornecedor: p.fornecedor || p.fornecedorNome || '',
      nf: p.nf || p.nfNumero || p.notaFiscal || '',
      dataCompra: p.dataCompra || p.dataNF || p.dataEntrada || '',
      valorCompra: numBR(p.valorCompra || p.custo || p.valorUnitario || 0),
      estoqueOrigem: est ? [codigoPecaEstoqueOS(est), est.desc || est.descricao, `Saldo: ${numBR(est.qtd || 0)}`].filter(Boolean).join(' | ') : 'Sem baixa de estoque'
    });
  }).filter(p => p.codigo || p.desc);
}

function servicosReaisAtuaisParaRelatorioOS(osAtual) {
  const rows = Array.from(document.querySelectorAll('#containerServicosReais > .real-service-row'));
  if (rows.length) {
    return rows.map(row => ({
      descricao: row.querySelector('.sr-desc')?.value?.trim() || '',
      fornecedorId: row.dataset?.fornecedorId || '',
      fornecedor: row.querySelector('.sr-fornec')?.value?.trim() || '',
      nf: row.querySelector('.sr-nf')?.value?.trim() || '',
      dataCompra: row.querySelector('.sr-data')?.value?.trim() || '',
      valorCompra: numBR(row.querySelector('.sr-valor')?.value || 0)
    })).filter(s => s.descricao || s.fornecedor || s.nf || s.valorCompra > 0);
  }
  return (Array.isArray(osAtual?.servicosReais) ? osAtual.servicosReais : (Array.isArray(osAtual?.servicosTerceirizadosReais) ? osAtual.servicosTerceirizadosReais : []))
    .map(s => ({
      descricao: s.descricao || s.desc || '', fornecedorId:s.fornecedorId || '', fornecedor:s.fornecedor || s.fornecedorNome || s.terceirizadoNome || '',
      nf:s.nf || s.nfNumero || s.documento || '', dataCompra:s.dataCompra || s.dataServico || s.data || '', valorCompra:numBR(s.valorCompra || s.custo || s.valorReal || s.valor || 0)
    })).filter(s => s.descricao || s.fornecedor || s.nf || s.valorCompra > 0);
}

window.imprimirRelatorioPecasReaisOS = async function() {
  const ativo177 = window._pecasReaisDesbloqueadas === true || document.body?.dataset?.secret177 === 'on';
  if (!ativo177) {
    window.toast?.('Área restrita. Libere primeiro com o código *177.', 'warn');
    return;
  }

  const win = window.open('', '_blank');
  if (!win) {
    window.toast?.('O navegador bloqueou a janela do relatório. Libere pop-ups e tente novamente.', 'warn');
    return;
  }
  try {
    win.document.open();
    win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparando relatório</title></head><body style="font-family:Arial,sans-serif;padding:20px">Preparando relatório e rastreando o Kardex...</body></html>');
    win.document.close();
  } catch (_) {}

  await garantirDadosKardexRelatorioPecasReaisOS();

  const osId = document.getElementById('osId')?.value || '';
  const osAtual = (window.J?.os || []).find(o => String(o.id) === String(osId)) || {};
  const clienteId = document.getElementById('osCliente')?.value || osAtual.clienteId || '';
  const veiculoId = document.getElementById('osVeiculo')?.value || osAtual.veiculoId || osAtual.veiculo || '';
  const cliente = (window.J?.clientes || []).find(c => String(c.id) === String(clienteId)) || {};
  const veiculo = (window.J?.veiculos || []).find(v => String(v.id) === String(veiculoId)) || osAtual.veiculoSnapshot || {};
  const pecasBase = pecasReaisAtuaisParaRelatorioOS(osAtual);
  const servicosReais = servicosReaisAtuaisParaRelatorioOS(osAtual);
  if (!pecasBase.length && !servicosReais.length) {
    try { win.close?.(); } catch (_) {}
    window.toast?.('Esta O.S. não possui peças ou serviços reais registrados para imprimir.', 'warn');
    return;
  }
  const pecas = pecasBase.map(p => enriquecerPecaRelatorioEstoqueOS(p, osAtual));

  const oficina = window.J?.oficina || {};
  const nomeOficina = window.J?.tnome || oficina.nomeFantasia || oficina.razaoSocial || oficina.nome || 'OFICIN-IA';
  const enderecoOficina = [oficina.endereco || oficina.rua || oficina.logradouro, oficina.numero, oficina.bairro, oficina.cidade, oficina.uf].filter(Boolean).join(', ');
  const placa = placaFormatadaOS(veiculo.placa || osAtual.placa || '');
  const prefixo = String(veiculo.prefixo || osAtual.prefixo || osAtual.prefixoVeiculo || '').toUpperCase();
  const modelo = modeloVeiculoOS(osAtual, veiculo) || veiculo.modelo || '-';
  const clienteNome = cliente.nome || cliente.razaoSocial || cliente.nomeFantasia || osAtual.clienteNome || 'Não identificado';
  const responsaveis = (Array.isArray(osAtual.mecanicos) ? osAtual.mecanicos.map(m => m?.nome).filter(Boolean) : []);
  if (!responsaveis.length) {
    const mecId = document.getElementById('osMec')?.value || osAtual.mecId || '';
    const mec = (window.J?.equipe || []).find(f => String(f.id) === String(mecId));
    if (mec?.nome || osAtual.mecNome) responsaveis.push(mec?.nome || osAtual.mecNome);
  }
  const total = pecas.reduce((s, p) => s + Math.max(0, numBR(p.qtd || 0)) * Math.max(0, numBR(p.valorCompra || 0)), 0);
  const totalServicosReais = servicosReais.reduce((s, item) => s + Math.max(0, numBR(item.valorCompra || 0)), 0);
  const totalRealGeral = total + totalServicosReais;
  const moedaLocal = typeof moedaOS === 'function' ? moedaOS : (v => 'R$ ' + numBR(v).toFixed(2).replace('.', ','));
  const linhas = pecas.map((p, index) => {
    const qtd = Math.max(0, numBR(p.qtd || 0));
    const unit = Math.max(0, numBR(p.valorCompra || 0));
    return `<tr>
      <td data-label="#">${index + 1}</td>
      <td data-label="Código real">${escOS(p.codigo || '-')}</td>
      <td data-label="Descrição real instalada">${escOS(p.desc || p.descricao || '-')}</td>
      <td data-label="Quantidade" class="num">${qtd}</td>
      <td data-label="Onde comprou / fornecedor">${escOS(p.fornecedorRelatorio)}</td>
      <td data-label="Nota fiscal / rastreio">${escOS(p.nfRelatorio)}</td>
      <td data-label="Data da compra / entrada">${dataRelatorioPecasReaisOS(p.dataCompraRelatorio)}</td>
      <td data-label="Origem / estoque">${escOS(p.estoqueOrigemRelatorio)}</td>
      <td data-label="Custo unitário" class="num">${moedaLocal(unit)}</td>
      <td data-label="Custo total" class="num"><b>${moedaLocal(qtd * unit)}</b></td>
    </tr>`;
  }).join('');

  const linhasServicosReais = servicosReais.map((s, index) => `<tr>
      <td data-label="#">${index + 1}</td>
      <td data-label="Serviço terceirizado">${escOS(s.descricao || '-')}</td>
      <td data-label="Prestador / fornecedor">${escOS(s.fornecedor || '-')}</td>
      <td data-label="Nota / documento">${escOS(s.nf || '-')}</td>
      <td data-label="Data">${dataRelatorioPecasReaisOS(s.dataCompra)}</td>
      <td data-label="Custo real" class="num"><b>${moedaLocal(s.valorCompra || 0)}</b></td>
    </tr>`).join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>Relatório Real da O.S. ${escOS(placa || osId)}</title><style>
    @page{size:A4 landscape;margin:8mm}
    *{box-sizing:border-box}
    html,body{width:100%;max-width:100%;margin:0;padding:0;overflow-x:hidden}
    body{font-family:Arial,sans-serif;color:#111;background:#fff;font-size:10px}
    .page{width:100%;max-width:100%;padding:10px;overflow:hidden}
    .no-print{display:flex;justify-content:flex-end;margin-bottom:8px}
    .no-print button{max-width:100%;padding:9px 14px;font-weight:700;cursor:pointer;white-space:normal}
    header{width:100%;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;min-width:0}
    header>div{min-width:0;overflow-wrap:anywhere}
    .oficina{text-align:right;max-width:48%;overflow-wrap:anywhere}
    h1{font-size:18px;line-height:1.12;margin:0 0 3px;overflow-wrap:anywhere}
    .restrito{font-size:9px;font-weight:700;color:#a00;overflow-wrap:anywhere}
    .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:10px;width:100%;min-width:0}
    .box{border:1px solid #777;padding:6px;min-height:39px;min-width:0;overflow-wrap:anywhere}
    .box b{display:block;font-size:9px;text-transform:uppercase;margin-bottom:3px}
    .wide{grid-column:span 2}
    .table-wrap{width:100%;max-width:100%;overflow:hidden}
    table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid #777;padding:5px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;min-width:0}
    th{background:#e8e8e8;text-transform:uppercase;font-size:8px}
    td.num{text-align:right;white-space:nowrap}
    tfoot td{font-size:12px;background:#f2f2f2}
    .total-geral{text-align:right}.total-geral b:first-child{margin-right:18px}
    .rodape{margin-top:8px;font-size:8px;color:#555;display:flex;justify-content:space-between;gap:10px;overflow-wrap:anywhere}
    @media screen and (max-width:860px){
      body{font-size:12px}
      .page{padding:8px}
      .no-print{justify-content:stretch}
      .no-print button{width:100%;font-size:14px;min-height:44px}
      header{display:block;gap:0}
      .oficina{max-width:100%;text-align:left!important;margin-top:8px;font-size:10px}
      h1{font-size:16px}
      .meta{grid-template-columns:1fr}
      .wide{grid-column:auto}
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
      .rodape{display:block;line-height:1.5}
      .rodape span{display:block}
    }
    @media print{
      html,body{overflow:visible}
      .page{padding:0;overflow:visible}
      .no-print{display:none}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  </style></head><body><main class="page"><div class="no-print"><button onclick="window.print()">IMPRIMIR / SALVAR PDF</button></div><header><div><h1>RELATÓRIO INTERNO DE PEÇAS E SERVIÇOS REAIS</h1><div class="restrito">ACESSO RESTRITO DO PROPRIETÁRIO — CÓDIGO *177</div></div><div class="oficina"><b>${escOS(nomeOficina)}</b><br>${escOS(enderecoOficina || 'Local da oficina não informado')}</div></header><section class="meta">
    <div class="box"><b>O.S.</b>#${escOS(String(osAtual.numero || osAtual.numeroOS || osId || 'NÃO SALVA').slice(-12).toUpperCase())}</div>
    <div class="box"><b>Status</b>${escOS(document.getElementById('osStatus')?.value || osAtual.status || '-')}</div>
    <div class="box"><b>Abertura da O.S.</b>${dataHoraRelatorioPecasReaisOS(osAtual.createdAt || osAtual.abertaEm || osAtual.dataAbertura || osAtual.data)}</div>
    <div class="box"><b>Relatório emitido em</b>${dataHoraRelatorioPecasReaisOS(new Date())}</div>
    <div class="box wide"><b>Cliente / órgão</b>${escOS(clienteNome)}</div>
    <div class="box wide"><b>Veículo onde as peças foram instaladas</b>${escOS([prefixo, placa, modelo].filter(Boolean).join(' / ') || '-')}</div>
    <div class="box"><b>KM da troca</b>${escOS(document.getElementById('osKm')?.value || osAtual.km || '-')}</div>
    <div class="box"><b>Responsável(is)</b>${escOS(responsaveis.join(', ') || 'Não informado')}</div>
    <div class="box wide"><b>Local da troca</b>${escOS([nomeOficina, enderecoOficina].filter(Boolean).join(' — '))}</div>
  </section>
  ${pecas.length ? `<h2 style="font-size:12px;margin:10px 0 5px;">PEÇAS REAIS INSTALADAS</h2><div class="table-wrap"><table><colgroup><col style="width:3%"><col style="width:9%"><col style="width:20%"><col style="width:4%"><col style="width:12%"><col style="width:9%"><col style="width:8%"><col style="width:16%"><col style="width:9%"><col style="width:10%"></colgroup><thead><tr><th>#</th><th>Código real</th><th>Descrição real instalada</th><th>Qtd.</th><th>Onde comprou / fornecedor</th><th>Nota fiscal / rastreio</th><th>Data compra / entrada</th><th>Origem / estoque</th><th>Custo unit.</th><th>Custo total</th></tr></thead><tbody>${linhas}</tbody><tfoot><tr><td colspan="10" class="total-geral"><b>CUSTO REAL TOTAL DAS PEÇAS</b><b>${moedaLocal(total)}</b></td></tr></tfoot></table></div>` : ''}
  ${servicosReais.length ? `<h2 style="font-size:12px;margin:12px 0 5px;">SERVIÇOS TERCEIRIZADOS REAIS</h2><div class="table-wrap"><table><colgroup><col style="width:4%"><col style="width:31%"><col style="width:23%"><col style="width:16%"><col style="width:12%"><col style="width:14%"></colgroup><thead><tr><th>#</th><th>Serviço terceirizado</th><th>Prestador / fornecedor</th><th>Nota / documento</th><th>Data</th><th>Custo real</th></tr></thead><tbody>${linhasServicosReais}</tbody><tfoot><tr><td colspan="6" class="total-geral"><b>CUSTO REAL TOTAL DOS SERVIÇOS</b><b>${moedaLocal(totalServicosReais)}</b></td></tr></tfoot></table></div>` : ''}
  <div style="display:flex;justify-content:flex-end;margin-top:10px;"><div style="border:2px solid #111;padding:8px 12px;font-size:13px;display:flex;gap:24px;"><b>CUSTO REAL GERAL</b><b>${moedaLocal(totalRealGeral)}</b></div></div>
  <div class="rodape"><span>Documento interno gerado pelo OFICIN-IA. Peças de estoque mantêm rastreio Kardex; serviços terceirizados são registros internos da O.S.</span><span>Powered by thIAguinho Soluções Digitais</span></div></main></body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch (_) {} }, 350);
};

window.adicionarPecaRealRow = function(p) {
  const ct = document.getElementById('containerPecasReais');
  if (!ct) return;
  const hoje = new Date().toISOString().slice(0,10);
  const codigoReal = p.codigo || p.codigoComercial || p.oem || p.codigoFornecedor || '';
  const descReal = p.desc || p.descricao || '';
  const fornecedorReal = p.fornecedor || p.fornecedorNome || '';
  const nfReal = p.nf || p.nfNumero || p.notaFiscal || '';
  const dataCompraReal = String(p.dataCompra || p.dataNF || p.dataEntrada || hoje).slice(0, 10);
  const valorCompraReal = numBR(p.valorCompra || p.custo || p.valorUnitario || 0);
  const estoqueReal = p.estoqueId || p.estoqueItemId || '';
  const metaReal = Object.assign({}, p, {
    codigo: codigoReal,
    desc: descReal,
    descricao: descReal,
    fornecedor: fornecedorReal,
    nf: nfReal,
    nfNumero: nfReal,
    dataCompra: dataCompraReal,
    valorCompra: valorCompraReal,
    estoqueId: estoqueReal
  });
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:110px 1fr 50px 130px 110px 130px 105px 105px 32px;gap:6px;align-items:center;background:rgba(255,59,59,0.05);padding:6px;border-radius:3px;border:1px solid rgba(255,59,59,0.2);';
  const estoqueOpts = optionsPecasReaisEstoqueFiltradasOS(estoqueReal, '');
  div.innerHTML = `
    <input type="text" class="j-input pr-codigo" value="${_escVal(p.codigo||'')}" placeholder="Cód. real" style="font-family:var(--fm);font-size:0.75rem;" title="Código OEM/real da peça instalada">
    <input type="text" class="j-input pr-desc" value="${_escVal(p.desc||'')}" placeholder="Descrição real instalada">
    <input type="number" class="j-input pr-qtd" value="${p.qtd||1}" min="1" placeholder="Qtd">
    <input type="search" class="j-input pr-busca-estoque" value="${_escVal(codigoReal || descReal)}" placeholder="Buscar no estoque para peça real trocada..." oninput="window.filtrarPecaRealEstoqueOS(this)" onkeydown="window.selecionarPrimeiraPecaRealFiltradaOS(this,event)" style="grid-column:1/-1;font-family:var(--fm);font-size:.72rem;background:rgba(255,59,59,.05);border:1px solid rgba(255,59,59,.22);" autocomplete="off">
    <select class="j-select pr-estoque" onchange="window.selecionarPecaRealEstoque(this)" title="Selecione uma peça do estoque somente se esta peça real deve baixar estoque">${estoqueOpts}</select>
    <input type="text" class="j-input pr-fornec" value="${_escVal(p.fornecedor||'')}" placeholder="Fornecedor">
    <input type="text" class="j-input pr-nf" value="${_escVal(p.nf||'')}" placeholder="Nº Nota Fiscal">
    <input type="date" class="j-input pr-datacompra" value="${p.dataCompra||hoje}" title="Data da compra">
    <input type="text" inputmode="decimal" class="j-input pr-valor" value="${numBR(p.valorCompra||0).toFixed(2).replace('.', ',')}" placeholder="R$ compra" title="Valor real de compra da peça instalada">
    <button type="button" onclick="this.parentElement.remove();window.atualizarResumoPecasReais177&&window.atualizarResumoPecasReais177()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
  `;
  div.addEventListener('input', e => { if (e.target?.matches?.('.pr-qtd,.pr-valor')) window.atualizarResumoPecasReais177?.(); });
  div.addEventListener('change', e => { if (e.target?.matches?.('.pr-qtd,.pr-valor')) window.atualizarResumoPecasReais177?.(); });
  ct.appendChild(div);
  window.atualizarResumoPecasReais177?.();
};

window.adicionarPecaRealRow = function(p) {
  const ct = document.getElementById('containerPecasReais');
  if (!ct) return;
  const hoje = new Date().toISOString().slice(0,10);
  const codigoReal = p.codigo || p.codigoComercial || p.oem || p.codigoFornecedor || '';
  const descReal = p.desc || p.descricao || '';
  const fornecedorReal = p.fornecedor || p.fornecedorNome || '';
  const nfReal = p.nf || p.nfNumero || p.notaFiscal || '';
  const dataCompraReal = String(p.dataCompra || p.dataNF || p.dataEntrada || hoje).slice(0, 10);
  const valorCompraReal = numBR(p.valorCompra || p.custo || p.valorUnitario || 0);
  const estoqueReal = p.estoqueId || p.estoqueItemId || '';
  const metaReal = Object.assign({}, p, {
    codigo: codigoReal,
    desc: descReal,
    descricao: descReal,
    fornecedor: fornecedorReal,
    nf: nfReal,
    nfNumero: nfReal,
    dataCompra: dataCompraReal,
    valorCompra: valorCompraReal,
    estoqueId: estoqueReal
  });
  const div = document.createElement('div');
  div.className = 'real-item-row';
  div.style.cssText = 'display:grid;grid-template-columns:110px 1fr 50px 130px 110px 130px 105px 105px 32px;gap:6px;align-items:center;background:rgba(255,59,59,0.05);padding:6px;border-radius:3px;border:1px solid rgba(255,59,59,0.2);';
  const estoqueOpts = optionsPecasReaisEstoqueFiltradasOS(estoqueReal, '');
  div.innerHTML = `
    <input type="hidden" class="pr-meta" value="${_escVal(JSON.stringify(metaReal))}">
    <input type="text" class="j-input pr-codigo" value="${_escVal(codigoReal)}" placeholder="Cod. real" style="font-family:var(--fm);font-size:0.75rem;" title="Codigo OEM/real da peca">
    <input type="text" class="j-input pr-desc" value="${_escVal(descReal)}" placeholder="Descricao real">
    <input type="number" class="j-input pr-qtd" value="${p.qtd||1}" min="1" placeholder="Qtd">
    <input type="search" class="j-input pr-busca-estoque" value="${_escVal(codigoReal || descReal)}" placeholder="Buscar no estoque para peça real trocada..." oninput="window.filtrarPecaRealEstoqueOS(this)" onkeydown="window.selecionarPrimeiraPecaRealFiltradaOS(this,event)" style="grid-column:1/-1;font-family:var(--fm);font-size:.72rem;background:rgba(255,59,59,.05);border:1px solid rgba(255,59,59,.22);" autocomplete="off">
    <select class="j-select pr-estoque" onchange="window.selecionarPecaRealEstoque(this)" title="Selecione estoque apenas se deve baixar estoque">${estoqueOpts}</select>
    <input type="text" class="j-input pr-fornec" value="${_escVal(fornecedorReal)}" placeholder="Fornecedor">
    <input type="text" class="j-input pr-nf" value="${_escVal(nfReal)}" placeholder="NF">
    <input type="date" class="j-input pr-datacompra" value="${_escVal(dataCompraReal)}" title="Data da compra">
    <input type="text" inputmode="decimal" class="j-input pr-valor" value="${valorCompraReal.toFixed(2).replace('.', ',')}" placeholder="R$ compra" title="Valor real de compra">
    <button type="button" onclick="this.parentElement.remove();window.atualizarResumoPecasReais177&&window.atualizarResumoPecasReais177()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">x</button>
  `;
  div.addEventListener('input', e => { if (e.target?.matches?.('.pr-qtd,.pr-valor')) window.atualizarResumoPecasReais177?.(); });
  div.addEventListener('change', e => { if (e.target?.matches?.('.pr-qtd,.pr-valor')) window.atualizarResumoPecasReais177?.(); });
  ct.appendChild(div);
  window.atualizarResumoPecasReais177?.();
  return div;
};

window.selecionarPecaRealEstoque = function(sel) {
  const opt = sel.options[sel.selectedIndex];
  const row = sel.closest('div');
  if (!opt || !row || !sel.value) return;
  const codigo = opt.dataset.codigo || '';
  const desc = opt.dataset.desc || '';
  const custo = numBR(opt.dataset.custo || 0);
  const fornecedor = opt.dataset.fornecedor || '';
  const nf = opt.dataset.nf || '';
  const dataCompra = opt.dataset.dataCompra || '';
  if (codigo && !row.querySelector('.pr-codigo')?.value) row.querySelector('.pr-codigo').value = codigo;
  if (desc && !row.querySelector('.pr-desc')?.value) row.querySelector('.pr-desc').value = desc;
  if (fornecedor && !row.querySelector('.pr-fornec')?.value) row.querySelector('.pr-fornec').value = fornecedor;
  if (nf && !row.querySelector('.pr-nf')?.value) row.querySelector('.pr-nf').value = nf;
  if (dataCompra && row.querySelector('.pr-datacompra')) row.querySelector('.pr-datacompra').value = String(dataCompra).slice(0,10);
  if (custo && numBR(row.querySelector('.pr-valor')?.value || 0) <= 0) row.querySelector('.pr-valor').value = custo.toFixed(2).replace('.', ',');
  window.atualizarResumoPecasReais177?.();
  setTimeout(() => osGarantirProximaLinhaReal('peca'), 0);
};

function normalizarBuscaServicoRealOS(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}

function historicoServicosReaisOS(termo) {
  const q = normalizarBuscaServicoRealOS(termo);
  const termos = q.split(/\s+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  const add = (item, origem) => {
    const descricao = String(item?.descricao || item?.desc || '').trim();
    const fornecedor = String(item?.fornecedor || item?.fornecedorNome || item?.terceirizadoNome || '').trim();
    if (!descricao && !fornecedor) return;
    const alvo = normalizarBuscaServicoRealOS([descricao, fornecedor, item?.nf, item?.nfNumero].filter(Boolean).join(' '));
    if (termos.length && !termos.every(t => alvo.includes(t))) return;
    const key = normalizarBuscaServicoRealOS(descricao) + '|' + normalizarBuscaServicoRealOS(fornecedor);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ descricao, fornecedor, fornecedorId:item?.fornecedorId || item?.terceirizadoId || '', origem });
  };
  (window.J?.os || []).forEach(os => {
    (os.servicosReais || os.servicosTerceirizadosReais || []).forEach(s => add(s, 'servico_real'));
    (os.servicos || []).filter(s => normalizarTipoExecucaoServicoOS(s?.tipoExecucao || s?.execucaoTipo, s) === 'terceirizada').forEach(s => add(s, 'servico_os'));
  });
  return out.slice(0,60);
}

function optionsHistoricoServicoRealOS(termo) {
  const q = String(termo || '').trim();
  // Não percorre todo o histórico ao criar uma linha vazia.
  // A pesquisa é feita somente depois que o usuário começa a digitar e usa apenas J.os já carregado.
  if (!q) return '<option value="">Digite acima para pesquisar no histórico local</option>';
  const lista = historicoServicosReaisOS(q);
  return '<option value="">Digitar manualmente</option>' + lista.map((s, idx) => `<option value="${idx}" data-desc="${escOS(s.descricao)}" data-fornecedor="${escOS(s.fornecedor)}" data-fornecedor-id="${escOS(s.fornecedorId)}">${escOS([s.descricao, s.fornecedor ? 'Prestador: '+s.fornecedor : ''].filter(Boolean).join(' | '))}</option>`).join('');
}

window.filtrarServicoRealHistoricoOS = function(input) {
  const row = input?.closest?.('.real-service-row');
  const sel = row?.querySelector?.('.sr-historico');
  if (!row || !sel) return;
  clearTimeout(row._srBuscaTimer);
  row._srBuscaTimer = setTimeout(() => {
    sel.innerHTML = optionsHistoricoServicoRealOS(input.value || '');
  }, 110);
};

window.selecionarPrimeiroServicoRealOS = function(input, ev) {
  if (ev && ev.key !== 'Enter') return;
  ev?.preventDefault?.();
  const row = input?.closest?.('.real-service-row');
  const sel = row?.querySelector?.('.sr-historico');
  if (!row || !sel) return;
  clearTimeout(row._srBuscaTimer);
  sel.innerHTML = optionsHistoricoServicoRealOS(input.value || '');
  const opt = Array.from(sel.options).find(o => o.value !== '');
  if (!opt) { row.querySelector('.sr-desc')?.focus?.(); return; }
  sel.value = opt.value;
  window.selecionarServicoRealHistoricoOS?.(sel);
};

window.selecionarServicoRealHistoricoOS = function(sel) {
  const row = sel?.closest?.('.real-service-row');
  const opt = sel?.options?.[sel.selectedIndex];
  if (!row || !opt || sel.value === '') return;
  const desc = opt.dataset.desc || '';
  const fornecedor = opt.dataset.fornecedor || '';
  if (desc) row.querySelector('.sr-desc').value = desc;
  if (fornecedor) row.querySelector('.sr-fornec').value = fornecedor;
  row.dataset.fornecedorId = opt.dataset.fornecedorId || localizarFornecedorTerceirizadoOS(fornecedor)?.id || '';
  window.atualizarResumoPecasReais177?.();
  setTimeout(() => osGarantirProximaLinhaReal('servico'), 0);
};

window.atualizarFornecedorServicoRealOS = function(input) {
  const row = input?.closest?.('.real-service-row');
  if (!row) return;
  const nome = String(input.value || '').trim();
  const fornecedor = localizarFornecedorTerceirizadoOS(nome);
  row.dataset.fornecedorId = fornecedor?.id || '';
};

window.adicionarServicoRealRow = function(s = {}, options = {}) {
  const ct = document.getElementById('containerServicosReais');
  if (!ct) return null;
  const hoje = dataLocalISOOS();
  const descricao = s.descricao || s.desc || '';
  const fornecedor = s.fornecedor || s.fornecedorNome || s.terceirizadoNome || '';
  const fornecedorId = s.fornecedorId || s.terceirizadoId || localizarFornecedorTerceirizadoOS(fornecedor)?.id || '';
  const nf = s.nf || s.nfNumero || s.documento || '';
  const data = String(s.dataCompra || s.dataServico || s.data || hoje).slice(0,10);
  const valor = numBR(s.valorCompra || s.custo || s.valorReal || s.valor || 0);
  const meta = Object.assign({}, s, { descricao, desc:descricao, fornecedor, fornecedorNome:fornecedor, fornecedorId, nf, nfNumero:nf, dataCompra:data, valorCompra:valor });
  const row = document.createElement('div');
  row.className = 'real-service-row';
  row.dataset.fornecedorId = fornecedorId;
  row.style.cssText = 'display:grid;grid-template-columns:minmax(260px,1.5fr) minmax(210px,1fr) 120px 110px 110px 32px;gap:6px;align-items:center;background:rgba(255,184,0,.045);padding:6px;border-radius:3px;border:1px solid rgba(255,184,0,.22);';
  row.innerHTML = `
    <input type="hidden" class="sr-meta" value="${_escVal(JSON.stringify(meta))}">
    <input type="search" class="j-input sr-busca-historico" value="${_escVal(descricao || fornecedor)}" placeholder="Buscar serviço terceirizado já lançado ou fornecedor..." oninput="window.filtrarServicoRealHistoricoOS(this)" onkeydown="window.selecionarPrimeiroServicoRealOS(this,event)" autocomplete="off" style="grid-column:1/-1;font-family:var(--fm);font-size:.72rem;background:rgba(255,184,0,.04);border:1px solid rgba(255,184,0,.22);">
    <select class="j-select sr-historico" onchange="window.selecionarServicoRealHistoricoOS(this)" title="Sugestões locais do histórico já carregado" style="grid-column:1/-1;">${optionsHistoricoServicoRealOS('')}</select>
    <input type="text" class="j-input sr-desc" value="${_escVal(descricao)}" placeholder="Descrição do serviço realizado">
    <input type="text" class="j-input sr-fornec" list="os-lista-terceirizados" value="${_escVal(fornecedor)}" placeholder="Prestador / fornecedor" onfocus="window.atualizarListaTerceirizadosOS?.()" oninput="window.atualizarFornecedorServicoRealOS(this)" onchange="window.atualizarFornecedorServicoRealOS(this)">
    <input type="text" class="j-input sr-nf" value="${_escVal(nf)}" placeholder="NF / recibo">
    <input type="date" class="j-input sr-data" value="${_escVal(data)}">
    <input type="text" inputmode="decimal" class="j-input sr-valor" value="${valor ? valor.toFixed(2).replace('.', ',') : '0,00'}" placeholder="R$ custo">
    <button type="button" onclick="this.parentElement.remove();window.atualizarResumoPecasReais177?.()" style="background:rgba(255,59,59,.1);border:1px solid rgba(255,59,59,.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">x</button>`;
  ct.appendChild(row);
  window.atualizarResumoPecasReais177?.();
  return row;
};

window.baixarEstoquePecasReais = async function(osId, antigas, novas) {
  const role = (window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  if (!['admin','superadmin','gestor','gerente'].includes(role)) return;
  const antigasPorEstoque = {};
  (antigas || []).forEach(p => {
    if (!p.estoqueId) return;
    antigasPorEstoque[p.estoqueId] = (antigasPorEstoque[p.estoqueId] || 0) + numBR(p.qtd || 0);
  });
  const novasPorEstoque = {};
  (novas || []).forEach(p => {
    if (!p.estoqueId) return;
    novasPorEstoque[p.estoqueId] = (novasPorEstoque[p.estoqueId] || 0) + numBR(p.qtd || 0);
  });

  const batch = db.batch();
  let operacoes = 0;
  const agora = new Date().toISOString();
  Object.keys(novasPorEstoque).forEach(estoqueId => {
    const delta = novasPorEstoque[estoqueId] - (antigasPorEstoque[estoqueId] || 0);
    if (delta <= 0) return;
    const item = (window.J?.estoque || []).find(x => x.id === estoqueId);
    if (!item) return;
    batch.update(db.collection('estoqueItems').doc(estoqueId), {
      qtd: Math.max(0, numBR(item.qtd || 0) - delta),
      updatedAt: agora
    });
    const auditRef = db.collection('lixeira_auditoria').doc();
    batch.set(auditRef, {
      tenantId: J.tid,
      modulo: 'ESTOQUE',
      acao: `Baixa por peca real instalada OS ${String(osId || '').slice(-6).toUpperCase()}: ${item.desc || estoqueId} (-${delta})`,
      usuario: J.nome || 'Gestor',
      ts: agora
    });
    operacoes += 2;
  });
  if (operacoes) await batch.commit();
};

function statusOptionsExecOS(tipo, atual) {
  const opts = tipo === 'peca'
    ? [
        ['pendente', 'Pendente'],
        ['trocada', 'Peça trocada/executada'],
        ['nao_encontrada', 'Peça não encontrada'],
        ['nao_trocada', 'Não trocada']
      ]
    : [
        ['pendente', 'Pendente'],
        ['em_execucao', 'Em execução'],
        ['executado', 'Serviço executado'],
        ['nao_executado', 'Não executado']
      ];
  return opts.map(([value, label]) => `<option value="${value}" ${value === atual ? 'selected' : ''}>${label}</option>`).join('');
}

window.salvarExecucaoAprovadosOS = async function(osId) {
  if (!osId) { window.toast?.('Salve a O.S. antes de marcar execução.', 'warn'); return; }
  const osAtual = (window.J?.os || []).find(o => o.id === osId) || {};
  const execucaoItens = { ...(osAtual.execucaoItens || {}) };
  const rows = document.querySelectorAll('#resumoAprovacaoOS .execucao-aprovado-row');
  rows.forEach(row => {
    const key = row.dataset.key;
    if (!key) return;
    const mecIdExecucao = row.querySelector('.exec-mec')?.value || row.dataset.mecId || '';
    const mecExecucao = snapshotMecanicoOS(mecIdExecucao);
    execucaoItens[key] = {
      key,
      tipo: row.dataset.tipo || '',
      status: row.querySelector('.exec-status')?.value || 'pendente',
      obs: row.querySelector('.exec-obs')?.value?.trim() || '',
      mecId: mecIdExecucao,
      mecNome: mecExecucao.nome || '',
      responsavelId: mecIdExecucao,
      responsavelNome: mecExecucao.nome || '',
      usuario: window.J?.nome || 'Gestor',
      atualizadoPorId: window.J?.fid || window.J?.uid || '',
      updatedAt: new Date().toISOString()
    };
  });
  const timeline = Array.isArray(osAtual.timeline) ? osAtual.timeline.slice() : [];
  timeline.push({
    dt: new Date().toISOString(),
    user: window.J?.nome || 'Gestor',
    acao: `Atualizou execução interna de ${rows.length} item(ns) aprovado(s).`
  });
  await db.collection('ordens_servico').doc(osId).update(limparUndefinedFirestoreOS({
    execucaoItens,
    timeline,
    updatedAt: new Date().toISOString()
  }));
  window.toast?.('Execução interna salva.', 'ok');
};

function cotacoesOSMap(os) {
  const raw = os?.cotacoesPecas || {};
  if (Array.isArray(raw)) {
    return raw.reduce((acc, item) => {
      if (item?.key) acc[item.key] = item;
      return acc;
    }, {});
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function cotacaoValorOS(v) {
  return numBR(v || 0);
}

function melhorCotacaoOS(cot) {
  const opcoes = (cot?.opcoes || []).filter(o => cotacaoValorOS(o.valorUnitario) > 0);
  if (!opcoes.length) return null;
  return opcoes.slice().sort((a, b) => cotacaoValorOS(a.valorUnitario) - cotacaoValorOS(b.valorUnitario))[0];
}

function cotacaoResumoMelhorHTML(best, moedaLocal) {
  if (!best) return 'Registre 1 ou mais cotações recebidas';
  const nome = best.fornecedor || best.fornecedorNome || 'Fornecedor';
  const marca = best.marca || best.marcaPeca || '';
  const modelo = best.modelo || best.modeloPeca || (best.marcaModelo && best.marcaModelo !== marca ? best.marcaModelo : '');
  const marcaModelo = [marca, modelo].filter(Boolean).join(' / ');
  const prazo = best.prazo ? `<br><small style="color:var(--muted);">Prazo: ${escOS(best.prazo)}</small>` : '';
  const detalhe = marcaModelo ? `<br><small style="color:var(--muted);">Marca/modelo: ${escOS(marcaModelo)}</small>` : '';
  return `Menor cotação: <b>${escOS(nome)}</b><br>${moedaLocal(cotacaoValorOS(best.valorUnitario))} un.${detalhe}${prazo}`;
}

function fornecedorOptionsCotacaoOS(selected) {
  const opts = ['<option value="">Fornecedor livre</option>'];
  (window.J?.fornecedores || []).forEach(f => {
    opts.push(`<option value="${escOS(f.id)}" ${String(f.id) === String(selected || '') ? 'selected' : ''}>${escOS(f.nome || f.razao || f.id)}</option>`);
  });
  return opts.join('');
}

function cotacaoOpcaoRowHTML(op, idx, key, bestId) {
  const id = op?.id || ('cot-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 7));
  const marcada = op?.selecionado || false;
  const comprado = op?.comprado ? 'checked' : '';
  const bestClass = id === bestId ? ' is-best-cotacao' : '';
  const marcaModelo = [op?.marca || op?.marcaPeca || '', op?.modelo || op?.modeloPeca || op?.marcaModelo || ''].filter(Boolean).join(' / ');
  return `<div class="cot-opcao-row${bestClass}" data-cot-id="${escOS(id)}" style="display:grid;grid-template-columns:minmax(140px,1fr) minmax(135px,1fr) minmax(135px,1fr) 86px 82px minmax(130px,1fr) 70px 78px 32px;gap:7px;align-items:center;background:${id === bestId ? 'rgba(0,255,136,.08)' : 'rgba(255,255,255,.035)'};border:1px solid ${id === bestId ? 'rgba(0,255,136,.42)' : 'rgba(255,255,255,.08)'};border-radius:3px;padding:7px;">
    <select class="j-select cot-fornecedor-id" onchange="window.preencherFornecedorCotacaoOS?.(this);window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">${fornecedorOptionsCotacaoOS(op?.fornecedorId || '')}</select>
    <input class="j-input cot-fornecedor" value="${_escVal(op?.fornecedor || '')}" placeholder="Fornecedor livre ou nome recebido" oninput="window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">
    <input class="j-input cot-marca-modelo" value="${_escVal(marcaModelo)}" placeholder="Marca / modelo ofertado" oninput="window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">
    <input class="j-input cot-valor" inputmode="decimal" value="${cotacaoValorOS(op?.valorUnitario).toFixed(2).replace('.', ',')}" placeholder="Valor un." oninput="window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">
    <input class="j-input cot-prazo" value="${_escVal(op?.prazo || '')}" placeholder="Prazo" oninput="window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">
    <input class="j-input cot-condicao" value="${_escVal(op?.condicao || op?.obs || '')}" placeholder="Condicao / obs." oninput="window.atualizarAnaliseCotacaoBox?.(this.closest('.cotacao-peca-box'))" style="font-size:.70rem;">
    <label title="Cotacao escolhida para compra" style="display:flex;align-items:center;justify-content:center;gap:4px;font-family:var(--fm);font-size:.58rem;color:var(--cyan);"><input type="radio" name="cot-escolhida-${escOS(key)}" class="cot-escolhida" ${marcada ? 'checked' : ''}> Comprar</label>
    <label title="Marcar como ja comprado" style="display:flex;align-items:center;justify-content:center;gap:4px;font-family:var(--fm);font-size:.58rem;color:var(--success);"><input type="checkbox" class="cot-comprado" ${comprado}> Comprado</label>
    <button type="button" onclick="this.closest('.cot-opcao-row').remove()" title="Remover cotacao" style="height:30px;background:rgba(255,59,59,.08);border:1px solid rgba(255,59,59,.25);color:var(--danger);border-radius:3px;cursor:pointer;">x</button>
  </div>`;
}

window.adicionarCotacaoOpcaoOS = function(btn) {
  const box = btn?.closest('.cotacao-peca-box');
  const list = box?.querySelector('.cot-opcoes-list');
  if (!box || !list) return;
  const key = box.dataset.itemKey || '';
  list.insertAdjacentHTML('beforeend', cotacaoOpcaoRowHTML({}, list.querySelectorAll('.cot-opcao-row').length, key, ''));
  window.atualizarAnaliseCotacaoBox?.(box);
};

window.preencherFornecedorCotacaoOS = function(select) {
  const row = select?.closest?.('.cot-opcao-row');
  const input = row?.querySelector?.('.cot-fornecedor');
  const nome = select?.selectedOptions?.[0]?.textContent?.trim() || '';
  if (input && select?.value && (!input.value || input.value === 'Fornecedor livre')) input.value = nome;
};

function lerOpcoesCotacaoBox(box) {
  const opcoes = [];
  box?.querySelectorAll?.('.cot-opcao-row').forEach((row, idx) => {
    const fornecedorId = row.querySelector('.cot-fornecedor-id')?.value || '';
    const fornecedorSelect = row.querySelector('.cot-fornecedor-id');
    const fornecedorOpt = fornecedorId ? (fornecedorSelect?.selectedOptions?.[0]?.textContent || '') : '';
    const fornecedorLivre = row.querySelector('.cot-fornecedor')?.value?.trim() || '';
    const marcaModelo = row.querySelector('.cot-marca-modelo')?.value?.trim() || '';
    const valorUnitario = cotacaoValorOS(row.querySelector('.cot-valor')?.value || 0);
    const prazo = row.querySelector('.cot-prazo')?.value?.trim() || '';
    const condicao = row.querySelector('.cot-condicao')?.value?.trim() || '';
    if (!fornecedorId && !fornecedorLivre && !marcaModelo && !valorUnitario && !prazo && !condicao) return;
    const marcaModeloPartes = marcaModelo.split('/').map(p => p.trim()).filter(Boolean);
    opcoes.push({
      id: row.dataset.cotId || ('cot-' + Date.now() + '-' + idx),
      row,
      fornecedorId,
      fornecedor: fornecedorLivre || fornecedorOpt,
      marcaModelo,
      marca: marcaModeloPartes[0] || marcaModelo,
      modelo: marcaModeloPartes.slice(1).join(' / '),
      valorUnitario,
      prazo,
      condicao,
      selecionado: !!row.querySelector('.cot-escolhida')?.checked,
      comprado: !!row.querySelector('.cot-comprado')?.checked
    });
  });
  return opcoes;
}

window.atualizarAnaliseCotacaoBox = function(box) {
  if (!box) return null;
  const moedaLocal = typeof moedaOS === 'function' ? moedaOS : (v => 'R$ ' + cotacaoValorOS(v).toFixed(2).replace('.', ','));
  const opcoes = lerOpcoesCotacaoBox(box);
  const best = melhorCotacaoOS({ opcoes });
  box.querySelectorAll('.cot-opcao-row').forEach(row => {
    const isBest = !!best && row.dataset.cotId === best.id;
    row.classList.toggle('is-best-cotacao', isBest);
    row.style.background = isBest ? 'rgba(0,255,136,.08)' : 'rgba(255,255,255,.035)';
    row.style.borderColor = isBest ? 'rgba(0,255,136,.42)' : 'rgba(255,255,255,.08)';
  });
  const resumo = box.querySelector('.cot-melhor-resumo');
  if (resumo) {
    resumo.style.color = best ? 'var(--success)' : 'var(--muted)';
    resumo.innerHTML = cotacaoResumoMelhorHTML(best, moedaLocal);
  }
  return best;
};

window.atualizarAnaliseCotacoesOS = function() {
  document.querySelectorAll('#cotacaoPecasOS .cotacao-peca-box').forEach(box => window.atualizarAnaliseCotacaoBox(box));
};

window.renderCotacaoPecasAprovadasOS = function(os, aprovados, moedaFn) {
  const pecas = (aprovados || []).filter(it => it.tipo === 'peca');
  if (!pecas.length) return '';
  const map = cotacoesOSMap(os);
  const moedaLocal = moedaFn || moedaOS;
  const osIdSeguro = escOS(os?.id || '');
  const avisoSalvar = os?.id
    ? ''
    : '<div style="font-family:var(--fm);font-size:.62rem;color:var(--warn);margin-bottom:8px;">Salve e continue a O.S. antes de enviar link publico ou gravar retornos no banco.</div>';
  const blocos = pecas.map(it => {
    const cot = map[it.key] || {};
    const opcoes = Array.isArray(cot.opcoes) && cot.opcoes.length ? cot.opcoes : [{}, {}, {}];
    const best = melhorCotacaoOS(cot);
    const bestId = best?.id || '';
    return `<div class="cotacao-peca-box" data-item-key="${escOS(it.key)}" style="background:rgba(0,0,0,.16);border:1px solid rgba(0,255,136,.13);border-radius:4px;padding:10px;margin-bottom:10px;">
      <input type="hidden" class="cot-item-json" value="${_escVal(JSON.stringify(it))}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px;">
        <div style="min-width:220px;flex:1;">
          <label style="display:inline-flex;align-items:center;gap:6px;font-family:var(--fm);font-size:.60rem;color:var(--muted);margin-bottom:5px;">
            <input type="checkbox" class="cot-lote-check" style="width:auto;min-height:0;"> incluir no pedido aos fornecedores
          </label>
          <div style="font-family:var(--fm);font-size:.62rem;color:var(--success);font-weight:800;letter-spacing:1px;">COTAÇÃO DA PEÇA DA O.S.</div>
          <div data-cot-item-title="1" style="font-size:.78rem;color:var(--text);font-weight:700;">${it.codigo ? '[' + escOS(it.codigo) + '] ' : ''}${escOS(it.desc || '-')}</div>
          <small style="font-family:var(--fm);font-size:.62rem;color:var(--muted);">Qtd ${escOS(it.qtd || 1)} | valor orçado ${moedaLocal(it.valorFinal || 0)}</small>
        </div>
        <div class="cot-melhor-resumo" style="font-family:var(--fm);font-size:.66rem;color:${best ? 'var(--success)' : 'var(--muted)'};text-align:right;">
          ${cotacaoResumoMelhorHTML(best, moedaLocal)}
        </div>
      </div>
      <div class="cot-opcoes-list" style="display:grid;gap:6px;">${opcoes.map((op, idx) => cotacaoOpcaoRowHTML(op, idx, it.key, bestId)).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <button type="button" class="btn-ghost" onclick="window.adicionarCotacaoOpcaoOS(this)">+ REGISTRAR RETORNO</button>
        <button type="button" class="btn-primary" onclick="window.salvarCotacoesPecasOS('${osIdSeguro}')">SALVAR E ANALISAR</button>
        <button type="button" class="btn-success" onclick="window.abrirEntradaNFCotacaoOS('${osIdSeguro}','${escOS(it.key)}')">ENTRADA NF / VINCULAR</button>
      </div>
    </div>`;
  }).join('');
  return `<div id="cotacaoPecasOS" style="margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px;">
    <div style="font-family:var(--fm);font-size:.72rem;color:var(--success);font-weight:800;letter-spacing:1px;margin-bottom:8px;">COTAÇÃO E COMPRA DAS PEÇAS DA O.S.</div>
    <div style="font-family:var(--fm);font-size:.60rem;color:var(--muted);margin-bottom:8px;">Fluxo interno desde o orçamento. Cotar não significa comprar; comprado não significa instalado; instalação depende da execução.</div>
    ${avisoSalvar}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;position:sticky;top:0;z-index:5;background:var(--surf,#fff);padding:8px;border:1px solid var(--border);border-radius:4px;">
      <span style="font-family:var(--fm);font-size:.62rem;color:var(--muted);font-weight:800;letter-spacing:.7px;">PEDIDO A FORNECEDORES</span>
      <label style="display:inline-flex;align-items:center;gap:6px;font-family:var(--fm);font-size:.64rem;color:var(--text);font-weight:800;">
        <input type="checkbox" onchange="window.toggleTodasPecasCotacao?.(this.checked)" style="width:auto;min-height:0;"> selecionar todas
      </label>
      <button type="button" class="btn-outline" onclick="window.abrirCotacaoFornecedoresOSLote?.('${osIdSeguro}','marcadas')">ENVIAR MARCADAS</button>
      <button type="button" class="btn-primary" onclick="window.abrirCotacaoFornecedoresOSLote?.('${osIdSeguro}','todos')">ENVIAR TODAS</button>
      <button type="button" class="btn-ghost" onclick="window.exportarCotacaoFornecedoresOS?.()">EXPORTAR ANÁLISE COM RESPOSTAS</button>
    </div>
    ${blocos}
  </div>`;
};

window.pecasCotacaoDaTelaOS = function() {
  const pecas = [];
  document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)').forEach((row, idx) => {
    const sel = row.querySelector('.peca-sel');
    const opt = sel?.options?.[sel.selectedIndex];
    const estoqueId = sel?.value || '';
    const codigo = row.querySelector('.peca-codigo')?.value?.trim() || row.dataset?.pecaCodigo || opt?.dataset?.codigo || '';
    const desc = descricaoPecaLinhaOS(row, opt, estoqueId);
    const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
    const unit = numBR(row.querySelector('.peca-venda')?.value || 0);
    if (!desc && !codigo && !unit && !estoqueId) return;
    pecas.push({ key: 'peca-' + idx, tipo: 'peca', codigo, desc, qtd, valorUnit: unit, valorFinal: qtd * unit, estoqueId });
  });
  document.querySelectorAll('#containerPecasOS .cilia-peca-wrap').forEach((wrap, idx) => {
    const row = wrap.querySelector('[data-cilia="1"], [data-peca-avulsa="1"]') || wrap;
    const codigo = row.querySelector('.peca-codigo')?.value?.trim() || '';
    const desc = row.querySelector('.peca-desc-livre')?.value?.trim() || wrap.dataset?.pecaDesc || '';
    const qtd = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
    const unit = numBR(row.querySelector('.peca-venda')?.value || 0);
    if (!desc && !codigo && !unit) return;
    pecas.push({ key: 'peca-' + idx, tipo: 'peca', codigo, desc, qtd, valorUnit: unit, valorFinal: qtd * unit, ciliaPieceIndex: wrap.dataset?.ciliaPieceIndex || '' });
  });
  return pecas;
};

window.atualizarCotacaoPecasOrcamentoAtualOS = function(osOpt) {
  const slot = document.getElementById('cotacaoPecasOSSlot');
  if (!slot || slot.dataset.renderLock === '1') return;
  slot.dataset.renderLock = '1';
  try {
    const osId = document.getElementById('osId')?.value || '';
    const salvo = osOpt || (window.J?.os || []).find(o => o.id === osId) || null;
    const cliente = salvo ? (window.J?.clientes || []).find(c => c.id === salvo.clienteId) : null;
    let pecas = [];
    if (salvo && OSU().buildBudgetItems) {
      try { pecas = (OSU().buildBudgetItems(salvo, cliente) || []).filter(it => it.tipo === 'peca'); } catch (_) { pecas = []; }
    }
    if (!pecas.length) pecas = window.pecasCotacaoDaTelaOS?.() || [];
    const osBase = salvo || {
      id: osId,
      clienteId: document.getElementById('osCliente')?.value || '',
      veiculoId: document.getElementById('osVeiculo')?.value || '',
      placa: document.getElementById('osPlacaView')?.value || '',
      prefixo: document.getElementById('osPrefixo')?.value || '',
      tipoVeiculoOS: document.getElementById('osTipoVeiculo')?.value || ''
    };
    slot.innerHTML = pecas.length ? (window.renderCotacaoPecasAprovadasOS?.(osBase, pecas, moedaOS) || '') : '';
  } finally {
    setTimeout(() => { delete slot.dataset.renderLock; }, 80);
  }
};

window.coletarCotacoesPecasOS = function() {
  const out = {};
  document.querySelectorAll('#cotacaoPecasOS .cotacao-peca-box').forEach(box => {
    const key = box.dataset.itemKey || '';
    if (!key) return;
    let item = {};
    try { item = JSON.parse(box.querySelector('.cot-item-json')?.value || '{}') || {}; } catch (_) { item = {}; }
    const opcoes = [];
    const opcoesLidas = lerOpcoesCotacaoBox(box);
    const melhor = melhorCotacaoOS({ opcoes: opcoesLidas });
    opcoesLidas.forEach((op, idx) => {
      opcoes.push({
        id: op.id,
        fornecedorId: op.fornecedorId,
        fornecedor: op.fornecedor,
        valorUnitario: op.valorUnitario,
        prazo: op.prazo,
        condicao: op.condicao,
        selecionado: op.selecionado,
        comprado: op.comprado,
        compradoEm: op.comprado ? new Date().toISOString() : '',
        melhorPreco: !!melhor && op.id === melhor.id,
        origem: 'cotacao_recebida_manual',
        recebidoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    out[key] = { key, item, opcoes, melhorCotacao: melhor ? {
      id: melhor.id,
      fornecedorId: melhor.fornecedorId || '',
      fornecedor: melhor.fornecedor || '',
      valorUnitario: melhor.valorUnitario || 0,
      prazo: melhor.prazo || '',
      condicao: melhor.condicao || ''
    } : null, updatedAt: new Date().toISOString() };
  });
  return out;
};

window.salvarCotacoesPecasOS = async function(osId) {
  if (!osId || !window.db) { window.toast?.('Salve a O.S. antes de cotar pecas.', 'warn'); return; }
  const osAtual = (window.J?.os || []).find(o => o.id === osId) || {};
  const cotacoesPecas = Object.assign({}, cotacoesOSMap(osAtual), window.coletarCotacoesPecasOS());
  const timeline = Array.isArray(osAtual.timeline) ? osAtual.timeline.slice() : [];
  timeline.push({ dt: new Date().toISOString(), user: window.J?.nome || 'Gestor', acao: 'Atualizou cotacoes de pecas da O.S.', tipo: 'cotacao_pecas', interno: true });
  await db.collection('ordens_servico').doc(osId).update(limparUndefinedFirestoreOS({
    cotacoesPecas,
    timeline,
    updatedAt: new Date().toISOString()
  }));
  if (osAtual) {
    osAtual.cotacoesPecas = cotacoesPecas;
    osAtual.timeline = timeline;
  }
  window.atualizarAnaliseCotacoesOS?.();
  const totalValidas = Object.values(cotacoesPecas).reduce((acc, cot) => acc + ((cot.opcoes || []).filter(o => cotacaoValorOS(o.valorUnitario) > 0).length), 0);
  window.toast?.(`Cotacoes registradas e analisadas na O.S. (${totalValidas} valor(es) valido(s)).`, 'ok');
  if (typeof window.thiaAudit === 'function') {
    window.thiaAudit('cotacao_pecas_os', 'ordens_servico', osId, null, cotacoesPecas, 'Atualizacao de cotacao de pecas da O.S.').catch(() => {});
  }
};

window.abrirEntradaNFCotacaoOS = function(osId, key) {
  const os = (window.J?.os || []).find(o => o.id === osId);
  if (!os) { window.toast?.('O.S. nao encontrada para entrada da NF.', 'warn'); return; }
  const cot = window.coletarCotacoesPecasOS()[key] || cotacoesOSMap(os)[key] || {};
  const itemCot = cot.item && (cot.item.key || cot.item.desc || cot.item.codigo) ? cot.item : null;
  const item = itemCot || (OSU().buildBudgetItems?.(os, (window.J?.clientes || []).find(c => c.id === os.clienteId)) || []).find(it => it.key === key) || {};
  const opcoes = cot.opcoes || [];
  const escolhida = opcoes.find(o => o.selecionado) || melhorCotacaoOS(cot) || opcoes[0] || {};
  if (typeof window.abrirModal === 'function') window.abrirModal('modalNF');
  if (typeof window.prepNF === 'function') window.prepNF();
  const ct = document.getElementById('containerItensNF');
  if (ct) ct.innerHTML = '';
  const veic = (window.J?.veiculos || []).find(v => v.id === os.veiculoId) || {};
  const placa = os.placa || veic.placa || '';
  if (document.getElementById('nfFornec') && escolhida.fornecedorId) document.getElementById('nfFornec').value = escolhida.fornecedorId;
  if (typeof window.adicionarItemNF === 'function') {
    window.adicionarItemNF({
      codigoFornecedor: item.codigo || '',
      codigoComercial: item.codigo || '',
      codigo: item.codigo || '',
      oem: item.codigo || '',
      descricao: item.desc || '',
      desc: item.desc || '',
      quantidade: item.qtd || 1,
      qtd: item.qtd || 1,
      valorUnitario: cotacaoValorOS(escolhida.valorUnitario || item.valorUnit || 0),
      venda: cotacaoValorOS(item.valorUnit || item.valorFinal || 0),
      destino: 'os',
      finalidade: 'os',
      osId,
      placa,
      vinculo: [os.prefixo || veic.prefixo, placa, 'OS ' + String(os.id || '').slice(-6).toUpperCase()].filter(Boolean).join(' / '),
      observacaoDestino: 'Entrada aberta pela cotacao da O.S.',
      cotacaoOSKey: key
    });
  }
  setTimeout(() => {
    const row = document.querySelector('#containerItensNF .nf-real-row:last-child');
    const sel = row?.querySelector('.nf-os-select');
    if (sel) sel.value = osId;
    const destino = row?.querySelector('.nf-finalidade');
    if (destino) { destino.value = 'os'; window._nfeProToggleDestino?.(destino); }
    window.calcNFTotal?.();
  }, 50);
  window.toast?.('Entrada NF aberta com a peca da O.S. vinculada.', 'ok');
};

window.aplicarMarcadoresAprovacaoOS = function(os) {
  const U = OSU();
  document.getElementById('resumoAprovacaoOS')?.remove();
  document.querySelectorAll('#containerServicosOS .aprovacao-item-badge,#containerPecasOS .aprovacao-item-badge').forEach(el => el.remove());
  const temAprovacaoOS = U.hasApproval?.(os);
  if (!temAprovacaoOS) { window.atualizarCotacaoPecasOrcamentoAtualOS?.(os); return; }
  const keys = U.getApprovedKeys?.(os) || new Set();
  const badge = key => `<div class="aprovacao-item-badge" style="grid-column:1/-1;font-family:var(--fm);font-size:.62rem;letter-spacing:.8px;color:${keys.has(key) ? 'var(--success)' : 'var(--danger)'};border-top:1px dashed rgba(255,255,255,.12);padding-top:5px;margin-top:2px;">${keys.has(key) ? 'APROVADO NO ORÇAMENTO' : 'NÃO APROVADO - MANTIDO APENAS COMO HISTÓRICO'}</div>`;

  document.querySelectorAll('#containerServicosOS > div').forEach((row, idx) => {
    row.querySelector('.aprovacao-item-badge')?.remove();
    row.insertAdjacentHTML('beforeend', badge('servico-' + idx));
  });
  document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)').forEach((row, idx) => {
    row.querySelector('.aprovacao-item-badge')?.remove();
    row.insertAdjacentHTML('beforeend', badge('peca-' + idx));
  });
  document.querySelectorAll('#containerPecasOS .cilia-peca-wrap').forEach((wrap, idx) => {
    const pecaRow = wrap.querySelector('[data-cilia="1"], [data-peca-avulsa="1"]');
    if (pecaRow) {
      pecaRow.querySelector('.aprovacao-item-badge')?.remove();
      pecaRow.insertAdjacentHTML('beforeend', badge('peca-' + idx));
    }
  });

  const cliente = (window.J?.clientes || []).find(c => c.id === os?.clienteId);
  const itens = U.buildBudgetItems?.(os, cliente) || [];
  const aprovados = itens.filter(it => keys.has(it.key));
  const historico = itens.filter(it => !keys.has(it.key));
  const totalAprovado = os?.totalAprovado != null ? numBR(os.totalAprovado) : aprovados.reduce((sum, it) => sum + numBR(it.valorFinal), 0);
  const moeda = U.moeda || (v => 'R$ ' + numBR(v).toFixed(2).replace('.', ','));
  const exec = os?.execucaoItens || {};
  window.atualizarCotacaoPecasOrcamentoAtualOS?.(os);
  const execHtml = aprovados.length ? `
    <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px;">
      <div style="font-family:var(--fm);font-size:.72rem;color:var(--cyan);font-weight:800;letter-spacing:1px;margin-bottom:8px;">EXECUÇÃO INTERNA DOS ITENS APROVADOS</div>
      <div style="font-family:var(--fm);font-size:.60rem;color:var(--muted);margin-bottom:8px;">Controle interno da oficina/equipe. O cliente não vê estas marcações.</div>
      <div style="display:grid;gap:7px;">
        ${aprovados.map(it => {
          const e = exec[it.key] || {};
          const mecIdItem = e.mecId || e.responsavelId || it.mecId || it.responsavelId || os.mecId || '';
          const seletorMec = String(it.tipo || '').toLowerCase().includes('serv')
            ? `<select class="j-select exec-mec" style="font-size:.70rem;">${opcoesResponsavelServicoOS(mecIdItem)}</select>`
            : '<span></span>';
          return `<div class="execucao-aprovado-row" data-key="${escOS(it.key)}" data-tipo="${escOS(it.tipo)}" data-mec-id="${escOS(mecIdItem)}" style="display:grid;grid-template-columns:minmax(230px,1fr) minmax(150px,190px) 180px minmax(200px,1fr);gap:7px;align-items:center;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.10);border-radius:3px;padding:8px;">
            <div style="font-size:.75rem;color:var(--text);"><b>${escOS(it.labelTipo || it.tipo)}</b> ${it.codigo ? '[' + escOS(it.codigo) + '] ' : ''}${escOS(it.desc || '-')}${it.tempo ? `<br><small style="color:var(--muted);">TMO ${String(it.tempo).replace('.', ',')}h</small>` : ''}</div>
            ${seletorMec}
            <select class="j-select exec-status" style="font-size:.72rem;">${statusOptionsExecOS(it.tipo, e.status || 'pendente')}</select>
            <input class="j-input exec-obs" value="${escOS(e.obs || '')}" placeholder="Observação interna: peça não encontrada, aguardando, executado...">
          </div>`;
        }).join('')}
      </div>
      <button type="button" class="btn-primary" style="margin-top:10px;" onclick="window.salvarExecucaoAprovadosOS('${escOS(os.id || '')}')">SALVAR EXECUÇÃO INTERNA</button>
    </div>` : '';
  const resumo = document.createElement('div');
  resumo.id = 'resumoAprovacaoOS';
  resumo.className = 'aprovacao-resumo';
  resumo.innerHTML = `
    <h4>ORÇAMENTO APROVADO - ${aprovados.length}/${itens.length} ITEM(NS) - ${moeda(totalAprovado)}</h4>
    <div class="aprovacao-resumo-grid">
      ${aprovados.map(it => `<div class="aprovacao-resumo-item"><strong style="color:var(--success);">APROVADO</strong><br>${escOS(it.labelTipo || it.tipo)} ${it.codigo ? '[' + escOS(it.codigo) + '] ' : ''}${escOS(it.desc || '-')}${it.tempo ? `<br><small>TMO ${String(it.tempo).replace('.', ',')}h</small>` : ''}<br><b>${moeda(it.valorFinal)}</b></div>`).join('')}
      ${historico.map(it => `<div class="aprovacao-resumo-item nao"><strong style="color:var(--warn);">NÃO APROVADO</strong><br>${escOS(it.labelTipo || it.tipo)} ${it.codigo ? '[' + escOS(it.codigo) + '] ' : ''}${escOS(it.desc || '-')}<br><small>Mantido no histórico do orçamento.</small></div>`).join('')}
    </div>
    ${execHtml}`;
  const alvo = document.getElementById('containerServicosOS')?.closest('div');
  if (alvo) alvo.insertAdjacentElement('beforebegin', resumo);
};

// ══════════════════════════════════════════════════════════════════════
// BUSCA HISTÓRICO POR PLACA + SERVIÇO/PEÇA
// ══════════════════════════════════════════════════════════════════════
window.buscarHistoricoOS = function(opts = {}) {
  const liberarPecasReais = osSegredo177AtivoOS();
  const placaId = opts.placaId || 'histBuscaPlaca';
  const termoId = opts.termoId || 'histBuscaTermo';
  const resultadoId = opts.resultadoId || 'histBuscaResultado';
  const placa = OSU().normalizePlate ? OSU().normalizePlate(document.getElementById(placaId)?.value || '') : (document.getElementById(placaId)?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const termoRaw = document.getElementById(termoId)?.value || '';
  const termo = OSU().normalizeText ? OSU().normalizeText(termoRaw) : termoRaw.trim().toLowerCase();
  const el = document.getElementById(resultadoId);
  const pecaRealTexto = p => [
    p.desc, p.descricao, p.codigo, p.codigoFornecedor, p.codigoComercial, p.oem, p.marca,
    p.nf, p.nfNumero, p.notaFiscal, p.fornecedor, p.fornecedorNome, p.chaveNFe,
    p.ncm, p.cest, p.cfop, p.dataCompra, p.dataNF, p.statusAplicacao, p.origem
  ].join(' ');
  if (!el) return;
  if (!placa && !termo) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">Digite a placa e/ou o serviço/peça.</div>'; return; }

  const hits = (window.J?.os || []).filter(o => {
    const veicOS = (window.J?.veiculos||[]).find(v=>v.id===o.veiculoId)||{};
    const placaOS = OSU().normalizePlate ? OSU().normalizePlate(o.placa || veicOS.placa || '') : String(o.placa || veicOS.placa || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const matchPlaca = !placa || placaOS === placa || placaOS.includes(placa);
    if (!matchPlaca) return false;
    if (!termo) return true;
    const textoOS = [
      ...(o.servicos||[]).map(s=>[s.desc,s.codigoInterno,s.codigoTabela,s.sistemaTabela,s.tempo].join(' ')),
      ...osPecasOrcamentoVisiveisOS(o, o.pecas||[]).map(p=>[p.desc,p.codigo,p.qtd,p.venda].join(' ')),
      ...(liberarPecasReais ? (o.pecasReais||[]).map(pecaRealTexto) : []),
      o.diagnostico || '',
      o.relato || '',
      o.desc || ''
    ].join(' ');
    return (OSU().normalizeText ? OSU().normalizeText(textoOS) : textoOS.toLowerCase()).includes(termo);
  });

  if (!hits.length) {
    el.innerHTML = `<div style="color:var(--muted);font-family:var(--fm);font-size:0.8rem;padding:10px 0;">Nenhuma OS encontrada${placa?' para placa '+escOS(placa):''}${termoRaw?' com "'+escOS(termoRaw)+'"':''}.</div>`;
    return;
  }

  const html = hits.map(o => {
    const cli = (window.J?.clientes||[]).find(c=>c.id===o.clienteId)||{};
    const veic = (window.J?.veiculos||[]).find(v=>v.id===o.veiculoId)||{};
    const matchText = value => !termo || (OSU().normalizeText ? OSU().normalizeText(value) : String(value||'').toLowerCase()).includes(termo);
    const servMatches = (o.servicos||[]).filter(s=>matchText([s.desc,s.codigoInterno,s.codigoTabela,s.sistemaTabela,s.tempo].join(' ')));
    const pecMatches  = osPecasOrcamentoVisiveisOS(o, o.pecas||[]).filter(p=>matchText([p.desc,p.codigo,p.qtd,p.venda].join(' ')));
    const reaisMtch   = liberarPecasReais ? (o.pecasReais||[]).filter(p=>matchText(pecaRealTexto(p))) : [];
    const pecaRealResumo = p => {
      const codigo = p.codigo || p.codigoComercial || p.oem || p.codigoFornecedor || '';
      const desc = p.desc || p.descricao || '';
      const nf = p.nf || p.nfNumero || p.notaFiscal || '-';
      const fornecedor = p.fornecedor || p.fornecedorNome || '';
      const compra = p.dataCompra || p.dataNF || '';
      const status = p.statusAplicacao ? ` - ${String(p.statusAplicacao).replace(/_/g, ' ')}` : '';
      return `${escOS(codigo)} ${escOS(desc)} x${p.qtd||1} - NF:${escOS(nf)} ${escOS(fornecedor)}${compra ? ' - compra ' + escOS(compra) : ''}${status}`;
    };
    return `<div style="background:var(--surf3);border:1px solid var(--border);border-radius:3px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        <div>
          <span style="font-family:var(--fm);font-size:0.7rem;color:var(--cyan);font-weight:700;">OS #${(o.id||'').slice(-6).toUpperCase()}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(o.data||'')}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(veic.placa || o.placa || '')}</span>
          <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-left:10px;">${escOS(cli.nome||o.cliente||'')}</span>
        </div>
        <span style="font-family:var(--fm);font-size:0.7rem;color:var(--success);font-weight:700;">${moeda(o.totalAprovado || o.total || 0)}</span>
      </div>
      ${servMatches.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--cyan);">Serviços:</strong> ${servMatches.map(s=>`${escOS(s.codigoInterno || s.codigoTabela || '')} ${escOS(s.desc||'')} (${String(s.tempo||0).replace('.',',')}h - ${moeda(s.valor||0)})`).join(' | ')}</div>`:''}
      ${pecMatches.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--success);">Peças orç.:</strong> ${pecMatches.map(p=>`${escOS(p.codigo||'')} ${escOS(p.desc||'')} x${p.qtd||1} - ${moeda(numBR(p.venda||0)*(numBR(p.qtd||1)||1))}`).join(' | ')}</div>`:''}
      ${reaisMtch.length?`<div style="font-size:0.75rem;margin-bottom:4px;"><strong style="color:var(--danger);">Peças reais:</strong> ${reaisMtch.map(p=>`${escOS(p.codigo||'')} ${escOS(p.desc||'')} x${p.qtd||1} - NF:${escOS(p.nf||'-')} ${escOS(p.fornecedor||'')}`).join(' | ')}</div>`:''}
    </div>`;
  }).join('');

  el.innerHTML = `<div style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);margin-bottom:6px;">${hits.length} OS encontrada(s)</div>${html}`;
};


// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO DE ORÇAMENTO PDF — padrão S.O.S. VALÊNCIO / thIAguinho
// Acrescenta a função ao botão já existente dentro da O.S.
// Não altera importação Cília, não altera planilhas existentes e não remove lógica.
// ─────────────────────────────────────────────────────────────────────────────
async function _orcamentoOSGarantirPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error('Não foi possível carregar pdf.js para ler o PDF.'));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return window.pdfjsLib;
}

function _orcamentoOSMoney(v) {
  return numBR(String(v || '').replace(/R\$/gi, '').trim());
}

function _orcamentoOSLineClean(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function _orcamentoOSBetween(linhas, iniRx, fimRx) {
  const out = [];
  let on = false;
  for (const linha of linhas || []) {
    if (!on && iniRx.test(linha)) { on = true; continue; }
    if (on && fimRx.test(linha)) break;
    if (on) out.push(linha);
  }
  return out;
}

function _orcamentoOSParsePecas(linhas) {
  const pecas = [];
  const area = _orcamentoOSBetween(
    linhas,
    /PE[ÇC]AS\s*\/\s*MATERIAIS/i,
    /(Total\s+servi[çc]os|TOTAL\s+GERAL|Powered\s+by)/i
  );
  for (const raw of area) {
    const linha = _orcamentoOSLineClean(raw);
    if (!linha || /^C[oó]d\./i.test(linha) || /^Descri/i.test(linha) || /^Total/i.test(linha)) continue;
    const m = linha.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s+R\$\s*([\d.,]+)\s+([\d.,]+)%\s+R\$\s*([\d.,]+)/i);
    if (!m) continue;
    const left = _orcamentoOSLineClean(m[1]);
    const firstSpace = left.indexOf(' ');
    let codigo = firstSpace > -1 ? left.slice(0, firstSpace).trim() : '';
    let desc = firstSpace > -1 ? left.slice(firstSpace + 1).trim() : left;
    if (codigo === '-' || codigo === '–' || codigo === '—') codigo = '';
    desc = desc.replace(/\s{2,}/g, ' ').trim();
    if (!desc || /^-+$/.test(desc)) continue;
    pecas.push({
      codigo,
      desc,
      qtd: _orcamentoOSMoney(m[2]) || 1,
      venda: _orcamentoOSMoney(m[3]),
      descPct: _orcamentoOSMoney(m[4]),
      totalImportado: _orcamentoOSMoney(m[5]),
      avulsa: true,
      origem: 'import_pdf_orcamento_sos'
    });
  }
  return pecas;
}

function _orcamentoOSParseServicos(linhas) {
  const servicos = [];
  const area = _orcamentoOSBetween(
    linhas,
    /SERVI[ÇC]OS\s*\/\s*M[ÃA]O\s+DE\s+OBRA/i,
    /PE[ÇC]AS\s*\/\s*MATERIAIS/i
  );
  for (const raw of area) {
    const linha = _orcamentoOSLineClean(raw);
    if (!linha || /^C[oó]d\./i.test(linha) || /Descri[çc][aã]o\s+do\s+servi[çc]o/i.test(linha)) continue;
    const m = linha.match(/^(\S+)\s+(.+?)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+R?\$?\s*([\d.,]+)\s+([\d.,]+)%\s+R\$\s*([\d.,]+)$/i);
    if (m) {
      servicos.push({
        codigoTabela: m[1] === '-' ? '' : m[1],
        sistemaTabela: _orcamentoOSLineClean(m[2]),
        desc: _orcamentoOSLineClean(m[3]),
        tempo: _orcamentoOSMoney(m[4]),
        valorHora: _orcamentoOSMoney(m[5]),
        valor: _orcamentoOSMoney(m[7]),
        valorFinal: _orcamentoOSMoney(m[7]),
        origem: 'import_pdf_orcamento_sos'
      });
      continue;
    }
    const simples = linha.match(/^(.+?)\s+R\$\s*([\d.,]+)$/i);
    if (simples && !/Total/i.test(linha)) {
      servicos.push({
        desc: _orcamentoOSLineClean(simples[1].replace(/^-+\s*/, '')),
        valor: _orcamentoOSMoney(simples[2]),
        valorFinal: _orcamentoOSMoney(simples[2]),
        origem: 'import_pdf_orcamento_sos'
      });
    }
  }
  return servicos.filter(s => s.desc);
}

function _orcamentoOSParseCampos(linhas) {
  const texto = (linhas || []).join('\n');
  const campos = {};
  const getInline = (rx) => {
    const m = texto.match(rx);
    return m ? _orcamentoOSLineClean(m[1] || '') : '';
  };
  campos.osOrigem = getInline(/\bOS\s+([A-Z0-9]{4,12})\s+Emiss/i);
  campos.emissao = getInline(/Emiss[aã]o\s+(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  campos.status = getInline(/\bStatus\s+([^\n]+)/i);
  campos.defeito = _orcamentoOSBetween(linhas, /DEFEITO\s+RECLAMADO/i, /DIAGN[ÓO]STICO\s+T[ÉE]CNICO/i)
    .filter(l => l && l !== '-' && !/Powered by/i.test(l)).join('\n').trim();
  campos.diagnostico = _orcamentoOSBetween(linhas, /DIAGN[ÓO]STICO\s+T[ÉE]CNICO/i, /RESUMO\s+POR\s+SE[ÇC][ÃA]O/i)
    .filter(l => l && l !== '-' && !/Powered by/i.test(l)).join('\n').trim();
  return campos;
}

async function _orcamentoOSExtrairLinhasPDF(file) {
  const pdfjs = await _orcamentoOSGarantirPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const linhas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const itens = tc.items
      .filter(it => String(it.str || '').trim())
      .map(it => ({ text: String(it.str || '').trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), page: i }));
    const map = {};
    itens.forEach(sp => {
      const key = `${sp.page}:${Math.round(sp.y / 4) * 4}`;
      (map[key] ||= []).push(sp);
    });
    Object.keys(map)
      .sort((a, b) => {
        const [pa, ya] = a.split(':').map(Number);
        const [pb, yb] = b.split(':').map(Number);
        return (pa - pb) || (yb - ya);
      })
      .forEach(k => {
        const linha = map[k].sort((a, b) => a.x - b.x).map(s => s.text).join(' ');
        if (_orcamentoOSLineClean(linha)) linhas.push(_orcamentoOSLineClean(linha));
      });
  }
  return linhas;
}

function _orcamentoOSAplicarImportacao(parsed, fileName) {
  const pecas = parsed.pecas || [];
  const servicos = parsed.servicos || [];
  const campos = parsed.campos || {};
  if (!pecas.length && !servicos.length) {
    window.toast?.('PDF lido, mas não encontrei peças ou serviços no padrão esperado.', 'warn');
    return;
  }

  const temItensAtuais = !!(document.querySelector('#containerServicosOS > div') || document.querySelector('#containerPecasOS > div'));
  const substituir = temItensAtuais
    ? confirm(`Importação encontrou ${servicos.length} serviço(s) e ${pecas.length} peça(s).\n\nOK = substituir itens atuais da O.S.\nCancelar = acrescentar aos itens atuais.`)
    : true;

  if (substituir) {
    if ($('containerServicosOS')) $('containerServicosOS').innerHTML = '';
    if ($('containerPecasOS')) $('containerPecasOS').innerHTML = '';
  }

  if (campos.defeito && $('osDescricao') && (!$v('osDescricao') || confirm('Importar também o campo "Defeito reclamado" do PDF para a O.S.?'))) {
    $('osDescricao').value = campos.defeito;
  }
  if (campos.diagnostico && $('osDiagnostico') && (!$v('osDiagnostico') || confirm('Importar também o campo "Diagnóstico técnico" do PDF para a O.S.?'))) {
    $('osDiagnostico').value = campos.diagnostico;
  }

  servicos.forEach(s => {
    if (typeof window.renderServicoOSRow === 'function') {
      window.renderServicoOSRow({
        desc: s.desc,
        valor: s.valor || s.valorFinal || 0,
        valorFinal: s.valorFinal || s.valor || 0,
        tempo: s.tempo || 0,
        valorHora: s.valorHora || 0,
        codigoTabela: s.codigoTabela || '',
        sistemaTabela: s.sistemaTabela || '',
        origemServico: s.origem || 'import_pdf_orcamento_sos'
      });
    } else if (typeof window.adicionarServicoOS === 'function') {
      window.adicionarServicoOS();
      const row = document.querySelector('#containerServicosOS > div:last-child');
      if (row) {
        const desc = row.querySelector('.serv-desc');
        const val = row.querySelector('.serv-valor');
        const tempo = row.querySelector('.serv-tempo');
        if (desc) desc.value = s.desc || '';
        if (val) val.value = String(s.valor || s.valorFinal || 0).replace('.', ',');
        if (tempo) tempo.value = s.tempo || '';
      }
    }
  });

  pecas.forEach(p => {
    if (typeof window.renderPecaOSRow === 'function') {
      window.renderPecaOSRow({
        codigo: p.codigo || '',
        desc: p.desc || '',
        qtd: p.qtd || 1,
        venda: p.venda || 0,
        avulsa: true,
        origemPeca: p.origem || 'import_pdf_orcamento_sos'
      });
    } else if (typeof window.adicionarPecaOS === 'function') {
      window.adicionarPecaOS();
      const row = document.querySelector('#containerPecasOS > div:last-child');
      if (row) {
        const desc = row.querySelector('.peca-desc-livre');
        const qtd = row.querySelector('.peca-qtd');
        const venda = row.querySelector('.peca-venda');
        const codigo = row.querySelector('.peca-codigo');
        if (desc) desc.value = p.desc || '';
        if (qtd) qtd.value = p.qtd || 1;
        if (venda) venda.value = String(p.venda || 0).replace('.', ',');
        if (codigo) codigo.value = p.codigo || '';
      }
    }
  });

  const tlEl = $('osTimelineData');
  if (tlEl) {
    try {
      const tl = JSON.parse(tlEl.value || '[]');
      tl.push({
        dt: new Date().toISOString(),
        user: J.nome || 'Gestor',
        acao: `Importou orçamento PDF (${fileName || 'arquivo'}) com ${servicos.length} serviço(s) e ${pecas.length} peça(s).`
      });
      tlEl.value = JSON.stringify(tl);
      window.renderTimelineOS?.();
    } catch (_) {}
  }
  window.calcOSTotal?.();
  window.toast?.(`✓ Orçamento importado: ${servicos.length} serviço(s), ${pecas.length} peça(s). Salve a O.S. para gravar.`, 'ok');
}

window.importarOrcamentoOSArquivo = async function(input) {
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  input.value = '';
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (ext !== 'pdf') {
    window.toast?.('Por segurança, esta importação agora lê PDF do padrão S.O.S. VALÊNCIO. Para Cília, use o botão IMPORTAR CÍLIA.', 'warn');
    return;
  }
  try {
    window.toast?.('Lendo orçamento PDF...', 'warn');
    const linhas = await _orcamentoOSExtrairLinhasPDF(file);
    const parsed = {
      campos: _orcamentoOSParseCampos(linhas),
      servicos: _orcamentoOSParseServicos(linhas),
      pecas: _orcamentoOSParsePecas(linhas),
      linhas
    };
    _orcamentoOSAplicarImportacao(parsed, file.name);
  } catch (err) {
    console.error('[Importar orçamento PDF]', err);
    window.toast?.('Erro ao importar orçamento PDF: ' + (err.message || err), 'err');
  }
};


window.importarCilia = async function(input) {
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  input.value = '';

  if (ext === 'xml') {
    _ciliaProcessarXML(file);
  } else if (ext === 'pdf') {
    _ciliaProcessarPDF(file);
  } else {
    if (typeof window.toast === 'function') window.toast('Formato inválido. Use XML ou PDF do Cília.', 'err');
  }
};

function _ciliaNormGrupo(v) {
  try {
    const fn = OSU().normalizeText;
    if (typeof fn === 'function') return fn(v);
  } catch (_) {}
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function _ciliaGrupoSistemaPeca(peca) {
  const txt = _ciliaNormGrupo([peca?.desc, peca?.descricao, peca?.grupo, peca?.categoria, peca?.sistema, peca?.tipo, peca?.area, peca?.secao, peca?.codigo].filter(Boolean).join(' '));
  const grupos = [
    { nome: 'SUSPENSAO', ordem: 10, rx: /\b(amortec|batente|coifa|mola|bandeja|balanca|bieleta|pivo|bucha|barra estabil|estabilizador|estabilizadora|coxim amort|terminal|axial|tensor|tirante)\b/ },
    { nome: 'FREIO', ordem: 20, rx: /\b(freio|pastilha|disco|tambor|sapata|cilindro|pinca|pin[cç]a|flexivel|fluido|servo freio|hidrovacuo|abs)\b/ },
    { nome: 'DIRECAO', ordem: 30, rx: /\b(direcao|caixa direcao|barra direcao|terminal direcao|coluna direcao)\b/ },
    { nome: 'RODAS / PNEUS', ordem: 40, rx: /\b(pneu|roda|cubo|rolamento|calota)\b/ },
    { nome: 'MOTOR / ALIMENTACAO', ordem: 50, rx: /\b(motor|coxim motor|bomba combust|injecao|bico|vela|correia|filtro|oleo)\b/ },
    { nome: 'ARREFECIMENTO', ordem: 60, rx: /\b(radiador|arrefec|ventoinha|reservatorio|mangueira agua|bomba d.?agua|agua)\b/ },
    { nome: 'ELETRICA / ILUMINACAO', ordem: 70, rx: /\b(bateria|alternador|arranque|motor partida|chicote|modulo|sensor|lampada|farol|lanterna|fusivel)\b/ },
    { nome: 'TRANSMISSAO', ordem: 80, rx: /\b(cambio|embreagem|homocinet|semieixo|junta|transmissao)\b/ },
    { nome: 'FUNILARIA / LATARIA', ordem: 90, rx: /\b(para-?choque|parachoque|paralama|capo|porta|grade|painel frontal|longarina|lateral|teto|retrovisor|macaneta|lataria|funilaria)\b/ },
    { nome: 'ACABAMENTO / VIDROS', ordem: 100, rx: /\b(vidro|parabrisa|para-brisa|borracha|acabamento|forro|moldura|guarnicao)\b/ }
  ];
  return grupos.find(g => g.rx.test(txt)) || { nome: 'OUTROS', ordem: 900 };
}

function _ciliaAgrupadorPeca(peca) {
  let txt = _ciliaNormGrupo(peca?.desc || peca?.descricao || '');
  txt = txt
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\b(ld|le|dir|direito|direita|esq|esquerdo|esquerda|dianteiro|dianteira|diant|tras|traseiro|traseira|sup|superior|inf|inferior)\b/g, ' ')
    .replace(/\b\d+[a-z0-9-]*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return txt || _ciliaNormGrupo(peca?.codigo || '');
}

function _ciliaPosicaoOrdemPeca(peca) {
  const txt = _ciliaNormGrupo([peca?.desc, peca?.descricao, peca?.codigo].filter(Boolean).join(' '));
  let eixo = 50;
  if (/\b(dianteir|diant|frente)\b/.test(txt)) eixo = 10;
  else if (/\b(traseir|tras|traz)\b/.test(txt)) eixo = 20;
  let lado = 5;
  if (/\b(ld|dir|direit)\b/.test(txt)) lado = 1;
  else if (/\b(le|esq|esquerd)\b/.test(txt)) lado = 2;
  let altura = 0;
  if (/\b(superior|sup)\b/.test(txt)) altura = 1;
  else if (/\b(inferior|inf)\b/.test(txt)) altura = 2;
  return eixo * 100 + lado * 10 + altura;
}

function _ciliaOrdenarPecasImportadas(pecas) {
  let grupoAnterior = '';
  return (pecas || []).map((peca, idx) => {
    const grupo = _ciliaGrupoSistemaPeca(peca);
    peca.ciliaGrupo = peca.ciliaGrupo || grupo.nome;
    peca.ciliaGrupoOrdem = peca.ciliaGrupoOrdem ?? grupo.ordem;
    peca.ciliaAgrupador = peca.ciliaAgrupador || _ciliaAgrupadorPeca(peca);
    peca.ciliaPosicaoOrdem = peca.ciliaPosicaoOrdem ?? _ciliaPosicaoOrdemPeca(peca);
    peca.ciliaOrdemOriginal = peca.ciliaOrdemOriginal ?? idx;
    return peca;
  }).sort((a, b) =>
    numBR(a.ciliaGrupoOrdem) - numBR(b.ciliaGrupoOrdem)
    || String(a.ciliaAgrupador || '').localeCompare(String(b.ciliaAgrupador || ''))
    || numBR(a.ciliaPosicaoOrdem) - numBR(b.ciliaPosicaoOrdem)
    || numBR(a.ciliaOrdemOriginal) - numBR(b.ciliaOrdemOriginal)
  ).map(peca => {
    peca.ciliaAbreGrupo = String(peca.ciliaGrupo || '') !== grupoAnterior;
    grupoAnterior = String(peca.ciliaGrupo || '');
    return peca;
  });
}

function _ciliaGrupoNomesPadrao() {
  return ['SUSPENSAO','FREIO','DIRECAO','RODAS / PNEUS','MOTOR / ALIMENTACAO','ARREFECIMENTO','ELETRICA / ILUMINACAO','TRANSMISSAO','FUNILARIA / LATARIA','ACABAMENTO / VIDROS','OUTROS'];
}

function _ciliaGrupoOrdemManual(nome) {
  const mapa = {
    'SUSPENSAO': 10,
    'FREIO': 20,
    'DIRECAO': 30,
    'RODAS / PNEUS': 40,
    'MOTOR / ALIMENTACAO': 50,
    'ARREFECIMENTO': 60,
    'ELETRICA / ILUMINACAO': 70,
    'TRANSMISSAO': 80,
    'FUNILARIA / LATARIA': 90,
    'ACABAMENTO / VIDROS': 100,
    'OUTROS': 900
  };
  const n = String(nome || '').trim().toUpperCase() || 'OUTROS';
  return mapa[n] || 800;
}

function _ciliaGrupoOptionsHTML(selected) {
  const sel = String(selected || '').trim().toUpperCase();
  const nomes = _ciliaGrupoNomesPadrao().slice();
  if (sel && !nomes.includes(sel)) nomes.push(sel);
  return nomes.map(nome => `<option value="${escOS(nome)}" ${nome === sel ? 'selected' : ''}>${escOS(nome)}</option>`).join('');
}

function _ciliaGrupoBadgeHTML(peca, destaque) {
  if (!peca?.ciliaGrupo) return '';
  const bg = destaque ? 'rgba(0,212,255,.12)' : 'rgba(0,212,255,.055)';
  const border = destaque ? 'rgba(0,212,255,.36)' : 'rgba(0,212,255,.16)';
  return `<div class="cilia-grupo-badge" style="display:grid;grid-template-columns:82px minmax(170px,220px) minmax(140px,1fr);gap:8px;align-items:center;margin:0 0 7px 0;padding:6px 7px;background:${bg};border:1px solid ${border};border-radius:3px;font-family:var(--fm);font-size:.58rem;letter-spacing:.8px;color:var(--cyan);text-transform:uppercase;">
    <span>${destaque ? 'GRUPO' : 'Grupo'}</span>
    <select class="j-select cilia-grupo-select" onchange="window._ciliaAtualizarGrupoPeca(this)" style="height:28px;min-height:28px;font-size:.62rem;font-family:var(--fm);text-transform:uppercase;">${_ciliaGrupoOptionsHTML(peca.ciliaGrupo)}</select>
    <input type="text" class="j-input cilia-agrupador-input" value="${_escVal(peca.ciliaAgrupador || '')}" placeholder="subgrupo: dianteiro, traseiro, filtro..." oninput="window._ciliaAtualizarGrupoPeca(this)" style="height:28px;min-height:28px;font-size:.60rem;font-family:var(--fm);">
  </div>`;
}

window._ciliaAtualizarGrupoPeca = function(el) {
  const wrap = el?.closest?.('.cilia-peca-wrap');
  if (!wrap) return;
  const grupo = (wrap.querySelector('.cilia-grupo-select')?.value || 'OUTROS').trim().toUpperCase();
  const agrupador = (wrap.querySelector('.cilia-agrupador-input')?.value || '').trim();
  const ordem = _ciliaGrupoOrdemManual(grupo);
  wrap.dataset.ciliaGrupo = grupo;
  wrap.dataset.ciliaGrupoOrdem = String(ordem);
  wrap.dataset.ciliaAgrupador = agrupador;
  const pecaRow = wrap.querySelector('[data-cilia="1"], [data-peca-avulsa="1"]');
  if (pecaRow) {
    pecaRow.dataset.ciliaGrupo = grupo;
    pecaRow.dataset.ciliaGrupoOrdem = String(ordem);
    pecaRow.dataset.ciliaAgrupador = agrupador;
  }
  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
};

function _ciliaDeveAbrirGrupoRender(peca) {
  const container = typeof $ === 'function' ? $('containerPecasOS') : document.getElementById('containerPecasOS');
  const wraps = container ? Array.from(container.querySelectorAll('.cilia-peca-wrap')) : [];
  const anterior = wraps.length ? wraps[wraps.length - 1] : null;
  const grupoAtual = String(peca?.ciliaGrupo || '');
  return !anterior || String(anterior.dataset?.ciliaGrupo || '') !== grupoAtual;
}

function _ciliaChaveNormalizada(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _ciliaChavePecaImportada(peca) {
  const codigo = _ciliaChaveNormalizada(peca?.codigo || peca?.cod || peca?.oem || '');
  const desc = _ciliaChaveNormalizada(peca?.desc || peca?.descricao || '');
  if (codigo && desc) return 'COD_DESC:' + codigo + '|' + desc;
  if (codigo) return 'COD:' + codigo;
  return desc ? 'DESC:' + desc : '';
}

function _ciliaChavePecaWrap(wrap) {
  const row = wrap?.querySelector?.('[data-cilia="1"], [data-peca-avulsa="1"]');
  const codigo = _ciliaChaveNormalizada(row?.querySelector?.('.peca-codigo')?.value || '');
  const desc = _ciliaChaveNormalizada(row?.querySelector?.('.peca-desc-livre')?.value || '');
  if (codigo && desc) return 'COD_DESC:' + codigo + '|' + desc;
  if (codigo) return 'COD:' + codigo;
  return desc ? 'DESC:' + desc : '';
}

function _ciliaEncontrarWrapPecaExistente(peca) {
  const chave = _ciliaChavePecaImportada(peca);
  if (!chave) return null;
  const container = typeof $ === 'function' ? $('containerPecasOS') : document.getElementById('containerPecasOS');
  if (!container) return null;
  return Array.from(container.querySelectorAll('.cilia-peca-wrap')).find(wrap => _ciliaChavePecaWrap(wrap) === chave) || null;
}

function _ciliaAtualizarWrapPecaExistente(wrap, peca, descPeca) {
  if (!wrap) return;
  const grupo = _ciliaGrupoSistemaPeca(peca || {});
  peca = Object.assign({}, peca, {
    ciliaGrupo: peca?.ciliaGrupo || grupo.nome,
    ciliaGrupoOrdem: peca?.ciliaGrupoOrdem ?? grupo.ordem,
    ciliaAgrupador: peca?.ciliaAgrupador || _ciliaAgrupadorPeca(peca || {}),
    ciliaPosicaoOrdem: peca?.ciliaPosicaoOrdem ?? _ciliaPosicaoOrdemPeca(peca || {})
  });
  wrap.dataset.ciliaGrupo = peca.ciliaGrupo || '';
  wrap.dataset.ciliaGrupoOrdem = String(peca.ciliaGrupoOrdem ?? '');
  wrap.dataset.ciliaAgrupador = peca.ciliaAgrupador || '';
  wrap.dataset.ciliaPosicaoOrdem = String(peca.ciliaPosicaoOrdem ?? '');
  const grupoSelect = wrap.querySelector('.cilia-grupo-select');
  const agrupadorInput = wrap.querySelector('.cilia-agrupador-input');
  if (grupoSelect) grupoSelect.value = peca.ciliaGrupo || 'OUTROS';
  if (agrupadorInput) agrupadorInput.value = peca.ciliaAgrupador || '';

  const row = wrap.querySelector('[data-cilia="1"], [data-peca-avulsa="1"]');
  if (!row) return;
  const vBruto = numBR(peca.venda || peca.valor || 0);
  const qtd = numBR(peca.qtd || 1) || 1;
  row.dataset.cilia = '1';
  row.dataset.ciliaBruto = String(vBruto);
  row.dataset.ciliaLiquido = String(numBR(peca.ciliaValorLiquido || 0));
  row.dataset.ciliaDesconto = String(numBR(peca.ciliaDesconto || 0));
  row.dataset.ciliaGrupo = peca.ciliaGrupo || '';
  row.dataset.ciliaGrupoOrdem = String(peca.ciliaGrupoOrdem ?? '');
  row.dataset.ciliaAgrupador = peca.ciliaAgrupador || '';
  row.dataset.ciliaPosicaoOrdem = String(peca.ciliaPosicaoOrdem ?? '');

  const codigo = row.querySelector('.peca-codigo');
  const desc = row.querySelector('.peca-desc-livre');
  const qtdInput = row.querySelector('.peca-qtd');
  const venda = row.querySelector('.peca-venda');
  if (codigo && peca.codigo) codigo.value = peca.codigo;
  if (desc && peca.desc) desc.value = peca.desc;
  if (qtdInput) qtdInput.value = qtd;
  if (venda && venda.dataset.editadoManual !== '1') venda.value = vBruto.toFixed(2).replace('.', ',');

  const finalGov = +(qtd * vBruto * (1 - descPeca)).toFixed(2);
  const badgeVal = row.querySelector('.peca-desc-val');
  if (badgeVal) badgeVal.textContent = 'R$ ' + finalGov.toFixed(2).replace('.', ',');
}

function _ciliaWrapTemServicoTempa(wrap, itemTempa, peca) {
  if (!wrap || !itemTempa) return false;
  const codigoInterno = _ciliaChaveNormalizada(itemTempa.codigoInterno || '');
  const codigo = _ciliaChaveNormalizada(itemTempa.codigo || '');
  const desc = _ciliaChaveNormalizada(_ciliaDescricaoServicoTempa(itemTempa) || peca?.desc || '');
  return Array.from(wrap.querySelectorAll('.cilia-serv-relac')).some(row => {
    const codInternoRow = _ciliaChaveNormalizada(row.dataset?.codigoInterno || '');
    const codRow = _ciliaChaveNormalizada(row.dataset?.codigoTabela || '');
    const descRow = _ciliaChaveNormalizada(row.querySelector?.('.serv-desc')?.value || '');
    return (codigoInterno && codInternoRow && codigoInterno === codInternoRow) || (codigo && codRow && codigo === codRow) || (desc && descRow && desc === descRow);
  });
}


function _ciliaTipoVeiculoSelecionado(veiculoAtual = {}) {
  const tipoTela = String(document.getElementById('osTipoVeiculo')?.value || '').trim();
  return tipoTela || String(
    veiculoAtual?.tipoVeiculoOS ||
    veiculoAtual?.tipoVeiculo ||
    veiculoAtual?.porte ||
    veiculoAtual?.categoria ||
    veiculoAtual?.tipo || ''
  ).trim();
}

function _ciliaVeiculoContextoAtual(veiculoAtual = {}) {
  const base = { ...(veiculoAtual || {}) };
  const tipo = _ciliaTipoVeiculoSelecionado(base);
  if (tipo) {
    // Para a busca Cília/Tempária, o tipo cadastrado/selecionado manda sobre
    // inferências pelo modelo (ex.: Duster cadastrada como COMPACTO).
    base.tipoVeiculoOS = tipo;
    base.tipoVeiculo = tipo;
    base.tipo = tipo;
  }
  return base;
}

function _ciliaClasseVeiculoExplicita(veiculoAtual = {}) {
  const n = _ciliaNormServicoTexto(_ciliaTipoVeiculoSelecionado(veiculoAtual));
  if (!n) return '';
  // Regra operacional definida: a associação automática Cília → Tempária
  // usa SOMENTE estas quatro categorias. O tipo selecionado na O.S. manda.
  if (/\bcompacto\b/.test(n)) return 'compacto';
  if (/\bhatch\b/.test(n)) return 'hatch';
  if (/\bsuv\b/.test(n)) return 'suv';
  if (/\butilitario\b|\bpicape\b|\bpickup\b|\bvan\b/.test(n)) return 'utilitario';
  // CARRO, SEDAN, CAMINHÃO, ÔNIBUS, MOTO, OUTRO e NÃO DEFINIDO
  // não recebem categoria por inferência/modelo. As peças continuam importadas
  // e o serviço pode ser lançado manualmente, sem inventar uma classe Tempária.
  return '';
}

function _ciliaClasseItemTempa(itemTempa) {
  const n = _ciliaNormServicoTexto(itemTempa?.sistema || '');
  if (/\bcompacto\b/.test(n)) return 'compacto';
  if (/\bhatch\b/.test(n)) return 'hatch';
  if (/\bsuv\b/.test(n)) return 'suv';
  if (/\butilitario\b/.test(n)) return 'utilitario';
  return '';
}

function _ciliaCederUI() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function _ciliaDirecaoServicoCompativel(itemTempa, peca) {
  const origem = _ciliaNormServicoTexto(peca?.desc || peca?.descricao || '');
  const alvo = _ciliaNormServicoTexto([itemTempa?.operacao, itemTempa?.item].filter(Boolean).join(' '));
  const origemDiant = /\b(diant|dianteir)/.test(origem);
  const origemTras = /\b(tras|traseir)/.test(origem);
  const alvoDiant = /\b(diant|dianteir)/.test(alvo);
  const alvoTras = /\b(tras|traseir)/.test(alvo);
  if (origemDiant && alvoTras && !alvoDiant) return false;
  if (origemTras && alvoDiant && !alvoTras) return false;

  const origemDir = /\b(dir|direit)/.test(origem);
  const origemEsq = /\b(esq|esquerd)/.test(origem);
  const alvoDir = /\b(dir|direit|ld)\b/.test(alvo);
  const alvoEsq = /\b(esq|esquerd|le)\b/.test(alvo);
  if (origemDir && alvoEsq && !alvoDir) return false;
  if (origemEsq && alvoDir && !alvoEsq) return false;

  // Não confundir componentes diferentes que compartilham palavras.
  // Equivalências confirmadas: bieleta = haste da suspensão = suporte da barra tensora.
  const origemBieleta = (/\b(haste|bieleta|liame|tirante)\b/.test(origem) && /\b(suspensao|barra)\b/.test(origem)) || /\bsuporte\b.*\bbarra\b.*\btensora\b/.test(origem);
  const alvoBieleta = (/\b(haste|bieleta|liame|tirante)\b/.test(alvo) && /\b(suspensao|barra)\b/.test(alvo)) || /\bsuporte\b.*\bbarra\b.*\btensora\b/.test(alvo);
  if (origemBieleta && !alvoBieleta) return false;

  if (/\btambor\b/.test(origem) && /\bfreio\b/.test(origem) && /\bsapata/.test(alvo) && !/\btambor de freio\b/.test(alvo)) return false;
  if (/\bpastilhas?\b/.test(origem) && /\bfreio\b/.test(origem) && !/\bpastilhas?\b/.test(alvo)) return false;

  // Balança = bandeja = braço oscilante.
  const origemBandeja = /\b(balanca|bandeja)\b/.test(origem) || /\bbraco\b.*\boscilante\b/.test(origem);
  const alvoBandeja = /\b(balanca|bandeja)\b/.test(alvo) || /\bbraco\b.*\boscilante\b/.test(alvo);
  if (origemBandeja && !alvoBandeja) return false;

  if (/\bagregado\b/.test(origem) && /\bsuspensao\b/.test(origem)) { if (!/\b(quadro|agregado)\b/.test(alvo) || /\bbuchas?\b/.test(alvo)) return false; }
  if (/\bmoldura\b/.test(origem) && /\bsoleira\b/.test(origem) && !(/\bmoldura\b/.test(alvo) && /\bsoleira\b/.test(alvo))) return false;

  const origemBarraKit = /\b(bucha|coxinha|kit)\b.*\bbarra\b.*\bestabilizadora\b/.test(origem);
  const alvoBarraKit = /\b(bucha|coxinha|kit)\b.*\bbarra\b.*\bestabilizadora\b/.test(alvo);
  const origemAxial = /\bterminal\b.*\baxial\b/.test(origem) || /\barticulador\b/.test(origem) || /\bbarra\b.*\baxial\b/.test(origem);
  const alvoAxial = /\bterminal\b.*\baxial\b/.test(alvo) || /\bbarra\b.*\baxial\b/.test(alvo) || (/\barticul/.test(alvo) && /\b(direcao|caixa|setor)\b/.test(alvo));

  // Não confundir a peça inteira com um subcomponente da peça.
  const subcomponentes = ['bucha', 'coifa', 'reparo', 'reparos', 'articulacao', 'pino', 'mangueira', 'capa', 'suporte'];
  for (const termo of subcomponentes) {
    if (termo === 'suporte' && origemBieleta && alvoBieleta) continue;
    if (termo === 'bucha' && origemBarraKit && alvoBarraKit) continue;
    if (termo === 'articulacao' && origemAxial && alvoAxial) continue;
    if (new RegExp(`\\b${termo}\\b`).test(alvo) && !new RegExp(`\\b${termo}\\b`).test(origem)) return false;
  }
  return true;
}

async function _ciliaAdicionarPecas(pecas) {
  pecas = OSU().normalizeCiliaPieces ? OSU().normalizeCiliaPieces(pecas) : pecas;
  if (!pecas || !pecas.length) {
    if (typeof window.toast === 'function') window.toast('Nenhuma peça encontrada no arquivo Cília.', 'warn');
    return;
  }
  pecas = _ciliaOrdenarPecasImportadas(pecas);

  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  const dadosGov = ehGov && typeof window._osDadosGovernamental === 'function' ? window._osDadosGovernamental() : null;
  const descPeca = dadosGov ? taxaDescontoOS(dadosGov.descPeca || 0) : 0;
  const veiculoAtual = _ciliaVeiculoContextoAtual(window._osVeiculoAtual?.() || {});
  const categoriaTempa = _ciliaClasseVeiculoExplicita(veiculoAtual);
  _ciliaTempaBuscaCache.clear();
  const valorHoraOficina = numBR((typeof window._osValorHoraCliente === 'function' ? window._osValorHoraCliente() : 0) || window.J?.valorHoraMecanica || 120);
  // Só carrega/pesquisa Tempária automaticamente nas quatro categorias autorizadas.
  // Isso evita inferência CARRO→COMPACTO/SUV e elimina trabalho desnecessário.
  const tempaOk = categoriaTempa ? await _ciliaGarantirTabelaTempa() : false;
  const jaImportadas = document.querySelectorAll('#containerPecasOS [data-cilia-piece-index]').length;
  let _ciliaPecaIndexCounter = jaImportadas;
  let servicosTempa = 0;
  let semServicoTempa = 0;
  let atualizadas = 0;
  let novas = 0;

  for (const p of pecas) {
    const existente = _ciliaEncontrarWrapPecaExistente(p);
    if (existente) {
      _ciliaAtualizarWrapPecaExistente(existente, p, descPeca);
      if (tempaOk) {
        const itemTempa = _ciliaBuscarServicoTempa(p, veiculoAtual);
        if (itemTempa && !_ciliaWrapTemServicoTempa(existente, itemTempa, p)) {
          window._ciliaAddServicoRelacionado(existente.querySelector('.cilia-servs-relacionados button'), {
            itemTempa,
            peca: p,
            ehGov,
            veiculoAtual,
            valorHoraOficina,
            auto: true,
            suprimirRecalculo: true
          });
          servicosTempa++;
        } else if (!itemTempa) {
          semServicoTempa++;
        }
      }
      atualizadas++;
      if (((novas + atualizadas) % 2) === 0) await _ciliaCederUI();
      continue;
    }

    const wrap = document.createElement('div');
    wrap.className = 'cilia-peca-wrap';
    wrap.dataset.ciliaPieceIndex = String(_ciliaPecaIndexCounter);
    wrap.dataset.ciliaGrupo = p.ciliaGrupo || '';
    wrap.dataset.ciliaGrupoOrdem = String(p.ciliaGrupoOrdem ?? '');
    wrap.dataset.ciliaAgrupador = p.ciliaAgrupador || '';
    wrap.dataset.ciliaPosicaoOrdem = String(p.ciliaPosicaoOrdem ?? '');
    wrap.style.cssText = 'background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.20);border-radius:6px;padding:10px;margin-bottom:8px;';
    wrap.insertAdjacentHTML('beforeend', _ciliaGrupoBadgeHTML(p, !!p.ciliaAbreGrupo));

    const div = document.createElement('div');
    const vBruto = numBR(p.venda || p.valor || 0);
    const qtd = numBR(p.qtd || 1) || 1;
    const vFinal = +(qtd * vBruto * (1 - descPeca)).toFixed(2);
    const colsGov = (ehGov && descPeca > 0) ? '120px 1fr 60px 100px 80px 32px' : '120px 1fr 60px 100px 32px';
    const badgePeca = (ehGov && descPeca > 0) ? `
      <div class="peca-desc-box" style="font-family:var(--fm);font-size:0.72rem;color:var(--ok);text-align:right;line-height:1.2;">
        <div class="peca-desc-pct" style="color:var(--purple,#A78BFA);font-size:0.65rem;">-${(descPeca*100).toFixed(0)}%</div>
        <div class="peca-desc-val">R$ ${vFinal.toFixed(2).replace('.',',')}</div>
      </div>` : '';

    div.style.cssText = `display:grid;grid-template-columns:${colsGov};gap:8px;align-items:center;`;
    div.dataset.pecaAvulsa = '1';
    div.dataset.cilia = '1';
    div.dataset.ciliaBruto = String(vBruto);
    div.dataset.ciliaLiquido = String(numBR(p.ciliaValorLiquido || 0));
    div.dataset.ciliaDesconto = String(numBR(p.ciliaDesconto || 0));
    div.dataset.ciliaPieceIndex = String(_ciliaPecaIndexCounter);
    div.dataset.ciliaGrupo = p.ciliaGrupo || '';
    div.dataset.ciliaGrupoOrdem = String(p.ciliaGrupoOrdem ?? '');
    div.dataset.ciliaAgrupador = p.ciliaAgrupador || '';
    div.dataset.ciliaPosicaoOrdem = String(p.ciliaPosicaoOrdem ?? '');
    div.innerHTML = `
      <input type="text" class="j-input peca-codigo" value="${_escVal(p.codigo)}" placeholder="Código OEM" style="font-family:var(--fm);font-size:0.78rem;" title="Código OEM (editável)">
      <input type="text" class="j-input peca-desc-livre" value="${_escVal(p.desc)}" placeholder="Descrição da peça" oninput="window.calcOSTotal()">
      <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" oninput="window.calcOSTotal()" title="Quantidade importada do Cília">
      <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Valor unit." oninput="this.dataset.editadoManual='1';window.calcOSTotal()" title="Valor unitário bruto importado do Cília (editável)">
      ${badgePeca}
      <button type="button" onclick="this.closest('.cilia-peca-wrap').remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;" title="Remover peça e seus serviços">✕</button>
    `;
    wrap.appendChild(div);

    const servBloco = document.createElement('div');
    servBloco.className = 'cilia-servs-relacionados';
    servBloco.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px dashed rgba(0,212,255,0.20);';
    servBloco.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
        <span style="font-family:var(--fm);font-size:0.65rem;color:var(--muted);letter-spacing:1px;">SERVIÇOS RELACIONADOS A ESTA PEÇA</span>
        <button type="button" onclick="window._ciliaAddServicoRelacionado(this)" style="background:rgba(0,212,255,0.10);border:1px solid var(--cyan);color:var(--cyan);padding:3px 10px;font-size:0.65rem;border-radius:3px;cursor:pointer;font-family:var(--fm);letter-spacing:0.5px;">+ SERVIÇO MANUAL / TEMPA</button>
      </div>
      <div class="cilia-servs-list"></div>
    `;
    wrap.appendChild(servBloco);

    if (typeof $ === 'function' && $('containerPecasOS')) {
      $('containerPecasOS').appendChild(wrap);
    }

    if (tempaOk) {
      const itemTempa = _ciliaBuscarServicoTempa(p, veiculoAtual);
      if (itemTempa) {
        window._ciliaAddServicoRelacionado(servBloco.querySelector('button'), {
          itemTempa,
          peca: p,
          ehGov,
          veiculoAtual,
          valorHoraOficina,
          auto: true,
          suprimirRecalculo: true
        });
        servicosTempa++;
      } else {
        semServicoTempa++;
        _ciliaAvisoServicoSemTempa(servBloco, p);
      }
    } else {
      semServicoTempa++;
      const tipoSelecionado = _ciliaTipoVeiculoSelecionado(veiculoAtual);
      _ciliaAvisoServicoSemTempa(
        servBloco,
        p,
        categoriaTempa
          ? 'Tabela Tempária não carregada. Serviço deve ser preenchido manualmente.'
          : `Tipo de veículo “${tipoSelecionado || 'não definido'}” sem associação automática da Tempária. Use Compacto, Hatch, SUV ou Pickup/Van (Utilitário), ou lance o serviço manualmente.`
      );
    }

    _ciliaPecaIndexCounter++;
    novas++;
    // Entrega a thread ao navegador durante importações grandes para manter a O.S. responsiva.
    if (((novas + atualizadas) % 2) === 0) await _ciliaCederUI();
  }

  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
  if (typeof window.toast === 'function') {
    const msg = servicosTempa
      ? `Cilia: ${novas} peca(s) nova(s), ${atualizadas} atualizada(s), ${servicosTempa} servico(s) Temparia${semServicoTempa ? `, ${semServicoTempa} sem match` : ''}. Duplicadas foram atualizadas/ignoradas.`
      : `Cilia: ${novas} peca(s) nova(s), ${atualizadas} atualizada(s). Nenhum servico automatico encontrado na Temparia. Duplicadas foram atualizadas/ignoradas.`;
    window.toast(msg, servicosTempa ? 'ok' : 'warn');
    return;
  }
  if (typeof window.toast === 'function') {
    const msg = servicosTempa
      ? `✓ ${pecas.length} peça(s) importada(s) do Cília + ${servicosTempa} serviço(s) puxado(s) da Tabela Tempária${semServicoTempa ? ` (${semServicoTempa} sem match)` : ''}`
      : `✓ ${pecas.length} peça(s) importada(s) do Cília. Nenhum serviço automático encontrado na Tabela Tempária.`;
    window.toast(msg, servicosTempa ? 'ok' : 'warn');
  }
}

async function _ciliaGarantirTabelaTempa() {
  try {
    if (typeof window.thiaModEnabled === 'function' && !window.thiaModEnabled('tabelaTempa')) return false;
    if (typeof window.tempaCarregar !== 'function' || typeof window.tempaBuscarPorTexto !== 'function') return false;
    await window.tempaCarregar();
    return !!window._tabelaTempa?.carregada;
  } catch (e) {
    console.warn('[Cília x Tabela Tempária] Falha ao carregar tabela:', e);
    return false;
  }
}

const _ciliaTempaBuscaCache = new Map();

function _ciliaBuscarServicoTempa(peca, veiculoAtual) {
  if (typeof window.thiaModEnabled === 'function' && !window.thiaModEnabled('tabelaTempa')) return null;
  if (typeof window.tempaBuscarPorTexto !== 'function') return null;
  const desc = String(peca?.desc || '').trim();
  const codigo = String(peca?.codigo || '').trim();
  if (!desc && !codigo) return null;

  veiculoAtual = _ciliaVeiculoContextoAtual(veiculoAtual || window._osVeiculoAtual?.() || {});
  const descLimpa = _ciliaLimparDescParaTempa(desc);
  const consultas = _ciliaConsultasTempaPeca(desc, codigo);
  [
    `substituir ${descLimpa}`,
    `troca ${descLimpa}`,
    `remover e instalar ${descLimpa}`,
    descLimpa,
    codigo
  ].filter(Boolean).forEach(q => { if (!consultas.includes(q)) consultas.push(q); });

  const classeExplicita = _ciliaClasseVeiculoExplicita(veiculoAtual);
  // Sem uma das quatro categorias autorizadas, NÃO há associação automática.
  if (!classeExplicita) return null;
  const veiculoBuscaTempa = { tipo: classeExplicita };
  const candidatos = new Map();
  for (const consulta of consultas) {
    // Associação automática Cília → Tempária é deliberadamente estrita.
    // Se a O.S. informa uma classe (ex.: COMPACTO), a busca é orientada por
    // essa classe, sem deixar o nome/modelo (ex.: Duster) puxar SUV por engano.
    // A busca aproximada continua disponível na seleção manual da Tempária.
    const cacheKey = `${classeExplicita}|${_ciliaNormServicoTexto(consulta)}`;
    let resultados = _ciliaTempaBuscaCache.get(cacheKey);
    if (!resultados) {
      resultados = window.tempaBuscarPorTexto(consulta, { veiculo: veiculoBuscaTempa, categoriaTempa: classeExplicita, limite: 24, preciso: true }) || [];
      _ciliaTempaBuscaCache.set(cacheKey, resultados);
    }
    for (const item of resultados) {
      const chave = `${item.codigo || ''}|${item.sistema || ''}|${item.operacao || ''}|${item.item || ''}`;
      if (candidatos.has(chave)) continue;
      if (numBR(item.tempo || 0) <= 0) continue;
      if (!_ciliaTempaCompativelComVeiculo(item, veiculoAtual)) continue;
      if (!_ciliaDirecaoServicoCompativel(item, peca)) continue;
      candidatos.set(chave, {
        item,
        score: _ciliaScoreTempaPeca(item, desc, codigo)
      });
    }
    // Um candidato muito forte dispensa consultas genéricas seguintes.
    const melhorParcial = Array.from(candidatos.values()).sort((a, b) => b.score - a.score)[0];
    if (melhorParcial && melhorParcial.score >= 85) break;
  }

  const ordenados = Array.from(candidatos.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ak = `${a.item.sistema || ''}|${a.item.operacao || ''}|${a.item.item || ''}`;
    const bk = `${b.item.sistema || ''}|${b.item.operacao || ''}|${b.item.item || ''}`;
    return ak.localeCompare(bk, 'pt-BR');
  });
  // Abaixo deste nível, não há evidência suficiente para vincular automaticamente.
  return ordenados[0] && ordenados[0].score >= 28 ? ordenados[0].item : null;
}

function _ciliaTempaCompativelComVeiculo(itemTempa, veiculoAtual) {
  veiculoAtual = _ciliaVeiculoContextoAtual(veiculoAtual || {});
  const classeExplicita = _ciliaClasseVeiculoExplicita(veiculoAtual);
  if (!classeExplicita) return false;
  return _ciliaClasseItemTempa(itemTempa) === classeExplicita;
}

function _ciliaNormServicoTexto(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function _ciliaConsultasTempaPeca(desc, codigo) {
  const limpa = _ciliaLimparDescParaTempa(desc);
  const n = _ciliaNormServicoTexto(limpa);
  const nOriginal = _ciliaNormServicoTexto(desc);
  const termos = [
    `substituir ${limpa}`,
    `troca ${limpa}`,
    `remover e instalar ${limpa}`,
    `instalar ${limpa}`,
    limpa,
    codigo
  ];
  if (/\b(coxim|calco|suporte)\b/.test(n) && /\bmotor\b/.test(n)) termos.push('substituir coxim motor', 'substituir suporte motor', 'substituir calco motor');

  // Equivalências de nomenclatura confirmadas pelo gestor — somente matcher Cília/Tempária.
  const ehBieleta = (/\b(bieleta|haste)\b/.test(n) && (/\b(suspensao|barra|tensora)\b/.test(n) || n === 'bieleta' || n === 'haste')) || /\bsuporte\b.*\bbarra\b.*\btensora\b/.test(n);
  if (ehBieleta) termos.push('substituir bieleta', 'substituir haste suspensao', 'substituir suporte barra tensora', 'substituir bieleta barra estabilizadora');

  const ehBandeja = /\b(balanca|bandeja)\b/.test(n) || /\bbraco\b.*\boscilante\b/.test(n);
  if (ehBandeja) termos.push('substituir bandeja', 'substituir balanca', 'substituir braco oscilante', 'remover e instalar braco suspensao bandeja');

  const ehKitBarra = /\b(bucha|coxinha|kit)\b.*\bbarra\b.*\bestabilizadora\b/.test(n);
  if (ehKitBarra) termos.push('substituir kit barra estabilizadora suspensao dianteira', 'kit barra estabilizadora suspensao dianteira', 'substituir bucha barra estabilizadora', 'substituir coxinha barra estabilizadora');

  const ehAxial = /\bterminal\b.*\baxial\b/.test(n) || /\barticulador\b/.test(n) || /\bbarra\b.*\baxial\b/.test(n);
  if (ehAxial) termos.push('terminal axial', 'articulador', 'barra axial', 'articulacao setor barra axial caixa direcao');

  const ehTerminalPonteira = /\b(terminal|ponteira)\b/.test(n) && !ehAxial && !/\b(homocinet|parachoque|para choque)\b/.test(n);
  if (ehTerminalPonteira) termos.push('terminal direcao', 'ponteira terminal direcao', 'ponteira direcao');

  if (/\b(cubo|rolamento)\b/.test(n) && /\broda\b/.test(n)) termos.push('substituir cubo roda', 'substituir rolamento roda', 'remover e instalar cubo roda');
  if (/\bbateria\b/.test(n)) termos.push('substituir bateria', 'remover e instalar bateria');
  if (/\b(pastilhas?|discos?)\b/.test(n) && /\bfreio\b/.test(n)) termos.push('substituir freio', 'substituir pastilha freio', 'substituir pastilhas freio', 'substituir disco freio', 'substituir discos freio');
  if (/\bamortecedor\b/.test(n)) termos.push('substituir amortecedor', 'remover e instalar amortecedor');
  if (/\bfiltro\b/.test(n)) termos.push('substituir filtro', 'troca filtro');
  if (/\b(haste|bieleta|liame|tirante)\b/.test(n) && /\bbarra estabilizadora\b/.test(n)) termos.push('substituir bieleta barra estabilizadora', 'substituir liame barra estabilizadora');
  if (/\bsemieixo\b|\bsemi eixo\b/.test(n)) termos.push('remover e instalar semi eixo', 'substituir semi eixo');
  if (/\baro\b/.test(n) && /\broda\b/.test(n)) termos.push('remover e instalar aro de roda', 'substituir aro de roda');
  if (/\bsapatas?\b/.test(n) && /\bfreio\b/.test(n)) termos.push('substituir sapatas freio');
  if (/\baditivo\b/.test(n) && /\b(?:radiador|arrefecimento|agua)\b/.test(n)) termos.push('substituir aditivo agua', 'aditivo agua', 'aditivo da agua');
  if (/\breservatorio\b/.test(n) && /\b(?:radiador|arrefecimento|agua)\b/.test(n)) termos.push('substituir reservatorio expansao', 'reservatorio expansao', 'reservatorio de expansao');
  if (/\bagregado\b/.test(nOriginal) && /\bsuspensao\b/.test(nOriginal) && /\b(diant|dianteir)/.test(nOriginal)) termos.push('substituir quadro suspensao dianteira', 'quadro suspensao dianteira');
  if (/\bbraco oscilante\b/.test(nOriginal) && /\b(diant|dianteir)/.test(nOriginal)) termos.push('remover e instalar braco suspensao bandeja dianteira', 'braco suspensao bandeja dianteira');
  if (/\bmoldura\b/.test(n) && /\bsoleira\b/.test(n)) termos.push('substituir moldura soleira porta dianteira', 'moldura soleira porta dianteira');
  if (/\btambor\b/.test(n) && /\bfreio\b/.test(n)) termos.push('substituir tambor freio');
  return [...new Set(termos.map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

function _ciliaScoreTempaPeca(itemTempa, desc, codigo) {
  const alvo = _ciliaNormServicoTexto([
    itemTempa?.operacao, itemTempa?.item, itemTempa?.sistema, itemTempa?.codigo
  ].filter(Boolean).join(' '));
  const base = _ciliaNormServicoTexto([desc, codigo].filter(Boolean).join(' '));
  const tokens = base.split(' ').filter(t => t.length >= 3 && !/^(cod|codigo|peca|original|genuin|paralel|lado|direit|esquerd|diant|tras|traseir|dianteir)$/.test(t));
  const sinonimos = {
    coxim: ['coxim', 'suporte', 'calco', 'apoio'],
    calco: ['coxim', 'suporte', 'calco', 'apoio'],
    cubo: ['cubo', 'rolamento'],
    rolamento: ['rolamento', 'cubo'],
    bieleta: ['bieleta', 'haste', 'tirante', 'liame', 'suporte barra tensora'],
    haste: ['haste', 'bieleta', 'tirante', 'liame', 'suporte barra tensora'],
    balanca: ['balanca', 'bandeja', 'braco oscilante'],
    bandeja: ['bandeja', 'balanca', 'braco oscilante'],
    bucha: ['bucha', 'coxinha', 'kit'],
    coxinha: ['coxinha', 'bucha', 'kit'],
    terminal: ['terminal', 'ponteira', 'barra axial', 'articulacao'],
    ponteira: ['ponteira', 'terminal'],
    articulador: ['articulador', 'articulacao', 'barra axial', 'terminal axial'],
    oleo: ['oleo', 'lubrificante'],
    filtro: ['filtro', 'elemento filtrante'],
    homocinetica: ['homocinetica', 'semi eixo', 'semieixo']
  };
  let score = 0;
  tokens.forEach(t => {
    const alts = sinonimos[t] || [t];
    if (alts.some(a => alvo.includes(a))) score += 14 + Math.min(8, t.length);
  });
  if (base && alvo.includes(base)) score += 35;
  if (/\b(substitui|troca|remover|instalar)\b/.test(alvo)) score += 10;
  if (codigo && alvo.includes(_ciliaNormServicoTexto(codigo))) score += 18;
  if (/\bmotor\b/.test(base) && /\bmotor\b/.test(alvo)) score += 10;
  if (/\broda\b/.test(base) && /\broda\b/.test(alvo)) score += 10;
  if (/\bfreio\b/.test(base) && /\bfreio\b/.test(alvo)) score += 10;
  if (/\b(diant|dianteir)/.test(base) && /\b(diant|dianteir)/.test(alvo)) score += 22;
  if (/\b(tras|traseir)/.test(base) && /\b(tras|traseir)/.test(alvo)) score += 22;
  if (/\b(dir|direit)/.test(base) && /\b(dir|direit|ld)\b/.test(alvo)) score += 16;
  if (/\b(esq|esquerd)/.test(base) && /\b(esq|esquerd|le)\b/.test(alvo)) score += 16;
  const classePeca = _ciliaClasseItemTempa(itemTempa);
  if (classePeca) score += 8;
  return score;
}

function _ciliaLimparDescParaTempa(desc) {
  return String(desc || '')
    .replace(/\b(original|genuina|genuino|paralela|paralelo|lado|ld|le|dianteiro|dianteira|traseiro|traseira|direito|direita|esquerdo|esquerda|inferior|superior)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _ciliaAvisoServicoSemTempa(servBloco, peca, mensagem) {
  const list = servBloco?.querySelector?.('.cilia-servs-list');
  if (!list) return;
  const aviso = document.createElement('div');
  aviso.className = 'cilia-tempa-sem-match';
  aviso.style.cssText = 'font-family:var(--fm);font-size:0.62rem;color:var(--warn);background:rgba(255,184,0,0.06);border:1px solid rgba(255,184,0,0.22);border-radius:3px;padding:6px 8px;margin-bottom:5px;';
  aviso.textContent = mensagem || `Sem correspondência única e segura na Tabela Tempária para: ${String(peca?.desc || peca?.codigo || '').slice(0, 80)}. Use + SERVIÇO MANUAL / TEMPA e escolha a sugestão correta.`;
  list.appendChild(aviso);
}

function _ciliaContextoServico(row) {
  const wrap = row?.closest?.('.cilia-peca-wrap') || null;
  const pecaRow = wrap?.querySelector?.('[data-cilia="1"], [data-peca-avulsa="1"]') || null;
  const ehGov = typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  return {
    wrap,
    pecaRow,
    ehGov,
    veiculoAtual: _ciliaVeiculoContextoAtual(window._osVeiculoAtual?.() || {}),
    valorHoraOficina: window._osValorHoraCliente?.() || window.J?.valorHoraMecanica || 120,
    pecaDesc: row?.dataset?.pecaDesc || pecaRow?.querySelector?.('.peca-desc-livre')?.value || '',
    pecaCodigo: row?.dataset?.pecaCodigo || pecaRow?.querySelector?.('.peca-codigo')?.value || ''
  };
}

function _ciliaDescricaoServicoTempa(itemTempa) {
  return `${itemTempa?.operacao || 'SERVIÇO'} ${itemTempa?.item || ''}`.replace(/\s+/g, ' ').trim();
}

function _ciliaResolverValorHoraTempa(itemTempa, ctx) {
  const secaoInfo = ctx.ehGov && OSU().inferPMSPValorHora
    ? OSU().inferPMSPValorHora(itemTempa, { veiculo: ctx.veiculoAtual || {} })
    : null;
  const valorHora = secaoInfo?.valor || (!ctx.ehGov ? numBR(ctx.valorHoraOficina || window.J?.valorHoraMecanica || 120) : 0);
  return { secaoInfo, valorHora: numBR(valorHora || 0) };
}

function _ciliaValorServicoFmt(row) {
  const valor = numBR(row?.querySelector?.('.serv-valor')?.value || 0);
  return valor.toFixed(2).replace('.', ',');
}

function _ciliaAtualizarMetaServico(row, texto, tipo) {
  const meta = row?.querySelector?.('.serv-tempa-meta');
  if (!meta) return;
  const cor = tipo === 'warn' ? 'var(--warn)' : tipo === 'ok' ? 'var(--success)' : 'var(--muted)';
  meta.style.color = cor;
  meta.innerHTML = `${texto}<span class="serv-desc-val" style="float:right;color:var(--ok);">R$ ${_ciliaValorServicoFmt(row)}</span>`;
}

function _ciliaMetaTempaHTML(itemTempa, secaoInfo, valorHora, prefixo) {
  const tempo = numBR(itemTempa?.tempo || 0).toFixed(2).replace('.', ',');
  const horaTxt = valorHora ? ` &middot; R$ ${numBR(valorHora).toFixed(2).replace('.', ',')}/h` : '';
  const secaoTxt = secaoInfo?.label ? ` &middot; ${escOS(secaoInfo.label)}` : '';
  const tipoTxt = extrairTipoVeiculoTempaOS({ sistemaTabela: itemTempa?.sistema, sistema: itemTempa?.sistema }, window._osVeiculoAtual?.() || {});
  const codigoInterno = itemTempa?.codigoInterno ? ` &middot; COD. INTERNO: ${escOS(itemTempa.codigoInterno)}` : '';
  const codigoTabela = itemTempa?.codigo ? ` &middot; COD. SIAFISICO: ${escOS(itemTempa.codigo)}` : '';
  return `${prefixo || 'Tabela Temparia'} &middot; ${escOS(itemTempa?.sistema || '-')}${codigoInterno}${codigoTabela} &middot; tipo veiculo ${escOS(tipoTxt || '-')} &middot; TMO ${tempo}h${secaoTxt}${horaTxt}`;
}

function _ciliaAplicarItemTempaNaLinha(row, itemTempa, opts = {}) {
  if (!row || !itemTempa) return;
  const ctx = _ciliaContextoServico(row);
  const { secaoInfo, valorHora } = _ciliaResolverValorHoraTempa(itemTempa, ctx);
  const tempo = numBR(itemTempa.tempo || 0);
  const valor = tempo > 0 && valorHora > 0 ? +(tempo * valorHora).toFixed(2) : 0;

  row.dataset.ciliaAutoTempa = '1';
  row.dataset.tempaManual = opts.marcadoComoEditado ? '1' : '';
  row.dataset.valorManual = '';
  row.dataset.valorHoraManual = '';
  row.dataset.tempoTabela = String(itemTempa.tempo || '');
  row.dataset.codigoInterno = itemTempa.codigoInterno || '';
  row.dataset.codigoTabela = itemTempa.codigo || '';
  row.dataset.sistemaTabela = itemTempa.sistema || '';
  row.dataset.tipoVeiculoTabela = extrairTipoVeiculoTempaOS({ sistemaTabela: itemTempa.sistema, sistema: itemTempa.sistema }, ctx.veiculoAtual || window._osVeiculoAtual?.() || {});
  row.dataset.secaoHora = secaoInfo?.key || '';
  row.dataset.secaoHoraLabel = secaoInfo?.label || itemTempa.sistema || '';
  row.dataset.valorHoraSecao = secaoInfo?.valor || '';

  const descInput = row.querySelector('.serv-desc');
  const tempoInput = row.querySelector('.serv-tempo');
  const valorHoraInput = row.querySelector('.serv-valor-hora');
  const valorInput = row.querySelector('.serv-valor');
  const descTempa = _ciliaDescricaoServicoTempa(itemTempa);
  if (descInput) descInput.value = descTempa;
  if (tempoInput) tempoInput.value = tempo.toFixed(2).replace('.', ',');
  if (valorHoraInput) valorHoraInput.value = valorHora ? valorHora.toFixed(2).replace('.', ',') : '0,00';
  if (valorInput) valorInput.value = valor.toFixed(2).replace('.', ',');
  const buscaInput = row.querySelector('.serv-tempa-busca');
  const lista = row.querySelector('.serv-tempa-resultados-list');
  if (buscaInput) buscaInput.value = descTempa;
  if (lista) lista.style.display = 'none';

  _ciliaAtualizarMetaServico(row, _ciliaMetaTempaHTML(itemTempa, secaoInfo, valorHora, opts.prefixo || 'Tabela Tempária aplicada'), 'ok');
  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
}

window._ciliaRecalcularServicoRelacionado = function(row) {
  if (!row) return;
  const valorInput = row.querySelector('.serv-valor');
  if (valorInput && row.dataset.valorManual !== '1') {
    const calc = calcularServicoLinhaOS(row, descontoMaoObraAtualOS());
    valorInput.value = numBR(calc.valorBruto || calc.bruto || 0).toFixed(2).replace('.', ',');
  }
  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
};

function _ciliaTermoDigitadoServico(row) {
  const buscaEl = row?.querySelector?.('.serv-tempa-busca');
  const descEl = row?.querySelector?.('.serv-desc');
  const busca = buscaEl?.value?.trim() || '';
  const desc = descEl?.value?.trim() || '';
  // Quem manda na Tempária é o campo que o usuário está digitando agora.
  // Se ele trocar "bomba de combustível" por "pastilha", nunca pode continuar buscando bomba.
  if (document.activeElement === buscaEl) return busca;
  if (document.activeElement === descEl) return desc;
  return busca || desc || row?.dataset?.pecaDesc || row?.dataset?.pecaCodigo || '';
}

function _ciliaLimparResultadosTempaServico(row) {
  const lista = row?.querySelector?.('.serv-tempa-resultados-list');
  const aplicar = row?.querySelector?.('.serv-tempa-aplicar');
  if (lista) { lista.innerHTML = ''; lista.style.display = 'none'; }
  if (aplicar) { aplicar.style.display = 'none'; aplicar.dataset.idx = ''; }
  row._ciliaTempaResultados = [];
}

function _ciliaRenderResultadosTempaServico(row, resultados, termo) {
  const lista = row?.querySelector?.('.serv-tempa-resultados-list');
  const aplicar = row?.querySelector?.('.serv-tempa-aplicar');
  if (!lista) return;
  row._ciliaTempaResultados = resultados || [];
  if (!resultados || !resultados.length) {
    lista.style.display = 'block';
    lista.innerHTML = `<div class="cilia-tempa-empty">Nenhum serviço da Tabela Tempária encontrado para “${escOS(termo)}”. Você pode manter digitado manualmente.</div>`;
    if (aplicar) { aplicar.style.display = 'none'; aplicar.dataset.idx = ''; }
    _ciliaAtualizarMetaServico(row, `Sem resultado na Tabela Tempária para “${escOS(termo)}”. Digite outro termo ou mantenha manual.`, 'warn');
    return;
  }
  lista.style.display = 'block';
  lista.dataset.expandido = '0';
  const renderOpcaoTempa = (it, i) => {
    const tempo = numBR(it.tempo || 0).toFixed(2).replace('.', ',');
    const label = `[${escOS(it.codigo || '-')}] ${escOS(it.sistema || '-')} · ${escOS(it.operacao || '')} ${escOS(it.item || '')}`;
    return `<button type="button" class="cilia-tempa-opcao" data-idx="${i}" onclick="window._ciliaSelecionarResultadoTempaServico(this)" style="width:100%;display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:10px;align-items:center;text-align:left;margin:4px 0;padding:9px 10px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.22);color:var(--text);border-radius:5px;cursor:pointer;font-size:.72rem;font-family:var(--fd);white-space:normal;">
      <span style="min-width:0;white-space:normal;line-height:1.25;">${label}</span>
      <b style="font-family:var(--fm);color:var(--success);text-align:right;white-space:nowrap;">${tempo}h</b>
    </button>`;
  };
  const visiveis = resultados.slice(0, Math.min(3, resultados.length));
  lista.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px;">
      <b style="font-family:var(--fm);font-size:.62rem;color:var(--cyan);letter-spacing:1px;">${resultados.length} sugestão(ões) da Tempária</b>
      ${resultados.length>3?`<button type="button" class="btn-ghost" style="font-size:.58rem;padding:3px 8px;" onclick="window._ciliaToggleTempaResultados(this)">Ver sugestões</button>`:''}
    </div>
    <div class="serv-tempa-resultados-itens">${visiveis.map(renderOpcaoTempa).join('')}</div>`;
  lista._renderTodosTempa = function(expandido){
    const alvo = lista.querySelector('.serv-tempa-resultados-itens');
    const btn = lista.querySelector('button[onclick*="_ciliaToggleTempaResultados"]');
    if (!alvo) return;
    alvo.innerHTML = (expandido ? resultados : resultados.slice(0, Math.min(3, resultados.length))).map(renderOpcaoTempa).join('');
    lista.dataset.expandido = expandido ? '1' : '0';
    if (btn) btn.textContent = expandido ? 'Ocultar sugestões' : 'Ver sugestões';
  };
  if (aplicar) { aplicar.style.display = 'none'; aplicar.dataset.idx = ''; }
  _ciliaAtualizarMetaServico(row, `${resultados.length} resultado(s) PRECISO(S) da Tabela Tempária para “${escOS(termo)}”. Clique em um item para aplicar.`, 'ok');
}

window._ciliaToggleTempaResultados = function(btn) {
  const lista = btn?.closest?.('.serv-tempa-resultados-list');
  if (!lista || typeof lista._renderTodosTempa !== 'function') return;
  lista._renderTodosTempa(lista.dataset.expandido !== '1');
};

async function _ciliaBuscarTempaServicoInline(row, termo, opts = {}) {
  if (!row) return [];
  const q = String(termo || '').trim();
  if (q.length < 2) {
    _ciliaLimparResultadosTempaServico(row);
    return [];
  }
  const ok = await _ciliaGarantirTabelaTempa();
  if (!ok || typeof window.tempaBuscarPorTexto !== 'function') {
    _ciliaAtualizarMetaServico(row, 'Tabela Tempária não carregou. Verifique data/tabela-tempa.min.json.', 'warn');
    return [];
  }

  // Busca MANUAL da O.S.: diferente da associação automática Cília → Tempária.
  // O automático continua restrito à categoria cadastrada no veículo. Aqui o gestor
  // pode procurar e escolher livremente entre as quatro categorias operacionais
  // autorizadas (Compacto, Hatch, SUV e Utilitário), inclusive por código conhecido.
  const ctx = _ciliaContextoServico(row);
  const categoriaPreferida = _ciliaClasseVeiculoExplicita(ctx.veiculoAtual);
  const categoriasPermitidas = ['compacto', 'hatch', 'suv', 'utilitario'];
  const limite = Math.max(1, Number(opts.limite || 120));
  const porCategoria = {};

  // Usa os quatro índices específicos já existentes. Assim a busca manual enxerga
  // todas as categorias permitidas sem percorrer caminhão/ônibus/sedan e sem alterar
  // o mecanismo automático, que continua consultando somente a categoria da O.S.
  categoriasPermitidas.forEach(categoriaTempa => {
    porCategoria[categoriaTempa] = window.tempaBuscarPorTexto(q, {
      veiculo: { tipo: categoriaTempa },
      categoriaTempa,
      limite,
      preciso: true
    }) || [];
  });

  const normCodigo = valor => String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codigoBuscado = normCodigo(q);
  const chaveItem = item => [
    _ciliaNormServicoTexto(item?.sistema || ''),
    normCodigo(item?.codigoInterno || ''),
    normCodigo(item?.codigo || ''),
    _ciliaNormServicoTexto(item?.operacao || ''),
    _ciliaNormServicoTexto(item?.item || ''),
    String(numBR(item?.tempo || 0))
  ].join('|');
  const vistos = new Set();
  const resultados = [];
  const adicionar = item => {
    if (!item || resultados.length >= limite) return;
    const chave = chaveItem(item);
    if (vistos.has(chave)) return;
    vistos.add(chave);
    resultados.push(item);
  };

  // Se o gestor digitou exatamente um código interno/SIAFISICO, esses resultados
  // vêm primeiro mesmo que pertençam a uma categoria diferente da O.S.
  if (codigoBuscado) {
    categoriasPermitidas.forEach(categoria => {
      (porCategoria[categoria] || []).forEach(item => {
        if (normCodigo(item?.codigoInterno) === codigoBuscado || normCodigo(item?.codigo) === codigoBuscado) adicionar(item);
      });
    });
  }

  // Mantém a categoria do veículo como preferência visual, sem bloquear as demais.
  // O preenchimento em rodadas evita que uma categoria com muitos resultados esconda
  // completamente SUV/Hatch/Utilitário na pesquisa manual.
  const ordemCategorias = categoriaPreferida && categoriasPermitidas.includes(categoriaPreferida)
    ? [categoriaPreferida, ...categoriasPermitidas.filter(c => c !== categoriaPreferida)]
    : categoriasPermitidas.slice();
  const maiorLista = Math.max(0, ...ordemCategorias.map(c => (porCategoria[c] || []).length));
  for (let i = 0; i < maiorLista && resultados.length < limite; i++) {
    for (const categoria of ordemCategorias) {
      adicionar((porCategoria[categoria] || [])[i]);
      if (resultados.length >= limite) break;
    }
  }

  _ciliaRenderResultadosTempaServico(row, resultados, q);
  return resultados;
}

window._ciliaSelecionarResultadoTempaServico = function(btn) {
  const row = btn?.closest?.('.cilia-serv-relac');
  if (!row) return;
  const idx = parseInt(btn.dataset.idx || '-1', 10);
  const itemTempa = (row._ciliaTempaResultados || [])[idx];
  if (!itemTempa) return;
  _ciliaAplicarItemTempaNaLinha(row, itemTempa, { prefixo: 'Tabela Tempária aplicada pelo serviço digitado' });
  window.toast?.('✓ Serviço aplicado pela Tabela Tempária. Você ainda pode editar livremente.', 'ok');
};

window._ciliaAgendarBuscaTempaServico = function(el) {
  const row = el?.closest?.('.cilia-serv-relac');
  if (!row) return;
  const termo = _ciliaTermoDigitadoServico(row);
  clearTimeout(row._ciliaBuscaTimer);
  if (!termo || termo.trim().length < 2) {
    _ciliaLimparResultadosTempaServico(row);
    return;
  }
  row._ciliaBuscaTimer = setTimeout(() => _ciliaBuscarTempaServicoInline(row, termo, { limite: 120 }), 220);
};

window._ciliaServicoEditado = function(el, tipo) {
  const row = el?.closest?.('.cilia-serv-relac');
  if (!row) return;
  row.dataset.tempaManual = '1';
  if (tipo === 'desc') {
    // Ao trocar "substituir bomba" por "pastilha", a busca TEMPA deve seguir PASTILHA imediatamente.
    const buscaInput = row.querySelector('.serv-tempa-busca');
    if (buscaInput && document.activeElement !== buscaInput) buscaInput.value = el.value || '';
    row.dataset.codigoInterno = row.dataset.codigoInterno || '';
    row.dataset.codigoTabela = row.dataset.codigoTabela || '';
    window._ciliaAgendarBuscaTempaServico(el);
  }
  if (tipo === 'valor') row.dataset.valorManual = '1';
  if (tipo === 'valorHora') row.dataset.valorHoraManual = '1';
  if (tipo === 'tempo' || tipo === 'valorHora') {
    window._ciliaRecalcularServicoRelacionado(row);
  } else if (typeof window.calcOSTotal === 'function') {
    window.calcOSTotal();
  }
  const cod = row.dataset.codigoTabela || '';
  if (cod && tipo !== 'desc') {
    _ciliaAtualizarMetaServico(row, `EDITADO MANUALMENTE · origem Tempária cód. ${escOS(cod)} preservada. Digite no campo do serviço ou na busca TEMPA para trocar por outro item.`, 'warn');
  } else if (!cod && tipo !== 'desc') {
    _ciliaAtualizarMetaServico(row, 'Serviço manual vinculado à peça. Digite o serviço e a Tempária aparecerá conforme o texto.', 'warn');
  }
};

window._ciliaPesquisarTempaServico = async function(btn) {
  const row = btn?.closest?.('.cilia-serv-relac');
  if (!row) return;
  const buscaInput = row.querySelector('.serv-tempa-busca');
  const descInput = row.querySelector('.serv-desc');
  const q = (buscaInput?.value || descInput?.value || row.dataset.pecaDesc || row.dataset.pecaCodigo || '').trim();
  if (!q) { window.toast?.('Digite o serviço/peça que deseja procurar na Tabela Tempária.', 'warn'); return; }
  await _ciliaBuscarTempaServicoInline(row, q, { limite: 160 });
};

window._ciliaAplicarTempaSelecionada = function(btn) {
  const row = btn?.closest?.('.cilia-serv-relac');
  if (!row) return;
  const idx = parseInt(btn?.dataset?.idx || '-1', 10);
  const itemTempa = (row._ciliaTempaResultados || [])[idx];
  if (!itemTempa) { window.toast?.('Clique em um resultado da Tabela Tempária para aplicar.', 'warn'); return; }
  _ciliaAplicarItemTempaNaLinha(row, itemTempa, { prefixo: 'Tabela Tempária aplicada manualmente' });
  window.toast?.('✓ Serviço preenchido pela Tabela Tempária. Você ainda pode editar livremente.', 'ok');
};

window.renderCiliaPecaOSRow = function(p, servicosRelacionados = []) {
  const grupo = _ciliaGrupoSistemaPeca(p || {});
  p = Object.assign({}, p, {
    ciliaGrupo: p?.ciliaGrupo || grupo.nome,
    ciliaGrupoOrdem: p?.ciliaGrupoOrdem ?? grupo.ordem,
    ciliaAgrupador: p?.ciliaAgrupador || _ciliaAgrupadorPeca(p || {}),
    ciliaPosicaoOrdem: p?.ciliaPosicaoOrdem ?? _ciliaPosicaoOrdemPeca(p || {})
  });
  const wrap = document.createElement('div');
  wrap.className = 'cilia-peca-wrap';
  wrap.dataset.ciliaPieceIndex = String(p.ciliaPieceIndex ?? document.querySelectorAll('#containerPecasOS [data-cilia-piece-index]').length);
  wrap.dataset.ciliaGrupo = p.ciliaGrupo || '';
  wrap.dataset.ciliaGrupoOrdem = String(p.ciliaGrupoOrdem ?? '');
  wrap.dataset.ciliaAgrupador = p.ciliaAgrupador || '';
  wrap.dataset.ciliaPosicaoOrdem = String(p.ciliaPosicaoOrdem ?? '');
  wrap.style.cssText = 'border:1px solid rgba(0,212,255,0.18);border-radius:6px;padding:8px;margin-bottom:8px;background:rgba(0,212,255,0.035);';
  wrap.insertAdjacentHTML('beforeend', _ciliaGrupoBadgeHTML(p, p.ciliaAbreGrupo === true || _ciliaDeveAbrirGrupoRender(p)));

  const qtd = numBR(p.qtd || p.q || 1) || 1;
  const vBruto = numBR(p.venda || p.v || p.ciliaBruto || 0);
  const div = document.createElement('div');
  div.dataset.pecaAvulsa = '1';
  div.dataset.cilia = '1';
  div.dataset.ciliaBruto = String(p.ciliaBruto || vBruto);
  div.dataset.ciliaLiquido = String(p.ciliaValorLiquido || 0);
  div.dataset.ciliaDesconto = String(p.ciliaDesconto || 0);
  div.dataset.ciliaPieceIndex = String(wrap.dataset.ciliaPieceIndex);
  div.dataset.ciliaGrupo = p.ciliaGrupo || '';
  div.dataset.ciliaGrupoOrdem = String(p.ciliaGrupoOrdem ?? '');
  div.dataset.ciliaAgrupador = p.ciliaAgrupador || '';
  div.dataset.ciliaPosicaoOrdem = String(p.ciliaPosicaoOrdem ?? '');
  div.style.cssText = 'display:grid;grid-template-columns:120px 1fr 60px 100px 32px;gap:8px;align-items:center;background:rgba(0,212,255,0.06);padding:8px;border-radius:4px;border:1px solid rgba(0,212,255,0.18);';
  div.innerHTML = `
    <input type="text" class="j-input peca-codigo" value="${_escVal(p.codigo || '')}" placeholder="Código Cília/OEM" style="font-family:var(--fm);font-size:0.78rem;">
    <input type="text" class="j-input peca-desc-livre" value="${_escVal(p.desc || '')}" placeholder="Descrição da peça Cília" oninput="window.calcOSTotal()">
    <input type="number" class="j-input peca-qtd" value="${qtd}" min="1" oninput="window.calcOSTotal()" style="text-align:center;">
    <input type="text" inputmode="decimal" class="j-input peca-venda" value="${vBruto.toFixed(2).replace('.', ',')}" placeholder="Valor" oninput="window.calcOSTotal()">
    <button type="button" onclick="this.closest('.cilia-peca-wrap').remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;" title="Remover peça e seus serviços">✕</button>
  `;
  wrap.appendChild(div);
  instalarDescontoIndividualLinhaOS(div, 'peca', descontoIndividualSalvoValorOS(p, numBR(p.valorBruto || ((p.qtd || p.q || 1) * numBR(p.venda || p.valor || 0)))));

  const servBloco = document.createElement('div');
  servBloco.className = 'cilia-servs-relacionados';
  servBloco.style.cssText = 'margin-top:7px;padding-left:12px;border-left:2px solid rgba(0,212,255,0.28);';
  servBloco.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:8px;">
      <span style="font-family:var(--fm);font-size:0.62rem;color:var(--muted);letter-spacing:.5px;">SERVIÇOS VINCULADOS À PEÇA CÍLIA</span>
      <button type="button" onclick="window._ciliaAddServicoRelacionado(this)" style="background:rgba(0,212,255,0.10);border:1px solid var(--cyan);color:var(--cyan);padding:3px 10px;font-size:0.65rem;border-radius:3px;cursor:pointer;font-family:var(--fm);letter-spacing:0.5px;">+ SERVIÇO MANUAL / TEMPA</button>
    </div>
    <div class="cilia-servs-list"></div>
  `;
  wrap.appendChild(servBloco);

  if (typeof $ === 'function' && $('containerPecasOS')) $('containerPecasOS').appendChild(wrap);
  if (p.ciliaManual === true) focarLinhaNovaOS(div, '.peca-desc-livre, .peca-codigo');
  (servicosRelacionados || []).forEach(s => {
    window._ciliaAddServicoRelacionado(servBloco.querySelector('button'), { servico: s, peca: p, auto: false });
  });
  if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
};

// Helper: adiciona serviço dentro do bloco da peça importada do Cília.
// Quando recebe opts.itemTempa, já preenche TMO, código, sistema e valor a partir da Tabela Tempária.
window._ciliaAddServicoRelacionado = function(btn, opts = {}) {
  const wrap = btn?.closest?.('.cilia-peca-wrap');
  if (!wrap) return;
  const list = wrap.querySelector('.cilia-servs-list');
  if (!list) return;

  const pecaRow = wrap.querySelector('[data-cilia="1"], [data-peca-avulsa="1"]');
  const pecaDesc = opts.peca?.desc || pecaRow?.querySelector?.('.peca-desc-livre')?.value || '';
  const pecaCodigo = opts.peca?.codigo || pecaRow?.querySelector?.('.peca-codigo')?.value || '';
  const itemTempa = opts.itemTempa || null;
  const servico = opts.servico || null;
  const ehGov = !!opts.ehGov || (typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental());
  const ctxBase = { ehGov, veiculoAtual: _ciliaVeiculoContextoAtual(opts.veiculoAtual || window._osVeiculoAtual?.() || {}), valorHoraOficina: opts.valorHoraOficina || window._osValorHoraCliente?.() || window.J?.valorHoraMecanica || 120 };

  let desc = servico?.desc || '';
  let tempo = numBR(servico?.tempo || 0);
  let valorHora = numBR(servico?.valorHora || servico?.valorHoraSecao || 0);
  let valor = numBR(servico?.valor || 0);
  let metaHTML = servico?.codigoTabela
    ? `Tabela Tempária preservada · ${escOS(servico.sistemaTabela || '-')} · cód. ${escOS(servico.codigoTabela || '-')} · TMO ${numBR(servico.tempo || 0).toFixed(2).replace('.', ',')}h`
    : 'Serviço manual vinculado a esta peça. Digite livremente; a Tempária aparece conforme o texto.';
  let metaTipo = servico?.codigoTabela ? 'ok' : 'warn';
  if (servico?.codigoInterno || servico?.codigoTabela) {
    const partesCod = [];
    if (servico.codigoInterno) partesCod.push(`COD. INTERNO ${escOS(servico.codigoInterno)}`);
    if (servico.codigoTabela) partesCod.push(`COD. SIAFISICO ${escOS(servico.codigoTabela)}`);
    metaHTML = `Tabela Temparia preservada &middot; ${escOS(servico.sistemaTabela || '-')} &middot; ${partesCod.join(' &middot; ')} &middot; TMO ${numBR(servico.tempo || 0).toFixed(2).replace('.', ',')}h`;
    metaTipo = 'ok';
  }

  if (itemTempa) {
    const { secaoInfo, valorHora: vh } = _ciliaResolverValorHoraTempa(itemTempa, ctxBase);
    tempo = numBR(itemTempa.tempo || 0);
    valorHora = vh;
    valor = tempo > 0 && valorHora > 0 ? +(tempo * valorHora).toFixed(2) : 0;
    desc = _ciliaDescricaoServicoTempa(itemTempa);
    metaHTML = _ciliaMetaTempaHTML(itemTempa, secaoInfo, valorHora, opts.auto ? 'AUTO: Tabela Tempária' : 'Tabela Tempária');
    metaTipo = 'ok';
  }

  if (!desc) desc = pecaDesc ? `Troca de ${String(pecaDesc).trim()}` : '';

  const row = document.createElement('div');
  row.className = 'cilia-serv-relac';
  row.dataset.servRelacionado = '1';
  row.dataset.ciliaPieceIndex = wrap.dataset.ciliaPieceIndex || '';
  row.dataset.pecaDesc = pecaDesc || '';
  row.dataset.pecaCodigo = pecaCodigo || '';
  row.dataset.tempaManual = servico?.tempaManual ? '1' : (itemTempa ? '' : '1');
  row.dataset.mecId = servico?.mecId || servico?.mecanicoId || servico?.responsavelId || '';
  row.dataset.mecNome = servico?.mecNome || servico?.mecanicoNome || servico?.responsavelNome || '';
  row._rateiosComissaoInicial = Array.isArray(servico?.rateiosComissao) ? servico.rateiosComissao : [];

  if (itemTempa) {
    const { secaoInfo } = _ciliaResolverValorHoraTempa(itemTempa, ctxBase);
    row.dataset.ciliaAutoTempa = '1';
    row.dataset.tempoTabela = String(itemTempa.tempo || '');
    row.dataset.codigoInterno = itemTempa.codigoInterno || '';
    row.dataset.codigoTabela = itemTempa.codigo || '';
    row.dataset.sistemaTabela = itemTempa.sistema || '';
    row.dataset.tipoVeiculoTabela = extrairTipoVeiculoTempaOS({ sistemaTabela: itemTempa.sistema, sistema: itemTempa.sistema }, ctxBase.veiculoAtual || window._osVeiculoAtual?.() || {});
    row.dataset.secaoHora = secaoInfo?.key || '';
    row.dataset.secaoHoraLabel = secaoInfo?.label || itemTempa.sistema || '';
    row.dataset.valorHoraSecao = secaoInfo?.valor || '';
  } else if (servico) {
    row.dataset.ciliaAutoTempa = servico.origemServico === 'cilia_tabela_tempa' ? '1' : '';
    row.dataset.tempoTabela = String(servico.tempoTabela || servico.tempo || '');
    row.dataset.codigoInterno = servico.codigoInterno || servico.codInterno || servico.codigoServicoInterno || '';
    row.dataset.codigoTabela = servico.codigoTabela || servico.codigo || '';
    row.dataset.sistemaTabela = servico.sistemaTabela || servico.sistema || '';
    row.dataset.tipoVeiculoTabela = servico.tipoVeiculoTabela || servico.tipoVeiculoTempa || extrairTipoVeiculoTempaOS(servico, ctxBase.veiculoAtual || window._osVeiculoAtual?.() || {});
    row.dataset.secaoHora = servico.secaoHora || '';
    row.dataset.secaoHoraLabel = servico.secaoHoraLabel || servico.sistemaTabela || '';
    row.dataset.valorHoraSecao = servico.valorHoraTabela || servico.valorHoraSecao || '';
    row.dataset.valorHoraManual = servico.valorHoraManual ? '1' : '';
    row.dataset.valorManual = servico.valorManual ? '1' : '';
  }

  row.style.cssText = 'display:grid;grid-template-columns:minmax(280px,1fr) 74px 104px 110px 90px 34px;gap:7px;align-items:center;margin-bottom:8px;background:rgba(0,0,0,0.16);border:1px solid rgba(0,212,255,0.14);border-radius:6px;padding:8px;';
  row.innerHTML = `
    <input type="text" class="j-input serv-desc" value="${_escVal(desc)}" placeholder="Digite o serviço: substituir, reparar, recondicionar, regular..." oninput="window._ciliaServicoEditado(this,'desc')" style="font-size:0.78rem;min-width:260px;">
    <input type="text" inputmode="decimal" class="j-input serv-tempo" value="${tempo ? tempo.toFixed(2).replace('.', ',') : '0,00'}" placeholder="h" title="Tempo/TMO" oninput="window._ciliaServicoEditado(this,'tempo')" style="font-size:0.78rem;text-align:center;">
    <input type="text" inputmode="decimal" class="j-input serv-valor-hora" value="${valorHora ? valorHora.toFixed(2).replace('.', ',') : '0,00'}" placeholder="R$/h" title="Valor hora" oninput="window._ciliaServicoEditado(this,'valorHora')" style="font-size:0.78rem;text-align:right;">
    <input type="text" inputmode="decimal" class="j-input serv-valor" value="${valor.toFixed(2).replace('.', ',')}" placeholder="R$" oninput="window._ciliaServicoEditado(this,'valor')" style="font-size:0.78rem;text-align:right;">
    <button type="button" onclick="window._ciliaPesquisarTempaServico(this)" style="background:rgba(0,212,255,0.10);border:1px solid var(--cyan);color:var(--cyan);border-radius:4px;cursor:pointer;height:34px;font-size:0.62rem;font-family:var(--fm);" title="Buscar serviço/TMO na Tabela Tempária">TEMPA</button>
    <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:4px;color:var(--danger);cursor:pointer;width:34px;height:34px;font-size:0.85rem;" title="Remover serviço">✕</button>
    <div style="grid-column:1/-1;display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:7px;align-items:start;">
      <input type="text" class="j-input serv-tempa-busca" value="${_escVal(desc || pecaDesc)}" placeholder="Pesquisar na Tempária pelo que você digitar: pastilha, recondicionar bomba, teste tanque..." oninput="window._ciliaAgendarBuscaTempaServico(this)" style="font-size:0.75rem;height:34px;width:100%;">
      <button type="button" class="serv-tempa-aplicar" onclick="window._ciliaAplicarTempaSelecionada(this)" style="display:none;align-items:center;justify-content:center;background:rgba(47,255,107,0.10);border:1px solid var(--success);color:var(--success);border-radius:4px;height:34px;font-size:0.62rem;font-family:var(--fm);cursor:pointer;padding:0 12px;white-space:nowrap;">APLICAR</button>
      <div class="serv-tempa-resultados-list" style="grid-column:1/-1;display:none;max-height:260px;overflow:auto;background:rgba(5,14,34,0.98);border:1px solid rgba(0,212,255,0.30);border-radius:6px;padding:5px;"></div>
    </div>
    <div class="serv-tempa-meta" style="grid-column:1/-1;font-family:var(--fm);font-size:0.60rem;letter-spacing:.4px;color:${metaTipo === 'ok' ? 'var(--success)' : 'var(--warn)'};">
      ${metaHTML}<span class="serv-desc-val" style="float:right;color:var(--ok);">R$ ${valor.toFixed(2).replace('.', ',')}</span>
    </div>
  `;
  list.appendChild(row);
  instalarDescontoIndividualLinhaOS(row, 'servico', descontoIndividualSalvoValorOS(servico, numBR(servico?.valorBruto || servico?.valor || valor || 0)));
  window.garantirResponsavelLinhaServicoOS?.(row, row.dataset.mecId || '');
  instalarTerceirizadoLinhaServicoOS(row, servico || {});
  if (!opts.auto && !opts.servico) {
    setTimeout(() => {
      const inp = row.querySelector('.serv-desc');
      inp?.focus();
      if (inp && !inp.value) window._ciliaAgendarBuscaTempaServico(inp);
    }, 50);
  }
  if (!opts.suprimirRecalculo && typeof window.calcOSTotal === 'function') window.calcOSTotal();
};

function _escVal(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── XML: estrutura esperada do Cília ──────────────────────────────────
// <Pecas><Peca><Codigo>XX</Codigo><Descricao>YY</Descricao><Quantidade>1</Quantidade><PrecoUnitario>100.00</PrecoUnitario></Peca></Pecas>
// Também tenta variações comuns de tag
function _ciliaProcessarXML(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(e.target.result, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

      const segmentos = Array.from(xml.querySelectorAll('segment')).map(n => n.textContent?.trim() || '').filter(Boolean);
      if (segmentos.length) {
        const pecasSegmentadas = OSU().parseCiliaPiecesFromTokens ? OSU().parseCiliaPiecesFromTokens(segmentos) : [];
        if (!pecasSegmentadas.length) throw new Error('Nenhuma peça encontrada nos segmentos do Cília.');
        _ciliaAdicionarPecas(pecasSegmentadas);
        return;
      }

      // Tenta vários nomes de tag de item
      const tagsCandidatas = ['Peca','peca','PECA','Item','item','ITEM','Produto','produto'];
      let nos = [];
      for (const tag of tagsCandidatas) {
        nos = Array.from(xml.querySelectorAll(tag));
        if (nos.length) break;
      }
      if (!nos.length) throw new Error('Nenhuma tag de peça reconhecida no XML. Verifique o arquivo Cília.');

      const pecas = nos.map(n => {
        const t = tag => n.querySelector(tag)?.textContent?.trim() || '';
        return {
          codigo: t('Codigo') || t('codigo') || t('CODIGO') || t('CodigoOEM') || t('codigoOem') || t('CodPeca') || '',
          desc:   t('Descricao') || t('descricao') || t('DESCRICAO') || t('Descr') || t('Nome') || t('nome') || '',
          qtd:    numBR(t('Quantidade') || t('quantidade') || t('Qtd') || t('qtd') || '1') || 1,
          venda:  numBR(t('PrecoUnitario') || t('precoUnitario') || t('Preco') || t('preco') || t('ValorUnitario') || '0') || 0
        };
      }).filter(p => p.desc || p.codigo);

      _ciliaAdicionarPecas(pecas);
    } catch(err) {
      if (typeof window.toast === 'function') window.toast('Erro ao ler XML Cília: ' + err.message, 'err');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ── PDF: extrai texto e tenta parsear tabela de peças ────────────────
// Requer pdf.js (CDN) — carrega dinamicamente se não estiver presente
async function _ciliaProcessarPDF(file) {
  if (typeof window.toast === 'function') window.toast('Lendo PDF do Cília...', 'warn');
  try {
    // Carrega pdf.js dinamicamente
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Coleta TODOS os spans com coordenadas X,Y de todas as páginas.
    const allSpans = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      tc.items.forEach(item => {
        if (item.str.trim()) {
          allSpans.push({
            text: item.str.trim(),
            page: i,
            x: Math.round(item.transform[4]),
            y: Math.round(item.transform[5])
          });
        }
      });
    }

    // Linha precisa ser agrupada por PÁGINA + Y. A versão anterior misturava
    // conteúdos de páginas diferentes quando possuíam a mesma coordenada Y.
    const linhasMap = new Map();
    allSpans.forEach(sp => {
      const yKey = Math.round(sp.y / 4) * 4;
      const key = `${sp.page}:${yKey}`;
      if (!linhasMap.has(key)) linhasMap.set(key, { page: sp.page, y: yKey, spans: [] });
      linhasMap.get(key).spans.push(sp);
    });
    const linhas = Array.from(linhasMap.values())
      .sort((a, b) => (a.page - b.page) || (b.y - a.y))
      .map(row => row.spans.sort((a, b) => a.x - b.x).map(sp => sp.text).join(' '));

    const tokensOrdenados = linhas.join(' ').split(/\s+/).filter(Boolean);
    const utils = OSU();
    const sane = lista => !utils.isSaneCiliaPieces || utils.isSaneCiliaPieces(lista || []);
    const declarado = Number(utils.getDeclaredCiliaItemCount?.(allSpans) || utils.getDeclaredCiliaItemCount?.(linhas) || 0);

    // Executa os parsers independentes e escolhe o candidato íntegro. Não aceita
    // mais silenciosamente uma extração parcial só porque as linhas encontradas parecem válidas.
    const candidatos = [
      { origem: 'coordenadas', prioridade: 3, itens: utils.parseCiliaPiecesFromSpans ? utils.parseCiliaPiecesFromSpans(allSpans) : [] },
      { origem: 'linhas', prioridade: 2, itens: utils.parseCiliaPiecesFromLines ? utils.parseCiliaPiecesFromLines(linhas) : [] },
      { origem: 'tokens', prioridade: 1, itens: utils.parseCiliaPiecesFromTokens ? utils.parseCiliaPiecesFromTokens(tokensOrdenados) : [] }
    ].filter(c => Array.isArray(c.itens) && c.itens.length && sane(c.itens));

    candidatos.sort((a, b) => {
      if (declarado > 0) {
        const aExato = a.itens.length === declarado ? 1 : 0;
        const bExato = b.itens.length === declarado ? 1 : 0;
        if (aExato !== bExato) return bExato - aExato;
        const da = Math.abs(a.itens.length - declarado);
        const db = Math.abs(b.itens.length - declarado);
        if (da !== db) return da - db;
      }
      if (a.itens.length !== b.itens.length) return b.itens.length - a.itens.length;
      return b.prioridade - a.prioridade;
    });

    let pecas = candidatos[0]?.itens || [];

    // Fallback legado preservado, usado apenas se os três parsers estruturados falharem.
    if (!pecas.length) {
      const brl = s => numBR(s);
      const legado = [];
      for (const linha of linhas) {
        const mPrincipal = linha.match(
          /(?:[TR](?:\s+R&I)?)\s+[\d,]+\s+([\d,.]+)\s+(.+?)\s+C.?d[:\.]\s*([A-Z0-9\-\.\/]+)\s+\w+\s+R\$\s*([\d\.,]+)\s+%\s*[\d,]+\s+R\$\s*([\d\.,]+)/i
        );
        if (mPrincipal) {
          legado.push({ codigo:mPrincipal[3].trim(), desc:mPrincipal[2].trim(), qtd:numBR(mPrincipal[1])||1, venda:brl(mPrincipal[4]), ciliaValorLiquido:brl(mPrincipal[5]) });
          continue;
        }
        const mSemOp = linha.match(/(.+?)\s+C.?d[:\.]\s*([A-Z0-9\-\.\/]+)\s+[\w\/]+\s+R\$\s*([\d\.,]+)\s+%\s*[\d,]+\s+R\$\s*([\d\.,]+)/i);
        if (mSemOp) legado.push({ codigo:mSemOp[2].trim(), desc:mSemOp[1].trim(), qtd:1, venda:brl(mSemOp[3]), ciliaValorLiquido:brl(mSemOp[4]) });
      }
      pecas = sane(legado) ? (utils.normalizeCiliaPieces ? utils.normalizeCiliaPieces(legado) : legado) : [];
    }

    if (!pecas.length || !sane(pecas)) {
      if (typeof window.toast === 'function') window.toast('Não foi possível extrair as peças do PDF Cília com segurança. Tente exportar o Cília em XML para melhor resultado.', 'warn');
      return;
    }

    if (declarado > 0 && pecas.length !== declarado) {
      console.error('[Cília PDF] Extração parcial bloqueada.', { declarado, extraido: pecas.length, candidatos: candidatos.map(c => ({ origem:c.origem, itens:c.itens.length })) });
      if (typeof window.toast === 'function') {
        window.toast(`PDF Cília declara ${declarado} item(ns), mas foram validados ${pecas.length}. Importação cancelada para não perder peça.`, 'err');
      }
      return;
    }

    console.info('[Cília PDF] Importação validada', { declarado: declarado || pecas.length, extraido: pecas.length, parser: candidatos[0]?.origem || 'legado' });
    _ciliaAdicionarPecas(pecas);
  } catch(err) {
    if (typeof window.toast === 'function') window.toast('Erro ao ler PDF Cília: ' + err.message, 'err');
    console.error('[Cília PDF]', err);
  }
}

// ============================================================
// UX O.S. CLIENTE COMUM / FROTISTA — LANÇAMENTO RÁPIDO DE PEÇAS
// Camada aditiva: não remove nem substitui o lançamento detalhado existente.
// Cliente oficial/governo é explicitamente excluído desta camada.
// ============================================================
(function instalarUsabilidadePecasClienteComumOS(){
  'use strict';

  function uxClienteAtualOS(){
    const id = document.getElementById('osCliente')?.value || '';
    return (window.J?.clientes || []).find(c => String(c.id) === String(id)) || null;
  }
  function uxVeiculoAtualOS(){
    const id = document.getElementById('osVeiculo')?.value || '';
    return (window.J?.veiculos || []).find(v => String(v.id) === String(id)) || null;
  }
  function uxClienteProtegidoOS(){
    const cli = uxClienteAtualOS();
    if (!cli) return false;
    return osClienteOficialSeguroOS({
      clienteId: cli.id,
      cliente: cli.nome,
      clienteNome: cli.nome,
      tipoCliente: cli.tipoCliente,
      clienteTipo: cli.clienteTipo,
      clienteOficial: cli.clienteOficial,
      orgaoPublico: cli.orgaoPublico,
      gov: cli.gov
    });
  }
  function uxFrotistaOS(cli){
    const c = cli || uxClienteAtualOS();
    return !!c && !uxClienteProtegidoOS() && (c.frotista === true || String(c.categoriaComercial || '').toLowerCase() === 'frotista');
  }
  function uxModeloKeyOS(v){
    const vei = v || uxVeiculoAtualOS() || {};
    return normalizarBuscaPecaOS([vei.marca, vei.modelo].filter(Boolean).join(' '));
  }
  function uxModeloLabelOS(v){
    const vei = v || uxVeiculoAtualOS() || {};
    return [vei.marca, vei.modelo].filter(Boolean).join(' ').trim() || vei.placa || 'veículo';
  }
  function uxTabelaPrecosOS(cli){
    const c = cli || uxClienteAtualOS();
    return Array.isArray(c?.tabelaPrecosOS) ? c.tabelaPrecosOS.slice() : [];
  }
  function uxPresetDoVeiculoOS(preset, veiculo){
    if (!preset) return false;
    const v = veiculo || uxVeiculoAtualOS();
    if (!v) return false;
    const key = uxModeloKeyOS(v);
    const pk = normalizarBuscaPecaOS(preset.veiculoModeloKey || preset.modeloKey || '');
    if (pk) return pk === key;
    if (preset.veiculoId) return String(preset.veiculoId) === String(v.id);
    return false;
  }
  function uxToastOS(msg, tipo){
    if (typeof window.toast === 'function') window.toast(msg, tipo || 'ok');
    else if (tipo === 'err') alert(msg);
  }
  function uxEscOS(v){
    return typeof escOS === 'function' ? escOS(v) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function uxDinheiroOS(v){
    return typeof moedaOS === 'function' ? moedaOS(v) : ('R$ ' + numBR(v || 0).toFixed(2).replace('.', ','));
  }
  function uxRemoverLinhaVaziaOS(){
    if (document.querySelector('#containerPecasOS .cilia-peca-wrap')) return;
    const rows = osRowsDiretas('containerPecasOS');
    const ultima = rows[rows.length - 1];
    if (ultima && !osPecaLinhaPreenchida(ultima) && !ultima.dataset.origemNFItemKey && !ultima.dataset.origemNFVinculada) ultima.remove();
  }
  function uxAcharEstoqueParaPresetOS(preset){
    const estoque = window.J?.estoque || [];
    const id = String(preset?.estoqueId || '');
    if (id) {
      const exato = estoque.find(p => String(p.id) === id && numBR(p.qtd || 0) > 0);
      if (exato) return exato;
    }
    const cod = normalizarBuscaPecaOS(preset?.codigo || '');
    const desc = normalizarBuscaPecaOS(preset?.descricao || preset?.desc || '');
    return estoque.find(p => {
      if (numBR(p?.qtd || 0) <= 0) return false;
      const pcod = normalizarBuscaPecaOS(codigoPecaEstoqueOS(p));
      const pdesc = normalizarBuscaPecaOS(p?.desc || p?.descricao || '');
      return (cod && pcod === cod) || (desc && pdesc && (pdesc === desc || pdesc.includes(desc) || desc.includes(pdesc)));
    }) || null;
  }

  function uxInstalarAcaoPrecoLinhaOS(row){
    if (!row || row.classList?.contains('cilia-peca-wrap')) return;
    const antiga = row.querySelector('.os-preco-frotista-acoes');
    const cli = uxClienteAtualOS();
    if (!uxFrotistaOS(cli) || uxClienteProtegidoOS()) {
      antiga?.remove();
      return;
    }
    if (antiga) return;
    const box = document.createElement('div');
    box.className = 'os-preco-frotista-acoes';
    box.style.cssText = 'grid-column:1/-1;display:flex;justify-content:flex-end;gap:7px;align-items:center;margin-top:2px;';
    box.innerHTML = `<span style="font-family:var(--fm);font-size:.59rem;color:var(--muted);">Preço do modelo ${uxEscOS(uxModeloLabelOS())}</span><button type="button" class="btn-outline os-salvar-preco-frota" style="padding:6px 9px;font-size:.6rem;">SALVAR PREÇO DO FROTISTA</button>`;
    box.querySelector('button')?.addEventListener('click', () => window.salvarPrecoFrotistaLinhaOS?.(row));
    row.appendChild(box);
  }

  function uxInstalarAcoesPrecosOS(){
    const cont = document.getElementById('containerPecasOS');
    if (!cont) return;
    Array.from(cont.children || []).forEach(uxInstalarAcaoPrecoLinhaOS);
  }

  async function uxPersistirTabelaOS(cli, tabela, mensagem){
    if (!cli || uxClienteProtegidoOS()) return false;
    try {
      await window.J.db.collection('clientes').doc(cli.id).update({
        tabelaPrecosOS: tabela,
        updatedAt: new Date().toISOString()
      });
      cli.tabelaPrecosOS = tabela;
      try { window.audit?.('CLIENTES', mensagem || `Atualizou tabela de preços do frotista ${cli.nome || cli.id}`); } catch (_) {}
      return true;
    } catch (e) {
      console.error('[OS UX Frotista] Falha ao salvar tabela', e);
      uxToastOS('Não foi possível salvar a tabela de preços do cliente.', 'err');
      return false;
    }
  }

  window.salvarPrecoFrotistaLinhaOS = async function(row){
    const cli = uxClienteAtualOS();
    const vei = uxVeiculoAtualOS();
    if (!cli || uxClienteProtegidoOS()) return;
    if (!uxFrotistaOS(cli)) {
      uxToastOS('Este recurso é exclusivo para cliente cadastrado como Frotista.', 'warn');
      return;
    }
    if (!vei) {
      uxToastOS('Selecione o veículo antes de salvar um preço do frotista.', 'warn');
      return;
    }
    if (!row) return;
    const sel = row.querySelector('.peca-sel');
    const opt = sel?.options?.[sel.selectedIndex];
    const estoqueId = sel?.value && sel.value !== '__avulsa__' ? sel.value : '';
    const descricao = descricaoPecaLinhaOS(row, opt, estoqueId) || row.querySelector('.peca-desc-livre')?.value?.trim() || '';
    const codigo = row.querySelector('.peca-codigo')?.value?.trim() || row.dataset.pecaCodigo || opt?.dataset?.codigo || '';
    const venda = numBR(row.querySelector('.peca-venda')?.value || 0);
    const custo = numBR(row.querySelector('.peca-custo')?.value || 0);
    const qtdPadrao = numBR(row.querySelector('.peca-qtd')?.value || 1) || 1;
    if ((!descricao && !codigo) || venda <= 0) {
      uxToastOS('Informe a peça e o valor de venda antes de salvar o preço do frotista.', 'warn');
      return;
    }
    const modeloKey = uxModeloKeyOS(vei);
    const codigoKey = normalizarBuscaPecaOS(codigo);
    const descricaoKey = normalizarBuscaPecaOS(descricao);
    const tabela = uxTabelaPrecosOS(cli);
    let idx = tabela.findIndex(p => {
      if (normalizarBuscaPecaOS(p.veiculoModeloKey || '') !== modeloKey) return false;
      const pc = normalizarBuscaPecaOS(p.codigo || '');
      const pd = normalizarBuscaPecaOS(p.descricao || p.desc || '');
      return (codigoKey && pc === codigoKey) || (!codigoKey && descricaoKey && pd === descricaoKey);
    });
    const anterior = idx >= 0 ? tabela[idx] : null;
    const registro = Object.assign({}, anterior || {}, {
      id: anterior?.id || ('tp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7)),
      veiculoModeloKey: modeloKey,
      veiculoModelo: uxModeloLabelOS(vei),
      veiculoIdReferencia: vei.id || '',
      codigo,
      descricao,
      venda,
      custo,
      qtdPadrao,
      estoqueId,
      updatedAt: new Date().toISOString(),
      createdAt: anterior?.createdAt || new Date().toISOString()
    });
    if (idx >= 0) tabela[idx] = registro;
    else tabela.push(registro);
    if (await uxPersistirTabelaOS(cli, tabela, `${idx >= 0 ? 'Atualizou' : 'Criou'} preço frotista ${descricao || codigo} / ${registro.veiculoModelo}`)) {
      uxToastOS(`${idx >= 0 ? 'Preço atualizado' : 'Preço salvo'} para ${registro.veiculoModelo}: ${descricao || codigo} — ${uxDinheiroOS(venda)}.`, 'ok');
      window.atualizarUsabilidadePecasOS?.();
    }
  };

  window.excluirPrecoFrotistaOS = async function(id){
    const cli = uxClienteAtualOS();
    if (!cli || !uxFrotistaOS(cli) || uxClienteProtegidoOS()) return;
    const tabela = uxTabelaPrecosOS(cli);
    const item = tabela.find(p => String(p.id) === String(id));
    if (!item) return;
    if (!window.confirm(`Excluir o preço pré-definido de "${item.descricao || item.codigo || 'peça'}"?`)) return;
    const nova = tabela.filter(p => String(p.id) !== String(id));
    if (await uxPersistirTabelaOS(cli, nova, `Excluiu preço frotista ${item.descricao || item.codigo || id}`)) {
      uxToastOS('Preço pré-definido removido.', 'ok');
      window.atualizarUsabilidadePecasOS?.();
    }
  };

  function uxAdicionarLinhaRapidaOS(item){
    if (!item || uxClienteProtegidoOS()) return;
    uxRemoverLinhaVaziaOS();
    let payload = null;
    if (item.tipo === 'estoque') {
      const p = item.item;
      payload = {
        estoqueId: p.id || '',
        codigo: codigoPecaEstoqueOS(p),
        codigoExibicao: codigoPecaEstoqueOS(p),
        desc: p.desc || p.descricao || '',
        descricaoExibicao: p.desc || p.descricao || '',
        qtd: 1,
        custo: valorCompraPecaEstoqueOS(p),
        venda: numBR(p.venda || p.precoVenda || 0),
        fornecedor: fornecedorPecaEstoqueOS(p),
        nf: nfPecaEstoqueOS(p),
        dataCompra: dataCompraPecaEstoqueOS(p),
        baixarEstoqueReal: true
      };
    } else if (item.tipo === 'preset') {
      const preset = item.item;
      const estoque = uxAcharEstoqueParaPresetOS(preset);
      if (estoque) {
        payload = {
          estoqueId: estoque.id || '',
          codigo: preset.codigo || codigoPecaEstoqueOS(estoque),
          codigoExibicao: preset.codigo || codigoPecaEstoqueOS(estoque),
          desc: preset.descricao || estoque.desc || estoque.descricao || '',
          descricaoExibicao: preset.descricao || estoque.desc || estoque.descricao || '',
          qtd: numBR(preset.qtdPadrao || 1) || 1,
          custo: numBR(preset.custo || valorCompraPecaEstoqueOS(estoque)),
          venda: numBR(preset.venda || 0),
          fornecedor: fornecedorPecaEstoqueOS(estoque),
          nf: nfPecaEstoqueOS(estoque),
          dataCompra: dataCompraPecaEstoqueOS(estoque),
          baixarEstoqueReal: true
        };
      } else {
        payload = {
          avulsa: true,
          codigo: preset.codigo || '',
          codigoExibicao: preset.codigo || '',
          desc: preset.descricao || '',
          descricaoExibicao: preset.descricao || '',
          qtd: numBR(preset.qtdPadrao || 1) || 1,
          custo: numBR(preset.custo || 0),
          venda: numBR(preset.venda || 0)
        };
      }
    } else if (item.tipo === 'avulsa') {
      payload = { avulsa: true, codigo: '', desc: item.descricao || '', qtd: 1, custo: 0, venda: 0 };
    }
    if (!payload) return;
    window.renderPecaOSRow?.(payload);
    window.calcOSTotal?.();
    setTimeout(() => {
      osGarantirProximaLinha('peca');
      uxInstalarAcoesPrecosOS();
      const busca = document.getElementById('osBuscaPecaRapidaUX');
      if (busca) busca.value = '';
      window.atualizarUsabilidadePecasOS?.();
    }, 20);
  }

  window.lancarPecaRapidaOS = function(chave){
    const item = window.__THIA_OS_UX_PECAS__?.get?.(String(chave));
    if (item) uxAdicionarLinhaRapidaOS(item);
  };

  function uxRenderResultadosOS(){
    const box = document.getElementById('osPecasRapidasResultadosUX');
    const input = document.getElementById('osBuscaPecaRapidaUX');
    if (!box || !input) return;
    if (uxClienteProtegidoOS()) { box.innerHTML = ''; return; }
    const termoRaw = String(input.value || '').trim();
    const termo = normalizarBuscaPecaOS(termoRaw);
    const cli = uxClienteAtualOS();
    const vei = uxVeiculoAtualOS();
    const presets = (uxFrotistaOS(cli) && vei ? uxTabelaPrecosOS(cli).filter(p => uxPresetDoVeiculoOS(p, vei)) : [])
      .filter(p => !termo || normalizarBuscaPecaOS([p.codigo, p.descricao, p.veiculoModelo].filter(Boolean).join(' ')).includes(termo))
      .slice(0, 12);
    const estoque = termo ? pecasEstoqueFiltradasOS(termoRaw, '', false).slice(0, 8) : [];
    const mapa = new Map();
    const partes = [];
    if (presets.length) {
      partes.push(`<div style="grid-column:1/-1;font-family:var(--fm);font-size:.59rem;letter-spacing:.08em;color:var(--ok);margin-top:2px;">PREÇOS PRÉ-DEFINIDOS — ${uxEscOS(uxModeloLabelOS(vei))}</div>`);
      presets.forEach((p, idx) => {
        const key = 'preset_' + idx;
        mapa.set(key, { tipo:'preset', item:p });
        const estoqueLigado = !!uxAcharEstoqueParaPresetOS(p);
        partes.push(`<div style="display:grid;grid-template-columns:1fr auto;gap:5px;min-width:0;"><button type="button" class="btn-outline" onclick="window.lancarPecaRapidaOS('${key}')" style="text-align:left;padding:8px 9px;min-width:0;border-color:rgba(34,197,94,.32);"><b>${uxEscOS(p.descricao || p.codigo || 'Peça')}</b><br><small style="color:var(--muted);">${uxEscOS(p.codigo || 'sem código')} • ${uxDinheiroOS(p.venda || 0)} • ${estoqueLigado ? 'estoque localizado' : 'avulsa automática'}</small></button><button type="button" class="btn-danger" onclick="window.excluirPrecoFrotistaOS('${uxEscOS(p.id)}')" title="Excluir preço pré-definido" style="padding:6px 8px;">×</button></div>`);
      });
    }
    if (estoque.length) {
      partes.push(`<div style="grid-column:1/-1;font-family:var(--fm);font-size:.59rem;letter-spacing:.08em;color:var(--cyan);margin-top:3px;">ESTOQUE ENCONTRADO</div>`);
      estoque.forEach((p, idx) => {
        const key = 'estoque_' + idx;
        mapa.set(key, { tipo:'estoque', item:p });
        partes.push(`<button type="button" class="btn-outline" onclick="window.lancarPecaRapidaOS('${key}')" style="text-align:left;padding:8px 9px;min-width:0;"><b>${uxEscOS(p.desc || p.descricao || codigoPecaEstoqueOS(p) || 'Peça')}</b><br><small style="color:var(--muted);">${uxEscOS(codigoPecaEstoqueOS(p) || 'sem código')} • saldo ${numBR(p.qtd || 0)} • ${uxDinheiroOS(p.venda || p.precoVenda || 0)}</small></button>`);
      });
    }
    if (termoRaw) {
      const key = 'avulsa';
      mapa.set(key, { tipo:'avulsa', descricao:termoRaw });
      partes.push(`<button type="button" class="btn-outline" onclick="window.lancarPecaRapidaOS('${key}')" style="text-align:left;padding:8px 9px;border-style:dashed;"><b>+ Lançar avulsa: ${uxEscOS(termoRaw)}</b><br><small style="color:var(--muted);">Cria a linha pronta para informar apenas o valor, sem procurar no estoque.</small></button>`);
    }
    window.__THIA_OS_UX_PECAS__ = mapa;
    box.innerHTML = partes.join('') || `<div style="grid-column:1/-1;color:var(--muted);font-size:.7rem;padding:5px 0;">${vei && uxFrotistaOS(cli) ? 'Nenhum preço pré-definido ainda para este modelo. Lance a peça uma vez e use “Salvar preço do frotista”.' : 'Digite uma peça, código, fornecedor ou NF para lançar sem navegar pelo estoque.'}</div>`;
  }

  function uxAtualizarContextoOS(){
    const contexto = document.getElementById('osPecasRapidasContextoUX');
    if (!contexto) return;
    const cli = uxClienteAtualOS();
    const vei = uxVeiculoAtualOS();
    const frotista = uxFrotistaOS(cli);
    contexto.innerHTML = [
      cli ? `<b>${uxEscOS(cli.nome || 'Cliente')}</b>` : 'Selecione o cliente',
      frotista ? '<span style="color:var(--ok);font-weight:700;">FROTISTA</span>' : 'cliente comum',
      vei ? uxEscOS([vei.modelo, vei.placa].filter(Boolean).join(' • ')) : 'selecione o veículo'
    ].join(' &nbsp;•&nbsp; ');
    uxRenderResultadosOS();
    uxInstalarAcoesPrecosOS();
  }

  window.atualizarUsabilidadePecasOS = function(){
    const cont = document.getElementById('containerPecasOS');
    if (!cont) return;
    let painel = document.getElementById('osPecasRapidasUX');
    const protegido = uxClienteProtegidoOS();
    const agrupadoCilia = !!cont.querySelector('.cilia-peca-wrap');
    if (protegido || agrupadoCilia) {
      painel?.remove();
      cont.querySelectorAll('.os-preco-frotista-acoes').forEach(el => el.remove());
      return;
    }
    if (!painel) {
      painel = document.createElement('div');
      painel.id = 'osPecasRapidasUX';
      painel.style.cssText = 'margin:0 0 12px;padding:12px;border:1px solid rgba(34,211,238,.22);background:linear-gradient(135deg,rgba(34,211,238,.045),rgba(34,197,94,.035));border-radius:8px;';
      painel.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px;">
          <div><div style="font-family:var(--fm);font-size:.7rem;font-weight:800;letter-spacing:.08em;">LANÇAMENTO RÁPIDO DE PEÇAS</div><div id="osPecasRapidasContextoUX" style="margin-top:3px;color:var(--muted);font-size:.67rem;"></div></div>
          <small style="color:var(--muted);max-width:390px;line-height:1.35;">Busca estoque e preços do frotista em um único campo. O lançamento detalhado atual continua disponível logo abaixo.</small>
        </div>
        <input id="osBuscaPecaRapidaUX" class="j-input" type="search" autocomplete="off" placeholder="Digite: filtro de óleo, pastilha, código, fornecedor ou NF..." style="width:100%;font-size:.84rem;min-height:44px;">
        <div id="osPecasRapidasResultadosUX" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:7px;margin-top:8px;"></div>`;
      cont.insertAdjacentElement('beforebegin', painel);
      painel.querySelector('#osBuscaPecaRapidaUX')?.addEventListener('input', uxRenderResultadosOS);
    }
    if (!cont.__thiaUxObserver) {
      cont.__thiaUxObserver = new MutationObserver(() => setTimeout(uxInstalarAcoesPrecosOS, 0));
      cont.__thiaUxObserver.observe(cont, { childList:true, subtree:false });
    }
    uxAtualizarContextoOS();
  };

  document.addEventListener('change', ev => {
    if (ev.target?.id === 'osCliente' || ev.target?.id === 'osVeiculo' || ev.target?.id === 'osTipoVeiculo') {
      setTimeout(() => window.atualizarUsabilidadePecasOS?.(), 0);
    }
  });

  if (typeof window.prepOS === 'function' && !window.prepOS.__thiaUxPecasClienteComum) {
    const originalPrepOSUX = window.prepOS;
    const wrappedPrepOSUX = function(){
      const retorno = originalPrepOSUX.apply(this, arguments);
      setTimeout(() => window.atualizarUsabilidadePecasOS?.(), 40);
      return retorno;
    };
    wrappedPrepOSUX.__thiaUxPecasClienteComum = true;
    wrappedPrepOSUX.__original = originalPrepOSUX;
    window.prepOS = wrappedPrepOSUX;
  }

  const iniciar = () => setTimeout(() => window.atualizarUsabilidadePecasOS?.(), 80);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
