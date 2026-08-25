/**
 * JARVIS ERP — financeiro.js
 * DRE, Fluxo de Caixa, NF Entrada com Importação XML, Comissões, Exportação
 */

'use strict';

function dataLocalISOFin(d = new Date()) {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function somarDiasISOFin(iso, dias) {
    const [y,m,d] = String(iso || '').slice(0,10).split('-').map(Number);
    if (!y || !m || !d) return dataLocalISOFin();
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(dias || 0));
    return dataLocalISOFin(dt);
}
function somarMesesISOFin(iso, meses) {
    const [y,m,d] = String(iso || '').slice(0,10).split('-').map(Number);
    if (!y || !m || !d) return dataLocalISOFin();
    const dt = new Date(y, m - 1, d);
    dt.setMonth(dt.getMonth() + Number(meses || 0));
    return dataLocalISOFin(dt);
}
function compararISOFin(a,b){ return String(a||'').slice(0,10).localeCompare(String(b||'').slice(0,10)); }
function normalizarStatusFinanceiroFin(status) {
    return String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function financeiroCanceladoOuReemitidoFin(f) {
    const st = normalizarStatusFinanceiroFin(f?.status);
    return st === 'cancelado' || st === 'cancelada' || f?.canceladoPorReemissaoOS === true;
}
function financeiroOrigemAgrupadaFin(f) {
    return !!(f && (f.agrupadoNoBoletoId || f.boletoAgrupadoOrigem === true));
}
function financeiroBoletoAgrupadoFin(f) {
    return !!(f && (f.boletoAgrupado === true || f.tipoDocumento === 'boleto_agrupado'));
}
function financeiroFornecedorNomeFin(id) {
    if (!id) return '';
    const forn = (J.fornecedores || []).find(x => x.id === id || String(x.id) === String(id));
    return forn ? (forn.nome || '') : '';
}
function financeiroNormalizarTextoFin(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function financeiroNumeroBRFin(v) {
    const n = Number(String(v || '0').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}
function financeiroEhSaidaPendenteAgrupavelFin(f) {
    if (!f || f.tipo !== 'Saída') return false;
    if (financeiroCanceladoOuReemitidoFin(f)) return false;
    if (financeiroOrigemAgrupadaFin(f)) return false;
    if (financeiroBoletoAgrupadoFin(f)) return false;
    const st = normalizarStatusFinanceiroFin(f.status);
    if (st && st !== 'pendente') return false;
    return Number(f.valor || 0) > 0;
}
function financeiroFornecedorIdDoLancamentoFin(f) {
    if (!f) return '';
    if (f.fornecedorId) return f.fornecedorId;
    if (f.fornecedor) return f.fornecedor;
    if (String(f.vinculo || '').startsWith('F_')) return String(f.vinculo).replace('F_', '');
    const descNorm = financeiroNormalizarTextoFin((f.desc || '') + ' ' + (f.nota || ''));
    const achado = (J.fornecedores || []).find(fr => {
        const nome = financeiroNormalizarTextoFin(fr.nome || '');
        return nome && descNorm.includes(nome);
    });
    return achado ? achado.id : '';
}
function financeiroFornecedorConfereFin(f, fornecedorId) {
    if (!fornecedorId) return true;
    const idLanc = financeiroFornecedorIdDoLancamentoFin(f);
    if (idLanc && String(idLanc) === String(fornecedorId)) return true;
    const nome = financeiroNormalizarTextoFin(financeiroFornecedorNomeFin(fornecedorId));
    if (!nome) return false;
    const txt = financeiroNormalizarTextoFin((f.desc || '') + ' ' + (f.nota || ''));
    return txt.includes(nome);
}


// Seleção visual no financeiro para agrupar várias NFs/contas em um boleto.
// Não altera dados até o usuário confirmar no modal. Mantém rastreabilidade e usa as mesmas regras de agrupamento.
window.financeiroAgruparSelecionados = window.financeiroAgruparSelecionados || new Set();
function financeiroPodeSelecionarTabelaFin(f) {
    return financeiroEhSaidaPendenteAgrupavelFin(f);
}
function financeiroLimparSelecaoInvalidaFin() {
    const idsValidos = new Set((J.financeiro || []).filter(financeiroPodeSelecionarTabelaFin).map(f => f.id));
    [...window.financeiroAgruparSelecionados].forEach(id => { if (!idsValidos.has(id)) window.financeiroAgruparSelecionados.delete(id); });
}
function financeiroNotasSelecionadasTabelaFin() {
    financeiroLimparSelecaoInvalidaFin();
    return [...window.financeiroAgruparSelecionados].map(id => (J.financeiro || []).find(f => f.id === id)).filter(Boolean);
}
function financeiroAtualizarResumoSelecaoTabelaFin() {
    const notas = financeiroNotasSelecionadasTabelaFin();
    const total = notas.reduce((s,f) => s + Number(f.valor || 0), 0);
    if ($('finResumoSelecaoBoleto')) $('finResumoSelecaoBoleto').innerText = notas.length ? `${notas.length} selecionada(s) • ${moeda(total)}` : 'Nenhuma selecionada';
}
window.toggleSelecaoBoletoFinanceiro = function(id, marcado) {
    const f = (J.financeiro || []).find(x => x.id === id);
    if (!f || !financeiroPodeSelecionarTabelaFin(f)) return;
    if (marcado) window.financeiroAgruparSelecionados.add(id);
    else window.financeiroAgruparSelecionados.delete(id);
    financeiroAtualizarResumoSelecaoTabelaFin();
};
window.selecionarTodosFinanceiroBoletoVisiveis = function(marcar) {
    document.querySelectorAll('.fin-boleto-check[data-agrupavel="1"]').forEach(ch => {
        ch.checked = !!marcar;
        const id = ch.value;
        if (marcar) window.financeiroAgruparSelecionados.add(id);
        else window.financeiroAgruparSelecionados.delete(id);
    });
    financeiroAtualizarResumoSelecaoTabelaFin();
};
window.abrirAgruparBoletoSelecionados = function() {
    const selecionadas = financeiroNotasSelecionadasTabelaFin();
    abrirModal('modalAgruparBoleto');
    window.prepAgruparBoleto && window.prepAgruparBoleto(selecionadas.map(f => f.id));
};

window.thiaFinLimitV23 = window.thiaFinLimitV23 || 100;
window.renderFinanceiro = function() {
    const buscaTipo = $v('filtroFinTipo');
    const buscaStatus = $v('filtroFinStatus');
    const buscaMes = $v('filtroFinMes');
    const buscaLivre = financeiroNormalizarTextoFin($v('filtroFinBusca') || '');

    let base = [...J.financeiro];
    if (buscaTipo) base = base.filter(f => f.tipo === buscaTipo);
    if (buscaStatus === 'Cancelado') {
        base = base.filter(financeiroCanceladoOuReemitidoFin);
    } else if (buscaStatus === 'Agrupado') {
        base = base.filter(f => !financeiroCanceladoOuReemitidoFin(f) && financeiroOrigemAgrupadaFin(f));
    } else {
        base = base.filter(f => !financeiroCanceladoOuReemitidoFin(f) && !financeiroOrigemAgrupadaFin(f));
        if (buscaStatus) base = base.filter(f => f.status === buscaStatus);
    }
    if (buscaMes) base = base.filter(f => (f.venc || '').startsWith(buscaMes));
    if (buscaLivre) {
        base = base.filter(f => {
            const fornecedorId = financeiroFornecedorIdDoLancamentoFin(f);
            const fornecedorNome = financeiroFornecedorNomeFin(fornecedorId);
            const textoBusca = financeiroNormalizarTextoFin([
                f.desc, f.nota, f.nfNumero, f.numeroNota, f.chaveNFe, f.chave, f.fornecedor,
                fornecedorId, fornecedorNome, f.pgto, f.venc, f.status, f.valor,
                f.pedidoFornecedor, f.documentoNumero, f.documentoTipo, f.servicoDescricao,
                f.osId, f.osNumero, f.placa, f.categoria, f.origem, f.conferenciaDocumento
            ].join(' '));
            return textoBusca.includes(buscaLivre);
        });
    }

    base.sort((a, b) => (b.venc || '') > (a.venc || '') ? 1 : -1);
    const totalFiltradoV23 = base.length;
    const baseVisivelV23 = base.slice(0, Math.max(20, Number(window.thiaFinLimitV23 || 100)));

    let entradas = 0, saidas = 0;
    J.financeiro.filter(f => f.status === 'Pago').forEach(f => {
        if (f.tipo === 'Entrada') entradas += (f.valor || 0);
        else saidas += (f.valor || 0);
    });

    if ($('dreEntradas')) $('dreEntradas').innerText = moeda(entradas);
    if ($('dreSaidas')) $('dreSaidas').innerText = moeda(saidas);
    
    const saldo = entradas - saidas;
    if ($('dreSaldo')) {
        $('dreSaldo').innerText = moeda(saldo);
        $('dreSaldo').style.color = saldo >= 0 ? 'var(--cyan)' : 'var(--danger)';
    }

    const tb = $('tbFinanceiro');
    if (!tb) return;
    
    if(!$('btnExportCSV') && $('filtroFinMes')) {
        const btnCsv = document.createElement('button');
        btnCsv.id = 'btnExportCSV';
        btnCsv.className = 'btn-outline';
        btnCsv.innerHTML = '📄 EXPORTAR CSV';
        btnCsv.onclick = window.exportarFinanceiro;
        $('filtroFinMes').parentElement.appendChild(btnCsv);
    }

    tb.innerHTML = baseVisivelV23.map(f => {
        const cancelado = financeiroCanceladoOuReemitidoFin(f);
        const stCls = f.status === 'Pago' ? 'pill-green' : (cancelado ? 'pill-danger' : 'pill-warn'); 
        const tipCls = f.tipo === 'Entrada' ? 'pill-green' : 'pill-danger';
        const atrasado = !cancelado && f.status === 'Pendente' && f.venc && compararISOFin(f.venc, dataLocalISOFin()) < 0;
        const corValor = f.tipo === 'Entrada' ? 'var(--success)' : 'var(--danger)';
        
        let vinculoNome = '';
        if(f.vinculo) {
            if(f.vinculo.startsWith('F_')) {
                const forn = J.fornecedores.find(x => x.id === f.vinculo.replace('F_',''));
                if(forn) vinculoNome = `<br><small style="color:var(--cyan)">Fornecedor: ${forn.nome}</small>`;
            } else if(f.vinculo.startsWith('E_')) {
                const eq = J.equipe.find(x => x.id === f.vinculo.replace('E_',''));
                if(eq) vinculoNome = `<br><small style="color:var(--purple)">Colaborador: ${eq.nome}</small>`;
            }
        }
        if (financeiroBoletoAgrupadoFin(f)) {
            const qtdNotas = Array.isArray(f.notasAgrupadas) ? f.notasAgrupadas.length : 0;
            vinculoNome += `<br><small style="color:var(--warn)">Boleto agrupado${qtdNotas ? ` • ${qtdNotas} NF(s)` : ''}${f.boletoNumero ? ` • Nº ${f.boletoNumero}` : ''}</small>`;
        }
        if (financeiroOrigemAgrupadaFin(f)) {
            vinculoNome += `<br><small style="color:var(--muted)">Origem agrupada no boleto ${f.boletoNumero || f.agrupadoNoBoletoId || ''}</small>`;
        }

        if (f.categoria === 'servico_terceirizado' || f.origem === 'os_servico_terceirizado') {
            const infoTerceiro = [
                f.pedidoFornecedor ? `Pedido ${f.pedidoFornecedor}` : 'Pedido não informado',
                f.documentoNumero ? `${f.documentoTipo || 'Documento'} ${f.documentoNumero}` : 'Documento pendente',
                f.osNumero ? `OS ${f.osNumero}` : (f.osId ? `OS ${String(f.osId).slice(-6).toUpperCase()}` : ''),
                f.placa ? `Placa ${f.placa}` : '',
                f.conferenciaDocumento ? String(f.conferenciaDocumento).replace(/_/g,' ') : ''
            ].filter(Boolean).join(' • ');
            vinculoNome += `<br><small style="color:var(--warn)">Serviço terceirizado • ${infoTerceiro}</small>`;
        }

        return `<tr style="${atrasado ? 'background:rgba(255,59,59,0.05);' : ''}">
            <td style="font-family:var(--fm);font-size:0.75rem">${dtBr(f.venc)}</td>
            <td><span class="pill ${tipCls}">${f.tipo}</span></td>
            <td>${f.desc} ${vinculoNome}</td>
            <td style="font-family:var(--fm);font-size:0.75rem">${f.pgto || '-'}</td>
            <td style="font-family:var(--fm);font-weight:700;color:${corValor}">${moeda(f.valor)}</td>
            <td><span class="pill ${stCls}">${f.status}</span></td>
            <td>
                ${financeiroPodeSelecionarTabelaFin(f) ? `<label class="fin-boleto-select" title="Selecionar para agrupar em boleto"><input type="checkbox" class="fin-boleto-check" data-agrupavel="1" value="${f.id}" ${window.financeiroAgruparSelecionados.has(f.id) ? 'checked' : ''} onchange="window.toggleSelecaoBoletoFinanceiro('${f.id}', this.checked)"><span>boleto</span></label>` : `<span class="fin-boleto-select disabled" title="Este lançamento não pode ser agrupado">—</span>`}
                <button class="btn-ghost" onclick="prepFin('${f.id}');abrirModal('modalFin')" title="Editar">✏</button>
                <button class="btn-danger" onclick="toggleStatusFin('${f.id}','${f.status}')" title="${f.status === 'Pago' ? 'Marcar como Pendente' : 'Marcar como Pago'}">
                    ${f.status === 'Pago' ? '⌛' : '✓'}
                </button>
                <button class="btn-danger" onclick="window.excluirFinanceiroDef && window.excluirFinanceiroDef('${f.id}')" title="Excluir com auditoria">🗑</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">Nenhum lançamento encontrado</td></tr>';
    if (baseVisivelV23.length < totalFiltradoV23) {
        tb.insertAdjacentHTML('beforeend', `<tr><td colspan="7" style="padding:12px;text-align:center;white-space:normal;"><button type="button" class="btn-outline" style="max-width:100%;white-space:normal;" onclick="window.thiaFinLimitV23+=100;window.renderFinanceiro()">CARREGAR MAIS LANÇAMENTOS (${baseVisivelV23.length}/${totalFiltradoV23})</button></td></tr>`);
    }
    financeiroAtualizarResumoSelecaoTabelaFin();
};

window.prepFin = function(id = null) {
    ['finId', 'finDesc', 'finValor', 'finNota'].forEach(f => { if ($(f)) $(f).value = ''; });
    
    if ($('finTipo')) $('finTipo').value = 'Entrada'; 
    if ($('finStatus')) $('finStatus').value = 'Pago'; 
    if ($('finPgto')) $('finPgto').value = 'PIX'; 
    if ($('finVenc')) $('finVenc').value = dataLocalISOFin();
    if ($('finVinculo')) $('finVinculo').value = '';

    if (id) {
        const f = J.financeiro.find(x => x.id === id); 
        if (!f) return;
        if ($('finId')) $('finId').value = f.id; 
        if ($('finDesc')) $('finDesc').value = f.desc || ''; 
        if ($('finValor')) $('finValor').value = f.valor || 0;
        if ($('finTipo')) $('finTipo').value = f.tipo || 'Entrada'; 
        if ($('finStatus')) $('finStatus').value = f.status || 'Pago';
        if ($('finPgto')) $('finPgto').value = f.pgto || 'PIX'; 
        if ($('finVenc')) $('finVenc').value = f.venc || ''; 
        if ($('finNota')) $('finNota').value = f.nota || '';
        if ($('finVinculo')) $('finVinculo').value = f.vinculo || '';
    }
};

window.salvarFin = async function() {
    if (!$v('finDesc') || !$v('finValor')) { window.toast('⚠ Preencha descrição e valor', 'warn'); return; }
    
    const payload = {
        tenantId: J.tid, 
        tipo: $v('finTipo'), 
        desc: $v('finDesc'), 
        valor: parseFloat($v('finValor') || 0), 
        pgto: $v('finPgto'), 
        venc: $v('finVenc'), 
        status: $v('finStatus'), 
        nota: $v('finNota'), 
        vinculo: $v('finVinculo') || '',
        updatedAt: new Date().toISOString()
    };
    
    const id = $v('finId');
    if (id) {
        await db.collection('financeiro').doc(id).update(payload);
        window.toast('✓ LANÇAMENTO ATUALIZADO'); 
        audit('FINANCEIRO', 'Editou ' + payload.tipo + ': ' + payload.desc);
    } else { 
        payload.createdAt = new Date().toISOString(); 
        await db.collection('financeiro').add(payload); 
        window.toast('✓ LANÇAMENTO REGISTRADO'); 
        audit('FINANCEIRO', 'Lançou ' + payload.tipo + ': ' + payload.desc);
    }
    fecharModal('modalFin');
};

window.toggleStatusFin = async function(id, status) {
    const novoStatus = status === 'Pago' ? 'Pendente' : 'Pago';
    const atual = (J.financeiro || []).find(f => f.id === id) || null;
    const payload = { status: novoStatus, updatedAt: new Date().toISOString() };
    payload.dataPgto = novoStatus === 'Pago' ? dataLocalISOFin() : '';
    await db.collection('financeiro').doc(id).update(payload);
    if (typeof window.thiaAudit === 'function') {
        await window.thiaAudit('alterou_status_financeiro', 'financeiro', id, atual, Object.assign({}, atual || {}, payload), '');
    }
    window.toast(`✓ STATUS ALTERADO PARA ${novoStatus.toUpperCase()}`);
};

window.prepNF = function() {
    if ($('nfData')) $('nfData').value = dataLocalISOFin(); 
    if ($('nfNumero')) $('nfNumero').value = ''; 
    if ($('containerItensNF')) $('containerItensNF').innerHTML = '';
    if ($('nfTotal')) $('nfTotal').innerText = '0,00'; 
    if ($('nfPgtoForma')) $('nfPgtoForma').value = 'Dinheiro'; 
    if (typeof window.popularSelects === 'function') window.popularSelects(); 
    window.adicionarItemNF();
    window.checkPgtoNF();
};

window.lerXMLNFe = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

            const getTag = (node, tag) => {
                const el = node.getElementsByTagName(tag)[0] || node.getElementsByTagNameNS("*", tag)[0];
                return el ? el.textContent : '';
            };

            const nNF = getTag(xmlDoc, "nNF");
            const dhEmi = getTag(xmlDoc, "dhEmi");
            if (nNF && $('nfNumero')) $('nfNumero').value = nNF;
            if (dhEmi && $('nfData')) $('nfData').value = dhEmi.split('T')[0];

            const nomeEmit = getTag(xmlDoc, "xNome");
            if (nomeEmit && $('nfFornec')) {
                let f = J.fornecedores.find(x => x.nome.toLowerCase() === nomeEmit.toLowerCase());
                if(f) $('nfFornec').value = f.id;
            }

            const detNodes = xmlDoc.getElementsByTagName("det").length > 0 
                ? xmlDoc.getElementsByTagName("det") 
                : xmlDoc.getElementsByTagNameNS("*", "det");

            if (detNodes.length > 0 && $('containerItensNF')) {
                $('containerItensNF').innerHTML = ''; 
                
                Array.from(detNodes).forEach(det => {
                    const xProd = getTag(det, "xProd");
                    const qCom = parseFloat(getTag(det, "qCom") || 1);
                    const vUnCom = parseFloat(getTag(det, "vUnCom") || 0);

                    const pecaExistente = J.estoque.find(p => p.desc.toLowerCase() === xProd.toLowerCase());
                    const vVenda = pecaExistente ? (pecaExistente.venda || 0) : (vUnCom * 1.5);

                    const div = document.createElement('div');
                    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 130px 170px 32px;gap:8px;align-items:center;margin-bottom:8px;';
                    div.innerHTML = `
                        <input class="j-input nf-desc" value="${xProd}" placeholder="Descrição do item">
                        <input type="number" class="j-input nf-qtd" value="${qCom}" min="1" oninput="window.calcNFTotal()">
                        <input type="number" class="j-input nf-custo" value="${vUnCom.toFixed(2)}" step="0.01" placeholder="Custo" oninput="window.calcNFTotal()">
                        <input type="number" class="j-input nf-venda" value="${vVenda.toFixed(2)}" step="0.01" placeholder="Venda" oninput="window.calcNFTotal()">
                        <select class="j-select nf-finalidade" title="Finalidade da peça"><option value="estoque">Estoque</option><option value="os">Vincular O.S./veículo</option><option value="uso_interno">Uso interno</option><option value="garantia">Garantia</option><option value="devolucao">Devolução</option><option value="outro">Outro</option></select>
                        <input class="j-input nf-vinculo" placeholder="O.S./placa/finalidade">
                        <button type="button" onclick="this.parentElement.remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
                    `;
                    $('containerItensNF').appendChild(div);
                });
                
                window.calcNFTotal();
                window.toast('✓ XML IMPORTADO COM SUCESSO');
                audit('ESTOQUE/NF', `Importou XML da NFe ${nNF} de ${nomeEmit}`);
            } else {
                window.toast('⚠ Nenhum produto encontrado no XML', 'warn');
            }
        } catch(err) {
            window.toast('✕ Arquivo XML inválido ou corrompido', 'err');
            console.error(err);
        }
        
        if($('xmlInputFile')) $('xmlInputFile').value = '';
    };
    reader.readAsText(file);
};

window.adicionarItemNF = function() {
    const div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 90px 130px 170px 32px;gap:8px;align-items:center;margin-bottom:8px;';
    div.innerHTML = `
        <input class="j-input nf-desc" placeholder="Descrição do item" oninput="window.sugerirItemEstoqueNF(this)">
        <input type="number" class="j-input nf-qtd" value="1" min="1" oninput="window.calcNFTotal()">
        <input type="number" class="j-input nf-custo" value="0" step="0.01" placeholder="Custo" oninput="window.calcNFTotal()">
        <input type="number" class="j-input nf-venda" value="0" step="0.01" placeholder="Venda" oninput="window.calcNFTotal()">
        <select class="j-select nf-finalidade" title="Finalidade da peça"><option value="estoque">Estoque</option><option value="os">Vincular O.S./veículo</option><option value="uso_interno">Uso interno</option><option value="garantia">Garantia</option><option value="devolucao">Devolução</option><option value="outro">Outro</option></select>
        <input class="j-input nf-vinculo" placeholder="O.S./placa/finalidade">
        <button type="button" onclick="this.parentElement.remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">✕</button>
    `;
    if ($('containerItensNF')) $('containerItensNF').appendChild(div);
};

window.sugerirItemEstoqueNF = function(input) {
    const val = input.value.toLowerCase().trim();
    if (val.length < 3) return;
    const existente = J.estoque.find(p => p.desc.toLowerCase() === val);
    if (existente) {
        const row = input.parentElement;
        const custoInp = row.querySelector('.nf-custo');
        const vendaInp = row.querySelector('.nf-venda');
        if (custoInp && parseFloat(custoInp.value) === 0) custoInp.value = existente.custo || 0;
        if (vendaInp && parseFloat(vendaInp.value) === 0) vendaInp.value = existente.venda || 0;
        window.calcNFTotal();
    }
};

window.calcNFTotal = function() {
    let t = 0; 
    document.querySelectorAll('#containerItensNF > div').forEach(r => { 
        const qtd = parseFloat(r.querySelector('.nf-qtd')?.value || 0);
        const custo = parseFloat(r.querySelector('.nf-custo')?.value || 0);
        t += (qtd * custo); 
    });
    if ($('nfTotal')) $('nfTotal').innerText = t.toFixed(2).replace('.', ',');
};

window.checkPgtoNF = function() { 
    if ($('divParcelasNF') && $('nfPgtoForma')) {
        $('divParcelasNF').style.display = ['Parcelado', 'Boleto'].includes($v('nfPgtoForma')) ? 'block' : 'none'; 
    }
};

window.salvarNF = async function() {
    const itens = [];
    document.querySelectorAll('#containerItensNF > div').forEach(r => {
        const desc = r.querySelector('.nf-desc')?.value;
        if (desc) itens.push({
            desc,
            qtd: parseFloat(r.querySelector('.nf-qtd')?.value || 1),
            custo: parseFloat(r.querySelector('.nf-custo')?.value || 0),
            venda: parseFloat(r.querySelector('.nf-venda')?.value || 0),
            finalidade: r.querySelector('.nf-finalidade')?.value || 'estoque',
            vinculo: r.querySelector('.nf-vinculo')?.value || ''
        });
    });
    
    if (!itens.length) { window.toast('⚠ Adicione ao menos um item', 'warn'); return; }
    
    const batch = db.batch(); 
    let totalNF = 0;
    
    for (const item of itens) {
        totalNF += item.qtd * item.custo;
        const existente = J.estoque.find(p => p.desc.toLowerCase() === item.desc.toLowerCase());
        if (existente) { 
            batch.update(db.collection('estoqueItems').doc(existente.id), {
                qtd: (existente.qtd || 0) + item.qtd,
                custo: item.custo,
                venda: item.venda,
                updatedAt: new Date().toISOString()
            }); 
        } else { 
            batch.set(db.collection('estoqueItems').doc(), {
                tenantId: J.tid, desc: item.desc, qtd: item.qtd, custo: item.custo, venda: item.venda, min: 1, und: 'UN', createdAt: new Date().toISOString()
            }); 
        }
        // Registro de rastreabilidade opcional da peça: estoque, O.S./veículo, uso interno, garantia, devolução etc.
        const vincRef = db.collection('nf_itens_vinculos').doc();
        batch.set(vincRef, {
            tenantId: J.tid,
            nfNumero: $v('nfNumero') || '',
            desc: item.desc,
            qtd: item.qtd,
            custo: item.custo,
            venda: item.venda,
            finalidade: item.finalidade || 'estoque',
            vinculo: item.vinculo || '',
            fornecedorId: $v('nfFornec') || '',
            dataNF: $v('nfData') || '',
            createdAt: new Date().toISOString()
        });
    }
    
    const formaNF = $v('nfPgtoForma') || 'Dinheiro';
    const formaNormNF = String(formaNF).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const formaAVistaNF = formaNormNF.includes('pix') || formaNormNF.includes('dinheiro') || formaNormNF.includes('debito');
    const formaPermiteParcelasNF = formaNormNF.includes('boleto') || formaNormNF.includes('parcelado');
    const st = formaAVistaNF ? 'Pago' : 'Pendente';
    const nPar = formaPermiteParcelasNF ? (parseInt($v('nfParcelas') || 1, 10) || 1) : 1;
    
    for (let i = 0; i < nPar; i++) {
        const dISO = somarMesesISOFin($v('nfVenc') || dataLocalISOFin(), i);
        const fornecedorNF = J.fornecedores.find(f => f.id === $v('nfFornec'));
        batch.set(db.collection('financeiro').doc(), {
            tenantId: J.tid, tipo: 'Saída', status: st,
            desc: `NF ${$v('nfNumero') || 's/n'} — ${fornecedorNF?.nome || 'Fornecedor'} ${nPar > 1 ? `(${i + 1}/${nPar})` : ''}`,
            valor: totalNF / nPar, pgto: formaNF, venc: dISO,
            nota: `Origem: entrada de NF ${$v('nfNumero') || 's/n'}`,
            nfNumero: $v('nfNumero') || '',
            fornecedorId: $v('nfFornec') || '',
            vinculo: $v('nfFornec') ? `F_${$v('nfFornec')}` : '',
            parcelaNF: nPar > 1 ? `${i + 1}/${nPar}` : '1/1',
            createdAt: new Date().toISOString()
        });
    }
    
    await batch.commit(); 
    window.toast('✓ NF LANÇADA E ESTOQUE SOMADO'); 
    fecharModal('modalNF'); 
    audit('ESTOQUE/NF', 'Entrada NF ' + ($v('nfNumero') || 's/n'));
};

window.prepAgruparBoleto = function(idsPreSelecionados = null) {
    if (typeof window.popularSelects === 'function') window.popularSelects();
    if ($('agrBoletoFornecedor')) {
        $('agrBoletoFornecedor').innerHTML = '<option value="">Todos / selecionar depois</option>' + (J.fornecedores || []).map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    }
    if ($('agrBoletoBusca')) $('agrBoletoBusca').value = '';
    if ($('agrBoletoNumero')) $('agrBoletoNumero').value = '';
    if ($('agrBoletoBanco')) $('agrBoletoBanco').value = '';
    if ($('agrBoletoLinha')) $('agrBoletoLinha').value = '';
    if ($('agrBoletoVenc')) $('agrBoletoVenc').value = dataLocalISOFin();
    if ($('agrBoletoVencParcelaAux')) $('agrBoletoVencParcelaAux').value = $v('agrBoletoVenc') || dataLocalISOFin();
    if ($('agrBoletoValor')) $('agrBoletoValor').value = '';
    if ($('agrBoletoObs')) $('agrBoletoObs').value = '';
    if ($('agrBoletoQtdParcelas')) $('agrBoletoQtdParcelas').value = '1';
    if ($('agrBoletoParcelasLista')) $('agrBoletoParcelasLista').innerHTML = '';
    if ($('agrBoletoParcelasBox')) $('agrBoletoParcelasBox').style.display = 'none';
    if (Array.isArray(idsPreSelecionados) && idsPreSelecionados.length) {
        window.__agrBoletoPreSelecionados = new Set(idsPreSelecionados);
        const notas = idsPreSelecionados.map(id => (J.financeiro || []).find(f => f.id === id)).filter(Boolean);
        const fornecedores = [...new Set(notas.map(financeiroFornecedorIdDoLancamentoFin).filter(Boolean))];
        if (fornecedores.length === 1 && $('agrBoletoFornecedor')) $('agrBoletoFornecedor').value = fornecedores[0];
    } else {
        window.__agrBoletoPreSelecionados = new Set([...window.financeiroAgruparSelecionados || []]);
    }
    window.renderAgruparBoletoNotas();
};

window.getNotasFinanceirasAgrupaveis = function() {
    const fornecedorId = $v('agrBoletoFornecedor') || '';
    const busca = financeiroNormalizarTextoFin($v('agrBoletoBusca') || '');
    return (J.financeiro || [])
        .filter(financeiroEhSaidaPendenteAgrupavelFin)
        .filter(f => financeiroFornecedorConfereFin(f, fornecedorId))
        .filter(f => {
            if (!busca) return true;
            const txt = financeiroNormalizarTextoFin([f.desc, f.nota, f.nfNumero, f.pgto, f.venc, financeiroFornecedorNomeFin(financeiroFornecedorIdDoLancamentoFin(f))].join(' '));
            return txt.includes(busca);
        })
        .sort((a,b) => compararISOFin(a.venc, b.venc));
};

window.renderAgruparBoletoNotas = function() {
    const box = $('agrBoletoListaNotas');
    if (!box) return;
    const notas = window.getNotasFinanceirasAgrupaveis();
    if (!notas.length) {
        box.innerHTML = '<div style="padding:14px;color:var(--muted);text-align:center;border:1px dashed var(--border);border-radius:10px;">Nenhuma NF/conta pendente encontrada para os filtros atuais.</div>';
        window.atualizarResumoAgruparBoleto();
        return;
    }
    box.innerHTML = notas.map(f => {
        const fornecedorId = financeiroFornecedorIdDoLancamentoFin(f);
        const fornecedorNome = financeiroFornecedorNomeFin(fornecedorId) || 'Fornecedor não vinculado';
        const checked = window.__agrBoletoPreSelecionados && window.__agrBoletoPreSelecionados.has(f.id) ? 'checked' : '';
        return `<label class="agr-boleto-item">
            <input type="checkbox" class="agr-boleto-check" value="${f.id}" ${checked} onchange="window.atualizarResumoAgruparBoleto()">
            <div class="agr-boleto-info">
                <div class="agr-boleto-desc">${f.desc || 'Lançamento sem descrição'}</div>
                <div class="agr-boleto-meta">Venc.: ${dtBr(f.venc)} • ${fornecedorNome} • Pgto: ${f.pgto || '-'}${f.nfNumero ? ` • NF ${f.nfNumero}` : ''}</div>
            </div>
            <div class="agr-boleto-valor">${moeda(f.valor || 0)}</div>
        </label>`;
    }).join('');
    window.atualizarResumoAgruparBoleto();
};

window.marcarTodasNotasBoleto = function(marcar) {
    document.querySelectorAll('.agr-boleto-check').forEach(ch => { ch.checked = !!marcar; });
    window.atualizarResumoAgruparBoleto();
};

window.getNotasSelecionadasBoleto = function() {
    const ids = [...document.querySelectorAll('.agr-boleto-check:checked')].map(ch => ch.value);
    return ids.map(id => (J.financeiro || []).find(f => f.id === id)).filter(Boolean);
};

window.atualizarResumoAgruparBoleto = function() {
    const notas = window.getNotasSelecionadasBoleto ? window.getNotasSelecionadasBoleto() : [];
    const total = notas.reduce((s,f) => s + Number(f.valor || 0), 0);
    if ($('agrBoletoResumo')) $('agrBoletoResumo').innerText = `${notas.length} nota(s) selecionada(s) • total ${moeda(total)}`;
    if ($('agrBoletoValor') && !String($('agrBoletoValor').value || '').trim()) $('agrBoletoValor').placeholder = total.toFixed(2);
    if (typeof window.agrBoletoCalcularParcelas === 'function') window.agrBoletoCalcularParcelas(false);
};


window.agrBoletoCalcularParcelas = function(forcar = false) {
    const notas = window.getNotasSelecionadasBoleto ? window.getNotasSelecionadasBoleto() : [];
    const totalNotas = notas.reduce((s,f) => s + Number(f.valor || 0), 0);
    const valorInformado = financeiroNumeroBRFin($v('agrBoletoValor'));
    const total = valorInformado > 0 ? valorInformado : totalNotas;
    const qtd = Math.max(1, parseInt($v('agrBoletoQtdParcelas') || '1', 10) || 1);
    const box = $('agrBoletoParcelasBox');
    const lista = $('agrBoletoParcelasLista');
    if (!box || !lista) return;
    box.style.display = qtd > 1 ? 'block' : 'none';
    if (qtd <= 1) {
        lista.innerHTML = '';
        return;
    }
    const jaTemLinhas = lista.querySelectorAll('.agr-boleto-parcela-row').length === qtd;
    if (jaTemLinhas && !forcar) return;
    const vencBase = $v('agrBoletoVenc') || dataLocalISOFin();
    const base = new Date((vencBase || dataLocalISOFin()) + 'T12:00:00');
    const centsTotal = Math.round(total * 100);
    const centsBase = Math.floor(centsTotal / qtd);
    let acumulado = 0;
    const linhas = [];
    for (let i = 1; i <= qtd; i++) {
        const d = new Date(base);
        d.setMonth(base.getMonth() + (i - 1));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const cents = i === qtd ? (centsTotal - acumulado) : centsBase;
        acumulado += cents;
        linhas.push(`
            <div class="agr-boleto-parcela-row">
                <div class="agr-boleto-parcela-num">${i}/${qtd}</div>
                <input type="date" class="j-input agr-boleto-parcela-venc" value="${yyyy}-${mm}-${dd}" onchange="window.agrBoletoAtualizarResumoParcelas && window.agrBoletoAtualizarResumoParcelas()">
                <input class="j-input agr-boleto-parcela-valor" inputmode="decimal" value="${(cents / 100).toFixed(2)}" oninput="window.agrBoletoAtualizarResumoParcelas && window.agrBoletoAtualizarResumoParcelas()">
                <input class="j-input agr-boleto-parcela-numero" placeholder="Nº boleto ${i}">
                <input class="j-input agr-boleto-parcela-linha" placeholder="Linha digitável ${i} (opcional)">
            </div>
        `);
    }
    lista.innerHTML = linhas.join('');
    window.agrBoletoAtualizarResumoParcelas();
};

window.agrBoletoAtualizarResumoParcelas = function() {
    const resumo = $('agrBoletoParcelasResumo');
    if (!resumo) return;
    const parcelas = window.getParcelasBoletoAgrupado ? window.getParcelasBoletoAgrupado(false) : [];
    const totalParcelas = parcelas.reduce((s,p) => s + Number(p.valor || 0), 0);
    const notas = window.getNotasSelecionadasBoleto ? window.getNotasSelecionadasBoleto() : [];
    const totalNotas = notas.reduce((s,f) => s + Number(f.valor || 0), 0);
    const valorInformado = financeiroNumeroBRFin($v('agrBoletoValor'));
    const totalEsperado = valorInformado > 0 ? valorInformado : totalNotas;
    const dif = Math.abs(totalParcelas - totalEsperado);
    resumo.innerText = `${parcelas.length} parcela(s) • total ${moeda(totalParcelas)}${dif > 0.009 ? ' • diferença ' + moeda(totalParcelas - totalEsperado) : ''}`;
};

window.getParcelasBoletoAgrupado = function(validar = true) {
    const qtd = Math.max(1, parseInt($v('agrBoletoQtdParcelas') || '1', 10) || 1);
    if (qtd <= 1) {
        return [{
            parcela: 1,
            totalParcelas: 1,
            venc: $v('agrBoletoVenc') || dataLocalISOFin(),
            valor: financeiroNumeroBRFin($v('agrBoletoValor')),
            boletoNumero: $v('agrBoletoNumero') || '',
            linha: $v('agrBoletoLinha') || ''
        }];
    }
    const rows = [...document.querySelectorAll('.agr-boleto-parcela-row')];
    const parcelas = rows.map((row, idx) => ({
        parcela: idx + 1,
        totalParcelas: qtd,
        venc: row.querySelector('.agr-boleto-parcela-venc')?.value || '',
        valor: financeiroNumeroBRFin(row.querySelector('.agr-boleto-parcela-valor')?.value || ''),
        boletoNumero: row.querySelector('.agr-boleto-parcela-numero')?.value || '',
        linha: row.querySelector('.agr-boleto-parcela-linha')?.value || ''
    }));
    if (validar) {
        if (parcelas.length !== qtd) { window.toast('⚠ Gere/atualize as parcelas do boleto', 'warn'); return null; }
        if (parcelas.some(p => !p.venc || Number(p.valor || 0) <= 0)) { window.toast('⚠ Confira vencimento e valor de todas as parcelas', 'warn'); return null; }
    }
    return parcelas;
};

window.salvarBoletoAgrupado = async function() {
    const notas = window.getNotasSelecionadasBoleto();
    if (!notas.length) { window.toast('⚠ Selecione ao menos uma NF/conta para agrupar', 'warn'); return; }
    const fornecedorId = $v('agrBoletoFornecedor') || financeiroFornecedorIdDoLancamentoFin(notas[0]) || '';
    const fornecedoresDiferentes = [...new Set(notas.map(financeiroFornecedorIdDoLancamentoFin).filter(Boolean))];
    if (!fornecedorId && fornecedoresDiferentes.length !== 1) { window.toast('⚠ Selecione o fornecedor do boleto agrupado', 'warn'); return; }
    if (fornecedoresDiferentes.length > 1 && !confirm('Existem lançamentos de fornecedores diferentes selecionados. Deseja agrupar mesmo assim?')) return;
    const totalNotas = notas.reduce((s,f) => s + Number(f.valor || 0), 0);
    const valorInformado = financeiroNumeroBRFin($v('agrBoletoValor'));
    const valorBoleto = valorInformado > 0 ? valorInformado : totalNotas;
    if (valorBoleto <= 0) { window.toast('⚠ Valor do boleto inválido', 'warn'); return; }
    const qtdParcelas = Math.max(1, parseInt($v('agrBoletoQtdParcelas') || '1', 10) || 1);
    if (qtdParcelas > 1 && (!document.querySelector('.agr-boleto-parcela-row'))) window.agrBoletoCalcularParcelas(true);
    let parcelas = window.getParcelasBoletoAgrupado(true);
    if (!parcelas) return;
    if (qtdParcelas === 1) parcelas[0].valor = valorBoleto;
    const totalParcelas = parcelas.reduce((s,p) => s + Number(p.valor || 0), 0);
    if (Math.abs(totalParcelas - valorBoleto) > 0.009 && !confirm(`A soma das parcelas (${moeda(totalParcelas)}) é diferente do valor do boleto (${moeda(valorBoleto)}). Deseja continuar?`)) return;
    const fornecedorNome = financeiroFornecedorNomeFin(fornecedorId) || 'Fornecedor';
    const boletoNumero = $v('agrBoletoNumero') || '';
    const banco = $v('agrBoletoBanco') || '';
    const linha = $v('agrBoletoLinha') || '';
    const obs = $v('agrBoletoObs') || '';
    const agora = new Date().toISOString();
    const grupoId = db.collection('financeiro').doc().id;
    const notasResumo = notas.map(f => ({
        id: f.id,
        desc: f.desc || '',
        valor: Number(f.valor || 0),
        venc: f.venc || '',
        nfNumero: f.nfNumero || '',
        fornecedorId: financeiroFornecedorIdDoLancamentoFin(f) || fornecedorId || '',
        pgto: f.pgto || ''
    }));
    const notaAuditoriaBase = [
        `Boleto agrupado gerado a partir de ${notas.length} lançamento(s).`,
        `Total original das notas: ${moeda(totalNotas)}.`,
        valorInformado > 0 && Math.abs(valorInformado - totalNotas) > 0.009 ? `Valor informado do agrupamento: ${moeda(valorBoleto)}.` : '',
        qtdParcelas > 1 ? `Agrupamento parcelado em ${qtdParcelas} boleto(s).` : 'Agrupamento em boleto único.',
        boletoNumero ? `Boleto base/nº ${boletoNumero}.` : '',
        banco ? `Banco: ${banco}.` : '',
        linha ? `Linha digitável/código base: ${linha}.` : '',
        obs ? `Obs: ${obs}.` : ''
    ].filter(Boolean).join('\n');

    const batch = db.batch();
    const refsBoletos = [];
    parcelas.forEach((parc) => {
        const refBoleto = db.collection('financeiro').doc();
        refsBoletos.push(refBoleto);
        const numParcela = qtdParcelas > 1 ? `${parc.parcela}/${qtdParcelas}` : '1/1';
        const numeroParcela = parc.boletoNumero || boletoNumero || '';
        const linhaParcela = parc.linha || linha || '';
        batch.set(refBoleto, {
            tenantId: J.tid,
            tipo: 'Saída',
            status: 'Pendente',
            desc: qtdParcelas > 1 ? `BOLETO AGRUPADO ${numParcela} — ${fornecedorNome} — ${notas.length} NF/conta(s)` : `BOLETO AGRUPADO — ${fornecedorNome} — ${notas.length} NF/conta(s)`,
            valor: Number(parc.valor || 0),
            pgto: 'Boleto',
            venc: parc.venc || dataLocalISOFin(),
            vinculo: fornecedorId ? `F_${fornecedorId}` : '',
            fornecedorId: fornecedorId || '',
            boletoAgrupado: true,
            tipoDocumento: 'boleto_agrupado',
            boletoGrupoId: grupoId,
            boletoParcela: parc.parcela,
            boletoTotalParcelas: qtdParcelas,
            boletoNumero: numeroParcela,
            boletoBanco: banco,
            boletoLinhaDigitavel: linhaParcela,
            notasAgrupadas: notasResumo,
            nota: [notaAuditoriaBase, qtdParcelas > 1 ? `Parcela ${numParcela} no valor de ${moeda(parc.valor)} com vencimento em ${dtBr(parc.venc)}.` : ''].filter(Boolean).join('\n'),
            createdAt: agora,
            updatedAt: agora
        });
    });
    notas.forEach(f => {
        batch.update(db.collection('financeiro').doc(f.id), {
            status: 'Agrupado',
            agrupadoNoBoletoId: refsBoletos[0]?.id || grupoId,
            agrupadoNoBoletoIds: refsBoletos.map(r => r.id),
            boletoGrupoId: grupoId,
            boletoAgrupadoOrigem: true,
            boletoNumero,
            fornecedorId: financeiroFornecedorIdDoLancamentoFin(f) || fornecedorId || '',
            updatedAt: agora
        });
    });
    await batch.commit();
    notas.forEach(f => window.financeiroAgruparSelecionados && window.financeiroAgruparSelecionados.delete(f.id));
    window.__agrBoletoPreSelecionados = new Set();
    if (typeof window.thiaAudit === 'function') {
        await window.thiaAudit('agrupou_nf_em_boleto', 'financeiro', grupoId, null, { fornecedorId, boletoNumero, valor: valorBoleto, qtdParcelas, parcelas, notas: notasResumo }, '');
    } else if (typeof audit === 'function') {
        audit('FINANCEIRO', `Agrupou ${notas.length} NF/conta(s) em ${qtdParcelas} boleto(s) ${boletoNumero || grupoId}`);
    }
    window.toast(qtdParcelas > 1 ? `✓ ${qtdParcelas} BOLETOS AGRUPADOS GERADOS SEM PERDER RASTREABILIDADE` : '✓ BOLETO AGRUPADO GERADO SEM PERDER RASTREABILIDADE');
    fecharModal('modalAgruparBoleto');
    if (typeof window.renderFinanceiro === 'function') window.renderFinanceiro();
};

window.calcComissoes = function() {
    const comissoes = {}; 
    J.equipe.forEach(f => { comissoes[f.id] = { nome: f.nome, val: 0 }; });
    
    J.financeiro.filter(f => f.isComissao && f.mecId && f.status === 'Pendente').forEach(f => { 
        if (comissoes[f.mecId]) comissoes[f.mecId].val += f.valor || 0; 
    });
    
    if ($('boxComissoes')) {
        $('boxComissoes').innerHTML = Object.values(comissoes).filter(c => c.val > 0).map(c => `
            <div class="com-card">
                <div>
                    <div class="com-nome">${c.nome}</div>
                    <div style="font-family:var(--fm);font-size:0.6rem;color:var(--muted)">A PAGAR</div>
                </div>
                <div class="com-val">${moeda(c.val)}</div>
            </div>
        `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px;">Sem pendências</div>';
    }
};

window.prepPgtoRH = function() {
    ['rhPgtoValor','rhPgtoObs'].forEach(f=>{if($(f)) $(f).value='';});
    if($('rhPgtoData')) $('rhPgtoData').value = dataLocalISOFin();
    if($('rhPgtoTipo')) $('rhPgtoTipo').value = 'Vale / Adiantamento';
    if($('rhPgtoForma')) $('rhPgtoForma').value = 'PIX';
    if($('rhPgtoFunc')) $('rhPgtoFunc').innerHTML = '<option value="">Selecione...</option>' + J.equipe.map(f=>`<option value="${f.id}">${f.nome} (${f.cargo})</option>`).join('');
};

window.salvarPgtoRH = async function() {
    if(!$v('rhPgtoFunc') || !$v('rhPgtoValor')) { window.toast('⚠ Selecione o colaborador e informe o valor','warn'); return; }
    const func = J.equipe.find(f=>f.id===$v('rhPgtoFunc'));
    const valor = parseFloat($v('rhPgtoValor'));
    const tipo = $v('rhPgtoTipo');
    const obs = $v('rhPgtoObs');

    const payload = {
        tenantId: J.tid,
        tipo: 'Saída',
        status: 'Pago',
        desc: `RH: ${tipo} - ${func.nome}` + (obs ? ` (${obs})` : ''),
        valor: valor,
        pgto: $v('rhPgtoForma'),
        venc: $v('rhPgtoData'),
        isRH: true,
        mecId: func.id,
        vinculo: `E_${func.id}`,
        createdAt: new Date().toISOString()
    };

    const batch = db.batch();
    
    if(tipo === 'Pagamento Comissão') {
        let restante = valor;
        const comissoesPendentes = J.financeiro.filter(f => f.isComissao && f.mecId === func.id && f.status === 'Pendente').sort((a,b)=> a.venc > b.venc ? 1 : -1);
        for(let c of comissoesPendentes) {
            if(restante <= 0) break;
            if(c.valor <= restante) {
                batch.update(db.collection('financeiro').doc(c.id), {status: 'Pago', updatedAt: new Date().toISOString()});
                restante -= c.valor;
            } else {
                batch.update(db.collection('financeiro').doc(c.id), {valor: c.valor - restante, updatedAt: new Date().toISOString()});
                restante = 0;
            }
        }
    }

    batch.set(db.collection('financeiro').doc(), payload);
    await batch.commit();

    window.toast('✓ LANÇAMENTO DE RH REGISTRADO NO CAIXA');
    audit('RH/EQUIPE', `Registrou ${tipo} de ${moeda(valor)} para ${func.nome}`);
    fecharModal('modalPgtoRH');
    if(typeof window.calcComissoes === 'function') window.calcComissoes();
};

window.exportarFinanceiro = function() {
    if (J.financeiro.length === 0) { window.toast('⚠ Nenhum dado para exportar', 'warn'); return; }
    
    const buscaTipo = $v('filtroFinTipo');
    const buscaStatus = $v('filtroFinStatus');
    const buscaMes = $v('filtroFinMes');

    let base = [...J.financeiro];
    if (buscaTipo) base = base.filter(f => f.tipo === buscaTipo);
    if (buscaStatus === 'Cancelado') {
        base = base.filter(financeiroCanceladoOuReemitidoFin);
    } else {
        base = base.filter(f => !financeiroCanceladoOuReemitidoFin(f));
        if (buscaStatus) base = base.filter(f => f.status === buscaStatus);
    }
    if (buscaMes) base = base.filter(f => (f.venc || '').startsWith(buscaMes));
    base.sort((a, b) => (b.venc || '') > (a.venc || '') ? 1 : -1);

    let csv = "Vencimento;Tipo_Lancamento;Descricao;Forma_Pagamento;Valor;Status;Auditoria_Notas\n";
    
    base.forEach(f => {
        const venc = dtBr(f.venc);
        const tipo = f.tipo || '';
        const desc = (f.desc || '').replace(/;/g, ','); 
        const pgto = f.pgto || '';
        const valor = (f.valor || 0).toFixed(2).replace('.', ',');
        const status = f.status || '';
        const obs = (f.nota || '').replace(/;/g, ',');
        
        csv += `${venc};${tipo};${desc};${pgto};${valor};${status};${obs}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Fluxo_de_Caixa_JARVIS_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.toast('✓ RELATÓRIO EXPORTADO EM CSV');
    audit('FINANCEIRO', 'Exportou relatório CSV do caixa');
};
