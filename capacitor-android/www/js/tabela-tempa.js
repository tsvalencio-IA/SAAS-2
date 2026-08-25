/**
 * thIAguinho ERP — Tabela Tempária SINDIREPA-SP
 *
 * Carrega o JSON completo e fornece busca rápida.
 * Indexação em memória para pesquisa instantânea.
 *
 * APIs públicas:
 *   - window.tempaCarregar()       → baixa JSON do GitHub Pages
 *   - window.tempaPesquisar()      → executa busca da UI (Jarvis tela)
 *   - window.tempaBuscarPorTexto() → API programática usada pela IA e pela O.S.
 *   - window.tempaSugerirTempo()   → adiciona tempo da Tabela à OS aberta
 *
 * Powered by thIAguinho Soluções Digitais
 */
(function() {
  'use strict';

  // Estado global do módulo
  const TT = {
    carregada: false,
    carregando: false,
    dados: null,         // { _metadata, sistemas, itens }
    indice: null,        // índice geral preservado para todos os fluxos existentes
    indiceCategorias: null, // índices opcionais COMPACTO/HATCH/SUV/UTILITARIO para Cília/O.S.
    erro: null
  };
  window._tabelaTempa = TT;

  // ───────────────────────────────────────────────────────────────
  // CARREGAMENTO LAZY (só baixa quando o gestor abre a aba)
  // ───────────────────────────────────────────────────────────────
  window.tempaCarregar = async function() {
    if (TT.carregada || TT.carregando) return TT.dados;
    TT.carregando = true;
    try {
      // Tenta primeiro a versão minificada (mais rápida)
      const resp = await fetch('data/tabela-tempa.min.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      TT.dados = await resp.json();
      TT.carregada = true;
      _construirIndice(TT.dados.itens);
      console.log('[TabelaTempa] Carregada:', TT.dados._metadata.totalItens, 'itens');
      return TT.dados;
    } catch (e) {
      TT.erro = e.message;
      console.error('[TabelaTempa] Falha ao carregar:', e);
      throw e;
    } finally {
      TT.carregando = false;
    }
  };

  function _categoriaTempaSistema(sistema) {
    const n = _norm(sistema || '');
    if (/\bcompacto\b/.test(n)) return 'compacto';
    if (/\bhatch\b/.test(n)) return 'hatch';
    if (/\bsuv\b/.test(n)) return 'suv';
    if (/\butilitario\b/.test(n)) return 'utilitario';
    return '';
  }

  function _construirIndice(itens) {
    // Índice geral permanece exatamente disponível para os fluxos existentes.
    // Além dele, montamos quatro subconjuntos leves para a associação Cília → Tempária.
    // Caminhão/ônibus/sedan etc. NÃO entram nesses subconjuntos.
    TT.indiceCategorias = { compacto: [], hatch: [], suv: [], utilitario: [] };
    TT.indice = itens.map(it => {
      const entry = {
        ref: it,
        busca: _norm(it.sistema) + ' ' + _norm(it.operacao) + ' ' + _norm(it.item) + ' ' + _norm(it.codigoInterno) + ' ' + it.codigo
      };
      const categoria = _categoriaTempaSistema(it.sistema);
      if (categoria && TT.indiceCategorias[categoria]) TT.indiceCategorias[categoria].push(entry);
      return entry;
    });
  }

  function _indiceParaBusca(opts) {
    const categoria = _norm(opts?.categoriaTempa || '');
    if (categoria && TT.indiceCategorias?.[categoria]) return TT.indiceCategorias[categoria];
    return TT.indice || [];
  }

  function _norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[^a-z0-9 ]/g, ' ')        // remove pontuação
      .replace(/\s+/g, ' ')
      .trim();
  }

  const TEMPA_SINONIMOS = {
    coxim: ['calco', 'suporte', 'apoio'],
    calco: ['coxim', 'suporte', 'apoio'],
    suporte: ['coxim', 'calco', 'apoio'],
    cubo: ['rolamento', 'manga eixo'],
    // Equivalências de nomenclatura de oficina/Cília confirmadas pelo gestor.
    bandeja: ['braco oscilante', 'balanca'],
    balanca: ['bandeja', 'braco oscilante'],
    bieleta: ['haste', 'haste suspensao', 'suporte barra tensora', 'tirante', 'liame', 'barra estabilizadora'],
    haste: ['bieleta'],
    bucha: ['coxinha'],
    coxinha: ['bucha'],
    terminal: ['ponteira'],
    ponteira: ['terminal'],
    articulador: ['terminal axial', 'barra axial', 'articulacao setor'],
    bateria: ['acumulador'],
    oleo: ['lubrificante'],
    filtro: ['elemento filtrante'],
    amortecedor: ['amortecedores'],
    pastilha: ['pastilhas'],
    disco: ['discos'],
    freio: ['freios'],
    farol: ['lanterna', 'lente'],
    parachoque: ['para choque'],
    homocinetica: ['semi eixo', 'semieixo', 'junta homocinetica'],
    semieixo: ['semi eixo', 'homocinetica'],
    radiador: ['arrefecimento'],
    bomba: ['conjunto bomba'],
    combustivel: ['alimentacao'],
    limpador: ['palheta'],
    palheta: ['limpador']
  };

  function _tempaAlternativasToken(token) {
    const t = _norm(token);
    const out = new Set([t]);
    (TEMPA_SINONIMOS[t] || []).forEach(x => out.add(_norm(x)));
    Object.entries(TEMPA_SINONIMOS).forEach(([k, vals]) => {
      if ((vals || []).map(_norm).includes(t)) out.add(_norm(k));
    });
    return Array.from(out).filter(Boolean);
  }

  function _preferenciasSistemaVeiculo(veiculo) {
    const txt = _norm([
      veiculo?.tipo,
      veiculo?.marca,
      veiculo?.modelo,
      veiculo?.combustivel,
      veiculo?.obs
    ].filter(Boolean).join(' '));
    if (/\b(onibus|microonibus|caminhao|caminhoes|truck|carreta)\b/.test(txt)) return ['caminhao', 'onibus', 'microonibus'];
    if (/\b(suv|duster|tracker|renegade|compass|ecosport|hr v|hrv|t cross|tcross|nivus)\b/.test(txt)) return ['suv'];
    if (/\b(utilitario|saveiro|strada|fiorino|montana|oro ch|oroch|kangoo|doblo|van)\b/.test(txt)) return ['utilitario'];
    if (/\b(sedan|voyage|virtus|prisma|cobalt|corolla|civic|versa|logan|city)\b/.test(txt)) return ['sedan', 'hatch', 'compacto'];
    if (/\b(gol|up|mobi|kwid|uno|ka|celta|clio|fox|march|hb20|argo|onix|polo|sandero)\b/.test(txt)) return ['compacto', 'hatch', 'automovel'];
    return ['compacto', 'hatch', 'sedan', 'automovel'];
  }


  // Busca precisa para a O.S./Cília.
  // A regra aqui é: quem manda é o texto digitado pelo gestor.
  // Preferência de tipo de veículo só ordena; nunca pode trazer item que não contenha a peça/serviço digitado.
  function _tempaPrepararConsultaPrecisa(texto) {
    let frase = _norm(texto)
      .replace(/\bsemi\s*eixo\b/g, 'semi eixo')
      .replace(/\bsemieixo\b/g, 'semi eixo')
      .replace(/\bhomocinetica\b/g, 'homocinetica')
      .trim();

    const stop = new Set(['servico','servicos','serviço','serviços','de','da','do','das','dos','em','para','com','sem','uma','um','e','a','o','os','as','no','na']);
    const operacoes = new Set(['troca','trocar','substituir','substituicao','substituição','reparar','reparo','recondicionar','recondicionamento','retificar','retifica','regular','ajustar','instalar','remover','retirar','teste','testar','limpar','limpeza','pintar','pintura','montar','desmontar']);
    const posicoes = new Set(['diant','dianteiro','dianteira','tras','traseiro','traseira','dir','direito','direita','esq','esquerdo','esquerda','ld','le','lado','lateral','cada','int','ext','interno','externo']);
    const classesVeiculo = new Set(['veiculo','veículo','automovel','automóvel','carro','compacto','hatch','sedan','suv','utilitario','utilitário','caminhao','caminhão','onibus','ônibus','microonibus','microônibus']);

    let tokens = frase.split(' ').filter(t => t && t.length >= 2 && !stop.has(t));
    // Expansões obrigatórias de termos compostos que aparecem no Cília e na tabela em grafias diferentes.
    const expandidos = [];
    for (const t of tokens) {
      if (t === 'semieixo') expandidos.push('semi', 'eixo');
      else if (t === 'semi-eixo') expandidos.push('semi', 'eixo');
      else expandidos.push(t);
    }
    tokens = [...new Set(expandidos)];

    let obrigatorios = tokens.filter(t => t.length >= 3 && !operacoes.has(t) && !posicoes.has(t) && !classesVeiculo.has(t));
    const auxiliares = tokens.filter(t => !obrigatorios.includes(t));

    // Se o usuário digitou só classe do veículo ou só posição, respeita o termo digitado.
    if (!obrigatorios.length) obrigatorios = tokens.filter(t => t.length >= 3);

    return { frase, obrigatorios: [...new Set(obrigatorios)], auxiliares: [...new Set(auxiliares)], tokens };
  }

  function _tempaTokenExiste(textoNorm, token) {
    if (!token) return true;
    if (textoNorm.includes(token)) return true;
    // singular/plural simples: pastilha ⇄ pastilhas, reparo ⇄ reparos
    if (token.endsWith('s') && textoNorm.includes(token.slice(0, -1))) return true;
    if (!token.endsWith('s') && textoNorm.includes(token + 's')) return true;
    // abreviações comuns da tabela
    if (token === 'diant') return /(diant|dianteir)/.test(textoNorm);
    if (token === 'tras') return /(tras|traseir)/.test(textoNorm);
    if (token === 'dir') return /(dir|direit|ld)/.test(textoNorm);
    if (token === 'esq') return /(esq|esquerd|le)/.test(textoNorm);
    return false;
  }

  function _tempaEquivalenciaContextual(textoNorm, token, fraseConsulta) {
    const alvo = _norm(textoNorm || '');
    const t = _norm(token || '');
    const ctx = _norm(fraseConsulta || '');

    // Bieleta = haste (da suspensão) = suporte da barra tensora.
    const ctxBieleta = /\b(bieleta|haste)\b/.test(ctx) || /\bsuporte\b.*\bbarra\b.*\btensora\b/.test(ctx);
    const alvoBieleta = /\b(bieleta|haste|tirante|liame)\b/.test(alvo) || /\bsuporte\b.*\bbarra\b.*\btensora\b/.test(alvo);
    if (ctxBieleta && alvoBieleta && ['bieleta','haste','suporte','tensora'].includes(t)) return true;

    // Balança = bandeja = braço oscilante.
    const ctxBandeja = /\b(balanca|bandeja)\b/.test(ctx) || /\bbraco\b.*\boscilante\b/.test(ctx);
    const alvoBandeja = /\b(balanca|bandeja)\b/.test(alvo) || /\bbraco\b.*\boscilante\b/.test(alvo);
    if (ctxBandeja && alvoBandeja && ['balanca','bandeja','braco','oscilante'].includes(t)) return true;

    // Bucha/coxinha da barra estabilizadora = kit da barra estabilizadora.
    const ctxBarraKit = /\b(bucha|coxinha|kit)\b.*\bbarra\b.*\bestabilizadora\b/.test(ctx);
    const alvoBarraKit = /\b(bucha|coxinha|kit)\b.*\bbarra\b.*\bestabilizadora\b/.test(alvo);
    if (ctxBarraKit && alvoBarraKit && ['bucha','coxinha','kit'].includes(t)) return true;

    // Terminal axial = articulador = barra axial.
    const ctxAxial = /\bterminal\b.*\baxial\b/.test(ctx) || /\barticulador\b/.test(ctx) || /\bbarra\b.*\baxial\b/.test(ctx);
    const alvoAxial = /\bterminal\b.*\baxial\b/.test(alvo) || /\bbarra\b.*\baxial\b/.test(alvo) || (/\barticul/.test(alvo) && /\b(direcao|caixa|setor)\b/.test(alvo));
    if (ctxAxial && alvoAxial && ['terminal','axial','articulador','barra'].includes(t)) return true;

    // Terminal de direção = ponteira. Não aplica a ponteira homocinética/para-choque.
    const ctxTerminal = /\b(terminal|ponteira)\b/.test(ctx) && !/\b(axial|homocinet|parachoque|para choque)\b/.test(ctx);
    const alvoTerminal = /\b(terminal|ponteira)\b/.test(alvo) && !/\b(homocinet|parachoque|para choque)\b/.test(alvo);
    if (ctxTerminal && alvoTerminal && ['terminal','ponteira'].includes(t)) return true;

    return false;
  }

  // Override limpo: a versao antiga acima preserva compatibilidade historica,
  // mas alguns boundaries vieram quebrados em arquivos zipados. Esta versao
  // tambem entende sinonimos reais de oficina/Cilia.
  function _tempaTokenExiste(textoNorm, token, fraseConsulta) {
    if (!token) return true;
    if (_tempaEquivalenciaContextual(textoNorm, token, fraseConsulta)) return true;
    const alternativas = _tempaAlternativasToken(token);
    if (alternativas.some(alt => alt && textoNorm.includes(alt))) return true;
    if (token.endsWith('s') && textoNorm.includes(token.slice(0, -1))) return true;
    if (!token.endsWith('s') && textoNorm.includes(token + 's')) return true;
    if (token === 'diant') return /\b(diant|dianteir)/.test(textoNorm);
    if (token === 'tras') return /\b(tras|traseir)/.test(textoNorm);
    if (token === 'dir') return /\b(dir|direit|ld)\b/.test(textoNorm);
    if (token === 'esq') return /\b(esq|esquerd|le)\b/.test(textoNorm);
    return false;
  }

  function _tempaBuscarPorTextoPreciso(texto, opts) {
    opts = opts || {};
    const limite = opts.limite == null ? 0 : Number(opts.limite || 0);
    const sistemaFiltro = opts.sistema || '';
    const categoriaTempa = _norm(opts.categoriaTempa || '');
    const preferenciasVeiculo = categoriaTempa ? [categoriaTempa] : (opts.veiculo ? _preferenciasSistemaVeiculo(opts.veiculo) : []);
    const consulta = _tempaPrepararConsultaPrecisa(texto);
    if (!consulta.obrigatorios.length && !sistemaFiltro) return [];

    const resultados = [];
    for (const entry of _indiceParaBusca(opts)) {
      if (sistemaFiltro && entry.ref.sistema !== sistemaFiltro) continue;

      const itemNorm = _norm([entry.ref.operacao, entry.ref.item].filter(Boolean).join(' '));
      const sistemaNorm = _norm(entry.ref.sistema || '');
      const buscaNorm = entry.busca;

      // Precisão: para a busca da O.S., todos os termos essenciais digitados precisam existir.
      let todosObrigatorios = true;
      for (const t of consulta.obrigatorios) {
        if (!_tempaTokenExiste(buscaNorm, t, consulta.frase)) { todosObrigatorios = false; break; }
      }
      if (!todosObrigatorios) continue;

      let score = 0;
      for (const t of consulta.obrigatorios) {
        score += 80 + (t.length * 8);
        if (_tempaTokenExiste(itemNorm, t, consulta.frase)) score += 45;
        if (_tempaTokenExiste(sistemaNorm, t, consulta.frase)) score += 12;
      }
      for (const t of consulta.auxiliares) {
        if (_tempaTokenExiste(buscaNorm, t, consulta.frase)) score += 18;
        if (_tempaTokenExiste(itemNorm, t, consulta.frase)) score += 10;
      }
      if (consulta.frase && buscaNorm.includes(consulta.frase)) score += 120;
      preferenciasVeiculo.forEach((pref, idx) => {
        if (buscaNorm.includes(pref)) score += Math.max(4, 16 - (idx * 3));
      });
      // Penaliza classes totalmente diferentes, mas sem excluir: a tabela pode ter variações reais.
      if (preferenciasVeiculo.includes('compacto') && /(caminhao|onibus|microonibus)/.test(buscaNorm)) score -= 20;
      resultados.push({ item: entry.ref, score });
    }

    const ordenados = resultados.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ak = `${a.item.sistema}|${a.item.operacao}|${a.item.item}`;
      const bk = `${b.item.sistema}|${b.item.operacao}|${b.item.item}`;
      return ak.localeCompare(bk, 'pt-BR');
    });
    return (limite > 0 ? ordenados.slice(0, limite) : ordenados).map(r => r.item);
  }

  // ───────────────────────────────────────────────────────────────
  // API DE BUSCA (programática — usada pela IA e pela OS)
  // ───────────────────────────────────────────────────────────────
  window.tempaBuscarPorTexto = function(texto, opts) {
    if (!TT.carregada || !TT.indice) return [];
    opts = opts || {};
    if (opts.preciso) return _tempaBuscarPorTextoPreciso(texto, opts);
    const limite = opts.limite == null ? 0 : Number(opts.limite || 0);
    const sistemaFiltro = opts.sistema || '';
    const categoriaTempa = _norm(opts.categoriaTempa || '');
    const preferenciasVeiculo = categoriaTempa ? [categoriaTempa] : (opts.veiculo ? _preferenciasSistemaVeiculo(opts.veiculo) : []);
    const stop = new Set(['servico','servicos','troca','trocar','substituir','remover','instalar','retirar','colocar','de','da','do','das','dos','em','para','com','sem','uma','um','e']);
    const termos = _norm(texto).split(' ').filter(t => t.length >= 3 && !stop.has(t));
    if (termos.length === 0 && !sistemaFiltro) return [];

    const resultados = [];
    for (const entry of _indiceParaBusca(opts)) {
      // Filtro por sistema se especificado
      if (sistemaFiltro && entry.ref.sistema !== sistemaFiltro) continue;
      let score = 0;
      let termScore = 0;
      for (const t of termos) {
        if (_tempaTokenExiste(entry.busca, t)) termScore += t.length;
      }
      score += termScore;
      preferenciasVeiculo.forEach((pref, idx) => {
        if (entry.busca.includes(pref)) score += Math.max(6, 22 - (idx * 4));
      });
      if (preferenciasVeiculo.includes('compacto') && /\b(caminhao|onibus|microonibus|utilitario|suv)\b/.test(entry.busca)) score -= 18;
      const frase = _norm(texto);
      if (frase && entry.busca.includes(frase)) score += 50;
      if (termScore > 0 || (!termos.length && sistemaFiltro)) {
        resultados.push({ item: entry.ref, score });
      }
    }
    const ordenados = resultados
      .sort((a, b) => b.score - a.score || a.item.item.length - b.item.item.length);
    return (limite > 0 ? ordenados.slice(0, limite) : ordenados).map(r => r.item);
  };

  // ───────────────────────────────────────────────────────────────
  // UI DA TELA TABELA TEMPÁRIA NO JARVIS
  // ───────────────────────────────────────────────────────────────
  window.tempaInicializarTela = async function() {
    const tbody = document.getElementById('tempaTbody');
    const cont = document.getElementById('tempaContador');
    const sel = document.getElementById('tempaSistema');
    if (!tbody) return;

    if (!TT.carregada) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--cyan);">⏳ Carregando Tabela Tempária SINDIREPA-SP completa...</td></tr>';
      try {
        await window.tempaCarregar();
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">⚠ Erro ao carregar: ${e.message}<br><small>Verifique se o arquivo data/tabela-tempa.min.json está no GitHub Pages.</small></td></tr>`;
        if (cont) cont.textContent = 'Erro';
        return;
      }
    }

    if (cont) cont.textContent = `${TT.dados._metadata.totalItens.toLocaleString('pt-BR')} itens · ${TT.dados._metadata.totalSistemas} sistemas`;

    // Popula select de sistemas (uma vez só)
    if (sel && sel.options.length <= 1) {
      const optsHTML = ['<option value="">Todos os sistemas</option>']
        .concat(TT.dados.sistemas.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`))
        .join('');
      sel.innerHTML = optsHTML;
    }

    window.tempaPesquisar();
  };

  window.tempaPesquisar = function() {
    if (!TT.carregada) {
      window.tempaInicializarTela();
      return;
    }

    const tbody = document.getElementById('tempaTbody');
    const status = document.getElementById('tempaStatus');
    const inp = document.getElementById('tempaSearch');
    const sel = document.getElementById('tempaSistema');

    const termo = inp ? inp.value.trim() : '';
    const sistema = sel ? sel.value : '';

    let resultados;
    if (!termo && !sistema) {
      resultados = TT.dados.itens.slice(0, 100);  // primeiros 100
    } else {
      resultados = window.tempaBuscarPorTexto(termo, { sistema, limite: 200 });
    }

    if (status) {
      if (!termo && !sistema) {
        status.textContent = `Mostrando 100 itens iniciais. Use a busca para filtrar nos ${TT.dados._metadata.totalItens.toLocaleString('pt-BR')} itens.`;
      } else {
        status.textContent = `${resultados.length} resultado(s) encontrado(s)`;
      }
    }

    if (resultados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">Nenhum item encontrado. Tente outros termos.</td></tr>`;
      return;
    }

    tbody.innerHTML = resultados.map(it => {
      const tempoFmt = it.tempo.toFixed(2).replace('.', ',');
      const tempoHHmm = _hToHHmm(it.tempo);
      return `<tr>
        <td>
          ${it.codigoInterno ? `<span class="pill pill-cyan" style="font-family:var(--fm);font-size:0.65rem;">${_esc(it.codigoInterno)}</span><br>` : ''}
          <small style="font-family:var(--fm);font-size:0.58rem;color:var(--muted);">SIAFISICO ${_esc(it.codigo || '-')}</small>
        </td>
        <td style="font-size:0.78rem;color:var(--text);">${_esc(it.sistema)}</td>
        <td><span style="font-family:var(--fm);font-size:0.7rem;color:var(--warn);">${_esc(it.operacao)}</span></td>
        <td style="font-size:0.8rem;">${_esc(it.item)}</td>
        <td style="text-align:right;font-family:var(--fm);font-weight:700;color:var(--success);">${tempoFmt}h<br><small style="color:var(--muted);font-weight:400;">${tempoHHmm}</small></td>
        <td style="text-align:center;">
          <button class="btn-ghost" style="font-size:0.65rem;padding:5px 10px;" onclick='window.tempaCopiarItem(${JSON.stringify(it).replace(/'/g, "&apos;")})' title="Copiar para a área de transferência">📋</button>
        </td>
      </tr>`;
    }).join('');
  };

  // ───────────────────────────────────────────────────────────────
  // FERRAMENTAS AUXILIARES
  // ───────────────────────────────────────────────────────────────
  window.tempaCopiarItem = function(it) {
    const txt = `${it.sistema} | ${it.operacao} | ${it.item} | COD. INTERNO: ${it.codigoInterno || '-'} | SIAFISICO: ${it.codigo || '-'} | ${it.tempo.toFixed(2).replace('.', ',')}h`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => {
        if (window.toast) window.toast('✓ Item copiado: ' + txt.substring(0, 60), 'ok');
      });
    } else {
      if (window.toast) window.toast('Item: ' + txt, 'ok');
    }
  };

  // ───────────────────────────────────────────────────────────────
  // INTEGRAÇÃO COM A IA — chamada quando o gestor pergunta tempo
  // Detecta intenções tipo "quanto tempo para trocar pastilha"
  // e devolve resposta enriquecida com dados reais da tabela.
  // ───────────────────────────────────────────────────────────────
  window.tempaConsultarParaIA = async function(textoPergunta) {
    if (!TT.carregada) {
      try { await window.tempaCarregar(); }
      catch(e) { return null; }
    }
    const resultados = window.tempaBuscarPorTexto(textoPergunta, { limite: 8 });
    if (resultados.length === 0) return null;
    return {
      total: resultados.length,
      itens: resultados,
      resumo: resultados.map(it =>
        `• [${it.codigo}] ${it.operacao} ${it.item} (${it.sistema}): ${it.tempo.toFixed(2).replace('.', ',')}h`
      ).join('\n')
    };
  };

  const _inlineTimers = new WeakMap();

  async function _garantirTempaCarregada() {
    if (TT.carregada) return true;
    try { await window.tempaCarregar(); return true; }
    catch(e) { if (window.toast) window.toast('Tabela Temparia nao carregou.', 'err'); return false; }
  }

  function _ehViaturaOS() {
    return typeof window._osClienteGovernamental === 'function' && window._osClienteGovernamental();
  }

  function _veiculoOS() {
    return typeof window._osVeiculoAtual === 'function' ? window._osVeiculoAtual() : {};
  }

  function _secaoItemOS(item) {
    const UOS = window.JOS || window.JarvisOSUtils || {};
    return _ehViaturaOS() && UOS.inferPMSPValorHora ? UOS.inferPMSPValorHora(item, { veiculo: _veiculoOS() }) : null;
  }

  function _aplicarItemTempaNaLinha(row, item, opts) {
    if (!row || !item) return false;
    const op = opts || {};
    const inputDesc = row.querySelector('.serv-desc');
    const inputTempo = row.querySelector('.serv-tempo');
    const inputValor = row.querySelector('.serv-valor');
    const inputHora = row.querySelector('.serv-valor-hora');
    const UOS = window.JOS || window.JarvisOSUtils || {};
    const secaoInfo = _secaoItemOS(item);
    const valorHoraPadrao = (UOS.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(
      window._tempaValorHora || window._osValorHoraCliente?.() || window.J?.valorHoraMecanica || 120
    );

    if (inputDesc) inputDesc.value = `${item.operacao} ${item.item}`.trim();
    if (inputTempo) inputTempo.value = item.tempo.toFixed(2).replace('.', ',');

    row.dataset.tempoTabela = item.tempo;
    row.dataset.codigoInterno = item.codigoInterno || '';
    row.dataset.codigoTabela = item.codigo;
    row.dataset.sistemaTabela = item.sistema;
    row.dataset.tempaManual = '';

    if (_ehViaturaOS()) {
      if (secaoInfo && typeof window.aplicarSecaoMaoObraOS === 'function') {
        window.aplicarSecaoMaoObraOS(row, secaoInfo.key, { recalcular: true });
      } else {
        if (typeof window.aplicarSecaoMaoObraOS === 'function') window.aplicarSecaoMaoObraOS(row, '', { recalcular: false });
        if (inputHora && row.dataset.valorHoraManual !== '1') inputHora.value = '';
        if (inputValor && row.dataset.valorManual !== '1') inputValor.value = '0,00';
      }
      row.dataset.secaoHora = secaoInfo?.key || '';
      row.dataset.secaoHoraLabel = secaoInfo?.label || '';
      row.dataset.valorHoraSecao = secaoInfo?.valor || '';
    } else if (op.aplicarValor !== false && inputValor) {
      const atual = (UOS.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(inputValor.value || 0);
      if (inputHora && row.dataset.valorHoraManual !== '1') inputHora.value = valorHoraPadrao.toFixed(2).replace('.', ',');
      if (atual <= 0 || op.forcarValor) inputValor.value = (item.tempo * valorHoraPadrao).toFixed(2).replace('.', ',');
    }

    if (typeof window.atualizarValorServicoPorHora === 'function' && inputHora) {
      window.atualizarValorServicoPorHora(row);
    }
    if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
    return true;
  }

  function _marcarLinhaManual(row) {
    if (!row) return;
    row.dataset.tempaManual = '1';
    row.querySelector('.tempa-inline-box')?.remove();
    if (typeof window.aplicarSecaoMaoObraOS === 'function') window.aplicarSecaoMaoObraOS(row, '', { recalcular: true });
  }

  window.tempaSugerirInlineOS = async function(row) {
    if (!row || row.dataset.tempaManual === '1') return;
    const input = row.querySelector('.serv-desc');
    const termo = (input?.value || '').trim();
    row.querySelector('.tempa-inline-box')?.remove();
    if (termo.length < 3) return;
    if (!await _garantirTempaCarregada()) return;

    const resultados = window.tempaBuscarPorTexto(termo, { veiculo: _veiculoOS() });
    const box = document.createElement('div');
    box.className = 'tempa-inline-box';
    if (!resultados.length) {
      box.innerHTML = `<button type="button" class="tempa-inline-option tempa-inline-none" data-tempa-none="1">
        <span>Nenhuma alternativa - manter manual</span><small>Voce continua preenchendo TMO, secao e valor na OS</small>
      </button>`;
    } else {
      box.innerHTML = `
        ${resultados.map((it, idx) => {
          const secao = _secaoItemOS(it);
          const secaoTxt = _ehViaturaOS()
            ? (secao ? `${_esc(secao.label)} - R$ ${Number(secao.valor || 0).toFixed(2).replace('.', ',')}/h` : 'Sem secao oficial automatica')
            : `${it.tempo.toFixed(2).replace('.', ',')}h`;
          return `<button type="button" class="tempa-inline-option" data-tempa-idx="${idx}">
            <span><b>${_esc(it.operacao)} ${_esc(it.item)}</b><br><small>${_esc(it.sistema)} - interno ${_esc(it.codigoInterno || '-')} - SIAFISICO ${_esc(it.codigo)} - ${_esc(secaoTxt)}</small></span>
            <strong>${it.tempo.toFixed(2).replace('.', ',')}h</strong>
          </button>`;
        }).join('')}
        <button type="button" class="tempa-inline-option tempa-inline-none" data-tempa-none="1">
          <span>Nenhuma alternativa - preencher manualmente</span><small>Nao aplica nenhuma sugestao nesta linha</small>
        </button>`;
    }
    box._tempaResultados = resultados;
    row.appendChild(box);
  };

  document.addEventListener('input', ev => {
    const alvo = ev.target;
    if (!alvo?.classList?.contains('serv-desc')) return;
    const row = alvo.closest('#containerServicosOS > div');
    if (!row) return;
    clearTimeout(_inlineTimers.get(row));
    const timer = setTimeout(() => window.tempaSugerirInlineOS(row), 280);
    _inlineTimers.set(row, timer);
  });

  document.addEventListener('click', ev => {
    const btn = ev.target.closest?.('[data-tempa-idx],[data-tempa-none]');
    if (btn) {
      const box = btn.closest('.tempa-inline-box');
      const row = box?.closest('#containerServicosOS > div');
      if (btn.dataset.tempaNone) {
        _marcarLinhaManual(row);
        if (window.toast) window.toast('Linha mantida para preenchimento manual.', 'ok');
        return;
      }
      const item = box?._tempaResultados?.[parseInt(btn.dataset.tempaIdx, 10)];
      if (_aplicarItemTempaNaLinha(row, item, { aplicarValor: true, forcarValor: false })) {
        box.remove();
        if (window.toast) window.toast('Sugestao da Tabela aplicada.', 'ok');
      }
      return;
    }
    if (!ev.target.closest?.('.tempa-inline-box') && !ev.target.closest?.('.serv-desc')) {
      document.querySelectorAll('.tempa-inline-box').forEach(el => el.remove());
    }
  });

  // ───────────────────────────────────────────────────────────────
  // INTEGRAÇÃO COM A O.S. — Modal único com seleção por serviço
  // ───────────────────────────────────────────────────────────────
  // Comportamento:
  //   1. Lê todos os serviços lançados na OS
  //   2. Para CADA serviço, faz uma busca na Tabela e mostra TODAS as ocorrências
  //   3. Gestor seleciona qual usar via radio button
  //   4. Checkbox global: "Aplicar valor da hora-mecânica?" (default: ligado)
  //   5. Se aplicar: preenche TMO+valor (tempo × R$/h)
  //   6. Se não aplicar (cliente governo): preenche só horas, valor fica em branco
  //   7. Se não encontrou nada na Tabela: deixa o serviço como está
  // ───────────────────────────────────────────────────────────────
  window.tempaSugerirParaOS = async function() {
    if (!TT.carregada) {
      try { await window.tempaCarregar(); }
      catch(e) {
        if (window.toast) window.toast('⚠ Tabela Tempária não carregou. Verifique se data/tabela-tempa.min.json está no GitHub Pages.', 'err');
        return;
      }
    }

    // 1. Lê serviços lançados
    const linhas = document.querySelectorAll('#containerServicosOS > div');
    if (linhas.length === 0) {
      if (window.toast) window.toast('⚠ Adicione pelo menos um serviço antes de sugerir tempos.', 'warn');
      return;
    }

    // 2. Detecta tipo de cliente e valor/hora do cadastro do cliente/oficina
    const ehViatura = window._osClienteGovernamental && window._osClienteGovernamental();
    const dadosGov = ehViatura && window._osDadosGovernamental ? window._osDadosGovernamental() : null;
    const valorHoraOficina = (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(
      dadosGov?.valorHora || window.J?.valorHoraMecanica || 120
    );
    const UOS = window.JOS || window.JarvisOSUtils || {};
    const veiculoAtual = window._osVeiculoAtual ? window._osVeiculoAtual() : {};
    const fmtHora = v => (UOS.parseNumberBR ? UOS.parseNumberBR(v) : parseFloat(String(v || 0).replace(',', '.')) || 0).toFixed(2).replace('.', ',');
    const secaoPorItem = it => ehViatura && UOS.inferPMSPValorHora ? UOS.inferPMSPValorHora(it, { veiculo: veiculoAtual }) : null;

    // 3. Para cada linha, busca na Tabela
    const buscas = [];
    linhas.forEach((row, idx) => {
      const inputDesc = row.querySelector('.serv-desc');
      const inputValor = row.querySelector('.serv-valor');
      if (!inputDesc) return;
      const desc = (inputDesc.value || '').trim();
      if (!desc) return;
      const resultados = window.tempaBuscarPorTexto(desc, { veiculo: veiculoAtual });
      buscas.push({
        idx,
        rowEl: row,
        descOriginal: desc,
          valorAtual: (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(inputValor?.value || 0),
        resultados
      });
    });

    if (buscas.length === 0) {
      if (window.toast) window.toast('Nenhum serviço com descrição.', 'warn');
      return;
    }

    // 4. Monta modal único
    let modal = document.getElementById('modalTempaSugest');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalTempaSugest';
      modal.className = 'overlay';
      document.body.appendChild(modal);
    }

    const seccoesHTML = buscas.map((b, i) => {
      if (b.resultados.length === 0) {
        return `<div class="tempa-sec" style="margin-bottom:18px;padding:12px;background:rgba(255,184,0,0.06);border:1px solid rgba(255,184,0,0.25);border-radius:4px;">
          <div style="font-family:var(--fm);font-size:0.7rem;color:var(--warn);margin-bottom:4px;">⚠ SERVIÇO ${i+1} — NÃO ENCONTRADO NA TABELA</div>
          <div style="font-size:0.85rem;color:var(--text);">"${_esc(b.descOriginal)}"</div>
          <div style="font-size:0.7rem;color:var(--muted);margin-top:6px;font-style:italic;">Permanece como está, edite manualmente.</div>
        </div>`;
      }

      const opcoes = `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,184,0,0.06);border:1px solid rgba(255,184,0,0.28);border-radius:3px;margin-bottom:6px;cursor:pointer;font-size:0.78rem;">
            <input type="radio" name="tempaSel${i}" value="__none__" style="cursor:pointer;flex-shrink:0;">
            <div style="flex:1;">
              <div style="color:var(--warn);font-weight:700;">Nenhuma alternativa / preencher manualmente</div>
              <small style="color:var(--muted);font-family:var(--fm);font-size:0.65rem;">Nao aplica TMO nem valor nesta linha.</small>
            </div>
          </label>
        ` + b.resultados.map((it, j) => {
        const secao = secaoPorItem(it);
        const secaoHtml = ehViatura
          ? `<br><small style="color:${secao ? 'var(--success)' : 'var(--warn)'};font-family:var(--fm);font-size:0.62rem;">${secao ? `${_esc(secao.label)} · R$ ${fmtHora(secao.valor)}/h` : 'SEM SECAO OFICIAL AUTOMATICA · usuario escolhe/preenche na OS'}</small>`
          : '';
        return `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,212,255,0.04);border:1px solid var(--border);border-radius:3px;margin-bottom:4px;cursor:pointer;font-size:0.78rem;">
            <input type="radio" name="tempaSel${i}" value="${j}" ${j === 0 ? 'checked' : ''} style="cursor:pointer;flex-shrink:0;">
            <div style="flex:1;">
              <div style="color:var(--text);font-weight:600;">${_esc(it.operacao)} ${_esc(it.item)}</div>
              <small style="color:var(--muted);font-family:var(--fm);font-size:0.65rem;">${_esc(it.sistema)} · cód. ${_esc(it.codigo)}</small>${secaoHtml}
            </div>
            <div style="font-family:var(--fm);font-weight:700;color:var(--success);font-size:0.85rem;text-align:right;flex-shrink:0;min-width:70px;">
              ${it.tempo.toFixed(2).replace('.', ',')}h
              <br><small style="color:var(--muted);font-weight:400;">${_hToHHmm(it.tempo)}</small>
            </div>
          </label>
        `;
      }).join('');

      return `<div class="tempa-sec" data-idx="${b.idx}" style="margin-bottom:20px;">
        <div style="font-family:var(--fm);font-size:0.75rem;color:var(--cyan);margin-bottom:6px;letter-spacing:0.5px;">
          SERVIÇO ${i+1}: <span style="color:var(--text);">"${_esc(b.descOriginal)}"</span>
        </div>
        <div style="font-size:0.65rem;color:var(--muted);margin-bottom:8px;">
          ${b.resultados.length} ocorrência(s) na Tabela — selecione a que se aplica:
        </div>
        ${opcoes}
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal" style="max-width:780px;width:96%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-head">
          <div class="modal-title">📖 SUGERIR TEMPOS — TABELA TEMPÁRIA SINDIREPA</div>
          <button class="modal-close" onclick="document.getElementById('modalTempaSugest').classList.remove('open')">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto;padding:18px;">
          <div style="background:${ehViatura ? 'rgba(167,139,250,0.08)' : 'rgba(0,212,255,0.06)'};border:1px solid ${ehViatura ? 'var(--purple, #A78BFA)' : 'var(--cyan)'};border-radius:4px;padding:12px;margin-bottom:18px;">
            ${ehViatura ?
              `<div style="font-family:var(--fm);font-size:0.7rem;color:var(--purple,#A78BFA);font-weight:700;margin-bottom:6px;">🛡 CLIENTE GOVERNAMENTAL DETECTADO</div>
              <div style="font-size:0.78rem;color:var(--text);line-height:1.5;">
                Este orçamento é para viatura/órgão público. As horas (TMO) virão da Tabela Tempária e o valor/hora será sugerido pela seção oficial PMSP quando houver correspondência. Se não houver seção segura, fica sem seleção para preenchimento manual na O.S.
              </div>` :
              `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="tempaAplicarValor" checked style="width:18px;height:18px;cursor:pointer;">
                <div>
                  <div style="font-family:var(--fm);font-size:0.7rem;color:var(--cyan);font-weight:700;">APLICAR VALOR DA HORA-MECÂNICA: R$ ${valorHoraOficina.toFixed(2)}/h</div>
                  <div style="font-size:0.7rem;color:var(--muted);margin-top:2px;">
                    Desmarque se este serviço usa tabela externa de preços (você preenche depois manualmente).
                  </div>
                </div>
              </label>`
            }
          </div>

          ${seccoesHTML}
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" onclick="document.getElementById('modalTempaSugest').classList.remove('open')">CANCELAR</button>
          <button class="btn-primary" onclick="window._tempaAplicarSelecionados()">✓ APLICAR SELECIONADOS</button>
        </div>
      </div>
    `;

    // Guarda dados pra aplicação
    window._tempaBuscasAtivas = buscas;
    window._tempaEhViatura = ehViatura;
    window._tempaValorHora = valorHoraOficina;
    window._tempaVeiculoAtual = veiculoAtual;

    modal.classList.add('open');
  };

  // Aplica as seleções escolhidas pelo usuário
  window._tempaAplicarSelecionados = function() {
    const buscas = window._tempaBuscasAtivas || [];
    const ehViatura = window._tempaEhViatura;
    const valorHora = window._tempaValorHora;
    const aplicarValor = ehViatura ? true : (document.getElementById('tempaAplicarValor')?.checked ?? true);

    let aplicados = 0;
    let semOpcao = 0;
    let semSecao = 0;

    buscas.forEach((b, i) => {
      if (b.resultados.length === 0) {
        semOpcao++;
        return;
      }
      const sel = document.querySelector(`input[name="tempaSel${i}"]:checked`);
      if (!sel) return;
      if (sel.value === '__none__') {
        semOpcao++;
        b.rowEl.dataset.tempaManual = '1';
        return;
      }
      const itemEscolhido = b.resultados[parseInt(sel.value)];
      if (!itemEscolhido) return;

      const inputDesc = b.rowEl.querySelector('.serv-desc');
      const inputValor = b.rowEl.querySelector('.serv-valor');
      const inputTempo = b.rowEl.querySelector('.serv-tempo'); // novo campo TMO
      const inputHora = b.rowEl.querySelector('.serv-valor-hora');

      // P5: substitui descrição com nome oficial da Tabela (editável depois)
      if (inputDesc) {
        inputDesc.value = itemEscolhido.operacao + ' ' + itemEscolhido.item;
      }
      // Preenche TMO (horas) sempre
      if (inputTempo) {
        inputTempo.value = itemEscolhido.tempo.toFixed(2).replace('.', ',');
      }
      const UOS = window.JOS || window.JarvisOSUtils || {};
      const secaoInfo = ehViatura && UOS.inferPMSPValorHora ? UOS.inferPMSPValorHora(itemEscolhido, { veiculo: window._tempaVeiculoAtual || {} }) : null;

      if (ehViatura) {
        if (secaoInfo && typeof window.aplicarSecaoMaoObraOS === 'function') {
          window.aplicarSecaoMaoObraOS(b.rowEl, secaoInfo.key, { recalcular: true });
        } else {
          semSecao++;
          if (typeof window.aplicarSecaoMaoObraOS === 'function') window.aplicarSecaoMaoObraOS(b.rowEl, '', { recalcular: false });
          if (inputHora && b.rowEl.dataset.valorHoraManual !== '1') inputHora.value = '';
          if (inputValor && b.rowEl.dataset.valorManual !== '1') inputValor.value = '0,00';
        }
      } else if (aplicarValor && inputValor) {
        // Só sobrescreve se está zerado (não machuca valor manual)
        const atual = (window.JOS?.parseNumberBR || (v => parseFloat(String(v || 0).replace(',', '.')) || 0))(inputValor.value || 0);
        if (atual <= 0) {
          inputValor.value = (itemEscolhido.tempo * valorHora).toFixed(2).replace('.', ',');
        }
      }
      // Garante metadados da tabela para exportação/detalhamento
      b.rowEl.dataset.tempoTabela = itemEscolhido.tempo;
      b.rowEl.dataset.codigoInterno = itemEscolhido.codigoInterno || '';
      b.rowEl.dataset.codigoTabela = itemEscolhido.codigo;
      b.rowEl.dataset.sistemaTabela = itemEscolhido.sistema;
      b.rowEl.dataset.secaoHora = secaoInfo?.key || b.rowEl.dataset.secaoHora || '';
      b.rowEl.dataset.secaoHoraLabel = secaoInfo?.label || b.rowEl.dataset.secaoHoraLabel || '';
      b.rowEl.dataset.valorHoraSecao = secaoInfo?.valor || b.rowEl.dataset.valorHoraSecao || '';

      aplicados++;
    });

    if (typeof window.calcOSTotal === 'function') window.calcOSTotal();

    if (aplicados > 0) {
      const txt = ehViatura
        ? `✓ ${aplicados} serviço(s) com TMO aplicado. Valor/hora oficial preenchido quando a seção foi identificada.`
        : (aplicarValor
          ? `✓ ${aplicados} serviço(s) preenchido(s) com TMO + valor (R$ ${valorHora.toFixed(2)}/h)`
          : `✓ ${aplicados} serviço(s) com TMO preenchido. Valores em branco para preenchimento manual.`);
      if (window.toast) window.toast(txt, 'ok');
    }
    if (semOpcao > 0 && window.toast) {
      window.toast(`⚠ ${semOpcao} serviço(s) não encontrado(s) na Tabela. Permaneceram editáveis.`, 'warn');
    }
    if (semSecao > 0 && window.toast) {
      window.toast(`⚠ ${semSecao} serviço(s) ficaram sem seção oficial automática. Selecione ou preencha manualmente na O.S.`, 'warn');
    }

    document.getElementById('modalTempaSugest').classList.remove('open');
  };

  // Reseta valor da hora (caso queira mudar)
  window.tempaResetarValorHora = function() {
    sessionStorage.removeItem('thiaguinho_valorHoraMec');
    if (window.toast) window.toast('Valor da hora resetado.', 'ok');
  };

  // ───────────────────────────────────────────────────────────────
  // UTILS
  // ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function _hToHHmm(h) {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (hh === 0) return `${mm}min`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h${String(mm).padStart(2, '0')}`;
  }

  // Auto-init quando alguém clica no menu Tabela Tempária
  if (typeof window.ir === 'function' && !window._irOriginalTempa) {
    window._irOriginalTempa = window.ir;
    window.ir = function(rota, el) {
      window._irOriginalTempa(rota, el);
      if (rota === 'tabelatempa') setTimeout(window.tempaInicializarTela, 50);
    };
  }
})();

/* Powered by thIAguinho Soluções Digitais */
