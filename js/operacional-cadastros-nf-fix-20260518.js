/*
 * thIAguinho SaaS - hardening operacional 2026-05-18
 * Cadastro Brasil, fornecedor completo, edicao auditada de itens da NF
 * e bloqueio forte da Tabela Temparia quando o modulo estiver desligado.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const $ = id => D.getElementById(id);
  const val = id => ($(id)?.value || '').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const digits = v => typeof W.thiaOnlyDigits === 'function' ? W.thiaOnlyDigits(v) : String(v || '').replace(/\D/g, '');
  const num = v => {
    let s = String(v ?? '').trim().replace(/R\$|\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const moeda = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clone = obj => JSON.parse(JSON.stringify(obj || null));
  const J = () => W.J || {};
  const db = () => W.db || J().db || null;

  function toast(msg, type) {
    if (typeof W.toast === 'function') W.toast(msg, type || 'ok');
    else alert(String(msg).replace(/<[^>]+>/g, ''));
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
  }

  function fornecedorDocumento(f) {
    return f?.doc || f?.documento || f?.cpfCnpj || f?.cnpj || f?.cpf || '';
  }

  function fornecedorEndereco(f) {
    const e = f?.endereco && typeof f.endereco === 'object' ? f.endereco : {};
    return {
      cep: f?.cep || e.cep || '',
      rua: f?.rua || f?.logradouro || e.rua || e.logradouro || '',
      numero: f?.numero || f?.num || e.numero || e.nro || '',
      complemento: f?.complemento || e.complemento || '',
      bairro: f?.bairro || e.bairro || '',
      cidade: f?.cidade || f?.municipio || e.cidade || e.municipio || '',
      uf: f?.uf || e.uf || ''
    };
  }

  function ensureFornecedorModal() {
    const modal = $('modalFornec');
    const body = modal?.querySelector('.modal-body');
    const box = modal?.querySelector('.modal');
    if (!modal || !body || body.dataset.thiaCompleto === '1') return;
    if (box) box.style.maxWidth = '860px';
    body.dataset.thiaCompleto = '1';
    body.innerHTML = `
      <input type="hidden" id="fornecId">
      <div class="form-row cols-2">
        <div class="form-group"><label class="j-label">Razão Social / Nome</label><input class="j-input" id="fornecNome" placeholder="Distribuidora ABC Ltda."></div>
        <div class="form-group"><label class="j-label">Nome Fantasia</label><input class="j-input" id="fornecFantasia" placeholder="Nome comercial"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">CPF/CNPJ</label><input class="j-input" id="fornecDoc" inputmode="numeric" placeholder="00.000.000/0000-00"></div>
        <div class="form-group"><label class="j-label">Inscrição Estadual</label><input class="j-input" id="fornecIE" placeholder="Isento ou número"></div>
        <div class="form-group"><label class="j-label">Segmento</label><input class="j-input" id="fornecSeg" placeholder="Peças, óleo, elétrica..."></div>
        <div class="form-group"><label class="j-label">Contato</label><input class="j-input" id="fornecContato" placeholder="Nome do vendedor"></div>
      </div>
      <div id="fornecDocStatus" style="display:none;font-family:var(--fm);font-size:.68rem;margin:-4px 0 8px;"></div>
      <div class="form-row cols-3">
        <div class="form-group"><label class="j-label">Telefone</label><input class="j-input" id="fornecTelefone" inputmode="numeric" placeholder="(17) 3000-0000"></div>
        <div class="form-group"><label class="j-label">WhatsApp</label><input class="j-input" id="fornecWpp" inputmode="numeric" placeholder="(17) 99999-9999"></div>
        <div class="form-group"><label class="j-label">E-mail</label><input class="j-input" id="fornecEmail" type="email" placeholder="financeiro@fornecedor.com.br"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">CEP</label><input class="j-input" id="fornecCep" inputmode="numeric" placeholder="00000-000"></div>
        <div class="form-group" style="grid-column:span 2;"><label class="j-label">Endereço</label><input class="j-input" id="fornecRua" placeholder="Rua / avenida"></div>
        <div class="form-group"><label class="j-label">Número</label><input class="j-input" id="fornecNumero" inputmode="numeric" placeholder="Nº"></div>
      </div>
      <div class="form-row cols-4">
        <div class="form-group"><label class="j-label">Complemento</label><input class="j-input" id="fornecComplemento" placeholder="Sala, bloco..."></div>
        <div class="form-group"><label class="j-label">Bairro</label><input class="j-input" id="fornecBairro"></div>
        <div class="form-group"><label class="j-label">Cidade</label><input class="j-input" id="fornecCidade"></div>
        <div class="form-group"><label class="j-label">UF</label><input class="j-input" id="fornecUf" maxlength="2" placeholder="SP"></div>
      </div>
      <div class="form-group"><label class="j-label">Observações / condições comerciais</label><textarea class="j-textarea" id="fornecObs" rows="2" placeholder="Prazo, tabela, contato financeiro, restrições..."></textarea></div>`;
    W.thiaInstalarMascarasBrasil?.();
  }

  function ensureFornecedorTableHeader() {
    const tb = $('tbFornec');
    const table = tb?.closest('table');
    const head = table?.querySelector('thead tr');
    if (head && head.dataset.thiaCompleto !== '1') {
      head.dataset.thiaCompleto = '1';
      head.innerHTML = '<th>Razão Social</th><th>Documento / Contato</th><th>Endereço</th><th>Ações</th>';
    }
  }

  function prepFornecCompleto(mode, id) {
    ensureFornecedorModal();
    if (arguments.length === 1 && mode && mode !== 'add' && mode !== 'edit') { id = mode; mode = 'edit'; }
    const campos = ['fornecId','fornecNome','fornecFantasia','fornecDoc','fornecIE','fornecSeg','fornecContato','fornecTelefone','fornecWpp','fornecEmail','fornecCep','fornecRua','fornecNumero','fornecComplemento','fornecBairro','fornecCidade','fornecUf','fornecObs'];
    campos.forEach(k => setValue(k, ''));
    const status = $('fornecDocStatus');
    if (status) { status.style.display = 'none'; status.textContent = ''; }
    if ((mode === 'edit' || id) && id) {
      const f = (J().fornecedores || []).find(x => String(x.id) === String(id));
      if (!f) return;
      const e = fornecedorEndereco(f);
      setValue('fornecId', f.id);
      setValue('fornecNome', f.razaoSocial || f.razao || f.nome || '');
      setValue('fornecFantasia', f.fantasia || f.nomeFantasia || '');
      setValue('fornecDoc', fornecedorDocumento(f));
      setValue('fornecIE', f.ie || f.inscricaoEstadual || '');
      setValue('fornecSeg', f.segmento || '');
      setValue('fornecContato', f.contato || f.responsavel || '');
      setValue('fornecTelefone', f.telefone || '');
      setValue('fornecWpp', f.wpp || f.whatsapp || '');
      setValue('fornecEmail', f.email || '');
      setValue('fornecCep', e.cep);
      setValue('fornecRua', e.rua);
      setValue('fornecNumero', e.numero);
      setValue('fornecComplemento', e.complemento);
      setValue('fornecBairro', e.bairro);
      setValue('fornecCidade', e.cidade);
      setValue('fornecUf', e.uf);
      setValue('fornecObs', f.obs || f.observacoes || '');
    }
    W.thiaInstalarMascarasBrasil?.();
  }

  async function salvarFornecCompleto() {
    ensureFornecedorModal();
    const nome = val('fornecNome');
    if (!nome) { toast('Informe a razão social/nome do fornecedor.', 'warn'); return; }
    const id = val('fornecId');
    const doc = val('fornecDoc');
    const docLimpo = digits(doc);
    if (docLimpo && !(W.thiaValidarCpfCnpj ? W.thiaValidarCpfCnpj(doc) : true)) {
      toast('CPF/CNPJ do fornecedor inválido. Corrija antes de salvar.', 'warn');
      $('fornecDoc')?.focus();
      return;
    }
    if (docLimpo && W.thiaDocumentoExiste?.(J().fornecedores || [], doc, id)) {
      toast('Já existe fornecedor cadastrado com este CPF/CNPJ.', 'warn');
      $('fornecDoc')?.focus();
      return;
    }
    const tipoDoc = docLimpo.length === 14 ? 'cnpj' : (docLimpo.length === 11 ? 'cpf' : '');
    const endereco = {
      cep: val('fornecCep'),
      rua: val('fornecRua'),
      logradouro: val('fornecRua'),
      numero: val('fornecNumero'),
      complemento: val('fornecComplemento'),
      bairro: val('fornecBairro'),
      cidade: val('fornecCidade'),
      municipio: val('fornecCidade'),
      uf: val('fornecUf').toUpperCase()
    };
    const payload = {
      tenantId: J().tid,
      nome,
      razao: nome,
      razaoSocial: nome,
      fantasia: val('fornecFantasia'),
      nomeFantasia: val('fornecFantasia'),
      segmento: val('fornecSeg'),
      contato: val('fornecContato'),
      telefone: val('fornecTelefone') || val('fornecWpp'),
      wpp: val('fornecWpp') || val('fornecTelefone'),
      whatsapp: val('fornecWpp') || val('fornecTelefone'),
      email: val('fornecEmail'),
      doc,
      documento: doc,
      cpfCnpj: doc,
      docLimpo,
      cpfCnpjLimpo: docLimpo,
      tipoDoc,
      cnpj: tipoDoc === 'cnpj' ? doc : '',
      cpf: tipoDoc === 'cpf' ? doc : '',
      ie: val('fornecIE'),
      inscricaoEstadual: val('fornecIE'),
      ...endereco,
      endereco,
      obs: val('fornecObs'),
      observacoes: val('fornecObs'),
      updatedAt: new Date().toISOString()
    };
    if (!db()) { toast('Banco de dados ainda não carregado.', 'warn'); return; }
    try {
      if (id) await db().collection('fornecedores').doc(id).update(payload);
      else await db().collection('fornecedores').add(Object.assign(payload, { createdAt: new Date().toISOString() }));
      W.audit?.('FORNECEDORES', `${id ? 'Editou' : 'Cadastrou'} fornecedor ${nome}`, { fornecedorId: id || '', documento: docLimpo });
      toast('Fornecedor salvo com cadastro completo.', 'ok');
      W.fecharModal?.('modalFornec');
    } catch (e) {
      toast('Erro ao salvar fornecedor: ' + (e.message || e), 'err');
    }
  }

  function renderFornecedoresCompleto() {
    ensureFornecedorTableHeader();
    const tb = $('tbFornec');
    if (!tb) return;
    tb.innerHTML = (J().fornecedores || []).map(f => {
      const e = fornecedorEndereco(f);
      const doc = fornecedorDocumento(f);
      const contato = [f.contato, f.wpp || f.whatsapp || f.telefone, f.email].filter(Boolean).join(' | ');
      const end = [e.rua, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(', ');
      return `<tr>
        <td><strong>${esc(f.razaoSocial || f.razao || f.nome || '-')}</strong><br><small>${esc(f.fantasia || f.nomeFantasia || f.segmento || '')}</small></td>
        <td>${esc(doc || '-')}<br><small>${esc(contato || '-')}</small></td>
        <td>${esc(end || '-')}<br><small>${esc(e.cep || '')}</small></td>
        <td><button class="btn-ghost" onclick="window.prepFornec('edit','${esc(f.id)}');abrirModal('modalFornec')">EDITAR</button><button class="btn-danger" onclick="window.excluirFornecedorDef && window.excluirFornecedorDef('${esc(f.id)}')" style="margin-left:4px;">EXCLUIR</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:18px;">Nenhum fornecedor cadastrado</td></tr>';
  }

  function validarDocumentoClienteAntesSalvar() {
    const doc = val('cliDoc');
    const id = val('cliId');
    if (!doc) return true;
    if (W.thiaValidarCpfCnpj && !W.thiaValidarCpfCnpj(doc)) {
      toast('CPF/CNPJ do cliente inválido. Corrija antes de salvar.', 'warn');
      $('cliDoc')?.focus();
      return false;
    }
    if (W.thiaDocumentoExiste?.(J().clientes || [], doc, id)) {
      toast('Já existe cliente cadastrado com este CPF/CNPJ.', 'warn');
      $('cliDoc')?.focus();
      return false;
    }
    return true;
  }

  function wrapClienteSave() {
    if (typeof W.salvarCliente !== 'function' || W.salvarCliente.__thiaDocWrap) return;
    const old = W.salvarCliente;
    W.salvarCliente = async function () {
      if (!validarDocumentoClienteAntesSalvar()) return;
      return old.apply(this, arguments);
    };
    W.salvarCliente.__thiaDocWrap = true;
  }

  function ensureNFEditBox() {
    const modal = $('modalNF');
    if (!modal || $('nfEditId')) return;
    const container = modal.querySelector('.modal-body');
    const anchor = $('containerItensNF')?.parentElement;
    if (!container || !anchor) return;
    anchor.insertAdjacentHTML('beforebegin', `
      <input type="hidden" id="nfEditId">
      <input type="hidden" id="nfEditCollection" value="notas_fiscais_entrada">
      <div id="nfEditBox" style="display:none;border:1px solid rgba(255,184,0,.35);background:rgba(255,184,0,.08);border-radius:4px;padding:12px;margin-bottom:12px;">
        <div style="font-family:var(--fd);font-weight:800;color:var(--warn);margin-bottom:8px;">EDIÇÃO AUDITADA DE NOTA FISCAL</div>
        <div id="nfEditResumo" style="font-family:var(--fm);font-size:.70rem;color:var(--muted2);margin-bottom:8px;"></div>
        <div class="form-group"><label class="j-label">Justificativa obrigatória</label><textarea class="j-textarea" id="nfEditJust" rows="2" placeholder="Ex: item lançado em duplicidade, código corrigido após conferência, devolução parcial..."></textarea></div>
      </div>`);
  }

  function setNFSavingMode(editing) {
    const modal = $('modalNF');
    const btn = modal?.querySelector('.modal-foot .btn-primary:last-child');
    if (btn) btn.textContent = editing ? 'SALVAR EDIÇÃO AUDITADA' : 'FINALIZAR ENTRADA';
  }

  function collectItensNFEdit() {
    if (typeof W.thiaNFCollectItens === 'function') {
      try {
        const stamp = Date.now();
        return (W.thiaNFCollectItens() || []).map((it, idx) => {
          const existente = it?.itemFiscalIndex ?? it?.itemIndex;
          const itemFiscalIndex = existente !== undefined && existente !== null && existente !== '' ? existente : `edit_${stamp}_${idx}`;
          return Object.assign({}, it, { itemFiscalIndex, itemIndex: itemFiscalIndex });
        });
      } catch (e) { toast(e.message || String(e), 'warn'); return []; }
    }
    return Array.from(D.querySelectorAll('#containerItensNF .nf-real-row')).map(row => {
      let base = {};
      try { base = JSON.parse(row.querySelector('.nf-json')?.value || '{}'); } catch (_) { base = {}; }
      const osSel = row.querySelector('.nf-os-select');
      const osId = osSel?.value || '';
      const osOpt = osSel?.selectedOptions?.[0];
      const qtd = num(row.querySelector('.nf-qtd')?.value);
      const custo = num(row.querySelector('.nf-custo')?.value);
      const descValor = num(row.querySelector('.nf-descvalor')?.value);
      return Object.assign({}, base, {
        codigoFornecedor: row.querySelector('.nf-codforn')?.value || base.codigoFornecedor || base.codigo || '',
        codigoComercial: row.querySelector('.nf-codigo')?.value || base.codigoComercial || base.oem || '',
        codigo: row.querySelector('.nf-codforn')?.value || base.codigo || '',
        oem: row.querySelector('.nf-codigo')?.value || base.oem || '',
        descricao: row.querySelector('.nf-desc')?.value || base.descricao || base.desc || '',
        desc: row.querySelector('.nf-desc')?.value || base.descricao || base.desc || '',
        marca: row.querySelector('.nf-marca')?.value || base.marca || '',
        quantidade: qtd,
        qtd,
        valorUnitario: custo,
        custo,
        desconto: descValor,
        venda: num(row.querySelector('.nf-venda')?.value),
        ean: row.querySelector('.nf-ean')?.value || base.ean || '',
        ncm: row.querySelector('.nf-ncm-input')?.value || base.ncm || '',
        cfop: row.querySelector('.nf-cfop-input')?.value || base.cfop || '',
        cest: row.querySelector('.nf-cest-input')?.value || base.cest || '',
        destino: row.querySelector('.nf-finalidade')?.value || base.destino || 'estoque',
        finalidade: row.querySelector('.nf-finalidade')?.value || base.finalidade || 'estoque',
        osId,
        placa: osOpt?.dataset?.placa || base.placa || '',
        vinculo: row.querySelector('.nf-vinculo')?.value || osId || base.vinculo || '',
        valorLiquido: Math.max(qtd * custo - descValor, 0)
      });
    }).filter(x => x.descricao).map((it, idx) => {
      const existente = it?.itemFiscalIndex ?? it?.itemIndex;
      const itemFiscalIndex = existente !== undefined && existente !== null && existente !== '' ? existente : `edit_${Date.now()}_${idx}`;
      return Object.assign({}, it, { itemFiscalIndex, itemIndex: itemFiscalIndex });
    });
  }

  function itemKeyNF(item, idx) {
    const itemIndex = item?.itemFiscalIndex ?? item?.itemIndex;
    if (itemIndex !== undefined && itemIndex !== null && itemIndex !== '') return `idx:${String(itemIndex)}`;
    const numeroItem = item?.nItem || item?.numeroItem || item?.item;
    if (numeroItem !== undefined && numeroItem !== null && numeroItem !== '') return `nitem:${String(numeroItem)}`;
    if (item?.origemNFItemKey) return `origem:${String(item.origemNFItemKey)}`;
    return `fallback:${idx}:${String(item?.codigoFornecedor || item?.codigo || '')}:${String(item?.descricao || item?.desc || '')}`;
  }

  function resumoDiffItensNF(antes, depois) {
    const a = Array.isArray(antes) ? antes : [];
    const d = Array.isArray(depois) ? depois : [];
    const campos = ['codigoFornecedor','codigoComercial','codigo','oem','descricao','marca','quantidade','quantidadeFiscal','quantidadeOperacional','fatorOperacional','valorUnitario','desconto','venda','ean','ncm','cfop','cest','destino','finalidade','osId','placa','vinculo','destinosOperacionais','destinos'];
    const mapA = new Map(a.map((it, idx) => [itemKeyNF(it, idx), it]));
    const mapD = new Map(d.map((it, idx) => [itemKeyNF(it, idx), it]));
    const excluidos = [];
    const incluidos = [];
    const alterados = [];
    mapA.forEach((it, key) => { if (!mapD.has(key)) excluidos.push(it); });
    mapD.forEach((it, key) => {
      if (!mapA.has(key)) { incluidos.push(it); return; }
      const old = mapA.get(key);
      const mudou = campos.some(c => {
        const a = old?.[c];
        const b = it?.[c];
        const sa = (a && typeof a === 'object') ? JSON.stringify(a) : String(a ?? '');
        const sb = (b && typeof b === 'object') ? JSON.stringify(b) : String(b ?? '');
        return sa !== sb;
      });
      if (mudou) alterados.push({ antes: old, depois: it });
    });
    return { excluidos, incluidos, alterados };
  }

  const normNF = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function cargoPodeExcluirNF() {
    const cargo = normNF(J().cargo || sessionStorage.getItem('j_cargo') || J().role || sessionStorage.getItem('j_role') || '');
    return /superadmin|admin|dono|proprietario|owner|gerente|gestor/.test(cargo);
  }

  function itemTextoChave(it) {
    return [it?.codigoFornecedor, it?.codigoComercial, it?.codigo, it?.oem, it?.ean, it?.descricao, it?.desc].map(normNF).filter(Boolean).join('|');
  }

  function itemCombina(a, b) {
    const codA = normNF(a?.codigoFornecedor || a?.codigo || a?.codigoComercial || a?.oem || a?.ean || '');
    const codB = normNF(b?.codigoFornecedor || b?.codigo || b?.codigoComercial || b?.oem || b?.ean || '');
    const descA = normNF(a?.descricao || a?.desc || '');
    const descB = normNF(b?.descricao || b?.desc || '');
    if (codA && codB && codA === codB) return true;
    if (descA && descB && descA === descB) return true;
    return itemTextoChave(a) && itemTextoChave(a) === itemTextoChave(b);
  }

  async function carregarVinculosNF(nfId, nf) {
    const porId = new Map();
    (J().nfItensVinculos || [])
      .filter(v => String(v.nfId || '') === String(nfId) || (nf?.chave && v.chave === nf.chave) || (nf?.numero && String(v.nfNumero || '') === String(nf.numero)))
      .forEach(v => porId.set(v.id || itemTextoChave(v), v));
    try {
      const snap = await db().collection('nf_itens_vinculos').where('tenantId', '==', J().tid).where('nfId', '==', nfId).get();
      snap.forEach(doc => porId.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (_) {}
    return Array.from(porId.values());
  }

  async function carregarFinanceiroNF(nfId, nf) {
    const porId = new Map();
    (J().financeiro || [])
      .filter(f => String(f.notaFiscalId || f.nfId || '') === String(nfId) || (nf?.chave && f.chaveNFe === nf.chave) || (nf?.numero && String(f.desc || '').includes('NF ' + nf.numero)))
      .forEach(f => porId.set(f.id || f.desc || Math.random(), f));
    try {
      const snap = await db().collection('financeiro').where('tenantId', '==', J().tid).where('notaFiscalId', '==', nfId).get();
      snap.forEach(doc => porId.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (_) {}
    return Array.from(porId.values());
  }

  function formaFinanceiraNormNF(v) {
    return normNF(v).replace(/cartao/g, 'cartao');
  }

  function formaFinanceiraAVistaNF(forma) {
    const f = formaFinanceiraNormNF(forma);
    return f.includes('dinheiro') || f.includes('pix') || f.includes('debito');
  }

  function formaFinanceiraParcelavelNF(forma) {
    const f = formaFinanceiraNormNF(forma);
    return f.includes('boleto') || f.includes('parcelado') || f.includes('credito');
  }

  function formaFinanceiraAgrupadaNF(forma) {
    return formaFinanceiraNormNF(forma).includes('agrupamento');
  }

  function tituloFinanceiroNFOperacional(f) {
    const texto = normNF([f?.status, f?.pgto, f?.desc].filter(Boolean).join(' '));
    if (texto.includes('ajuste auditado') || texto.includes('abatimento devolucao')) return false;
    if (texto.includes('cancelado por edicao') || texto.includes('excluido')) return false;
    return true;
  }

  function ordenaTitulosFinanceirosNF(a, b) {
    const pa = Number(a?.numeroParcela || a?.parcela || String(a?.desc || '').match(/\((\d+)\/\d+\)/)?.[1] || 0) || 0;
    const pb = Number(b?.numeroParcela || b?.parcela || String(b?.desc || '').match(/\((\d+)\/\d+\)/)?.[1] || 0) || 0;
    return (pa - pb) || String(a?.venc || '').localeCompare(String(b?.venc || ''));
  }

  function normalizarParcelasFinanceirasNF(parcelas, totalNF, forma) {
    const total = Math.round((Number(totalNF || 0) || 0) * 100) / 100;
    let arr = (Array.isArray(parcelas) ? parcelas : [])
      .map((p, idx) => ({
        numero: p.numero || String(idx + 1).padStart(3, '0'),
        vencimento: p.vencimento || p.venc || hojeISOEdicao(),
        valor: Math.round((Number(p.valor || 0) || 0) * 100) / 100
      }))
      .filter(p => p.valor > 0 || p.vencimento);
    if (!arr.length) arr = [{ numero: '001', vencimento: val('nfVenc') || hojeISOEdicao(), valor: total }];
    if (formaFinanceiraAVistaNF(forma)) arr = [{ numero: '001', vencimento: val('nfVenc') || arr[0]?.vencimento || hojeISOEdicao(), valor: total }];
    const soma = Math.round(arr.reduce((s, p) => s + (Number(p.valor) || 0), 0) * 100) / 100;
    const diff = Math.round((total - soma) * 100) / 100;
    if (arr.length && Math.abs(diff) >= 0.01) {
      arr[arr.length - 1].valor = Math.round(((Number(arr[arr.length - 1].valor) || 0) + diff) * 100) / 100;
      arr[arr.length - 1].ajusteAutomaticoEdicaoNF = diff;
    }
    return arr;
  }

  function financeiroTelaEdicaoNF(antes, novoTotal, titulosOriginais) {
    const forma = val('nfPgtoForma') || titulosOriginais?.[0]?.pgto || 'Dinheiro';
    const formaAgrupada = formaFinanceiraAgrupadaNF(forma);
    const formaAVista = formaFinanceiraAVistaNF(forma);
    const fornecedorNome = antes?.fornecedorSnapshot?.nome || antes?.fornecedorNome || '';
    const base = {
      forma,
      formaAgrupada,
      formaAVista,
      status: formaAVista ? 'Pago' : (formaAgrupada ? 'Aguardando boleto agrupado' : 'Pendente'),
      fornecedorNome
    };
    if (formaAgrupada) {
      const venc = val('nfAgrVenc') || val('nfVenc') || hojeISOEdicao();
      return Object.assign(base, {
        parcelas: [{
          numero: '001',
          vencimento: venc,
          valor: Math.round((Number(novoTotal || 0) || 0) * 100) / 100,
          agrupamentoDias: Math.max(1, parseInt(val('nfAgrPeriodoDias') || '7', 10) || 7)
        }]
      });
    }
    const parcelasTela = typeof W.thiaNFCollectParcelas === 'function' ? W.thiaNFCollectParcelas() : [];
    const parcelas = formaFinanceiraParcelavelNF(forma) && !formaAVista
      ? normalizarParcelasFinanceirasNF(parcelasTela, novoTotal, forma)
      : normalizarParcelasFinanceirasNF([{ numero: '001', vencimento: val('nfVenc') || hojeISOEdicao(), valor: novoTotal }], novoTotal, forma);
    return Object.assign(base, { parcelas });
  }

  async function preencherFinanceiroEdicaoNF(nfId, nf) {
    const titulos = (await carregarFinanceiroNF(nfId, nf)).filter(tituloFinanceiroNFOperacional).sort(ordenaTitulosFinanceirosNF);
    W._thiaNfEditFinanceiroBefore = clone(titulos);
    if (!titulos.length) return;
    const primeiro = titulos[0] || {};
    const forma = primeiro.agrupamentoPeriodo ? 'AgrupamentoPeriodo' : (primeiro.pgto || 'Dinheiro');
    setValue('nfPgtoForma', forma);
    setValue('nfVenc', String(primeiro.venc || '').slice(0, 10));
    if (primeiro.agrupamentoPeriodo) {
      setValue('nfAgrPeriodoDias', primeiro.agrupamentoDias || '');
      setValue('nfAgrVenc', String(primeiro.agrupamentoVencimentoPrevisto || primeiro.venc || '').slice(0, 10));
      return;
    }
    const parcelas = titulos.map((f, idx) => ({
      numero: f.numeroParcela || f.parcela || String(idx + 1).padStart(3, '0'),
      vencimento: String(f.venc || '').slice(0, 10),
      valor: Number(f.valor || 0) || 0
    }));
    if (typeof W.thiaNFRenderParcelas === 'function' && (parcelas.length > 1 || formaFinanceiraParcelavelNF(forma))) {
      W.thiaNFRenderParcelas(parcelas, { manual: true });
    }
  }

  function estoqueAtualPorVinculo(v) {
    return (J().estoque || []).find(p => String(p.id || '') === String(v.estoqueId || ''))
      || (J().estoque || []).find(p => normNF(p.codigo || p.codigoFornecedor || p.oem || '') && normNF(p.codigo || p.codigoFornecedor || p.oem || '') === normNF(v.codigo || v.codigoFornecedor || v.codigoComercial || ''));
  }

  function atualizarPecasReaisOSBatch(batch, nfId, itensAlvo, motivo, tipo) {
    const alvo = Array.isArray(itensAlvo) ? itensAlvo : [];
    if (!alvo.length) return { os: 0, pecas: 0 };
    let osAfetadas = 0;
    let pecasAfetadas = 0;
    (J().os || []).forEach(os => {
      const pecas = Array.isArray(os.pecasReais) ? os.pecasReais.slice() : [];
      if (!pecas.length) return;
      let mudou = false;
      let novas = pecas;
      if (tipo === 'remover') {
        novas = pecas.filter(p => {
          const retirar = String(p.nfId || '') === String(nfId) && alvo.some(it => itemCombina(p, it));
          if (retirar) { mudou = true; pecasAfetadas += 1; }
          return !retirar;
        });
      } else if (tipo === 'atualizar') {
        novas = pecas.map(p => {
          if (String(p.nfId || '') !== String(nfId)) return p;
          const alt = alvo.find(a => itemCombina(p, a.antes || a.depois || a));
          if (!alt) return p;
          mudou = true;
          pecasAfetadas += 1;
          const depois = alt.depois || alt;
          return Object.assign({}, p, {
            desc: depois.descricao || depois.desc || p.desc,
            descricao: depois.descricao || depois.desc || p.descricao,
            codigo: depois.codigo || depois.codigoFornecedor || p.codigo,
            codigoFornecedor: depois.codigoFornecedor || depois.codigo || p.codigoFornecedor,
            qtd: Number(depois.quantidade || depois.qtd || p.qtd || 1) || 1,
            custo: Number(depois.valorUnitario || depois.custo || p.custo || 0) || 0,
            total: Number(depois.valorLiquido || depois.total || p.total || 0) || 0,
            ajusteEdicaoNF: true,
            ajusteEdicaoNFEm: new Date().toISOString()
          });
        });
      }
      if (!mudou) return;
      osAfetadas += 1;
      const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
      timeline.push({
        ts: Date.now(),
        por: J().nome || 'Sistema',
        msg: tipo === 'remover' ? `Peca(s) removida(s) por edicao auditada da NF. Motivo: ${motivo}` : `Peca(s) atualizada(s) por edicao auditada da NF. Motivo: ${motivo}`,
        tipo: 'edicao_nf_peca_real',
        nfId
      });
      batch.update(db().collection('ordens_servico').doc(os.id), { pecasReais: novas, timeline, updatedAt: new Date().toISOString() });
      os.pecasReais = novas;
      os.timeline = timeline;
    });
    return { os: osAfetadas, pecas: pecasAfetadas };
  }

  function vinculoAtivoEdicaoNF(v) {
    const status = normNF([v?.status, v?.situacao, v?.statusVinculo].filter(Boolean).join(' '));
    return !/cancelad|excluid|estornad|devolvid/.test(status);
  }

  function indexItemEdicaoNF(item) {
    const v = item?.itemFiscalIndex ?? item?.itemIndex;
    return v !== undefined && v !== null && v !== '' ? String(v) : '';
  }

  function numeroItemEdicaoNF(item) {
    const v = item?.numeroItem ?? item?.nItem ?? item?.item;
    return v !== undefined && v !== null && v !== '' ? String(v) : '';
  }

  function destinosItemEdicaoNF(item) {
    if (!item) return [];
    let arr = [];
    try {
      if (typeof W.thiaNFExpandirItensPorDestino === 'function') arr = W.thiaNFExpandirItensPorDestino([item]) || [];
    } catch (_) { arr = []; }
    if (!arr.length) {
      const src = Array.isArray(item.destinosOperacionais) ? item.destinosOperacionais : (Array.isArray(item.destinos) ? item.destinos : []);
      if (src.length) arr = src.map(d => Object.assign({}, item, d));
      else arr = [Object.assign({}, item, { qtd: Number(item.quantidadeOperacional || item.qtdOperacional || item.quantidade || item.qtd || 0) || 0 })];
    }
    const idxItem = item?.itemFiscalIndex ?? item?.itemIndex;
    return arr.map((d, idx) => Object.assign({}, item, d, {
      itemFiscalIndex: idxItem !== undefined && idxItem !== null && idxItem !== '' ? idxItem : d.itemFiscalIndex,
      itemIndex: idxItem !== undefined && idxItem !== null && idxItem !== '' ? idxItem : d.itemIndex,
      destinoIndice: d.destinoIndice ?? idx,
      destinoKey: d.destinoKey || `destino_${d.destinoIndice ?? idx}`,
      quantidade: Number(d.quantidade || d.qtd || 0) || 0,
      qtd: Number(d.qtd || d.quantidade || 0) || 0
    })).filter(d => (Number(d.qtd || d.quantidade || 0) || 0) > 0);
  }

  function destinoEstoqueEdicaoNF(d) {
    if (typeof W.thiaNFDestinoEstoque === 'function') {
      try { return !!W.thiaNFDestinoEstoque(d); } catch (_) {}
    }
    const destino = normNF(d?.destino || d?.finalidade || 'estoque');
    return !destino || destino === 'estoque';
  }

  function destinoVinculadoEdicaoNF(d) {
    if (typeof W.thiaNFDestinoVinculado === 'function') {
      try { return !!W.thiaNFDestinoVinculado(d); } catch (_) {}
    }
    const destino = normNF(d?.destino || d?.finalidade || '');
    return destino === 'os' || destino === 'placa' || !!d?.osId;
  }

  function destinoSigEdicaoNF(d) {
    const destino = normNF(d?.destino || d?.finalidade || 'estoque') || 'estoque';
    const osId = String(d?.osId || '');
    const placa = String(d?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const vinculo = normNF(d?.vinculo || '');
    return [destino, osId, placa, vinculo].join('|');
  }

  function linkCombinaItemPrecisoEdicaoNF(v, item) {
    const vi = indexItemEdicaoNF(v);
    const ii = indexItemEdicaoNF(item);
    if (vi && ii) return vi === ii;
    const vn = numeroItemEdicaoNF(v);
    const inn = numeroItemEdicaoNF(item);
    if (vn && inn) return vn === inn;
    return itemCombina(v, item);
  }

  function linkComoDestinoEdicaoNF(v, item) {
    return Object.assign({}, item || {}, v || {}, {
      destino: v?.destino || v?.finalidade || item?.destino || item?.finalidade || 'estoque',
      finalidade: v?.finalidade || v?.destino || item?.finalidade || item?.destino || 'estoque',
      quantidade: Number(v?.qtd || v?.quantidade || item?.quantidade || item?.qtd || 0) || 0,
      qtd: Number(v?.qtd || v?.quantidade || item?.quantidade || item?.qtd || 0) || 0,
      destinoIndice: v?.destinoIndice ?? item?.destinoIndice ?? 0,
      destinoKey: v?.destinoKey || item?.destinoKey || `destino_${v?.destinoIndice ?? item?.destinoIndice ?? 0}`,
      __link: v || null
    });
  }

  function estoqueParaItemEdicaoNF(oldLinks, antesItem, depoisItem) {
    const id = oldLinks.find(v => v?.estoqueId)?.estoqueId || '';
    if (id) return { id, item: (J().estoque || []).find(e => String(e.id || '') === String(id)) || null };
    const alvo = estoqueAtualPorVinculo(depoisItem || antesItem || {});
    return { id: alvo?.id || '', item: alvo || null };
  }

  function pecaOSCombinaEdicaoNF(p, nfId, item, oldLink) {
    if (String(p?.nfId || '') !== String(nfId || '')) return false;
    const origemP = String(p?.origemNFItemKey || '');
    const origemL = String(oldLink?.origemNFItemKey || '');
    if (origemP && origemL && origemP === origemL) return true;
    const pi = indexItemEdicaoNF(p);
    const ii = indexItemEdicaoNF(item);
    if (pi && ii && pi === ii) return true;
    const pn = numeroItemEdicaoNF(p);
    const inn = numeroItemEdicaoNF(item);
    if (pn && inn && pn === inn) return true;
    return itemCombina(p, item);
  }

  function removerUmaPecaArrayEdicaoNF(arr, nfId, item, oldLink) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    const idx = out.findIndex(p => pecaOSCombinaEdicaoNF(p, nfId, item, oldLink));
    if (idx >= 0) out.splice(idx, 1);
    return { lista: out, removeu: idx >= 0 };
  }

  async function carregarOSEdicaoNF(osId) {
    if (!osId) return null;
    const local = (J().os || []).find(o => String(o.id || '') === String(osId)) || null;
    // Em edição de NF, prefira a versão atual da nuvem para não sobrescrever
    // peças adicionadas por outro computador com um cache local antigo.
    try {
      const snap = await db().collection('ordens_servico').doc(osId).get();
      if (snap.exists) return { id: snap.id, ...snap.data() };
    } catch (_) {}
    try {
      if (typeof W.thiaNFResolverOSDestino === 'function') {
        const os = await W.thiaNFResolverOSDestino({ osId });
        if (os?.id) return os;
      }
    } catch (_) {}
    return local;
  }

  function fieldIncrementEdicaoNF(delta) {
    try {
      const fv = W.firebase?.firestore?.FieldValue || (typeof firebase !== 'undefined' ? firebase.firestore?.FieldValue : null);
      if (fv?.increment) return fv.increment(delta);
    } catch (_) {}
    return null;
  }

  function fornecedorNomeEdicaoNF(antes) {
    const fornecedorId = val('nfFornec') || antes?.fornecedorId || '';
    const f = (J().fornecedores || []).find(x => String(x.id || '') === String(fornecedorId)) || {};
    return antes?.fornecedorSnapshot?.nome || antes?.fornecedorNome || f.nome || f.razao || f.razaoSocial || 'Fornecedor';
  }

  function criarVinculoAtualEdicaoNF(nfId, antes, item, dest, estoqueId, agora) {
    const fornecedorId = val('nfFornec') || antes?.fornecedorId || '';
    const fornecedorNome = fornecedorNomeEdicaoNF(antes);
    const idx = item?.itemFiscalIndex ?? item?.itemIndex ?? '';
    const destinoIndice = dest?.destinoIndice ?? 0;
    const numeroItem = item?.numeroItem || item?.nItem || item?.item || '';
    const qtd = Number(dest?.qtd || dest?.quantidade || 0) || 0;
    const custo = Number(dest?.valorUnitario || dest?.custo || item?.valorUnitario || item?.custo || 0) || 0;
    const total = Number(dest?.valorLiquido || dest?.totalOperacional || (qtd * custo)) || 0;
    const origem = typeof W.thiaNFOrigemItemKey === 'function'
      ? W.thiaNFOrigemItemKey(Object.assign({}, item, dest, { itemFiscalIndex: idx, destinoIndice }), nfId)
      : [nfId, numeroItem, idx, destinoIndice, dest?.osId || '', dest?.placa || '', item?.codigoFornecedor || item?.codigo || '', item?.descricao || item?.desc || ''].join('|');
    return {
      tenantId: J().tid,
      nfId,
      nfNumero: val('nfNumero') || antes?.numero || '',
      chave: antes?.chave || '',
      fornecedorId,
      fornecedorNome,
      estoqueId: estoqueId || '',
      itemFiscalIndex: idx,
      itemIndex: idx,
      numeroItem,
      destinoIndice,
      destinoKey: dest?.destinoKey || `destino_${destinoIndice}`,
      origemNFItemKey: origem,
      codigo: item?.codigo || item?.codigoFornecedor || '',
      codigoFornecedor: item?.codigoFornecedor || item?.codigo || '',
      codigoComercial: item?.codigoComercial || item?.oem || '',
      ean: item?.ean || '',
      desc: item?.descricao || item?.desc || '',
      marca: item?.marca || '',
      qtd,
      quantidadeFiscal: Number(item?.quantidadeFiscal || item?.quantidade || 0) || 0,
      quantidadeOperacionalTotal: destinosItemEdicaoNF(item).reduce((sum, d) => sum + (Number(d.qtd || d.quantidade || 0) || 0), 0),
      fatorOperacional: Number(item?.fatorOperacional || 1) || 1,
      custo,
      valorUnitarioFiscal: Number(item?.valorUnitario || item?.custo || 0) || 0,
      desconto: Number(item?.desconto || 0) || 0,
      total,
      ncm: item?.ncm || '',
      cest: item?.cest || '',
      cfop: item?.cfop || '',
      finalidade: dest?.destino || dest?.finalidade || 'estoque',
      destino: dest?.destino || dest?.finalidade || 'estoque',
      vinculo: dest?.vinculo || '',
      osId: dest?.osId || '',
      placa: dest?.placa || '',
      estoqueBaixadoAutomatico: destinoVinculadoEdicaoNF(dest),
      status: 'Ativo',
      recriadoPorEdicaoNF: true,
      editadoEmNF: true,
      createdAt: agora,
      updatedAt: agora
    };
  }

  function movimentoEdicaoNF(nfId, antes, item, estoqueId, qtd, tipo, motivo, extra) {
    return Object.assign({
      tenantId: J().tid,
      estoqueId: estoqueId || '',
      tipo,
      nfId,
      nfNumero: val('nfNumero') || antes?.numero || '',
      chave: antes?.chave || '',
      codigo: item?.codigoFornecedor || item?.codigo || '',
      desc: item?.descricao || item?.desc || '',
      qtd: Number(qtd || 0) || 0,
      custo: Number(item?.valorUnitario || item?.custo || 0) || 0,
      total: Number(item?.valorLiquido || item?.total || 0) || 0,
      motivo,
      createdAt: new Date().toISOString(),
      usuario: J().nome || 'Sistema'
    }, extra || {});
  }

  async function aplicarEstornosEdicaoNF(batch, nfId, antes, diff, motivo) {
    const vinculos = await carregarVinculosNF(nfId, antes);
    const usados = new Set();
    const agora = new Date().toISOString();
    const resumo = {
      vinculosCancelados: 0,
      vinculosCriados: 0,
      vinculosAtualizados: 0,
      movimentos: 0,
      os: 0,
      pecasOS: 0,
      estoqueAjustado: 0,
      transferenciasVinculo: 0
    };
    const stockDeltas = new Map();
    const osPlans = new Map();

    const linksItem = item => {
      const disponiveis = vinculos.filter(v => vinculoAtivoEdicaoNF(v) && !usados.has(v.id || v));
      const ii = indexItemEdicaoNF(item);
      const inn = numeroItemEdicaoNF(item);
      const exatos = disponiveis.filter(v => {
        const vi = indexItemEdicaoNF(v);
        const vn = numeroItemEdicaoNF(v);
        if (ii && vi) return ii === vi;
        if (inn && vn) return inn === vn;
        return false;
      });
      let escolhidos = exatos;
      if (!escolhidos.length) {
        const candidatos = disponiveis.filter(v => itemCombina(v, item));
        const esperados = destinosItemEdicaoNF(item);
        escolhidos = [];
        esperados.forEach(d => {
          const sig = destinoSigEdicaoNF(d);
          let pos = candidatos.findIndex(v => !escolhidos.includes(v) && destinoSigEdicaoNF(linkComoDestinoEdicaoNF(v, item)) === sig);
          if (pos < 0) pos = candidatos.findIndex(v => !escolhidos.includes(v));
          if (pos >= 0) escolhidos.push(candidatos[pos]);
        });
        if (!esperados.length && candidatos[0]) escolhidos = [candidatos[0]];
      }
      escolhidos.forEach(v => usados.add(v.id || v));
      return escolhidos;
    };

    const ensureOSPlan = async osId => {
      if (!osId) return null;
      if (osPlans.has(osId)) return osPlans.get(osId);
      const os = await carregarOSEdicaoNF(osId);
      if (!os?.id) return null;
      const plan = {
        os,
        pecasReais: Array.isArray(os.pecasReais) ? os.pecasReais.slice() : [],
        pecas: Array.isArray(os.pecas) ? os.pecas.slice() : [],
        timeline: Array.isArray(os.timeline) ? os.timeline.slice() : [],
        mudou: false,
        removidas: 0,
        adicionadas: 0
      };
      osPlans.set(osId, plan);
      return plan;
    };

    const processar = async (antesItem, depoisItem, excluido) => {
      const oldLinks = linksItem(antesItem);
      const oldDests = oldLinks.length ? oldLinks.map(v => linkComoDestinoEdicaoNF(v, antesItem)) : destinosItemEdicaoNF(antesItem);
      const newDests = excluido ? [] : destinosItemEdicaoNF(depoisItem);
      const estInfo = estoqueParaItemEdicaoNF(oldLinks, antesItem, depoisItem);
      const estoqueId = estInfo.id || '';

      const oldTotal = oldDests.reduce((sum, d) => sum + (Number(d.qtd || d.quantidade || 0) || 0), 0);
      const newTotal = newDests.reduce((sum, d) => sum + (Number(d.qtd || d.quantidade || 0) || 0), 0);
      const deltaEntrada = Math.round((newTotal - oldTotal) * 1000) / 1000;
      if (Math.abs(deltaEntrada) > 0.0001) {
        batch.set(db().collection('estoque_movimentos').doc(), movimentoEdicaoNF(nfId, antes, depoisItem || antesItem, estoqueId, deltaEntrada, 'ajuste_entrada_nf_editada', motivo, {
          itemFiscalIndex: indexItemEdicaoNF(depoisItem || antesItem),
          origem: 'edicao_nf',
          osId: '', placa: '', destino: 'entrada_operacional'
        }));
        resumo.movimentos += 1;
      }

      const oldStock = oldDests.filter(destinoEstoqueEdicaoNF).reduce((sum, d) => sum + (Number(d.qtd || d.quantidade || 0) || 0), 0);
      const newStock = newDests.filter(destinoEstoqueEdicaoNF).reduce((sum, d) => sum + (Number(d.qtd || d.quantidade || 0) || 0), 0);
      const deltaStock = Math.round((newStock - oldStock) * 1000) / 1000;
      if (estoqueId && Math.abs(deltaStock) > 0.0001) stockDeltas.set(estoqueId, (stockDeltas.get(estoqueId) || 0) + deltaStock);

      const oldLinked = new Map();
      const newLinked = new Map();
      oldDests.filter(destinoVinculadoEdicaoNF).forEach(d => {
        const sig = destinoSigEdicaoNF(d);
        const e = oldLinked.get(sig) || { qtd: 0, d };
        e.qtd += Number(d.qtd || d.quantidade || 0) || 0;
        oldLinked.set(sig, e);
      });
      newDests.filter(destinoVinculadoEdicaoNF).forEach(d => {
        const sig = destinoSigEdicaoNF(d);
        const e = newLinked.get(sig) || { qtd: 0, d };
        e.qtd += Number(d.qtd || d.quantidade || 0) || 0;
        newLinked.set(sig, e);
      });
      const sigs = new Set([...oldLinked.keys(), ...newLinked.keys()]);
      sigs.forEach(sig => {
        const oldE = oldLinked.get(sig);
        const newE = newLinked.get(sig);
        const qtdMov = Math.round(((oldE?.qtd || 0) - (newE?.qtd || 0)) * 1000) / 1000;
        if (Math.abs(qtdMov) <= 0.0001) return;
        const d = newE?.d || oldE?.d || {};
        batch.set(db().collection('estoque_movimentos').doc(), movimentoEdicaoNF(nfId, antes, depoisItem || antesItem, estoqueId, qtdMov, qtdMov > 0 ? 'estorno_baixa_vinculo_nf_editada' : 'baixa_vinculo_nf_editada', motivo, {
          itemFiscalIndex: indexItemEdicaoNF(depoisItem || antesItem),
          destino: d.destino || d.finalidade || 'os',
          destinoKey: d.destinoKey || '',
          osId: d.osId || '',
          placa: d.placa || '',
          vinculo: d.vinculo || '',
          origem: 'edicao_nf_vinculo'
        }));
        resumo.movimentos += 1;
        resumo.transferenciasVinculo += 1;
      });

      oldLinks.forEach(v => {
        if (!v.id) return;
        batch.update(db().collection('nf_itens_vinculos').doc(v.id), {
          status: 'Cancelado por edicao de NF',
          ativo: false,
          canceladoEm: agora,
          canceladoPor: J().nome || 'Sistema',
          motivoCancelamento: motivo,
          substituidoPorEdicaoNF: !excluido,
          updatedAt: agora
        });
        resumo.vinculosCancelados += 1;
      });

      for (const d0 of newDests) {
        let d = Object.assign({}, d0);
        if (destinoVinculadoEdicaoNF(d)) {
          let os = null;
          if (d.osId) os = await carregarOSEdicaoNF(d.osId);
          if (!os && typeof W.thiaNFResolverOSDestino === 'function') os = await W.thiaNFResolverOSDestino(d);
          if (!os?.id) throw new Error(`Nao foi possivel resolver a O.S. para a peca "${depoisItem?.descricao || depoisItem?.desc || depoisItem?.codigo || 'sem descricao'}". Selecione uma O.S. valida antes de salvar a edicao.`);
          d.osId = os.id;
          d.placa = d.placa || os.placa || ((J().veiculos || []).find(v => String(v.id || '') === String(os.veiculoId || os.veiculo || ''))?.placa || '');
        }
        const payloadVinculo = criarVinculoAtualEdicaoNF(nfId, antes, depoisItem, d, estoqueId, agora);
        batch.set(db().collection('nf_itens_vinculos').doc(), payloadVinculo);
        resumo.vinculosCriados += 1;
      }

      // Remove a representacao antiga da(s) O.S. e recria somente nos destinos atuais.
      for (const d of oldDests.filter(destinoVinculadoEdicaoNF)) {
        const oldOsId = d.osId || d.__link?.osId || '';
        if (!oldOsId) continue;
        const plan = await ensureOSPlan(oldOsId);
        if (!plan) continue;
        const remReal = removerUmaPecaArrayEdicaoNF(plan.pecasReais, nfId, antesItem, d.__link);
        plan.pecasReais = remReal.lista;
        const remVis = removerUmaPecaArrayEdicaoNF(plan.pecas, nfId, antesItem, d.__link);
        plan.pecas = remVis.lista;
        if (remReal.removeu || remVis.removeu) {
          plan.mudou = true;
          plan.removidas += remReal.removeu ? 1 : 0;
          resumo.pecasOS += remReal.removeu ? 1 : 0;
        }
      }

      if (!excluido) {
        const fornecedorId = val('nfFornec') || antes?.fornecedorId || '';
        const fornecedorNome = fornecedorNomeEdicaoNF(antes);
        const nfRef = { id: nfId };
        const nfPayload = { numero: val('nfNumero') || antes?.numero || '', chave: antes?.chave || '', dataNF: val('nfData') || antes?.dataNF || antes?.data || '' };
        for (const d0 of newDests.filter(destinoVinculadoEdicaoNF)) {
          let d = Object.assign({}, d0);
          let os = d.osId ? await carregarOSEdicaoNF(d.osId) : null;
          if (!os && typeof W.thiaNFResolverOSDestino === 'function') os = await W.thiaNFResolverOSDestino(d);
          if (!os?.id) throw new Error(`Nao foi possivel resolver a O.S. de destino da peca "${depoisItem?.descricao || depoisItem?.desc || depoisItem?.codigo || 'sem descricao'}".`);
          d.osId = os.id;
          d.placa = d.placa || os.placa || ((J().veiculos || []).find(v => String(v.id || '') === String(os.veiculoId || os.veiculo || ''))?.placa || '');
          const plan = await ensureOSPlan(os.id);
          if (!plan) throw new Error(`O.S. ${os.id} nao encontrada para atualizar o vinculo da NF.`);
          let pecaReal = null;
          if (typeof W.thiaNFPecaRealFromDestino === 'function') pecaReal = W.thiaNFPecaRealFromDestino(Object.assign({}, depoisItem, d), os, nfRef, nfPayload, fornecedorId, fornecedorNome);
          if (!pecaReal) pecaReal = Object.assign({}, depoisItem, d, { nfId, nf: nfPayload.numero, nfNumero: nfPayload.numero, origem: 'nf_entrada', registradoEm: agora });
          if (typeof W.thiaNFMergePecasReais === 'function') plan.pecasReais = W.thiaNFMergePecasReais(plan.pecasReais, [pecaReal]);
          else plan.pecasReais.push(pecaReal);
          if (!(typeof W.thiaNFOSClienteOficial === 'function' && W.thiaNFOSClienteOficial(os))) {
            const vis = typeof W.thiaNFPecaOrcamentoFromReal === 'function' ? W.thiaNFPecaOrcamentoFromReal(pecaReal) : null;
            if (vis) {
              if (typeof W.thiaNFMergePecasOrcamento === 'function') plan.pecas = W.thiaNFMergePecasOrcamento(plan.pecas, [vis]);
              else plan.pecas.push(vis);
            }
          }
          plan.mudou = true;
          plan.adicionadas += 1;
          resumo.pecasOS += 1;
        }
      }
    };

    for (const item of (diff.excluidos || [])) await processar(item, null, true);
    for (const par of (diff.alterados || [])) await processar(par.antes || {}, par.depois || {}, false);

    for (const [estoqueId, deltaBruto] of stockDeltas.entries()) {
      const delta = Math.round(deltaBruto * 1000) / 1000;
      if (Math.abs(delta) <= 0.0001) continue;
      const incremento = fieldIncrementEdicaoNF(delta);
      if (incremento) {
        batch.update(db().collection('estoqueItems').doc(estoqueId), {
          qtd: incremento,
          updatedAt: agora,
          ultimaEdicaoNFId: nfId
        });
      } else {
        let est = null;
        try {
          const snap = await db().collection('estoqueItems').doc(estoqueId).get();
          if (snap.exists) est = { id: snap.id, ...snap.data() };
        } catch (_) {}
        if (!est) est = (J().estoque || []).find(e => String(e.id || '') === String(estoqueId)) || null;
        if (!est) throw new Error(`Item de estoque ${estoqueId} nao encontrado para reconciliar a edicao da NF.`);
        batch.update(db().collection('estoqueItems').doc(estoqueId), {
          qtd: Math.max(0, (Number(est.qtd) || 0) + delta),
          updatedAt: agora,
          ultimaEdicaoNFId: nfId
        });
      }
      resumo.estoqueAjustado += 1;
    }

    for (const [osId, plan] of osPlans.entries()) {
      if (!plan.mudou) continue;
      plan.timeline.push({
        ts: Date.now(),
        por: J().nome || 'Sistema',
        msg: `Vinculo de peca(s) atualizado por edicao auditada da NF ${val('nfNumero') || antes?.numero || nfId}. Removidas: ${plan.removidas}; adicionadas/atualizadas: ${plan.adicionadas}. Motivo: ${motivo}`,
        tipo: 'edicao_nf_vinculo_peca',
        nfId
      });
      batch.set(db().collection('ordens_servico').doc(osId), {
        pecasReais: plan.pecasReais,
        pecas: plan.pecas,
        timeline: plan.timeline,
        ultimaEntradaNFVinculada: val('nfNumero') || antes?.numero || nfId,
        updatedAt: agora
      }, { merge: true });
      const local = (J().os || []).find(o => String(o.id || '') === String(osId));
      if (local) {
        local.pecasReais = plan.pecasReais;
        local.pecas = plan.pecas;
        local.timeline = plan.timeline;
        local.updatedAt = agora;
      }
      resumo.os += 1;
    }

    return resumo;
  }

  async function ajustarFinanceiroEdicaoNF(batch, nfId, antes, novoTotal, motivo) {
    const titulos = (await carregarFinanceiroNF(nfId, antes)).filter(tituloFinanceiroNFOperacional).sort(ordenaTitulosFinanceirosNF);
    const totalAnterior = titulos.reduce((s, f) => s + (Number(f.valor) || 0), 0);
    const diff = Math.round((Number(novoTotal || 0) - totalAnterior) * 100) / 100;
    const bloqueado = titulos.some(f => /pago|liquidado|baixado|agrupado|cancelado/.test(normNF(f.status)) || f.pacoteBoletoId || f.bloqueadoPagamentoIndividual);
    const agora = new Date().toISOString();
    if (bloqueado) {
      if (Math.abs(diff) >= 0.01) {
        batch.set(db().collection('financeiro').doc(), {
          tenantId: J().tid,
          tipo: diff > 0 ? 'Saida' : 'Entrada',
          status: 'Pendente',
          desc: `Ajuste auditado NF ${antes.numero || nfId} por edicao`,
          valor: Math.abs(diff),
          pgto: 'Ajuste auditado',
          venc: hojeISOEdicao(),
          notaFiscalId: nfId,
          nfAjusteOrigem: 'edicao_nf',
          motivo,
          createdAt: agora
        });
      }
      return { titulos: titulos.length, ajuste: diff };
    }
    const tela = financeiroTelaEdicaoNF(antes, novoTotal, titulos);
    const parcelas = tela.parcelas || [];
    const fornecedorId = val('nfFornec') || antes.fornecedorId || '';
    const chaveNFe = antes.chave || '';
    const numeroNF = val('nfNumero') || antes.numero || 's/n';
    const fornecedorNome = tela.fornecedorNome || antes.fornecedorSnapshot?.nome || antes.fornecedorNome || 'Fornecedor';
    const grupoKey = tela.formaAgrupada
      ? ['fornecedor', fornecedorId || antes.fornecedorId || 'sem_fornecedor', 'periodo', parcelas[0]?.agrupamentoDias || 7, parcelas[0]?.vencimento || hojeISOEdicao()].join('_').replace(/[.#$\[\]\/]/g, '_')
      : '';
    let atualizados = 0;
    let criados = 0;
    let cancelados = 0;
    parcelas.forEach((p, idx) => {
      const existente = titulos[idx];
      const totalParcelas = parcelas.length;
      const payloadTitulo = {
        tenantId: J().tid,
        tipo: 'Saida',
        status: tela.status,
        desc: `NF ${numeroNF} — ${fornecedorNome}${totalParcelas > 1 ? ` (${idx + 1}/${totalParcelas})` : ''}`,
        valor: Number(p.valor || 0) || 0,
        pgto: tela.formaAgrupada ? 'Agrupamento por periodo' : tela.forma,
        venc: p.vencimento || hojeISOEdicao(),
        notaFiscalId: nfId,
        chaveNFe,
        fornecedorId,
        fornecedorNome,
        numeroParcela: idx + 1,
        parcela: idx + 1,
        totalParcelas,
        pgtoParcelas: totalParcelas,
        agrupamentoPeriodo: !!tela.formaAgrupada,
        aguardaBoletoAgrupado: !!tela.formaAgrupada,
        agrupamentoDias: tela.formaAgrupada ? (p.agrupamentoDias || 7) : null,
        agrupamentoVencimentoPrevisto: tela.formaAgrupada ? (p.vencimento || hojeISOEdicao()) : null,
        agrupamentoFornecedorKey: grupoKey || null,
        bloqueadoPagamentoIndividual: !!tela.formaAgrupada,
        atualizadoPorEdicaoNF: true,
        motivoEdicaoNF: motivo,
        updatedAt: agora
      };
      if (p.ajusteAutomaticoEdicaoNF) payloadTitulo.ajusteAutomaticoEdicaoNF = p.ajusteAutomaticoEdicaoNF;
      if (existente?.id) {
        batch.update(db().collection('financeiro').doc(existente.id), payloadTitulo);
        atualizados += 1;
      } else {
        batch.set(db().collection('financeiro').doc(), Object.assign({}, payloadTitulo, { createdAt: agora }));
        criados += 1;
      }
    });
    titulos.slice(parcelas.length).forEach(f => {
      if (!f.id) return;
      batch.update(db().collection('financeiro').doc(f.id), {
        status: 'Cancelado por edicao de NF',
        valor: 0,
        canceladoPorEdicaoNF: true,
        motivoEdicaoNF: motivo,
        updatedAt: agora
      });
      cancelados += 1;
    });
    if (!titulos.length && !parcelas.length && Number(novoTotal || 0) > 0) {
      batch.set(db().collection('financeiro').doc(), {
        tenantId: J().tid,
        tipo: 'Saida',
        status: 'Pendente',
        desc: `NF ${numeroNF} — ${fornecedorNome}`,
        valor: Number(novoTotal || 0),
        pgto: val('nfPgtoForma') || 'A Combinar',
        venc: val('nfVenc') || hojeISOEdicao(),
        notaFiscalId: nfId,
        chaveNFe,
        fornecedorId,
        fornecedorNome,
        criadoPorEdicaoNF: true,
        motivoEdicaoNF: motivo,
        createdAt: agora,
        updatedAt: agora
      });
      criados += 1;
    }
    return { titulos: titulos.length, atualizados, criados, cancelados, ajuste: diff, forma: tela.forma, parcelas: parcelas.length };
  }

  function hojeISOEdicao() {
    return new Date().toISOString().slice(0, 10);
  }

  async function abrirEdicaoNF(colOrId, maybeId) {
    ensureNFEditBox();
    const col = maybeId ? colOrId : 'notas_fiscais_entrada';
    const id = maybeId || colOrId;
    if (!id) return;
    let n = (J().notasFiscaisEntrada || []).find(x => String(x.id) === String(id));
    if (!n && db()) {
      const snap = await db().collection(col).doc(id).get();
      if (snap.exists) n = { id: snap.id, ...snap.data() };
    }
    if (!n) { toast('Nota fiscal não encontrada nos dados carregados.', 'warn'); return; }
    W.prepNF?.();
    W._thiaModoNF = 'edicao_nf';
    n = Object.assign({}, n, {
      itens: (Array.isArray(n.itens) ? n.itens : []).map((it, idx) => {
        const existente = it?.itemFiscalIndex ?? it?.itemIndex;
        const itemFiscalIndex = existente !== undefined && existente !== null && existente !== '' ? existente : idx;
        return Object.assign({}, it, { itemFiscalIndex, itemIndex: itemFiscalIndex });
      })
    });
    W._thiaNfEditBefore = clone(n);
    setValue('nfEditId', id);
    setValue('nfEditCollection', col);
    setValue('nfEditJust', '');
    const box = $('nfEditBox');
    if (box) box.style.display = 'block';
    const resumo = $('nfEditResumo');
    if (resumo) resumo.innerHTML = `NF <b>${esc(n.numero || 's/n')}</b> - ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || '')} - ${moeda(n.totalNF || n.totalItens || 0)} - ${(n.itens || []).length} item(ns).`;
    setValue('nfNumero', n.numero || '');
    setValue('nfData', String(n.dataNF || n.data || '').slice(0, 10));
    if ($('nfFornec')) {
      W.popularSelects?.();
      $('nfFornec').value = n.fornecedorId || '';
    }
    if ($('containerItensNF')) $('containerItensNF').innerHTML = '';
    const itens = Array.isArray(n.itens) ? n.itens : [];
    if (itens.length && typeof W.adicionarItemNF === 'function') itens.forEach(it => W.adicionarItemNF(it));
    else W.adicionarItemNF?.();
    if (typeof W.thiaNFSetTotaisFiscais === 'function') {
      W.thiaNFSetTotaisFiscais(Object.assign({}, n.totaisFiscais || {}, n.despesasAcessorias || {}, {
        vNF: n.totalNF || n.totaisFiscais?.vNF || n.totalItens || 0
      }), { manualTotal:true, forceTotal:true });
    }
    W.calcNFTotal?.();
    await preencherFinanceiroEdicaoNF(id, n);
    setNFSavingMode(true);
    W.abrirModal?.('modalNF');
  }

  async function salvarEdicaoNF() {
    const id = val('nfEditId');
    const col = val('nfEditCollection') || 'notas_fiscais_entrada';
    if (!id || !db()) return false;
    const motivo = val('nfEditJust');
    if (motivo.length < 8) {
      toast('Informe uma justificativa objetiva para editar/excluir itens da NF.', 'warn');
      $('nfEditJust')?.focus();
      return true;
    }
    const antes = W._thiaNfEditBefore || {};
    const itens = collectItensNFEdit();
    if (!itens.length) { toast('A NF precisa manter ao menos um item. Para cancelar a nota, use exclusão auditada.', 'warn'); return true; }
    const totaisTela = typeof W.thiaNFCalcTotaisFiscais === 'function'
      ? W.thiaNFCalcTotaisFiscais()
      : {
          totalItens: Math.round(itens.reduce((s, i) => s + (Number(i.valorLiquido) || 0), 0) * 100) / 100,
          totalFiscal: Math.round(itens.reduce((s, i) => s + (Number(i.valorLiquido) || 0), 0) * 100) / 100,
          frete: 0,
          seguro: 0,
          outrasDespesas: 0,
          descontoFiscalExtra: 0,
          totalCalculado: 0
        };
    const totalItens = totaisTela.totalItens;
    const totalNF = totaisTela.totalFiscal || totalItens;
    const diff = resumoDiffItensNF(antes.itens || [], itens);
    const totalOriginal = Number(antes.totalFiscalOriginal || antes.totalNF || antes.totalItens || 0) || totalItens;
    const registro = {
      em: new Date().toISOString(),
      por: J().nome || 'Sistema',
      perfil: J().role || '',
      motivo,
      resumo: {
        itensAntes: (antes.itens || []).length,
        itensDepois: itens.length,
        alterados: diff.alterados.length,
        incluidos: diff.incluidos.length,
        excluidos: diff.excluidos.length,
        totalAntes: Number(antes.totalItens || antes.totalNF || 0) || 0,
        totalDepois: totalNF
      }
    };
    const payload = {
      fornecedorId: val('nfFornec') || antes.fornecedorId || '',
      numero: val('nfNumero') || antes.numero || '',
      dataNF: val('nfData') || antes.dataNF || '',
      itens,
      totalItens,
      totalNF,
      despesasAcessorias: {
        frete: totaisTela.frete || 0,
        seguro: totaisTela.seguro || 0,
        outrasDespesas: totaisTela.outrasDespesas || 0,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra || 0
      },
      totaisFiscais: Object.assign({}, antes.totaisFiscais || {}, {
        totalItens,
        vFrete: totaisTela.frete || 0,
        vSeg: totaisTela.seguro || 0,
        vOutro: totaisTela.outrasDespesas || 0,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra || 0,
        vNF: totalNF,
        totalCalculado: totaisTela.totalCalculado || totalNF
      }),
      totalFiscalOriginal: totalOriginal,
      itensEditados: true,
      statusConferencia: 'Editada com justificativa',
      obsConferencia: motivo,
      ultimaEdicaoItensNF: registro,
      reconciliacaoEstoqueFinanceiroPendente: true,
      updatedAt: new Date().toISOString()
    };
    let fv = null;
    try { fv = W.firebase?.firestore?.FieldValue || (typeof firebase !== 'undefined' ? firebase.firestore?.FieldValue : null); } catch (_) {}
    if (fv?.arrayUnion) payload.auditoriaEdicoes = fv.arrayUnion(registro);
    try {
      const batch = db().batch();
      const efeitos = await aplicarEstornosEdicaoNF(batch, id, antes, diff, motivo);
      const financeiro = await ajustarFinanceiroEdicaoNF(batch, id, antes, totalNF, motivo);
      payload.reconciliacaoEstoqueFinanceiroPendente = diff.incluidos.length > 0;
      payload.resumoReconciliacaoEdicaoNF = { efeitos, financeiro };
      batch.update(db().collection(col).doc(id), payload);
      batch.set(db().collection('lixeira_auditoria').doc(), {
        tenantId: J().tid,
        modulo: 'ESTOQUE/NF',
        acao: `Editou itens da NF ${payload.numero || id}`,
        usuario: J().nome || 'Sistema',
        perfil: J().role || '',
        entidade: col,
        entidadeId: id,
        motivo,
        antes: { numero: antes.numero || '', totalNF: antes.totalNF || antes.totalItens || 0, itens: antes.itens || [] },
        depois: { numero: payload.numero, totalNF: payload.totalNF, itens },
        diff,
        efeitos,
        financeiro,
        aviso: diff.incluidos.length ? 'Itens novos adicionados em modo edicao ficam pendentes de reconciliacao manual; nada foi relancado como entrada nova.' : 'Edicao aplicada sem relancar NF como nova entrada.',
        ts: new Date().toISOString()
      });
      await batch.commit();
      toast(`NF ${payload.numero || id} atualizada com auditoria. Nenhuma entrada nova foi criada.`, 'ok');
      W._thiaModoNF = '';
      setNFSavingMode(false);
      W.fecharModal?.('modalNF');
    } catch (e) {
      toast('Erro ao salvar edição da NF: ' + (e.message || e), 'err');
    }
    return true;
  }

  async function excluirNFAuditada(idEntrada) {
    const id = idEntrada || val('nfEditId');
    if (!id || !db()) return false;
    if (!cargoPodeExcluirNF()) {
      toast('Exclusao de NF ja lancada e permitida somente para admin/dono/gerente autorizado.', 'warn');
      return true;
    }
    let nf = (J().notasFiscaisEntrada || []).find(x => String(x.id) === String(id));
    if (!nf) {
      const snap = await db().collection('notas_fiscais_entrada').doc(id).get();
      if (snap.exists) nf = { id: snap.id, ...snap.data() };
    }
    if (!nf) { toast('NF nao encontrada para exclusao auditada.', 'warn'); return true; }
    const motivo = prompt(`Justificativa obrigatoria para excluir/cancelar a NF ${nf.numero || id}:`, '') || '';
    if (motivo.trim().length < 8) {
      toast('Informe uma justificativa objetiva para excluir/cancelar a NF.', 'warn');
      return true;
    }
    const diff = { excluidos: Array.isArray(nf.itens) ? nf.itens : [], incluidos: [], alterados: [] };
    const agora = new Date().toISOString();
    try {
      const batch = db().batch();
      const efeitos = await aplicarEstornosEdicaoNF(batch, id, nf, diff, motivo.trim());
      const financeiro = await ajustarFinanceiroEdicaoNF(batch, id, nf, 0, motivo.trim());
      batch.update(db().collection('notas_fiscais_entrada').doc(id), {
        excluidaAuditada: true,
        statusFiscal: 'Excluida auditada',
        statusConferencia: 'Excluida auditada',
        excluidaEm: agora,
        excluidaPor: J().nome || 'Sistema',
        motivoExclusao: motivo.trim(),
        resumoExclusaoAuditada: { efeitos, financeiro },
        updatedAt: agora
      });
      batch.set(db().collection('lixeira_auditoria').doc(), {
        tenantId: J().tid,
        modulo: 'ESTOQUE/NF',
        acao: `Exclusao auditada da NF ${nf.numero || id}`,
        usuario: J().nome || 'Sistema',
        perfil: J().role || '',
        entidade: 'notas_fiscais_entrada',
        entidadeId: id,
        motivo: motivo.trim(),
        antes: nf,
        efeitos,
        financeiro,
        ts: agora
      });
      await batch.commit();
      toast(`NF ${nf.numero || id} excluida/cancelada com estorno auditado.`, 'ok');
      W.fecharModal?.('modalNF');
      W.fecharModal?.('modalFiscalDocHardening');
    } catch (e) {
      toast('Erro na exclusao auditada da NF: ' + (e.message || e), 'err');
    }
    return true;
  }

  function wrapNF() {
    if (typeof W.prepNF === 'function' && !W.prepNF.__thiaEditWrap) {
      const oldPrep = W.prepNF;
      W.prepNF = function () {
        const out = oldPrep.apply(this, arguments);
        if ($('nfEditId')) {
          setValue('nfEditId', '');
          setValue('nfEditCollection', 'notas_fiscais_entrada');
          setValue('nfEditJust', '');
          if ($('nfEditBox')) $('nfEditBox').style.display = 'none';
        }
        W._thiaModoNF = '';
        W._thiaNfEditBefore = null;
        setNFSavingMode(false);
        return out;
      };
      W.prepNF.__thiaEditWrap = true;
    }
    if (typeof W.salvarNF === 'function' && !W.salvarNF.__thiaEditWrap) {
      const oldSalvar = W.salvarNF;
      W.salvarNF = async function () {
        if (val('nfEditId') || W._thiaModoNF === 'edicao_nf') {
          const handled = await salvarEdicaoNF();
          if (handled) return;
        }
        return oldSalvar.apply(this, arguments);
      };
      W.salvarNF.__thiaEditWrap = true;
    }
    W.salvarEdicaoNF = salvarEdicaoNF;
    W.excluirNFAuditada = excluirNFAuditada;
    W.excluirNFDef = excluirNFAuditada;
    W.editarDocFiscal = abrirEdicaoNF;
  }

  function tempaAtiva() {
    if (typeof W.thiaModEnabled === 'function') return W.thiaModEnabled('tabelaTempa');
    const mods = J().oficina?.modulos || J().modulos || {};
    return mods.tabelaTempa !== false;
  }

  function bloquearTempa(silencioso) {
    D.querySelectorAll('#navTabelaTempa,#s-tabelatempa,[onclick*="tempa"],[onclick*="Tempa"],.tempa-inline-box,.serv-tempa-busca,.serv-tempa-aplicar,.serv-tempa-resultados-list,.serv-tempa-meta').forEach(el => {
      if (el) el.style.display = 'none';
    });
    if (!silencioso) toast('Tabela Tempária não está liberada para este tenant.', 'warn');
  }

  function wrapTempa() {
    const names = ['tempaCarregar','tempaInicializarTela','tempaPesquisar','tempaSugerirInlineOS','tempaSugerirParaOS','tempaConsultarParaIA'];
    names.forEach(name => {
      const old = W[name];
      if (typeof old !== 'function' || old.__thiaModWrap) return;
      W[name] = function () {
        if (!tempaAtiva()) {
          bloquearTempa(name === 'tempaSugerirInlineOS' || name === 'tempaConsultarParaIA');
          return name === 'tempaBuscarPorTexto' ? [] : null;
        }
        return old.apply(this, arguments);
      };
      W[name].__thiaModWrap = true;
    });
    if (typeof W.tempaBuscarPorTexto === 'function' && !W.tempaBuscarPorTexto.__thiaModWrap) {
      const oldBusca = W.tempaBuscarPorTexto;
      W.tempaBuscarPorTexto = function () {
        if (!tempaAtiva()) { bloquearTempa(true); return []; }
        return oldBusca.apply(this, arguments);
      };
      W.tempaBuscarPorTexto.__thiaModWrap = true;
    }
    if (typeof W.ir === 'function' && !W.ir.__thiaTempaWrap) {
      const oldIr = W.ir;
      W.ir = function (secao, el) {
        if (String(secao || '').replace(/^s-/, '').toLowerCase() === 'tabelatempa' && !tempaAtiva()) {
          bloquearTempa(false);
          return oldIr.call(this, 'dashboard', D.querySelector('.nav-item[onclick*="dashboard"]'));
        }
        return oldIr.apply(this, arguments);
      };
      W.ir.__thiaTempaWrap = true;
    }
    if (!tempaAtiva()) bloquearTempa(true);
  }

  function installClicks() {
    if (D.__thiaFornecedorClick) return;
    D.__thiaFornecedorClick = true;
    D.addEventListener('click', ev => {
      const btn = ev.target?.closest?.('[onclick*="modalFornec"]');
      if (btn && !/prepFornec\(/.test(btn.getAttribute('onclick') || '')) prepFornecCompleto('add');
    }, true);
  }

  function installAll() {
    ensureFornecedorModal();
    ensureFornecedorTableHeader();
    ensureNFEditBox();
    W.prepFornec = prepFornecCompleto;
    W.salvarFornec = salvarFornecCompleto;
    W.renderFornecedores = renderFornecedoresCompleto;
    wrapClienteSave();
    wrapNF();
    wrapTempa();
    installClicks();
    W.thiaInstalarMascarasBrasil?.();
    renderFornecedoresCompleto();
  }

  D.addEventListener('DOMContentLoaded', installAll);
  setTimeout(installAll, 500);
  setTimeout(installAll, 1400);
})();
