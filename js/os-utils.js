(function() {
  'use strict';

  const U = {};

  U.escapeHtml = function(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  };

  U.normalizeText = function(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  U.normalizePlate = function(value) {
    return String(value == null ? '' : value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  U.parseNumberBR = function(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    let s = String(value == null ? '' : value).trim();
    if (!s) return 0;
    s = s.replace(/\s/g, '').replace(/R\$/gi, '').replace(/%/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      s = s.replace(',', '.');
    }
    s = s.replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  U.parseDiscountRate = function(value) {
    const n = U.parseNumberBR(value);
    return n > 1 ? +(n / 100).toFixed(6) : n;
  };

  U.formatInputMoney = function(value) {
    const n = U.parseNumberBR(value);
    return n ? n.toFixed(2).replace('.', ',') : '0,00';
  };

  U.moeda = function(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(U.parseNumberBR(value));
  };

  U.getCliente = function(os, clientes, fallbackCliente) {
    if (fallbackCliente) return fallbackCliente;
    return (clientes || []).find(c => c.id === os?.clienteId) || null;
  };

  U.getValorHoraCliente = function(cliente, fallback) {
    return U.parseNumberBR(cliente?.govValorHora || cliente?.valorHora || fallback || 0);
  };

  U.PMSP_VALORES_HORA = [
    { key: 'mecanica_eletrica_otto', grupo: 'mecanica_eletrica', porte: 'otto', label: 'MECANICA E ELETRICA GERAL EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 152.25 },
    { key: 'mecanica_eletrica_diesel', grupo: 'mecanica_eletrica', porte: 'diesel', label: 'MECANICA E ELETRICA GERAL EM VEICULOS MEDIOS A DIESEL', valor: 188.02 },
    { key: 'mecanica_eletrica_pesado', grupo: 'mecanica_eletrica', porte: 'pesado', label: 'MECANICA E ELETRICA GERAL EM ONIBUS E CAMINHOES', valor: 227.00 },
    { key: 'injecao_otto', grupo: 'injecao', porte: 'otto', label: 'INJECAO EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 166.36 },
    { key: 'injecao_diesel', grupo: 'injecao', porte: 'diesel', label: 'INJECAO EM VEICULOS MEDIOS A DIESEL', valor: 222.03 },
    { key: 'injecao_pesado', grupo: 'injecao', porte: 'pesado', label: 'INJECAO EM ONIBUS E CAMINHOES', valor: 252.00 },
    { key: 'retifica_ajuste_otto', grupo: 'retifica_ajuste', porte: 'otto', label: 'RETIFICA (AJUSTE E MONTAGEM) EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 159.25 },
    { key: 'retifica_ajuste_diesel', grupo: 'retifica_ajuste', porte: 'diesel', label: 'RETIFICA (AJUSTE E MONTAGEM) EM VEICULOS MEDIOS A DIESEL', valor: 235.65 },
    { key: 'retifica_ajuste_pesado', grupo: 'retifica_ajuste', porte: 'pesado', label: 'RETIFICA (AJUSTE E MONTAGEM) EM ONIBUS E CAMINHOES', valor: 249.46 },
    { key: 'retifica_usinagem_otto', grupo: 'retifica_usinagem', porte: 'otto', label: 'RETIFICA (USINAGEM) EM VEICULOS PEQUENOS E MEDIOS CICLO OTTO', valor: 157.96 },
    { key: 'retifica_usinagem_diesel', grupo: 'retifica_usinagem', porte: 'diesel', label: 'RETIFICA (USINAGEM) EM VEICULOS MEDIOS A DIESEL', valor: 195.52 },
    { key: 'retifica_usinagem_pesado', grupo: 'retifica_usinagem', porte: 'pesado', label: 'RETIFICA (USINAGEM) EM ONIBUS E CAMINHOES', valor: 236.58 },
    { key: 'cambio_leve', grupo: 'cambio', porte: 'leve', label: 'CAMBIO EM VEICULOS PEQUENOS E MEDIOS', valor: 196.07 },
    { key: 'cambio_pesado', grupo: 'cambio', porte: 'pesado', label: 'CAMBIO EM ONIBUS E CAMINHOES', valor: 263.05 },
    { key: 'capotaria_leve', grupo: 'capotaria', porte: 'leve', label: 'CAPOTARIA EM VEICULOS PEQUENOS E MEDIOS', valor: 160.26 },
    { key: 'capotaria_pesado', grupo: 'capotaria', porte: 'pesado', label: 'CAPOTARIA EM VEICULOS ONIBUS E CAMINHOES', valor: 245.38 },
    { key: 'funilaria_pintura_leve', grupo: 'funilaria_pintura', porte: 'leve', label: 'FUNILARIA, LANTERNAGEM E PINTURA EM VEICULOS PEQUENOS E MEDIOS', valor: 166.31 },
    { key: 'funilaria_pintura_pesado', grupo: 'funilaria_pintura', porte: 'pesado', label: 'FUNILARIA, LANTERNAGEM E PINTURA EM ONIBUS E CAMINHAO', valor: 267.32 },
    { key: 'borracharia_leve', grupo: 'borracharia', porte: 'leve', label: 'BORRACHARIA EM VEICULOS PEQUENOS E MEDIOS', valor: 105.38 },
    { key: 'borracharia_pesado', grupo: 'borracharia', porte: 'pesado', label: 'BORRACHARIA EM ONIBUS E CAMINHOES', valor: 177.36 },
    { key: 'lavagem_leve', grupo: 'lavagem', porte: 'leve', label: 'LAVAGEM EM VEICULOS PEQUENOS E MEDIOS', valor: 129.47 },
    { key: 'lavagem_pesado', grupo: 'lavagem', porte: 'pesado', label: 'LAVAGEM EM ONIBUS E CAMINHAO', valor: 193.31 },
    { key: 'polimento_leve', grupo: 'polimento', porte: 'leve', label: 'POLIMENTO EM VEICULOS PEQUENOS E MEDIOS', valor: 160.91 },
    { key: 'polimento_pesado', grupo: 'polimento', porte: 'pesado', label: 'POLIMENTO EM ONIBUS E CAMINHAO', valor: 240.26 }
  ];

  U.getPMSPValorHora = function(key) {
    return U.PMSP_VALORES_HORA.find(item => item.key === key) || null;
  };

  U.getPMSPValoresHora = function() {
    return U.PMSP_VALORES_HORA.slice();
  };

  U.getPMSPPorteVeiculo = function(veiculo) {
    const text = U.normalizeText([
      veiculo?.tipo,
      veiculo?.marca,
      veiculo?.modelo,
      veiculo?.combustivel,
      veiculo?.obs
    ].filter(Boolean).join(' '));
    if (/\b(onibus|microonibus|caminhao|caminhoes|truck|carreta|semi reboque|van pesada)\b/.test(text)) return 'pesado';
    if (/\b(diesel|trailblazer|s10|hilux|ranger|amarok|frontier|l200|ducato|sprinter|master|daily|hr|bongo|vito)\b/.test(text)) return 'diesel';
    return 'otto';
  };

  function rateForGroup(grupo, porte) {
    const p = porte || 'otto';
    const isPesado = p === 'pesado';
    if (['cambio', 'capotaria', 'funilaria_pintura', 'borracharia', 'lavagem', 'polimento'].includes(grupo)) {
      return U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === (isPesado ? 'pesado' : 'leve')) || null;
    }
    return U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === p) ||
      U.PMSP_VALORES_HORA.find(item => item.grupo === grupo && item.porte === 'otto') ||
      null;
  }

  U.inferPMSPValorHora = function(input, options) {
    const opts = options || {};
    const veiculo = opts.veiculo || input?.veiculo || {};
    const porte = opts.porte || U.getPMSPPorteVeiculo(veiculo);
    const text = U.normalizeText([
      input?.secaoHoraLabel,
      input?.sistemaTabela,
      input?.sistema,
      input?.operacao,
      input?.item,
      input?.desc,
      input?.descricao
    ].filter(Boolean).join(' '));
    if (!text) return null;

    const stored = U.getPMSPValorHora(input?.secaoHora || input?.secaoHoraKey || input?.valorHoraKey || '');
    if (stored) return { ...stored, origem: 'selecionado' };

    let grupo = '';
    if (/\b(retifica|retific)\b/.test(text)) grupo = /\b(usinagem|usinar|torno|plainar)\b/.test(text) ? 'retifica_usinagem' : 'retifica_ajuste';
    else if (/\b(cambio|caixa de marcha|transmissao|embreagem)\b/.test(text)) grupo = 'cambio';
    else if (/\b(capotaria|tape[c]?aria|tapecaria|banco|assento|encosto|forro|estof)\b/.test(text)) grupo = 'capotaria';
    else if (/\b(funilaria|lanternagem|pintura|pintar|para choque|parachoque|lataria)\b/.test(text)) grupo = 'funilaria_pintura';
    else if (/\b(borracharia|pneu|pneus|roda|rodas|calota|balanceamento)\b/.test(text)) grupo = 'borracharia';
    else if (/\b(lavagem|lavar|higienizacao|higienizar|limpeza interna|limpeza externa)\b/.test(text)) grupo = 'lavagem';
    else if (/\b(polimento|polir|cristalizacao|cristalizar)\b/.test(text)) grupo = 'polimento';
    else if (/\b(injecao|injetor|bico|bicos|alimentacao|combustivel|bomba de combustivel|tanque|carburador)\b/.test(text)) grupo = 'injecao';
    else if (/\b(mecanica|eletrica|eletrico|freio|suspensao|amortec|direcao|arrefecimento|radiador|motor|correia|oleo|filtro|vela|farol|lampada|bateria|alternador|compressor|ar condicionado|climatizacao)\b/.test(text)) grupo = 'mecanica_eletrica';

    const rate = grupo ? rateForGroup(grupo, porte) : null;
    return rate ? { ...rate, origem: 'inferido', porte } : null;
  };

  U.resolvePMSPServico = function(servico, options) {
    const opts = options || {};
    const tempo = U.parseNumberBR(servico?.tempo || 0);
    const valorServico = U.parseNumberBR(servico?.valor || 0);
    const escolhido = U.getPMSPValorHora(servico?.secaoHora || servico?.secaoHoraKey || '');
    const inferido = escolhido || U.inferPMSPValorHora(servico, opts);
    const valorHoraInformado = U.parseNumberBR(servico?.valorHora || servico?.valorHoraSecao || servico?.precoHora || 0);
    const valorHoraDerivado = tempo > 0 && valorServico > 0 ? +(valorServico / tempo).toFixed(2) : 0;
    const valorHora = valorHoraInformado || inferido?.valor || valorHoraDerivado || U.parseNumberBR(opts.fallbackValorHora || 0);
    const secaoHora = servico?.secaoHora || inferido?.key || '';
    const secaoHoraLabel = servico?.secaoHoraLabel || inferido?.label || servico?.sistemaTabela || servico?.sistema || '';
    return {
      secaoHora,
      secaoHoraLabel,
      valorHora,
      valorHoraTabela: inferido?.valor || 0,
      valorHoraOrigem: servico?.secaoHora ? 'selecionado' : (inferido?.origem || (valorHoraInformado ? 'manual' : 'fallback'))
    };
  };

  U.roundMoney = function(value) {
    return +U.parseNumberBR(value).toFixed(2);
  };

  // V22: desconto individual de cada peça/serviço é armazenado em REAIS.
  // Mantém leitura compatível com a V21, que gravava o desconto individual como percentual.
  U.getItemIndividualDiscountValue = function(item, bruto) {
    const base = Math.max(0, U.parseNumberBR(bruto || 0));
    const temValorExplicito = item && (
      item.descontoIndividualTipo === 'valor' ||
      item.descontoIndividualValor != null ||
      item.descIndividualValor != null ||
      item.descontoValorItem != null ||
      item.descValorItem != null
    );
    if (temValorExplicito) {
      const valor = U.parseNumberBR(
        item.descontoIndividualValor ?? item.descIndividualValor ?? item.descontoValorItem ?? item.descValorItem ?? item.descontoIndividual ?? 0
      );
      return U.roundMoney(Math.min(base, Math.max(0, valor)));
    }
    const taxaLegada = U.parseDiscountRate(
      item?.descIndividualPct ?? item?.descIndividual ?? item?.descontoIndividual ?? item?.descontoItem ?? item?.descItem ?? 0
    );
    return U.roundMoney(Math.min(base, Math.max(0, base * taxaLegada)));
  };

  U.calculateDiscountBreakdown = function(bruto, descontoGeralTaxa, descontoIndividualValor) {
    const original = U.roundMoney(Math.max(0, U.parseNumberBR(bruto || 0)));
    const taxaGeral = Math.min(1, Math.max(0, U.parseDiscountRate(descontoGeralTaxa || 0)));
    const descontoGeralValor = U.roundMoney(original * taxaGeral);
    const aposGeral = U.roundMoney(Math.max(0, original - descontoGeralValor));
    const descontoIndividualAplicado = U.roundMoney(Math.min(aposGeral, Math.max(0, U.parseNumberBR(descontoIndividualValor || 0))));
    const descontoValor = U.roundMoney(descontoGeralValor + descontoIndividualAplicado);
    const valorFinal = U.roundMoney(Math.max(0, original - descontoValor));
    const descPct = original > 0 ? +(descontoValor / original).toFixed(6) : 0;
    return {
      valorOriginal: original,
      valorBruto: original,
      bruto: original,
      descontoGeralPct: taxaGeral,
      descGeralPct: taxaGeral,
      descontoGeralValor,
      descontoIndividualValor: descontoIndividualAplicado,
      descIndividualValor: descontoIndividualAplicado,
      descontoValor,
      descPct,
      valorFinal,
      total: valorFinal
    };
  };

  U.calcularServicoMaoObra = function(servico, cliente, options) {
    const opts = options || {};
    const tempo = U.parseNumberBR(servico?.tempo || 0);
    const valorInformado = U.parseNumberBR(servico?.valor || servico?.valorBruto || 0);
    const descMOGeral = opts.descMO != null
      ? U.parseDiscountRate(opts.descMO)
      : U.getDescontosCliente(cliente, opts.os || {}).descMO;
    const resolvido = U.resolvePMSPServico(servico, {
      veiculo: opts.veiculo,
      fallbackValorHora: opts.fallbackValorHora
    });
    const origem = U.normalizeText(servico?.origemServico || '');
    const valorHoraManual = servico?.valorHoraManual === true || servico?.valorHoraManual === '1';
    const origemTempa = origem.includes('tempa') || origem.includes('tabela');
    const temBaseTabela = !!(
      opts.forcarCalculoHora ||
      servico?.secaoHora ||
      servico?.secaoHoraKey ||
      servico?.secaoHoraLabel ||
      servico?.valorHoraSecao ||
      servico?.valorHoraTabela ||
      servico?.codigoTabela ||
      servico?.codigoTempa ||
      servico?.codigoInterno ||
      servico?.codInterno ||
      servico?.codigoServicoInterno ||
      servico?.sistemaTabela ||
      origemTempa
    );
    const valorHoraPreferido = opts.valorHoraInput != null ? opts.valorHoraInput : (
      valorHoraManual
        ? (servico?.valorHora || servico?.valorHoraSecao || servico?.precoHora || servico?.valorHoraTabela || resolvido.valorHoraTabela || resolvido.valorHora || opts.fallbackValorHora || 0)
        : (servico?.valorHoraSecao || servico?.precoHora || servico?.valorHoraTabela || resolvido.valorHoraTabela || (temBaseTabela ? (resolvido.valorHora || servico?.valorHora) : 0) || opts.fallbackValorHora || 0)
    );
    const valorHora = U.parseNumberBR(valorHoraPreferido);
    const valorManualTotal = servico?.valorManual === true || servico?.valorManual === '1';
    const temHoraExplicita = opts.valorHoraInput != null || valorHoraManual || !!(servico?.valorHoraSecao || servico?.valorHoraTabela || servico?.precoHora);
    const usaCalculoHora = tempo > 0 && valorHora > 0 && (
      temBaseTabela ||
      valorHoraManual ||
      opts.forcarCalculoHora === true ||
      (opts.usarHoraQuandoDisponivel === true && temHoraExplicita && !valorManualTotal)
    );
    const bruto = usaCalculoHora ? U.roundMoney(tempo * valorHora) : U.roundMoney(valorInformado);
    const descontoIndividualValor = U.getItemIndividualDiscountValue(servico, bruto);
    const descontos = U.calculateDiscountBreakdown(bruto, descMOGeral, descontoIndividualValor);
    return {
      tempo,
      valorHora,
      valorHoraTabela: U.parseNumberBR(resolvido.valorHoraTabela || servico?.valorHoraTabela || 0),
      ...descontos,
      descIndividualPct: bruto > 0 ? +(descontos.descontoIndividualValor / bruto).toFixed(6) : 0,
      descontoIndividualTipo: 'valor',
      usaCalculoHora,
      resolvido
    };
  };

  U.getDescontosCliente = function(cliente, os) {
    const descMO = os?.descMO != null ? U.parseDiscountRate(os.descMO) : U.parseDiscountRate(cliente?.govDescMO || 0);
    const descPeca = os?.descPeca != null ? U.parseDiscountRate(os.descPeca) : U.parseDiscountRate(cliente?.govDescPeca || 0);
    return { descMO, descPeca };
  };

  U.getVehicle = function(os, veiculos) {
    return (veiculos || []).find(v => v.id === os?.veiculoId) || {};
  };

  // V22.4.0 — Blindagem de peças reais vinculadas por NF.
  // Esses registros continuam preservados na O.S. para auditoria interna, porém
  // nunca podem compor orçamento/PDF/planilha/portal de cliente oficial.
  U.isProtectedRealPart = function(peca) {
    if (!peca || typeof peca !== 'object') return false;
    const origem = U.normalizeText(peca.origem || '').replace(/\s+/g, '_');
    const status = U.normalizeText(peca.statusAplicacao || '').replace(/\s+/g, '_');
    const chaveNF = String(peca.origemNFItemKey || '').trim();
    const referenciaNF = String(peca.nfId || peca.nf || peca.nfNumero || peca.numeroNF || '').trim();
    return peca.origemNFVinculada === true ||
      origem === 'nf_entrada_os' ||
      origem === 'nf_entrada' ||
      status === 'comprada_vinculada_nf' ||
      (!!chaveNF && (!!referenciaNF || origem.includes('nf_entrada')));
  };

  U.isOfficialClient = function(os, cliente) {
    const o = os || {};
    const c = cliente || {};
    const normalizar = value => String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
    const nome = normalizar(c.nome || c.razaoSocial || c.govUnidade || o.clienteNome || o.cliente || '');
    if (!nome || nome === 'CONSUMIDOR') return false;
    const tipo = String(c.tipoCliente || o.tipoCliente || o.clienteTipo || '').toLowerCase();
    if (tipo === 'governo' || tipo === 'oficial') return true;
    const indicadores = [
      nome,
      c.clienteOficial === true ? 'OFICIAL' : '',
      c.orgaoPublico === true ? 'ORGAO PUBLICO' : '',
      c.publico === true ? 'PUBLICO' : '',
      c.gov === true ? 'GOVERNO' : '',
      c.tipoCliente,
      c.govUnidade,
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
  };

  // V22.4.1 — também reconhece registros antigos que perderam os metadados
  // de origem ao serem reabertos/salvos como peça avulsa de cliente oficial.
  // A identificação exige correspondência forte com pecasReais e com o custo
  // real da NF; assim uma peça comercial legítima, com valor de orçamento
  // diferente, permanece normalmente na O.S.
  function normalizarCodigoPecaReal(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normalizarDescricaoPecaReal(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function codigoFortePecaReal(value) {
    const codigo = normalizarCodigoPecaReal(value);
    if (!codigo || codigo.length < 3) return '';
    if (/^(SEMOEM|SEM|OEM|NI|NA|SN|SNCODIGO|NAOINFORMADO|000+)$/.test(codigo)) return '';
    return codigo;
  }

  function codigosPecaReal(item) {
    return Array.from(new Set([
      item?.codigo,
      item?.cod,
      item?.codigoExibicao,
      item?.codigoComercial,
      item?.codigoFornecedor,
      item?.oem,
      item?.codigoOEM,
      item?.partNumber,
      item?.numeroPeca
    ].map(codigoFortePecaReal).filter(Boolean)));
  }

  function descricaoPecaReal(item) {
    return normalizarDescricaoPecaReal(
      item?.desc || item?.descricao || item?.descricaoExibicao || item?.descLivre ||
      item?.descricaoPeca || item?.nomePeca || item?.nome || item?.item || ''
    );
  }

  function quantidadePecaReal(item) {
    return U.parseNumberBR(item?.qtd ?? item?.q ?? item?.quantidadeOperacionalTotal ?? item?.quantidadeFiscal ?? item?.quantidade ?? 1) || 1;
  }

  function valoresUnitariosPecaOrcamento(item) {
    return Array.from(new Set([
      item?.venda,
      item?.valor,
      item?.v,
      item?.valorUnit,
      item?.valorUnitario,
      item?.custo,
      item?.c
    ].map(U.parseNumberBR).filter(v => v > 0).map(v => +v.toFixed(4))));
  }

  function custosUnitariosPecaReal(item) {
    const qtd = quantidadePecaReal(item);
    const total = U.parseNumberBR(item?.totalCompra ?? item?.valorTotal ?? item?.total ?? 0);
    const valores = [
      item?.valorCompra,
      item?.custo,
      item?.valorUnitarioFiscal,
      item?.valorUnitario,
      item?.custoUnitario,
      item?.precoCompra,
      item?.valor
    ].map(U.parseNumberBR).filter(v => v > 0);
    if (total > 0 && qtd > 0) valores.push(total / qtd);
    return Array.from(new Set(valores.map(v => +v.toFixed(4))));
  }

  function valoresCoincidemPecaReal(peca, real) {
    const publicos = valoresUnitariosPecaOrcamento(peca);
    const custos = custosUnitariosPecaReal(real);
    return publicos.some(v => custos.some(c => Math.abs(v - c) <= Math.max(0.03, Math.abs(c) * 0.0005)));
  }

  function descricoesCoincidemPecaReal(peca, real) {
    const a = descricaoPecaReal(peca);
    const b = descricaoPecaReal(real);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length < 12 || b.length < 12) return false;
    const menor = a.length <= b.length ? a : b;
    const maior = a.length > b.length ? a : b;
    return menor.length >= 16 && maior.includes(menor);
  }

  function referenciasNFCoincidemPecaReal(peca, real) {
    const refsPeca = [peca?.nfId, peca?.nf, peca?.nfNumero, peca?.numeroNF]
      .map(normalizarCodigoPecaReal).filter(Boolean);
    const refsReal = [real?.nfId, real?.nf, real?.nfNumero, real?.numeroNF]
      .map(normalizarCodigoPecaReal).filter(Boolean);
    return refsPeca.some(ref => refsReal.includes(ref));
  }

  U.getRealParts = function(os) {
    const listas = [
      os?.pecasReais,
      os?.pecasRealmenteTrocadas,
      os?.itensReais
    ];
    const out = [];
    const vistos = new Set();
    listas.forEach(lista => (Array.isArray(lista) ? lista : []).forEach(real => {
      if (!real || typeof real !== 'object') return;
      const chave = normalizarCodigoPecaReal(real.origemNFItemKey || real.idReal || real.pecaRealId || '') ||
        [codigosPecaReal(real)[0] || '', descricaoPecaReal(real), quantidadePecaReal(real), custosUnitariosPecaReal(real)[0] || 0].join('|');
      if (chave && vistos.has(chave)) return;
      if (chave) vistos.add(chave);
      out.push(real);
    }));
    return out;
  };

  U.isBudgetPieceLinkedToRealPart = function(os, peca) {
    if (!peca || typeof peca !== 'object') return false;
    if (U.isProtectedRealPart(peca)) return true;

    const reais = U.getRealParts(os);
    if (!reais.length) return false;

    const chavePeca = normalizarCodigoPecaReal(peca.origemNFItemKey || peca.idReal || peca.pecaRealId || '');
    const codigosPeca = codigosPecaReal(peca);
    const qtdPeca = quantidadePecaReal(peca);

    return reais.some(real => {
      const chaveReal = normalizarCodigoPecaReal(real.origemNFItemKey || real.idReal || real.pecaRealId || '');
      if (chavePeca && chaveReal && chavePeca === chaveReal) return true;

      const codigosReal = codigosPecaReal(real);
      const codigoIgual = codigosPeca.some(codigo => codigosReal.includes(codigo));
      const descricaoIgual = descricoesCoincidemPecaReal(peca, real);
      const valorIgual = valoresCoincidemPecaReal(peca, real);
      const qtdIgual = Math.abs(qtdPeca - quantidadePecaReal(real)) < 0.0001;
      const nfIgual = referenciasNFCoincidemPecaReal(peca, real);

      if (nfIgual && (codigoIgual || descricaoIgual)) return true;
      if (codigoIgual && valorIgual && (descricaoIgual || qtdIgual)) return true;
      if (descricaoIgual && valorIgual && qtdIgual) return true;
      return false;
    });
  };

  U.hasProtectedRealParts = function(os) {
    return (os?.pecas || []).some(peca => U.isBudgetPieceLinkedToRealPart(os, peca));
  };

  U.getPublicBudgetPieces = function(os, cliente) {
    const oficial = U.isOfficialClient(os, cliente);
    return (os?.pecas || [])
      .map((peca, index) => ({ peca, index }))
      .filter(item => !oficial || !U.isBudgetPieceLinkedToRealPart(os, item.peca));
  };

  U.buildBudgetItems = function(os, cliente) {
    const descontos = U.getDescontosCliente(cliente, os);
    const servicos = (os?.servicos || []).map((s, index) => {
      const calc = U.calcularServicoMaoObra(s, cliente, { os, descMO: descontos.descMO, usarHoraQuandoDisponivel: true });
      const valorUnit = calc.valorBruto;
      const qtd = 1;
      const bruto = calc.valorBruto;
      const final = calc.valorFinal;
      return {
        key: 'servico-' + index,
        tipo: 'servico',
        labelTipo: 'Servico',
        index,
        codigoInterno: s.codigoInterno || s.codInterno || s.codigoServicoInterno || '',
        codigoTabela: s.codigoTabela || s.codigoTempa || '',
        codigo: s.codigoInterno || s.codInterno || s.codigoServicoInterno || s.codigoTabela || s.codigo || '',
        sistema: s.secaoHoraLabel || s.sistemaTabela || s.sistema || '',
        desc: s.desc || '',
        mecId: s.mecId || s.mecanicoId || s.responsavelId || '',
        mecNome: s.mecNome || s.mecanicoNome || s.responsavelNome || '',
        responsavelId: s.responsavelId || s.mecId || s.mecanicoId || '',
        responsavelNome: s.responsavelNome || s.mecNome || s.mecanicoNome || '',
        rateiosComissao: Array.isArray(s.rateiosComissao) ? s.rateiosComissao.map(r => ({
          mecId: String(r?.mecId || r?.id || '').trim(),
          mecNome: r?.mecNome || r?.nome || '',
          valorBase: U.roundMoney(Math.max(0, U.parseNumberBR(r?.valorBase ?? r?.valorDividido ?? r?.baseComissao ?? 0)))
        })).filter(r => r.mecId) : [],
        tempo: calc.tempo,
        qtd,
        valorUnit,
        valorHora: calc.valorHora,
        valorOriginal: bruto,
        valorBruto: bruto,
        descontoGeralValor: calc.descontoGeralValor || 0,
        descontoIndividualValor: calc.descontoIndividualValor || 0,
        descontoValor: calc.descontoValor || Math.max(0, bruto - final),
        valorFinal: final,
        descGeralPct: calc.descGeralPct || 0,
        descIndividualPct: calc.descIndividualPct || 0,
        descIndividualValor: calc.descontoIndividualValor || 0,
        descontoIndividualTipo: 'valor',
        descPct: calc.descPct || 0,
        usaCalculoHora: calc.usaCalculoHora
      };
    });
    const pecas = U.getPublicBudgetPieces(os, cliente).map(({ peca: p, index }) => {
      const qtd = U.parseNumberBR(p.qtd || p.q || 1) || 1;
      const valorUnit = U.parseNumberBR(p.venda || p.valor || p.v);
      const bruto = +(qtd * valorUnit).toFixed(2);
      const descontoIndividualValor = U.getItemIndividualDiscountValue(p, bruto);
      const calcDesconto = U.calculateDiscountBreakdown(bruto, descontos.descPeca, descontoIndividualValor);
      const final = calcDesconto.valorFinal;
      return {
        key: 'peca-' + index,
        tipo: 'peca',
        labelTipo: 'Peca',
        index,
        codigo: p.codigo || p.cod || '',
        sistema: p.sistemaTabela || p.sistema || '',
        desc: p.desc || p.descricao || p.descLivre || p.descricaoPeca || p.nomePeca || p.nome || p.item || '',
        tempo: 0,
        qtd,
        valorUnit,
        valorOriginal: bruto,
        valorBruto: bruto,
        descontoGeralValor: calcDesconto.descontoGeralValor,
        descontoIndividualValor: calcDesconto.descontoIndividualValor,
        descIndividualValor: calcDesconto.descontoIndividualValor,
        descontoIndividualTipo: 'valor',
        descontoValor: calcDesconto.descontoValor,
        valorFinal: final,
        descGeralPct: descontos.descPeca,
        descIndividualPct: bruto > 0 ? +(calcDesconto.descontoIndividualValor / bruto).toFixed(6) : 0,
        descPct: calcDesconto.descPct
      };
    });
    return servicos.concat(pecas).filter(it => it.desc || it.codigo || it.valorBruto > 0);
  };

  U.getApprovedKeys = function(os) {
    const keys = new Set();
    const fromApproval = os?.aprovacao?.itens || os?.itensAprovados || [];
    fromApproval.forEach(item => {
      if (typeof item === 'string') keys.add(item);
      else if (item?.key) keys.add(item.key);
    });
    return keys;
  };

  U.hasApproval = function(os) {
    return !!((os?.aprovacao && Array.isArray(os.aprovacao.itens)) || Array.isArray(os?.itensAprovados));
  };

  U.getOSFinanceEntries = function(os, financeiro) {
    if (!os || !Array.isArray(financeiro)) return [];
    const placa = U.normalizeText(os.placa || '');
    const cli = U.normalizeText(os.cliente || '');
    return financeiro.filter(f => {
      if (!f || f.isComissao) return false;
      if (String(f.tipo || '').toLowerCase().startsWith('sa')) return false;
      if (f.vinculo && (String(f.vinculo).startsWith('F_') || String(f.vinculo).startsWith('E_'))) return false;
      if (f.osId && f.osId === os.id) return true;
      const desc = U.normalizeText(f.desc || '');
      return (!f.osId && ((placa && desc.includes(placa)) || (cli && cli.length > 2 && desc.includes(cli.split(' ')[0]))));
    });
  };

  U.getValorOrcamento = function(os, cliente) {
    const protegidoOficial = U.isOfficialClient(os, cliente) && U.hasProtectedRealParts(os);
    if (!protegidoOficial) {
      const total = U.parseNumberBR(os?.total || 0);
      if (total) return +total.toFixed(2);
    }
    const itens = U.buildBudgetItems(os, cliente);
    let totalSeguro = itens.reduce((sum, item) => sum + U.parseNumberBR(item.valorFinal), 0);
    if (protegidoOficial) {
      const guincho = os?.deslocamentoGuincho || os?.guincho || {};
      const ativo = guincho.ativo === true || guincho.cobrar === true || U.parseNumberBR(os?.totalGuincho || guincho.total || 0) > 0;
      if (ativo) totalSeguro += U.parseNumberBR(os?.totalGuincho || guincho.total || 0);
    }
    return +totalSeguro.toFixed(2);
  };

  U.getValorAprovado = function(os, cliente) {
    const protegidoOficial = U.isOfficialClient(os, cliente) && U.hasProtectedRealParts(os);
    if (!protegidoOficial && os?.totalAprovado != null) return +U.parseNumberBR(os.totalAprovado).toFixed(2);
    if (!U.hasApproval(os)) return 0;
    const keys = U.getApprovedKeys(os);
    return +U.buildBudgetItems(os, cliente)
      .filter(item => keys.has(item.key))
      .reduce((sum, item) => sum + U.parseNumberBR(item.valorFinal), 0)
      .toFixed(2);
  };

  U.getValorFaturado = function(os, financeiro) {
    if (U.pagamentoClienteAVista(os) && os?.totalFaturado != null) {
      return +U.parseNumberBR(os.totalFaturado || 0).toFixed(2);
    }
    const totalEntradas = +U.getOSFinanceEntries(os, financeiro)
      .reduce((sum, f) => sum + U.parseNumberBR(f.valor || 0), 0)
      .toFixed(2);
    return totalEntradas || +U.parseNumberBR(os?.totalFaturado || 0).toFixed(2);
  };

  U.pagamentoClienteAVista = function(os) {
    const txt = U.normalizeText([os?.pgtoResumoCliente || '', os?.pgtoForma || ''].join(' '));
    return /\b(pix|dinheiro|debito)\b/.test(txt);
  };

  U.getResumoPagamentoOS = function(os, financeiro) {
    const entradas = U.getOSFinanceEntries(os, financeiro);
    const formas = Array.from(new Set([
      os?.pgtoResumoCliente || '',
      os?.pgtoForma || '',
      ...entradas.map(f => f.pgtoResumo || f.pgto || '')
    ].filter(Boolean)));
    let vencimentos = entradas
      .map(f => f.venc || f.dataPgto || f.pgtoData || '')
      .filter(Boolean)
      .sort();
    if (U.pagamentoClienteAVista(os) && vencimentos.length) {
      vencimentos = [vencimentos[0]];
    }
    return {
      forma: formas[0] || '',
      formas,
      vencimentos,
      entradas
    };
  };

  U.getBudgetSummary = function(os, cliente, financeiro) {
    const orcamento = U.getValorOrcamento(os, cliente);
    const aprovado = U.getValorAprovado(os, cliente);
    const faturado = U.getValorFaturado(os, financeiro);
    const pagamento = U.getResumoPagamentoOS(os, financeiro);
    return { orcamento, aprovado, faturado, pagamento };
  };

  U.splitCiliaTokens = function(textOrTokens) {
    if (Array.isArray(textOrTokens)) return textOrTokens.map(t => String(t || '').trim()).filter(Boolean);
    return String(textOrTokens || '')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);
  };

  function isCodigoMarker(t) {
    return /^c.?d[:.]?$/i.test(U.normalizeText(t).replace(/\s/g, ''));
  }

  function isMoneyToken(t) {
    return /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(String(t || '')) || /^-?\d+,\d{2}$/.test(String(t || ''));
  }

  function extractCiliaPrices(text) {
    const s = String(text || '');
    const money = Array.from(s.matchAll(/R\$\s*([\d.]+,\d{2}|\d+,\d{2}|\d+\.\d{2})/gi)).map(m => m[1]);
    const desconto = s.match(/%\s*([\d.,]+)/);
    return {
      bruto: U.parseNumberBR(money[0] || 0),
      liquido: U.parseNumberBR(money.length > 1 ? money[money.length - 1] : 0),
      desconto: U.parseNumberBR(desconto?.[1] || 0)
    };
  }

  function cleanCiliaCode(value) {
    const code = String(value || '').trim();
    const n = U.normalizeText(code);
    if (!code || /^-+$/.test(code)) return '';
    if (/^(oficina|seguradora|fornecedor|cliente)$/i.test(n)) return '';
    return code;
  }

  function stripCiliaSummaryTail(text) {
    return String(text || '')
      .replace(/\bTotal\s+Pe.{0,3}as:?[\s\S]*$/i, '')
      .replace(/\bTotal\s+Geral:?[\s\S]*$/i, '')
      .trim();
  }

  function isNumericToken(t) {
    return /^\d+(?:[,.]\d+)?$/.test(String(t || ''));
  }

  function isCiliaSummaryOrServiceBoundary(line) {
    const n = U.normalizeText(line);
    const loose = n.replace(/\?/g, 'c');
    return loose.includes('total pecas') ||
      loose.includes('total geral') ||
      loose.includes('subtotal') ||
      loose.includes('mao de obra do orcamento') ||
      loose.includes('total mao de obra') ||
      loose.startsWith('servicos') ||
      loose.includes(' servicos ');
  }

  function ciliaPieceLinesOnly(lines) {
    let inParts = false;
    let sawHeader = false;
    const selected = [];
    (lines || []).forEach(line => {
      const n = U.normalizeText(line);
      const isPartsHeader =
        n.includes('pecas e mao de obra') ||
        (n.includes('operacoes') && n.includes('descricao/codigo')) ||
        (n.includes('qtd') && n.includes('descricao/codigo') && n.includes('preco'));
      if (isPartsHeader) {
        inParts = true;
        sawHeader = true;
        return;
      }
      if (inParts && isCiliaSummaryOrServiceBoundary(line)) {
        inParts = false;
        return;
      }
      if (inParts) selected.push(line);
    });
    return sawHeader ? selected : (lines || []).filter(line => !isCiliaSummaryOrServiceBoundary(line));
  }

  function peelCiliaDescriptionAndQty(text) {
    let tokens = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    let i = 0;
    const numericBeforeDesc = [];
    while (i < tokens.length) {
      if (/^(T|R|P|R&I|RI)$/i.test(tokens[i])) { i++; continue; }
      if (isNumericToken(tokens[i])) {
        numericBeforeDesc.push({ idx: i, value: tokens[i] });
        i++;
        continue;
      }
      break;
    }

    let descTokens = tokens.slice(i);
    const trailingNumbers = [];
    while (descTokens.length && isNumericToken(descTokens[descTokens.length - 1])) trailingNumbers.unshift(descTokens.pop());

    let qtd = 1;
    if (numericBeforeDesc.length) qtd = U.parseNumberBR(numericBeforeDesc[numericBeforeDesc.length - 1].value) || 1;
    if (trailingNumbers.length) qtd = U.parseNumberBR(trailingNumbers[trailingNumbers.length - 1]) || qtd || 1;

    const desc = descTokens
      .join(' ')
      .replace(/\b(Oficina|Seguradora|Fornecedor|Cliente)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { desc, qtd };
  }

  function isCiliaPartHeaderText(text) {
    const n = U.normalizeText(text);
    return n.includes('pecas e mao de obra') ||
      (n.includes('operacoes') && n.includes('qtd')) ||
      (n.includes('descricao/codigo') && n.includes('preco'));
  }

  function isCiliaPartsTotalText(text) {
    const n = U.normalizeText(text).replace(/\?/g, 'c');
    return n.includes('total pecas') || n.startsWith('servicos');
  }

  function isCiliaMoneyText(text) {
    return /^R\$\s*[\d.]+,\d{2}$/i.test(String(text || '').trim()) ||
      /^R\$\s*\d+\.\d{2}$/i.test(String(text || '').trim());
  }

  function comparePdfSpans(a, b) {
    return (a.page - b.page) || (b.y - a.y) || (a.x - b.x);
  }

  function isAfterPdfStart(sp, start) {
    if (!start) return true;
    return sp.page > start.page || (sp.page === start.page && sp.y < start.y);
  }

  function isBeforePdfEnd(sp, end) {
    if (!end) return true;
    return sp.page < end.page || (sp.page === end.page && sp.y > end.y);
  }

  U.getDeclaredCiliaItemCount = function(source) {
    const text = Array.isArray(source)
      ? source.map(x => typeof x === 'string' ? x : (x?.text || x?.str || '')).join(' ')
      : String(source || '');
    const normal = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    const m = normal.match(/Pecas\s+e\s+Mao\s+de\s+Obra\s*\(\s*(\d+)\s+itens?\s*\)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  };

  U.isSaneCiliaPieces = function(pieces) {
    const list = pieces || [];
    if (!list.length) return false;
    const badDesc = list.filter(p => {
      const n = U.normalizeText(p.desc);
      return !n ||
        n === 'r$' ||
        n.startsWith('r$ ') ||
        n.includes('total pecas') ||
        n.includes('servicos') ||
        n.includes('descricao da peca') ||
        n.includes('descricao/codigo') ||
        n.includes('fornecimento') ||
        n.includes('desconto');
    }).length;
    const badQty = list.filter(p => {
      const qtd = U.parseNumberBR(p.qtd || 0);
      return !qtd || qtd > 99;
    }).length;

    // Quando o PDF Cília fornece preço bruto, quantidade, desconto e preço líquido,
    // os quatro campos precisam ser matematicamente coerentes. Isso impede que um
    // parser alternativo com 27 linhas, mas quantidades deslocadas, seja aceito.
    const financeiros = list.filter(p =>
      U.parseNumberBR(p.qtd || 0) > 0 &&
      U.parseNumberBR(p.venda || p.valor || 0) > 0 &&
      U.parseNumberBR(p.ciliaValorLiquido || 0) > 0 &&
      U.parseNumberBR(p.ciliaDesconto || 0) > 0
    );
    const badFinanceiro = financeiros.filter(p => {
      const qtd = U.parseNumberBR(p.qtd || 0);
      const bruto = U.parseNumberBR(p.venda || p.valor || 0);
      const desc = U.parseNumberBR(p.ciliaDesconto || 0);
      const liquido = U.parseNumberBR(p.ciliaValorLiquido || 0);
      const esperado = +(qtd * bruto * (1 - desc / 100)).toFixed(2);
      return Math.abs(esperado - liquido) > 0.06;
    }).length;

    return badDesc / list.length <= 0.12 &&
      badQty / list.length <= 0.12 &&
      (!financeiros.length || badFinanceiro / financeiros.length <= 0.08);
  };

  U.parseCiliaPiecesFromSpans = function(spans) {
    const all = (spans || [])
      .map((sp, idx) => ({
        text: String(sp.text || sp.str || '').replace(/\s+/g, ' ').trim(),
        x: Number(sp.x ?? sp.transform?.[4] ?? 0),
        y: Number(sp.y ?? sp.transform?.[5] ?? 0),
        page: Number(sp.page || sp.pageNumber || 1),
        idx
      }))
      .filter(sp => sp.text)
      .sort(comparePdfSpans);

    if (!all.length) return [];
    const start = all.find(sp => isCiliaPartHeaderText(sp.text));
    const end = all.find(sp => isAfterPdfStart(sp, start) && isCiliaPartsTotalText(sp.text));
    const inParts = all.filter(sp => isAfterPdfStart(sp, start) && isBeforePdfEnd(sp, end));

    // Usa a posição real dos cabeçalhos da tabela, em vez de depender de X fixo.
    // Continua com os X históricos como fallback para PDFs Cília antigos.
    const qtdHeader = inParts.find(sp => U.normalizeText(sp.text) === 'qtd');
    const descHeader = inParts.find(sp => U.normalizeText(sp.text).includes('descricao/codigo'));
    const fornecHeader = inParts.find(sp => U.normalizeText(sp.text).includes('fornecimento'));
    const qtdX = Number.isFinite(qtdHeader?.x) ? qtdHeader.x : 100;
    const descX = Number.isFinite(descHeader?.x) ? descHeader.x : 120;
    const fornecX = Number.isFinite(fornecHeader?.x) ? fornecHeader.x : 352;

    const anchors = inParts.filter(sp =>
      sp.x >= qtdX - 18 && sp.x <= qtdX + 25 &&
      /^\d+(?:[,.]\d+)?$/.test(sp.text) &&
      // tempo/TMO fica em outra coluna; quantidade aceita 1, 1.00 ou 1,00.
      U.parseNumberBR(sp.text) > 0 && U.parseNumberBR(sp.text) <= 99
    ).sort(comparePdfSpans);

    const pieces = [];
    anchors.forEach((anchor, index) => {
      const prev = anchors[index - 1];
      const upperFromPrev = prev && prev.page === anchor.page ? prev.y - 7 : Infinity;
      const upper = Math.min(anchor.y + 12, upperFromPrev);
      const lower = anchor.y - 11;

      const rowSpans = inParts
        .filter(sp => sp.page === anchor.page && Math.abs(sp.y - anchor.y) <= 2.8)
        .sort((a, b) => a.x - b.x);

      const descSpans = inParts
        .filter(sp => sp.page === anchor.page && sp.x >= descX - 10 && sp.x < fornecX - 4 && sp.y <= upper && sp.y >= lower)
        .sort(comparePdfSpans);

      const descParts = [];
      let codigo = '';
      let marcadorCodigoVazio = false;
      descSpans.forEach(sp => {
        if (/^C.?d[:.]?/i.test(sp.text)) {
          const m = sp.text.match(/^C.?d[:.]?\s*(.*)$/i);
          const extraido = cleanCiliaCode(m?.[1] || '');
          if (extraido) codigo = extraido;
          else marcadorCodigoVazio = true;
          return;
        }
        if (isCiliaPartHeaderText(sp.text) || isCiliaPartsTotalText(sp.text)) return;
        if (isCiliaMoneyText(sp.text)) return;
        descParts.push(sp.text);
      });

      const money = rowSpans.filter(sp => isCiliaMoneyText(sp.text));
      const brutoSpan = money.find(sp => sp.x >= 400 && sp.x < 490) || money[0];
      const liquidoSpan = money.find(sp => sp.x >= 520) || money[money.length - 1];
      const descontoSpan = rowSpans.find(sp => /%\s*[\d.,]+/.test(sp.text));
      let desc = descParts.join(' ').replace(/\s+/g, ' ').trim();

      // Alguns PDFs do Cília colocam o OEM antes da descrição e deixam apenas
      // "Cód:" na linha inferior (ex.: "403002241R ARO DE RODA DE AÇO").
      if (!codigo && marcadorCodigoVazio && desc) {
        const lead = desc.match(/^([A-Z0-9][A-Z0-9./-]{7,24})\s+(.+)$/i);
        if (lead && /\d/.test(lead[1])) {
          codigo = cleanCiliaCode(lead[1]);
          desc = lead[2].trim();
        }
      }

      if (!desc && !codigo) return;
      pieces.push({
        codigo: codigo || 'sem oem',
        desc,
        qtd: U.parseNumberBR(anchor.text) || 1,
        venda: U.parseNumberBR(brutoSpan?.text || 0),
        ciliaValorLiquido: liquidoSpan && liquidoSpan !== brutoSpan ? U.parseNumberBR(liquidoSpan.text) : 0,
        ciliaDesconto: U.parseNumberBR(String(descontoSpan?.text || '').replace('%', ''))
      });
    });

    return U.normalizeCiliaPieces(pieces);
  };

  U.normalizeCiliaPiece = function(piece) {
    const p = { ...(piece || {}) };
    let desc = String(p.desc || p.descricao || '').replace(/\s+/g, ' ').trim();
    let codigo = cleanCiliaCode(p.codigo || p.cod || '');
    const prices = extractCiliaPrices(desc);
    const codInDesc = desc.match(/C.?d[:.]\s*([A-Z0-9./-]+)/i);
    if (!codigo && codInDesc) codigo = cleanCiliaCode(codInDesc[1]);

    desc = desc
      .replace(/C.?d[:.]\s*[A-Z0-9./-]+/gi, ' ')
      .replace(/R\$\s*[\d.]+,\d{2}/gi, ' ')
      .replace(/R\$\s*\d+\.\d{2}/gi, ' ')
      .replace(/%\s*[\d.,]+/g, ' ')
      .replace(/\b(Oficina|Seguradora|Fornecedor|Cliente)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const peeled = peelCiliaDescriptionAndQty(desc);
    const normalized = {
      ...p,
      codigo: codigo || 'sem oem',
      desc: peeled.desc,
      qtd: U.parseNumberBR(p.qtd || p.quantidade || 0) || peeled.qtd || 1,
      venda: U.parseNumberBR(p.venda || p.valor || p.precoBruto || 0) || prices.bruto || U.parseNumberBR(p.ciliaValorLiquido || 0) || prices.liquido || 0,
      ciliaValorLiquido: U.parseNumberBR(p.ciliaValorLiquido || p.valorLiquido || 0) || prices.liquido || 0,
      ciliaDesconto: U.parseNumberBR(p.ciliaDesconto || p.desconto || 0) || prices.desconto || 0
    };
    return normalized;
  };

  U.normalizeCiliaPieces = function(pieces) {
    return (pieces || [])
      .map(U.normalizeCiliaPiece)
      .filter(p => {
        const n = U.normalizeText(p.desc);
        if (!p.desc && p.codigo === 'sem oem') return false;
        if (isCiliaSummaryOrServiceBoundary(p.desc)) return false;
        if (n === 'total' || n === 'preco' || n === 'desconto') return false;
        return p.codigo || p.desc || U.parseNumberBR(p.venda) > 0;
      });
  };

  U.parseCiliaPiecesFromLines = function(lines) {
    const sectionLines = ciliaPieceLinesOnly(lines);
    const blockPieces = [];
    sectionLines
      .join('\n')
      .split(/\n(?=\s*(?:T\s+)?(?:R&I|RI|R|P)\b)/i)
      .forEach(block => {
        const original = stripCiliaSummaryTail(String(block || '').replace(/\s+/g, ' ').trim());
        if (!original || isCiliaSummaryOrServiceBoundary(original)) return;
        if (!/^(?:T\s+)?(?:R&I|RI|R|P)\b/i.test(original)) return;

        const codeMatch = original.match(/C.?d[:.]\s*([A-Z0-9./-]*)/i);
        const codigo = cleanCiliaCode(codeMatch?.[1]) || 'sem oem';
        const beforeCode = original.split(/C.?d[:.]/i)[0];
        const prices = extractCiliaPrices(original);
        const semPreco = /C.?d[:.]?.*-\s+-\s+-\s+-\s*$/i.test(original);
        if (!prices.bruto && !prices.liquido && !semPreco) return;

        const peeled = peelCiliaDescriptionAndQty(beforeCode);
        if (!peeled.desc && codigo === 'sem oem') return;
        blockPieces.push({
          codigo,
          desc: peeled.desc,
          qtd: peeled.qtd || 1,
          venda: prices.bruto || 0,
          ciliaValorLiquido: prices.liquido || 0,
          ciliaDesconto: prices.desconto || 0
        });
      });
    if (blockPieces.length) return U.normalizeCiliaPieces(blockPieces);

    const out = [];
    sectionLines.forEach(line => {
      const original = stripCiliaSummaryTail(String(line || '').replace(/\s+/g, ' ').trim());
      if (!original || !/R\$/i.test(original)) return;
      if (isCiliaSummaryOrServiceBoundary(original)) return;
      const prices = extractCiliaPrices(original);
      if (!prices.bruto && !prices.liquido) return;

      const beforePrice = original.split(/R\$/i)[0].replace(/\s+/g, ' ').trim();
      let codigo = '';
      let descPart = beforePrice;

      const codMarker = beforePrice.match(/^(.*)\s+C.?d[:.]\s*([A-Z0-9./-]+)(?:\s+\w+)?\s*$/i);
      if (codMarker) {
        descPart = codMarker[1].trim();
        codigo = cleanCiliaCode(codMarker[2]);
      } else {
        const first = beforePrice.match(/^([A-Z0-9][A-Z0-9./-]{3,})\s+(.+)$/);
        if (first && /\d/.test(first[1]) && !/^\d+[,.]\d+$/.test(first[1]) && !/^(TOTAL|PRECO|VALOR)$/i.test(first[1])) {
          codigo = cleanCiliaCode(first[1]);
          descPart = first[2].trim();
        }
      }

      if (!codigo && !descPart) return;
      const peeled = peelCiliaDescriptionAndQty(descPart);
      if (!peeled.desc && !codigo) return;
      out.push({
        codigo,
        desc: peeled.desc,
        qtd: peeled.qtd || 1,
        venda: prices.bruto || prices.liquido || 0,
        ciliaValorLiquido: prices.liquido || 0,
        ciliaDesconto: prices.desconto || 0
      });
    });
    return U.normalizeCiliaPieces(out);
  };

  U.parseCiliaPiecesFromTokens = function(textOrTokens) {
    const tokens = U.splitCiliaTokens(textOrTokens);
    const pieces = [];
    if (!tokens.length) return pieces;

    const startIdx = tokens.findIndex((t, i) =>
      U.normalizeText(t).startsWith('operac') &&
      U.normalizeText(tokens.slice(i, i + 12).join(' ')).includes('descricao/codigo')
    );
    const totalIdx = tokens.findIndex((t, i) =>
      U.normalizeText(t) === 'total' && U.normalizeText(tokens[i + 1] || '').startsWith('pec')
    );
    const windowTokens = tokens.slice(startIdx >= 0 ? startIdx : 0, totalIdx > 0 ? totalIdx : tokens.length);
    const codeIdxs = [];
    windowTokens.forEach((t, i) => {
      if (isCodigoMarker(t) && windowTokens[i + 1]) codeIdxs.push(i);
    });

    if (codeIdxs.length) {
      const firstCodeIdx = codeIdxs[0];
      const numericBefore = [];
      for (let i = 0; i < firstCodeIdx; i++) {
        if (/^\d+(?:\.\d+)?$/.test(windowTokens[i])) numericBefore.push({ idx: i, value: windowTokens[i] });
      }
      const qtyTokens = numericBefore.slice(-codeIdxs.length);
      const firstDescIdx = qtyTokens.length ? qtyTokens[qtyTokens.length - 1].idx + 1 : Math.max(0, firstCodeIdx - 1);
      const moneyPairs = [];
      for (let i = codeIdxs[codeIdxs.length - 1] + 2; i < windowTokens.length - 1; i++) {
        if (/^R\$/i.test(windowTokens[i]) && isMoneyToken(windowTokens[i + 1])) {
          moneyPairs.push(windowTokens[i + 1]);
          i++;
        }
      }

      for (let i = 0; i < codeIdxs.length; i++) {
        const markerIdx = codeIdxs[i];
        const nextMarkerIdx = codeIdxs[i + 1] || windowTokens.length;
        const descStart = i === 0 ? firstDescIdx : codeIdxs[i - 1] + 2;
        const descTokens = windowTokens.slice(descStart, markerIdx);
        const cleanDesc = descTokens
          .filter(t => !/^(T|R|P|R&I|Oficina)$/i.test(t))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const qtd = U.parseNumberBR(qtyTokens[i]?.value || 1) || 1;
        const bruto = U.parseNumberBR(moneyPairs[i * 2] || 0);
        const liquido = U.parseNumberBR(moneyPairs[i * 2 + 1] || 0);
        if (cleanDesc || windowTokens[markerIdx + 1]) {
          pieces.push({
            codigo: windowTokens[markerIdx + 1] || '',
            desc: cleanDesc,
            qtd,
            venda: bruto || liquido,
            ciliaValorLiquido: liquido
          });
        }
        if (nextMarkerIdx <= markerIdx) break;
      }
    }

    if (pieces.length) return U.normalizeCiliaPieces(pieces);

    const text = tokens.join(' ');
    const lineRegex = /(?:[TRP](?:\s+R&I)?)?\s*[\d,.]+\s+([\d,.]+)\s+(.+?)\s+C.?d[:.]\s*([A-Z0-9./-]+)\s+\w+\s+R\$\s*([\d.,]+)\s+%\s*[\d.,]+\s+R\$\s*([\d.,]+)/gi;
    let m;
    while ((m = lineRegex.exec(text))) {
      pieces.push({
        codigo: m[3].trim(),
        desc: m[2].replace(/\s+/g, ' ').trim(),
        qtd: U.parseNumberBR(m[1]) || 1,
        venda: U.parseNumberBR(m[4]),
        ciliaValorLiquido: U.parseNumberBR(m[5])
      });
    }
    return U.normalizeCiliaPieces(pieces);
  };

  U.openApprovalModal = function(os, options) {
    options = options || {};
    const cliente = U.getCliente(os, options.clientes, options.cliente);
    const items = U.buildBudgetItems(os, cliente);
    return new Promise(resolve => {
      if (!items.length) {
        if (typeof options.toast === 'function') options.toast('Nenhum item de orcamento para aprovar.', 'warn');
        resolve(null);
        return;
      }

      let overlay = document.getElementById('modalAprovacaoItensOS');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalAprovacaoItensOS';
        overlay.className = 'overlay';
        document.body.appendChild(overlay);
      }
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);overflow:auto;';

      const allChecked = options.defaultAll !== false;
      const renderRow = item => `
        <label style="display:grid;grid-template-columns:26px 90px 1fr 110px;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.14);border-radius:4px;margin-bottom:6px;cursor:pointer;">
          <input type="checkbox" class="aprov-item" value="${U.escapeHtml(item.key)}" ${allChecked ? 'checked' : ''} style="width:18px;height:18px;">
          <span style="font-family:var(--fm,var(--mono,monospace));font-size:.68rem;color:${item.tipo === 'peca' ? 'var(--success,#00ff88)' : 'var(--cyan,#00d4ff)'};font-weight:700;">${item.labelTipo}</span>
          <span style="font-size:.82rem;color:var(--text,#e8f4ff);line-height:1.35;">
            ${item.codigo ? `<code style="font-size:.72rem;color:var(--warn,#ffb800);">${U.escapeHtml(item.codigo)}</code> ` : ''}
            ${U.escapeHtml(item.desc || '-')}
            <small style="display:block;color:var(--muted,#7a9ab8);font-family:var(--fm,var(--mono,monospace));font-size:.68rem;margin-top:2px;">
              ${item.tipo === 'servico' ? `Secao: ${U.escapeHtml(item.sistema || 'Manual')} | Horas/TMO: ${String(item.tempo || 0).replace('.', ',')}h | Valor/h: ${U.moeda(item.valorHora || 0)}` : `Qtd: ${item.qtd} x ${U.moeda(item.valorUnit)}`}
            </small>
          </span>
          <span style="text-align:right;font-family:var(--fm,var(--mono,monospace));font-weight:700;color:var(--success,#00ff88);">${U.moeda(item.valorFinal)}</span>
        </label>`;

      overlay.innerHTML = `
        <div class="modal" style="max-width:820px;width:96%;max-height:92vh;display:flex;flex-direction:column;background:var(--surf,var(--bg1,#0c1426));border:1px solid var(--border2,var(--border,#24435e));border-radius:6px;color:var(--text,#e8f4ff);box-shadow:0 20px 80px rgba(0,0,0,.45);">
          <div class="modal-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border2,var(--border,#24435e));">
            <div class="modal-title">APROVACAO DO ORCAMENTO - SELECIONE OS ITENS</div>
            <button class="modal-close" type="button" data-aprov-cancel style="width:32px;height:32px;background:transparent;border:1px solid var(--border2,var(--border,#24435e));color:var(--text,#e8f4ff);border-radius:4px;cursor:pointer;">×</button>
          </div>
          <div class="modal-body" style="overflow:auto;padding:18px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              <button type="button" class="btn-ghost" data-aprov-all>MARCAR TUDO</button>
              <button type="button" class="btn-ghost" data-aprov-none>DESMARCAR TUDO</button>
            </div>
            <div style="font-size:.78rem;color:var(--muted,#7a9ab8);line-height:1.45;margin-bottom:12px;">
              O orcamento completo sera mantido na O.S. como historico. O financeiro e o fluxo aprovado usarao somente os itens marcados aqui.
            </div>
            ${items.map(renderRow).join('')}
          </div>
          <div class="modal-foot" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 18px;border-top:1px solid var(--border2,var(--border,#24435e));flex-wrap:wrap;">
            <div style="font-family:var(--fm,var(--mono,monospace));font-size:.78rem;color:var(--muted,#7a9ab8);" data-aprov-total></div>
            <div style="display:flex;gap:8px;">
              <button class="btn-ghost" type="button" data-aprov-cancel>CANCELAR</button>
              <button class="btn-primary" type="button" data-aprov-confirm>APROVAR SELECIONADOS</button>
            </div>
          </div>
        </div>`;

      function selectedItems() {
        const selected = new Set(Array.from(overlay.querySelectorAll('.aprov-item:checked')).map(i => i.value));
        return items.filter(it => selected.has(it.key));
      }

      function updateTotal() {
        const sel = selectedItems();
        const total = sel.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0);
        const el = overlay.querySelector('[data-aprov-total]');
        if (el) el.textContent = `${sel.length}/${items.length} item(ns) - Total aprovado: ${U.moeda(total)}`;
      }

      overlay.querySelector('[data-aprov-all]')?.addEventListener('click', () => {
        overlay.querySelectorAll('.aprov-item').forEach(i => { i.checked = true; });
        updateTotal();
      });
      overlay.querySelector('[data-aprov-none]')?.addEventListener('click', () => {
        overlay.querySelectorAll('.aprov-item').forEach(i => { i.checked = false; });
        updateTotal();
      });
      overlay.querySelectorAll('.aprov-item').forEach(i => i.addEventListener('change', updateTotal));
      overlay.querySelectorAll('[data-aprov-cancel]').forEach(btn => btn.addEventListener('click', () => {
        overlay.classList.remove('open');
        overlay.style.display = 'none';
        resolve(null);
      }));
      overlay.querySelector('[data-aprov-confirm]')?.addEventListener('click', () => {
        const sel = selectedItems();
        if (!sel.length) {
          if (typeof options.toast === 'function') options.toast('Selecione ao menos um item aprovado.', 'warn');
          return;
        }
        const total = +sel.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0).toFixed(2);
        overlay.classList.remove('open');
        overlay.style.display = 'none';
        resolve({
          status: sel.length === items.length ? 'total' : 'parcial',
          totalOrcamento: +items.reduce((acc, it) => acc + U.parseNumberBR(it.valorFinal), 0).toFixed(2),
          totalAprovado: total,
          itens: sel,
          keys: sel.map(it => it.key),
          totalItens: items.length
        });
      });
      updateTotal();
      overlay.classList.add('open');
      overlay.style.display = 'flex';
    });
  };

  U.aprovarOrcamentoComSelecao = async function(options) {
    const db = options?.db || window.db;
    const osId = options?.osId;
    if (!db || !osId) return null;
    const snap = await db.collection('ordens_servico').doc(osId).get();
    if (!snap.exists) throw new Error('O.S. nao encontrada.');
    const os = { id: osId, ...snap.data() };
    const approval = await U.openApprovalModal(os, {
      clientes: options.clientes,
      cliente: options.cliente,
      toast: options.toast || window.toast
    });
    if (!approval) return null;
    const actor = options.actorName || 'Usuario';
    const actorType = options.actorType || 'portal';
    const novoStatus = options.novoStatus || 'Aprovado';
    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    if (options.motivoStatus) {
      timeline.push({
        dt: new Date().toISOString(),
        user: actor,
        acao: `Status: ${os.status || '-'} -> ${novoStatus}. Motivo: ${options.motivoStatus}`,
        tipo: 'status_os',
        statusAnterior: os.status || '',
        statusNovo: novoStatus,
        motivo: options.motivoStatus,
        origem: options.origemStatus || 'aprovacao',
        interno: true,
        visivelCliente: true
      });
    }
    timeline.push({
      dt: new Date().toISOString(),
      user: actor,
      acao: `${actor} APROVOU o orcamento (${approval.status}) - ${approval.itens.length}/${approval.totalItens} item(ns) - Total aprovado ${U.moeda(approval.totalAprovado)}`
    });
    const payload = {
      status: novoStatus,
      aprovacao: {
        status: approval.status,
        aprovadoEm: new Date().toISOString(),
        aprovadoPor: actor,
        aprovadoPorTipo: actorType,
        totalOrcamento: approval.totalOrcamento,
        totalAprovado: approval.totalAprovado,
        itens: approval.itens
      },
      itensAprovados: approval.keys,
      totalAprovado: approval.totalAprovado,
      timeline,
      updatedAt: new Date().toISOString()
    };
    await db.collection('ordens_servico').doc(osId).update(payload);
    return payload;
  };

  U.autoDescribeFields = function(root) {
    root = root || document;
    root.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el.type === 'hidden') return;
      const explicit = el.getAttribute('aria-label') || el.getAttribute('title');
      if (explicit) return;
      let text = '';
      const id = el.id;
      if (id) {
        const label = root.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) text = label.textContent.trim();
      }
      if (!text) text = el.closest('.form-group')?.querySelector('label')?.textContent?.trim() || '';
      if (!text) text = el.getAttribute('placeholder') || el.textContent?.trim() || el.name || el.id || '';
      if (text) {
        el.setAttribute('title', text);
        el.setAttribute('aria-label', text);
      }
    });
  };

  window.JarvisOSUtils = U;
  window.JOS = U;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => U.autoDescribeFields(document));
  } else {
    U.autoDescribeFields(document);
  }
})();

