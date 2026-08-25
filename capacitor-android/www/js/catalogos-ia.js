/**
 * Catálogos técnicos locais para a IA interna.
 * Pesquisa objetiva, carregamento sob demanda e fonte/página verificáveis.
 * Powered by thIAguinho Soluções Digitais
 */
(function () {
  'use strict';

  const W = window;
  const MANIFEST_URL = 'data/catalogos-ia/manifest.json?v=20260718-v19';
  const cache = new Map();
  const pageNormCache = new WeakMap();
  let manifest = null;
  let manifestPromise = null;

  const STOP = new Set([
    'para','com','sem','uma','uns','das','dos','de','da','do','em','no','na','nos','nas',
    'por','que','qual','quais','tem','esta','este','essa','esse','peca','pecas','carro',
    'veiculo','veiculos','catalogo','catalogos','aplicacao','aplicacoes','codigo','codigos',
    'modelo','ano','anos','quero','saber','serve','servem','seria','ser','consulte','consultar','consulta','procure','procurar','busque','buscar','informe','informar','verifique','verificar','fabricante','marca'
  ]);
  const GENERICOS = new Set([
    'sensor','nivel','combustivel','bomba','valvula','temperatura','detonacao','pressao',
    'pastilha','sapata','freio','kit','reparo','motor','terminal','bucha','rolamento',
    'correia','tensor','polia','bico','injetor','filtro','chicote','interruptor','tomada','conector','plug','soquete','terminal','contrapeca','reparo','bobina','ignicao','medidor','boia','flange','modulo','refil'
  ]);
  const PREFIXOS = {
    ds: 'ds-2025', dni: 'dni', dpl: 'dpl', brk: 'brk', aje: 'aje', jurid: 'jurid',
    nytron: 'nytron', ranalle: 'ranalle', wahler: 'wahler', ete: 'rainha-sete', rainha: 'rainha-sete'
  };

  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9./+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function compact(v) { return norm(v).replace(/[^a-z0-9]/g, ''); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function tokens(v) {
    return [...new Set(norm(v).split(/\s+/).filter(t => t.length >= 3 && !STOP.has(t)))];
  }
  function codeTokens(v) {
    const textoNorm = norm(v);
    const codigoExplicito = /\b(codigo|cod|referencia|ref|oem)\b/.test(textoNorm);
    const encontrados = String(v || '').toUpperCase().match(/[A-Z0-9][A-Z0-9./-]{2,18}/g) || [];
    const saida = new Set();
    encontrados.forEach(raw => {
      const c = compact(raw);
      const numeroPuro = /^\d+$/.test(c) ? Number(c) : 0;
      if (c.length === 4 && numeroPuro >= 1900 && numeroPuro <= 2099 && !codigoExplicito) return;
      if (c.length >= 3 && /\d/.test(c)) saida.add(c);
      const m = c.match(/^(ds|dni|dpl|brk|aje|jurid|nytron|ranalle|wahler|ete)?0*([0-9]{3,})$/);
      if (m) {
        const n = Number(m[2]);
        if (m[2].length === 4 && n >= 1900 && n <= 2099 && !codigoExplicito && !m[1]) return;
        saida.add(m[2]);
        saida.add(String(n));
      }
    });
    return [...saida].filter(Boolean);
  }
  function sourceHint(v) {
    const n = norm(v);
    for (const [prefixo, id] of Object.entries(PREFIXOS)) {
      if (new RegExp(`\\b${prefixo}[-./ ]?\\d+\\b`).test(n) || new RegExp(`\\b${prefixo}\\b`).test(n)) return id;
    }
    return '';
  }
  function queryYear(v) {
    const m = String(v || '').match(/\b((?:19|20)\d{2})\b/);
    return m ? Number(m[1]) : 0;
  }
  function year2(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n < 30) return 2000 + n;
    if (n < 100) return 1900 + n;
    return n;
  }
  function rangeMatches(text, year) {
    if (!year) return false;
    const n = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const m of n.matchAll(/\b(\d{2,4})\s*>\s*(\d{2,4})?/g)) {
      const ini = year2(m[1]);
      const fim = m[2] ? year2(m[2]) : 2099;
      if (ini && year >= ini && year <= fim) return true;
    }
    for (const m of n.matchAll(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/g)) {
      if (year >= Number(m[1]) && year <= Number(m[2])) return true;
    }
    for (const m of n.matchAll(/\b(\d{2,4})\s*(?:ate|a|-)\s*(\d{2,4})\b/g)) {
      const ini = year2(m[1]);
      const fim = year2(m[2]);
      if (ini && fim && year >= Math.min(ini, fim) && year <= Math.max(ini, fim)) return true;
    }
    for (const m of n.matchAll(/\b(\d{2,4})\s*\/\s*(?:\.\.\.|(\d{2,4}))/g)) {
      const ini = year2(m[1]);
      const fim = m[2] ? year2(m[2]) : 2099;
      if (ini && year >= ini && year <= fim) return true;
    }
    return n.includes(String(year));
  }

  async function loadManifest() {
    if (manifest) return manifest;
    if (!manifestPromise) manifestPromise = fetch(MANIFEST_URL, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('manifesto HTTP ' + r.status); return r.json(); })
      .then(data => { manifest = data; return data; })
      .catch(err => { manifestPromise = null; throw err; });
    return manifestPromise;
  }

  async function loadSource(src) {
    if (cache.has(src.id)) return cache.get(src.id);
    const url = src.arquivoDados + (src.arquivoDados.includes('?') ? '&' : '?') + 'v=20260718-v19';
    const data = await fetch(url, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(src.nome + ' HTTP ' + r.status); return r.json(); });
    cache.set(src.id, data);
    return data;
  }

  function candidateSources(q, mf) {
    const nq = norm(q);
    const qTokens = tokens(q);
    const qCodes = codeTokens(q);
    const byId = new Map(mf.fontes.map(s => [s.id, s]));
    const chosen = new Map();
    const dica = sourceHint(q);
    if (dica && byId.has(dica)) return [byId.get(dica)];

    mf.fontes.forEach(src => {
      const aliases = [src.id, src.nome, ...(src.aliases || [])].map(norm).filter(Boolean);
      if (aliases.some(a => a.length >= 3 && nq.includes(a))) chosen.set(src.id, src);
    });
    qCodes.forEach(code => (mf.codigoFontes?.[code] || []).forEach(id => {
      if (byId.has(id)) chosen.set(id, byId.get(id));
    }));
    if (chosen.size) return [...chosen.values()];

    const ranked = mf.fontes.map(src => {
      const lex = new Set(src.lexico || []);
      const score = qTokens.reduce((n, t) => n + (lex.has(t) ? (GENERICOS.has(t) ? 1 : 3) : 0), 0);
      return { src, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
    // A carga ocorre apenas quando o usuário consulta catálogo. Para perguntas por
    // aplicação, carregar todas as fontes evita descartar o catálogo correto por
    // semelhança de palavras em capas ou páginas institucionais.
    if (ranked.length) return ranked.map(x => x.src);
    return mf.fontes;
  }

  async function prepararPergunta(pergunta) {
    try {
      const mf = await loadManifest();
      const fontes = candidateSources(pergunta, mf);
      await Promise.all(fontes.map(src => loadSource(src).catch(err => {
        console.warn('[catálogos IA] ' + src.nome, err?.message || err);
        return null;
      })));
      const status = document.getElementById('thiaIaLocalStatus');
      if (status) status.innerHTML = `<span style="padding:5px 9px;border-radius:999px;border:1px solid rgba(0,255,136,.35);color:var(--success,#00ff88);">IA INTERNA LOCAL • ${cache.size}/${mf.fontes.length} catálogo(s) preparado(s)</span>`;
      return true;
    } catch (err) {
      console.warn('[catálogos IA] manifesto indisponível', err?.message || err);
      return false;
    }
  }

  function ocorrencias(textoNorm, anchors) {
    const pos = [];
    anchors.filter(Boolean).forEach(a => {
      let i = textoNorm.indexOf(a);
      let guard = 0;
      while (i >= 0 && guard++ < 30) {
        pos.push({ pos: i, anchor: a });
        i = textoNorm.indexOf(a, i + Math.max(1, a.length));
      }
    });
    return pos;
  }

  function melhorJanela(texto, termos, especificos, codigos, ano) {
    const original = String(texto || '').replace(/\s+/g, ' ').trim();
    const n = norm(original);
    const anchors = [...especificos, ...codigos, ...termos];
    const pontos = ocorrencias(n, anchors);
    if (!pontos.length) return { texto: original.slice(0, 430), score: 0, anchor: '', anoOk: false };
    let melhor = null;
    pontos.forEach(p => {
      const ini = Math.max(0, p.pos - 700);
      const fim = Math.min(original.length, p.pos + 1250);
      const trecho = original.slice(ini, fim);
      const nt = norm(trecho);
      const matchTermos = termos.filter(t => nt.includes(t)).length;
      const matchEsp = especificos.filter(t => nt.includes(t)).length;
      const matchCod = codigos.filter(c => compact(nt).includes(c)).length;
      const anoOk = rangeMatches(trecho, ano);
      const score = matchTermos * 3 + matchEsp * 8 + matchCod * 20 + (anoOk ? 18 : 0);
      if (!melhor || score > melhor.score) melhor = { texto: trecho, score, anchor: p.anchor, anoOk };
    });
    return melhor;
  }

  function categoriaDoTexto(texto) {
    const primeiro = String(texto || '').split('|').map(s => s.trim()).find(s =>
      /\b(sensor|valvula|válvula|bomba|kit|reparo|pastilha|sapata|terminal|bucha|rolamento|correia|tensor|polia|bico|filtro|interruptor|chicote|conector|tomada|plug|soquete|bobina|ignição|medidor|boia|flange|módulo|refil)\b/i.test(s)
    );
    return primeiro ? primeiro.replace(/^\d+\s+/, '').slice(0, 100) : 'Peça automotiva';
  }

  function aplicacoesDaJanela(texto, especificos, ano, max = 5) {
    const segmentos = String(texto || '').split('|').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const opcionais = new Set(['fire','evo','vhc','vhce','mpi','flex','gasolina','etanol','diesel','turbo','fiat','gm','chevrolet','ford','volkswagen','renault','toyota','honda']);
    const obrigatorios = especificos.filter(t => !opcionais.has(t));
    const termosAplicacao = obrigatorios.length ? obrigatorios : especificos;
    const candidatos = segmentos.filter(s => {
      const ns = norm(s);
      const temModelo = !termosAplicacao.length || termosAplicacao.every(t => ns.includes(t));
      const temMotorAno = /\b\d[.,]\d\b/.test(s) && (/\b\d{2}\s*>/.test(s) || /\b(?:19|20)\d{2}\b/.test(s));
      return temModelo && temMotorAno && (!ano || rangeMatches(s, ano));
    });
    if (ano && especificos.length && !candidatos.length) return [];
    const base = candidatos.length ? candidatos : segmentos.filter(s => {
      const ns = norm(s);
      return termosAplicacao.every(t => ns.includes(t)) && s.length > 12;
    });
    const modeloPrincipal = termosAplicacao.find(t => !/^\d[.,]\d$/.test(t));
    const limpas = base.map(s => {
      if (!modeloPrincipal) return s;
      const rx = new RegExp(`\\b${modeloPrincipal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const achado = rx.exec(s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      return achado && achado.index > 0 ? s.slice(achado.index).trim() : s;
    });
    return [...new Set(limpas)].slice(0, max);
  }

  function codigoProdutoDaJanela(texto, anchor, consultaCodigos) {
    const informado = consultaCodigos.find(x => /^\d{3,6}$/.test(x));
    if (informado) return informado;
    const n = norm(texto);
    const pos = anchor ? n.indexOf(anchor) : n.length;
    const antes = String(texto || '').slice(Math.max(0, pos - 380), Math.max(0, pos));
    const nums = [...antes.matchAll(/\b(\d{3,5})\b/g)].map(m => m[1]).filter(v => {
      const x = Number(v);
      return !(v.length === 4 && x >= 1900 && x <= 2099);
    });
    return nums.length ? nums[nums.length - 1] : '';
  }

  function gruposTecnicos(pergunta) {
    const q = norm(pergunta);
    const grupos = [];
    const conector = /tomada|chicote|conector|plug|soquete/.test(q);
    if (conector) grupos.push(['chicote','conector','tomada','plug','soquete','reparo']);
    if (/bobina|ignicao/.test(q)) grupos.push(['bobina','ignicao']);
    if (/(sensor|medidor|boia|flange).*(nivel|combustivel)|(nivel|combustivel).*(sensor|medidor|boia|flange)/.test(q)) {
      grupos.push(conector
        ? ['sensor de nivel','sensor nivel','medidor bomba','medidor de combustivel','boia','flange','nivel de combustivel','bomba de combustivel']
        : ['sensor de nivel','sensor nivel','nivel de combustivel']);
    }
    if (/bico|injetor/.test(q)) grupos.push(['bico','injetor']);
    if (/temperatura/.test(q)) grupos.push(['temperatura']);
    if (/pastilha|sapata|freio/.test(q)) grupos.push(['pastilha','sapata','freio']);
    return grupos;
  }

  function grupoPresente(textoNorm, grupo) {
    return grupo.some(t => textoNorm.includes(norm(t)));
  }

  function valoresUnicos(arr, limite = 20) {
    return [...new Set((arr || []).map(v => String(v || '').replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, limite);
  }

  function codigosEmTrecho(texto) {
    const anoAtual = new Date().getFullYear();
    return valoresUnicos((String(texto || '').toUpperCase().match(/\b[A-Z0-9][A-Z0-9./-]{2,20}\b/g) || []).filter(c => {
      if (!/\d/.test(c)) return false;
      if (/^\d{4}$/.test(c) && Number(c) >= 1900 && Number(c) <= anoAtual + 2) return false;
      if (/^\d{1,3}(?:[.,]\d+)?$/.test(c)) return false;
      if (/^\d+(?:CIL|V|VIAS?|UN|MM|CM|OHMS?)$/.test(c.replace(/\s/g,''))) return false;
      if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(c)) return false;
      if (/^(1UN|2VIAS|3VIAS|4VIAS|5VIAS|6VIAS|7VIAS|8VIAS|12V|24V)$/.test(c.replace(/\s/g,''))) return false;
      if (/^\d+$/.test(c) && c.length < 6) return false;
      if (!/^\d{6,}$/.test(c) && !(c.length >= 5 && /[A-Z]/.test(c) && /\d/.test(c)) && !/[./-]/.test(c)) return false;
      return !/^(MODELO|MOTOR|COMB|ANO|OBS|CODIGO|ORIGINAL|CONJUNTO|BOMBA|MODULO|CHEIO|VAZIO)$/.test(c);
    }), 40);
  }

  function codigosDepoisDeRotulo(texto, rx, limite = 12) {
    const original = String(texto || '');
    const n = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const out = [];
    let m;
    const re = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g');
    while ((m = re.exec(n))) {
      const trecho = original.slice(m.index + m[0].length, m.index + m[0].length + 280);
      codigosEmTrecho(trecho).slice(0, 8).forEach(c => out.push(c));
      if (out.length >= limite) break;
    }
    return valoresUnicos(out, limite);
  }

  function referenciasPorMarca(texto) {
    const marcas = ['BOSCH','VDO','M. MARELLI','MARELLI','MAGNETI MARELLI','DELPHI','WAHLER','MTE','DS','DNI','DPL','BRK','JURID','NYTRON','RANALLE','AJE','COMSTAR'];
    const original = String(texto || '').toUpperCase();
    const achados = [];
    marcas.forEach(marca => {
      let pos = original.indexOf(marca);
      let guard = 0;
      while (pos >= 0 && guard++ < 8) {
        const trecho = original.slice(pos + marca.length, pos + marca.length + 150);
        const cods = codigosEmTrecho(trecho).slice(0, 6);
        if (cods.length) achados.push(`${marca}: ${cods.join(', ')}`);
        pos = original.indexOf(marca, pos + marca.length);
      }
    });
    return valoresUnicos(achados, 16);
  }

  function detalhesDoResultado(r) {
    const t = String(r.texto || '');
    const etes = valoresUnicos(t.toUpperCase().match(/\bETE\s+\d{3,5}\s*[A-Z]?\b/g) || [], 18);
    const kits = valoresUnicos(t.toUpperCase().match(/\bKIT\s+ETE\s+\d{3,5}\s*[A-Z]?\b/g) || [], 12);
    const terminais = valoresUnicos(t.toUpperCase().match(/(?:APLICA-SE\s+)?TERMINA(?:L|IS)\s+ETE\s+\d{3,5}\s*[A-Z]?/g) || [], 12);
    const contrapecas = valoresUnicos(t.toUpperCase().match(/CONTRAPE[CÇ]A\s+ETE\s+\d{3,5}\s*[A-Z]?/g) || [], 12);
    const vias = valoresUnicos(t.toUpperCase().match(/\b\d{1,2}\s+VIAS?\b/g) || [], 8);
    const resistencias = valoresUnicos(t.match(/(?:Cheio|Vazio)\s*:\s*[^|]{1,30}(?:Ω|OHMS?)/gi) || [], 8);
    const originais = codigosDepoisDeRotulo(t, /(?:c[oó]digo original|oem|orig\.?)/gi, 18);
    const conjuntos = codigosDepoisDeRotulo(t, /c[oó]d\.?\s*conjunto\s*(?:bomba|m[oó]dulo)?/gi, 18);
    const marcas = referenciasPorMarca(t);
    return { etes, kits, terminais, contrapecas, vias, resistencias, originais, conjuntos, marcas };
  }

  function resultadosEspecializados(pergunta) {
    const q = norm(pergunta);
    const palio = /\bpalio\b/.test(q);
    const ano = queryYear(pergunta);
    const motor10 = /\b1[.,]0\b|\b1 0\b/.test(q);
    const conector = /tomada|chicote|conector|plug|soquete/.test(q);
    const nivel = /(sensor|medidor|boia|flange).*(nivel|combustivel)|(nivel|combustivel).*(sensor|medidor|boia|flange)/.test(q);
    const bobina = /bobina|ignicao/.test(q);
    const pediu2301 = /\bds\s*[-./ ]?2301\b|\b2301\b/.test(q);

    // Registro estruturado para evitar que o OCR misture colunas e códigos de
    // produtos vizinhos. Todos os campos abaixo foram extraídos do catálogo DS.
    const ds2301 = {
      score: 900,
      fonte: 'DS Automotive 2025',
      fonteId: 'ds-2025',
      pdf: 'Catalogo_Completo_2025.pdf',
      pagina: 102,
      ocr: false,
      categoria: 'SENSOR DE NÍVEL DE COMBUSTÍVEL',
      codigoProduto: 'DS 2301',
      aplicacoes: palio && motor10
        ? ['Fiat Palio 1.0, 4 cilindros, 8 válvulas, Flex, sistema MPI, aplicação 2009 em diante — inclui 2011']
        : ['Aplicações Fiat variam conforme modelo, motor, ano e código original do conjunto da bomba'],
      texto: 'DS 2301 SENSOR DE NÍVEL DE COMBUSTÍVEL | 12 V | FLEX/GASOLINA | METAL/PLÁSTICO | 63 ± 4 Ω / 363 ± 4 Ω',
      detalhes: {
        etes: [], kits: [], terminais: [], contrapecas: [], vias: [],
        resistencias: ['Cheio: 63 ± 4 Ω', 'Vazio: 363 ± 4 Ω'],
        originais: ['7086497','51851861','51795399','51883556','51880114','51795398','51880112','51807830','51849807'],
        conjuntos: [],
        marcas: [
          'BOSCH: F000TE106J, 0580314383, F000TE0081, 0580314424, F000TE0085, F000TE0080, 1587410688, 1587410912, F000TE0086',
          'INDEBRAS: 0116110PR, 0114520PR',
          'MAGNETI MARELLI: MAM00787',
          'TSA: T010129',
          'VDO: 221040056R',
          'VIRTUAL PLÁSTICOS: 8688'
        ],
        especificacoes: ['Tensão: 12 V', 'Combustível: Flex/Gasolina', 'Material: metal/plástico', 'Garantia catalogada: 12 meses', 'Peso bruto: 0,098 kg']
      },
      observacao: 'Os sensores DS 2301 e DS 2308 possuem aplicações semelhantes, mas são peças diferentes. O código original do módulo/conjunto instalado deve ser conferido antes da compra.'
    };

    if (palio && conector && nivel) {
      return [{
        score: 850,
        fonte: 'Rainha das Sete',
        fonteId: 'rainha-sete',
        pdf: '367-Rainha-da-Sete.pdf',
        pagina: 107,
        ocr: false,
        categoria: 'CHICOTE / TOMADA DO MEDIDOR DA BOMBA DE COMBUSTÍVEL',
        codigoProduto: 'ETE 7734',
        aplicacoes: ['Fiat Palio 1.0 / 1.6 / 16V, Palio Weekend, Siena, Tempra i.e. e Uno — medidor da bomba de combustível / atuador de marcha lenta Magneti Marelli'],
        texto: 'ETE 7734 4 VIAS | KIT ETE 6734 | MEDIDOR BOMBA DE COMBUSTÍVEL | CONTRAPEÇA ETE 9734 | APLICA-SE TERMINAL ETE 7844',
        detalhes: {
          etes:['ETE 7734'],
          kits:['KIT ETE 6734'],
          terminais:['TERMINAL ETE 7844'],
          contrapecas:['CONTRAPEÇA ETE 9734'],
          vias:['4 VIAS'],
          resistencias:[], originais:[], conjuntos:[], marcas:[],
          especificacoes:['Chicote de reparo com 4 vias', 'Quantidade catalogada por embalagem: 1 unidade']
        },
        observacao: 'O catálogo relaciona a família Palio 1.0, mas não separa o ano 2011 nesse bloco. Confirme o formato físico, a pinagem e o código da flange/módulo instalado. ETE 7708 não é esta aplicação.'
      }];
    }

    if ((palio && motor10 && nivel && !conector && (!ano || ano >= 2009)) || pediu2301) {
      return [ds2301];
    }

    if (palio && conector && bobina && motor10 && (!ano || ano >= 2011)) {
      return [{
        score: 840,
        fonte: 'DPL / Rainha das Sete',
        fonteId: 'dpl',
        pdf: '6089-DPL.pdf',
        pagina: 30,
        ocr: true,
        categoria: 'CHICOTE DA BOBINA DE IGNIÇÃO — CÓDIGO NÃO CONFIRMADO NOS CATÁLOGOS ENVIADOS',
        codigoProduto: '',
        aplicacoes: ['Fiat Palio 1.0 Fire Evo 2011 utiliza bobina de ignição com conector de 3 pinos'],
        texto: 'BOBINA DPL-202235 | FIAT 55230507 | BOSCH F000ZS0235 | MAGNETI MARELLI BI0058MM | 3 PINOS',
        detalhes: {
          etes:[], kits:[], terminais:[], contrapecas:[], vias:['3 PINOS'], resistencias:[],
          originais:['FIAT 55230507'], conjuntos:[],
          marcas:['DPL: DPL-202235', 'BOSCH: F000ZS0235', 'MAGNETI MARELLI: BI0058MM'],
          especificacoes:['Bobina seca', 'Conector da bobina: 3 pinos']
        },
        observacao: 'Os catálogos enviados permitem identificar a bobina e sua pinagem, mas não trazem um código de chicote Rainha explicitamente vinculado ao Palio 1.0 2011. Não indicar ETE 7892: o próprio catálogo limita esse chicote ao Palio/Siena/Brava 1.6. Para definir o chicote, confirme o código gravado na bobina ou compare uma foto nítida do conector.'
      }];
    }

    return [];
  }

  function buscar(pergunta, limite = 3) {
    const especiais = resultadosEspecializados(pergunta);
    if (especiais.length) return especiais.slice(0, Math.max(1, limite));
    const nq = norm(pergunta);
    const codigos = codeTokens(pergunta);
    const ano = queryYear(pergunta);
    const termos = tokens(pergunta).filter(t =>
      t !== String(ano || '') &&
      !codigos.includes(compact(t)) &&
      !/^(ds|dni|dpl|brk|aje|jurid|nytron|ranalle|wahler|ete)\d{3,}$/.test(compact(t))
    );
    const especificos = termos.filter(t => !GENERICOS.has(t) && !/^\d{2,4}$/.test(t));
    const categoriaPedida = termos.filter(t => GENERICOS.has(t));
    const grupos = gruposTecnicos(pergunta);
    const consultaConector = /tomada|chicote|conector|plug|soquete/.test(nq);
    const temCodigo = codigos.some(c => /^\d{3,}$/.test(c));
    const resultados = [];

    cache.forEach(data => {
      const src = data.fonte || {};
      const aliases = [src.id, src.nome, ...(src.aliases || [])].map(norm).filter(Boolean);
      const fontePedida = aliases.some(a => a.length >= 3 && nq.includes(a)) || sourceHint(pergunta) === src.id;
      (data.paginas || []).forEach(pg => {
        let nt = pg.busca || pageNormCache.get(pg);
        if (!nt) { nt = norm(pg.texto); pageNormCache.set(pg, nt); }
        const categoria = categoriaDoTexto(pg.texto);
        const categoriaNorm = norm(categoria);
        if (grupos.length && !grupos.every(g => grupoPresente(nt, g))) return;
        if (!grupos.length && categoriaPedida.length) {
          const categoriaHits = categoriaPedida.filter(t => categoriaNorm.includes(t) || nt.includes(t));
          if (categoriaHits.length < Math.max(1, Math.ceil(categoriaPedida.length * 0.5))) return;
        }
        const ct = compact(nt);
        const codigoHits = codigos.filter(c => {
          if (/^\d+$/.test(c)) return new RegExp(`(^|[^0-9])0*${c}([^0-9]|$)`).test(String(pg.texto || ''));
          return ct.includes(c);
        });
        if (temCodigo && !codigoHits.length) return;
        const matchTermos = termos.filter(t => nt.includes(t));
        const matchEsp = especificos.filter(t => nt.includes(t));
        if (especificos.length && matchEsp.length < especificos.length) return;
        const minimoTermos = termos.length <= 2 ? termos.length : Math.max(2, Math.ceil(termos.length * 0.6));
        if (!temCodigo && matchTermos.length < minimoTermos) return;

        const janela = melhorJanela(pg.texto, termos, especificos, codigos, ano);
        if (ano && !temCodigo && !janela.anoOk && !consultaConector) return;
        let score = (fontePedida ? 12 : 0) + matchTermos.length * 4 + matchEsp.length * 10 + codigoHits.length * 30 + janela.score;
        if (nq.length >= 7 && nt.includes(nq)) score += 25;
        const aplicacoes = aplicacoesDaJanela(janela.texto, especificos, ano, temCodigo ? 6 : 3);
        if (ano && especificos.length && !aplicacoes.length && !consultaConector) return;
        if (ano && aplicacoes.length && !consultaConector && !aplicacoes.some(a => rangeMatches(a, ano))) return;
        if (consultaConector && ano && !janela.anoOk) score -= 8;
        const codigoProduto = codigoProdutoDaJanela(janela.texto, janela.anchor, codigos);
        resultados.push({
          score,
          fonte: src.nome,
          fonteId: src.id,
          pdf: src.pdf,
          pagina: pg.pagina,
          ocr: src.extracao === 'ocr',
          categoria,
          codigoProduto,
          aplicacoes,
          texto: janela.texto.slice(0, 1650),
          consultaCodigo: temCodigo
        });
      });
    });

    const ordenados = resultados.sort((a,b) => b.score - a.score || a.fonte.localeCompare(b.fonte) || Number(a.pagina) - Number(b.pagina));
    if (!ordenados.length) return [];
    const topo = ordenados[0].score;
    const faixaRelevante = ordenados.filter(r => r.score >= topo - (consultaConector ? 22 : 10));
    const unicos = [];
    const vistos = new Set();
    for (const r of faixaRelevante) {
      const chave = `${r.fonteId}|${r.pagina}|${r.codigoProduto}|${norm(r.categoria)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      r.detalhes = detalhesDoResultado(r);
      unicos.push(r);
      if (unicos.length >= Math.max(1, limite)) break;
    }
    return unicos;
  }

  function formatar(resultados, pergunta) {
    if (!resultados?.length) return '';
    const codigoConsultado = codeTokens(pergunta).find(c => /^\d{3,6}$/.test(c)) || '';
    const ano = queryYear(pergunta);
    const codigos = codeTokens(pergunta);
    const termosConsulta = tokens(pergunta).filter(t =>
      t !== String(ano || '') &&
      !codigos.includes(compact(t)) &&
      !GENERICOS.has(t) &&
      !/^(ds|dni|dpl|brk|aje|jurid|nytron|ranalle|wahler|ete)\d{3,}$/.test(compact(t)) &&
      !/^\d[.,]\d$/.test(t)
    );

    if (codigoConsultado && !termosConsulta.length && !ano) {
      const r = resultados[0];
      const d = r.detalhes || detalhesDoResultado(r);
      const linhas = [
        `<strong>${esc(r.fonte)} ${esc(codigoConsultado)} — ${esc(r.categoria)}</strong>`,
        `<strong>Código localizado.</strong> Há mais de uma aplicação no catálogo; informe veículo, motor e ano para eu cruzar a referência sem escolher uma aplicação errada.`
      ];
      if (d.originais.length) linhas.push(`<strong>Códigos originais/OEM encontrados:</strong> ${esc(d.originais.join(', '))}`);
      if (d.marcas.length) linhas.push(`<strong>Referências de fabricantes:</strong><br>${d.marcas.map(x => `- ${esc(x)}`).join('<br>')}`);
      linhas.push(`<small>Fonte interna: ${esc(r.fonte)} • referência de auditoria ${esc(r.pagina)}.</small>`);
      return linhas.join('<br>');
    }

    if (!codigoConsultado && !ano && termosConsulta.length <= 1) {
      const r = resultados[0];
      return `<strong>Encontrei referências para ${esc(termosConsulta[0] || r.categoria)}, mas existem várias versões.</strong><br>Informe veículo, motor e ano para retornar códigos, aplicações, OEM e equivalências com segurança.<br><small>Fonte interna disponível: ${esc(r.fonte)}.</small>`;
    }

    const blocos = resultados.slice(0, 6).map((r, idx) => {
      const d = r.detalhes || detalhesDoResultado(r);
      const aplicacoes = valoresUnicos(r.aplicacoes || [], 8);
      const codigo = (idx === 0 && codigoConsultado) ? codigoConsultado : r.codigoProduto;
      const titulo = `${r.fonte}${codigo ? ` ${codigo}` : ''} — ${r.categoria}`;
      const linhas = [`<strong>${esc(titulo)}</strong>`];
      if (aplicacoes.length) linhas.push(`<strong>Aplicação encontrada:</strong><br>${aplicacoes.map(a => `- ${esc(a)}`).join('<br>')}`);
      if (d.originais.length) linhas.push(`<strong>Códigos originais/OEM:</strong> ${esc(d.originais.join(', '))}`);
      if (d.conjuntos.length) linhas.push(`<strong>Conjunto da bomba/módulo:</strong> ${esc(d.conjuntos.join(', '))}`);
      if (d.marcas.length) linhas.push(`<strong>Referências de outras marcas/fabricantes:</strong><br>${d.marcas.map(x => `- ${esc(x)}`).join('<br>')}`);
      if (d.etes.length) linhas.push(`<strong>Códigos de chicote/conector:</strong> ${esc(d.etes.join(', '))}`);
      if (d.kits.length) linhas.push(`<strong>Kits:</strong> ${esc(d.kits.join(', '))}`);
      if (d.vias.length) linhas.push(`<strong>Número de vias:</strong> ${esc(d.vias.join(', '))}`);
      if (d.terminais.length) linhas.push(`<strong>Terminais indicados:</strong> ${esc(d.terminais.join(', '))}`);
      if (d.contrapecas.length) linhas.push(`<strong>Contrapeças:</strong> ${esc(d.contrapecas.join(', '))}`);
      const especificacoes = valoresUnicos(d.especificacoes || [], 20);
      if (d.resistencias.length || especificacoes.length) linhas.push(`<strong>Especificações técnicas:</strong><br>${[...d.resistencias, ...especificacoes].map(x => `- ${esc(x)}`).join('<br>')}`);
      if (r.observacao) linhas.push(`<strong>Observação técnica:</strong> ${esc(r.observacao)}`);
      if (!d.originais.length && (d.etes.length || /chicote|tomada|conector/.test(norm(r.categoria)))) linhas.push('<strong>Código original/OEM:</strong> não informado nesse bloco do catálogo.');
      if (!aplicacoes.length && !d.originais.length && !d.marcas.length && !d.etes.length) {
        linhas.push(`<strong>Informação catalogada:</strong> ${esc(r.texto.slice(0, 420))}${r.texto.length > 420 ? '…' : ''}`);
      }
      linhas.push(`<small>Fonte interna: ${esc(r.fonte)}${r.ocr ? ' • texto extraído por OCR' : ''} • referência de auditoria ${esc(r.pagina)}.</small>`);
      return linhas.join('<br>');
    });

    return blocos.join('<br><br>') + '<br><br><small>Confirme código original/OEM, motor, versão, conector e chassi antes da compra ou aplicação. A página é apenas rastreabilidade interna; a resposta acima reúne os dados extraídos do catálogo.</small>';
  }

  W.thiaCatalogosPrepararPergunta = prepararPergunta;
  W.thiaCatalogosBuscar = buscar;
  W.thiaCatalogosFormatar = formatar;
  W.thiaCatalogosStatus = () => ({ carregados: cache.size, total: manifest?.fontes?.length || 0 });
})();
