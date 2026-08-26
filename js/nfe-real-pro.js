/*
 * thIAguinho ERP — NFe Entrada PRO 10/10
 * Correção profissional para XML/NFe de autopeças/oficinas.
 * - Mantém o módulo financeiro existente e sobrescreve apenas o fluxo de Entrada NF.
 * - Lê valores fiscais com ponto decimal do XML sem converter para milhares.
 * - Salva espelho completo da NF, itens fiscais, destino por item, vínculos com OS/placa e duplicatas no financeiro.
 * Powered by thIAguinho Soluções Digitais
 */
(function(){
  'use strict';
  const W = window;
  const D = document;
  const $ = (id) => D.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');
  const isoToday = () => {
    const d = new Date();
    const z = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  };
  const brDate = (iso) => {
    const s = String(iso || '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };
  const fmtBR = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQtd = (v) => {
    const n = Number(v) || 0;
    return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  };
  function quantidadeFiscalNF(item){
    const q = Number(item?.quantidadeFiscal ?? item?.qtdFiscal ?? item?.quantidade ?? item?.qtd ?? 1);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }
  function quantidadeRealSugeridaNF(item){
    // IMPORTANTE: "Fator real" na tela significa QUANTIDADE FÍSICA REAL TOTAL,
    // não multiplicador. Ex.: XML com 2 KIT => real 2 => operacional 2 (nunca 4).
    const informada = Number(item?.fatorReal ?? item?.quantidadeReal ?? item?.qtdReal ?? item?.quantidadeOperacional ?? item?.qtdOperacional ?? 0);
    if (Number.isFinite(informada) && informada > 0) return informada;

    const qtdFiscal = quantidadeFiscalNF(item);
    const unidade = String(item?.unidade || item?.unidadeFiscal || item?.und || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const desc = String(item?.descricao || item?.desc || item?.descricaoOriginal || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    // JG/JOGO/KIT é um conjunto fechado. A quantidade real acompanha exatamente o XML.
    // 1 kit = 1; 2 kits = 2; 3 jogos = 3. Não há multiplicação automática.
    if (/\b(JG|JOGO|KIT|KITS)\b/.test(unidade) || /\b(JOGO|JOGOS|KIT|KITS)\b/.test(desc)) return qtdFiscal;

    // PAR/PARES com uma única unidade fiscal pode representar duas unidades físicas.
    if (qtdFiscal <= 1 && (/\b(PAR|PARES)\b/.test(unidade) || /\b(PAR|PARES)\b/.test(desc))) return 2;

    // Disco de freio normalmente trabalha em par por eixo. Só sugere 2 quando o XML trouxe 1.
    if (qtdFiscal <= 1 && /\bDISCOS?\b/.test(desc) && /\bFREIO\b/.test(desc) && !/\b(UNITARIO|UNITARIA|1\s*UN|UMA\s+UNIDADE)\b/.test(desc)) return 2;

    // Qualquer outro item preserva a quantidade fiscal como quantidade real.
    return qtdFiscal;
  }
  function fatorOperacionalSugeridoNF(item){
    // Campo técnico mantido por compatibilidade com estoque/movimentos antigos.
    // Ele é derivado da quantidade real e NÃO é mais o valor exibido como "Fator real".
    const informado = Number(item?.fatorOperacional ?? item?.fatorConversao ?? 0);
    if (Number.isFinite(informado) && informado > 0 && !(Number(item?.fatorReal ?? item?.quantidadeReal ?? item?.qtdReal ?? 0) > 0)) return informado;
    const qtdFiscal = quantidadeFiscalNF(item);
    const qtdReal = quantidadeRealSugeridaNF(item);
    return qtdFiscal > 0 ? (qtdReal / qtdFiscal) : 1;
  }
  function quantidadeOperacionalNF(item){
    const informada = Number(item?.quantidadeOperacional ?? item?.qtdOperacional ?? item?.quantidadeReal ?? item?.qtdReal ?? item?.fatorReal ?? 0);
    if (Number.isFinite(informada) && informada > 0) return informada;

    // Compatibilidade com registros antigos que tinham apenas fatorOperacional multiplicador.
    const fatorLegado = Number(item?.fatorOperacional ?? item?.fatorConversao ?? 0);
    if (Number.isFinite(fatorLegado) && fatorLegado > 0) return quantidadeFiscalNF(item) * fatorLegado;

    return quantidadeRealSugeridaNF(item);
  }
  function unidadeFiscalNF(item){
    return String(item?.unidadeFiscal || item?.unidade || item?.und || 'UN').trim() || 'UN';
  }
  function custoOperacionalNF(item){
    const qtdOp = quantidadeOperacionalNF(item);
    const total = Number(item?.valorLiquido ?? item?.total ?? 0) || 0;
    if (qtdOp > 0 && total > 0) return Math.round((total / qtdOp) * 100) / 100;
    return Number(item?.valorUnitario ?? item?.custo ?? 0) || 0;
  }
  function totalOperacionalNF(item, qtd){
    const q = Number(qtd) || 0;
    const custo = custoOperacionalNF(item);
    return Math.round(q * custo * 100) / 100;
  }
  function parseNum(v){
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/R\$|\s/g, '');
    // XML NFe usa ponto decimal. Campo digitado no Brasil pode usar vírgula.
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function dividirDescricaoProdutoNFePro(xProd, cProd){
    const original = String(xProd || '').trim().replace(/\s+/g, ' ');
    let codigoComercial = '';
    let descricaoLimpa = original;
    let marca = '';

    // Padrões reais observados em XML de autopeças:
    // WO150-FILTRO DE OLEO LUBRIFICANTE - WEGA
    // 40859X22XS-CORREIA COMANDO VALVULAS - GATES
    // AMORTECEDOR DIANTEIRO - AMD0356 - PERFECT
    const partes = original.split(/\s+-\s+/).map(x => x.trim()).filter(Boolean);
    if (partes.length >= 2) {
      const primeiro = partes[0];
      const ultimo = partes[partes.length - 1];
      if (/^[A-Z0-9][A-Z0-9\.\/\-]{2,}$/i.test(primeiro) && /[A-Z]/i.test(primeiro) && /\d/.test(primeiro)) {
        codigoComercial = primeiro;
        descricaoLimpa = partes.slice(1, partes.length - 1).join(' - ') || partes[1] || original;
        marca = partes.length >= 3 ? ultimo : '';
      } else {
        descricaoLimpa = partes.slice(0, partes.length - 1).join(' - ') || primeiro;
        marca = ultimo;
        const codInterno = descricaoLimpa.match(/\b([A-Z]{1,4}\d{2,}[A-Z0-9\-\.]*)\b/i);
        if (codInterno) codigoComercial = codInterno[1];
      }
    } else {
      const m = original.match(/^([A-Z0-9][A-Z0-9\.\/\-]{2,})[-\s]+(.+)$/i);
      if (m && /\d/.test(m[1])) { codigoComercial = m[1]; descricaoLimpa = m[2].trim(); }
    }
    descricaoLimpa = descricaoLimpa.replace(/^[-\s]+|[-\s]+$/g, '').replace(/\s+/g, ' ');
    return {
      codigoFornecedor: String(cProd || '').trim(),
      codigoComercial: codigoComercial || String(cProd || '').trim(),
      oem: codigoComercial || String(cProd || '').trim(),
      descricaoOriginal: original,
      descricaoLimpa: descricaoLimpa || original,
      marca: marca || ''
    };
  }
  function setVal(id, val){ const el = $(id); if(el) el.value = val ?? ''; }
  function getVal(id){ return ($(id)?.value || '').trim(); }
  function getFirstText(node, tag){
    if(!node) return '';
    const a = node.getElementsByTagName(tag);
    if(a && a[0]) return (a[0].textContent || '').trim();
    const b = node.getElementsByTagNameNS('*', tag);
    if(b && b[0]) return (b[0].textContent || '').trim();
    return '';
  }
  function child(node, tag){
    if(!node) return null;
    const kids = node.children || [];
    for(const k of kids){ if((k.localName || k.nodeName) === tag) return k; }
    return null;
  }
  function directText(node, path){
    let n = node;
    for(const p of path){ n = child(n, p); if(!n) return ''; }
    return (n.textContent || '').trim();
  }
  function nodes(doc, tag){
    const a = Array.from(doc.getElementsByTagName(tag));
    if(a.length) return a;
    return Array.from(doc.getElementsByTagNameNS('*', tag));
  }
  function icmsData(det){
    const icms = child(child(det, 'imposto'), 'ICMS');
    const grupo = icms ? Array.from(icms.children || [])[0] : null;
    return {
      grupo: grupo ? (grupo.localName || grupo.nodeName) : '',
      origem: getFirstText(grupo, 'orig'),
      cst: getFirstText(grupo, 'CST') || getFirstText(grupo, 'CSOSN'),
      vBC: parseNum(getFirstText(grupo, 'vBC')),
      pICMS: parseNum(getFirstText(grupo, 'pICMS')),
      vICMS: parseNum(getFirstText(grupo, 'vICMS')),
      vBCST: parseNum(getFirstText(grupo, 'vBCST')),
      vST: parseNum(getFirstText(grupo, 'vST')),
      vBCSTRet: parseNum(getFirstText(grupo, 'vBCSTRet')),
      vICMSSTRet: parseNum(getFirstText(grupo, 'vICMSSTRet')),
      pST: parseNum(getFirstText(grupo, 'pST'))
    };
  }
  function impostoGrupo(det, grupoNome, subPrefix){
    const imp = child(det, 'imposto');
    const g = child(imp, grupoNome);
    const sub = g ? Array.from(g.children || [])[0] : null;
    return {
      grupo: sub ? (sub.localName || sub.nodeName) : '',
      cst: getFirstText(sub, 'CST'),
      vBC: parseNum(getFirstText(sub, 'vBC')),
      p: parseNum(getFirstText(sub, subPrefix ? 'p' + subPrefix : 'p' + grupoNome)),
      v: parseNum(getFirstText(sub, subPrefix ? 'v' + subPrefix : 'v' + grupoNome))
    };
  }
  function parseNFeXML(text){
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const perr = xml.getElementsByTagName('parsererror')[0];
    if(perr) throw new Error('XML inválido: ' + perr.textContent.slice(0,120));
    const inf = nodes(xml, 'infNFe')[0];
    const ide = nodes(xml, 'ide')[0];
    const emit = nodes(xml, 'emit')[0];
    const dest = nodes(xml, 'dest')[0];
    const total = nodes(xml, 'ICMSTot')[0];
    const fat = nodes(xml, 'fat')[0];
    const prot = nodes(xml, 'infProt')[0];
    const chave = (getFirstText(prot, 'chNFe') || String(inf?.getAttribute('Id') || '').replace(/^NFe/, '')).trim();
    const emitEnd = child(emit, 'enderEmit');
    const destEnd = child(dest, 'enderDest');
    const fornecedor = {
      cnpj: getFirstText(emit, 'CNPJ') || getFirstText(emit, 'CPF'),
      nome: getFirstText(emit, 'xNome'),
      fantasia: getFirstText(emit, 'xFant'),
      ie: getFirstText(emit, 'IE'),
      crt: getFirstText(emit, 'CRT'),
      endereco: {
        logradouro: getFirstText(emitEnd, 'xLgr'), numero: getFirstText(emitEnd, 'nro'), complemento: getFirstText(emitEnd, 'xCpl'),
        bairro: getFirstText(emitEnd, 'xBairro'), municipio: getFirstText(emitEnd, 'xMun'), uf: getFirstText(emitEnd, 'UF'), cep: getFirstText(emitEnd, 'CEP'), telefone: getFirstText(emitEnd, 'fone')
      }
    };
    const destinatario = {
      cnpj: getFirstText(dest, 'CNPJ') || getFirstText(dest, 'CPF'), nome: getFirstText(dest, 'xNome'), ie: getFirstText(dest, 'IE'), email: getFirstText(dest, 'email'),
      endereco: { logradouro:getFirstText(destEnd,'xLgr'), numero:getFirstText(destEnd,'nro'), bairro:getFirstText(destEnd,'xBairro'), municipio:getFirstText(destEnd,'xMun'), uf:getFirstText(destEnd,'UF'), cep:getFirstText(destEnd,'CEP'), telefone:getFirstText(destEnd,'fone') }
    };
    const dets = nodes(xml, 'det');
    const itens = dets.map(det => {
      const prod = child(det, 'prod');
      const icms = icmsData(det);
      const ipi = impostoGrupo(det, 'IPI', 'IPI');
      const pis = impostoGrupo(det, 'PIS', 'PIS');
      const cofins = impostoGrupo(det, 'COFINS', 'COFINS');
      const q = parseNum(getFirstText(prod, 'qCom'));
      const vu = parseNum(getFirstText(prod, 'vUnCom'));
      const vp = parseNum(getFirstText(prod, 'vProd'));
      const vd = parseNum(getFirstText(prod, 'vDesc'));
      const vItem = parseNum(getFirstText(det, 'vItem')) || Math.max(vp - vd, 0);
      const _codProd = getFirstText(prod, 'cProd');
      const _xProd = getFirstText(prod, 'xProd');
      const _splitProd = dividirDescricaoProdutoNFePro(_xProd, _codProd);
      return {
        nItem: det.getAttribute('nItem') || '',
        codigoFornecedor: _splitProd.codigoFornecedor,
        codigoComercial: _splitProd.codigoComercial,
        codigo: _splitProd.codigoFornecedor,
        oem: _splitProd.oem,
        ean: getFirstText(prod, 'cEAN'),
        descricaoOriginal: _splitProd.descricaoOriginal,
        descricao: _splitProd.descricaoLimpa,
        marca: _splitProd.marca,
        ncm: getFirstText(prod, 'NCM'), cest: getFirstText(prod, 'CEST'), cfop: getFirstText(prod, 'CFOP'),
        unidade: getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN',
        unidadeFiscal: getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN',
        quantidade: q,
        quantidadeFiscal: q,
        fatorReal: quantidadeRealSugeridaNF({ quantidade:q, quantidadeFiscal:q, unidade:getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN', descricao:_splitProd.descricaoLimpa, descricaoOriginal:_splitProd.descricaoOriginal }),
        quantidadeReal: quantidadeRealSugeridaNF({ quantidade:q, quantidadeFiscal:q, unidade:getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN', descricao:_splitProd.descricaoLimpa, descricaoOriginal:_splitProd.descricaoOriginal }),
        fatorOperacional: fatorOperacionalSugeridoNF({ quantidade:q, quantidadeFiscal:q, unidade:getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN', descricao:_splitProd.descricaoLimpa, descricaoOriginal:_splitProd.descricaoOriginal }),
        quantidadeOperacional: quantidadeRealSugeridaNF({ quantidade:q, quantidadeFiscal:q, unidade:getFirstText(prod, 'uCom') || getFirstText(prod, 'uTrib') || 'UN', descricao:_splitProd.descricaoLimpa, descricaoOriginal:_splitProd.descricaoOriginal }),
        valorUnitario: vu, valorProduto: vp, desconto: vd, valorLiquido: vItem,
        eanTrib: getFirstText(prod, 'cEANTrib'), unidadeTrib: getFirstText(prod, 'uTrib'), quantidadeTrib: parseNum(getFirstText(prod,'qTrib')), valorUnitarioTrib: parseNum(getFirstText(prod,'vUnTrib')),
        icms, ipi, pis, cofins,
        ibsCbs: {
          vIBS: parseNum(getFirstText(det, 'vIBS')),
          vCBS: parseNum(getFirstText(det, 'vCBS')),
          vIBSCBS: parseNum(getFirstText(det, 'vIBSCBS')),
          cClassTrib: getFirstText(det, 'cClassTrib') || getFirstText(det, 'cClassTribIBSCBS')
        },
        infAdProd: getFirstText(det, 'infAdProd'),
        destino: 'estoque', vinculo: '', osId: '', placa: '', observacaoDestino: ''
      };
    });
    const duplicatas = nodes(xml, 'dup').map(d => ({ numero:getFirstText(d,'nDup'), vencimento:getFirstText(d,'dVenc'), valor:parseNum(getFirstText(d,'vDup')) }));
    const pagamentos = nodes(xml, 'detPag').map(p => ({ tipo:getFirstText(p,'tPag'), descricao:getFirstText(p,'xPag'), valor:parseNum(getFirstText(p,'vPag')), data:getFirstText(p,'dPag') }));
    const info = {
      chave, modelo:getFirstText(ide,'mod'), serie:getFirstText(ide,'serie'), numero:getFirstText(ide,'nNF'), natureza:getFirstText(ide,'natOp'),
      dataEmissao:(getFirstText(ide,'dhEmi') || '').slice(0,10), dataSaida:(getFirstText(ide,'dhSaiEnt') || '').slice(0,10), tipoNF:getFirstText(ide,'tpNF'), finalidade:getFirstText(ide,'finNFe'),
      protocolo:getFirstText(prot,'nProt'), statusAutorizacao:getFirstText(prot,'cStat'), motivoAutorizacao:getFirstText(prot,'xMotivo'), recebidoEm:getFirstText(prot,'dhRecbto'),
      fornecedor, destinatario, itens,
      totais: {
        vProd: parseNum(getFirstText(total,'vProd')), vDesc: parseNum(getFirstText(total,'vDesc')), vNF: parseNum(getFirstText(total,'vNF')),
        vFrete: parseNum(getFirstText(total,'vFrete')), vSeg: parseNum(getFirstText(total,'vSeg')), vOutro: parseNum(getFirstText(total,'vOutro')),
        vIPI: parseNum(getFirstText(total,'vIPI')), vPIS: parseNum(getFirstText(total,'vPIS')), vCOFINS: parseNum(getFirstText(total,'vCOFINS')),
        vBC: parseNum(getFirstText(total,'vBC')), vICMS: parseNum(getFirstText(total,'vICMS')), vBCST: parseNum(getFirstText(total,'vBCST')), vST: parseNum(getFirstText(total,'vST')), vTotTrib: parseNum(getFirstText(total,'vTotTrib')),
        vIBS: parseNum(getFirstText(total,'vIBS')), vCBS: parseNum(getFirstText(total,'vCBS')), vIBSCBS: parseNum(getFirstText(total,'vIBSCBS'))
      },
      cobranca: { numero:getFirstText(fat,'nFat'), valorOriginal:parseNum(getFirstText(fat,'vOrig')), desconto:parseNum(getFirstText(fat,'vDesc')), valorLiquido:parseNum(getFirstText(fat,'vLiq')), duplicatas },
      pagamentos, referencias:nodes(xml, 'refNFe').map(r => r.textContent.trim()).filter(Boolean), infAdFisco:getFirstText(xml,'infAdFisco'), infCpl:getFirstText(xml,'infCpl'), rawXml:text
    };
    return info;
  }
  function osEmAtendimentoNF(os){
    const st = normalizeTextNF([os?.status, os?.etapa].filter(Boolean).join(' '));
    if(!st) return true;
    return !/(cancelad|entreg|finaliz|encerrad|recusad|arquivad|excluid)/.test(st);
  }
  function osBuscaConfereNF(os, busca){
    const termo = normalizeTextNF(busca || '');
    const placaBusca = normalizePlateNF(busca || '');
    if(!termo && !placaBusca) return true;
    const placa = placaDaOSNF(os);
    if(placaBusca && placa && (placa.includes(placaBusca) || placaBusca.includes(placa))) return true;
    return normalizeTextNF(textoBuscaOSNF(os)).includes(termo);
  }
  function listaOSDestinoNF(selectedOSId, busca){
    return (W.J?.os || [])
      .filter(o => osEmAtendimentoNF(o) || String(o.id || '') === String(selectedOSId || ''))
      .filter(o => osBuscaConfereNF(o, busca))
      .sort(ordenarOSDestinoNF);
  }
  function currentOSOptions(selectedOSId, busca){
    const lista = listaOSDestinoNF(selectedOSId, busca);
    return lista.map(o => {
      const v = (W.J?.veiculos || []).find(x => x.id === o.veiculoId) || {};
      const c = (W.J?.clientes || []).find(x => x.id === o.clienteId) || {};
      const placa = (o.placa || v.placa || 'S/PLACA').toUpperCase();
      const veic = [v.marca, v.modelo || o.veiculo].filter(Boolean).join(' ') || 'Veículo';
      const data = brDate((o.data || o.createdAt || o.updatedAt || '').slice(0,10));
      const status = o.status || 'em atendimento';
      const label = `${placa} — ${veic} — ${c.nome || o.cliente || 'Cliente'} — O.S. #${String(o.id||'').slice(-6).toUpperCase()} — ${status}${data ? ' — ' + data : ''}`;
      return `<option value="${esc(o.id)}" data-placa="${esc(placa)}" ${String(selectedOSId||'')===String(o.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function descricaoOSDestinoLoteNF(os){
    if(!os) return '';
    const v = (W.J?.veiculos || []).find(x => x.id === os.veiculoId) || {};
    const c = (W.J?.clientes || []).find(x => x.id === os.clienteId) || {};
    const placa = (os.placa || v.placa || 'S/PLACA').toUpperCase();
    const veic = [v.marca, v.modelo || os.veiculo].filter(Boolean).join(' ') || 'Veículo';
    const status = os.status || 'em atendimento';
    return `${placa} — ${veic} — ${c.nome || os.cliente || 'Cliente'} — O.S. #${String(os.id||'').slice(-6).toUpperCase()} — ${status}`;
  }
  function resumoDestinoLinhaNF(row){
    if(!row) return 'Destino não definido';
    const finalidade = row.querySelector('.nf-finalidade')?.value || 'estoque';
    if(finalidade === 'os'){
      const sel = row.querySelector('.nf-os-select');
      const os = (W.J?.os || []).find(o => String(o.id || '') === String(sel?.value || ''));
      const placa = os ? placaDaOSNF(os) : normalizePlateNF(row.querySelector('.nf-vinculo')?.value || '');
      return os?.id ? `${placa || 'S/PLACA'} • O.S. #${String(os.id).slice(-6).toUpperCase()}` : 'O.S. ainda não selecionada';
    }
    if(finalidade === 'estoque') return 'ESTOQUE';
    if(finalidade === 'placa') return `PLACA ${normalizePlateNF(row.querySelector('.nf-vinculo')?.value || '') || 'não informada'}`;
    const labels = { garantia:'GARANTIA', devolucao:'DEVOLUÇÃO', uso_interno:'USO INTERNO', outro:'OUTRO' };
    return labels[finalidade] || String(finalidade || 'DESTINO').toUpperCase();
  }
  function atualizarStatusLinhaLoteNF(row){
    if(!row) return;
    const status = row.querySelector('.nf-lote-status');
    if(status) status.textContent = resumoDestinoLinhaNF(row);
  }
  function atualizarContadorLoteNF(){
    const box = $('nfVinculoLotePro');
    if(!box) return;
    const total = D.querySelectorAll('#containerItensNF .nf-real-row').length;
    const selecionadas = D.querySelectorAll('#containerItensNF .nf-lote-check:checked').length;
    const el = $('nfLoteContador');
    if(el) el.textContent = `${selecionadas} selecionada(s) de ${total}`;
    D.querySelectorAll('#containerItensNF .nf-real-row').forEach(atualizarStatusLinhaLoteNF);
  }
  function ensureNFVinculoLoteUI(){
    const cont = $('containerItensNF');
    if(!cont || $('nfVinculoLotePro')) {
      atualizarContadorLoteNF();
      return;
    }
    const box = D.createElement('div');
    box.id = 'nfVinculoLotePro';
    box.innerHTML = `
      <style id="nfVinculoLoteProCSS">
        #nfVinculoLotePro{border:1px solid rgba(0,212,255,.32);background:rgba(0,212,255,.045);border-radius:5px;padding:12px;margin:0 0 12px;display:grid;gap:10px}
        #nfVinculoLotePro .nf-lote-top{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
        #nfVinculoLotePro .nf-lote-title{font-family:var(--fd);font-weight:800;color:var(--cyan);letter-spacing:.5px}
        #nfVinculoLotePro .nf-lote-contador{font-family:var(--fm);font-size:.66rem;color:var(--muted)}
        #nfVinculoLotePro .nf-lote-grid{display:grid;grid-template-columns:minmax(210px,1fr) minmax(280px,1.6fr) auto auto;gap:8px;align-items:end}
        #nfVinculoLotePro .nf-lote-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        #nfVinculoLotePro .nf-lote-help{font-family:var(--fm);font-size:.62rem;line-height:1.5;color:var(--muted)}
        .nf-lote-select-line{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:5px 7px;border:1px solid rgba(0,212,255,.18);border-radius:3px;background:rgba(0,212,255,.025)}
        .nf-lote-select-line label{display:flex;align-items:center;gap:7px;font-family:var(--fm);font-size:.63rem;color:var(--cyan);cursor:pointer}
        .nf-lote-check{width:17px;height:17px;accent-color:var(--cyan);cursor:pointer}
        .nf-lote-status{font-family:var(--fm);font-size:.62rem;color:var(--muted2);font-weight:700}
        @media(max-width:900px){#nfVinculoLotePro .nf-lote-grid{grid-template-columns:1fr}#nfVinculoLotePro .nf-lote-grid button{width:100%}}
      </style>
      <div class="nf-lote-top">
        <div class="nf-lote-title">VÍNCULO EM LOTE DAS PEÇAS DA NF</div>
        <div class="nf-lote-contador" id="nfLoteContador">0 selecionada(s)</div>
      </div>
      <div class="nf-lote-grid">
        <div>
          <label class="j-label">Buscar veículo / placa / O.S. / cliente</label>
          <input class="j-input" id="nfLoteOSBusca" placeholder="Ex.: ABC1D23, cliente, O.S..." oninput="window.nfProLoteFiltrarOS(this)">
        </div>
        <div>
          <label class="j-label">O.S. de destino</label>
          <select class="j-select" id="nfLoteOSSelect" onchange="window.nfProLoteSelecionouOS(this)">
            <option value="">Selecione a O.S. para o grupo...</option>${currentOSOptions('', '')}
          </select>
        </div>
        <button type="button" class="btn-primary" onclick="window.nfProLoteAplicarOS()">VINCULAR SELECIONADAS À O.S.</button>
        <button type="button" class="btn-outline" onclick="window.nfProLoteAplicarEstoque()">SELECIONADAS → ESTOQUE</button>
      </div>
      <div class="nf-lote-actions">
        <button type="button" class="btn-ghost" onclick="window.nfProLoteMarcarTodas(true)">MARCAR TODAS</button>
        <button type="button" class="btn-ghost" onclick="window.nfProLoteMarcarTodas(false)">LIMPAR SELEÇÃO</button>
      </div>
      <div class="nf-lote-help">
        Selecione qualquer quantidade de linhas, vincule ao primeiro veículo/O.S., depois selecione outro grupo e repita quantas vezes precisar.
        O vínculo em lote usa a <b>quantidade operacional inteira da linha selecionada</b>. Para dividir a quantidade da mesma linha entre mais de um veículo/O.S., continue usando <b>+ DIVIDIR DESTINO</b> manualmente como hoje.
      </div>`;
    cont.parentElement?.insertBefore(box, cont);
    atualizarContadorLoteNF();
  }
  W.nfProLoteAtualizarSelecao = atualizarContadorLoteNF;
  W.nfProLoteFiltrarOS = function(input){
    const sel = $('nfLoteOSSelect');
    if(!sel) return;
    const old = sel.value;
    const lista = listaOSDestinoNF(old, input?.value || '');
    sel.innerHTML = `<option value="">Selecione a O.S. para o grupo...</option>` + lista.map(o => {
      const placa = placaDaOSNF(o) || 'S/PLACA';
      return `<option value="${esc(o.id)}" data-placa="${esc(placa)}" ${String(old||'')===String(o.id)?'selected':''}>${esc(descricaoOSDestinoLoteNF(o))}</option>`;
    }).join('');
    if(old && Array.from(sel.options).some(opt => opt.value === old)) sel.value = old;
  };
  W.nfProLoteSelecionouOS = function(sel){
    const os = (W.J?.os || []).find(o => String(o.id || '') === String(sel?.value || ''));
    const busca = $('nfLoteOSBusca');
    if(os && busca) busca.value = placaDaOSNF(os) || busca.value || '';
  };
  W.nfProLoteMarcarTodas = function(marcar){
    D.querySelectorAll('#containerItensNF .nf-lote-check').forEach(ch => { ch.checked = !!marcar; });
    atualizarContadorLoteNF();
  };
  function linhasSelecionadasLoteNF(){
    return Array.from(D.querySelectorAll('#containerItensNF .nf-real-row')).filter(row => row.querySelector('.nf-lote-check')?.checked);
  }
  function aplicarDestinoIntegralLinhaNF(row, destino, os){
    if(!row) return;
    const splitBox = row.querySelector('.nf-destinos-split');
    if(splitBox) splitBox.innerHTML = '';
    const finalidade = row.querySelector('.nf-finalidade');
    if(finalidade) finalidade.value = destino;
    const osSel = row.querySelector('.nf-os-select');
    const osBusca = row.querySelector('.nf-os-busca');
    const vinc = row.querySelector('.nf-vinculo');
    if(destino === 'os' && os?.id){
      const placa = placaDaOSNF(os);
      if(finalidade) W._nfeProToggleDestino?.(finalidade);
      if(osSel){
        osSel.innerHTML = `<option value="">Escolha pela placa / O.S. / cliente...</option>${currentOSOptions(os.id, '')}`;
        osSel.value = os.id;
      }
      if(osBusca) osBusca.value = placa || '';
      if(vinc) vinc.value = [placa, 'OS ' + String(os.id).slice(-6).toUpperCase()].filter(Boolean).join(' / ');
    } else {
      if(finalidade) W._nfeProToggleDestino?.(finalidade);
      if(osSel) osSel.value = '';
      if(osBusca) osBusca.value = '';
      if(vinc) vinc.value = '';
    }
    W._nfeProAtualizarSaldoDestino?.(row);
    if (destino === 'os' && os?.id) aplicarPrecoFrotistaNaLinhaNF(row, os);
    else restaurarPrecoAutomaticoFrotistaNF(row);
    atualizarStatusLinhaLoteNF(row);
  }
  W.nfProLoteAplicarOS = function(){
    ensureNFVinculoLoteUI();
    const linhas = linhasSelecionadasLoteNF();
    if(!linhas.length){ W.toast?.('Selecione ao menos uma peça da nota para vincular em lote.', 'warn'); return; }
    const osId = $('nfLoteOSSelect')?.value || '';
    const os = (W.J?.os || []).find(o => String(o.id || '') === String(osId));
    if(!os?.id){ W.toast?.('Selecione a O.S./veículo de destino para este grupo.', 'warn'); $('nfLoteOSSelect')?.focus(); return; }
    linhas.forEach(row => {
      aplicarDestinoIntegralLinhaNF(row, 'os', os);
      const ch = row.querySelector('.nf-lote-check'); if(ch) ch.checked = false;
    });
    atualizarContadorLoteNF();
    W.toast?.(`✓ ${linhas.length} peça(s) vinculada(s) em lote a ${placaDaOSNF(os) || 'O.S.'} / O.S. #${String(os.id).slice(-6).toUpperCase()}.`);
  };
  W.nfProLoteAplicarEstoque = function(){
    ensureNFVinculoLoteUI();
    const linhas = linhasSelecionadasLoteNF();
    if(!linhas.length){ W.toast?.('Selecione ao menos uma peça para enviar ao estoque.', 'warn'); return; }
    linhas.forEach(row => {
      aplicarDestinoIntegralLinhaNF(row, 'estoque', null);
      const ch = row.querySelector('.nf-lote-check'); if(ch) ch.checked = false;
    });
    atualizarContadorLoteNF();
    W.toast?.(`✓ ${linhas.length} peça(s) definida(s) para estoque.`);
  };
  function destinoOptionHTMLNF(destino){
    return `
      <option value="estoque" ${destino==='estoque'?'selected':''}>Estoque</option>
      <option value="os" ${destino==='os'?'selected':''}>Vincular a O.S./veículo</option>
      <option value="placa" ${destino==='placa'?'selected':''}>Separar por placa</option>
      <option value="garantia" ${destino==='garantia'?'selected':''}>Garantia</option>
      <option value="devolucao" ${destino==='devolucao'?'selected':''}>Devolução</option>
      <option value="uso_interno" ${destino==='uso_interno'?'selected':''}>Uso interno</option>
      <option value="outro" ${destino==='outro'?'selected':''}>Outro</option>`;
  }
  function splitDestinoTemplateNF(split){
    const s = split || {};
    const destino = s.destino || s.finalidade || 'estoque';
    const options = currentOSOptions(s.osId || '', s.vinculo || s.placa || '');
    return `
      <div class="nf-split-row" style="border:1px dashed rgba(125,211,252,.28);padding:8px;border-radius:3px;background:rgba(0,212,255,.035);display:grid;grid-template-columns:90px 170px minmax(220px,1fr) minmax(160px,1fr) 34px;gap:8px;align-items:end;">
        <div><label class="j-label">Qtd real</label><input class="j-input nf-split-qtd" inputmode="decimal" value="${esc(fmtQtd(s.qtd || s.quantidade || 0))}" oninput="window._nfeProAtualizarSaldoDestino(this)"></div>
        <div><label class="j-label">Destino</label><select class="j-select nf-split-finalidade" onchange="window._nfeProToggleDestinoSplit(this)">${destinoOptionHTMLNF(destino)}</select></div>
        <div class="nf-split-os-wrap" style="display:${destino==='os'?'block':'none'}">
          <label class="j-label">O.S. em atendimento</label>
          <input class="j-input nf-split-os-busca" value="${esc(s.vinculo || s.placa || '')}" placeholder="Buscar placa / O.S. / cliente" oninput="window.nfProFiltrarOSSplit(this)" style="margin-bottom:6px;">
          <select class="j-select nf-split-os-select" onchange="window.nfProSelecionouOSSplit(this)"><option value="">Escolha a O.S.</option>${options}</select>
        </div>
        <div><label class="j-label">Placa/finalidade/observação</label><input class="j-input nf-split-vinculo" value="${esc(s.vinculo || '')}" placeholder="Ex.: ABC1234, garantia, estoque parcial..."></div>
        <button type="button" title="Remover destino" onclick="this.closest('.nf-split-row').remove();window._nfeProAtualizarSaldoDestino(this)" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;height:32px;">✕</button>
      </div>`;
  }
  function destinosExtrasHTMLNF(item){
    const arr = Array.isArray(item?.destinosOperacionais) ? item.destinosOperacionais
      : (Array.isArray(item?.destinos) ? item.destinos : []);
    const extras = arr.slice(1);
    if (!extras.length) return '';
    return extras.map(splitDestinoTemplateNF).join('');
  }
  function rowTemplate(item){
    const i = item || {};
    const qtdFiscal = quantidadeFiscalNF(i);
    const qtdOperacional = quantidadeOperacionalNF(i);
    // Na tela, Fator real e Qtd operacional representam o mesmo total físico real.
    const fatorReal = qtdOperacional;
    const unidade = unidadeFiscalNF(i);
    const destinosArr = Array.isArray(i.destinosOperacionais) ? i.destinosOperacionais : (Array.isArray(i.destinos) ? i.destinos : []);
    const destinoBase = destinosArr[0] || i;
    const options = currentOSOptions(destinoBase.osId || i.osId || '', destinoBase.vinculo || destinoBase.placa || i.vinculo || i.placa || '');
    const destino = destinoBase.destino || destinoBase.finalidade || i.destino || 'estoque';
    return `
      <div class="nf-real-row" style="border:1px solid var(--border);border-radius:4px;padding:10px;background:rgba(0,0,0,.08);display:grid;gap:8px;">
        <div class="nf-lote-select-line">
          <label><input type="checkbox" class="nf-lote-check" onchange="window.nfProLoteAtualizarSelecao()"> SELECIONAR PARA VÍNCULO EM LOTE</label>
          <span class="nf-lote-status">${esc(destino === 'os' ? ((destinoBase.placa || i.placa || 'O.S.') + (destinoBase.osId ? ' • O.S. #' + String(destinoBase.osId).slice(-6).toUpperCase() : '')) : (destino === 'estoque' ? 'ESTOQUE' : String(destino || 'destino').toUpperCase()))}</span>
        </div>
        <div style="display:grid;grid-template-columns:120px 130px minmax(220px,2fr) 120px 80px 105px 105px 105px 105px 34px;gap:8px;align-items:end;" class="nf-real-grid-main">
          <div><label class="j-label">Código fornecedor</label><input class="j-input nf-codforn" value="${esc(i.codigoFornecedor||i.codigo||'')}"></div>
          <div><label class="j-label">Código/OEM</label><input class="j-input nf-codigo" value="${esc(i.codigoComercial||i.oem||'')}"></div>
          <div><label class="j-label">Descrição limpa da peça</label><input class="j-input nf-desc" value="${esc(i.descricao||'')}" title="Original XML: ${esc(i.descricaoOriginal||i.descricao||'')}" placeholder="Descrição da peça"></div>
          <div><label class="j-label">Marca</label><input class="j-input nf-marca" value="${esc(i.marca||'')}"></div>
          <div><label class="j-label">Qtd fiscal</label><input class="j-input nf-qtd" inputmode="decimal" value="${esc(fmtQtd(qtdFiscal))}" oninput="window._nfeProAtualizarQuantidadeOperacional(this);window.calcNFTotal()"></div>
          <div><label class="j-label">Custo un.</label><input class="j-input nf-custo" inputmode="decimal" value="${esc(fmtBR(i.valorUnitario||0))}" oninput="window.calcNFTotal()"></div>
          <div><label class="j-label">Desc.</label><input class="j-input nf-descvalor" inputmode="decimal" value="${esc(fmtBR(i.desconto||0))}" oninput="window.calcNFTotal()"></div>
          <div><label class="j-label">Venda</label><input class="j-input nf-venda" inputmode="decimal" value="${esc(fmtBR(i.venda || ((Number(i.valorUnitario)||0)*1.5)))}" oninput="window.nfProMarcarVendaManual(this)"></div>
          <div><label class="j-label">EAN</label><input class="j-input nf-ean" value="${esc(i.ean||'')}"></div>
          <button type="button" title="Remover item" onclick="this.closest('.nf-real-row').remove();window.calcNFTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;height:32px;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:110px 110px 130px 1fr;gap:8px;align-items:end;" class="nf-real-grid-operacional">
          <div><label class="j-label">Unid. fiscal</label><input class="j-input nf-unidade" value="${esc(unidade)}"></div>
          <div><label class="j-label">Fator real</label><input class="j-input nf-fator-operacional" inputmode="decimal" value="${esc(fmtQtd(fatorReal))}" oninput="window._nfeProAtualizarQuantidadeOperacional(this)"></div>
          <div><label class="j-label">Qtd operacional</label><input class="j-input nf-qtd-operacional" inputmode="decimal" value="${esc(fmtQtd(qtdOperacional))}" oninput="window._nfeProAtualizarSaldoDestino(this)"></div>
          <div style="font-family:var(--fm);font-size:.64rem;color:var(--muted);line-height:1.45;"><b>Fator real = quantidade física real total.</b> Ex.: XML com 2 KIT = 2 real = 2 operacional. Dividir entre O.S./veículos apenas distribui essa quantidade; não multiplica. Disco de freio com 1 unidade fiscal pode sugerir 2.</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;align-items:end;" class="nf-real-grid-fiscal">
          <div><label class="j-label">NCM</label><input class="j-input nf-ncm-input" value="${esc(i.ncm||'')}"></div>
          <div><label class="j-label">CFOP</label><input class="j-input nf-cfop-input" value="${esc(i.cfop||'')}"></div>
          <div><label class="j-label">CEST</label><input class="j-input nf-cest-input" value="${esc(i.cest||'')}"></div>
          <div><label class="j-label">Total item XML</label><input class="j-input" value="R$ ${esc(fmtBR(i.valorLiquido || ((i.quantidade||1)*(i.valorUnitario||0)-(i.desconto||0))))}" readonly></div>
        </div>
        <div style="display:grid;grid-template-columns:170px minmax(220px,1fr) minmax(160px,1fr);gap:8px;align-items:end;" class="nf-real-grid-destino">
          <div><label class="j-label">Destino real da peça</label><select class="j-select nf-finalidade" onchange="window._nfeProToggleDestino(this)">${destinoOptionHTMLNF(destino)}</select></div>
          <div class="nf-os-wrap" style="display:${destino==='os'?'block':'none'}">
            <label class="j-label">Selecionar O.S. em atendimento</label>
            <input class="j-input nf-os-busca" value="${esc(destinoBase.vinculo || destinoBase.placa || i.vinculo || i.placa || '')}" placeholder="Buscar placa / O.S. / cliente em atendimento" oninput="window.nfProFiltrarOS(this)" style="margin-bottom:6px;">
            <select class="j-select nf-os-select" onchange="window.nfProSelecionouOS(this)"><option value="">Escolha pela placa / O.S. / cliente...</option>${options}</select>
            <small class="nf-os-alert" style="display:block;margin-top:4px;color:var(--muted);font-family:var(--fm);font-size:.62rem;">Lista limitada a O.S. em atendimento.</small>
          </div>
          <div><label class="j-label">Placa/finalidade/observação</label><input class="j-input nf-vinculo" value="${esc(destinoBase.vinculo || i.vinculo || '')}" placeholder="Ex.: ABC1234, garantia, uso interno..."></div>
        </div>
        <div class="nf-destinos-extra-wrap" style="display:grid;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span class="nf-destinos-saldo" style="font-family:var(--fm);font-size:.64rem;color:var(--muted);">Destino principal recebe a quantidade operacional restante.</span>
            <button type="button" class="btn-outline" style="padding:6px 10px;font-size:.62rem;" onclick="window._nfeProAdicionarDestinoSplit(this)">+ DIVIDIR DESTINO</button>
          </div>
          <div class="nf-destinos-split" style="display:grid;gap:8px;">${destinosExtrasHTMLNF(i)}</div>
        </div>
        <div style="font-family:var(--fm);font-size:.64rem;color:var(--muted);display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" class="nf-real-tributos">
          <span>NCM: <b class="nf-ncm">${esc(i.ncm||'')}</b></span><span>CFOP: <b class="nf-cfop">${esc(i.cfop||'')}</b></span><span>CEST: <b class="nf-cest">${esc(i.cest||'')}</b></span><span>Total item: <b class="nf-total-item">R$ ${fmtBR(i.valorLiquido || ((i.quantidade||1)*(i.valorUnitario||0)-(i.desconto||0)))}</b></span>
        </div>
        <input type="hidden" class="nf-json" value="${esc(JSON.stringify(i))}">
      </div>`;
  }
  W._nfeProToggleDestino = function(sel){
    const row = sel.closest('.nf-real-row');
    const wrap = row?.querySelector('.nf-os-wrap');
    if(wrap) wrap.style.display = sel.value === 'os' ? 'block' : 'none';
    if(sel.value !== 'os'){
      const osSel = row?.querySelector('.nf-os-select');
      const osBusca = row?.querySelector('.nf-os-busca');
      if(osSel) osSel.value = '';
      if(osBusca) osBusca.value = '';
      restaurarPrecoAutomaticoFrotistaNF(row);
    }
    W._nfeProAtualizarSaldoDestino(sel);
    atualizarStatusLinhaLoteNF(row);
  };
  W._nfeProToggleDestinoSplit = function(sel){
    const split = sel?.closest?.('.nf-split-row');
    const wrap = split?.querySelector('.nf-split-os-wrap');
    if(wrap) wrap.style.display = sel.value === 'os' ? 'block' : 'none';
    if(sel?.value !== 'os'){
      const osSel = split?.querySelector('.nf-split-os-select');
      const osBusca = split?.querySelector('.nf-split-os-busca');
      if(osSel) osSel.value = '';
      if(osBusca) osBusca.value = '';
    }
  };
  W._nfeProAtualizarQuantidadeOperacional = function(input){
    const row = input?.closest?.('.nf-real-row');
    if(!row) return;
    const q = parseNum(row.querySelector('.nf-qtd')?.value) || 0;
    const realEl = row.querySelector('.nf-fator-operacional');
    const qop = row.querySelector('.nf-qtd-operacional');

    let qtdReal = parseNum(realEl?.value) || 0;

    // Se o gestor alterar a quantidade fiscal, recalcula a sugestão real sem multiplicar.
    // KIT/JOGO acompanha o XML (2 => 2). Disco 1 UN pode sugerir 2.
    if (input?.classList?.contains('nf-qtd')) {
      qtdReal = quantidadeRealSugeridaNF({
        quantidadeFiscal: q,
        quantidade: q,
        unidade: row.querySelector('.nf-unidade')?.value || 'UN',
        descricao: row.querySelector('.nf-desc')?.value || ''
      });
      if(realEl) realEl.value = fmtQtd(qtdReal);
    }

    // O campo visível "Fator real" é a própria quantidade real total.
    // Portanto 2 fiscal + 2 real = 2 operacional, e não 4.
    if(qop) qop.value = fmtQtd(qtdReal);
    W._nfeProAtualizarSaldoDestino(input);
  };
  W._nfeProAtualizarSaldoDestino = function(input){
    const row = input?.closest?.('.nf-real-row');
    if(!row) return;
    const qop = parseNum(row.querySelector('.nf-qtd-operacional')?.value) || 0;
    // Se a quantidade operacional for corrigida manualmente, mantenha o "Fator real" sincronizado.
    if (input?.classList?.contains('nf-qtd-operacional')) {
      const realEl = row.querySelector('.nf-fator-operacional');
      if(realEl) realEl.value = fmtQtd(qop);
    }
    const extras = Array.from(row.querySelectorAll('.nf-split-qtd')).reduce((s, el) => s + (parseNum(el.value) || 0), 0);
    const saldo = Math.round((qop - extras) * 1000) / 1000;
    const el = row.querySelector('.nf-destinos-saldo');
    if(el) {
      el.textContent = saldo < 0
        ? `Atenção: destinos extras excedem a qtd operacional em ${fmtQtd(Math.abs(saldo))}.`
        : `Destino principal receberá ${fmtQtd(saldo)} peça(s) real(is).`;
      el.style.color = saldo < 0 ? 'var(--danger)' : 'var(--muted)';
    }
  };
  W._nfeProAdicionarDestinoSplit = function(btn){
    const row = btn?.closest?.('.nf-real-row');
    const box = row?.querySelector('.nf-destinos-split');
    if(!row || !box) return;
    box.insertAdjacentHTML('beforeend', splitDestinoTemplateNF({ qtd: 1, destino: 'estoque' }));
    W._nfeProAtualizarSaldoDestino(row);
  };
  W.nfProFiltrarOS = function(input){
    const row = input?.closest?.('.nf-real-row');
    const sel = row?.querySelector('.nf-os-select');
    if(!sel) return;
    const old = sel.value;
    const lista = listaOSDestinoNF(old, input.value || '');
    const vinc = row.querySelector('.nf-vinculo');
    if(vinc && input.value && (!vinc.value || normalizePlateNF(vinc.value) === normalizePlateNF(input.value))) vinc.value = String(input.value || '').toUpperCase();
    sel.innerHTML = `<option value="">Escolha pela placa / O.S. / cliente...</option>` + lista.map(o => {
      const v = (W.J?.veiculos || []).find(x => x.id === o.veiculoId) || {};
      const c = (W.J?.clientes || []).find(x => x.id === o.clienteId) || {};
      const placa = (o.placa || v.placa || 'S/PLACA').toUpperCase();
      const veic = [v.marca, v.modelo || o.veiculo].filter(Boolean).join(' ') || 'Veiculo';
      const data = brDate((o.data || o.createdAt || o.updatedAt || '').slice(0,10));
      const status = o.status || 'em atendimento';
      const label = `${placa} - ${veic} - ${c.nome || o.cliente || 'Cliente'} - O.S. #${String(o.id||'').slice(-6).toUpperCase()} - ${status}${data ? ' - ' + data : ''}`;
      return `<option value="${esc(o.id)}" data-placa="${esc(placa)}" ${String(old||'')===String(o.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
    if(old && Array.from(sel.options).some(opt => opt.value === old)) sel.value = old;
    const alert = row.querySelector('.nf-os-alert');
    if(alert) alert.textContent = lista.length ? `${lista.length} O.S. em atendimento encontrada(s).` : 'Nenhuma O.S. em atendimento encontrada para esta busca.';
  };
  W.nfProSelecionouOS = function(sel){
    const row = sel?.closest?.('.nf-real-row');
    const os = (W.J?.os || []).find(o => String(o.id || '') === String(sel?.value || ''));
    if(!row || !os) return;
    const placa = placaDaOSNF(os);
    const busca = row.querySelector('.nf-os-busca');
    if(busca) busca.value = placa || busca.value || '';
    const vinc = row.querySelector('.nf-vinculo');
    if(vinc) vinc.value = [placa, 'OS ' + String(os.id || '').slice(-6).toUpperCase()].filter(Boolean).join(' / ');
    aplicarPrecoFrotistaNaLinhaNF(row, os);
    atualizarStatusLinhaLoteNF(row);
  };
  W.nfProFiltrarOSSplit = function(input){
    const split = input?.closest?.('.nf-split-row');
    const sel = split?.querySelector('.nf-split-os-select');
    if(!sel) return;
    const old = sel.value;
    const lista = listaOSDestinoNF(old, input.value || '');
    const vinc = split.querySelector('.nf-split-vinculo');
    if(vinc && input.value && (!vinc.value || normalizePlateNF(vinc.value) === normalizePlateNF(input.value))) vinc.value = String(input.value || '').toUpperCase();
    sel.innerHTML = `<option value="">Escolha a O.S.</option>` + lista.map(o => {
      const v = (W.J?.veiculos || []).find(x => x.id === o.veiculoId) || {};
      const c = (W.J?.clientes || []).find(x => x.id === o.clienteId) || {};
      const placa = (o.placa || v.placa || 'S/PLACA').toUpperCase();
      const veic = [v.marca, v.modelo || o.veiculo].filter(Boolean).join(' ') || 'Veiculo';
      const status = o.status || 'em atendimento';
      const label = `${placa} - ${veic} - ${c.nome || o.cliente || 'Cliente'} - O.S. #${String(o.id||'').slice(-6).toUpperCase()} - ${status}`;
      return `<option value="${esc(o.id)}" data-placa="${esc(placa)}" ${String(old||'')===String(o.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
    if(old && Array.from(sel.options).some(opt => opt.value === old)) sel.value = old;
  };
  W.nfProSelecionouOSSplit = function(sel){
    const split = sel?.closest?.('.nf-split-row');
    const os = (W.J?.os || []).find(o => String(o.id || '') === String(sel?.value || ''));
    if(!split || !os) return;
    const placa = placaDaOSNF(os);
    const busca = split.querySelector('.nf-split-os-busca');
    if(busca) busca.value = placa || busca.value || '';
    const vinc = split.querySelector('.nf-split-vinculo');
    if(vinc) vinc.value = [placa, 'OS ' + String(os.id || '').slice(-6).toUpperCase()].filter(Boolean).join(' / ');
  };
  function formaPagamentoNFNorm(forma){
    return String(forma || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  function formaPagamentoNFParcelavel(forma){
    const f = formaPagamentoNFNorm(forma);
    return f.includes('boleto') || f.includes('parcelado') || f.includes('credito');
  }
  function formaPagamentoNFAVista(forma){
    const f = formaPagamentoNFNorm(forma);
    return f.includes('pix') || f.includes('dinheiro') || f.includes('debito');
  }
  function ensureFormaPagamentoNFOptions(){
    const sel = $('nfPgtoForma');
    if(!sel) return;
    const atual = sel.value || 'Dinheiro';
    const opts = [
      ['Dinheiro','Dinheiro'],
      ['PIX','PIX'],
      ['Cartão de Débito','Cartão de Débito'],
      ['Cartão de Crédito','Cartão de Crédito'],
      ['Boleto','Boleto (Pendente)'],
      ['Parcelado','Parcelado (Títulos)'],
      ['AgrupamentoPeriodo','Agrupamento por período']
    ];
    opts.forEach(([value,label]) => {
      if(!sel.querySelector(`option[value="${value}"]`)){
        sel.insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(label)}</option>`);
      }
    });
    if(atual && sel.querySelector(`option[value="${atual}"]`)) sel.value = atual;
  }
  function ensureParcelasNFOptions(minParcelas){
    const sel = $('nfParcelas');
    if(!sel) return;
    const atual = parseInt(sel.value || '1', 10) || 1;
    const limite = Math.max(10, parseInt(minParcelas || 0, 10) || 0);
    const desejado = Math.max(limite, atual);
    sel.innerHTML = '';
    for(let i=1;i<=desejado;i++){
      sel.insertAdjacentHTML('beforeend', `<option value="${i}">${i}x</option>`);
    }
    sel.value = String(Math.min(Math.max(atual, 1), desejado));
  }
  function renderParcels(dups){
    let box = $('nfParcelasBox');
    if(!box){
      const div = D.createElement('div'); div.id='nfParcelasBox';
      div.style.cssText='margin-top:10px;border:1px solid var(--border);background:rgba(0,0,0,.08);border-radius:4px;padding:10px;display:none;';
      const anchor = $('divParcelasNF')?.parentElement || $('nfPgtoForma')?.closest('.form-row') || $('containerItensNF')?.parentElement;
      anchor?.insertAdjacentElement('afterend', div); box = div;
    }
    const arr = Array.isArray(dups) ? dups : [];
    if(!arr.length){ box.style.display='none'; box.innerHTML=''; return; }
    box.style.display='block';
    box.innerHTML = `<div style="font-family:var(--fd);font-weight:800;margin-bottom:8px;color:var(--accent)">DUPLICATAS / BOLETOS DA NF</div>` + arr.map((d,idx)=>`
      <div class="nf-parcela-row" style="display:grid;grid-template-columns:80px 1fr 1fr;gap:8px;margin-bottom:6px;align-items:end;">
        <div><label class="j-label">Parc.</label><input class="j-input nf-parc-num" value="${esc(d.numero || String(idx+1).padStart(3,'0'))}" oninput="this.closest('#nfParcelasBox').dataset.manualEdit='1'"></div>
        <div><label class="j-label">Vencimento</label><input type="date" class="j-input nf-parc-venc" value="${esc(d.vencimento || '')}" onchange="this.closest('#nfParcelasBox').dataset.manualEdit='1'"></div>
        <div><label class="j-label">Valor</label><input class="j-input nf-parc-valor" inputmode="decimal" value="${esc(fmtBR(d.valor||0))}" oninput="this.closest('#nfParcelasBox').dataset.manualEdit='1'"></div>
      </div>`).join('');
  }
  function ensureAgrupamentoPeriodoBox(){
    let box = $('nfAgrupamentoPeriodoBox');
    if(!box){
      const div = D.createElement('div');
      div.id = 'nfAgrupamentoPeriodoBox';
      div.style.cssText = 'margin-top:10px;border:1px solid var(--border);background:rgba(0,212,255,.055);border-radius:4px;padding:10px;display:none;';
      const anchor = $('nfParcelasBox') || $('divParcelasNF')?.parentElement || $('containerItensNF')?.parentElement;
      anchor?.insertAdjacentElement('afterend', div);
      box = div;
    }
    box.innerHTML = `
      <div style="font-family:var(--fd);font-weight:800;margin-bottom:8px;color:var(--cyan)">AGRUPAMENTO POR FORNECEDOR / PERIODO</div>
      <div class="form-row cols-3">
        <div class="form-group"><label class="j-label">Periodo de agrupamento</label><input type="number" inputmode="numeric" class="j-input" id="nfAgrPeriodoDias" min="1" step="1" value="${esc($('nfAgrPeriodoDias')?.value || '7')}"></div>
        <div class="form-group"><label class="j-label">Vencimento do boleto agrupado</label><input type="date" class="j-input" id="nfAgrVenc" value="${esc($('nfAgrVenc')?.value || getVal('nfVenc') || isoToday())}"></div>
        <div class="form-group"><label class="j-label">Status inicial</label><select class="j-select" id="nfAgrStatus"><option value="Pendente">Pendente</option><option value="Aguardando Boleto">Aguardando Boleto</option></select></div>
      </div>
      <small style="display:block;color:var(--muted);font-family:var(--fm);font-size:.64rem;">A compra fica marcada para somar com outras compras do mesmo fornecedor no mesmo periodo. O vencimento informado e o vencimento do boleto consolidado.</small>
    `;
    return box;
  }
  function mostrarAgrupamentoPeriodoNF(show){
    const box = ensureAgrupamentoPeriodoBox();
    box.style.display = show ? 'block' : 'none';
  }
  function gerarParcelasManuais(){
    ensureFormaPagamentoNFOptions();
    ensureParcelasNFOptions();
    const boxParcelas = $('nfParcelasBox');
    if(boxParcelas) boxParcelas.dataset.manualEdit = '';
    const forma = getVal('nfPgtoForma');
    if(forma === 'AgrupamentoPeriodo'){ renderParcels([]); mostrarAgrupamentoPeriodoNF(true); return; }
    if(!formaPagamentoNFParcelavel(forma)){ renderParcels([]); return; }
    const n = parseInt(getVal('nfParcelas') || '1',10) || 1;
    const base = getVal('nfVenc') || isoToday();
    const total = calcTotaisNF().totalFiscal;
    const dups = [];
    const baseDate = new Date(base + 'T12:00:00');
    let acumulado = 0;
    for(let i=0;i<n;i++){
      const d = new Date(baseDate); d.setMonth(d.getMonth()+i);
      const iso = d.toISOString().slice(0,10);
      const valor = i === n - 1 ? Math.round((total - acumulado) * 100) / 100 : Math.round((total/n)*100)/100;
      acumulado = Math.round((acumulado + valor) * 100) / 100;
      dups.push({ numero:String(i+1).padStart(3,'0'), vencimento:iso, valor });
    }
    renderParcels(dups);
  }
  function calcTotalNumber(){
    let total = 0;
    D.querySelectorAll('#containerItensNF .nf-real-row').forEach(row=>{
      const q = parseNum(row.querySelector('.nf-qtd')?.value);
      const custo = parseNum(row.querySelector('.nf-custo')?.value);
      const desc = parseNum(row.querySelector('.nf-descvalor')?.value);
      const itemTotal = Math.max(q*custo - desc, 0);
      total += itemTotal;
      const totalEl = row.querySelector('.nf-total-item'); if(totalEl) totalEl.textContent = 'R$ ' + fmtBR(itemTotal);
    });
    return Math.round(total*100)/100;
  }
  W.calcNFTotal = function(){
    const totais = calcTotaisNF();
    const total = totais.totalFiscal;
    const el = $('nfTotal'); if(el) el.textContent = fmtBR(total);
    const current = W._nfeProData;
    if(current && current.totais && current.totais.vNF && Math.abs(totais.totalItens - current.totais.vNF) > 0.02){
      if(el) el.title = `Atenção: total dos itens (${fmtBR(totais.totalItens)}) difere do total fiscal da NF (${fmtBR(current.totais.vNF)}). O financeiro usa o total fiscal.`;
    }
    const boxParcelas = $('nfParcelasBox');
    if(boxParcelas?.style.display === 'block' && boxParcelas.dataset.manualEdit !== '1' && !(W._nfeProData?.cobranca?.duplicatas || []).length) gerarParcelasManuais();
  };
  W.checkPgtoNF = function(){
    ensureFormaPagamentoNFOptions();
    ensureParcelasNFOptions();
    const forma = getVal('nfPgtoForma');
    if($('divParcelasNF')) $('divParcelasNF').style.display = formaPagamentoNFParcelavel(forma) ? 'block' : 'none';
    mostrarAgrupamentoPeriodoNF(forma === 'AgrupamentoPeriodo');
    if(formaPagamentoNFParcelavel(forma) || forma === 'AgrupamentoPeriodo') gerarParcelasManuais(); else renderParcels([]);
  };
  function preencherFornecedorTemporario(fornec){
    if(!$('nfFornec') || !fornec) return;
    const cnpj = onlyDigits(fornec.cnpj);
    let existente = (W.J?.fornecedores || []).find(f => onlyDigits(f.cnpj || f.doc || f.documento) === cnpj || String(f.nome||'').toLowerCase() === String(fornec.nome||'').toLowerCase());
    if(existente){ $('nfFornec').value = existente.id; return; }
    const tempId = '__xml__' + cnpj;
    if(!$('nfFornec').querySelector(`option[value="${tempId}"]`)){
      const opt = D.createElement('option'); opt.value = tempId; opt.textContent = `${fornec.nome || 'Fornecedor XML'} — ${cnpj || 'sem CNPJ'} (novo)`; opt.dataset.xmlFornecedor = JSON.stringify(fornec);
      $('nfFornec').appendChild(opt);
    }
    $('nfFornec').value = tempId;
  }
  function renderFiscalResumo(nfe){
    let box = $('nfFiscalResumo');
    if(!box){
      box = D.createElement('div'); box.id='nfFiscalResumo';
      box.style.cssText='border:1px solid var(--border);background:rgba(0,255,170,.035);border-radius:4px;padding:10px;margin:10px 0;font-family:var(--fm);font-size:.72rem;line-height:1.55;';
      $('containerItensNF')?.parentElement?.insertAdjacentElement('beforebegin', box);
    }
    if(!nfe){ box.innerHTML=''; box.style.display='none'; return; }
    box.style.display='block';
    box.innerHTML = `<b style="color:var(--accent)">ESPELHO FISCAL DA NF-E</b><br>
      Chave: <b>${esc(nfe.chave)}</b> · NF: <b>${esc(nfe.numero)}</b> / Série <b>${esc(nfe.serie)}</b> · Emissão: <b>${brDate(nfe.dataEmissao)}</b><br>
      Fornecedor: <b>${esc(nfe.fornecedor.nome)}</b> · CNPJ: <b>${esc(nfe.fornecedor.cnpj)}</b> · IE: <b>${esc(nfe.fornecedor.ie)}</b><br>
      Natureza: <b>${esc(nfe.natureza)}</b> · Protocolo: <b>${esc(nfe.protocolo)}</b> · Status: <b>${esc(nfe.statusAutorizacao)} ${esc(nfe.motivoAutorizacao)}</b><br>
      Produtos: <b>R$ ${fmtBR(nfe.totais.vProd)}</b> · Desc.: <b>R$ ${fmtBR(nfe.totais.vDesc)}</b> · IPI: <b>R$ ${fmtBR(nfe.totais.vIPI)}</b> · Total NF: <b>R$ ${fmtBR(nfe.totais.vNF)}</b>`;
  }
  function ensureTotaisFiscaisBoxNF(){
    let box = $('nfTotaisFiscaisBox');
    if(!box){
      box = D.createElement('div');
      box.id = 'nfTotaisFiscaisBox';
      box.style.cssText = 'border:1px solid rgba(255,184,0,.28);background:rgba(255,184,0,.045);border-radius:4px;padding:10px;margin:10px 0;font-family:var(--fm);font-size:.72rem;';
      const anchor = $('containerItensNF')?.parentElement;
      anchor?.insertAdjacentElement('afterend', box);
    }
    if(!box.dataset.rendered){
      box.dataset.rendered = '1';
      box.innerHTML = `
      <div style="font-family:var(--fd);font-weight:800;margin-bottom:8px;color:var(--warn)">TOTAIS FISCAIS / DESPESAS ACESSORIAS</div>
      <div class="form-row cols-5" style="align-items:end;margin:0;">
        <div class="form-group" style="margin:0;"><label class="j-label">Frete</label><input class="j-input" id="nfFrete" inputmode="decimal" value="${esc($('nfFrete')?.value || '0,00')}" oninput="window._nfeTotalFiscalManual=false;window.calcNFTotal()"></div>
        <div class="form-group" style="margin:0;"><label class="j-label">Seguro</label><input class="j-input" id="nfSeguro" inputmode="decimal" value="${esc($('nfSeguro')?.value || '0,00')}" oninput="window._nfeTotalFiscalManual=false;window.calcNFTotal()"></div>
        <div class="form-group" style="margin:0;"><label class="j-label">Outras despesas</label><input class="j-input" id="nfOutrasDespesas" inputmode="decimal" value="${esc($('nfOutrasDespesas')?.value || '0,00')}" oninput="window._nfeTotalFiscalManual=false;window.calcNFTotal()"></div>
        <div class="form-group" style="margin:0;"><label class="j-label">Desconto fiscal extra</label><input class="j-input" id="nfDescontoFiscal" inputmode="decimal" value="${esc($('nfDescontoFiscal')?.value || '0,00')}" oninput="window._nfeTotalFiscalManual=false;window.calcNFTotal()"></div>
        <div class="form-group" style="margin:0;"><label class="j-label">Total fiscal da NF</label><input class="j-input" id="nfTotalFiscal" inputmode="decimal" value="${esc($('nfTotalFiscal')?.value || '0,00')}" oninput="window._nfeTotalFiscalManual=true;window.calcNFTotal()" title="Use o total fiscal real do XML ou da nota manual. O financeiro usa este valor."></div>
      </div>
      <small id="nfTotaisFiscaisHint" style="display:block;margin-top:8px;color:var(--muted);font-family:var(--fm);font-size:.64rem;">Total fiscal = itens + frete + seguro + outras despesas - desconto fiscal extra. XML preserva o total fiscal original.</small>`;
    }
    return box;
  }
  function setTotaisFiscaisNF(totais, opts = {}){
    ensureTotaisFiscaisBoxNF();
    setVal('nfFrete', fmtBR(totais?.vFrete || totais?.frete || 0));
    setVal('nfSeguro', fmtBR(totais?.vSeg || totais?.seguro || 0));
    setVal('nfOutrasDespesas', fmtBR(totais?.vOutro || totais?.outrasDespesas || 0));
    setVal('nfDescontoFiscal', fmtBR(totais?.descontoFiscalExtra || 0));
    const totalFiscal = Number(totais?.vNF ?? totais?.totalNF ?? 0) || 0;
    if(totalFiscal || opts.forceTotal) setVal('nfTotalFiscal', fmtBR(totalFiscal));
    W._nfeTotalFiscalManual = opts.manualTotal === true;
  }
  function calcTotaisNF(){
    ensureTotaisFiscaisBoxNF();
    const totalItens = calcTotalNumber();
    const frete = parseNum($('nfFrete')?.value);
    const seguro = parseNum($('nfSeguro')?.value);
    const outras = parseNum($('nfOutrasDespesas')?.value);
    const descontoFiscal = parseNum($('nfDescontoFiscal')?.value);
    const calculado = Math.max(totalItens + frete + seguro + outras - descontoFiscal, 0);
    if(!W._nfeTotalFiscalManual) setVal('nfTotalFiscal', fmtBR(calculado));
    const totalFiscal = parseNum($('nfTotalFiscal')?.value) || calculado;
    const hint = $('nfTotaisFiscaisHint');
    if(hint) hint.textContent = `Itens: R$ ${fmtBR(totalItens)} | Frete: R$ ${fmtBR(frete)} | Seguro: R$ ${fmtBR(seguro)} | Outras: R$ ${fmtBR(outras)} | Desconto extra: R$ ${fmtBR(descontoFiscal)} | Total fiscal usado no financeiro: R$ ${fmtBR(totalFiscal)}`;
    return {
      totalItens: Math.round(totalItens * 100) / 100,
      frete: Math.round(frete * 100) / 100,
      seguro: Math.round(seguro * 100) / 100,
      outrasDespesas: Math.round(outras * 100) / 100,
      descontoFiscalExtra: Math.round(descontoFiscal * 100) / 100,
      totalCalculado: Math.round(calculado * 100) / 100,
      totalFiscal: Math.round(totalFiscal * 100) / 100
    };
  }
  W.thiaNFSetTotaisFiscais = setTotaisFiscaisNF;
  W.thiaNFCalcTotaisFiscais = calcTotaisNF;
  function ensureTipoOperacaoNF(nfe){
    let box = $('nfTipoOperacaoBox');
    if(!box){
      box = D.createElement('div'); box.id='nfTipoOperacaoBox';
      box.style.cssText='border:1px solid rgba(0,212,255,.20);background:rgba(0,212,255,.045);border-radius:4px;padding:10px;margin:10px 0;font-family:var(--fm);font-size:.72rem;';
      $('containerItensNF')?.parentElement?.insertAdjacentElement('beforebegin', box);
    }
    const natureza = nfe?.natureza ? `<br><span style="color:var(--muted);">Natureza XML: <b>${esc(nfe.natureza)}</b></span>` : '';
    box.innerHTML = `
      <div class="form-row cols-2" style="align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="j-label">Tipo da nota</label>
          <select class="j-select" id="nfTipoOperacao" onchange="window.nfeProTipoOperacaoChanged && window.nfeProTipoOperacaoChanged()">
            <option value="entrada">Nota de entrada / compra</option>
            <option value="saida">Nota de saída</option>
            <option value="devolucao">Nota de devolução</option>
            <option value="garantia">Nota de garantia</option>
            <option value="remessa">Nota de remessa</option>
            <option value="outro">Outro tipo de nota</option>
          </select>
        </div>
        <div style="color:var(--muted2);line-height:1.45;">O XML não muda o tipo sozinho. Para abater estoque/NF original, selecione <b>Nota de devolução</b>.${natureza}</div>
      </div>`;
    if(!$('nfTipoOperacao')?.value) $('nfTipoOperacao').value = 'entrada';
    return box;
  }
  function setTipoOperacaoNF(tipo){
    ensureTipoOperacaoNF(W._nfeProData || null);
    const el = $('nfTipoOperacao');
    if(el) el.value = tipo || 'entrada';
  }
  function tipoOperacaoNF(){
    return String($('nfTipoOperacao')?.value || 'entrada').toLowerCase().trim() || 'entrada';
  }
  W.nfeProTipoOperacaoChanged = function(){
    renderDevolucaoBox(W._nfeProData || null);
  };
  function renderDevolucaoBox(nfe){
    let box = $('nfDevolucaoBox');
    if(!box){
      box = D.createElement('div'); box.id='nfDevolucaoBox';
      box.style.cssText='border:1px solid rgba(255,184,0,.55);background:rgba(255,184,0,.08);border-radius:4px;padding:10px;margin:10px 0;font-family:var(--fm);font-size:.72rem;line-height:1.55;';
      $('containerItensNF')?.parentElement?.insertAdjacentElement('beforebegin', box);
    }
    if(!isNFDevolucao(nfe, nfe?.itens || [])){ box.innerHTML=''; box.style.display='none'; return; }
    const refs = Array.isArray(nfe?.referencias) ? nfe.referencias : [];
    const candidatas = (W.J?.notasFiscaisEntrada || []).filter(n => {
      if(String(n.tipo || '').toLowerCase().includes('devolucao') || n.excluidaAuditada) return false;
      if(refs.length && refs.includes(n.chave)) return true;
      const cnpjA = onlyDigits(n.fornecedorSnapshot?.cnpj || n.fornecedorCNPJ || n.cnpj || '');
      const cnpjB = onlyDigits(nfe?.fornecedor?.cnpj || '');
      return cnpjA && cnpjB && cnpjA === cnpjB;
    });
    const original = candidatas.find(n => refs.includes(n.chave)) || candidatas[0] || null;
    box.style.display='block';
    box.innerHTML = `
      <b style="color:var(--warn)">NF DE DEVOLUCAO / ESTORNO DE COMPRA</b><br>
      ${refs.length ? `Chave(s) referenciada(s) no XML: <b>${esc(refs.join(', '))}</b><br>` : 'XML sem chave referenciada. Selecione manualmente a NF original.<br>'}
      <div class="form-row cols-2" style="margin-top:8px;">
        <div class="form-group"><label class="j-label">NF original para abater</label><select class="j-select" id="nfDevolucaoOriginalId">
          <option value="">Selecione a NF original</option>
          ${candidatas.map(n => `<option value="${esc(n.id)}" ${original && n.id === original.id ? 'selected' : ''}>NF ${esc(n.numero || 's/n')} - ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || '')} - R$ ${fmtBR(n.totalNF || n.totalItens || 0)}</option>`).join('')}
        </select></div>
        <div class="form-group"><label class="j-label">Motivo/observacao</label><input class="j-input" id="nfDevolucaoMotivo" value="Devolucao de mercadoria ao fornecedor"></div>
      </div>
      <div style="margin-top:8px;color:var(--muted);">Ao salvar, o sistema grava a NF de devolucao, marca os itens devolvidos na NF original, baixa estoque/vinculos quando encontrados e cria credito/abatimento financeiro auditado.</div>`;
  }
  function cnpjFornecedorNF(nfe){
    return onlyDigits(nfe?.fornecedor?.cnpj || nfe?.fornecedorCNPJ || nfe?.cnpj || '');
  }
  async function buscarNFeDuplicada(nfe){
    if(!W.db || !W.J?.tid || !nfe) return null;
    const cols = ['notas_fiscais_entrada','notasFiscaisEntrada','nfe_entradas'];
    const chave = String(nfe.chave || '').trim();
    const numero = String(nfe.numero || '').trim();
    const serie = String(nfe.serie || '').trim();
    const cnpj = cnpjFornecedorNF(nfe);
    for(const col of cols){
      try{
        if(chave){
          const snap = await W.db.collection(col).where('tenantId','==',W.J.tid).where('chave','==',chave).limit(3).get();
          if(!snap.empty) return { collection:col, id:snap.docs[0].id, data:snap.docs[0].data(), motivo:'chave' };
        }
      }catch(e){ console.warn('[NFe PRO dup chave]', col, e.message); }
      try{
        if(numero){
          const snap = await W.db.collection(col).where('tenantId','==',W.J.tid).where('numero','==',numero).limit(10).get();
          const found = snap.docs.find(d => {
            const x = d.data() || {};
            const xSerie = String(x.serie || '').trim();
            const xCnpj = onlyDigits(x.fornecedorSnapshot?.cnpj || x.fornecedorCNPJ || x.cnpj || '');
            const mesmaSerie = !serie || !xSerie || xSerie === serie;
            const mesmoCnpj = !cnpj || !xCnpj || xCnpj === cnpj;
            return mesmaSerie && mesmoCnpj;
          });
          if(found) return { collection:col, id:found.id, data:found.data(), motivo:'numero_serie_cnpj' };
        }
      }catch(e){ console.warn('[NFe PRO dup numero]', col, e.message); }
    }
    return null;
  }
  function limparTelaNFeDuplicada(){
    W._nfeProData = null;
    if($('containerItensNF')) $('containerItensNF').innerHTML = '';
    if($('nfTotal')) $('nfTotal').textContent = '0,00';
    renderParcels([]);
  }
  function mostrarNFeDuplicada(nfe, dup){
    limparTelaNFeDuplicada();
    renderFiscalResumo(nfe);
    let box = $('nfDuplicadaAviso');
    if(!box){
      box = D.createElement('div');
      box.id = 'nfDuplicadaAviso';
      box.style.cssText = 'border:1px solid rgba(255,184,0,.45);background:rgba(255,184,0,.08);border-radius:4px;padding:12px;margin:10px 0;font-family:var(--fm);font-size:.72rem;line-height:1.55;color:var(--warn);';
      $('containerItensNF')?.parentElement?.insertAdjacentElement('beforebegin', box);
    }
    const d = dup?.data || {};
    const fornecedor = d.fornecedorSnapshot?.nome || d.fornecedorNome || nfe?.fornecedor?.nome || 'Fornecedor';
    box.style.display = 'block';
    box.innerHTML = `
      <b>NF-E JA IMPORTADA - REIMPORTACAO BLOQUEADA</b><br>
      NF ${esc(nfe?.numero || d.numero || '-')} / Serie ${esc(nfe?.serie || d.serie || '-')} - ${esc(fornecedor)}<br>
      Chave: <b>${esc(nfe?.chave || d.chave || '-')}</b><br>
      Importada em: ${esc((d.createdAt || d.dataNF || '').slice(0,10) || 'data nao registrada')} - Colecao: ${esc(dup?.collection || '-')} - Motivo: ${esc(dup?.motivo || 'duplicidade')}<br>
      <button type="button" class="btn-outline" style="margin-top:8px;" onclick="window.abrirNFeDuplicadaExistente('${esc(dup?.collection || '')}','${esc(dup?.id || '')}')">ABRIR NOTA EXISTENTE</button>`;
    if(typeof W.toast === 'function') W.toast(`NF-e ${nfe?.numero || ''} ja importada. Reimportacao bloqueada para nao duplicar estoque/financeiro.`, 'warn');
  }
  W.abrirNFeDuplicadaExistente = function(col, id){
    if(!id) return;
    if(col === 'notas_fiscais_entrada' && typeof W.editarDocFiscal === 'function'){
      W.editarDocFiscal(id);
      return;
    }
    if(typeof W.toast === 'function') W.toast('Nota localizada em colecao legada: ' + col + '. Abra pela busca fiscal pelo numero/chave.', 'warn');
  };
  W.prepNF = function(){
    W._nfeProData = null;
    ensureNFVinculoLoteUI();
    const dup = $('nfDuplicadaAviso'); if(dup) { dup.style.display='none'; dup.innerHTML=''; }
    setVal('nfNumero',''); setVal('nfData', isoToday()); setVal('nfVenc','');
    if($('containerItensNF')) $('containerItensNF').innerHTML = '';
    if($('nfTotal')) $('nfTotal').textContent = '0,00';
    if($('nfPgtoForma')) {
      ensureFormaPagamentoNFOptions();
      $('nfPgtoForma').value = 'Dinheiro';
    }
    if($('nfParcelas')) { ensureParcelasNFOptions(); $('nfParcelas').value='1'; $('nfParcelas').onchange = gerarParcelasManuais; }
    if($('nfVenc')) $('nfVenc').onchange = gerarParcelasManuais;
    setTotaisFiscaisNF({ vFrete:0, vSeg:0, vOutro:0, descontoFiscalExtra:0, vNF:0 }, { manualTotal:false, forceTotal:true });
    mostrarAgrupamentoPeriodoNF(false);
    if(typeof W.popularSelects === 'function') W.popularSelects();
    ensureTipoOperacaoNF(null); setTipoOperacaoNF('entrada');
    renderFiscalResumo(null); renderDevolucaoBox(null); renderParcels([]); W.adicionarItemNF(); W.checkPgtoNF();
  };
  W.lerXMLNFe = function(event){
    const file = event?.target?.files?.[0]; if(!file) return;
    const r = new FileReader();
    r.onload = async function(ev){
      try{
        const nfe = parseNFeXML(String(ev.target.result || ''));
        const duplicada = await buscarNFeDuplicada(nfe);
        if(duplicada){
          mostrarNFeDuplicada(nfe, duplicada);
          return;
        }
        const dup = $('nfDuplicadaAviso'); if(dup) { dup.style.display='none'; dup.innerHTML=''; }
        W._nfeProData = nfe;
        setVal('nfNumero', nfe.numero); setVal('nfData', nfe.dataEmissao || isoToday());
        setTotaisFiscaisNF(nfe.totais || {}, { manualTotal:true, forceTotal:true });
        preencherFornecedorTemporario(nfe.fornecedor);
        if($('containerItensNF')) $('containerItensNF').innerHTML = nfe.itens.map(rowTemplate).join('');
        ensureNFVinculoLoteUI();
        atualizarContadorLoteNF();
        ensureTipoOperacaoNF(nfe); setTipoOperacaoNF('entrada');
        renderFiscalResumo(nfe);
        renderDevolucaoBox(nfe);
        if(nfe.cobranca.duplicatas.length){
          if($('nfPgtoForma')) $('nfPgtoForma').value = 'Boleto';
          if($('nfParcelas')) { ensureParcelasNFOptions(nfe.cobranca.duplicatas.length); $('nfParcelas').value = String(nfe.cobranca.duplicatas.length); }
          setVal('nfVenc', nfe.cobranca.duplicatas[0].vencimento || '');
          renderParcels(nfe.cobranca.duplicatas);
        } else {
          if($('nfPgtoForma')) $('nfPgtoForma').value = 'Dinheiro';
          renderParcels([]);
        }
        W.checkPgtoNF();
        W.calcNFTotal();
        const msg = `✓ XML importado: NF ${nfe.numero} — ${nfe.itens.length} item(ns) — Total R$ ${fmtBR(nfe.totais.vNF || calcTotalNumber())}`;
        if(typeof W.toast === 'function') W.toast(msg); else alert(msg);
        if(typeof W.audit === 'function') W.audit('ESTOQUE/NF', `Importou XML NFe ${nfe.numero} (${nfe.chave}) de ${nfe.fornecedor.nome}`);
      }catch(e){ console.error('[NFe PRO] Falha XML:', e); if(typeof W.toast==='function') W.toast('✕ XML inválido ou não reconhecido: '+e.message,'err'); else alert(e.message); }
      if($('xmlInputFile')) $('xmlInputFile').value='';
    };
    r.readAsText(file);
  };
  W.adicionarItemNF = function(item){
    ensureNFVinculoLoteUI();
    if($('containerItensNF')) $('containerItensNF').insertAdjacentHTML('beforeend', rowTemplate(item || {descricao:'', quantidade:1, valorUnitario:0, desconto:0, venda:0, codigo:'', ean:'', ncm:'', cfop:'', cest:'', destino:'estoque'}));
    atualizarContadorLoteNF();
    W.calcNFTotal();
  };
  function destinoFromMainRowNF(row, qtd){
    const destinoAtual = row.querySelector('.nf-finalidade')?.value || 'estoque';
    const osSel = row.querySelector('.nf-os-select');
    const osId = destinoAtual === 'os' ? (osSel?.value || '') : '';
    const osOpt = destinoAtual === 'os' ? osSel?.selectedOptions?.[0] : null;
    const vinculoLivre = row.querySelector('.nf-vinculo')?.value || '';
    return {
      qtd,
      quantidade: qtd,
      destino: destinoAtual,
      finalidade: destinoAtual,
      osId,
      placa: destinoAtual === 'os' ? (osOpt?.dataset?.placa || '') : (destinoAtual === 'placa' ? normalizePlateNF(vinculoLivre) : ''),
      vinculo: vinculoLivre || osId || ''
    };
  }
  function destinoFromSplitRowNF(split){
    const destinoAtual = split.querySelector('.nf-split-finalidade')?.value || 'estoque';
    const osSel = split.querySelector('.nf-split-os-select');
    const osId = destinoAtual === 'os' ? (osSel?.value || '') : '';
    const osOpt = destinoAtual === 'os' ? osSel?.selectedOptions?.[0] : null;
    const vinculoLivre = split.querySelector('.nf-split-vinculo')?.value || '';
    const qtd = parseNum(split.querySelector('.nf-split-qtd')?.value);
    return {
      qtd,
      quantidade: qtd,
      destino: destinoAtual,
      finalidade: destinoAtual,
      osId,
      placa: destinoAtual === 'os' ? (osOpt?.dataset?.placa || '') : (destinoAtual === 'placa' ? normalizePlateNF(vinculoLivre) : ''),
      vinculo: vinculoLivre || osId || ''
    };
  }
  function collectDestinosNF(row, quantidadeOperacional){
    const extras = Array.from(row.querySelectorAll('.nf-split-row')).map(destinoFromSplitRowNF).filter(d => d.qtd > 0);
    const qtdExtra = extras.reduce((s, d) => s + (Number(d.qtd) || 0), 0);
    const saldoPrincipal = Math.round((Number(quantidadeOperacional || 0) - qtdExtra) * 1000) / 1000;
    if (saldoPrincipal < -0.0001) {
      throw new Error('A soma dos destinos excede a quantidade operacional de uma peça. Ajuste a distribuição antes de salvar.');
    }
    const destinos = [];
    if (saldoPrincipal > 0.0001 || !extras.length) destinos.push(destinoFromMainRowNF(row, Math.max(saldoPrincipal, 0)));
    extras.forEach((d, idx) => destinos.push(Object.assign({}, d, { destinoIndice: idx + 1 })));
    return destinos.map((d, idx) => Object.assign({}, d, { destinoIndice: idx, destinoKey: `destino_${idx}` }));
  }
  function collectItens(){
    return Array.from(D.querySelectorAll('#containerItensNF .nf-real-row')).map(row => {
      let base = {};
      try{ base = JSON.parse(row.querySelector('.nf-json')?.value || '{}'); }catch(_){ base = {}; }
      const qtdFiscal = parseNum(row.querySelector('.nf-qtd')?.value);
      const fatorReal = parseNum(row.querySelector('.nf-fator-operacional')?.value) || quantidadeRealSugeridaNF(Object.assign({}, base, { quantidadeFiscal:qtdFiscal, quantidade:qtdFiscal }));
      const qtdOperacional = parseNum(row.querySelector('.nf-qtd-operacional')?.value) || fatorReal;
      // fatorOperacional continua salvo apenas como razão técnica para compatibilidade legada.
      const fatorOperacional = qtdFiscal > 0 ? (qtdOperacional / qtdFiscal) : 1;
      const destinos = collectDestinosNF(row, qtdOperacional);
      const destinoPrincipal = destinos[0] || {};
      return Object.assign({}, base, {
        codigoFornecedor: row.querySelector('.nf-codforn')?.value || base.codigoFornecedor || base.codigo || '',
        codigoComercial: row.querySelector('.nf-codigo')?.value || base.codigoComercial || base.oem || '',
        descricao: row.querySelector('.nf-desc')?.value || base.descricao || '',
        descricaoOriginal: base.descricaoOriginal || row.querySelector('.nf-desc')?.getAttribute('title') || '',
        desc: row.querySelector('.nf-desc')?.value || base.descricao || '',
        marca: row.querySelector('.nf-marca')?.value || base.marca || '',
        unidade: row.querySelector('.nf-unidade')?.value || base.unidade || base.und || 'UN',
        unidadeFiscal: row.querySelector('.nf-unidade')?.value || base.unidadeFiscal || base.unidade || 'UN',
        quantidade: qtdFiscal, qtd: qtdFiscal, quantidadeFiscal: qtdFiscal, qtdFiscal,
        fatorReal: qtdOperacional,
        quantidadeReal: qtdOperacional,
        qtdReal: qtdOperacional,
        fatorOperacional,
        quantidadeOperacional: qtdOperacional,
        qtdOperacional,
        destinos,
        destinosOperacionais: destinos,
        valorUnitario: parseNum(row.querySelector('.nf-custo')?.value), custo: parseNum(row.querySelector('.nf-custo')?.value),
        desconto: parseNum(row.querySelector('.nf-descvalor')?.value),
        venda: parseNum(row.querySelector('.nf-venda')?.value),
        vendaManual: row.querySelector('.nf-venda')?.dataset?.manual === '1',
        vendaFrotistaAutomatica: row.querySelector('.nf-venda')?.dataset?.precoFrotista === '1',
        vendaEstoque: parseNum(row.querySelector('.nf-venda')?.dataset?.precoFrotista === '1' ? (row.querySelector('.nf-venda')?.dataset?.vendaAntesFrotista || '') : row.querySelector('.nf-venda')?.value),
        catalogoFrotistaId: row.querySelector('.nf-venda')?.dataset?.catalogoFrotistaId || '',
        codigo: row.querySelector('.nf-codforn')?.value || base.codigo || '',
        oem: row.querySelector('.nf-codigo')?.value || base.oem || '',
        ean: row.querySelector('.nf-ean')?.value || base.ean || '',
        ncm: row.querySelector('.nf-ncm-input')?.value || base.ncm || '',
        cfop: row.querySelector('.nf-cfop-input')?.value || base.cfop || '',
        cest: row.querySelector('.nf-cest-input')?.value || base.cest || '',
        destino: destinoPrincipal.destino || 'estoque',
        finalidade: destinoPrincipal.finalidade || destinoPrincipal.destino || 'estoque',
        osId: destinoPrincipal.osId || '',
        placa: destinoPrincipal.placa || '',
        vinculo: destinoPrincipal.vinculo || '',
        valorLiquido: Math.max(qtdFiscal * parseNum(row.querySelector('.nf-custo')?.value) - parseNum(row.querySelector('.nf-descvalor')?.value), 0)
      });
    }).filter(x => x.descricao);
  }
  W.thiaNFCollectItens = collectItens;
  function collectParcelas(){
    return Array.from(D.querySelectorAll('#nfParcelasBox .nf-parcela-row')).map(r => ({
      numero: r.querySelector('.nf-parc-num')?.value || '', vencimento: r.querySelector('.nf-parc-venc')?.value || '', valor: parseNum(r.querySelector('.nf-parc-valor')?.value)
    })).filter(p => p.valor > 0 || p.vencimento);
  }
  W.thiaNFCollectParcelas = collectParcelas;
  W.thiaNFRenderParcelas = function(parcelas, opts = {}){
    const arr = Array.isArray(parcelas) ? parcelas : [];
    ensureParcelasNFOptions(arr.length);
    if($('nfParcelas') && arr.length) $('nfParcelas').value = String(arr.length);
    renderParcels(arr);
    const box = $('nfParcelasBox');
    if(box && opts.manual) box.dataset.manualEdit = '1';
  };
  function normalizePlateNF(v){
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function extrairPlacasTextoNF(){
    const texto = Array.from(arguments).map(v => String(v || '').toUpperCase()).join(' ');
    const limpo = texto.replace(/[^A-Z0-9]+/g, ' ');
    const diretas = limpo.match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/g) || [];
    const compactado = normalizePlateNF(texto);
    const compactas = compactado.match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/g) || [];
    return Array.from(new Set(diretas.concat(compactas).map(normalizePlateNF).filter(Boolean)));
  }
  function normalizeTextNF(v){
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function codigoNormalizadoFrotistaNF(v){
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function classePecaFrotistaNF(v){
    const n = normalizeTextNF(v);
    if (!n) return '';
    if (/\bfiltro\b/.test(n) && (/\boleo\b/.test(n) || /\blubrificant/.test(n))) return 'filtro oleo';
    if (/\bfiltro\b/.test(n) && (/\bcombust/.test(n) || /\bdiesel\b/.test(n))) return 'filtro combustivel';
    if (/\bfiltro\b/.test(n) && (/\bcabine\b/.test(n) || /\bpolen\b/.test(n) || /\bar condicionado\b/.test(n))) return 'filtro cabine';
    if (/\bfiltro\b/.test(n) && /\bar\b/.test(n)) return 'filtro ar';
    if (/\bpastilh/.test(n) && /\bfreio/.test(n)) return 'pastilha freio';
    if (/\bdisco/.test(n) && /\bfreio/.test(n)) return 'disco freio';
    return '';
  }
  function clienteFrotistaDaOSNF(os){
    if (!os || osClienteOficialNF(os)) return null;
    const veiculo = (W.J?.veiculos || []).find(v => String(v.id) === String(os.veiculoId || os.veiculo || '')) || {};
    const clienteId = os.clienteId || veiculo.clienteId || '';
    const cliente = (W.J?.clientes || []).find(c => String(c.id) === String(clienteId)) || null;
    if (!cliente) return null;
    const tipo = String(cliente.tipoCliente || cliente.clienteTipo || '').toLowerCase();
    if (tipo === 'governo' || tipo === 'oficial') return null;
    return (cliente.frotista === true || String(cliente.categoriaComercial || '').toLowerCase() === 'frotista') ? cliente : null;
  }
  function catalogoFrotistaNF(cliente){
    if (Array.isArray(cliente?.catalogoPecasFrotista) && cliente.catalogoPecasFrotista.length) return cliente.catalogoPecasFrotista.slice();
    const legado = Array.isArray(cliente?.tabelaPrecosOS) ? cliente.tabelaPrecosOS : [];
    return legado.map(p => ({
      id:p.id || '', grupo:p.grupo || 'Pecas cadastradas', categoria:p.categoria || p.descricao || p.desc || '', descricao:p.descricao || p.desc || '',
      codigos:[p.codigo].filter(Boolean), qtdPadrao:p.qtdPadrao || 1, venda:Number(p.venda || 0) || 0,
      aplicacaoTipo:p.veiculoIdReferencia ? 'veiculo' : (p.veiculoModeloKey ? 'modelo' : 'todos'),
      aplicacaoValor:p.veiculoIdReferencia || p.veiculoModeloKey || '*', veiculoId:p.veiculoIdReferencia || '', veiculoModeloKey:p.veiculoModeloKey || '', veiculoModelo:p.veiculoModelo || ''
    }));
  }
  function modeloKeyVeiculoFrotistaNF(veiculo){
    return normalizeTextNF([veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' ').trim() || veiculo?.modelo || '');
  }
  function rankAplicacaoFrotistaNF(item, veiculo){
    const tipo = String(item?.aplicacaoTipo || 'todos').toLowerCase();
    const valor = String(item?.aplicacaoValor || '');
    if (tipo === 'veiculo') return veiculo && String(item.veiculoId || valor) === String(veiculo.id || '') ? 3 : 0;
    if (tipo === 'modelo') {
      const alvo = normalizeTextNF(item.veiculoModeloKey || valor || item.veiculoModelo || '');
      return veiculo && alvo && alvo === modeloKeyVeiculoFrotistaNF(veiculo) ? 2 : 0;
    }
    return (tipo === 'todos' || !tipo) ? 1 : 0;
  }
  function scoreCategoriaFrotistaNF(item, descricao){
    const cat = normalizeTextNF(item?.categoria || item?.descricao || '');
    const desc = normalizeTextNF(descricao || '');
    if (!cat || !desc) return 0;
    const classeCat = classePecaFrotistaNF(cat);
    const classeDesc = classePecaFrotistaNF(desc);
    if (classeCat && classeDesc) return classeCat === classeDesc ? 800 : 0;
    if (cat === desc) return 760;
    if (desc.includes(cat) && cat.length >= 5) return 720;
    if (cat.includes(desc) && desc.length >= 7) return 680;
    const stop = new Set(['de','da','do','das','dos','para','com','sem','e','a','o']);
    const tokens = cat.split(' ').filter(t => t.length >= 3 && !stop.has(t));
    if (tokens.length >= 2 && tokens.every(t => desc.includes(t))) return 640;
    return 0;
  }
  function resolverPrecoFrotistaNF(item, os){
    const cliente = clienteFrotistaDaOSNF(os);
    if (!cliente) return null;
    const veiculo = (W.J?.veiculos || []).find(v => String(v.id) === String(os?.veiculoId || os?.veiculo || '')) || null;
    const codigosItem = [item?.codigoFornecedor, item?.codigoComercial, item?.oem, item?.codigo].map(codigoNormalizadoFrotistaNF).filter(Boolean);
    const descricao = item?.descricao || item?.desc || '';
    const candidatos = [];
    catalogoFrotistaNF(cliente).forEach(regra => {
      const rankApp = rankAplicacaoFrotistaNF(regra, veiculo);
      const venda = Number(regra?.venda || 0) || 0;
      if (!rankApp || venda <= 0) return;
      const codigosRegra = (Array.isArray(regra?.codigos) ? regra.codigos : [regra?.codigo]).map(codigoNormalizadoFrotistaNF).filter(Boolean);
      const codigoExato = codigosItem.length && codigosRegra.some(c => codigosItem.includes(c));
      const scoreCat = scoreCategoriaFrotistaNF(regra, descricao);
      if (!codigoExato && !scoreCat) return;
      candidatos.push({ regra, venda, rankApp, match: codigoExato ? 1000 : scoreCat, motivo: codigoExato ? 'codigo equivalente' : 'categoria/descricao' });
    });
    if (!candidatos.length) return null;
    candidatos.sort((a,b) => (b.rankApp-a.rankApp) || (b.match-a.match));
    const top = candidatos[0];
    const empatados = candidatos.filter(c => c.rankApp === top.rankApp && c.match === top.match);
    const precos = Array.from(new Set(empatados.map(c => Number(c.venda).toFixed(4))));
    if (precos.length > 1) return { ambiguo:true, cliente, candidatos:empatados };
    return { ambiguo:false, cliente, veiculo, item:top.regra, venda:top.venda, motivo:top.motivo };
  }
  function restaurarPrecoAutomaticoFrotistaNF(row){
    const venda = row?.querySelector?.('.nf-venda');
    if (!venda || venda.dataset.manual === '1' || venda.dataset.precoFrotista !== '1') return;
    if (venda.dataset.vendaAntesFrotista !== undefined && venda.dataset.vendaAntesFrotista !== '') venda.value = venda.dataset.vendaAntesFrotista;
    delete venda.dataset.precoFrotista;
    delete venda.dataset.catalogoFrotistaId;
    delete venda.dataset.precoFrotistaMotivo;
    delete venda.dataset.vendaAntesFrotista;
    venda.title = '';
  }
  function aplicarPrecoFrotistaNaLinhaNF(row, os){
    const venda = row?.querySelector?.('.nf-venda');
    if (!row || !venda || venda.dataset.manual === '1') return null;
    const item = {
      codigoFornecedor: row.querySelector('.nf-codforn')?.value || '', codigoComercial: row.querySelector('.nf-codigo')?.value || '',
      codigo: row.querySelector('.nf-codforn')?.value || '', oem: row.querySelector('.nf-codigo')?.value || '', descricao: row.querySelector('.nf-desc')?.value || ''
    };
    const res = resolverPrecoFrotistaNF(item, os);
    if (!res) { restaurarPrecoAutomaticoFrotistaNF(row); return null; }
    if (res.ambiguo) {
      restaurarPrecoAutomaticoFrotistaNF(row);
      const nome = res.cliente?.nome || 'frotista';
      W.toast?.(`Tabela do ${nome}: há mais de um preço aplicável para “${item.descricao || item.codigoFornecedor || 'peça'}”. Revise a categoria/aplicação antes de concluir.`, 'warn');
      return res;
    }
    if (venda.dataset.precoFrotista !== '1') venda.dataset.vendaAntesFrotista = venda.value || '';
    venda.value = fmtBR(res.venda);
    venda.dataset.precoFrotista = '1';
    venda.dataset.catalogoFrotistaId = String(res.item?.id || '');
    venda.dataset.precoFrotistaMotivo = res.motivo || '';
    venda.title = `Preço sugerido do frotista (${res.motivo}). Editável para este lançamento.`;
    return res;
  }
  W.nfProMarcarVendaManual = function(input){
    if (!input) return;
    input.dataset.manual = '1';
    delete input.dataset.precoFrotista;
    delete input.dataset.catalogoFrotistaId;
    delete input.dataset.precoFrotistaMotivo;
    delete input.dataset.vendaAntesFrotista;
    input.title = 'Preço alterado manualmente para este lançamento.';
  };
  W.thiaNFResolverPrecoFrotista = resolverPrecoFrotistaNF;

  function destinoVinculadoNF(item){
    const destino = String(item?.destino || item?.finalidade || '').toLowerCase();
    if(destino === 'os' || destino === 'placa') return true;
    if(destino) return false;
    if(item?.osId) return true;
    const placa = normalizePlateNF(item?.placa || item?.vinculo || '');
    const vinculo = String(item?.vinculo || '');
    return !!(/\bos\b|o\.s\.|ordem/i.test(vinculo) || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa));
  }
  function destinoEstoqueNF(item){
    const destino = String(item?.destino || item?.finalidade || 'estoque').toLowerCase();
    return !destino || destino === 'estoque';
  }
  function destinosOperacionaisItemNF(item){
    const arr = Array.isArray(item?.destinosOperacionais) ? item.destinosOperacionais : (Array.isArray(item?.destinos) ? item.destinos : []);
    if (arr.length) return arr.filter(d => (Number(d?.qtd || d?.quantidade || 0) || 0) > 0);
    return [{
      qtd: quantidadeOperacionalNF(item),
      quantidade: quantidadeOperacionalNF(item),
      destino: item?.destino || item?.finalidade || 'estoque',
      finalidade: item?.finalidade || item?.destino || 'estoque',
      osId: item?.osId || '',
      placa: item?.placa || '',
      vinculo: item?.vinculo || '',
      destinoIndice: 0,
      destinoKey: 'destino_0'
    }];
  }
  function expandirItensPorDestinoNF(itens){
    const out = [];
    (Array.isArray(itens) ? itens : []).forEach((item, itemIndex) => {
      const qtdOpTotal = quantidadeOperacionalNF(item);
      const custoOp = custoOperacionalNF(item);
      destinosOperacionaisItemNF(item).forEach((destino, destinoIndex) => {
        const qtd = Number(destino.qtd || destino.quantidade || 0) || 0;
        if (qtd <= 0) return;
        out.push(Object.assign({}, item, destino, {
          itemFiscalIndex: itemIndex,
          destinoIndice: destino.destinoIndice ?? destinoIndex,
          destinoKey: destino.destinoKey || `destino_${destinoIndex}`,
          quantidadeFiscal: quantidadeFiscalNF(item),
          qtdFiscal: quantidadeFiscalNF(item),
          quantidadeOperacionalTotal: qtdOpTotal,
          qtdOperacionalTotal: qtdOpTotal,
          quantidade: qtd,
          qtd,
          valorUnitarioFiscal: Number(item.valorUnitario || item.custo || 0) || 0,
          valorUnitario: custoOp,
          custo: custoOp,
          valorLiquido: totalOperacionalNF(item, qtd),
          totalOperacional: totalOperacionalNF(item, qtd)
        }));
      });
    });
    return out;
  }
  function firebaseFieldValueNF(){
    try {
      return W.firebase?.firestore?.FieldValue || firebase?.firestore?.FieldValue || null;
    } catch (_) {
      return null;
    }
  }
  function cleanFirestoreNF(value){
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (Array.isArray(value)) return value.map(cleanFirestoreNF).filter(v => v !== undefined);
    if (value && typeof value === 'object') {
      const ctor = String(value.constructor?.name || '');
      if (value._methodName || value._delegate?._methodName || value._toFieldTransform || /FieldValue|ArrayUnion|ArrayRemove/i.test(ctor)) return value;
      const out = {};
      Object.entries(value).forEach(([k, v]) => {
        const cleaned = cleanFirestoreNF(v);
        if (cleaned !== undefined) out[k] = cleaned;
      });
      return out;
    }
    return value;
  }
  function fornecedorNomeNF(nfe, fornecedorId){
    const local = (W.J?.fornecedores || []).find(f => String(f.id) === String(fornecedorId)) || null;
    const optText = $('nfFornec')?.selectedOptions?.[0]?.textContent || '';
    const optClean = optText.replace(/\s+[-—].*$/g, '').replace(/\s+\(novo\)$/i, '').trim();
    return nfe?.fornecedor?.nome || local?.nome || local?.razao || local?.razaoSocial || local?.fantasia || local?.nomeFantasia || optClean || 'Fornecedor';
  }
  function fornecedorSnapshotNF(nfe, fornecedorId, nomeFallback){
    if (nfe?.fornecedor) return nfe.fornecedor;
    const local = (W.J?.fornecedores || []).find(f => String(f.id) === String(fornecedorId)) || {};
    return cleanFirestoreNF({
      id: fornecedorId || local.id || '',
      nome: local.nome || local.razao || local.razaoSocial || nomeFallback || '',
      razao: local.razao || local.razaoSocial || local.nome || nomeFallback || '',
      fantasia: local.fantasia || local.nomeFantasia || '',
      cnpj: local.cnpj || local.doc || local.documento || local.cpfCnpj || '',
      doc: local.doc || local.documento || local.cpfCnpj || local.cnpj || local.cpf || '',
      telefone: local.telefone || local.wpp || local.whatsapp || '',
      email: local.email || ''
    });
  }
  function placaDaOSNF(os){
    const v = (W.J?.veiculos || []).find(x => x.id === (os?.veiculoId || os?.veiculo)) || {};
    return normalizePlateNF(os?.placa || v.placa || '');
  }
  function textoBuscaOSNF(os){
    const v = (W.J?.veiculos || []).find(x => x.id === (os?.veiculoId || os?.veiculo)) || {};
    const c = (W.J?.clientes || []).find(x => x.id === (os?.clienteId || v.clienteId)) || {};
    return [
      os?.id, os?.numero, os?.placa, v.placa, os?.veiculo, v.modelo, v.marca, v.nome,
      c.nome, c.razao, os?.cliente, os?.status, os?.etapa, os?.data
    ].filter(Boolean).join(' ');
  }
  function ordenarOSDestinoNF(a, b){
    const peso = os => /cancel|entreg|recus|finaliz/.test(normalizeTextNF(os?.status || '')) ? 1 : 0;
    const data = os => Date.parse(os?.updatedAt || os?.createdAt || (os?.data ? os.data + 'T12:00:00' : '')) || 0;
    return (peso(a) - peso(b)) || (data(b) - data(a));
  }
  async function carregarOSNF(osId){
    if (!osId) return null;
    const local = (W.J?.os || []).find(o => String(o.id) === String(osId)) || null;
    if (W.db) {
      try {
        const snap = await W.db.collection('ordens_servico').doc(osId).get();
        if (snap.exists) return Object.assign({ id: snap.id }, snap.data() || {});
      } catch (_) {}
    }
    return local;
  }
  async function resolverOSDestinoNF(item){
    if (item.osId) return carregarOSNF(item.osId);
    const lista = (W.J?.os || []).filter(osEmAtendimentoNF);
    const placas = extrairPlacasTextoNF(item.placa, item.vinculo);
    for (const placa of placas) {
      if (placa) {
        const porPlaca = lista
          .filter(o => {
            const p = placaDaOSNF(o);
            return p && (p === placa || p.includes(placa) || placa.includes(p));
          })
          .sort(ordenarOSDestinoNF);
        if (porPlaca[0]?.id) return carregarOSNF(porPlaca[0].id);
      }
    }
    const termo = normalizeTextNF(item.vinculo || item.osId || '');
    if (termo) {
      const porTexto = lista
        .filter(o => normalizeTextNF(textoBuscaOSNF(o)).includes(termo))
        .sort(ordenarOSDestinoNF);
      if (porTexto[0]?.id) return carregarOSNF(porTexto[0].id);
    }
    return null;
  }
  function origemNFItemKeyNF(item, nfId, os){
    const numeroItem = item?.numeroItem || item?.nItem || item?.item || '';
    const codigoFornecedor = item?.codigoFornecedor || item?.codigo || '';
    const codigoComercial = item?.codigoComercial || item?.oem || '';
    const desc = item?.descricao || item?.desc || '';
    return [nfId || item?.nfId || '', numeroItem, item?.itemFiscalIndex ?? '', item?.destinoIndice ?? '', item?.osId || os?.id || '', item?.placa || placaDaOSNF(os), codigoFornecedor, codigoComercial, desc].join('|');
  }
  function pecaRealFromNF(item, os, nfRef, nfPayload, fornecedorId, fornecedorNome){
    const numeroItem = item.numeroItem || item.nItem || item.item || '';
    const codigoFornecedor = item.codigoFornecedor || item.codigo || '';
    const codigoComercial = item.codigoComercial || item.oem || '';
    const desc = item.descricao || item.desc || '';
    const key = origemNFItemKeyNF(item, nfRef.id, os);
    const precoFrotista = item.vendaManual ? null : resolverPrecoFrotistaNF(item, os);
    const vendaAplicada = (!precoFrotista?.ambiguo && Number(precoFrotista?.venda || 0) > 0) ? Number(precoFrotista.venda) : (Number(item.venda || 0) || 0);
    return cleanFirestoreNF({
      origem: 'nf_entrada',
      origemNFItemKey: key,
      statusAplicacao: 'comprada_vinculada_nf',
      codigo: codigoComercial || codigoFornecedor,
      codigoFornecedor,
      codigoComercial,
      oem: codigoComercial,
      desc,
      descricao: desc,
      marca: item.marca || '',
      qtd: Number(item.quantidade || item.qtd || 1) || 1,
      quantidadeFiscal: Number(item.quantidadeFiscal || item.qtdFiscal || 0) || 0,
      quantidadeOperacionalTotal: Number(item.quantidadeOperacionalTotal || item.qtdOperacionalTotal || item.quantidadeOperacional || item.qtdOperacional || 0) || 0,
      destinoIndice: item.destinoIndice ?? 0,
      unidade: item.unidade || 'UN',
      unidadeFiscal: item.unidadeFiscal || item.unidade || 'UN',
      fornecedor: fornecedorNome,
      fornecedorId,
      nf: nfPayload.numero || '',
      nfNumero: nfPayload.numero || '',
      nfId: nfRef.id,
      chaveNFe: nfPayload.chave || '',
      numeroItem,
      dataCompra: nfPayload.dataNF || isoToday(),
      dataNF: nfPayload.dataNF || isoToday(),
      valorCompra: Number(item.valorUnitario || item.custo || 0) || 0,
      valorVenda: vendaAplicada,
      precoFrotistaAplicado: !!(!precoFrotista?.ambiguo && Number(precoFrotista?.venda || 0) > 0 && !item.vendaManual),
      catalogoFrotistaId: !precoFrotista?.ambiguo ? (precoFrotista?.item?.id || item.catalogoFrotistaId || '') : '',
      precoFrotistaMotivo: !precoFrotista?.ambiguo ? (precoFrotista?.motivo || '') : '',
      valorUnitarioFiscal: Number(item.valorUnitarioFiscal || 0) || 0,
      totalCompra: Number(item.valorLiquido || item.totalOperacional || 0) || 0,
      descontoCompra: Number(item.desconto || 0) || 0,
      ncm: item.ncm || '',
      cest: item.cest || '',
      cfop: item.cfop || '',
      ean: item.ean || '',
      osId: os?.id || item.osId || '',
      placa: normalizePlateNF(item.placa || placaDaOSNF(os)),
      registradoEm: new Date().toISOString(),
      registradoPor: W.J?.nome || 'Sistema',
      observacao: 'Vinculada automaticamente na entrada fiscal. Nao indica instalacao ou execucao.'
    });
  }
  W.thiaNFDestinosOperacionaisItem = destinosOperacionaisItemNF;
  W.thiaNFExpandirItensPorDestino = expandirItensPorDestinoNF;
  W.thiaNFDestinoVinculado = destinoVinculadoNF;
  W.thiaNFDestinoEstoque = destinoEstoqueNF;
  W.thiaNFResolverOSDestino = resolverOSDestinoNF;
  W.thiaNFOrigemItemKey = origemNFItemKeyNF;
  W.thiaNFPecaRealFromDestino = pecaRealFromNF;
  function mergePecasReaisNF(atuais, novas){
    const out = Array.isArray(atuais) ? atuais.slice() : [];
    const keyOf = p => p?.origemNFItemKey || [p?.nfId || p?.chaveNFe || p?.nf || '', p?.numeroItem || '', p?.codigoFornecedor || p?.codigo || '', p?.desc || p?.descricao || ''].join('|');
    const pos = new Map();
    out.forEach((p, idx) => { const k = keyOf(p); if (k) pos.set(k, idx); });
    novas.forEach(p => {
      const k = keyOf(p);
      if (k && pos.has(k)) {
        const idx = pos.get(k);
        out[idx] = Object.assign({}, out[idx], p, { registradoEm: out[idx].registradoEm || p.registradoEm });
      } else {
        if (k) pos.set(k, out.length);
        out.push(p);
      }
    });
    return out;
  }
  function osClienteOficialNF(os){
    // Regra cirúrgica: orçamento importado/Cília NÃO torna cliente oficial.
    // Cliente comum com Cília ou PDF continua recebendo peça da NF em Peças da O.S.
    const cliente = (W.J?.clientes || []).find(c => String(c.id) === String(os?.clienteId || os?.cliente || '')) || {};
    const nomeCliente = String(cliente.nome || os?.clienteNome || os?.cliente || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!nomeCliente || nomeCliente === 'CONSUMIDOR') return false;
    const tipoCliente = String(cliente.tipoCliente || os?.tipoCliente || os?.clienteTipo || '').toLowerCase();
    if (tipoCliente === 'governo' || tipoCliente === 'oficial') return true;
    const raw = JSON.stringify({
      osClienteOficial: os?.clienteOficial,
      osOrgaoPublico: os?.orgaoPublico,
      osGov: os?.gov,
      osFiscalContrato: os?.fiscalContrato,
      osContrato: os?.contrato,
      clienteOficial: cliente.clienteOficial,
      clienteOrgaoPublico: cliente.orgaoPublico,
      clientePublico: cliente.publico,
      clienteGov: cliente.gov,
      clienteTipo: cliente.tipoCliente
    }).toUpperCase();
    return /OFICIAL|GOVERNO|PMSP|POLICIA|POLÍCIA|MILITAR|BPM|PREFEITURA|ESTADO|MUNICIP|SECRETARIA/.test(raw);
  }
  function pecaOrcamentoFromNF(pecaReal){
    const desc = pecaReal.desc || pecaReal.descricao || '';
    const codigo = pecaReal.codigoComercial || pecaReal.codigoFornecedor || pecaReal.codigo || '';
    if (!desc && !codigo) return null;
    return cleanFirestoreNF({
      origem: 'nf_entrada_os',
      origemNFItemKey: pecaReal.origemNFItemKey || '',
      estoqueId: '',
      codigo,
      desc,
      qtd: Number(pecaReal.qtd || 1) || 1,
      custo: Number(pecaReal.valorCompra || 0) || 0,
      venda: Number(pecaReal.valorVenda || pecaReal.valorCompra || 0) || 0,
      baixarEstoqueReal: false,
      estoqueBaixadoAutomatico: true,
      fornecedor: pecaReal.fornecedor || '',
      nf: pecaReal.nf || pecaReal.nfNumero || '',
      nfId: pecaReal.nfId || '',
      nfNumero: pecaReal.nfNumero || pecaReal.nf || '',
      dataCompra: pecaReal.dataCompra || pecaReal.dataNF || '',
      origemNFVinculada: true
    });
  }

  function keyPecaOrcamentoNF(p){
    return normalizeTextNF(p?.origemNFItemKey || [p?.nfId || p?.nf || '', p?.codigo || p?.codigoComercial || p?.codigoFornecedor || '', p?.desc || p?.descricao || '', p?.qtd || ''].join('|'));
  }
  function pecasOcultasOSNF(os){
    const out = [];
    [os?.pecasReaisOcultasNaOS, os?.pecasNFRemovidasDaOS, os?.pecasOcultasNaOS, os?.pecasOSOcultas].forEach(lista => {
      if (Array.isArray(lista)) lista.forEach(v => {
        const k = normalizeTextNF(typeof v === 'string' ? v : (v?.key || v?.chave || v?.origemNFItemKey || v?.nfItemKey || ''));
        if (k && !out.includes(k)) out.push(k);
      });
    });
    return out;
  }
  function pecaOrcamentoOcultaOSNF(os, p){
    const k = keyPecaOrcamentoNF(p);
    return !!(k && pecasOcultasOSNF(os).includes(k));
  }

  function mergePecasOrcamentoNF(atuais, novas){
    const out = Array.isArray(atuais) ? atuais.slice() : [];
    const keyOf = p => p?.origemNFItemKey || [p?.nfId || p?.nf || '', p?.codigo || '', p?.desc || p?.descricao || '', p?.qtd || ''].join('|');
    const pos = new Map();
    out.forEach((p, idx) => { const k = keyOf(p); if (k) pos.set(k, idx); });
    novas.forEach(p => {
      const k = keyOf(p);
      if (k && pos.has(k)) {
        const idx = pos.get(k);
        out[idx] = Object.assign({}, out[idx], p);
      } else {
        if (k) pos.set(k, out.length);
        out.push(p);
      }
    });
    return out;
  }
  W.thiaNFOSClienteOficial = osClienteOficialNF;
  W.thiaNFPecaOrcamentoFromReal = pecaOrcamentoFromNF;
  W.thiaNFMergePecasReais = mergePecasReaisNF;
  W.thiaNFMergePecasOrcamento = mergePecasOrcamentoNF;
  function refletirPecasNFNaOSTelaAtual(osId, pecas){
    if (!$('osId') || String($('osId').value || '') !== String(osId || '')) return;
    if (!$('containerPecasOS') || typeof W.renderPecaOSRow !== 'function') return;
    const chavesTela = new Set(Array.from(D.querySelectorAll('#containerPecasOS [data-origem-n-f-item-key], #containerPecasOS [data-origem-nf-item-key]')).map(el => el.dataset?.origemNFItemKey || el.dataset?.origemNFItemkey || '').filter(Boolean));
    Array.from(D.querySelectorAll('#containerPecasOS > div')).forEach(row => {
      const k = row.dataset?.origemNFItemKey || row.dataset?.origemNfItemKey || '';
      if (k) chavesTela.add(k);
    });
    (Array.isArray(pecas) ? pecas : []).forEach(real => {
      const visivel = pecaOrcamentoFromNF(real);
      if (!visivel) return;
      const osAtual = (W.J?.os || []).find(o => String(o.id) === String(osId || '')) || {};
      if (pecaOrcamentoOcultaOSNF(osAtual, visivel)) return;
      const key = visivel.origemNFItemKey || '';
      if (key && chavesTela.has(key)) return;
      W.renderPecaOSRow(visivel);
      if (key) chavesTela.add(key);
    });
    W.calcOSTotal?.();
  }
  W.refletirPecasNFNaOSTelaAtual = refletirPecasNFNaOSTelaAtual;
  W.refletirPecasNFNaOS = W.refletirPecasNFNaOS || refletirPecasNFNaOSTelaAtual;
  async function registrarPecasReaisOSNF(batch, itens, nfRef, nfPayload, fornecedorId, fornecedorNome){
    const porOS = new Map();
    const semDestino = [];
    for (const item of itens) {
      if (!destinoVinculadoNF(item)) continue;
      const os = await resolverOSDestinoNF(item);
      if (!os?.id) {
        semDestino.push(item);
        continue;
      }
      item.osId = os.id;
      item.placa = item.placa || placaDaOSNF(os);
      const entry = porOS.get(os.id) || { os, pecas: [] };
      entry.pecas.push(pecaRealFromNF(item, os, nfRef, nfPayload, fornecedorId, fornecedorNome));
      porOS.set(os.id, entry);
    }
    if (semDestino.length) {
      const resumo = semDestino.slice(0, 5).map(i => `${i.codigo || i.codigoFornecedor || 'sem codigo'} - ${i.descricao || i.desc || 'peca sem descricao'} (${i.vinculo || i.placa || 'sem placa/O.S.'})`).join(' | ');
      throw new Error(`Existem ${semDestino.length} item(ns) marcados para O.S./placa sem O.S. em atendimento resolvida. Selecione a O.S. no campo da peça antes de finalizar. ${resumo}`);
    }
    let totalPecas = 0;
    const registrosAuxiliares = [];
    for (const [osId, entry] of porOS.entries()) {
      const pecas = entry.pecas.filter(Boolean);
      if (!pecas.length) continue;
      totalPecas += pecas.length;
      const acao = `Peca real vinculada por NF ${nfPayload.numero || 's/n'}: ${pecas.map(p => p.desc || p.codigo).filter(Boolean).join(', ')}`;
      const evento = cleanFirestoreNF({
        dt: new Date().toISOString(),
        user: W.J?.nome || 'Sistema',
        acao,
        tipo: 'nf_peca_real',
        interno: true,
        nfId: nfRef.id,
        nfNumero: nfPayload.numero || ''
      });
      const osUpdate = {
        updatedAt: new Date().toISOString(),
        ultimaEntradaNFVinculada: nfPayload.numero || nfRef.id
      };
      osUpdate.pecasReais = mergePecasReaisNF(entry.os.pecasReais, pecas);
      if (!osClienteOficialNF(entry.os)) {
        const pecasOrcamento = pecas.map(pecaOrcamentoFromNF).filter(Boolean).filter(p => !pecaOrcamentoOcultaOSNF(entry.os, p));
        if (pecasOrcamento.length) osUpdate.pecas = mergePecasOrcamentoNF(entry.os.pecas, pecasOrcamento);
      }
      osUpdate.timeline = (Array.isArray(entry.os.timeline) ? entry.os.timeline.slice() : []).concat(evento);
      batch.set(W.db.collection('ordens_servico').doc(osId), cleanFirestoreNF(osUpdate), { merge: true });
      registrosAuxiliares.push({ osId, acao, nfId: nfRef.id, nfNumero: nfPayload.numero || '', pecas });
      const localOS = (W.J?.os || []).find(o => String(o.id) === String(osId));
      if (localOS) {
        localOS.pecasReais = mergePecasReaisNF(localOS.pecasReais, pecas);
        if (osUpdate.pecas) localOS.pecas = osUpdate.pecas;
        localOS.timeline = (Array.isArray(localOS.timeline) ? localOS.timeline.slice() : []).concat(evento);
        localOS.ultimaEntradaNFVinculada = nfPayload.numero || nfRef.id;
        localOS.updatedAt = osUpdate.updatedAt;
      }
      if ($('osId')?.value === osId && $('containerPecasReais') && W._pecasReaisDesbloqueadas === true && typeof W.adicionarPecaRealRow === 'function') {
        const chavesAtuais = new Set(Array.from(D.querySelectorAll('#containerPecasReais .pr-meta')).map(el => {
          try { return JSON.parse(el.value || '{}')?.origemNFItemKey || ''; } catch (_) { return ''; }
        }).filter(Boolean));
        pecas.forEach(p => {
          if (!p.origemNFItemKey || !chavesAtuais.has(p.origemNFItemKey)) W.adicionarPecaRealRow(p);
        });
        W.atualizarResumoPecasReais177?.();
      }
      if (!osClienteOficialNF(entry.os)) refletirPecasNFNaOSTelaAtual(osId, pecas);
    }
    return { os: porOS.size, pecas: totalPecas, registrosAuxiliares };
  }
  async function salvarRegistrosAuxiliaresNF(vinculosOS){
    const registros = Array.isArray(vinculosOS?.registrosAuxiliares) ? vinculosOS.registrosAuxiliares : [];
    for (const reg of registros) {
      const notificacao = cleanFirestoreNF({
        tenantId: W.J?.tid,
        tipo: 'peca_nf_vinculada',
        titulo: 'Peca de NF vinculada a O.S.',
        mensagem: reg.acao,
        destinoPerfil: 'admin',
        entidade: 'ordens_servico',
        entidadeId: reg.osId,
        prioridade: 'normal',
        acaoSugerida: 'Conferir aba secreta Pecas Reais',
        lida: false,
        ts: Date.now(),
        createdAt: new Date().toISOString()
      });
      try {
        if (typeof W.thiaNotify === 'function') await W.thiaNotify(notificacao);
        else if (W.db) await W.db.collection('notificacoes_live').add(notificacao);
      } catch (_) {}
      try {
        if (typeof W.thiaAudit === 'function') {
          await W.thiaAudit('vinculo_nf_peca_real_os', 'ordens_servico', reg.osId, null, { nfId: reg.nfId, nfNumero: reg.nfNumero, pecas: reg.pecas }, 'Vinculo automatico na entrada fiscal');
        } else if (W.db) {
          await W.db.collection('lixeira_auditoria').add(cleanFirestoreNF({
            tenantId: W.J?.tid,
            usuario: W.J?.nome || 'Sistema',
            perfil: W.J?.role || '',
            acao: 'vinculo_nf_peca_real_os',
            entidade: 'ordens_servico',
            entidadeId: reg.osId,
            antes: null,
            depois: { nfId: reg.nfId, nfNumero: reg.nfNumero, pecas: reg.pecas },
            motivo: 'Vinculo automatico na entrada fiscal',
            ts: Date.now(),
            createdAt: new Date().toISOString()
          }));
        }
      } catch (_) {}
    }
  }
  async function ensureFornecedor(batch, nfe){
    const sel = getVal('nfFornec');
    if(!sel || !sel.startsWith('__xml__')) return sel;
    const fornec = nfe?.fornecedor || {};
    const ref = W.db.collection('fornecedores').doc();
    batch.set(ref, { tenantId:W.J?.tid, nome:fornec.nome || 'Fornecedor XML', fantasia:fornec.fantasia || '', cnpj:fornec.cnpj || '', ie:fornec.ie || '', telefone:fornec.endereco?.telefone || '', cep:fornec.endereco?.cep || '', endereco:fornec.endereco || {}, origem:'xml_nfe', createdAt:new Date().toISOString() });
    return ref.id;
  }
  function isNFDevolucao(nfe, itens){
    const tipo = tipoOperacaoNF();
    if (tipo) return tipo === 'devolucao';
    const txt = normalizeTextNF([nfe?.natureza, nfe?.finalidade, nfe?.infCpl, nfe?.infAdFisco].join(' '));
    if (txt.includes('devolucao') || String(nfe?.finalidade || '') === '4') return true;
    const arr = Array.isArray(itens) ? itens : [];
    return arr.length > 0 && arr.every(i => normalizeTextNF(i.destino || i.finalidade || '').includes('devolucao'));
  }
  function itemNFMatch(a, b){
    const ca = normalizeTextNF(a?.codigoFornecedor || a?.codigo || a?.codigoComercial || a?.oem || a?.ean || '');
    const cb = normalizeTextNF(b?.codigoFornecedor || b?.codigo || b?.codigoComercial || b?.oem || b?.ean || '');
    const da = normalizeTextNF(a?.descricao || a?.desc || '');
    const db = normalizeTextNF(b?.descricao || b?.desc || '');
    return (ca && cb && ca === cb) || (da && db && da === db);
  }
  async function localizarNFOriginalDevolucao(nfe){
    const refs = Array.isArray(nfe?.referencias) ? nfe.referencias : [];
    const selecionada = D.getElementById('nfDevolucaoOriginalId')?.value || '';
    if (selecionada) {
      let n = (W.J?.notasFiscaisEntrada || []).find(x => String(x.id) === String(selecionada));
      if (!n && W.db) {
        try {
          const snap = await W.db.collection('notas_fiscais_entrada').doc(selecionada).get();
          if (snap.exists) n = { id:snap.id, ...snap.data() };
        } catch (_) {}
      }
      if (n) return n;
    }
    let original = null;
    if (refs.length) original = (W.J?.notasFiscaisEntrada || []).find(n => refs.includes(n.chave));
    if (!original && refs.length && W.db && W.J?.tid) {
      try {
        const snap = await W.db.collection('notas_fiscais_entrada').where('tenantId','==',W.J.tid).where('chave','==',refs[0]).limit(1).get();
        snap.forEach(doc => { original = { id:doc.id, ...doc.data() }; });
      } catch (_) {}
    }
    if (!original) {
      const termo = prompt('Informe o numero ou ID da NF original que esta sendo devolvida:', '') || '';
      if (!termo.trim()) return null;
      original = (W.J?.notasFiscaisEntrada || []).find(n => String(n.id) === termo.trim() || String(n.numero || '') === termo.trim() || String(n.chave || '') === termo.trim());
      if (!original && W.db && W.J?.tid) {
        try {
          const snap = await W.db.collection('notas_fiscais_entrada').where('tenantId','==',W.J.tid).where('numero','==',termo.trim()).limit(1).get();
          snap.forEach(doc => { original = { id:doc.id, ...doc.data() }; });
        } catch (_) {}
      }
    }
    return original || null;
  }
  function removerPecasReaisDevolucaoBatch(batch, nfOriginal, itens, nfPayload, motivo){
    let removidas = 0;
    (W.J?.os || []).forEach(os => {
      const pecas = Array.isArray(os.pecasReais) ? os.pecasReais.slice() : [];
      if (!pecas.length) return;
      const novas = pecas.filter(p => {
        const daNF = String(p.nfId || '') === String(nfOriginal?.id || '') || String(p.nfNumero || p.nf || '') === String(nfOriginal?.numero || '');
        const bate = daNF && itens.some(i => itemNFMatch(p, i));
        if (bate) removidas += 1;
        return !bate;
      });
      if (novas.length === pecas.length) return;
      const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
      timeline.push({ ts:Date.now(), por:W.J?.nome || 'Sistema', tipo:'devolucao_nf', nfId:nfPayload.id || '', msg:`Peca removida por NF de devolucao ${nfPayload.numero || ''}. ${motivo || ''}` });
      batch.update(W.db.collection('ordens_servico').doc(os.id), { pecasReais:novas, timeline, updatedAt:new Date().toISOString() });
      os.pecasReais = novas;
      os.timeline = timeline;
    });
    return removidas;
  }
  async function salvarNFDevolucao(itens, nfe, fornecedorId, nfPayload){
    const original = await localizarNFOriginalDevolucao(nfe);
    if (!original) {
      if(W.toast) W.toast('NF de devolucao exige vinculo com a NF original. Operacao bloqueada ate selecionar a original.', 'warn');
      return;
    }
    const motivo = D.getElementById('nfDevolucaoMotivo')?.value || prompt('Justificativa/observacao da devolucao:', 'Devolucao de mercadoria ao fornecedor') || 'Devolucao de mercadoria ao fornecedor';
    const batch = W.db.batch();
    const nfRef = W.db.collection('notas_fiscais_entrada').doc();
    const agora = new Date().toISOString();
    if (fornecedorId && nfe?.fornecedor && !(W.J?.fornecedores || []).some(f => String(f.id) === String(fornecedorId))) {
      const fornec = nfe.fornecedor || {};
      batch.set(W.db.collection('fornecedores').doc(fornecedorId), { tenantId:W.J?.tid, nome:fornec.nome || 'Fornecedor XML', fantasia:fornec.fantasia || '', cnpj:fornec.cnpj || '', ie:fornec.ie || '', telefone:fornec.endereco?.telefone || '', cep:fornec.endereco?.cep || '', endereco:fornec.endereco || {}, origem:'xml_nfe', createdAt:agora }, { merge:true });
    }
    nfPayload.id = nfRef.id;
    nfPayload.tipo = 'devolucao';
    nfPayload.nfOriginalId = original.id || '';
    nfPayload.chaveOriginal = original.chave || (nfe?.referencias || [])[0] || '';
    nfPayload.statusConferencia = 'Devolucao vinculada';
    nfPayload.motivoDevolucao = motivo;
    nfPayload.createdAt = agora;
    nfPayload.updatedAt = agora;
    batch.set(nfRef, nfPayload);
    const vinculosOrig = (W.J?.nfItensVinculos || []).filter(v => String(v.nfId || '') === String(original.id || '') || (original.chave && v.chave === original.chave));
    const devolvidosResumo = [];
    const itensOriginalAtualizados = (Array.isArray(original.itens) ? original.itens : []).map(oi => {
      const dev = itens.find(i => itemNFMatch(oi, i));
      if (!dev) return oi;
      const qtdDev = Number(dev.quantidade || dev.qtd || 0) || 0;
      const qtdAnt = Number(oi.quantidadeDevolvida || oi.qtdDevolvida || 0) || 0;
      const qtdOrig = Number(oi.quantidade || oi.qtd || 0) || 0;
      const totalDev = qtdAnt + qtdDev;
      devolvidosResumo.push({ codigo:dev.codigo || dev.codigoFornecedor || oi.codigo || oi.codigoFornecedor || '', desc:dev.descricao || dev.desc || oi.descricao || oi.desc || '', qtd:qtdDev });
      return Object.assign({}, oi, {
        quantidadeDevolvida: totalDev,
        qtdDevolvida: totalDev,
        saldoAposDevolucao: Math.max(0, qtdOrig - totalDev),
        statusDevolucao: qtdOrig && totalDev >= qtdOrig ? 'Devolvido total' : 'Devolvido parcial',
        ultimaNfDevolucaoId: nfRef.id,
        ultimaNfDevolucaoNumero: nfPayload.numero || ''
      });
    });
    if (original.id) {
      batch.update(W.db.collection('notas_fiscais_entrada').doc(original.id), {
        itens: itensOriginalAtualizados,
        possuiDevolucao: true,
        statusDevolucao: devolvidosResumo.length >= (original.itens || []).length ? 'Devolvido total/parcial' : 'Devolvido parcial',
        ultimaNfDevolucaoId: nfRef.id,
        ultimaNfDevolucaoNumero: nfPayload.numero || '',
        ultimaDevolucaoEm: agora,
        updatedAt: agora
      });
    }
    itens.forEach(item => {
      const v = vinculosOrig.find(x => itemNFMatch(x, item));
      const estFallback = !v ? (W.J?.estoque || []).find(p => itemNFMatch(p, item)) : null;
      const estoqueIdDev = v?.estoqueId || estFallback?.id || '';
      const est = estoqueIdDev ? (W.J?.estoque || []).find(p => String(p.id) === String(estoqueIdDev)) : null;
      const qtd = Number(item.quantidade || item.qtd || v?.qtd || 0) || 0;
      if (v?.id) batch.update(W.db.collection('nf_itens_vinculos').doc(v.id), { devolvido:true, devolvidoEm:agora, nfDevolucaoId:nfRef.id, motivoDevolucao:motivo, updatedAt:agora });
      if (estoqueIdDev && est && !v?.estoqueBaixadoAutomatico) batch.update(W.db.collection('estoqueItems').doc(estoqueIdDev), { qtd:Math.max(0, (Number(est.qtd)||0) - qtd), updatedAt:agora });
      batch.set(W.db.collection('estoque_movimentos').doc(), cleanFirestoreNF({ tenantId:W.J.tid, estoqueId:estoqueIdDev, tipo:'devolucao_nf_fornecedor', nfId:nfRef.id, nfNumero:nfPayload.numero, nfOriginalId:original.id || '', nfOriginalNumero:original.numero || '', codigo:item.codigo || item.codigoFornecedor || v?.codigo || '', desc:item.descricao || item.desc || v?.desc || '', qtd:-Math.abs(qtd), custo:item.valorUnitario || item.custo || v?.custo || 0, total:item.valorLiquido || item.total || v?.total || 0, osId:v?.osId || item.osId || '', placa:v?.placa || item.placa || '', motivo, createdAt:agora, usuario:W.J?.nome || 'Sistema' }));
    });
    const removidasOS = removerPecasReaisDevolucaoBatch(batch, original, itens, nfPayload, motivo);
    const totalNF = Number(nfPayload.totalNF || nfPayload.totalItens || 0) || 0;
    batch.set(W.db.collection('financeiro').doc(), { tenantId:W.J.tid, tipo:'Entrada', status:'Pendente', desc:`Credito/abatimento devolucao NF ${nfPayload.numero || 's/n'} da NF ${original.numero || original.id || ''}`, valor:totalNF, pgto:'Abatimento devolucao', venc:isoToday(), notaFiscalId:nfRef.id, nfOriginalId:original.id || '', fornecedorId, createdAt:agora });
    batch.set(W.db.collection('lixeira_auditoria').doc(), { tenantId:W.J.tid, modulo:'ESTOQUE/NF', acao:`NF de devolucao ${nfPayload.numero || nfRef.id} vinculada a NF ${original.numero || original.id}`, usuario:W.J?.nome || 'Sistema', entidade:'notas_fiscais_entrada', entidadeId:nfRef.id, motivo, itens, devolvidosResumo, removidasOS, ts:agora });
    await batch.commit();
    if(W.toast) W.toast(`NF de devolucao registrada. ${removidasOS} peca(s) removida(s) de O.S. quando aplicavel.`, 'ok');
    if(typeof W.fecharModal === 'function') W.fecharModal('modalNF');
  }
  W.salvarNF = async function(){
    const nfEditId = D.getElementById('nfEditId')?.value || '';
    if ((nfEditId || W._thiaModoNF === 'edicao_nf') && typeof W.salvarEdicaoNF === 'function') {
      return W.salvarEdicaoNF();
    }
    if (nfEditId || W._thiaModoNF === 'edicao_nf') {
      if (W.toast) W.toast('Modo edicao de NF ativo. Nova entrada bloqueada para evitar duplicidade de estoque, O.S. e financeiro.', 'warn');
      return;
    }
    let itens = [];
    try { itens = collectItens(); }
    catch(e) { if(W.toast) W.toast(e.message || String(e), 'warn'); else alert(e.message || e); return; }
    if(!itens.length){ if(W.toast) W.toast('⚠ Adicione ao menos um item','warn'); return; }
    itens = itens.map((item, itemFiscalIndex) => Object.assign({}, item, {
      itemFiscalIndex: item?.itemFiscalIndex ?? item?.itemIndex ?? itemFiscalIndex,
      itemIndex: item?.itemIndex ?? item?.itemFiscalIndex ?? itemFiscalIndex
    }));
    if(!W.db || !W.J?.tid){ alert('Banco de dados ainda não carregado.'); return; }
    const nfe = W._nfeProData || null;
    const batch = W.db.batch();
    const fornecedorId = await ensureFornecedor(batch, nfe);
    const fornecedorNome = fornecedorNomeNF(nfe, fornecedorId);
    const fornecedorSnapshot = fornecedorSnapshotNF(nfe, fornecedorId, fornecedorNome);
    const duplicada = await buscarNFeDuplicada(nfe || { numero:getVal('nfNumero'), serie:'', chave:'', fornecedor:{ cnpj:'' } });
    if(duplicada){
      const msg = `NF ${getVal('nfNumero') || nfe?.numero || ''} ja importada. Operacao bloqueada para evitar duplicidade fiscal, estoque e financeiro.`;
      if(W.toast) W.toast(msg,'warn'); else alert(msg);
      mostrarNFeDuplicada(nfe || { numero:getVal('nfNumero'), serie:'', chave:'' }, duplicada);
      return;
    }
    const totaisTela = calcTotaisNF();
    const totalItens = totaisTela.totalItens;
    const totalNF = totaisTela.totalFiscal || nfe?.totais?.vNF || totalItens;
    const nfRef = W.db.collection('notas_fiscais_entrada').doc();
    const tipoOperacao = tipoOperacaoNF();
    const nfPayload = {
      tenantId: W.J.tid, tipo:'entrada', tipoOperacao, tipoNF:tipoOperacao, origem:nfe?'xml_nfe':'manual', fornecedorId,
      numero: getVal('nfNumero') || nfe?.numero || '', serie:nfe?.serie || '', chave:nfe?.chave || '', natureza:nfe?.natureza || '',
      dataNF: getVal('nfData') || nfe?.dataEmissao || isoToday(), totalNF, totalItens,
      despesasAcessorias: {
        frete: totaisTela.frete,
        seguro: totaisTela.seguro,
        outrasDespesas: totaisTela.outrasDespesas,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra
      },
      totaisFiscais: Object.assign({}, nfe?.totais || {}, {
        totalItens,
        vFrete: totaisTela.frete,
        vSeg: totaisTela.seguro,
        vOutro: totaisTela.outrasDespesas,
        descontoFiscalExtra: totaisTela.descontoFiscalExtra,
        vNF: totalNF,
        totalCalculado: totaisTela.totalCalculado
      }), cobranca: nfe?.cobranca || {}, pagamentos:nfe?.pagamentos || [], fornecedorSnapshot, fornecedorNome,
      itens, rawXml:nfe?.rawXml || '', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    };
    if (isNFDevolucao(nfe, itens)) {
      await salvarNFDevolucao(itens, nfe, fornecedorId, nfPayload);
      return;
    }
    const itensOperacionais = expandirItensPorDestinoNF(itens);
    let vinculosOS;
    try {
      vinculosOS = await registrarPecasReaisOSNF(batch, itensOperacionais, nfRef, nfPayload, fornecedorId, fornecedorNome);
    } catch(e) {
      if(W.toast) W.toast(e.message || String(e), 'warn'); else alert(e.message || e);
      return;
    }
    batch.set(nfRef, nfPayload);
    for(const [itemFiscalIndex, item] of itens.entries()){
      const existente = (W.J?.estoque || []).find(p => String(p.codigo||p.oem||'').toLowerCase() === String(item.codigo||'').toLowerCase() && item.codigo) || (W.J?.estoque || []).find(p => String(p.desc||'').toLowerCase() === String(item.descricao||'').toLowerCase());
      const destinosItem = expandirItensPorDestinoNF([item]).map(destItem => Object.assign({}, destItem, { itemFiscalIndex }));
      const entradaQtd = destinosItem.reduce((s, d) => s + (Number(d.quantidade || d.qtd || 0) || 0), 0);
      const qtdDisponivel = destinosItem.filter(destinoEstoqueNF).reduce((s, d) => s + (Number(d.quantidade || d.qtd || 0) || 0), 0);
      const custoOp = custoOperacionalNF(item);
      const estoqueRef = existente ? W.db.collection('estoqueItems').doc(existente.id) : W.db.collection('estoqueItems').doc();
      const estoqueId = estoqueRef.id;
      const estoquePayload = { tenantId:W.J.tid, desc:item.descricao, descricao:item.descricao, codigo:item.codigoFornecedor||item.codigo||'', codigoFornecedor:item.codigoFornecedor||item.codigo||'', codigoComercial:item.codigoComercial||item.oem||'', oem:item.oem||item.codigoComercial||item.codigo||'', marca:item.marca||'', ean:item.ean||'', ncm:item.ncm||'', cest:item.cest||'', cfop:item.cfop||'', und:item.unidadeFiscal||item.unidade||'UN', unidadeFiscal:item.unidadeFiscal||item.unidade||'UN', quantidadeFiscal:item.quantidadeFiscal||item.quantidade||0, quantidadeOperacional:entradaQtd, fatorOperacional:item.fatorOperacional||1, custo:custoOp, valorUnitarioFiscal:item.valorUnitarioFiscal||item.valorUnitario||0, venda:(item.vendaFrotistaAutomatica ? (item.vendaEstoque || custoOp) : (item.venda || custoOp)), fornecedorId, fornecedorNome, ultimaFornecedor:fornecedorNome, ultimaNF:nfPayload.numero, ultimaNFId:nfRef.id, updatedAt:new Date().toISOString() };
      if(existente) batch.update(estoqueRef, Object.assign({}, estoquePayload, { qtd:(Number(existente.qtd)||0)+qtdDisponivel }));
      else batch.set(estoqueRef, Object.assign({}, estoquePayload, { qtd:qtdDisponivel, min:1, createdAt:new Date().toISOString() }));
      batch.set(W.db.collection('estoque_movimentos').doc(), cleanFirestoreNF({ tenantId:W.J.tid, estoqueId, tipo:'entrada_nf', nfId:nfRef.id, nfNumero:nfPayload.numero, chave:nfPayload.chave, fornecedorId, fornecedorNome, itemFiscalIndex, numeroItem:item.numeroItem||item.nItem||item.item||'', codigo:item.codigo||item.codigoFornecedor||'', desc:item.descricao, qtd:entradaQtd, quantidadeFiscal:item.quantidadeFiscal||item.quantidade||0, fatorOperacional:item.fatorOperacional||1, custo:custoOp, valorUnitarioFiscal:item.valorUnitario||0, total:item.valorLiquido, osId:'', placa:'', destino:'entrada_operacional', createdAt:new Date().toISOString(), usuario:W.J?.nome||'Sistema' }));
      for (const destItem of destinosItem) {
        const vinculadoNaEntrada = destinoVinculadoNF(destItem);
        if(vinculadoNaEntrada && Number(destItem.quantidade || destItem.qtd || 0)){
          batch.set(W.db.collection('estoque_movimentos').doc(), cleanFirestoreNF({ tenantId:W.J.tid, estoqueId, tipo:'baixa_automatica_vinculo_nf_os', nfId:nfRef.id, nfNumero:nfPayload.numero, chave:nfPayload.chave, fornecedorId, fornecedorNome, itemFiscalIndex, numeroItem:destItem.numeroItem||destItem.nItem||destItem.item||'', destinoKey:destItem.destinoKey||`destino_${destItem.destinoIndice ?? 0}`, origemNFItemKey:origemNFItemKeyNF(destItem, nfRef.id), codigo:destItem.codigo||destItem.codigoFornecedor||'', desc:destItem.descricao, qtd:-Math.abs(Number(destItem.quantidade || destItem.qtd || 0) || 0), quantidadeFiscal:item.quantidadeFiscal||item.quantidade||0, custo:destItem.valorUnitario, valorUnitarioFiscal:item.valorUnitario||0, total:destItem.valorLiquido, osId:destItem.osId||'', placa:destItem.placa||'', destino:destItem.destino||destItem.finalidade||'os', destinoIndice:destItem.destinoIndice ?? 0, motivo:'Peca vinculada a veiculo/O.S. na entrada da NF; saldo de estoque fica baixado automaticamente.', createdAt:new Date().toISOString(), usuario:W.J?.nome||'Sistema' }));
        }
        batch.set(W.db.collection('nf_itens_vinculos').doc(), cleanFirestoreNF({ tenantId:W.J.tid, nfId:nfRef.id, nfNumero:nfPayload.numero, chave:nfPayload.chave, fornecedorId, fornecedorNome, estoqueId, itemFiscalIndex, itemIndex:itemFiscalIndex, numeroItem:destItem.numeroItem||destItem.nItem||destItem.item||'', destinoIndice:destItem.destinoIndice ?? 0, destinoKey:destItem.destinoKey||`destino_${destItem.destinoIndice ?? 0}`, origemNFItemKey:origemNFItemKeyNF(destItem, nfRef.id), codigo:destItem.codigo||'', codigoFornecedor:destItem.codigoFornecedor||destItem.codigo||'', codigoComercial:destItem.codigoComercial||destItem.oem||'', ean:destItem.ean||'', desc:destItem.descricao, marca:destItem.marca||'', qtd:destItem.quantidade, quantidadeFiscal:item.quantidadeFiscal||item.quantidade||0, quantidadeOperacionalTotal:entradaQtd, fatorOperacional:item.fatorOperacional||1, custo:destItem.valorUnitario, valorUnitarioFiscal:item.valorUnitario||0, desconto:item.desconto, total:destItem.valorLiquido, ncm:destItem.ncm||'', cest:destItem.cest||'', cfop:destItem.cfop||'', finalidade:destItem.destino||destItem.finalidade||'estoque', destino:destItem.destino||destItem.finalidade||'estoque', vinculo:destItem.vinculo||'', osId:destItem.osId||'', placa:destItem.placa||'', estoqueBaixadoAutomatico:vinculadoNaEntrada, status:'Ativo', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }));
      }
    }
    const forma = getVal('nfPgtoForma') || 'Dinheiro';
    const formaNorm = formaPagamentoNFNorm(forma);
    const formaAVista = formaPagamentoNFAVista(forma);
    const formaAgrupamentoPeriodo = forma === 'AgrupamentoPeriodo' || formaNorm.includes('agrupamento');
    const formaPermiteParcelas = !formaAgrupamentoPeriodo && formaPagamentoNFParcelavel(forma);
    if (formaPermiteParcelas && !formaAVista && !collectParcelas().length) gerarParcelasManuais();
    const parcelas = collectParcelas();
    const parcelasFinanceiras = formaPermiteParcelas && !formaAVista ? parcelas : [];
    const statusFinanceiro = formaAVista ? 'Pago' : 'Pendente';
    if(formaAgrupamentoPeriodo){
      const diasAgr = Math.max(1, parseInt(getVal('nfAgrPeriodoDias') || '7', 10) || 7);
      const vencAgr = getVal('nfAgrVenc') || getVal('nfVenc') || isoToday();
      const statusAgr = 'Aguardando boleto agrupado';
      const grupoKey = ['fornecedor', fornecedorId || onlyDigits(nfe?.fornecedor?.cnpj || ''), 'periodo', diasAgr, vencAgr].join('_').replace(/[.#$\[\]\/]/g, '_');
      batch.set(W.db.collection('financeiro').doc(), { tenantId:W.J.tid, tipo:'Saida', status:statusAgr, desc:`NF ${nfPayload.numero || 's/n'} aguardando boleto agrupado - ${fornecedorNome || 'Fornecedor'}`, valor:totalNF, pgto:'Agrupamento por periodo', venc:vencAgr, notaFiscalId:nfRef.id, chaveNFe:nfPayload.chave, fornecedorId, fornecedorNome:fornecedorNome || '', agrupamentoPeriodo:true, aguardaBoletoAgrupado:true, agrupamentoDias:diasAgr, agrupamentoVencimentoPrevisto:vencAgr, agrupamentoFornecedorKey:grupoKey, bloqueadoPagamentoIndividual:true, createdAt:new Date().toISOString() });
    } else if(parcelasFinanceiras.length){
      for(const [idx,p] of parcelasFinanceiras.entries()){
        batch.set(W.db.collection('financeiro').doc(), { tenantId:W.J.tid, tipo:'Saída', status:statusFinanceiro, desc:`NF ${nfPayload.numero || 's/n'} — ${fornecedorNome || 'Fornecedor'} (${idx+1}/${parcelasFinanceiras.length})`, valor:p.valor, pgto:forma, venc:p.vencimento || isoToday(), notaFiscalId:nfRef.id, chaveNFe:nfPayload.chave, fornecedorId, fornecedorNome:fornecedorNome || '', createdAt:new Date().toISOString() });
      }
    } else {
      batch.set(W.db.collection('financeiro').doc(), { tenantId:W.J.tid, tipo:'Saída', status:statusFinanceiro, desc:`NF ${nfPayload.numero || 's/n'} — ${fornecedorNome || 'Fornecedor'}`, valor:totalNF, pgto:forma, venc:getVal('nfVenc') || isoToday(), notaFiscalId:nfRef.id, chaveNFe:nfPayload.chave, fornecedorId, fornecedorNome:fornecedorNome || '', createdAt:new Date().toISOString() });
    }
    await batch.commit();
    await salvarRegistrosAuxiliaresNF(vinculosOS);
    if(W.toast) W.toast(`✓ NF ${nfPayload.numero || 's/n'} lançada com espelho fiscal, estoque e financeiro${vinculosOS.pecas ? `; ${vinculosOS.pecas} peça(s) vinculada(s) em ${vinculosOS.os} O.S.` : ''}`); else alert('NF lançada.');
    if(typeof W.audit === 'function') W.audit('ESTOQUE/NF', `Entrada NF ${nfPayload.numero || 's/n'} — ${fmtBR(totalNF)} — ${itens.length} item(ns)`);
    if(typeof W.fecharModal === 'function') W.fecharModal('modalNF');
  };
  W.buscarCepAutoPro = async function(cep, prefix){
    const c = onlyDigits(cep); if(c.length !== 8) return null;
    const resp = await fetch(`https://viacep.com.br/ws/${c}/json/`); const data = await resp.json(); if(data.erro) return null;
    const map = { rua:data.logradouro||'', bairro:data.bairro||'', cidade:data.localidade||'', uf:data.uf||'', complemento:data.complemento||'' };
    Object.entries(map).forEach(([k,v]) => { const el = $(prefix + k.charAt(0).toUpperCase()+k.slice(1)) || $(prefix + k); if(el && !el.value) el.value = v; });
    return data;
  };
  D.addEventListener('change', function(e){ if(e.target && e.target.id === 'nfParcelas') gerarParcelasManuais(); });
  D.addEventListener('DOMContentLoaded', function(){
    ensureNFVinculoLoteUI();
    const st = D.createElement('style');
    st.textContent = `@media(max-width:900px){.nf-real-grid-main,.nf-real-grid-fiscal,.nf-real-grid-destino,.nf-real-grid-operacional,.nf-real-tributos,.nf-split-row{grid-template-columns:1fr!important}.nf-real-row input,.nf-real-row select{min-width:0!important}}`;
    D.head.appendChild(st);
  });
})();
