(function() {
  'use strict';

  const TEMPLATE_URL_PADRAO = 'assets/templates/I-30003_PLANILHA_DE_CUSTOS.xlsx';
  const SERV_START = 19;
  const SERV_END = 74;
  const SERV_TOTAL = 75;
  const PECA_START = 77;
  const PECA_END = 122;
  const PECA_TOTAL = 123;
  const SERV_CAPACITY = SERV_END - SERV_START + 1;
  const PECA_CAPACITY = PECA_END - PECA_START + 1;

  const U = () => window.JarvisOSUtils || window.JOS || {};
  const n = value => U().parseNumberBR ? U().parseNumberBR(value) : (parseFloat(String(value || 0).replace(',', '.')) || 0);
  function templatePMSPUrl(){
    const tpl = (typeof window.thiaGetTemplates === 'function' ? window.thiaGetTemplates() : (window.J?.oficina?.templates || {})) || {};
    return String(tpl.planilhaPMSP || TEMPLATE_URL_PADRAO).trim() || TEMPLATE_URL_PADRAO;
  }

  function textoCelulaExportar(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
      if (value.richText) return value.richText.map(x => x.text || '').join('');
      if (value.text) return String(value.text);
      if (value.result != null) return String(value.result);
      if (value.formula) return String(value.result ?? value.formula ?? '');
    }
    return String(value);
  }

  function ultimaLinhaUsadaExportar(ws) {
    let last = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      let hasValue = false;
      row.eachCell({ includeEmpty: false }, cell => {
        const txt = textoCelulaExportar(cell.value).trim();
        if (txt) hasValue = true;
      });
      if (hasValue) last = Math.max(last, rowNumber);
    });
    return last;
  }

  function limparCorpoTemplateAgrupado(ws, startRow, linhasAgrupadas) {
    const lastUsed = Math.max(PECA_TOTAL, ultimaLinhaUsadaExportar(ws));
    const removeCount = Math.max(1, lastUsed - startRow + 1);
    ws.spliceRows(startRow, removeCount, ...Array.from({ length: Math.max(1, linhasAgrupadas) }, () => []));
  }

  function limparBlocoAssinaturaAgrupada(ws, labelRow, representanteRow) {
    // A linha labelRow tambem carrega "VALOR DO CONTRATO" em B:H, entao preserva B:H nela.
    for (let r = labelRow + 1; r <= representanteRow + 3; r++) {
      safeUnmergeOverlaps(ws, `B${r}:H${r}`);
      ['B','C','D','E','F','G','H'].forEach(col => setCell(ws, col + r, ''));
    }
  }

  function limparLinhasAbaixoExportar(ws, keepUntil) {
    const lastUsed = Math.max(ultimaLinhaUsadaExportar(ws), ws.rowCount || 0, PECA_TOTAL);
    mergeRanges(ws).forEach(item => {
      if (item.decoded.top > keepUntil || item.decoded.bottom > keepUntil) {
        try { ws.unMergeCells(item.range); } catch(e) {}
      }
    });
    for (let r = keepUntil + 1; r <= lastUsed; r++) {
      const row = ws.getRow(r);
      row.values = [];
      row.hidden = true;
      ['A','B','C','D','E','F','G','H'].forEach(col => {
        const cell = ws.getCell(col + r);
        cell.value = '';
        cell.note = undefined;
      });
    }
    if (lastUsed > keepUntil) {
      try { ws.spliceRows(keepUntil + 1, lastUsed - keepUntil); } catch(e) {}
    }
  }

  function guinchoOSExportar(os) {
    const g = os?.deslocamentoGuincho || os?.guincho || {};
    const kmTotal = n(g.kmTotal || 0);
    const franquiaKm = n(g.franquiaKm || 15) || 15;
    const valorSaida = n(g.valorSaida || (g.tipo === 'pesado' ? 463.86 : 253.22));
    const valorKmAdicional = n(g.valorKmAdicional || (g.tipo === 'pesado' ? 16.66 : 8.51));
    const kmExcedente = n(g.kmExcedente || Math.max(kmTotal - franquiaKm, 0));
    const subtotal = n(g.subtotal || (valorSaida + (kmExcedente * valorKmAdicional)));
    const descontoPct = Math.max(0, Math.min(100, n(g.descontoPct ?? g.descPct ?? g.ajustePct ?? 0)));
    const descontoValor = n(g.descontoValor || +(subtotal * descontoPct / 100).toFixed(2));
    const total = n(g.total || Math.max(0, subtotal - descontoValor));
    const ativo = !!g.ativo && total > 0;
    return {
      ativo,
      tipo: g.tipo || 'leve',
      tipoLabel: g.tipoLabel || (g.tipo === 'pesado' ? 'Pesado acima de 1.500 kg / van / coletivo / carga / semirreboque acima de 750 kg' : 'Leve até 1.500 kg / moto / semirreboque até 750 kg'),
      kmTotal,
      franquiaKm,
      kmExcedente,
      valorSaida,
      valorKmAdicional,
      descontoPct,
      descPct: descontoPct,
      ajustePct: descontoPct,
      subtotal,
      descontoValor,
      total,
      obs: limparTexto(g.obs || '')
    };
  }

  async function salvarArquivoBlobExportar(blob, fname) {
    const nomeSeguro = String(fname || 'planilha.xlsx')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120);

    const capacitor = window.Capacitor;
    const plugins = capacitor?.Plugins || {};
    const Filesystem = plugins.Filesystem;
    const Share = plugins.Share;
    const isNative = !!(
      capacitor?.isNativePlatform?.() ||
      capacitor?.getPlatform?.() === 'android' ||
      capacitor?.getPlatform?.() === 'ios'
    );

    if (isNative && Filesystem) {
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Android WebView/Capacitor costuma bloquear gravação direta em Documents/Downloads.
        // Salva em CACHE e abre o compartilhador nativo, preservando o XLSX gerado sem mexer no conteúdo.
        const directory = Filesystem.Directory?.Cache || 'CACHE';
        const saved = await Filesystem.writeFile({
          path: nomeSeguro,
          data: base64,
          directory,
          recursive: true
        });

        if (Share && saved?.uri) {
          await Share.share({
            title: nomeSeguro,
            text: nomeSeguro,
            url: saved.uri,
            dialogTitle: 'Salvar ou compartilhar planilha'
          });
          return saved;
        }

        return saved;
      } catch (e) {
        console.warn('[PMSP XLSX] Salvamento nativo falhou; usando fallback web:', e?.message || e);
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeSeguro;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  }


  function moedaNumber(value) {
    return +n(value).toFixed(2);
  }

  function taxaDesconto(value) {
    const pct = n(value);
    if (!pct) return 0;
    return pct > 1 ? +(pct / 100).toFixed(6) : pct;
  }

  function normalizarSecao(txt) {
    return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function classificarSecao(serv) {
    const base = limparTexto(serv.sistema || serv.secaoHoraLabel || serv.sistemaTabela || '');
    const sistema = normalizarSecao(base);
    const desc = normalizarSecao(serv.desc || '');
    const t = normalizarSecao([serv.sistema, serv.secaoHoraLabel, serv.sistemaTabela, serv.desc].filter(Boolean).join(' '));

    const isFunilaria = /\b(funilaria|lanternagem|pintura|pintar|lataria|parachoque|para choque|porta|capo|capuz|teto|assoalho|coluna|paralama|para lama)\b/;
    const isTapecaria = /\b(tapecaria|capotaria|banco|assento|encosto|forro|estof)\b/;
    const isBorracharia = /\b(borracharia|pneu|pneus|roda|rodas|calota|balanceamento)\b/;
    const isLavagem = /\b(lavagem|higienizacao|higienizar|limpeza interna|polimento)\b/;
    const isFreio = /\b(freio|freios|pastilha|pastilhas|disco|discos|tambor|tambores|pin[cç]a|cilindro mestre|servo freio|fluido de freio|pist[aã]o do freio)\b/;
    const isSuspensao = /\b(suspensao|suspens[aã]o|amortecedor|amortecedores|mola|molas|batente|coxim|bandeja|bra[cç]o oscilante|barra estabilizadora|bieleta|piv[oô]|terminal|bucha|buchas|haste da barra|barra de tor[cç][aã]o)\b/;
    const isDirecao = /\b(direcao|dire[cç][aã]o|caixa de dire[cç][aã]o|barra axial|terminal de dire[cç][aã]o|coluna de dire[cç][aã]o)\b/;
    const isMotor = /\b(motor|correia dentada|correia|tensor|tampa de v[aá]lvulas|junta da tampa|coletor|retifica|cabe[cç]ote|arrefecimento|radiador|mangueira|intercooler|compressor|condensador|ar condicionado|filtro de [oó]leo|filtro do ar|filtro de ar|vela|velas|cabo de vela|cabos de vela)\b/;
    const isCambio = /\b(cambio|c[aâ]mbio|embreagem|atuador de embreagem|kit de embreagem|transmissao|transmiss[aã]o|homocinetica|homocin[eé]tica|semieixo|semi eixo|semi-eixo|coifa do semi|coifa externa|coifa interna)\b/;
    const isInjecao = /\b(injecao|inje[cç][aã]o|injetor|injetores|bico|bicos|combustivel|combust[ií]vel|alimentacao|alimenta[cç][aã]o|bomba de combustivel|bomba de combust[ií]vel|tanque|boia|b[oó]ia)\b/;
    const isMecanica = /\b(mecanica|mec[aâ]nica|rolamento|rolamentos)\b/;
    const isEletrica = /\b(eletrica|eletrico|eletronica|alternador|bateria|lampada|lanterna|farol|sensor|chicote|fusivel|rele|motor de partida|vidro eletrico|trava eletrica)\b/;

    // Primeiro usa a DESCRIÇÃO do serviço. Ela é mais específica que a seção PMSP,
    // que pode vir genérica como "MECANICA ELETRICA GERAL". Isso evita jogar
    // amortecedor/mola/suspensão em ELETRICA só porque o rótulo oficial contém a palavra "ELETRICA".
    if (isFunilaria.test(desc)) return 'FUNILARIA / PINTURA';
    if (isTapecaria.test(desc)) return 'TAPECARIA / CAPOTARIA';
    if (isBorracharia.test(desc)) return 'BORRACHARIA';
    if (isLavagem.test(desc)) return 'LAVAGEM / HIGIENIZACAO';
    if (isFreio.test(desc)) return 'FREIO';
    if (isSuspensao.test(desc)) return 'SUSPENSAO';
    if (isDirecao.test(desc)) return 'DIRECAO';
    if (isCambio.test(desc)) return 'CAMBIO / TRANSMISSAO';
    if (isMotor.test(desc)) return 'MOTOR / ARREFECIMENTO';
    if (isInjecao.test(desc)) return 'INJECAO / ALIMENTACAO';
    if (isEletrica.test(desc)) return 'ELETRICA';
    if (isMecanica.test(desc)) return 'MECANICA';

    if (isFunilaria.test(t)) return 'FUNILARIA / PINTURA';
    if (isTapecaria.test(t)) return 'TAPECARIA / CAPOTARIA';
    if (isBorracharia.test(t)) return 'BORRACHARIA';
    if (isLavagem.test(t)) return 'LAVAGEM / HIGIENIZACAO';
    if (isFreio.test(t)) return 'FREIO';
    if (isSuspensao.test(t)) return 'SUSPENSAO';
    if (isDirecao.test(t)) return 'DIRECAO';
    if (isCambio.test(t)) return 'CAMBIO / TRANSMISSAO';
    if (isMotor.test(t)) return 'MOTOR / ARREFECIMENTO';
    if (isInjecao.test(t)) return 'INJECAO / ALIMENTACAO';

    if (/mecanica\s+eletrica\s+geral/.test(sistema) || (isMecanica.test(t) && isEletrica.test(t))) return 'MECANICA';
    if (isEletrica.test(t)) return 'ELETRICA';
    if (isMecanica.test(t)) return 'MECANICA';
    return base ? base.toUpperCase().slice(0, 48) : 'OUTROS SERVICOS';
  }

  function extrairTipoVeiculoTempa(input, veiculoAtual) {
    input = input || {};
    veiculoAtual = veiculoAtual || {};
    const direto = limparTexto(pick(
      input.tipoVeiculoTabela,
      input.tipoVeiculoTempa,
      input.tipoVeiculoTemp,
      input.porteVeiculoTabela,
      input.porteTabela
    ));
    if (direto) return direto.toUpperCase();

    const base = normalizarSecao([
      input.tipoVeiculo,
      input.tipo,
      input.sistemaTabela,
      input.sistema,
      input.secaoHoraLabel,
      input.desc,
      input.descricao
    ].filter(Boolean).join(' '));

    if (/caminhao|caminhoes|onibus|pesado/.test(base)) return 'ÔNIBUS / CAMINHÕES';
    if (/suv/.test(base)) return 'SUV';
    if (/compacto/.test(base)) return 'VEÍCULO COMPACTO';
    if (/pequenos? e medios?|medio|leve|ciclo otto|otto/.test(base)) return 'VEÍCULOS PEQUENOS E MÉDIOS / CICLO OTTO';
    if (/diesel/.test(base)) return 'VEÍCULOS MÉDIOS A DIESEL';
    if (/utilitario|utilitaria|van/.test(base)) return 'UTILITÁRIO / VAN';
    if (/motocicleta|moto/.test(base)) return 'MOTO';

    return limparTexto(pick(veiculoAtual.tipo, veiculoAtual.categoria, veiculoAtual.porte)).toUpperCase();
  }

  function codigoInternoServicoTempa(servico, resolvido) {
    return limparTexto(pick(
      servico?.codigoInterno,
      servico?.codInterno,
      servico?.codigoServicoInterno,
      resolvido?.codigoInterno,
      resolvido?.codInterno
    ));
  }

  function codigoTabelaServicoTempa(servico, resolvido) {
    return limparTexto(pick(
      servico?.codigoTabela,
      servico?.codigoTempa,
      servico?.codigoSiafisico,
      resolvido?.codigoTabela,
      resolvido?.codigo
    ));
  }

  function codigoServicoTempa(servico, resolvido) {
    return limparTexto(pick(
      codigoInternoServicoTempa(servico, resolvido),
      codigoTabelaServicoTempa(servico, resolvido),
      servico?.codigoServico,
      servico?.codigo,
      servico?.cod,
      resolvido?.codigoServico
    ));
  }

  function listaResumo(values, limite) {
    const arr = Array.from(values || []).map(v => limparTexto(v)).filter(Boolean);
    const unicos = Array.from(new Set(arr));
    return unicos.slice(0, limite).join(', ') + (unicos.length > limite ? ` +${unicos.length - limite}` : '');
  }

  function textoSistemaServico(s) {
    const partes = [];
    if (s.codigo) partes.push(`COD. SERVIÇO: ${s.codigo}`);
    if (s.sistema) partes.push(`SISTEMA: ${s.sistema}`);
    if (s.tipoVeiculo) partes.push(`TIPO VEÍCULO: ${s.tipoVeiculo}`);
    return partes.join('\n') || s.sistema || '';
  }

  function textoSistemaServico(s) {
    const partes = [];
    if (s.codigoInterno) partes.push(`COD. INTERNO: ${s.codigoInterno}`);
    if (s.codigoTabela) partes.push(`COD. SIAFISICO: ${s.codigoTabela}`);
    if (!s.codigoInterno && !s.codigoTabela && s.codigo) partes.push(`COD. SERVICO: ${s.codigo}`);
    if (s.sistema) partes.push(`SISTEMA: ${s.sistema}`);
    if (s.tipoVeiculo) partes.push(`TIPO VEICULO: ${s.tipoVeiculo}`);
    return partes.join('\n') || s.sistema || '';
  }

  function textoResumoSecao(secao, item) {
    // KPI/resumo da planilha deve agrupar somente o tipo/seção do serviço.
    // Código do serviço, sistema e tipo de veículo ficam na linha individual do serviço,
    // igual ao código da peça fica na linha individual da peça.
    return limparTexto(secao);
  }

  function resumirSecoes(linhasServ) {
    const out = {};
    (linhasServ || []).forEach(s => {
      const secao = classificarSecao(s);
      if (!out[secao]) out[secao] = { horas: 0, total: 0, qtd: 0, codigos: new Set(), sistemas: new Set(), tiposVeiculo: new Set() };
      out[secao].horas += n(s.tempo || 0);
      out[secao].total += n(s.total || 0);
      out[secao].qtd += 1;
      if (s.codigo) out[secao].codigos.add(s.codigo);
      if (s.sistema) out[secao].sistemas.add(s.sistema);
      if (s.tipoVeiculo) out[secao].tiposVeiculo.add(s.tipoVeiculo);
    });
    return Object.entries(out).sort((a, b) => b[1].total - a[1].total);
  }

  function dataExtenso(cidade) {
    const hoje = new Date();
    const meses = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    return `${(cidade || 'SAO PAULO').toUpperCase()}, ${hoje.getDate()} DE ${meses[hoje.getMonth()]} DE ${hoje.getFullYear()}.`;
  }

  function oesNumero(cli, os) {
    const modelo = pick(os.modeloOS, os.oesModelo, os.govOesModelo, os.oes, cli.govOesModelo, cli.oesModelo, 'ORC ###/2026');
    return modelo.replace(/###/g, String(os.id || '').slice(-3).toUpperCase());
  }

  function limparTexto(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function pick(...values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const txt = limparTexto(value);
      if (txt !== '') return value;
    }
    return '';
  }

  function parseJsonSeguro(value) {
    try { return value ? JSON.parse(value) : {}; } catch(e) { return {}; }
  }

  function mergeCadastro(...objs) {
    const out = {};
    objs.filter(Boolean).forEach(obj => {
      Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && v.trim() === '') return;
        out[k] = v;
      });
    });
    return out;
  }

  function upperTexto(...values) {
    return limparTexto(pick(...values)).toUpperCase();
  }

  function enderecoPessoa(pessoa) {
    if (!pessoa) return '';
    return pick(
      pessoa.enderecoCompleto,
      [
        pick(pessoa.endereco, pessoa.rua, pessoa.logradouro),
        pick(pessoa.numero, pessoa.num, pessoa.n),
        pessoa.bairro,
        pick(pessoa.cidade, pessoa.municipio),
        pessoa.uf,
        pessoa.cep
      ].filter(v => limparTexto(v)).join(', ')
    );
  }

  function dadosCliente(cli, os) {
    cli = cli || {};
    os = os || {};
    return {
      unidade: pick(cli.govUnidade, cli.unidade, cli.razaoSocial, cli.nome, os.cliente),
      doc: pick(cli.doc, cli.cnpj, cli.cpf, os.cpf),
      endereco: enderecoPessoa(cli),
      fiscal: pick(cli.govFiscal, cli.fiscalContrato, cli.fiscal, cli.responsavel),
      cabecalho: pick(os.cabecalhoOS, os.govCabecalhoOS, os.govCabecalho, cli.govCabecalho, cli.cabecalhoInstitucional),
      cidade: pick(cli.cidade, cli.municipio)
    };
  }

  function dadosVeiculo(veiculo, os) {
    veiculo = veiculo || {};
    os = os || {};
    return {
      marca: upperTexto(veiculo.marca, os.marca),
      modelo: upperTexto(veiculo.modelo, os.veiculo, os.modelo),
      ano: pick(veiculo.ano, os.ano),
      placa: upperTexto(veiculo.placa, os.placa),
      chassis: upperTexto(veiculo.chassis, veiculo.chassi, os.chassis, os.chassi),
      patrimonio: pick(veiculo.patrimonio, veiculo.patrimonioNumero, veiculo.patrimonioId, os.patrimonio, os.patrimonioNumero),
      prefixo: upperTexto(veiculo.prefixo, os.prefixo),
      km: pick(os.km, veiculo.km)
    };
  }

  function normalizarAssinaturaExportar(fonte) {
    fonte = fonte || {};
    const a = fonte.assinatura || fonte.assinaturaOficina || fonte.assinaturaUsada || fonte;
    return {
      url: pick(
        a.url,
        a.assinaturaUrl,
        a.urlAssinatura,
        a.imageUrl,
        a.imagem,
        a.imagemUrl,
        a.secure_url,
        fonte.assinaturaUrl,
        fonte.urlAssinatura,
        fonte.url
      ),
      nomeResponsavel: pick(
        a.nomeResponsavel,
        a.nome,
        a.assinante,
        fonte.nomeAssinante,
        fonte.nomeResponsavel,
        fonte.representante,
        fonte.responsavel
      ),
      cargo: pick(
        a.cargo,
        a.funcao,
        a.funcaoResponsavel,
        fonte.cargoAssinante,
        fonte.funcaoAssinante,
        'Responsável técnico'
      ),
      documento: pick(
        a.documento,
        a.cpf,
        a.cnpj,
        a.doc,
        fonte.documentoAssinante,
        fonte.cpfAssinante,
        fonte.cnpjAssinante
      )
    };
  }

  function normalizarLogoExportar(fonte) {
    fonte = fonte || {};
    const a = fonte.timbrado || fonte.identidadeVisual || fonte.marcaVisual || fonte.branding || fonte;
    return {
      url: pick(
        a.logoUrl,
        a.logotipoUrl,
        a.logoOficinaUrl,
        a.logoOficina,
        a.timbradoLogoUrl,
        a.timbradoUrl,
        a.marcaUrl,
        a.imagemLogo,
        a.urlLogo,
        a.logo,
        a.logotipo,
        fonte.logoUrl,
        fonte.logotipoUrl,
        fonte.logo,
        fonte.logotipo
      ),
      nome: pick(a.nomeFantasia, a.nome, fonte.nomeFantasia, fonte.nome)
    };
  }

  async function obterAssinaturaExportar(os, tenant) {
    const fontes = [];

    // Ordem real: a assinatura da O.S. é a verdade daquele orçamento.
    // A assinatura da oficina/tenant é apenas fallback.
    try { fontes.push(os && os.assinaturaResponsavel); } catch(e) {}
    try { fontes.push(os && os.assinaturaOS); } catch(e) {}
    try { fontes.push(os && os.assinaturaUsada); } catch(e) {}
    try { fontes.push(os && os.assinatura); } catch(e) {}
    try { fontes.push(tenant && tenant.assinatura); } catch(e) {}
    try { fontes.push(tenant); } catch(e) {}
    try { fontes.push(window.J && window.J.oficina && window.J.oficina.assinatura); } catch(e) {}
    try { fontes.push(window.J && window.J.oficina); } catch(e) {}
    try { fontes.push(parseJsonSeguro(sessionStorage.getItem('j_oficina'))); } catch(e) {}

    function primeiraComUrl(lista) {
      for (const fonte of lista) {
        const ass = normalizarAssinaturaExportar(fonte);
        if (limparTexto(ass.url)) return ass;
      }
      return null;
    }

    function primeiraComTexto(lista) {
      for (const fonte of lista) {
        const ass = normalizarAssinaturaExportar(fonte);
        if (limparTexto(ass.nomeResponsavel) || limparTexto(ass.documento) || limparTexto(ass.cargo)) return ass;
      }
      return null;
    }

    // Primeiro, só aceita fontes que tenham imagem/URL.
    const localComUrl = primeiraComUrl(fontes);
    if (localComUrl) return localComUrl;

    // Se a sessão estiver velha, busca de novo no Firestore antes de desistir da imagem.
    try {
      const db = window.J && window.J.db;
      const tid = window.J && window.J.tid;
      if (db && tid && tid !== 'MASTER_ADMIN') {
        const snap = await db.collection('oficinas').doc(tid).get();
        if (snap && snap.exists) {
          const dados = { id: snap.id, ...snap.data() };
          const ass = normalizarAssinaturaExportar(dados);
          if (limparTexto(ass.url)) return ass;
          fontes.push(dados);
        }
      }
    } catch(e) {
      console.warn('[PMSP XLSX] Nao foi possivel buscar assinatura em oficinas:', e?.message || e);
    }

    try {
      const db = window.J && window.J.db;
      const tid = window.J && window.J.tid;
      if (db && tid && tid !== 'MASTER_ADMIN') {
        const snap = await db.collection('tenants').doc(tid).get();
        if (snap && snap.exists) {
          const dados = { id: snap.id, ...snap.data() };
          const ass = normalizarAssinaturaExportar(dados);
          if (limparTexto(ass.url)) return ass;
          fontes.push(dados);
        }
      }
    } catch(e) {
      console.warn('[PMSP XLSX] Nao foi possivel buscar assinatura em tenants:', e?.message || e);
    }

    // Somente se nenhuma imagem existir, usa fallback textual.
    return primeiraComTexto(fontes) || normalizarAssinaturaExportar({});
  }

  async function obterLogoOficinaExportar(os, tenant) {
    const fontes = [];
    try { fontes.push(os && os.dadosOficina); } catch(e) {}
    try { fontes.push(os && os.oficinaDados); } catch(e) {}
    try { fontes.push(os && os.oficina); } catch(e) {}
    try { fontes.push(tenant); } catch(e) {}
    try { fontes.push(window.J && window.J.oficina); } catch(e) {}
    try { fontes.push(window.J); } catch(e) {}
    try { fontes.push(parseJsonSeguro(sessionStorage.getItem('j_oficina'))); } catch(e) {}

    for (const fonte of fontes) {
      const logo = normalizarLogoExportar(fonte);
      if (limparTexto(logo.url)) return logo;
    }

    try {
      const db = window.J && window.J.db;
      const tid = window.J && window.J.tid;
      if (db && tid && tid !== 'MASTER_ADMIN') {
        const snap = await db.collection('oficinas').doc(tid).get();
        if (snap && snap.exists) {
          const logo = normalizarLogoExportar({ id: snap.id, ...snap.data() });
          if (limparTexto(logo.url)) return logo;
        }
      }
    } catch(e) {
      console.warn('[PMSP XLSX] Nao foi possivel buscar logotipo em oficinas:', e?.message || e);
    }

    try {
      const db = window.J && window.J.db;
      const tid = window.J && window.J.tid;
      if (db && tid && tid !== 'MASTER_ADMIN') {
        const snap = await db.collection('tenants').doc(tid).get();
        if (snap && snap.exists) {
          const logo = normalizarLogoExportar({ id: snap.id, ...snap.data() });
          if (limparTexto(logo.url)) return logo;
        }
      }
    } catch(e) {
      console.warn('[PMSP XLSX] Nao foi possivel buscar logotipo em tenants:', e?.message || e);
    }

    return normalizarLogoExportar({});
  }

  async function imagemUrlParaDataURLAssinatura(url) {
    url = limparTexto(url);
    if (!url) return null;

    // Cloudinary normalmente libera CORS. DataURL é mais confiável no ExcelJS/browser/APK
    // do que buffer/ArrayBuffer puro.
    try {
      const resp = await fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const tipo = (blob.type || '').toLowerCase();
      const extension = tipo.includes('png') ? 'png' : 'jpeg';
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (!dataUrl || !dataUrl.startsWith('data:image/')) throw new Error('Imagem sem DataURL valido');
      return { base64: dataUrl, extension };
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao carregar assinatura por fetch:', e?.message || e);
    }

    // Fallback visual por imagem/canvas quando fetch falha. Se o servidor não permitir CORS,
    // apenas mantém os dados em texto e não quebra a exportação.
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Erro ao carregar imagem'));
        el.src = url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now();
      });
      const canvas = document.createElement('canvas');
      const maxW = 420;
      const scale = Math.min(1, maxW / Math.max(img.naturalWidth || img.width || 1, 1));
      canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height || 1) * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { base64: canvas.toDataURL('image/png'), extension: 'png' };
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao preparar assinatura por canvas:', e?.message || e);
      return null;
    }
  }

  async function inserirAssinaturaExcelJS(wb, ws, assinatura, representanteRow) {
    const ass = normalizarAssinaturaExportar(assinatura);
    const nome = limparTexto(ass.nomeResponsavel);
    const cargo = limparTexto(ass.cargo) || 'Responsável técnico';
    const doc = limparTexto(ass.documento);
    const url = limparTexto(ass.url);
    const labelRow = Math.max(1, representanteRow - 5);
    const imgTopRow = labelRow + 1;
    const imgBottomRow = representanteRow - 1;

    // Não insere linhas e não altera o cabeçalho. Usa somente o espaço final que o modelo já possui.
    try {
      limparBlocoAssinaturaAgrupada(ws, labelRow, representanteRow);
      for (let r = labelRow; r <= representanteRow + 2; r++) {
        ws.getRow(r).hidden = false;
        ws.getRow(r).height = r > labelRow && r < representanteRow ? 24 : Math.max(ws.getRow(r).height || 18, 18);
      }
      setCell(ws, 'A' + labelRow, 'ASSINATURA DIGITALIZADA DA O.S. / OFICINA');
      ws.getCell('A' + labelRow).alignment = { ...(ws.getCell('A' + labelRow).alignment || {}), horizontal: 'center', vertical: 'middle' };
      ws.getCell('A' + labelRow).font = { ...(ws.getCell('A' + labelRow).font || {}), bold: true };
      setCell(ws, 'A' + representanteRow, `Assinante: ${nome || ''}`);
      setCell(ws, 'A' + (representanteRow + 1), `Função: ${cargo}`);
      setCell(ws, 'A' + (representanteRow + 2), `Documento: ${doc || ''}`);
      // Repete os dados legais ao lado da imagem para ficarem visíveis no Excel, no PDF/print e no mobile.
      setCell(ws, 'F' + imgTopRow, 'Assinante');
      setCell(ws, 'G' + imgTopRow, nome || '');
      setCell(ws, 'F' + (imgTopRow + 1), 'Função');
      setCell(ws, 'G' + (imgTopRow + 1), cargo || '');
      setCell(ws, 'F' + (imgTopRow + 2), 'Documento');
      setCell(ws, 'G' + (imgTopRow + 2), doc || '');
      ['F','G','H'].forEach(col=>{ for(let rr=imgTopRow; rr<=imgTopRow+2; rr++){ const cc=ws.getCell(col+rr); cc.alignment={...(cc.alignment||{}),wrapText:true,vertical:'middle',shrinkToFit:true}; cc.font={...(cc.font||{}),size:8,bold:col==='F'}; }});
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao preparar texto da assinatura:', e?.message || e);
    }

    if (!url) {
      setCell(ws, 'A' + (representanteRow + 3), 'Imagem não cadastrada nesta O.S. nem na oficina.');
      return false;
    }

    const img = await imagemUrlParaDataURLAssinatura(url);
    if (!img) {
      setCell(ws, 'A' + (representanteRow + 3), 'Imagem da assinatura não carregou. URL: ' + url);
      return false;
    }

    try {
      const imageId = wb.addImage({ base64: img.base64, extension: img.extension });
      ws.addImage(imageId, {
        tl: { col: 2.15, row: imgTopRow - 1 + 0.15 },
        br: { col: 5.85, row: imgBottomRow - 1 + 0.85 },
        editAs: 'oneCell'
      });
      return true;
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao embutir imagem da assinatura:', e?.message || e);
      setCell(ws, 'A' + (representanteRow + 3), 'Imagem da assinatura não foi embutida no XLSX. URL: ' + url);
      return false;
    }
  }

  async function inserirAssinaturaFinalAgrupadaExcelJS(wb, ws, assinatura, startRow) {
    const ass = normalizarAssinaturaExportar(assinatura);
    const nome = limparTexto(ass.nomeResponsavel);
    const cargo = limparTexto(ass.cargo) || 'Responsavel tecnico';
    const doc = limparTexto(ass.documento);
    const url = limparTexto(ass.url);
    const endRow = startRow + 5;

    for (let r = startRow; r <= endRow; r++) {
      safeUnmergeOverlaps(ws, `A${r}:H${r}`);
      ['A','B','C','D','E','F','G','H'].forEach(col => {
        const cell = ws.getCell(col + r);
        cell.value = '';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true, shrinkToFit: true };
      });
      ws.getRow(r).hidden = false;
      ws.getRow(r).height = r <= startRow + 2 ? 30 : 18;
    }

    safeMerge(ws, `B${startRow}:E${startRow + 2}`);
    ['F','G'].forEach(col => {
      for (let r = startRow; r <= startRow + 2; r++) {
        ws.getCell(col + r).font = { name: 'Arial', size: 8, bold: col === 'F', color: { argb: 'FF000000' } };
        ws.getCell(col + r).alignment = { horizontal: col === 'F' ? 'right' : 'left', vertical: 'middle', wrapText: true, shrinkToFit: true };
      }
    });
    setCell(ws, 'F' + startRow, 'Assinante');
    setCell(ws, 'G' + startRow, nome || '');
    setCell(ws, 'F' + (startRow + 1), 'Funcao');
    setCell(ws, 'G' + (startRow + 1), cargo || '');
    setCell(ws, 'F' + (startRow + 2), 'Documento');
    setCell(ws, 'G' + (startRow + 2), doc || '');

    if (!url) {
      setCell(ws, 'B' + startRow, 'Imagem da assinatura nao cadastrada');
      ws.getCell('B' + startRow).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
      return false;
    }

    const img = await imagemUrlParaDataURLAssinatura(url);
    if (!img) {
      setCell(ws, 'B' + startRow, 'Imagem da assinatura nao carregou');
      ws.getCell('B' + startRow).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
      return false;
    }

    try {
      const imageId = wb.addImage({ base64: img.base64, extension: img.extension });
      ws.addImage(imageId, {
        tl: { col: 1.25, row: startRow - 1 + 0.08 },
        br: { col: 4.75, row: startRow + 2 + 0.78 },
        editAs: 'oneCell'
      });
      return true;
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao embutir imagem da assinatura agrupada:', e?.message || e);
      setCell(ws, 'B' + startRow, 'Imagem da assinatura nao foi embutida no XLSX');
      ws.getCell('B' + startRow).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
      return false;
    }
  }

  async function inserirLogoOficinaExcelJS(wb, ws, logo) {
    const dadosLogo = normalizarLogoExportar(logo);
    const url = limparTexto(dadosLogo.url);
    if (!url) return false;
    const img = await imagemUrlParaDataURLAssinatura(url);
    if (!img) return false;
    try {
      const imageId = wb.addImage({ base64: img.base64, extension: img.extension });
      // Mantem o brasao/cabecalho oficial do modelo PMSP intacto e usa o canto direito
      // superior como timbrado discreto da oficina.
      ws.addImage(imageId, {
        tl: { col: 6.18, row: 1.15 },
        ext: { width: 72, height: 34 },
        editAs: 'oneCell'
      });
      return true;
    } catch (e) {
      console.warn('[PMSP XLSX] Falha ao embutir logotipo da oficina:', e?.message || e);
      return false;
    }
  }

  function dadosTenant(tenant) {
    tenant = tenant || {};
    const logo = normalizarLogoExportar(tenant);
    return {
      razaoSocial: pick(tenant.razaoSocial, tenant.razao, tenant.nomeFantasia, tenant.tnome, tenant.nome),
      cnpj: pick(tenant.cnpj, tenant.doc, tenant.documento),
      endereco: enderecoOficina(tenant),
      telefone: pick(tenant.telefone, tenant.wpp, tenant.celular),
      orcamentista: pick(tenant.orcamentista, tenant.responsavel, tenant.nome, tenant.tnome),
      representante: pick(tenant.representante, tenant.responsavel, tenant.orcamentista, tenant.nome, tenant.tnome),
      cidade: pick(tenant.cidade, tenant.municipio),
      logoUrl: logo.url
    };
  }

  function cloneStyle(style) {
    return style ? JSON.parse(JSON.stringify(style)) : {};
  }

  function copiarLinhaModelo(ws, origem, destino, ateColuna) {
    const src = ws.getRow(origem);
    const dst = ws.getRow(destino);
    dst.height = src.height;
    for (let c = 1; c <= ateColuna; c++) {
      const sc = src.getCell(c);
      const dc = dst.getCell(c);
      dc.style = cloneStyle(sc.style);
      dc.numFmt = sc.numFmt;
      dc.alignment = cloneStyle(sc.alignment);
      dc.border = cloneStyle(sc.border);
      dc.fill = cloneStyle(sc.fill);
      dc.font = cloneStyle(sc.font);
      dc.protection = cloneStyle(sc.protection);
    }
  }

  function setCell(ws, addr, value) {
    const c = ws.getCell(addr);
    c.value = value == null ? '' : value;
  }

  function setFormula(ws, addr, formula, result) {
    const c = ws.getCell(addr);
    c.value = { formula, result: moedaNumber(result) };
  }

  function setNumberCell(ws, addr, value, numFmt) {
    const c = ws.getCell(addr);
    c.value = moedaNumber(value);
    if (numFmt) c.numFmt = numFmt;
    c.alignment = { ...(c.alignment || {}), horizontal: 'right', vertical: 'middle', shrinkToFit: true };
  }

  function setMoneyCell(ws, addr, value) {
    setNumberCell(ws, addr, value, '"R$" #,##0.00;-"R$" #,##0.00;"-"');
  }

  function setPercentCell(ws, addr, value) {
    const c = ws.getCell(addr);
    c.value = n(value) || 0;
    c.numFmt = '0.0%';
    c.alignment = { ...(c.alignment || {}), horizontal: 'center', vertical: 'middle', shrinkToFit: true };
  }

  function congelarFormulasCompartilhadasPMSP(wb) {
    if (!wb || typeof wb.eachSheet !== 'function') return;
    wb.eachSheet(ws => {
      ws.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
          const value = cell.value;
          if (!value || typeof value !== 'object') return;
          if (!Object.prototype.hasOwnProperty.call(value, 'formula') && !Object.prototype.hasOwnProperty.call(value, 'sharedFormula')) return;
          cell.value = Object.prototype.hasOwnProperty.call(value, 'result') && value.result != null ? value.result : '';
        });
      });
    });
  }

  function safeUnmerge(ws, range) {
    try { ws.unMergeCells(range); } catch(e) {}
  }

  function colToNumber(col) {
    return String(col || '').toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  }

  function decodeAddress(addr) {
    const m = String(addr || '').match(/^([A-Z]+)(\d+)$/i);
    if (!m) return null;
    return { col: colToNumber(m[1]), row: parseInt(m[2], 10) };
  }

  function decodeRange(range) {
    const parts = String(range || '').split(':');
    const a = decodeAddress(parts[0]);
    const b = decodeAddress(parts[1] || parts[0]);
    if (!a || !b) return null;
    return { top: Math.min(a.row, b.row), bottom: Math.max(a.row, b.row), left: Math.min(a.col, b.col), right: Math.max(a.col, b.col) };
  }

  function rangesOverlap(a, b) {
    return !!a && !!b && !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function mergeRanges(ws) {
    const out = [];
    const merges = ws?._merges || ws?.model?.merges || {};
    if (Array.isArray(merges)) {
      merges.forEach(range => {
        const decoded = decodeRange(range);
        if (decoded) out.push({ range, decoded });
      });
      return out;
    }
    Object.keys(merges || {}).forEach(key => {
      const item = merges[key];
      let range = item?.range || item?.model?.range || key;
      if (item?.model && item.model.top != null) {
        out.push({ range, decoded: { top: item.model.top, bottom: item.model.bottom, left: item.model.left, right: item.model.right } });
        return;
      }
      const decoded = decodeRange(range);
      if (decoded) out.push({ range, decoded });
    });
    return out;
  }

  function safeUnmergeOverlaps(ws, range) {
    const wanted = decodeRange(range);
    if (!wanted) return;
    mergeRanges(ws).forEach(item => {
      if (rangesOverlap(item.decoded, wanted)) {
        try { ws.unMergeCells(item.range); } catch(e) {}
      }
    });
    safeUnmerge(ws, range);
  }

  function safeMerge(ws, range) {
    try {
      safeUnmergeOverlaps(ws, range);
      ws.mergeCells(range);
      return true;
    } catch (e) {
      console.warn('[PMSP XLSX] Merge ignorado para nao travar exportacao:', range, e?.message || e);
      return false;
    }
  }

  function limparRangeResumo(ws, row) {
    ['A:H','A:D','A:B','B:D','B:F','B:H','C:D','D:H','E:F','E:H','F:H','G:H'].forEach(range => safeUnmerge(ws, `${range.split(':')[0]}${row}:${range.split(':')[1]}${row}`));
    ['A','B','C','D','E','F','G','H'].forEach(col => setCell(ws, col + row, ''));
  }

  function inserirLinhasExtras(ws, totalRow, modeloRow, extra) {
    if (extra <= 0) return;
    ws.spliceRows(totalRow, 0, ...Array.from({ length: extra }, () => []));
    for (let i = 0; i < extra; i++) copiarLinhaModelo(ws, modeloRow, totalRow + i, 8);
  }

  function enderecoOficina(tenant) {
    return pick(
      tenant.enderecoCompleto,
      [
        pick(tenant.endereco, tenant.rua, tenant.logradouro),
        pick(tenant.numero, tenant.num, tenant.n),
        tenant.bairro,
        pick(tenant.cidade, tenant.municipio),
        tenant.uf,
        tenant.cep
      ].filter(v => limparTexto(v)).join(', ')
    );
  }

  function aplicarAjustesCabecalho(ws) {
    ws.getColumn('B').width = 26;
    ws.getColumn('D').width = 46;
    ws.getColumn('E').width = 8;
    ws.getColumn('F').width = 17;
    ws.getColumn('G').width = 12;
    ws.getColumn('H').width = 20;
    [1,3,5,6,7,9,10,11,12,14,15,17].forEach(r => {
      const row = ws.getRow(r);
      row.height = Math.max(row.height || 15, r === 1 ? 92 : 18);
      row.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { ...(cell.alignment || {}), wrapText: true, shrinkToFit: true, vertical: 'middle' };
      });
    });
  }

  function clearRow(ws, row, cols) {
    (cols || ['B','D','E','F','G','H']).forEach(col => setCell(ws, col + row, ''));
  }

  function prepararLinhasDados(ws, start, end, usadas) {
    const visiveis = Math.min(end - start + 1, Math.max(usadas + 3, 4));
    const ultimoVisivel = start + visiveis - 1;
    for (let r = start; r <= end; r++) {
      clearRow(ws, r);
      ws.getRow(r).hidden = r > ultimoVisivel;
    }
  }

  function prepararRodape(ws, rows) {
    rows.forEach(r => {
      ws.getRow(r).hidden = false;
      limparRangeResumo(ws, r);
    });
  }

  function estilizarResumo(ws, row, destaque) {
    const fill = destaque ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9C19B' } } : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    ['B','C','D','E','F','G','H'].forEach(col => {
      const cell = ws.getCell(col + row);
      cell.fill = fill;
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', shrinkToFit: true, wrapText: true };
      cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FF000000' }, size: destaque ? 15 : 10 };
    });
    ws.getRow(row).height = destaque ? 26 : 19;
  }

  function linhaResumoValor(ws, row, label, value, opts) {
    const op = opts || {};
    limparRangeResumo(ws, row);
    safeUnmerge(ws, `B${row}:F${row}`);
    safeMerge(ws, `B${row}:F${row}`);
    setCell(ws, 'B' + row, label);
    ws.getCell('B' + row).alignment = { horizontal: op.contrato ? 'center' : 'left', vertical: 'middle', wrapText: true, shrinkToFit: true };
    if (op.blankValue) {
      setCell(ws, 'G' + row, '');
      setCell(ws, 'H' + row, '');
    } else {
      setCell(ws, 'G' + row, 'R$');
      ws.getCell('G' + row).alignment = { horizontal: 'center', vertical: 'middle' };
      setMoneyCell(ws, 'H' + row, value);
    }
    estilizarResumo(ws, row, !!op.contrato);
  }

  function linhaTotalServicos(ws, row, horas, total) {
    limparRangeResumo(ws, row);
    setCell(ws, 'B' + row, 'TOTAL DE SERVICOS');
    setNumberCell(ws, 'E' + row, horas, '0.00');
    setCell(ws, 'G' + row, 'R$');
    ws.getCell('G' + row).alignment = { horizontal: 'center', vertical: 'middle' };
    setMoneyCell(ws, 'H' + row, total);
    estilizarResumo(ws, row, false);
  }

  function linhaTotalPecas(ws, row, total) {
    limparRangeResumo(ws, row);
    safeUnmerge(ws, `B${row}:F${row}`);
    safeMerge(ws, `B${row}:F${row}`);
    setCell(ws, 'B' + row, 'TOTAL DE PECAS');
    setCell(ws, 'G' + row, 'R$');
    ws.getCell('G' + row).alignment = { horizontal: 'center', vertical: 'middle' };
    setMoneyCell(ws, 'H' + row, total);
    estilizarResumo(ws, row, false);
  }

  function inserirResumoSecoes(ws, startRow, resumoSecoes) {
    if (!resumoSecoes || !resumoSecoes.length) return;
    const titleRow = startRow;
    const headRow = startRow + 1;
    const primeiroItem = startRow + 2;

    [titleRow, headRow, ...resumoSecoes.map((_, i) => primeiroItem + i)].forEach(row => {
      limparRangeResumo(ws, row);
      ws.getRow(row).hidden = false;
      ['B','D','E','F','G','H'].forEach(col => {
        const cell = ws.getCell(col + row);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.alignment = { vertical: 'middle', wrapText: true, shrinkToFit: true };
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF000000' } };
      });
    });

    safeUnmerge(ws, `B${titleRow}:H${titleRow}`);
    safeMerge(ws, `B${titleRow}:H${titleRow}`);
    setCell(ws, 'B' + titleRow, 'RESUMO POR SECAO DE MAO DE OBRA DA O.S.');
    ws.getCell('B' + titleRow).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
    ws.getCell('B' + titleRow).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    ws.getCell('B' + titleRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    ws.getRow(titleRow).height = 18;

    safeUnmerge(ws, `B${headRow}:F${headRow}`);
    safeMerge(ws, `B${headRow}:F${headRow}`);
    setCell(ws, 'B' + headRow, 'TIPO / SEÇÃO DO SERVIÇO');
    setCell(ws, 'G' + headRow, 'HORAS');
    setCell(ws, 'H' + headRow, 'VALOR');
    ['B','G','H'].forEach(col => {
      const cell = ws.getCell(col + headRow);
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: col === 'B' ? 'left' : 'center', vertical: 'middle', shrinkToFit: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    });

    resumoSecoes.forEach(([secao, item], idx) => {
      const row = primeiroItem + idx;
      safeUnmerge(ws, `B${row}:F${row}`);
      safeMerge(ws, `B${row}:F${row}`);
      setCell(ws, 'B' + row, textoResumoSecao(secao, item));
      setNumberCell(ws, 'G' + row, item.horas, '0.00');
      setMoneyCell(ws, 'H' + row, item.total);
      ws.getCell('B' + row).alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true, wrapText: true };
      ws.getCell('G' + row).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell('H' + row).alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };
      ws.getRow(row).height = Math.max(18, 14 * String(ws.getCell('B' + row).value || '').split('\n').length);
    });
  }


  function chaveNaoVazia(value) {
    const txt = limparTexto(value);
    return txt && txt !== '-' && txt.toLowerCase() !== 'sem oem' ? txt : '';
  }

  function agruparComposicaoOS(linhasPecas, linhasServ) {
    const grupos = (linhasPecas || []).map((p, idx) => ({ peca: p, idx, servicos: [] }));
    const porCilia = new Map();
    const porCodigo = new Map();

    grupos.forEach(g => {
      const cilia = chaveNaoVazia(g.peca.ciliaPieceIndex);
      if (cilia && !porCilia.has(cilia)) porCilia.set(cilia, g);
      const cod = chaveNaoVazia(g.peca.codigo).toUpperCase();
      if (cod && !porCodigo.has(cod)) porCodigo.set(cod, g);
    });

    const soltos = [];
    (linhasServ || []).forEach(s => {
      let grupo = null;
      const cilia = chaveNaoVazia(s.ciliaPieceIndex);
      const codPeca = chaveNaoVazia(s.pecaCodigo).toUpperCase();

      if (cilia && porCilia.has(cilia)) grupo = porCilia.get(cilia);
      if (!grupo && codPeca && porCodigo.has(codPeca)) grupo = porCodigo.get(codPeca);
      if (!grupo && s.relacionadoCilia && s.pecaDesc) {
        const desc = normalizarSecao(s.pecaDesc);
        grupo = grupos.find(g => desc && normalizarSecao(g.peca.desc).includes(desc));
      }

      if (grupo) grupo.servicos.push(s);
      else soltos.push(s);
    });

    return { grupos, soltos };
  }

  function secaoGrupoComposicao(grupo) {
    const servicoBase = (grupo.servicos || [])[0];
    if (servicoBase) return classificarSecao(servicoBase);
    const p = grupo.peca || {};
    return classificarSecao({
      sistema: p.ciliaGrupo || p.ciliaAgrupador || '',
      desc: [p.desc, p.ciliaGrupo, p.ciliaAgrupador].filter(Boolean).join(' ')
    });
  }

  function agruparComposicaoPorSecao(grupos, soltos) {
    const mapa = new Map();
    function secaoItem(nome) {
      const key = limparTexto(nome || 'OUTROS SERVICOS') || 'OUTROS SERVICOS';
      if (!mapa.has(key)) mapa.set(key, { secao: key, grupos: [], soltos: [] });
      return mapa.get(key);
    }
    (grupos || []).forEach(g => secaoItem(secaoGrupoComposicao(g)).grupos.push(g));
    (soltos || []).forEach(s => secaoItem(classificarSecao(s)).soltos.push(s));
    return Array.from(mapa.values());
  }

  function agruparServicosSoltosPorSecao(soltos) {
    const mapa = new Map();
    function secaoItem(nome) {
      const key = limparTexto(nome || 'OUTROS SERVICOS') || 'OUTROS SERVICOS';
      if (!mapa.has(key)) mapa.set(key, { secao: key, servicos: [] });
      return mapa.get(key);
    }
    (soltos || []).forEach(s => secaoItem(classificarSecao(s)).servicos.push(s));
    return Array.from(mapa.values());
  }

  function contarLinhasComposicaoOS(linhasPecas, linhasServ) {
    if (!(linhasPecas || []).length && !(linhasServ || []).length) return 0;
    const { grupos, soltos } = agruparComposicaoOS(linhasPecas, linhasServ);
    const secoes = agruparComposicaoPorSecao(grupos, []);
    const soltosSecoes = agruparServicosSoltosPorSecao(soltos);
    const linhasComPeca = secoes.reduce((sum, sec) => sum + 1 + sec.grupos.reduce((soma, g) => soma + 1 + g.servicos.length, 0), 0);
    const linhasSemPeca = soltosSecoes.length ? 1 + soltosSecoes.reduce((sum, sec) => sum + 1 + sec.servicos.length, 0) : 0;
    return 2 + linhasComPeca + linhasSemPeca;
  }

  function bordarLinhaOS(ws, row, tipo) {
    const fill = tipo === 'titulo'
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
      : tipo === 'peca'
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } }
        : tipo === 'grupo'
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } }
          : null;
    ['B','D','E','F','G','H'].forEach(col => {
      const cell = ws.getCell(col + row);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true, shrinkToFit: true };
      cell.font = { name: 'Arial', size: 9, bold: tipo === 'peca' || tipo === 'titulo' || tipo === 'grupo', color: { argb: 'FF000000' } };
      if (fill) cell.fill = fill;
    });
  }

  function tituloBlocoOS(ws, row, titulo) {
    limparRangeResumo(ws, row);
    safeUnmerge(ws, `B${row}:H${row}`);
    safeMerge(ws, `B${row}:H${row}`);
    setCell(ws, 'B' + row, titulo);
    const cell = ws.getCell('B' + row);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    bordarLinhaOS(ws, row, 'titulo');
    ws.getRow(row).height = 19;
  }

  function inserirCabecalhoComposicaoOS(ws, row) {
    limparRangeResumo(ws, row);
    setCell(ws, 'B' + row, 'ITEM / CÓDIGO');
    setCell(ws, 'D' + row, 'DESCRIÇÃO');
    setCell(ws, 'E' + row, 'QTD / H');
    setCell(ws, 'F' + row, 'UNIT. / R$/H');
    setCell(ws, 'G' + row, 'DESC.');
    setCell(ws, 'H' + row, 'TOTAL');
    bordarLinhaOS(ws, row, 'grupo');
    ['E','F','G','H'].forEach(col => { ws.getCell(col + row).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }; });
    ws.getRow(row).height = 18;
  }

  function textoItemPeca(p) {
    const linhas = ['PEÇA'];
    if (p.codigo) linhas.push(`CÓD.: ${p.codigo}`);
    return linhas.join('\n');
  }

  function textoItemServico(s) {
    const linhas = ['SERVIÇO'];
    if (s.codigo) linhas.push(`CÓD.: ${s.codigo}`);
    if (s.sistema) linhas.push(`SIST.: ${s.sistema}`);
    if (s.tipoVeiculo) linhas.push(`TIPO: ${s.tipoVeiculo}`);
    return linhas.join('\n');
  }

  function textoItemServico(s) {
    const linhas = ['SERVICO'];
    if (s.codigoInterno) linhas.push(`COD. INTERNO: ${s.codigoInterno}`);
    if (s.codigoTabela) linhas.push(`COD. SIAFISICO: ${s.codigoTabela}`);
    if (!s.codigoInterno && !s.codigoTabela && s.codigo) linhas.push(`COD.: ${s.codigo}`);
    if (s.sistema) linhas.push(`SIST.: ${s.sistema}`);
    if (s.tipoVeiculo) linhas.push(`TIPO: ${s.tipoVeiculo}`);
    return linhas.join('\n');
  }

  function inserirComposicaoOSAntigo(ws, startRow, linhasPecas, linhasServ) {
    const totalRows = contarLinhasComposicaoOS(linhasPecas, linhasServ);
    if (!totalRows) return 0;
    const { grupos, soltos } = agruparComposicaoOS(linhasPecas, linhasServ);
    let row = startRow;
    tituloBlocoOS(ws, row++, 'COMPOSIÇÃO DA O.S. POR PEÇA E SERVIÇO VINCULADO');
    inserirCabecalhoComposicaoOS(ws, row++);

    grupos.forEach(g => {
      const p = g.peca;
      limparRangeResumo(ws, row);
      setCell(ws, 'B' + row, textoItemPeca(p));
      setCell(ws, 'D' + row, p.desc || 'PEÇA SEM DESCRIÇÃO');
      setNumberCell(ws, 'E' + row, p.qtd, '0.##');
      setMoneyCell(ws, 'F' + row, p.valorUnit);
      setPercentCell(ws, 'G' + row, p.descPct);
      setMoneyCell(ws, 'H' + row, p.total);
      bordarLinhaOS(ws, row, 'peca');
      ws.getRow(row).height = Math.max(24, 13 * String(ws.getCell('B' + row).value || '').split('\n').length);
      row++;

      g.servicos.forEach(s => {
        limparRangeResumo(ws, row);
        setCell(ws, 'B' + row, textoItemServico(s));
        setCell(ws, 'D' + row, s.desc || 'SERVIÇO SEM DESCRIÇÃO');
        setNumberCell(ws, 'E' + row, s.tempo, '0.00');
        setMoneyCell(ws, 'F' + row, s.valorHora);
        setPercentCell(ws, 'G' + row, s.descPct);
        setMoneyCell(ws, 'H' + row, s.total);
        bordarLinhaOS(ws, row, 'servico');
        ws.getRow(row).height = Math.max(28, 12 * String(ws.getCell('B' + row).value || '').split('\n').length);
        row++;
      });
    });

    if (soltos.length) {
      limparRangeResumo(ws, row);
      safeUnmerge(ws, `B${row}:H${row}`);
      safeMerge(ws, `B${row}:H${row}`);
      setCell(ws, 'B' + row, 'SERVIÇOS GERAIS / SEM PEÇA VINCULADA');
      ws.getCell('B' + row).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
      bordarLinhaOS(ws, row, 'grupo');
      ws.getRow(row).height = 18;
      row++;
      soltos.forEach(s => {
        limparRangeResumo(ws, row);
        setCell(ws, 'B' + row, textoItemServico(s));
        setCell(ws, 'D' + row, s.desc || 'SERVIÇO SEM DESCRIÇÃO');
        setNumberCell(ws, 'E' + row, s.tempo, '0.00');
        setMoneyCell(ws, 'F' + row, s.valorHora);
        setPercentCell(ws, 'G' + row, s.descPct);
        setMoneyCell(ws, 'H' + row, s.total);
        bordarLinhaOS(ws, row, 'servico');
        ws.getRow(row).height = Math.max(28, 12 * String(ws.getCell('B' + row).value || '').split('\n').length);
        row++;
      });
    }
    return totalRows;
  }

  function inserirComposicaoOS(ws, startRow, linhasPecas, linhasServ) {
    const totalRows = contarLinhasComposicaoOS(linhasPecas, linhasServ);
    if (!totalRows) return 0;
    const { grupos, soltos } = agruparComposicaoOS(linhasPecas, linhasServ);
    const secoes = agruparComposicaoPorSecao(grupos, []);
    const soltosSecoes = agruparServicosSoltosPorSecao(soltos);
    let row = startRow;
    tituloBlocoOS(ws, row++, 'COMPOSIÇÃO DA O.S. POR PEÇA E SERVIÇO VINCULADO');
    inserirCabecalhoComposicaoOS(ws, row++);

    secoes.forEach(sec => {
      limparRangeResumo(ws, row);
      safeUnmerge(ws, `B${row}:H${row}`);
      safeMerge(ws, `B${row}:H${row}`);
      setCell(ws, 'B' + row, 'SEÇÃO: ' + sec.secao);
      ws.getCell('B' + row).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, shrinkToFit: true };
      bordarLinhaOS(ws, row, 'grupo');
      ws.getRow(row).height = 18;
      row++;

      sec.grupos.forEach(g => {
        const p = g.peca;
        limparRangeResumo(ws, row);
        setCell(ws, 'B' + row, textoItemPeca(p));
        setCell(ws, 'D' + row, p.desc || 'PEÇA SEM DESCRIÇÃO');
        setNumberCell(ws, 'E' + row, p.qtd, '0.##');
        setMoneyCell(ws, 'F' + row, p.valorUnit);
        setPercentCell(ws, 'G' + row, p.descPct);
        setMoneyCell(ws, 'H' + row, p.total);
        bordarLinhaOS(ws, row, 'peca');
        ws.getRow(row).height = Math.max(24, 13 * String(ws.getCell('B' + row).value || '').split('\n').length);
        row++;

        g.servicos.forEach(s => {
          limparRangeResumo(ws, row);
          setCell(ws, 'B' + row, textoItemServico(s));
          setCell(ws, 'D' + row, s.desc || 'SERVIÇO SEM DESCRIÇÃO');
          setNumberCell(ws, 'E' + row, s.tempo, '0.00');
          setMoneyCell(ws, 'F' + row, s.valorHora);
          setPercentCell(ws, 'G' + row, s.descPct);
          setMoneyCell(ws, 'H' + row, s.total);
          bordarLinhaOS(ws, row, 'servico');
          ws.getRow(row).height = Math.max(28, 12 * String(ws.getCell('B' + row).value || '').split('\n').length);
          row++;
        });
      });

      (sec.soltos || []).forEach(s => {
        limparRangeResumo(ws, row);
        setCell(ws, 'B' + row, textoItemServico(s));
        setCell(ws, 'D' + row, s.desc || 'SERVIÇO SEM DESCRIÇÃO');
        setNumberCell(ws, 'E' + row, s.tempo, '0.00');
        setMoneyCell(ws, 'F' + row, s.valorHora);
        setPercentCell(ws, 'G' + row, s.descPct);
        setMoneyCell(ws, 'H' + row, s.total);
        bordarLinhaOS(ws, row, 'servico');
        ws.getRow(row).height = Math.max(28, 12 * String(ws.getCell('B' + row).value || '').split('\n').length);
        row++;
      });
    });

    if (soltosSecoes.length) {
      tituloBlocoOS(ws, row++, 'SERVIÇOS SEM PEÇA VINCULADA');
      soltosSecoes.forEach(sec => {
        limparRangeResumo(ws, row);
        safeUnmerge(ws, `B${row}:H${row}`);
        safeMerge(ws, `B${row}:H${row}`);
        setCell(ws, 'B' + row, 'SEÇÃO: ' + sec.secao);
        ws.getCell('B' + row).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, shrinkToFit: true };
        bordarLinhaOS(ws, row, 'grupo');
        ws.getRow(row).height = 18;
        row++;

        sec.servicos.forEach(s => {
          limparRangeResumo(ws, row);
          setCell(ws, 'B' + row, textoItemServico(s));
          setCell(ws, 'D' + row, s.desc || 'SERVIÇO SEM DESCRIÇÃO');
          setNumberCell(ws, 'E' + row, s.tempo, '0.00');
          setMoneyCell(ws, 'F' + row, s.valorHora);
          setPercentCell(ws, 'G' + row, s.descPct);
          setMoneyCell(ws, 'H' + row, s.total);
          bordarLinhaOS(ws, row, 'servico');
          ws.getRow(row).height = Math.max(28, 12 * String(ws.getCell('B' + row).value || '').split('\n').length);
          row++;
        });
      });
    }
    return totalRows;
  }

  function contarLinhasKPIFinais(resumoSecoes) {
    return 1 + 11 + ((resumoSecoes || []).length ? 2 + resumoSecoes.length : 0);
  }

  function linhaKPIFinal(ws, row, label, aux, valor, destaque) {
    limparRangeResumo(ws, row);
    safeUnmerge(ws, `B${row}:F${row}`);
    safeMerge(ws, `B${row}:F${row}`);
    setCell(ws, 'B' + row, label);
    setCell(ws, 'G' + row, aux || '');
    setMoneyCell(ws, 'H' + row, valor);
    estilizarResumo(ws, row, !!destaque);
    ws.getCell('G' + row).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
    ws.getRow(row).height = destaque ? 24 : 18;
  }

  function inserirKPIsFinaisOS(ws, startRow, linhasPecas, linhasServ, resumoSecoes) {
    let row = startRow;
    const brutoPecas = (linhasPecas || []).reduce((sum, p) => sum + n(p.bruto || 0), 0);
    const liquidoPecas = (linhasPecas || []).reduce((sum, p) => sum + n(p.total || 0), 0);
    const brutoMO = (linhasServ || []).reduce((sum, s) => sum + n(s.bruto || 0), 0);
    const liquidoMO = (linhasServ || []).reduce((sum, s) => sum + n(s.total || 0), 0);
    const horasMO = (linhasServ || []).reduce((sum, s) => sum + n(s.tempo || 0), 0);
    const descPecas = +(brutoPecas - liquidoPecas).toFixed(2);
    const descMO = +(brutoMO - liquidoMO).toFixed(2);
    const brutoTotal = +(brutoPecas + brutoMO).toFixed(2);
    const liquidoTotal = +(liquidoPecas + liquidoMO).toFixed(2);
    const descTotal = +(descPecas + descMO).toFixed(2);

    tituloBlocoOS(ws, row++, 'KPIs FINAIS DA O.S.');
    linhaKPIFinal(ws, row++, 'QTDE / VALOR BRUTO DE PEÇAS', `${(linhasPecas || []).length} peça(s)`, brutoPecas);
    linhaKPIFinal(ws, row++, 'DESCONTO TOTAL EM PEÇAS', '', descPecas);
    linhaKPIFinal(ws, row++, 'VALOR LÍQUIDO DE PEÇAS', '', liquidoPecas);
    linhaKPIFinal(ws, row++, 'QTDE / VALOR BRUTO DE SERVIÇOS', `${(linhasServ || []).length} serviço(s) · ${horasMO.toFixed(2).replace('.', ',')} h`, brutoMO);
    linhaKPIFinal(ws, row++, 'DESCONTO TOTAL EM MÃO DE OBRA', '', descMO);
    linhaKPIFinal(ws, row++, 'VALOR LÍQUIDO DE MÃO DE OBRA', '', liquidoMO);
    linhaKPIFinal(ws, row++, 'TOTAL BRUTO DA O.S.', '', brutoTotal);
    linhaKPIFinal(ws, row++, 'DESCONTO TOTAL DA O.S.', '', descTotal);
    linhaKPIFinal(ws, row++, 'TOTAL LÍQUIDO / CONTRATO', '', liquidoTotal, true);
    linhaKPIFinal(ws, row++, 'TOTAL DE HORAS DE MÃO DE OBRA', `${horasMO.toFixed(2).replace('.', ',')} h`, 0, false);
    linhaKPIFinal(ws, row++, 'TOTAL DE ITENS NA O.S.', `${(linhasPecas || []).length} peça(s) + ${(linhasServ || []).length} serviço(s)`, liquidoTotal, false);

    if ((resumoSecoes || []).length) {
      inserirResumoSecoes(ws, row, resumoSecoes);
    }
  }

  function contarLinhasAprovacaoExportar(aprovacaoInfo) {
    const nao = aprovacaoInfo?.naoAprovados || [];
    return nao.length ? 2 + nao.length : 0;
  }

  function inserirResumoAprovacaoExportar(ws, startRow, aprovacaoInfo) {
    const nao = aprovacaoInfo?.naoAprovados || [];
    if (!nao.length) return 0;
    let row = startRow;
    tituloBlocoOS(ws, row++, 'ITENS NÃO APROVADOS — HISTÓRICO DO ORÇAMENTO ORIGINAL');
    limparRangeResumo(ws, row);
    setCell(ws, 'B' + row, 'TIPO / CÓDIGO');
    setCell(ws, 'D' + row, 'DESCRIÇÃO');
    setCell(ws, 'E' + row, 'QTD / H');
    setCell(ws, 'F' + row, 'UNIT. / R$/H');
    setCell(ws, 'G' + row, 'DESC.');
    setCell(ws, 'H' + row, 'TOTAL ORIGINAL');
    bordarLinhaOS(ws, row, 'grupo');
    row++;
    nao.forEach(item => {
      limparRangeResumo(ws, row);
      const tipo = item.tipo === 'peca' ? 'PEÇA' : 'SERVIÇO';
      setCell(ws, 'B' + row, `${tipo}${item.codigo ? '\nCÓD.: ' + item.codigo : ''}`);
      setCell(ws, 'D' + row, item.desc || '-');
      setNumberCell(ws, 'E' + row, item.tipo === 'peca' ? (item.qtd || 1) : (item.tempo || 0), '0.##');
      setMoneyCell(ws, 'F' + row, item.valorUnit || item.valorHora || 0);
      setCell(ws, 'G' + row, 'NÃO APROVADO');
      setMoneyCell(ws, 'H' + row, item.valorFinal || 0);
      bordarLinhaOS(ws, row, 'nao-aprovado');
      ws.getRow(row).height = Math.max(24, 12 * String(ws.getCell('D' + row).value || '').split('\n').length);
      row++;
    });
    return row - startRow;
  }

  function formatarCabecalhoPM(texto) {
    let raw = String(texto || '');
    if (!/\r?\n/.test(raw)) {
      raw = raw
        .replace(/\s+(POL[IÍ]CIA\s+MILITAR)/i, '\n$1')
        .replace(/\s+(COMANDO\s+DE)/i, '\n$1')
        .replace(/\s+(UNIDADE\s+GESTORA)/i, '\n$1');
    }
    const linhas = raw
      .split(/\r?\n/)
      .map(l => limparTexto(l))
      .filter(Boolean);
    // O modelo possui o brasão/logotipo sobre as colunas A-C. O texto real do cabeçalho
    // precisa manter recuo dentro da célula mesclada B1:H1 para não ficar cortado pelo desenho.
    const recuo = ' '.repeat(39);
    return linhas.map(l => recuo + l).join('\n');
  }

  function coletarDados(os, cli, veiculo) {
    const sessao = window.J || {};
    const oficinaStorage = parseJsonSeguro(sessionStorage.getItem('j_oficina'));
    const tenant = mergeCadastro(sessao, oficinaStorage, sessao.oficina || {});
    tenant.tnome = pick(tenant.nomeFantasia, sessao.tnome, tenant.tnome, tenant.nome);
    tenant.nome = pick(tenant.nome, sessao.nome, tenant.tnome, tenant.nomeFantasia);
    const servicos = (os.servicos || []).filter(s => s.desc || s.valor || s.tempo);
    const pecas = (os.pecas || []).filter(p => p.desc || p.descricao || p.codigo || p.cod || p.venda || p.valor);
    const descMO = taxaDesconto(os.descMO != null ? os.descMO : cli.govDescMO);
    const descPeca = taxaDesconto(os.descPeca != null ? os.descPeca : cli.govDescPeca);
    const valorHoraCliente = n(os.valorHoraOS ?? os.govValorHoraOS ?? cli.govValorHora ?? 0);

    const linhasServOriginal = servicos.map((s, index) => {
      const tempo = n(s.tempo || 0);
      const valorBrutoServico = n(s.valor || 0);
      const resolvido = U().resolvePMSPServico ? U().resolvePMSPServico(s, { veiculo, fallbackValorHora: valorHoraCliente }) : {};
      const valorHora = n(s.valorHora || s.valorHoraSecao || resolvido.valorHora || 0) ||
        (tempo > 0 && valorBrutoServico > 0 ? +(valorBrutoServico / tempo).toFixed(2) : 0) ||
        valorHoraCliente;
      const sistemaServico = resolvido.secaoHoraLabel || s.secaoHoraLabel || s.sistemaTabela || s.sistema || '';
      const codigoInterno = codigoInternoServicoTempa(s, resolvido);
      const codigoTabela = codigoTabelaServicoTempa(s, resolvido);
      const codigo = codigoServicoTempa(s, resolvido);
      const tipoVeiculo = extrairTipoVeiculoTempa(s, veiculo);
      const totalFinal = +(valorHora * tempo * (1 - descMO)).toFixed(2);
      return {
        key: 'servico-' + index,
        codigo,
        codigoInterno,
        codigoTabela,
        sistema: limparTexto(sistemaServico),
        tipoVeiculo,
        desc: limparTexto(s.desc || ''),
        tempo,
        valorHora,
        bruto: +(valorHora * tempo).toFixed(2),
        descPct: descMO,
        total: totalFinal,
        relacionadoCilia: !!s.relacionadoCilia,
        ciliaPieceIndex: s.ciliaPieceIndex != null ? String(s.ciliaPieceIndex) : '',
        pecaCodigo: limparTexto(s.pecaCodigo || s.codigoPeca || ''),
        pecaDesc: limparTexto(s.pecaDesc || s.descricaoPeca || '')
      };
    });

    const linhasPecasOriginal = pecas.map((p, index) => {
      const qtd = n(p.qtd || p.q || 1) || 1;
      const valorUnit = n(p.venda || p.valor || p.v);
      const totalFinal = +(qtd * valorUnit * (1 - descPeca)).toFixed(2);
      return {
        key: 'peca-' + index,
        codigo: limparTexto(p.codigo || p.cod || p.codigoOriginal || p.codigoOEM || p.oem || p.partNumber || p.numeroPeca || 'sem oem') || 'sem oem',
        desc: limparTexto(p.desc || p.descricao || ''),
        qtd,
        valorUnit,
        bruto: +(qtd * valorUnit).toFixed(2),
        descPct: descPeca,
        total: totalFinal,
        ciliaPieceIndex: p.ciliaPieceIndex != null ? String(p.ciliaPieceIndex) : ''
      };
    });


    let linhasServ = linhasServOriginal.slice();
    let linhasPecas = linhasPecasOriginal.slice();
    const guincho = guinchoOSExportar(os);
    if (guincho.ativo) {
      linhasServ.push({
        codigo: 'GUINCHO',
        sistema: 'DESLOCAMENTO / GUINCHO',
        tipoVeiculo: guincho.tipoLabel,
        desc: `Deslocamento/guincho — ${guincho.kmTotal.toFixed(2).replace('.', ',')} km total; franquia ${guincho.franquiaKm.toFixed(2).replace('.', ',')} km; excedente ${guincho.kmExcedente.toFixed(2).replace('.', ',')} km; desconto guincho ${guincho.descontoPct.toFixed(1).replace('.', ',')}%${guincho.obs ? ' — ' + guincho.obs : ''}`,
        tempo: 0,
        valorHora: 0,
        bruto: guincho.subtotal,
        descPct: guincho.descontoPct / 100,
        total: guincho.total,
        relacionadoCilia: false,
        ciliaPieceIndex: '',
        pecaCodigo: '',
        pecaDesc: '',
        guincho: true
      });
    }

    const aprovacaoInfo = { ativa: false, aprovados: [], naoAprovados: [], totalOriginal: 0, totalAprovado: 0, totalNaoAprovado: 0 };
    try {
      if (U().hasApproval?.(os) && U().getApprovedKeys && U().buildBudgetItems) {
        const keys = U().getApprovedKeys(os);
        aprovacaoInfo.ativa = true;
        const todos = U().buildBudgetItems(os, cli);
        aprovacaoInfo.aprovados = todos.filter(it => keys.has(it.key));
        aprovacaoInfo.naoAprovados = todos.filter(it => !keys.has(it.key));
        aprovacaoInfo.totalOriginal = +todos.reduce((sum, it) => sum + n(it.valorFinal || 0), 0).toFixed(2);
        aprovacaoInfo.totalAprovado = +(os.totalAprovado != null ? n(os.totalAprovado) : aprovacaoInfo.aprovados.reduce((sum, it) => sum + n(it.valorFinal || 0), 0)).toFixed(2);
        aprovacaoInfo.totalNaoAprovado = +aprovacaoInfo.naoAprovados.reduce((sum, it) => sum + n(it.valorFinal || 0), 0).toFixed(2);
        linhasServ = linhasServOriginal.filter(item => keys.has(item.key));
        linhasPecas = linhasPecasOriginal.filter(item => keys.has(item.key));
      }
    } catch(e) {
      console.warn('[PMSP XLSX] Falha ao aplicar filtro de itens aprovados. Mantendo orçamento completo.', e?.message || e);
      linhasServ = linhasServOriginal;
      linhasPecas = linhasPecasOriginal;
      aprovacaoInfo.ativa = false;
    }


    if (aprovacaoInfo.ativa && guincho.ativo) {
      linhasServ.push({
        codigo: 'GUINCHO',
        sistema: 'DESLOCAMENTO / GUINCHO',
        tipoVeiculo: guincho.tipoLabel,
        desc: `Deslocamento/guincho — ${guincho.kmTotal.toFixed(2).replace('.', ',')} km total; franquia ${guincho.franquiaKm.toFixed(2).replace('.', ',')} km; excedente ${guincho.kmExcedente.toFixed(2).replace('.', ',')} km; desconto guincho ${guincho.descontoPct.toFixed(1).replace('.', ',')}%${guincho.obs ? ' — ' + guincho.obs : ''}`,
        tempo: 0,
        valorHora: 0,
        bruto: guincho.subtotal,
        descPct: guincho.descontoPct / 100,
        total: guincho.total,
        relacionadoCilia: false,
        ciliaPieceIndex: '',
        pecaCodigo: '',
        pecaDesc: '',
        guincho: true
      });
    }

    return { tenant, linhasServ, linhasPecas, linhasServOriginal, linhasPecasOriginal, descMO, descPeca, guincho, aprovacaoInfo }; 
  }


  async function exportarComposicaoExcelJS(os, cli, veiculo) {
    if (typeof ExcelJS === 'undefined') return false;

    const templateUrl = templatePMSPUrl();
    const resp = await fetch(templateUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Modelo PMSP nao encontrado: ' + templateUrl);
    const buffer = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    congelarFormulasCompartilhadasPMSP(wb);
    const ws = wb.worksheets[0];

    const { tenant, linhasServ, linhasPecas, aprovacaoInfo } = coletarDados(os, cli, veiculo);
    const assinaturaExportar = await obterAssinaturaExportar(os, tenant);
    const logoExportar = await obterLogoOficinaExportar(os, tenant);
    const resumoSecoes = resumirSecoes(linhasServ);
    const dc = dadosCliente(cli, os);
    const dv = dadosVeiculo(veiculo, os);
    const dt = dadosTenant(tenant);
    const representante = dt.representante;

    const composicaoRows = contarLinhasComposicaoOS(linhasPecas, linhasServ);
    const kpiFinalRows = contarLinhasKPIFinais(resumoSecoes);
    const aprovacaoRows = contarLinhasAprovacaoExportar(aprovacaoInfo);
    const blocoRows = Math.max(1, composicaoRows + kpiFinalRows + aprovacaoRows);
    limparCorpoTemplateAgrupado(ws, 18, blocoRows);

    const totalGeralRow = 18 + blocoRows;
    const vistoriaRow = totalGeralRow + 1;
    const resumoPecasRow = totalGeralRow + 2;
    const resumoMORow = totalGeralRow + 3;
    const resumoTotalRow = totalGeralRow + 4;
    const contratoRow = totalGeralRow + 5;
    const assinaturaStartRow = contratoRow + 1;
    const assinaturaEndRow = assinaturaStartRow + 5;

    const cabecalho = dc.cabecalho || 'SECRETARIA DA SEGURANCA PUBLICA\nPOLICIA MILITAR DO ESTADO DE SAO PAULO';
    setCell(ws, 'B1', formatarCabecalhoPM(cabecalho));
    ws.getCell('B1').alignment = { ...(ws.getCell('B1').alignment || {}), vertical: 'middle', horizontal: 'left', wrapText: true, shrinkToFit: true };
    setCell(ws, 'A3', `REFERENCIA: ORDEM E EXECUCAO DE SERVICOS No ${oesNumero(cli, os)}`);
    setCell(ws, 'A5', `MARCA: ${dv.marca}`);
    setCell(ws, 'C5', `MODELO: ${dv.modelo}`);
    setCell(ws, 'E5', `ANO: ${dv.ano}`);
    setCell(ws, 'G5', `PLACA: ${dv.placa}`);
    setCell(ws, 'A6', `CHASSIS: ${dv.chassis}`);
    setCell(ws, 'D6', `PATRIMONIO: ${dv.patrimonio}`);
    setCell(ws, 'A7', `KM: ${dv.km}`);
    setCell(ws, 'C7', `PREFIXO: ${dv.prefixo}`);
    setCell(ws, 'E7', `OPM DETENTORA: ${dc.unidade}`);
    setCell(ws, 'A9', `RAZAO SOCIAL : ${dt.razaoSocial}`);
    setCell(ws, 'E9', `CNPJ: ${dt.cnpj}`);
    setCell(ws, 'A10', `ENDERECO: ${dt.endereco}`);
    setCell(ws, 'A11', `TELEFONE: ${dt.telefone}`);
    setCell(ws, 'D11', `ORCAMENTISTA: ${dt.orcamentista}`);
    setCell(ws, 'A12', `REPRESENTANTE LEGAL: ${representante}`);
    setCell(ws, 'A14', `UNIDADE : ${dc.unidade}`);
    setCell(ws, 'E14', `CNPJ: ${dc.doc}`);
    setCell(ws, 'A15', `ENDERECO: ${dc.endereco}`);
    setCell(ws, 'A17', `FISCAL DO CONTRATO: ${dc.fiscal}`);
    aplicarAjustesCabecalho(ws);
    await inserirLogoOficinaExcelJS(wb, ws, logoExportar);

    inserirComposicaoOS(ws, 18, linhasPecas, linhasServ);
    inserirKPIsFinaisOS(ws, 18 + composicaoRows, linhasPecas, linhasServ, resumoSecoes);
    inserirResumoAprovacaoExportar(ws, 18 + composicaoRows + kpiFinalRows, aprovacaoInfo);

    const totalPecas = linhasPecas.reduce((sum, p) => sum + p.total, 0);
    const totalMO = linhasServ.reduce((sum, item) => sum + item.total, 0);
    const contrato = +(totalPecas + totalMO).toFixed(2);
    prepararRodape(ws, [totalGeralRow, vistoriaRow, resumoPecasRow, resumoMORow, resumoTotalRow, contratoRow]);
    linhaResumoValor(ws, totalGeralRow, 'TOTAL GERAL', 0, { blankValue: true });
    linhaResumoValor(ws, vistoriaRow, 'VALOR DA VISTORIA TECNICA COMPLEMENTAR AO ESCOPO DE SERVICOS', 0, { blankValue: true });
    linhaResumoValor(ws, resumoPecasRow, 'VALOR TOTAL DE PECAS', totalPecas);
    linhaResumoValor(ws, resumoMORow, 'VALOR TOTAL DE MAO DE OBRA', totalMO);
    linhaResumoValor(ws, resumoTotalRow, aprovacaoInfo?.ativa ? 'TOTAL APROVADO' : 'TOTAL GERAL', contrato);
    linhaResumoValor(ws, contratoRow, aprovacaoInfo?.ativa ? 'VALOR APROVADO / CONTRATO' : 'VALOR DO CONTRATO', contrato, { contrato: true });
    await inserirAssinaturaFinalAgrupadaExcelJS(wb, ws, assinaturaExportar, assinaturaStartRow);
    limparLinhasAbaixoExportar(ws, assinaturaEndRow);

    ws.pageSetup = {
      ...ws.pageSetup,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printArea: `A1:H${assinaturaEndRow}`
    };

    const fname = `${(dv.prefixo || String(os.id || '').slice(-6).toUpperCase() || 'OS')}_ITENS_AGRUPADOS.xlsx`;
    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await salvarArquivoBlobExportar(blob, fname);
    window.toast?.(`Itens agrupados PMSP exportados: ${fname}`, 'ok');
    return true;
  }

  async function exportarComExcelJS(os, cli, veiculo) {
    if (typeof ExcelJS === 'undefined') return false;

    const templateUrl = templatePMSPUrl();
    const resp = await fetch(templateUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Modelo PMSP nao encontrado: ' + templateUrl);
    const buffer = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    congelarFormulasCompartilhadasPMSP(wb);
    const ws = wb.worksheets[0];

    const { tenant, linhasServ, linhasPecas, aprovacaoInfo } = coletarDados(os, cli, veiculo);
    const assinaturaExportar = await obterAssinaturaExportar(os, tenant);
    const logoExportar = await obterLogoOficinaExportar(os, tenant);
    const resumoSecoes = resumirSecoes(linhasServ);
    const dc = dadosCliente(cli, os);
    const dv = dadosVeiculo(veiculo, os);
    const dt = dadosTenant(tenant);

    const servRowsWanted = Math.max(linhasServ.length + 3, 4);
    const servExtra = Math.max(0, servRowsWanted - SERV_CAPACITY);
    inserirLinhasExtras(ws, SERV_TOTAL, SERV_END, servExtra);
    const servEnd = SERV_END + servExtra;
    const servTotal = SERV_TOTAL + servExtra;
    const resumoSecoesRows = resumoSecoes.length ? resumoSecoes.length + 2 : 0;
    if (resumoSecoesRows) {
      ws.spliceRows(servTotal + 1, 0, ...Array.from({ length: resumoSecoesRows }, () => []));
    }
    const pecaShift = servExtra + resumoSecoesRows;
    const pecaStart = PECA_START + pecaShift;
    const pecaEndBase = PECA_END + pecaShift;
    const pecaTotalBase = PECA_TOTAL + pecaShift;

    const pecaRowsWanted = Math.max(linhasPecas.length + 3, 4);
    const pecaExtra = Math.max(0, pecaRowsWanted - PECA_CAPACITY);
    inserirLinhasExtras(ws, pecaTotalBase, pecaEndBase, pecaExtra);
    const pecaEnd = pecaEndBase + pecaExtra;
    const pecaTotal = pecaTotalBase + pecaExtra;
    const composicaoRows = contarLinhasComposicaoOS(linhasPecas, linhasServ);
    const kpiFinalRows = contarLinhasKPIFinais(resumoSecoes);
    const aprovacaoRows = contarLinhasAprovacaoExportar(aprovacaoInfo);
    const extraFinalOS = composicaoRows + kpiFinalRows + aprovacaoRows;
    if (extraFinalOS) {
      ws.spliceRows(pecaTotal + 1, 0, ...Array.from({ length: extraFinalOS }, () => []));
    }
    const totalGeralRow = pecaTotal + 1 + extraFinalOS;
    const vistoriaRow = pecaTotal + 2 + extraFinalOS;
    const resumoPecasRow = pecaTotal + 3 + extraFinalOS;
    const resumoMORow = pecaTotal + 4 + extraFinalOS;
    const resumoTotalRow = pecaTotal + 5 + extraFinalOS;
    const contratoRow = pecaTotal + 6 + extraFinalOS;
    const dataRow = pecaTotal + 7 + extraFinalOS;
    const representanteRow = pecaTotal + 11 + extraFinalOS;

    const cabecalho = dc.cabecalho || 'SECRETARIA DA SEGURANCA PUBLICA\nPOLICIA MILITAR DO ESTADO DE SAO PAULO';
    const representante = dt.representante;
    setCell(ws, 'B1', formatarCabecalhoPM(cabecalho));
    ws.getCell('B1').alignment = { ...(ws.getCell('B1').alignment || {}), vertical: 'middle', horizontal: 'left', wrapText: true, shrinkToFit: true };
    setCell(ws, 'A3', `REFERENCIA: ORDEM E EXECUCAO DE SERVICOS No ${oesNumero(cli, os)}`);
    setCell(ws, 'A5', `MARCA: ${dv.marca}`);
    setCell(ws, 'C5', `MODELO: ${dv.modelo}`);
    setCell(ws, 'E5', `ANO: ${dv.ano}`);
    setCell(ws, 'G5', `PLACA: ${dv.placa}`);
    setCell(ws, 'A6', `CHASSIS: ${dv.chassis}`);
    setCell(ws, 'D6', `PATRIMONIO: ${dv.patrimonio}`);
    setCell(ws, 'A7', `KM: ${dv.km}`);
    setCell(ws, 'C7', `PREFIXO: ${dv.prefixo}`);
    setCell(ws, 'E7', `OPM DETENTORA: ${dc.unidade}`);
    setCell(ws, 'A9', `RAZAO SOCIAL : ${dt.razaoSocial}`);
    setCell(ws, 'E9', `CNPJ: ${dt.cnpj}`);
    setCell(ws, 'A10', `ENDERECO: ${dt.endereco}`);
    setCell(ws, 'A11', `TELEFONE: ${dt.telefone}`);
    setCell(ws, 'D11', `ORCAMENTISTA: ${dt.orcamentista}`);
    setCell(ws, 'A12', `REPRESENTANTE LEGAL: ${representante}`);
    setCell(ws, 'A14', `UNIDADE : ${dc.unidade}`);
    setCell(ws, 'E14', `CNPJ: ${dc.doc}`);
    setCell(ws, 'A15', `ENDERECO: ${dc.endereco}`);
    setCell(ws, 'A17', `FISCAL DO CONTRATO: ${dc.fiscal}`);
    aplicarAjustesCabecalho(ws);
    await inserirLogoOficinaExcelJS(wb, ws, logoExportar);
    setCell(ws, 'B18', 'CÓD. SERVIÇO / SISTEMA / TIPO VEÍCULO');
    setCell(ws, 'D18', 'DESCRIÇÃO DO SERVIÇO');

    prepararLinhasDados(ws, SERV_START, servEnd, linhasServ.length);
    linhasServ.forEach((s, idx) => {
      const r = SERV_START + idx;
      ws.getRow(r).hidden = false;
      setCell(ws, 'B' + r, textoSistemaServico(s));
      setCell(ws, 'D' + r, s.desc);
      ws.getRow(r).height = Math.max(ws.getRow(r).height || 18, (s.codigo || s.tipoVeiculo) ? 36 : 18);
      ws.getCell('B' + r).alignment = { ...(ws.getCell('B' + r).alignment || {}), wrapText: true, shrinkToFit: true, vertical: 'middle' };
      ws.getCell('D' + r).alignment = { ...(ws.getCell('D' + r).alignment || {}), wrapText: true, shrinkToFit: true, vertical: 'middle' };
      setCell(ws, 'E' + r, s.tempo);
      setMoneyCell(ws, 'F' + r, s.valorHora);
      setPercentCell(ws, 'G' + r, s.descPct);
      setMoneyCell(ws, 'H' + r, s.total);
    });

    prepararLinhasDados(ws, pecaStart, pecaEnd, linhasPecas.length);
    linhasPecas.forEach((p, idx) => {
      const r = pecaStart + idx;
      ws.getRow(r).hidden = false;
      setCell(ws, 'B' + r, p.codigo);
      setCell(ws, 'D' + r, p.desc);
      setCell(ws, 'E' + r, p.qtd);
      setMoneyCell(ws, 'F' + r, p.valorUnit);
      setPercentCell(ws, 'G' + r, p.descPct);
      setMoneyCell(ws, 'H' + r, p.total);
    });

    const totalPecas = linhasPecas.reduce((sum, p) => sum + p.total, 0);
    const totalMO = linhasServ.reduce((sum, s) => sum + s.total, 0);
    const totalHoras = linhasServ.reduce((sum, s) => sum + s.tempo, 0);
    const contrato = +(totalPecas + totalMO).toFixed(2);
    prepararRodape(ws, [
      servTotal,
      pecaTotal,
      totalGeralRow,
      vistoriaRow,
      resumoPecasRow,
      resumoMORow,
      resumoTotalRow,
      contratoRow,
      dataRow,
      representanteRow
    ]);
    linhaTotalServicos(ws, servTotal, totalHoras, totalMO);
    inserirResumoSecoes(ws, servTotal + 1, resumoSecoes);
    linhaTotalPecas(ws, pecaTotal, totalPecas);
    inserirComposicaoOS(ws, pecaTotal + 1, linhasPecas, linhasServ);
    inserirKPIsFinaisOS(ws, pecaTotal + 1 + composicaoRows, linhasPecas, linhasServ, resumoSecoes);
    inserirResumoAprovacaoExportar(ws, pecaTotal + 1 + composicaoRows + kpiFinalRows, aprovacaoInfo);
    linhaResumoValor(ws, totalGeralRow, 'TOTAL GERAL', 0, { blankValue: true });
    linhaResumoValor(ws, vistoriaRow, 'VALOR DA VISTORIA TECNICA COMPLEMENTAR AO ESCOPO DE SERVICOS', 0, { blankValue: true });
    linhaResumoValor(ws, resumoPecasRow, 'VALOR TOTAL DE PECAS', totalPecas);
    linhaResumoValor(ws, resumoMORow, 'VALOR TOTAL DE MAO DE OBRA', totalMO);
    linhaResumoValor(ws, resumoTotalRow, aprovacaoInfo?.ativa ? 'TOTAL APROVADO' : 'TOTAL GERAL', contrato);
    linhaResumoValor(ws, contratoRow, aprovacaoInfo?.ativa ? 'VALOR APROVADO / CONTRATO' : 'VALOR DO CONTRATO', contrato, { contrato: true });
    setCell(ws, 'A' + dataRow, dataExtenso(dt.cidade || dc.cidade));
    setCell(ws, 'A' + representanteRow, String(representante).toUpperCase());
    // A assinatura da própria O.S. já foi priorizada em obterAssinaturaExportar().
    // Não cria bloco extra nem insere linhas novas para não deslocar cabeçalho, rodapé, merges ou área de impressão.
    await inserirAssinaturaExcelJS(wb, ws, assinaturaExportar, representanteRow);

    ws.pageSetup = {
      ...ws.pageSetup,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printArea: `A1:H${representanteRow + 3}`
    };

    const fname = `${(dv.prefixo || String(os.id || '').slice(-6).toUpperCase() || 'OS')}_PLANILHA_DE_CUSTOS.xlsx`;
    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await salvarArquivoBlobExportar(blob, fname);
    window.toast?.(`Orcamento PMSP exportado: ${fname}`, 'ok');
    return true;
  }

  async function exportarFallbackSheetJS(os, cli, veiculo) {
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca XLSX nao carregou.');
    const { tenant, linhasServ, linhasPecas, aprovacaoInfo } = coletarDados(os, cli, veiculo);
    const resumoSecoes = resumirSecoes(linhasServ);
    const dc = dadosCliente(cli, os);
    const dv = dadosVeiculo(veiculo, os);
    const dt = dadosTenant(tenant);
    const rows = [
      [dc.cabecalho || 'SECRETARIA DA SEGURANCA PUBLICA POLICIA MILITAR DO ESTADO DE SAO PAULO'],
      ['PLANILHA DE COMPOSICAO DE CUSTOS'],
      [`REFERENCIA: ORDEM E EXECUCAO DE SERVICOS No ${oesNumero(cli, os)}`],
      ['DADOS DA VIATURA'],
      [`MARCA: ${dv.marca}`, `MODELO: ${dv.modelo}`, `ANO: ${dv.ano}`, `PLACA: ${dv.placa}`],
      [`CHASSIS: ${dv.chassis}`, `PATRIMONIO: ${dv.patrimonio}`],
      [`KM: ${dv.km}`, `PREFIXO: ${dv.prefixo}`, `OPM DETENTORA: ${dc.unidade}`],
      ['DADOS DA EMPRESA'],
      [`RAZAO SOCIAL: ${dt.razaoSocial}`, `CNPJ: ${dt.cnpj}`],
      [`ENDERECO: ${dt.endereco}`],
      [`TELEFONE: ${dt.telefone}`, `ORCAMENTISTA: ${dt.orcamentista}`],
      [`LOGOTIPO/TIMBRADO: ${dt.logoUrl || 'nao cadastrado'}`],
      [`REPRESENTANTE LEGAL: ${dt.representante}`],
      ['DADOS DO CLIENTE'],
      [`UNIDADE: ${dc.unidade}`, `CNPJ: ${dc.doc}`],
      [`ENDERECO: ${dc.endereco}`],
      [`FISCAL DO CONTRATO: ${dc.fiscal}`],
      [],
      ['COD. SERVICO / SISTEMA / TIPO VEICULO','DESCRICAO DO SERVICO','TMO','VALOR','DESC.','VALOR']
    ];
    linhasServ.forEach(s => rows.push([textoSistemaServico(s), s.desc, s.tempo, s.valorHora, s.descPct, s.total]));
    rows.push(['TOTAL DE SERVICOS', '', linhasServ.reduce((sum, s) => sum + s.tempo, 0), '', '', linhasServ.reduce((sum, s) => sum + s.total, 0)]);
    if (resumoSecoes.length) {
      rows.push([]);
      rows.push(['RESUMO POR TIPO / SECAO DO SERVICO DA O.S.', '', '', '', 'HORAS', 'VALOR']);
      resumoSecoes.forEach(([secao, item]) => rows.push([textoResumoSecao(secao, item), '', '', '', item.horas, item.total]));
    }
    rows.push([]);
    rows.push(['CODIGO DA PECA (CODIGO ORIGINAL)','DESCRICAO','QTD','VALOR UNITARIO REGISTRADO','DESC','VALOR']);
    linhasPecas.forEach(p => rows.push([p.codigo, p.desc, p.qtd, p.valorUnit, p.descPct, p.total]));
    rows.push(['TOTAL DE PECAS', '', '', '', '', linhasPecas.reduce((sum, p) => sum + p.total, 0)]);

    const composicao = agruparComposicaoOS(linhasPecas, linhasServ);
    rows.push([]);
    rows.push(['COMPOSICAO DA O.S. POR PECA E SERVICO VINCULADO']);
    rows.push(['ITEM / CODIGO','DESCRICAO','QTD/H','UNIT./R$/H','DESC.','TOTAL']);
    composicao.grupos.forEach(g => {
      const p = g.peca;
      rows.push([textoItemPeca(p), p.desc, p.qtd, p.valorUnit, p.descPct, p.total]);
      g.servicos.forEach(s => rows.push([textoItemServico(s), s.desc, s.tempo, s.valorHora, s.descPct, s.total]));
    });
    if (composicao.soltos.length) {
      rows.push(['SERVICOS GERAIS / SEM PECA VINCULADA']);
      composicao.soltos.forEach(s => rows.push([textoItemServico(s), s.desc, s.tempo, s.valorHora, s.descPct, s.total]));
    }

    const brutoPecas = linhasPecas.reduce((sum, p) => sum + n(p.bruto || 0), 0);
    const liquidoPecas = linhasPecas.reduce((sum, p) => sum + n(p.total || 0), 0);
    const brutoMO = linhasServ.reduce((sum, s) => sum + n(s.bruto || 0), 0);
    const liquidoMO = linhasServ.reduce((sum, s) => sum + n(s.total || 0), 0);
    const horasMO = linhasServ.reduce((sum, s) => sum + n(s.tempo || 0), 0);
    const total = +(liquidoPecas + liquidoMO).toFixed(2);
    rows.push([]);
    rows.push(['KPIs FINAIS DA O.S.']);
    rows.push(['QTDE / VALOR BRUTO DE PECAS', `${linhasPecas.length} peca(s)`, '', '', '', brutoPecas]);
    rows.push(['DESCONTO TOTAL EM PECAS', '', '', '', '', +(brutoPecas - liquidoPecas).toFixed(2)]);
    rows.push(['VALOR LIQUIDO DE PECAS', '', '', '', '', liquidoPecas]);
    rows.push(['QTDE / VALOR BRUTO DE SERVICOS', `${linhasServ.length} servico(s) · ${horasMO.toFixed(2).replace('.', ',')} h`, '', '', '', brutoMO]);
    rows.push(['DESCONTO TOTAL EM MAO DE OBRA', '', '', '', '', +(brutoMO - liquidoMO).toFixed(2)]);
    rows.push(['VALOR LIQUIDO DE MAO DE OBRA', '', '', '', '', liquidoMO]);
    rows.push(['TOTAL BRUTO DA O.S.', '', '', '', '', +(brutoPecas + brutoMO).toFixed(2)]);
    rows.push(['DESCONTO TOTAL DA O.S.', '', '', '', '', +((brutoPecas + brutoMO) - total).toFixed(2)]);
    rows.push(['TOTAL LIQUIDO / CONTRATO', '', '', '', '', total]);
    rows.push(['TOTAL DE HORAS DE MAO DE OBRA', `${horasMO.toFixed(2).replace('.', ',')} h`, '', '', '', 0]);
    rows.push(['TOTAL DE ITENS NA O.S.', `${linhasPecas.length} peca(s) + ${linhasServ.length} servico(s)`, '', '', '', total]);
    if (resumoSecoes.length) {
      rows.push([]);
      rows.push(['RESUMO FINAL POR TIPO / SECAO DO SERVICO', '', '', '', 'HORAS', 'VALOR']);
      resumoSecoes.forEach(([secao, item]) => rows.push([textoResumoSecao(secao, item), '', '', '', item.horas, item.total]));
    }
    if (aprovacaoInfo?.naoAprovados?.length) {
      rows.push([]);
      rows.push(['ITENS NAO APROVADOS - HISTORICO DO ORCAMENTO ORIGINAL']);
      rows.push(['TIPO / CODIGO','DESCRICAO','QTD/H','UNIT./R$/H','DESC.','TOTAL ORIGINAL']);
      aprovacaoInfo.naoAprovados.forEach(it => rows.push([it.labelTipo || it.tipo, it.desc || '-', it.tipo === 'peca' ? (it.qtd || 1) : (it.tempo || 0), it.valorUnit || it.valorHora || 0, 'NAO APROVADO', it.valorFinal || 0]));
    }
    rows.push([aprovacaoInfo?.ativa ? 'VALOR APROVADO / CONTRATO' : 'VALOR DO CONTRATO', '', '', '', '', total]);
    rows.push([dataExtenso(dt.cidade || dc.cidade)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan1');
    const fname = `${(dv.prefixo || String(os.id || '').slice(-6).toUpperCase() || 'OS')}_PLANILHA_DE_CUSTOS.xlsx`;
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await salvarArquivoBlobExportar(blob, fname);
    window.toast?.('ExcelJS nao carregou; exportado em modo compatibilidade.', 'warn');
  }


  async function exportarComposicaoFallbackSheetJS(os, cli, veiculo) {
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca XLSX nao carregou.');
    const { tenant, linhasServ, linhasPecas, aprovacaoInfo } = coletarDados(os, cli, veiculo);
    const resumoSecoes = resumirSecoes(linhasServ);
    const dc = dadosCliente(cli, os);
    const dv = dadosVeiculo(veiculo, os);
    const dt = dadosTenant(tenant);
    const rows = [
      [dc.cabecalho || 'SECRETARIA DA SEGURANCA PUBLICA POLICIA MILITAR DO ESTADO DE SAO PAULO'],
      ['PLANILHA DE COMPOSICAO DE CUSTOS'],
      [`REFERENCIA: ORDEM E EXECUCAO DE SERVICOS No ${oesNumero(cli, os)}`],
      ['DADOS DA VIATURA'],
      [`MARCA: ${dv.marca}`, `MODELO: ${dv.modelo}`, `ANO: ${dv.ano}`, `PLACA: ${dv.placa}`],
      [`CHASSIS: ${dv.chassis}`, `PATRIMONIO: ${dv.patrimonio}`],
      [`KM: ${dv.km}`, `PREFIXO: ${dv.prefixo}`, `OPM DETENTORA: ${dc.unidade}`],
      ['DADOS DA EMPRESA'],
      [`RAZAO SOCIAL: ${dt.razaoSocial}`, `CNPJ: ${dt.cnpj}`],
      [`ENDERECO: ${dt.endereco}`],
      [`TELEFONE: ${dt.telefone}`, `ORCAMENTISTA: ${dt.orcamentista}`],
      [`REPRESENTANTE LEGAL: ${dt.representante}`],
      ['DADOS DO CLIENTE'],
      [`UNIDADE: ${dc.unidade}`, `CNPJ: ${dc.doc}`],
      [`ENDERECO: ${dc.endereco}`],
      [`FISCAL DO CONTRATO: ${dc.fiscal}`],
      [],
      ['COMPOSICAO DA O.S. POR PECA E SERVICO VINCULADO'],
      ['ITEM / CODIGO','DESCRICAO','QTD/H','UNIT./R$/H','DESC.','TOTAL']
    ];
    const composicao = agruparComposicaoOS(linhasPecas, linhasServ);
    composicao.grupos.forEach(g => {
      const p = g.peca;
      rows.push([textoItemPeca(p), p.desc, p.qtd, p.valorUnit, p.descPct, p.total]);
      g.servicos.forEach(item => rows.push([textoItemServico(item), item.desc, item.tempo, item.valorHora, item.descPct, item.total]));
    });
    if (composicao.soltos.length) {
      rows.push(['SERVICOS GERAIS / SEM PECA VINCULADA']);
      composicao.soltos.forEach(item => rows.push([textoItemServico(item), item.desc, item.tempo, item.valorHora, item.descPct, item.total]));
    }
    const brutoPecas = linhasPecas.reduce((sum, p) => sum + n(p.bruto || 0), 0);
    const liquidoPecas = linhasPecas.reduce((sum, p) => sum + n(p.total || 0), 0);
    const brutoMO = linhasServ.reduce((sum, item) => sum + n(item.bruto || 0), 0);
    const liquidoMO = linhasServ.reduce((sum, item) => sum + n(item.total || 0), 0);
    const horasMO = linhasServ.reduce((sum, item) => sum + n(item.tempo || 0), 0);
    const total = +(liquidoPecas + liquidoMO).toFixed(2);
    rows.push([]);
    rows.push(['KPIs FINAIS DA O.S.']);
    rows.push(['QTDE / VALOR BRUTO DE PECAS', `${linhasPecas.length} peca(s)`, '', '', '', brutoPecas]);
    rows.push(['VALOR LIQUIDO DE PECAS', '', '', '', '', liquidoPecas]);
    rows.push(['QTDE / VALOR BRUTO DE SERVICOS', `${linhasServ.length} servico(s) - ${horasMO.toFixed(2).replace('.', ',')} h`, '', '', '', brutoMO]);
    rows.push(['VALOR LIQUIDO DE MAO DE OBRA', '', '', '', '', liquidoMO]);
    rows.push(['TOTAL LIQUIDO / CONTRATO', '', '', '', '', total]);
    rows.push(['TOTAL DE HORAS DE MAO DE OBRA', `${horasMO.toFixed(2).replace('.', ',')} h`, '', '', '', 0]);
    rows.push(['TOTAL DE ITENS NA O.S.', `${linhasPecas.length} peca(s) + ${linhasServ.length} servico(s)`, '', '', '', total]);
    if (resumoSecoes.length) {
      rows.push([]);
      rows.push(['RESUMO FINAL POR TIPO / SECAO DO SERVICO', '', '', '', 'HORAS', 'VALOR']);
      resumoSecoes.forEach(([secao, item]) => rows.push([textoResumoSecao(secao, item), '', '', '', item.horas, item.total]));
    }
    if (aprovacaoInfo?.naoAprovados?.length) {
      rows.push([]);
      rows.push(['ITENS NAO APROVADOS - HISTORICO DO ORCAMENTO ORIGINAL']);
      rows.push(['TIPO / CODIGO','DESCRICAO','QTD/H','UNIT./R$/H','DESC.','TOTAL ORIGINAL']);
      aprovacaoInfo.naoAprovados.forEach(it => rows.push([it.labelTipo || it.tipo, it.desc || '-', it.tipo === 'peca' ? (it.qtd || 1) : (it.tempo || 0), it.valorUnit || it.valorHora || 0, 'NAO APROVADO', it.valorFinal || 0]));
    }
    rows.push([aprovacaoInfo?.ativa ? 'VALOR APROVADO / CONTRATO' : 'VALOR DO CONTRATO', '', '', '', '', total]);
    rows.push([dataExtenso(dt.cidade || dc.cidade)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan1');
    const fname = `${(dv.prefixo || String(os.id || '').slice(-6).toUpperCase() || 'OS')}_ITENS_AGRUPADOS.xlsx`;
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await salvarArquivoBlobExportar(blob, fname);
    window.toast?.('Itens agrupados exportados em planilha propria, sem usar formulas do template PMSP.', 'ok');
  }

  async function exportarOrcamentoPMSPModo(modo) {
    try {
      const osId = document.getElementById('osId')?.value;
      if (!osId) { window.toast?.('Salve a O.S. antes de exportar.', 'warn'); return; }

      const os = (window.J?.os || []).find(o => o.id === osId);
      if (!os) { window.toast?.('O.S. nao encontrada.', 'err'); return; }

      const cli = (window.J?.clientes || []).find(c => c.id === os.clienteId);
      if (!cli || cli.tipoCliente !== 'governo') {
        window.toast?.('Esta exportacao e exclusiva para clientes governamentais.', 'err');
        return;
      }

      const veiculo = (window.J?.veiculos || []).find(v => v.id === os.veiculoId) || {};
      if (modo === 'itens_agrupados') {
        const ok = await exportarComposicaoExcelJS(os, cli, veiculo);
        if (!ok) throw new Error('Biblioteca ExcelJS nao carregou. A planilha agrupada oficial precisa do template PMSP.');
      } else {
        const ok = await exportarComExcelJS(os, cli, veiculo);
        if (!ok) await exportarFallbackSheetJS(os, cli, veiculo);
      }
    } catch (e) {
      console.error('[PMSP XLSX]', e);
      window.toast?.('Erro ao exportar PMSP: ' + e.message, 'err');
    }
  }

  window.exportarOrcamentoPMSP = async function() {
    return exportarOrcamentoPMSPModo('completo');
  };

  window.exportarOrcamentoPMSPItens = async function() {
    return exportarOrcamentoPMSPModo('itens_agrupados');
  };


})();