/* ═══════════════════════════════════════════════════════════════════════
 * OFICIN-IA V26.23.0 — ETAPAS INTERNAS DA O.S.
 * Recurso isolado do Jarvis. Não participa de orçamento, portal, PDF,
 * planilhas, comissão, financeiro, status ou timeline pública.
 * ═══════════════════════════════════════════════════════════════════════ */
(function etapasInternasOSJarvis(){
  'use strict';

  const MARCA = '__thiaEtapasInternasOSV26230';
  if (window[MARCA]) return;
  window[MARCA] = true;

  function ehJarvis(){
    const path = String(window.location?.pathname || '').toLowerCase();
    return path.includes('jarvis.html') && !!document.getElementById('modalOS') && !!document.getElementById('osTimeline');
  }

  function esc(v){
    if (window.JarvisOSUtils?.escapeHtml) return window.JarvisOSUtils.escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function agoraISO(){ return new Date().toISOString(); }
  function usuarioAtual(){ return String(window.J?.nome || sessionStorage.getItem('j_nome') || 'Usuário'); }
  function idOSAtual(){ return String(document.getElementById('osId')?.value || '').trim(); }
  function osLocal(id){ return (window.J?.os || []).find(o => String(o?.id || '') === String(id || '')) || null; }

  function fmtData(v){
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function normalizarEtapas(lista){
    if (!Array.isArray(lista)) return [];
    return lista.map((item, idx) => {
      if (typeof item === 'string') {
        return { id:`legado-${idx}`, texto:item, realizado:false, interno:true };
      }
      return {
        id: String(item?.id || `legado-${idx}`),
        texto: String(item?.texto || item?.descricao || item?.recado || '').trim(),
        realizado: item?.realizado === true || item?.feito === true || item?.concluido === true,
        criadoEm: item?.criadoEm || item?.createdAt || '',
        criadoPor: item?.criadoPor || item?.createdBy || '',
        realizadoEm: item?.realizadoEm || item?.feitoEm || item?.concluidoEm || '',
        realizadoPor: item?.realizadoPor || item?.feitoPor || item?.concluidoPor || '',
        interno: true
      };
    }).filter(item => item.texto);
  }

  function contextoRelatorioEtapas(){
    const id = idOSAtual();
    const os = osLocal(id) || {};
    const veiculos = Array.isArray(window.J?.veiculos) ? window.J.veiculos : [];
    const clientes = Array.isArray(window.J?.clientes) ? window.J.clientes : [];
    const veic = veiculos.find(v => String(v?.id || '') === String(os?.veiculoId || '')) || os?.veiculoSnapshot || {};
    const cli = clientes.find(c => String(c?.id || '') === String(os?.clienteId || '')) || os?.clienteSnapshot || {};
    const etapas = normalizarEtapas(os?.etapasInternas);
    const placa = String(veic?.placa || os?.placa || os?.veiculoPlaca || '-').trim() || '-';
    const modelo = String(veic?.modelo || os?.veiculoModelo || os?.veiculo || '-').trim() || '-';
    const cliente = String(cli?.nome || cli?.razaoSocial || cli?.fantasia || os?.clienteNome || os?.cliente || '-').trim() || '-';
    const numero = String(os?.numero || id || '-').trim() || '-';
    return {
      id,
      os,
      placa,
      modelo,
      cliente,
      numero,
      etapas,
      separados: etapas.filter(e => e.realizado),
      pendentes: etapas.filter(e => !e.realizado),
      geradoEm: new Date()
    };
  }

  function nomeArquivoRelatorioEtapas(ctx, ext){
    const placa = String(ctx?.placa || 'SEM-PLACA').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'SEM-PLACA';
    return `OS_${placa}_ITENS_SEPARADOS.${ext}`;
  }

  function validarRelatorioEtapas(ctx){
    if (!ctx?.id) {
      window.toast?.('Abra uma O.S. salva antes de gerar o relatório de separação.', 'warn');
      return false;
    }
    if (!ctx?.etapas?.length) {
      window.toast?.('Esta O.S. ainda não possui etapas/itens internos para gerar o relatório.', 'warn');
      return false;
    }
    return true;
  }

  function metaEtapaRelatorio(item){
    if (item?.realizado) {
      const partes = [item?.realizadoPor, fmtData(item?.realizadoEm)].filter(Boolean);
      return partes.length ? `Separado / realizado por ${partes.join(' • ')}` : 'Separado / realizado';
    }
    const partes = [item?.criadoPor, fmtData(item?.criadoEm)].filter(Boolean);
    return partes.length ? `Pendente • registrado por ${partes.join(' • ')}` : 'Pendente';
  }

  function htmlRelatorioEtapas(ctx){
    const dataGeracao = ctx.geradoEm.toLocaleString('pt-BR');
    const linhas = (lista, classe, simbolo) => lista.length
      ? lista.map((item, idx) => `<div class="item ${classe}"><div class="mark">${simbolo}</div><div><div class="txt">${idx + 1}. ${esc(item.texto)}</div><div class="meta">${esc(metaEtapaRelatorio(item))}</div></div></div>`).join('')
      : '<div class="vazio">Nenhum item nesta situação.</div>';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Itens separados - ${esc(ctx.placa)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif}.wrap{max-width:900px;margin:0 auto}.head{border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:12px}.brand{font-weight:800;font-size:17px;letter-spacing:.6px}.sub{font-size:11px;color:#475569;margin-top:3px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 16px;margin:12px 0;font-size:11px}.grid b{display:block;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px}.resumo{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px}.badge{border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:700}.sec{margin-top:14px}.sec h2{font-size:12px;margin:0 0 7px;padding:7px 9px;border:1px solid #cbd5e1;background:#f8fafc;letter-spacing:.5px}.item{display:grid;grid-template-columns:22px minmax(0,1fr);gap:7px;border:1px solid #e2e8f0;border-radius:5px;padding:8px 9px;margin-bottom:6px;break-inside:avoid}.item.done{border-color:#86efac;background:#f0fdf4}.item.pending{border-color:#fde68a;background:#fffbeb}.mark{font-size:15px;font-weight:900}.txt{font-size:11px;font-weight:700;line-height:1.35}.meta{font-size:9px;color:#64748b;margin-top:3px}.vazio{font-size:10px;color:#64748b;border:1px dashed #cbd5e1;padding:9px}.foot{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#64748b;text-align:center}@media(max-width:600px){.grid{grid-template-columns:1fr}}@media print{.no-print{display:none!important}}
    </style></head><body><div class="wrap"><div class="head"><div class="brand">RELATÓRIO DE SEPARAÇÃO — O.S.</div><div class="sub">Itens registrados em “Etapas / Recados Internos da O.S.”</div></div>
      <div class="grid"><div><b>O.S.</b>${esc(ctx.numero)}</div><div><b>Placa</b>${esc(ctx.placa)}</div><div><b>Veículo</b>${esc(ctx.modelo)}</div><div><b>Cliente</b>${esc(ctx.cliente)}</div><div><b>Gerado em</b>${esc(dataGeracao)}</div><div><b>Gerado por</b>${esc(usuarioAtual())}</div></div>
      <div class="resumo"><span class="badge">✓ ${ctx.separados.length} JÁ SEPARADO(S)</span><span class="badge">○ ${ctx.pendentes.length} PENDENTE(S)</span><span class="badge">TOTAL ${ctx.etapas.length}</span></div>
      <section class="sec"><h2>✓ PEÇAS / ITENS JÁ SEPARADOS</h2>${linhas(ctx.separados,'done','✓')}</section>
      <section class="sec"><h2>○ PENDENTES DE SEPARAÇÃO / EXECUÇÃO</h2>${linhas(ctx.pendentes,'pending','○')}</section>
      <div class="foot">Documento interno da O.S. • Powered by thIAguinho Soluções Digitais</div></div></body></html>`;
  }

  function abrirJanelaRelatorioEtapas(ctx, imprimir){
    const win = window.open('', '_blank');
    if (!win) {
      window.toast?.('O navegador bloqueou a nova janela. Libere pop-ups para imprimir.', 'warn');
      return null;
    }
    win.document.open();
    win.document.write(htmlRelatorioEtapas(ctx));
    win.document.close();
    if (imprimir) {
      const disparar = () => { try { win.focus(); win.print(); } catch (_) {} };
      if (win.document.readyState === 'complete') setTimeout(disparar, 180);
      else win.addEventListener('load', () => setTimeout(disparar, 180), { once:true });
    }
    return win;
  }

  function quebrarTextoCanvas(ctx2d, texto, larguraMax){
    const palavras = String(texto || '').split(/\s+/).filter(Boolean);
    const linhas = [];
    let linha = '';
    palavras.forEach(p => {
      const teste = linha ? `${linha} ${p}` : p;
      if (ctx2d.measureText(teste).width <= larguraMax || !linha) linha = teste;
      else { linhas.push(linha); linha = p; }
    });
    if (linha) linhas.push(linha);
    return linhas.length ? linhas : [''];
  }

  function baixarBlobEtapas(blob, nome){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.thiaImprimirEtapasInternasOS = function(){
    const ctx = contextoRelatorioEtapas();
    if (!validarRelatorioEtapas(ctx)) return;
    abrirJanelaRelatorioEtapas(ctx, true);
  };

  window.thiaGerarPdfEtapasInternasOS = async function(){
    const ctx = contextoRelatorioEtapas();
    if (!validarRelatorioEtapas(ctx)) return;
    try {
      if (!window.jspdf?.jsPDF && typeof window.thiaLoadPdfLibsV23 === 'function') await window.thiaLoadPdfLibsV23();
      if (!window.jspdf?.jsPDF) {
        abrirJanelaRelatorioEtapas(ctx, true);
        window.toast?.('PDF direto indisponível; abriu a impressão. Escolha “Salvar como PDF”.', 'warn');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p','mm','a4');
      const margem = 12;
      const largura = 210 - margem * 2;
      let y = 13;
      const novaPagina = (altura = 10) => { if (y + altura > 283) { doc.addPage(); y = 13; } };
      const texto = (txt, x, yy, opt={}) => {
        doc.setFont('helvetica', opt.bold ? 'bold' : 'normal');
        doc.setFontSize(opt.size || 9);
        doc.setTextColor(...(opt.cor || [31,41,55]));
        doc.text(String(txt ?? ''), x, yy, opt.options || {});
      };
      texto('RELATÓRIO DE SEPARAÇÃO — O.S.', margem, y, {bold:true,size:14}); y += 5;
      texto('Itens registrados em “Etapas / Recados Internos da O.S.”', margem, y, {size:8,cor:[100,116,139]}); y += 6;
      doc.setDrawColor(203,213,225); doc.line(margem,y,210-margem,y); y += 5;
      const meta = [
        `O.S.: ${ctx.numero}`,
        `Placa: ${ctx.placa}`,
        `Veículo: ${ctx.modelo}`,
        `Cliente: ${ctx.cliente}`,
        `Gerado em: ${ctx.geradoEm.toLocaleString('pt-BR')}`,
        `Gerado por: ${usuarioAtual()}`
      ];
      meta.forEach(m => { novaPagina(5); texto(m,margem,y,{size:9}); y += 4.5; });
      y += 2;
      texto(`JÁ SEPARADOS: ${ctx.separados.length}    PENDENTES: ${ctx.pendentes.length}    TOTAL: ${ctx.etapas.length}`, margem, y, {bold:true,size:9}); y += 7;
      const secao = (titulo, lista, simbolo) => {
        novaPagina(12);
        doc.setFillColor(248,250,252); doc.setDrawColor(203,213,225); doc.rect(margem,y-4,largura,7,'FD');
        texto(titulo,margem+2,y,{bold:true,size:9}); y += 7;
        if (!lista.length) { texto('Nenhum item nesta situação.',margem+2,y,{size:8,cor:[100,116,139]}); y += 6; return; }
        lista.forEach((item, idx) => {
          doc.setFont('helvetica','bold'); doc.setFontSize(9);
          const linhas = doc.splitTextToSize(`${simbolo} ${idx+1}. ${item.texto}`, largura-8);
          doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
          const metaLinhas = doc.splitTextToSize(metaEtapaRelatorio(item), largura-8);
          const altura = linhas.length*4 + metaLinhas.length*3.4 + 5;
          novaPagina(altura);
          doc.setDrawColor(item.realizado ? 134 : 253, item.realizado ? 239 : 230, item.realizado ? 172 : 138);
          doc.rect(margem,y-3,largura,altura-1);
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(31,41,55); doc.text(linhas,margem+3,y+1);
          const yMeta = y + 1 + linhas.length*4;
          doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.text(metaLinhas,margem+3,yMeta+1);
          y += altura + 2;
        });
      };
      secao('PEÇAS / ITENS JÁ SEPARADOS', ctx.separados, '[X]');
      secao('PENDENTES DE SEPARAÇÃO / EXECUÇÃO', ctx.pendentes, '[ ]');
      novaPagina(10); y += 2;
      texto('Documento interno da O.S. • Powered by thIAguinho Soluções Digitais',105,y,{size:7,cor:[100,116,139],options:{align:'center'}});
      doc.save(nomeArquivoRelatorioEtapas(ctx,'pdf'));
      window.toast?.('PDF dos itens separados gerado.', 'ok');
    } catch (e) {
      console.error('[Etapas internas OS] PDF:', e);
      window.toast?.('Não foi possível gerar o PDF. Use o botão IMPRIMIR para salvar como PDF.', 'warn');
    }
  };

  window.thiaGerarImagemEtapasInternasOS = function(){
    const ctx = contextoRelatorioEtapas();
    if (!validarRelatorioEtapas(ctx)) return;
    try {
      const W = 1400, pad = 72, contentW = W - pad*2;
      const canvasMedida = document.createElement('canvas');
      canvasMedida.width = W; canvasMedida.height = 100;
      const m = canvasMedida.getContext('2d');
      m.font = '700 28px Arial';
      const medirItem = item => {
        m.font = '700 28px Arial';
        const ls = quebrarTextoCanvas(m,item.texto,contentW-90);
        m.font = '22px Arial';
        const lm = quebrarTextoCanvas(m,metaEtapaRelatorio(item),contentW-90);
        return 30 + ls.length*36 + lm.length*29;
      };
      const alturaLista = lista => lista.length ? lista.reduce((s,i)=>s+medirItem(i)+14,0) : 70;
      const H = Math.max(900, 430 + alturaLista(ctx.separados) + alturaLista(ctx.pendentes) + 170);
      const canvas = document.createElement('canvas'); canvas.width=W; canvas.height=H;
      const c = canvas.getContext('2d');
      c.fillStyle='#ffffff'; c.fillRect(0,0,W,H);
      let y=70;
      c.fillStyle='#111827'; c.font='800 42px Arial'; c.fillText('RELATÓRIO DE SEPARAÇÃO — O.S.',pad,y); y+=44;
      c.fillStyle='#64748b'; c.font='24px Arial'; c.fillText('Itens registrados em “Etapas / Recados Internos da O.S.”',pad,y); y+=35;
      c.strokeStyle='#cbd5e1'; c.lineWidth=2; c.beginPath(); c.moveTo(pad,y); c.lineTo(W-pad,y); c.stroke(); y+=38;
      c.fillStyle='#111827'; c.font='700 24px Arial';
      const metas=[`O.S.: ${ctx.numero}`,`PLACA: ${ctx.placa}`,`VEÍCULO: ${ctx.modelo}`,`CLIENTE: ${ctx.cliente}`,`GERADO: ${ctx.geradoEm.toLocaleString('pt-BR')} • ${usuarioAtual()}`];
      metas.forEach(t=>{ quebrarTextoCanvas(c,t,contentW).forEach(l=>{c.fillText(l,pad,y);y+=32;}); }); y+=12;
      c.font='800 24px Arial'; c.fillText(`✓ ${ctx.separados.length} JÁ SEPARADO(S)    ○ ${ctx.pendentes.length} PENDENTE(S)    TOTAL ${ctx.etapas.length}`,pad,y); y+=48;
      const desenharSecao=(titulo,lista,realizado)=>{
        c.fillStyle='#f8fafc'; c.strokeStyle='#cbd5e1'; c.lineWidth=2; c.fillRect(pad,y-28,contentW,48); c.strokeRect(pad,y-28,contentW,48);
        c.fillStyle='#111827'; c.font='800 25px Arial'; c.fillText(titulo,pad+16,y+4); y+=48;
        if(!lista.length){ c.fillStyle='#64748b'; c.font='22px Arial'; c.fillText('Nenhum item nesta situação.',pad+16,y); y+=60; return; }
        lista.forEach((item,idx)=>{
          c.font='700 28px Arial'; const linhas=quebrarTextoCanvas(c,item.texto,contentW-90);
          c.font='22px Arial'; const metasItem=quebrarTextoCanvas(c,metaEtapaRelatorio(item),contentW-90);
          const h=30+linhas.length*36+metasItem.length*29;
          c.fillStyle=realizado?'#f0fdf4':'#fffbeb'; c.strokeStyle=realizado?'#86efac':'#fde68a'; c.fillRect(pad,y,contentW,h); c.strokeRect(pad,y,contentW,h);
          c.fillStyle=realizado?'#15803d':'#a16207'; c.font='800 28px Arial'; c.fillText(realizado?'✓':'○',pad+18,y+38);
          c.fillStyle='#111827'; c.font='700 28px Arial'; let yy=y+36; linhas.forEach((l,i)=>{c.fillText(`${i===0?`${idx+1}. `:''}${l}`,pad+58,yy);yy+=36;});
          c.fillStyle='#64748b'; c.font='22px Arial'; metasItem.forEach(l=>{c.fillText(l,pad+58,yy);yy+=29;}); y+=h+14;
        });
        y+=20;
      };
      desenharSecao('PEÇAS / ITENS JÁ SEPARADOS',ctx.separados,true);
      desenharSecao('PENDENTES DE SEPARAÇÃO / EXECUÇÃO',ctx.pendentes,false);
      c.fillStyle='#64748b'; c.font='20px Arial'; c.textAlign='center'; c.fillText('Documento interno da O.S. • Powered by thIAguinho Soluções Digitais',W/2,Math.min(H-45,y+28)); c.textAlign='left';
      canvas.toBlob(blob=>{
        if(!blob){ window.toast?.('Não foi possível gerar a imagem.', 'warn'); return; }
        baixarBlobEtapas(blob,nomeArquivoRelatorioEtapas(ctx,'png'));
        window.toast?.('Imagem dos itens separados gerada.', 'ok');
      },'image/png',1);
    } catch (e) {
      console.error('[Etapas internas OS] imagem:', e);
      window.toast?.('Não foi possível gerar a imagem.', 'warn');
    }
  };

  function garantirEstilo(){
    if (document.getElementById('thiaEtapasInternasOSStyle')) return;
    const st = document.createElement('style');
    st.id = 'thiaEtapasInternasOSStyle';
    st.textContent = `
      #thiaEtapasInternasOS{margin:0 0 14px 0;padding:14px;background:rgba(0,212,255,.045);border:1px solid rgba(0,212,255,.24);border-radius:4px}
      #thiaEtapasInternasOS .et-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
      #thiaEtapasInternasOS .et-title-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
      #thiaEtapasInternasOS .et-export{padding:5px 8px;font-size:.56rem;letter-spacing:.7px;white-space:nowrap}
      #thiaEtapasInternasOS .et-title strong{font-family:var(--fm);font-size:.70rem;color:var(--cyan);letter-spacing:1.5px}
      #thiaEtapasInternasOS .et-help{font-family:var(--fm);font-size:.60rem;color:var(--muted);line-height:1.45;margin-top:3px}
      #thiaEtapasInternasOS .et-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-bottom:10px}
      #thiaEtapasInternasOS .et-list{display:flex;flex-direction:column;gap:7px}
      #thiaEtapasInternasOS .et-item{width:100%;text-align:left;display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:start;padding:10px;border-radius:4px;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.025);color:var(--text);cursor:pointer;transition:.15s ease}
      #thiaEtapasInternasOS .et-item:hover{border-color:rgba(0,212,255,.45);background:rgba(0,212,255,.05)}
      #thiaEtapasInternasOS .et-check{width:22px;height:22px;border:1px solid rgba(148,163,184,.45);border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:900;color:transparent;margin-top:1px}
      #thiaEtapasInternasOS .et-text{font-family:var(--fm);font-size:.72rem;font-weight:700;line-height:1.35;word-break:break-word}
      #thiaEtapasInternasOS .et-meta{font-family:var(--fm);font-size:.56rem;color:var(--muted);margin-top:4px;line-height:1.35}
      #thiaEtapasInternasOS .et-item.done{border-color:rgba(0,255,136,.28);background:rgba(0,255,136,.045)}
      #thiaEtapasInternasOS .et-item.done .et-check{border-color:rgba(0,255,136,.55);background:rgba(0,255,136,.12);color:var(--success)}
      #thiaEtapasInternasOS .et-item.done .et-text{text-decoration:line-through;color:var(--muted)}
      #thiaEtapasInternasOS .et-empty{padding:10px;border:1px dashed rgba(148,163,184,.22);border-radius:4px;font-family:var(--fm);font-size:.64rem;color:var(--muted)}
      @media(max-width:640px){#thiaEtapasInternasOS .et-add{grid-template-columns:1fr}#thiaEtapasInternasOS .et-add button{width:100%}}
    `;
    document.head.appendChild(st);
  }

  function garantirPainel(){
    if (!ehJarvis()) return null;
    garantirEstilo();
    let box = document.getElementById('thiaEtapasInternasOS');
    if (box) return box;
    const timeline = document.getElementById('osTimeline');
    if (!timeline?.parentElement) return null;
    box = document.createElement('section');
    box.id = 'thiaEtapasInternasOS';
    box.innerHTML = `
      <div class="et-title">
        <div>
          <strong>📌 ETAPAS / RECADOS INTERNOS DA O.S.</strong>
          <div class="et-help">Uso interno. Clique em uma etapa para marcar como REALIZADA; clique novamente para reabrir.</div>
        </div>
        <div class="et-title-actions">
          <span class="pill pill-cyan" id="thiaEtapasInternasContador">0 PENDENTE(S)</span>
          <button type="button" class="btn-ghost et-export" id="thiaEtapasInternasImprimir">IMPRIMIR</button>
          <button type="button" class="btn-ghost et-export" id="thiaEtapasInternasPdf">PDF</button>
          <button type="button" class="btn-ghost et-export" id="thiaEtapasInternasImagem">IMAGEM</button>
        </div>
      </div>
      <div class="et-add">
        <input id="thiaEtapasInternasTexto" class="j-input" maxlength="220" placeholder="Ex.: Veículo foi para o lava-jato / Falta trocar borracha da porta / Foi para alinhamento">
        <button type="button" class="btn-primary" id="thiaEtapasInternasAdicionar">+ ADICIONAR ETAPA</button>
      </div>
      <div class="et-list" id="thiaEtapasInternasLista"></div>`;
    timeline.parentElement.insertBefore(box, timeline);
    box.querySelector('#thiaEtapasInternasAdicionar')?.addEventListener('click', () => window.thiaAdicionarEtapaInternaOS?.());
    box.querySelector('#thiaEtapasInternasImprimir')?.addEventListener('click', () => window.thiaImprimirEtapasInternasOS?.());
    box.querySelector('#thiaEtapasInternasPdf')?.addEventListener('click', () => window.thiaGerarPdfEtapasInternasOS?.());
    box.querySelector('#thiaEtapasInternasImagem')?.addEventListener('click', () => window.thiaGerarImagemEtapasInternasOS?.());
    box.querySelector('#thiaEtapasInternasTexto')?.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); window.thiaAdicionarEtapaInternaOS?.(); }
    });
    return box;
  }

  function render(listaOpt){
    const box = garantirPainel();
    if (!box) return;
    const id = idOSAtual();
    const listaEl = box.querySelector('#thiaEtapasInternasLista');
    const input = box.querySelector('#thiaEtapasInternasTexto');
    const btn = box.querySelector('#thiaEtapasInternasAdicionar');
    const contador = box.querySelector('#thiaEtapasInternasContador');
    if (!listaEl) return;

    if (!id) {
      if (input) input.disabled = true;
      if (btn) btn.disabled = true;
      if (contador) contador.textContent = 'SALVE A O.S.';
      listaEl.innerHTML = '<div class="et-empty">Salve a O.S. primeiro. Depois você poderá registrar as etapas internas deste veículo.</div>';
      return;
    }

    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
    const o = osLocal(id) || {};
    const etapas = normalizarEtapas(listaOpt !== undefined ? listaOpt : o.etapasInternas);
    const pendentes = etapas.filter(e => !e.realizado).length;
    if (contador) contador.textContent = `${pendentes} PENDENTE(S)`;

    if (!etapas.length) {
      listaEl.innerHTML = '<div class="et-empty">Nenhuma etapa interna registrada nesta O.S.</div>';
      return;
    }

    listaEl.innerHTML = etapas.map(item => {
      const metaCriacao = [item.criadoPor, fmtData(item.criadoEm)].filter(Boolean).join(' • ');
      const metaFeito = item.realizado ? [item.realizadoPor, fmtData(item.realizadoEm)].filter(Boolean).join(' • ') : '';
      const meta = item.realizado
        ? `REALIZADO${metaFeito ? ' • ' + metaFeito : ''}`
        : (metaCriacao ? `Registrado por ${metaCriacao}` : 'PENDENTE');
      return `<button type="button" class="et-item ${item.realizado ? 'done' : ''}" data-etapa-id="${esc(item.id)}" title="Clique para ${item.realizado ? 'reabrir' : 'marcar como realizado'}">
        <span class="et-check">✓</span>
        <span><span class="et-text">${esc(item.texto)}</span><span class="et-meta">${esc(meta)}</span></span>
      </button>`;
    }).join('');

    listaEl.querySelectorAll('.et-item').forEach(el => {
      el.addEventListener('click', () => window.thiaAlternarEtapaInternaOS?.(el.dataset.etapaId));
    });
  }

  async function atualizarTransacao(mutador){
    const id = idOSAtual();
    if (!id) { window.toast?.('Salve a O.S. antes de registrar etapas internas.', 'warn'); return null; }
    if (!window.db?.runTransaction) { window.toast?.('Banco de dados indisponível para atualizar as etapas.', 'warn'); return null; }
    const ref = window.db.collection('ordens_servico').doc(id);
    const novo = await window.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('O.S. não encontrada');
      const atual = normalizarEtapas(snap.data()?.etapasInternas);
      const prox = mutador(atual.slice());
      if (!Array.isArray(prox)) throw new Error('Etapas internas inválidas');
      tx.update(ref, {
        etapasInternas: prox,
        etapasInternasAtualizadoEm: agoraISO(),
        etapasInternasAtualizadoPor: usuarioAtual()
      });
      return prox;
    });
    const local = osLocal(id);
    if (local) {
      local.etapasInternas = novo;
      local.etapasInternasAtualizadoEm = agoraISO();
      local.etapasInternasAtualizadoPor = usuarioAtual();
    }
    render(novo);
    return novo;
  }

  window.thiaAdicionarEtapaInternaOS = async function(){
    const input = document.getElementById('thiaEtapasInternasTexto');
    const texto = String(input?.value || '').trim();
    if (!texto) { window.toast?.('Digite a etapa ou recado interno.', 'warn'); input?.focus(); return; }
    const btn = document.getElementById('thiaEtapasInternasAdicionar');
    if (btn) btn.disabled = true;
    try {
      const agora = agoraISO();
      await atualizarTransacao(lista => {
        lista.push({
          id: `et-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
          texto,
          realizado:false,
          criadoEm:agora,
          criadoPor:usuarioAtual(),
          realizadoEm:'',
          realizadoPor:'',
          interno:true,
          visivelCliente:false
        });
        return lista;
      });
      if (input) input.value = '';
      window.toast?.('Etapa interna adicionada.', 'ok');
    } catch (e) {
      console.error('[Etapas internas OS] adicionar:', e);
      window.toast?.('Não foi possível adicionar a etapa interna.', 'warn');
    } finally {
      if (btn) btn.disabled = false;
      input?.focus();
    }
  };

  window.thiaAlternarEtapaInternaOS = async function(etapaId){
    const idAlvo = String(etapaId || '');
    if (!idAlvo) return;
    try {
      let ficouRealizada = false;
      await atualizarTransacao(lista => lista.map(item => {
        if (String(item.id) !== idAlvo) return item;
        ficouRealizada = !item.realizado;
        return Object.assign({}, item, {
          realizado: ficouRealizada,
          realizadoEm: ficouRealizada ? agoraISO() : '',
          realizadoPor: ficouRealizada ? usuarioAtual() : '',
          interno:true,
          visivelCliente:false
        });
      }));
      window.toast?.(ficouRealizada ? 'Etapa marcada como realizada.' : 'Etapa reaberta.', 'ok');
    } catch (e) {
      console.error('[Etapas internas OS] alternar:', e);
      window.toast?.('Não foi possível atualizar a etapa interna.', 'warn');
    }
  };

  window.renderEtapasInternasOS = render;

  function envolverPrepOS(){
    const fn = window.prepOS;
    if (typeof fn !== 'function') return false;
    if (fn.__thiaEtapasInternasOSV26230) return true;
    const wrapped = function(){
      const r = fn.apply(this, arguments);
      setTimeout(() => render(), 0);
      return r;
    };
    wrapped.__thiaEtapasInternasOSV26230 = true;
    window.prepOS = wrapped;
    return true;
  }

  function iniciar(){
    if (!ehJarvis()) return;
    garantirPainel();
    render();
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      if (envolverPrepOS() || tentativas >= 80) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else setTimeout(iniciar, 0);
})();
