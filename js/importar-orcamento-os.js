/**
 * Importador profissional de orçamento/planilha/PDF para O.S.
 * - Lê blocos reais da planilha PMSP sem confundir cabeçalho/dados do cliente/viatura com itens.
 * - Importa o orçamento TOTAL quando houver aprovado/não aprovado, para reaproveitamento/recuperação.
 * - Preenche a O.S. atual, mas nunca salva sozinho.
 * Powered by thIAguinho Soluções Digitais
 */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const toast = (m,t='ok') => window.toast ? window.toast(m,t) : alert(m);
  const txt = v => String(v == null ? '' : v).replace(/\s+/g,' ').trim();
  const up = v => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const num = v => {
    if (window.JOS?.parseNumberBR) return window.JOS.parseNumberBR(v);
    const s = String(v ?? '').replace(/R\$/gi,'').replace(/[^\d,.-]/g,'').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g,'').replace(',','.')) || 0;
    if (s.includes(',')) return parseFloat(s.replace(',','.')) || 0;
    return parseFloat(s) || 0;
  };
  const moeda = v => (num(v)||0).toFixed(2).replace('.', ',');
  const setv = (id,v) => { const el=$(id); if(el && v != null && String(v).trim() !== '') el.value = v; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const IGNORAR_LINHA = /(PLANILHA DE COMPOSICAO|SECRETARIA|POLICIA MILITAR|DADOS DA VIATURA|DADOS DA EMPRESA|DADOS DO CLIENTE|REFERENCIA|ORDEM DE EXECUCAO|MARCA\/VW|MODELO|ANO|PLACA|CHASSIS|PATRIMONIO|KM |PREFIXO|RAZAO SOCIAL|CNPJ|ENDERECO|TELEFONE|ORCAMENTISTA|REPRESENTANTE|UNIDADE|FISCAL DO CONTRATO|TOTAL DE|RESUMO POR SECAO|KPIS FINAIS|VALOR DO CONTRATO|VALOR APROVADO|TOTAL LIQUIDO|TOTAL BRUTO|DESCONTO TOTAL|QTDE \/ VALOR|VALOR LIQUIDO|ASSINATURA|FUNCAO|DOCUMENTO|IMAGEM)/i;
  const LINHA_HEADER_SERV = /(COD\.?\s*SERVICO|COD\.?\s*SERVIÇO|SERVI[CÇ]O\/GUINCHO|DESCRICAO DO SERVICO|DESCRI[CÇ][AÃ]O DO SERVI[CÇ]O)/i;
  const LINHA_HEADER_PECA = /(CODIGO DA PECA|C[OÓ]DIGO DA PE[CÇ]A|ITEM\s*\/\s*C[OÓ]DIGO|DESCRICAO.*QTD|DESCRI[CÇ][AÃ]O.*QTD)/i;
  const LINHA_FIM_BLOCO = /(TOTAL DE SERVI[CÇ]OS|TOTAL DE PE[CÇ]AS|KPIS FINAIS|RESUMO POR SECAO|RESUMO POR SEÇÃO|VALOR DO CONTRATO|VALOR APROVADO|ASSINATURA|TOTAL GERAL)/i;

  function limparDescricaoItem(desc){
    return txt(desc)
      .replace(/^SERVI[CÇ]O\s*[:\-]?\s*/i,'')
      .replace(/^PE[CÇ]A\s*[:\-]?\s*/i,'')
      .replace(/\s*\[[^\]]*\]\s*$/,'')
      .trim();
  }

  function tipoPorLinha(line, atual){
    const u = up(line);
    if (/^\s*PE[CÇ]A\b|\|\s*PE[CÇ]A\b|\bPE[CÇ]A\s*COD/.test(u)) return 'peca';
    if (/^\s*SERVI[CÇ]O\b|\|\s*SERVI[CÇ]O\b|\bMAO DE OBRA\b|\bMÃO DE OBRA\b|\bDESLOCAMENTO\s*\/\s*GUINCHO\b/.test(u)) return 'serv';
    return atual;
  }

  function extrairPlaca(cells){
    for (const c of cells) {
      const m = txt(c).toUpperCase().match(/[A-Z]{3}\-?\d[A-Z0-9]\d{2}/);
      if (m) return m[0].replace('-', '');
    }
    return '';
  }

  function linhaTemTextoDeItem(cells){
    const line = up(cells.join(' | '));
    if (!cells.some(Boolean)) return false;
    if (IGNORAR_LINHA.test(line) && !/^(PECA|PEÇA|SERVICO|SERVIÇO|DESLOCAMENTO)/.test(line)) return false;
    if (/^[-–—]+$/.test(line)) return false;
    return true;
  }

  function valorNumericoDeCelula(c){
    const s = txt(c);
    if (!s) return null;
    const semMoeda = s.replace(/R\$/gi,'').trim();
    // Células com texto técnico/código/sistema não entram como número para não transformar COD. 1932-1 em hora.
    if (/[A-Za-zÀ-ÿ]/.test(semMoeda) && !/^R\$/i.test(s)) return null;
    const v = num(s);
    return Number.isFinite(v) ? v : null;
  }
  function valoresNumericos(cells){
    return cells.map(valorNumericoDeCelula).filter(v => v !== null && (v > 0 || String(v) === '0'));
  }

  function pareceCodigoItem(s){
    const v = txt(s);
    if (!v) return false;
    if (/^(COD\.?|CODIGO|C[OÓ]DIGO|ITEM|REF\.?|REFERENCIA)$/i.test(v)) return false;
    return /^[A-Z0-9][A-Z0-9.\-\/]{3,28}$/i.test(v) && /\d/.test(v) && !/\s/.test(v);
  }

  function acharIndiceDescricao(cells){
    let best = -1, tam = 0;
    cells.forEach((c,i)=>{
      const s = txt(c);
      if (pareceCodigoItem(s)) return;
      if (s.length > tam && !/^R\$/.test(s) && !/^\d+[,.]?\d*$/.test(s) && !/^(PECA|PEÇA|SERVICO|SERVIÇO)$/i.test(s)) {
        tam = s.length; best = i;
      }
    });
    return best;
  }

  function parseLinhaItem(cells, modo){
    const clean = cells.map(txt);
    const line = clean.join(' | ');
    if (!linhaTemTextoDeItem(clean)) return null;
    const tipoForcado = tipoPorLinha(line, modo);
    const nums = valoresNumericos(clean);
    const total = nums.length ? nums[nums.length - 1] : 0;
    if (total <= 0 && !/DESLOCAMENTO\s*\/\s*GUINCHO/i.test(line)) return null;

    let codigo = '';
    for (const c of clean) {
      const s = txt(c);
      if (/^(COD\.?|C[OÓ]DIGO)$/i.test(s)) continue;
      if (pareceCodigoItem(s) && !/^\d+[,.]?\d*$/.test(s) && !/^(TOTAL|VALOR|DESC)$/i.test(s)) { codigo = s; break; }
    }

    const idxDesc = acharIndiceDescricao(clean);
    let desc = idxDesc >= 0 ? clean[idxDesc] : '';
    desc = limparDescricaoItem(desc);
    if (codigo && up(desc) === up(codigo)) {
      const alternativa = clean
        .map(limparDescricaoItem)
        .find(s => s && up(s) !== up(codigo) && !pareceCodigoItem(s) && !/^(PECA|PECA|SERVICO|SERVICO|QTD|VALOR|DESC)$/i.test(up(s)));
      if (alternativa) desc = alternativa;
    }
    if (!desc || /^(CODIGO|CÓDIGO|DESCRICAO|DESCRIÇÃO|TIPO|VALOR|DESC|QTD|TMO)$/i.test(desc)) return null;
    if (IGNORAR_LINHA.test(up(desc)) && !/DESLOCAMENTO|GUINCHO/i.test(desc)) return null;

    let qtdOuTempo = 1;
    if (nums.length >= 2) qtdOuTempo = nums[0];
    if (/DESLOCAMENTO\s*\/\s*GUINCHO/i.test(line)) {
      return { tipo:'serv', codigo:'GUINCHO', desc:'DESLOCAMENTO / GUINCHO - ' + desc.replace(/DESLOCAMENTO\s*\/\s*GUINCHO\s*[:\-]?/i,''), tempo:0, valor:total, origem:'importado_planilha' };
    }
    if (tipoForcado === 'peca') return { tipo:'peca', codigo, desc, qtd:qtdOuTempo || 1, valorUnit: total / (qtdOuTempo || 1), total, origem:'importado_planilha' };
    return { tipo:'serv', codigo, desc, tempo:qtdOuTempo || 0, valor:total, sistema:'IMPORTADO', origem:'importado_planilha' };
  }

  function parseSheetRows(rows){
    const out = {servicos:[], pecas:[], total:0, raw:rows, modeloOS:'', placa:'', km:'', diagnostico:''};
    let modo = '';
    let dentroNaoAprovados = false;
    const vistos = new Set();

    for (let ri=0; ri<rows.length; ri++) {
      const cells = (rows[ri] || []).map(txt);
      const line = cells.join(' | ');
      const U = up(line);
      if (!cells.some(Boolean)) continue;

      const placa = extrairPlaca(cells); if (placa && !out.placa) out.placa = placa;
      if (/REFERENCIA|REFERÊNCIA|ORDEM DE EXECUCAO|ORDEM DE EXECUÇÃO/.test(U) && !out.modeloOS) out.modeloOS = cells.filter(Boolean).join(' ').slice(0,160);
      const nums = valoresNumericos(cells);
      if (/TOTAL (LIQUIDO|LÍQUIDO|DO CONTRATO|APROVADO|GERAL|DA O\.S|DA OS)/.test(U) && nums.length) out.total = Math.max(out.total, nums[nums.length-1]);

      if (/ITENS NAO APROVADOS|ITENS NÃO APROVADOS/.test(U)) { dentroNaoAprovados = true; modo='nao_aprovado'; continue; }
      if (LINHA_HEADER_SERV.test(U) && !/DADOS DA/.test(U)) { modo='serv'; dentroNaoAprovados=false; continue; }
      if (LINHA_HEADER_PECA.test(U) && !/DADOS DA/.test(U)) { modo='peca'; dentroNaoAprovados=false; continue; }
      if (LINHA_FIM_BLOCO.test(U) && !/ITENS NAO APROVADOS|ITENS NÃO APROVADOS/.test(U)) { modo=''; continue; }
      if (!modo) continue;

      const tipoInferido = modo === 'nao_aprovado' ? tipoPorLinha(line, 'serv') : modo;
      const item = parseLinhaItem(cells, tipoInferido);
      if (!item) continue;
      const key = `${item.tipo}|${up(item.codigo)}|${up(item.desc)}|${Math.round(num(item.total || item.valor)*100)}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      if (item.tipo === 'peca') out.pecas.push(item);
      else out.servicos.push(item);
    }
    return out;
  }

  function adicionarServicoImportado(s){
    const payload = {
      desc:s.desc||'', tempo:s.tempo||0, valor:s.valor||0,
      codigoTabela:s.codigo||'', sistemaTabela:s.sistema||'IMPORTADO', secaoHoraLabel:s.sistema||'IMPORTADO', origem:s.origem||'importado'
    };
    if (typeof window.renderServicoOSRow === 'function') { window.renderServicoOSRow(payload); return; }
    if (typeof window.adicionarServicoOS === 'function') {
      window.adicionarServicoOS();
      const rows = document.querySelectorAll('#containerServicosOS > div');
      const row = rows[rows.length-1];
      if(row){
        const d=row.querySelector('.serv-desc'); if(d) d.value=payload.desc;
        const t=row.querySelector('.serv-tempo'); if(t) t.value=String(payload.tempo||'').replace('.',',');
        const v=row.querySelector('.serv-valor'); if(v) v.value=moeda(payload.valor);
      }
    }
  }

  function adicionarPecaImportada(p){
    if (typeof window.adicionarPecaOS === 'function') {
      window.adicionarPecaOS();
      const rows = document.querySelectorAll('#containerPecasOS [data-peca-avulsa="1"], #containerPecasOS > div:not(.cilia-peca-wrap)');
      const row = rows[rows.length-1];
      if(row){
        // Em cliente normal a linha padrao nasce como select de estoque.
        // Orcamento importado precisa virar peca avulsa real, senao codigo/descricao
        // ficam presos no select e podem aparecer trocados na O.S.
        if (!row.querySelector('.peca-desc-livre')) {
          row.dataset.pecaAvulsa = '1';
          row.style.cssText = 'display:grid;grid-template-columns:120px minmax(260px,1fr) 70px 100px 100px 32px;gap:8px;align-items:center;background:rgba(255,165,0,0.06);padding:8px;border-radius:3px;border:1px solid rgba(255,165,0,0.25);';
          row.innerHTML = `
            <input type="text" class="j-input peca-codigo" placeholder="Codigo original" style="font-family:var(--fm);font-size:0.78rem;">
            <input type="text" class="j-input peca-desc-livre" placeholder="Descricao da peca" oninput="window.calcOSTotal()">
            <input type="number" class="j-input peca-qtd" value="1" min="1" placeholder="Qtd" oninput="window.calcOSTotal()">
            <input type="text" inputmode="decimal" class="j-input peca-custo" value="0,00" placeholder="Custo" oninput="window.calcOSTotal()">
            <input type="text" inputmode="decimal" class="j-input peca-venda" value="0,00" placeholder="Venda" oninput="window.calcOSTotal()">
            <button type="button" onclick="this.parentElement.remove();window.calcOSTotal()" style="background:rgba(255,59,59,0.1);border:1px solid rgba(255,59,59,0.3);border-radius:2px;color:var(--danger);cursor:pointer;width:32px;height:32px;">x</button>
          `;
        }
        const cod=row.querySelector('.peca-codigo'); if(cod) cod.value=p.codigo||'';
        const desc=row.querySelector('.peca-desc-livre'); if(desc) desc.value=p.desc||'';
        const qtd=row.querySelector('.peca-qtd'); if(qtd) qtd.value=p.qtd||1;
        const venda=row.querySelector('.peca-venda'); if(venda) venda.value=moeda(num(p.valorUnit)||num(p.total)||0);
      }
    }
  }

  function previewDados(dados){
    const exemplosS = dados.servicos.slice(0,5).map(s=>'• '+s.desc+' — R$ '+moeda(s.valor)).join('\n');
    const exemplosP = dados.pecas.slice(0,5).map(p=>'• '+(p.codigo?`[${p.codigo}] `:'')+p.desc+' — '+(p.qtd||1)+' x R$ '+moeda(p.valorUnit)).join('\n');
    return `Importar orçamento encontrado?\n\nServiços: ${dados.servicos.length}\nPeças: ${dados.pecas.length}\nTotal detectado: R$ ${moeda(dados.total||0)}\n\nPrimeiros serviços:\n${exemplosS || '—'}\n\nPrimeiras peças:\n${exemplosP || '—'}\n\nAtenção: dados de cabeçalho/cliente/viatura foram ignorados como itens. Revise antes de salvar.`;
  }

  function aplicarDados(dados){
    if (!dados.servicos.length && !dados.pecas.length) { alert('Não encontrei peças/serviços de orçamento com segurança. Nenhum item foi importado.'); return; }
    if (!confirm(previewDados(dados))) return;
    if (dados.placa) setv('osPlaca', dados.placa);
    if (dados.km) setv('osKm', dados.km);
    if (dados.diagnostico) setv('osDiagnostico', dados.diagnostico);
    if (dados.relato) setv('osRelato', dados.relato);
    if (dados.modeloOS) setv('osModeloOS', dados.modeloOS);

    const limpar = confirm('Deseja limpar peças/serviços atuais antes de importar?\nOK = limpar e importar.\nCancelar = apenas acrescentar.');
    if (limpar) {
      const cs=$('containerServicosOS'); if(cs) cs.innerHTML='';
      const cp=$('containerPecasOS'); if(cp) cp.innerHTML='';
    }
    dados.servicos.forEach(adicionarServicoImportado);
    dados.pecas.forEach(adicionarPecaImportada);
    if (typeof window.calcOSTotal === 'function') window.calcOSTotal();
    toast(`✓ Orçamento importado com segurança: ${dados.servicos.length} serviço(s), ${dados.pecas.length} peça(s). Revise placa, mecânico, defeito e valores antes de salvar.`, 'ok');
  }

  async function importarXLSX(file){
    const buf = await file.arrayBuffer();
    if (!window.XLSX) throw new Error('Biblioteca XLSX não carregada.');
    const wb = XLSX.read(buf, {type:'array', cellDates:false});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
    aplicarDados(parseSheetRows(rows));
  }

  async function carregarPdfJs(){
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve, reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload=resolve; s.onerror=()=>reject(new Error('Não foi possível carregar o leitor de PDF.'));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return window.pdfjsLib;
  }

  async function importarPDF(file){
    const pdfjs = await carregarPdfJs();
    const arr = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({data:arr}).promise;
    let text='';
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += '\n' + content.items.map(x=>x.str).join('   ');
    }
    const linhas = text.split(/\n/).map(x=>x.split(/\s{2,}/)).filter(x=>x.some(c=>txt(c)));
    aplicarDados(parseSheetRows(linhas));
  }

  window.importarOrcamentoOSArquivo = async function(input){
    try{
      const file = input?.files?.[0];
      if(!file) return;
      const name = file.name.toLowerCase();
      if (/\.pdf$/.test(name)) await importarPDF(file);
      else if (/\.(xlsx|xls|csv)$/.test(name)) await importarXLSX(file);
      else throw new Error('Formato não suportado. Use XLSX, XLS, CSV ou PDF.');
    } catch(e){
      console.error('[Importar Orçamento OS]', e);
      toast('✕ Erro ao importar orçamento: ' + (e.message || e), 'err');
    } finally { try{ input.value=''; }catch(e){} }
  };
})();
