/*
 * thIAguinho IA local
 * Motor interno baseado em dados carregados, regras e cerebro JSON.
 * Nao chama provedor externo.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;

  W.iaHistorico = W.iaHistorico || [];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function norm(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }

  function moeda(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num(v));
  }

  function dataISO(v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return raw.slice(0, 10);
  }

  function dataBR(v) {
    const iso = dataISO(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '-';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }

  function textoLivre(obj, campos) {
    return (campos || []).map(k => {
      try {
        const val = k.split('.').reduce((acc, p) => acc == null ? acc : acc[p], obj);
        if (Array.isArray(val)) return val.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ');
        if (val && typeof val === 'object') return JSON.stringify(val);
        return String(val == null ? '' : val);
      } catch (_) {
        return '';
      }
    }).join(' ');
  }

  function isPagoStatus(v) {
    const s = norm(v);
    return /\b(pago|paga|liquidado|liquidada|baixado|baixada|quitado|quitada|recebido|recebida)\b/.test(s);
  }

  function isCanceladoStatus(v) {
    return /\b(cancelado|cancelada|estornado|estornada|recusado|recusada)\b/.test(norm(v));
  }

  function isPendenteStatus(v) {
    return !isPagoStatus(v) && !isCanceladoStatus(v);
  }

  function textoFinanceiro(f) {
    return textoLivre(f, [
      'id','tipo','status','desc','descricao','observacao','obs','fornecedor','fornecedorNome',
      'cliente','clienteNome','numero','numeroNF','nf','nota','documento','osId','osNumero',
      'placa','veiculo','mecId','mecNome','responsavel','funcionario','colaborador','vinculo',
      'forma','pgto','categoria','subcategoria','pedidoFornecedor','documentoNumero','documentoTipo',
      'servicoDescricao','conferenciaDocumento','origem'
    ]);
  }

  function financeiroEhComissao(f) {
    return !!(f && (f.isComissao || /comiss/.test(norm(textoFinanceiro(f)))));
  }

  function funcionarioTexto(f) {
    return textoLivre(f, ['id','nome','usuario','cargo','apelido','email','wpp']);
  }

  function tokensPerguntaFuncionario(q) {
    return norm(q)
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3)
      .filter(t => !/^\d{1,2}[\/.-]\d{1,2}/.test(t))
      .filter(t => !/^(comiss|comissao|comissoes|pagar|pagas|pago|pendente|funcionario|mecanico|mecanicos|colaborador|colaboradores|responsavel|responsaveis|servico|servicos|atendeu|atendimentos|realizou|executou|trabalhou|veiculo|veiculos|ordem|ordens|relatorio|valor|valores|total|para|ate|dia|dias|quais|qual|dos|das|do|da|de|com|sem|no|na|nos|nas|os|as|financeiro)$/.test(t));
  }

  function limparTermoFuncionarioPergunta(v) {
    return norm(v)
      .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, ' ')
      .replace(/\b(?:ate|entre|periodo|periodos|dia|dias|servico|servicos|atendimento|atendimentos|realizou|executou|trabalhou|veiculo|veiculos|ordem|ordens|o\.?s\.?)\b/g, ' ')
      .replace(/\b(o|a|os|as|do|da|de|dos|das|no|na|nos|nas)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function funcionarioPorNomeExtraido(ctx, termo) {
    const equipe = Array.isArray(ctx?.equipe) ? ctx.equipe : [];
    const alvo = limparTermoFuncionarioPergunta(termo);
    if (alvo.length < 3) return null;
    let melhor = null;
    let melhorScore = 0;
    const alvoTokens = alvo.split(/\s+/).filter(t => t.length >= 3);
    equipe.forEach(f => {
      const candidatos = [f.nome, f.usuario, f.apelido, f.login, f.email]
        .map(v => norm(v).trim())
        .filter(v => v.length >= 3);
      let score = 0;
      candidatos.forEach(c => {
        if (!c) return;
        if (c === alvo) score = Math.max(score, 3000 + c.length);
        else if (c.includes(alvo) || alvo.includes(c)) score = Math.max(score, 2000 + Math.min(c.length, alvo.length));
        else {
          const cTokens = c.split(/\s+/).filter(t => t.length >= 3);
          const comuns = alvoTokens.filter(t => cTokens.includes(t)).length;
          if (comuns) score = Math.max(score, comuns * 100 + cTokens.join(' ').length);
        }
      });
      if (score > melhorScore) { melhor = f; melhorScore = score; }
    });
    return melhorScore >= 100 ? melhor : null;
  }

  function funcionarioPorPergunta(ctx, q) {
    const equipe = Array.isArray(ctx.equipe) ? ctx.equipe : [];
    const pergunta = norm(q);
    const termosQ = tokensPerguntaFuncionario(q);
    const tokensQ = new Set(pergunta.split(/\s+/).filter(Boolean));
    let melhor = null;
    let melhorScore = 0;
    equipe.forEach(f => {
      const nome = norm(funcionarioTexto(f));
      if (!nome) return;
      let score = 0;
      const aliases = [f.nome, f.usuario, f.apelido, f.login]
        .map(v => norm(v).trim())
        .filter(Boolean);
      aliases.forEach(alias => {
        if (alias.length >= 3) {
          if (pergunta.includes(alias)) score += 1000 + alias.length;
        } else if (tokensQ.has(alias)) {
          score += 100 + alias.length;
        }
      });
      termosQ.forEach(t => { if (nome.includes(t)) score += t.length; });
      const nomeTokens = norm(f.nome || '').split(/\s+/).filter(Boolean);
      nomeTokens.forEach(t => { if (t.length >= 3 && tokensQ.has(t)) score += t.length + 2; });
      if (score > melhorScore) { melhor = f; melhorScore = score; }
    });
    return melhorScore >= 3 ? melhor : null;
  }

  function financeiroDoFuncionario(f, func) {
    if (!func) return true;
    const ids = [func.id, func.uid, func.userId, func.usuario].map(v => String(v || '').trim()).filter(Boolean);
    const nome = norm(func.nome || func.usuario || '');
    const hay = norm(textoFinanceiro(f));
    if (ids.some(id => [f.mecId, f.funcId, f.funcionarioId, f.colaboradorId, f.userId, f.vinculo].map(v => String(v || '')).includes(id))) return true;
    if (nome && hay.includes(nome)) return true;
    const partes = nome.split(/\s+/).filter(t => t.length >= 3);
    return partes.length && partes.every(t => hay.includes(t));
  }

  function tipoFinanceiro(f) {
    return norm([f.tipo, f.natureza, f.operacao, f.categoria, f.desc, f.descricao].join(' '));
  }

  function formatarLinhaFinanceiro(f) {
    const desc = f.desc || f.descricao || f.titulo || f.nome || 'Lançamento';
    const venc = dataBR(f.venc || f.vencimento || f.data || f.dataPagamento || f.createdAt);
    const forma = f.pgto || f.forma || f.formaPagamento || '';
    const status = f.status || '-';
    return `- ${esc(venc)} | ${esc(desc)} | ${moeda(f.valor || f.total || 0)} | ${esc(status)}${forma ? ` | ${esc(forma)}` : ''}`;
  }

  function extrairNumeroNF(q) {
    const m = String(q || '').match(/\b(?:nf|nota\s*fiscal)?\s*([0-9]{3,})\b/i);
    return m ? m[1] : '';
  }

  function notaTexto(n) {
    return textoLivre(n, [
      'id','numero','numeroNF','nf','chave','fornecedorNome','fornecedorSnapshot.nome',
      'fornecedorSnapshot.cnpj','cnpj','dataNF','emissao','status','observacao','xmlNome'
    ]);
  }

  function formatarLinhaNota(n) {
    return `- NF ${esc(n.numero || n.numeroNF || n.nf || '-')} | ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || n.fornecedor || '-')} | ${esc(dataBR(n.dataNF || n.emissao || n.createdAt))} | ${moeda(n.totalNF || n.totalItens || n.valor || 0)}`;
  }

  function primeiroDiaMesISO(dt) {
    const d = dt instanceof Date ? dt : new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function ultimoDiaMesISO(dt) {
    const d = dt instanceof Date ? dt : new Date(dt);
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
    return `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`;
  }

  function extrairPeriodoNaturalIA(texto) {
    const explicito = extrairPeriodoPergunta(texto);
    if (explicito) return Object.assign({ origem: 'data_explicita' }, explicito);
    const q = norm(texto);
    const agora = new Date();
    const hoje = hojeISO();
    if (/\bhoje\b/.test(q)) return { inicio: hoje, fim: hoje, origem: 'hoje' };
    if (/\bontem\b/.test(q)) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 12, 0, 0);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { inicio: iso, fim: iso, origem: 'ontem' };
    }
    // Linguagem natural operacional: "no dia 10" significa o dia 10 do mês/ano atuais.
    // Se o mês for informado por nome, respeita-o. Não adivinha ano diferente do atual sem indicação.
    const mesesDia = { janeiro:1, fevereiro:2, marco:3, abril:4, maio:5, junho:6, julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };
    const diaNatural = q.match(/\bdia\s+(\d{1,2})(?:\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?(?:\s+de\s+(20\d{2}))?\b/);
    if (diaNatural) {
      const dia = Number(diaNatural[1]);
      const mes = diaNatural[2] ? mesesDia[diaNatural[2]] : (agora.getMonth() + 1);
      const ano = Number(diaNatural[3] || agora.getFullYear());
      const iso = dataValidaPeriodo(dia, mes, ano);
      if (iso) return { inicio: iso, fim: iso, origem: 'dia_natural' };
    }
    if (/\b(?:este|esse|nesse|neste)\s+mes\b|\bmes\s+atual\b/.test(q)) {
      return { inicio: primeiroDiaMesISO(agora), fim: ultimoDiaMesISO(agora), origem: 'mes_atual' };
    }
    if (/\bmes\s+passado\b|\bultimo\s+mes\b/.test(q)) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 12, 0, 0);
      return { inicio: primeiroDiaMesISO(d), fim: ultimoDiaMesISO(d), origem: 'mes_passado' };
    }
    if (/\b(?:este|esse|neste|nesse)\s+ano\b|\bano\s+atual\b/.test(q)) {
      return { inicio: `${agora.getFullYear()}-01-01`, fim: `${agora.getFullYear()}-12-31`, origem: 'ano_atual' };
    }
    const meses = { janeiro:1, fevereiro:2, marco:3, abril:4, maio:5, junho:6, julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12 };
    for (const [nome, mes] of Object.entries(meses)) {
      if (!new RegExp(`\\b${nome}\\b`).test(q)) continue;
      const anoMatch = q.match(new RegExp(`\\b${nome}\\s+(?:de\\s+)?(20\\d{2})\\b`));
      const ano = Number(anoMatch?.[1] || agora.getFullYear());
      const d = new Date(ano, mes - 1, 1, 12, 0, 0);
      return { inicio: primeiroDiaMesISO(d), fim: ultimoDiaMesISO(d), origem: 'mes_nomeado' };
    }
    return null;
  }

  function fornecedorTextoIA(f) {
    return textoLivre(f, ['id','nome','razaoSocial','fantasia','nomeFantasia','apelido','cnpj','cpf','documento','email','telefone','wpp']);
  }

  function aliasesFornecedorIA(f) {
    return uniq([f?.nome, f?.razaoSocial, f?.fantasia, f?.nomeFantasia, f?.apelido])
      .map(v => norm(v).trim()).filter(v => v.length >= 3);
  }

  function fornecedorPorPerguntaIA(ctx, texto) {
    const lista = Array.isArray(ctx?.fornecedores) ? ctx.fornecedores : [];
    const q = norm(texto).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!lista.length || !q) return null;
    const tokensQ = new Set(q.split(/\s+/).filter(t => t.length >= 3));
    const pontuados = lista.map(f => {
      let score = 0;
      aliasesFornecedorIA(f).forEach(alias => {
        if (q.includes(alias)) score = Math.max(score, 5000 + alias.length);
        const toks = alias.split(/\s+/).filter(t => t.length >= 3);
        const comuns = toks.filter(t => tokensQ.has(t)).length;
        if (comuns) score = Math.max(score, comuns * 250 + alias.length);
      });
      const doc = String(f?.cnpj || f?.cpf || f?.documento || '').replace(/\D/g, '');
      if (doc && q.replace(/\D/g, '').includes(doc)) score = Math.max(score, 6000 + doc.length);
      return { f, score };
    }).filter(x => x.score >= 250).sort((a,b) => b.score - a.score);
    if (!pontuados.length) return null;
    // Em empate real, nao escolhe fornecedor por adivinhacao.
    if (pontuados.length > 1 && pontuados[1].score === pontuados[0].score) return null;
    return pontuados[0].f;
  }

  function fornecedorIdFinanceiroIA(f, ctx) {
    if (!f) return '';
    if (f.fornecedorId) return String(f.fornecedorId);
    if (String(f.vinculo || '').startsWith('F_')) return String(f.vinculo).slice(2);
    const candidato = String(f.fornecedor || '').trim();
    if (candidato && (ctx.fornecedores || []).some(fr => String(fr.id) === candidato)) return candidato;
    const hay = norm(textoFinanceiro(f));
    const achado = (ctx.fornecedores || []).find(fr => aliasesFornecedorIA(fr).some(alias => alias && hay.includes(alias)));
    return achado ? String(achado.id) : '';
  }

  function financeiroDoFornecedorIA(f, fornecedor, ctx) {
    if (!fornecedor) return false;
    const fid = String(fornecedor.id || '').trim();
    if (fid && fornecedorIdFinanceiroIA(f, ctx) === fid) return true;
    const hay = norm(textoFinanceiro(f));
    return aliasesFornecedorIA(fornecedor).some(alias => alias && hay.includes(alias));
  }

  function financeiroEhSaidaIA(f) {
    const tipo = tipoFinanceiro(f);
    if (/entrada|receb/.test(tipo)) return false;
    return /saida|saída|despesa|pagar|compra|nf|boleto/.test(tipo) || !/entrada|receb/.test(tipo);
  }

  function financeiroEhBoletoIA(f) {
    if (!f) return false;
    if (f.boletoAgrupado === true || f.boletoRealDoPacote === true || f.tipoDocumento === 'boleto_agrupado') return true;
    return /boleto|duplicata/.test(norm([f.pgto,f.forma,f.formaPagamento,f.tipoDocumento,f.desc,f.descricao].join(' ')));
  }

  function dataPagamentoFinanceiroIA(f) {
    return f?.dataPgto || f?.pagoEm || f?.dataPagamento || f?.dataBaixa || f?.baixadoEm || f?.pagamentoEm || f?.liquidadoEm || '';
  }

  function periodoRotuloIA(periodo) {
    if (!periodo) return '';
    if (periodo.inicio === periodo.fim) return ` em ${dataBR(periodo.inicio)}`;
    return ` de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`;
  }

  function financeiroEhServicoTerceirizadoIA(f) {
    return !!f && (
      norm(f.categoria || '') === 'servico_terceirizado' ||
      norm(f.origem || '') === 'os_servico_terceirizado' ||
      f.terceirizado === true
    );
  }

  function responderServicosTerceirizadosFinanceiro(texto, q, ctx, opts) {
    const intencaoExplicita = /terceiriz|prestador|nfs(?:-?e)?|nota\s+fiscal\s+de\s+servico|nota\s+de\s+servico|pedido\s+(?:do|da|de)?\s*fornecedor|pedido\s+(?:n|numero|nº|#)|retifica/.test(q);
    if (!intencaoExplicita) return null;
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar custos e documentos de servicos terceirizados.';

    let lista = (ctx.financeiro || []).filter(f => !isCanceladoStatus(f.status) && financeiroEhServicoTerceirizadoIA(f));
    const fornecedor = fornecedorPorPerguntaIA(ctx, texto);
    if (fornecedor) lista = lista.filter(f => financeiroDoFornecedorIA(f, fornecedor, ctx));

    const pedidoMatch = norm(texto).match(/\bpedido\s*(?:(?:numero|n|nº|#)\s*)?([a-z0-9._/-]{2,})\b/);
    if (pedidoMatch && !/^(do|da|de|fornecedor)$/.test(pedidoMatch[1])) {
      const pedido = pedidoMatch[1];
      lista = lista.filter(f => norm(f.pedidoFornecedor || '').includes(pedido));
    }

    const periodo = extrairPeriodoNaturalIA(texto);
    if (periodo) {
      lista = lista.filter(f => periodoContem(periodo, f.documentoEmissao || f.venc || f.createdAt || f.updatedAt));
    }

    const termos = norm(texto).split(/\s+/).filter(t => t.length >= 4 && !/^(servico|servicos|terceirizado|terceirizada|terceirizados|terceirizadas|prestador|prestadores|fornecedor|fornecedores|pedido|pedidos|numero|nota|fiscal|documento|documentos|nfs|nfse|quanto|valor|custo|custos|pago|pagos|pendente|pendentes|conferido|conferidos|do|da|dos|das|para|com|sem|este|essa|esse|mes|hoje)$/.test(t));
    const termosBusca = termos.filter(t => !/^\d+$/.test(t));
    if (!fornecedor && termosBusca.length) {
      const candidatos = lista.filter(f => {
        const hay = norm(textoFinanceiro(f));
        return termosBusca.every(t => hay.includes(t));
      });
      if (candidatos.length) lista = candidatos;
    }

    if (!lista.length) {
      return 'Nao encontrei servico terceirizado/documento de prestador que corresponda exatamente aos filtros informados.';
    }

    lista.sort((a,b) => String(b.documentoEmissao || b.updatedAt || b.createdAt || '').localeCompare(String(a.documentoEmissao || a.updatedAt || a.createdAt || '')));
    const linhas = lista.slice(0,30).map(f => {
      const forn = f.fornecedorNome || fornecedor?.nome || '-';
      const serv = f.servicoDescricao || f.desc || 'Servico terceirizado';
      const ped = f.pedidoFornecedor ? `Pedido ${esc(f.pedidoFornecedor)}` : 'Pedido nao informado';
      const doc = f.documentoNumero ? `${esc(f.documentoTipo || 'Documento')} ${esc(f.documentoNumero)}` : 'Documento pendente';
      const conf = f.conferenciaDocumento ? ` | conferencia: ${esc(String(f.conferenciaDocumento).replace(/_/g,' '))}` : '';
      return `- ${esc(forn)} | ${esc(serv)} | ${ped} | ${doc} | ${moeda(f.valor || 0)} | ${esc(f.status || 'Pendente')}${conf}`;
    }).join('<br>');
    const total = lista.reduce((s,f)=>s+num(f.valor||0),0);
    const aberto = lista.filter(f=>isPendenteStatus(f.status)).reduce((s,f)=>s+num(f.valor||0),0);
    const pago = lista.filter(f=>isPagoStatus(f.status)).reduce((s,f)=>s+num(f.valor||0),0);
    const nomeFornecedor = fornecedor ? ` de ${esc(fornecedor.nome || fornecedor.razaoSocial || fornecedor.id)}` : '';
    return `<strong>Servicos terceirizados${nomeFornecedor}${periodoRotuloIA(periodo)} (${lista.length}):</strong><br>${linhas}<br><br><strong>Total registrado:</strong> ${moeda(total)} | em aberto ${moeda(aberto)} | pago ${moeda(pago)}.`;
  }

  function responderFinanceiroFornecedorPreciso(texto, q, ctx, opts) {
    const falaFinanceiroFornecedor = /fornecedor|fornec|boleto|boletos|duplicata|gastei|gasto|gastos|paguei|pago|pagamento|comprei|compras|despesa|quanto.*(?:gastei|paguei)/.test(q);
    if (!falaFinanceiroFornecedor) return null;
    const fornecedor = fornecedorPorPerguntaIA(ctx, texto);
    if (!fornecedor) return null;
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar valores financeiros de fornecedores.';

    const periodo = extrairPeriodoNaturalIA(texto);
    const baseFornecedor = (ctx.financeiro || []).filter(f => !isCanceladoStatus(f.status) && financeiroEhSaidaIA(f) && financeiroDoFornecedorIA(f, fornecedor, ctx));
    const nome = fornecedor.nome || fornecedor.razaoSocial || fornecedor.fantasia || fornecedor.id || 'fornecedor';
    const querGasto = /quanto.*(?:gastei|paguei)|\bgastei\b|\bpaguei\b|\bgasto\b|\bgastos\b|total.*pago/.test(q);
    const querBoletos = /\bboletos?\b|duplicata/.test(q);

    if (querGasto) {
      const pagasTodas = baseFornecedor.filter(f => isPagoStatus(f.status));
      const semDataPagamento = periodo ? pagasTodas.filter(f => !dataISO(dataPagamentoFinanceiroIA(f))) : [];
      let pagas = pagasTodas;
      if (periodo) pagas = pagas.filter(f => periodoContem(periodo, dataPagamentoFinanceiroIA(f)));
      const totalPago = pagas.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      let pendentes = baseFornecedor.filter(f => isPendenteStatus(f.status));
      if (periodo) pendentes = pendentes.filter(f => periodoContem(periodo, f.venc || f.vencimento || f.createdAt));
      const totalPendente = pendentes.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      const detalhe = pagas.slice(0, 20).map(formatarLinhaFinanceiro).join('<br>');
      const avisoSemData = semDataPagamento.length ? `<br><small>${semDataPagamento.length} lan&ccedil;amento(s) marcado(s) como pago n&atilde;o possuem data de pagamento registrada e, por fidelidade, n&atilde;o foram atribu&iacute;dos a este per&iacute;odo.</small>` : '';
      return `<strong>Total pago a ${esc(nome)}${periodoRotuloIA(periodo)}:</strong> ${moeda(totalPago)}.<br>${pagas.length} pagamento(s) confirmado(s).${periodo ? `<br>Pendente com vencimento no mesmo per&iacute;odo: ${moeda(totalPendente)} (${pendentes.length}).` : `<br>Pendente atualmente: ${moeda(totalPendente)} (${pendentes.length}).`}${avisoSemData}${detalhe ? `<br><br><strong>Pagamentos considerados:</strong><br>${detalhe}` : ''}`;
    }

    if (querBoletos) {
      let lista = baseFornecedor.filter(financeiroEhBoletoIA);
      if (periodo) lista = lista.filter(f => periodoContem(periodo, f.venc || f.vencimento || f.data || f.createdAt));
      const querPagos = /\bpagos?\b|\bpagas?\b|liquidad|quitad/.test(q) && !/pendente|aberto|a pagar/.test(q);
      const querPendentes = /pendente|pendentes|aberto|abertos|a pagar|vencid|vencendo/.test(q);
      if (querPagos) lista = lista.filter(f => isPagoStatus(f.status));
      else if (querPendentes) lista = lista.filter(f => isPendenteStatus(f.status));
      if (/vencid|atrasad/.test(q)) {
        const hoje = hojeISO();
        lista = lista.filter(f => {
          const venc = dataISO(f.venc || f.vencimento || '');
          return venc && venc < hoje && isPendenteStatus(f.status);
        });
      }
      lista.sort((a,b) => dataISO(a.venc || a.vencimento || '').localeCompare(dataISO(b.venc || b.vencimento || '')));
      if (!lista.length) return `N&atilde;o encontrei boleto de <strong>${esc(nome)}</strong>${periodoRotuloIA(periodo)} com os filtros pedidos.`;
      const total = lista.reduce((s,f)=>s+num(f.valor||f.total||0),0);
      const pend = lista.filter(f=>isPendenteStatus(f.status));
      const pagos = lista.filter(f=>isPagoStatus(f.status));
      return `<strong>Boletos de ${esc(nome)}${periodoRotuloIA(periodo)} (${lista.length}):</strong><br>${lista.slice(0,30).map(formatarLinhaFinanceiro).join('<br>')}<br><br><strong>Total listado:</strong> ${moeda(total)} | em aberto ${moeda(pend.reduce((s,f)=>s+num(f.valor||f.total||0),0))} | pago ${moeda(pagos.reduce((s,f)=>s+num(f.valor||f.total||0),0))}.`;
    }

    return null;
  }

  function responderNotasDetalhadas(texto, q, ctx) {
    if (!/(?:nota\s+fiscal|\bnf\b|xml|\bnotas?\b)/.test(q)) return null;
    if (!ctx.notas.length) return 'Nao ha notas fiscais carregadas nesta sessao.';
    const numeroNF = extrairNumeroNF(texto);
    const stop = /^(nota|fiscal|nf|xml|fornecedor|fornecedores|da|de|do|das|dos|a|o|e|com)$/;
    const termos = q.split(/\s+/).filter(t => t.length >= 3 && !stop.test(t) && !/^\d+$/.test(t));
    let lista = ctx.notas.slice();
    if (numeroNF) {
      lista = lista.filter(n => String(n.numero || n.numeroNF || n.nf || '').includes(numeroNF) || norm(notaTexto(n)).includes(numeroNF));
    }
    if (termos.length) {
      lista = lista.filter(n => {
        const hay = norm(notaTexto(n));
        return termos.every(t => hay.includes(t));
      });
    }
    if (!lista.length) return 'Nao encontrei nota fiscal com esses filtros nos dados carregados.';
    const total = lista.reduce((s, n) => s + num(n.totalNF || n.totalItens || n.valor || 0), 0);
    return `<strong>Notas fiscais localizadas (${lista.length}):</strong><br>${lista.slice(0, 25).map(formatarLinhaNota).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
  }

  function responderComissoesDetalhadas(texto, q, ctx, opts) {
    if (!/comiss|mecanico|funcionario|colaborador/.test(q)) {
      const funcSozinho = funcionarioPorPergunta(ctx, q);
      if (!funcSozinho) return null;
    }
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar comissoes ou financeiro.';
    const func = funcionarioPorPergunta(ctx, q);
    let lista = ctx.financeiro.filter(financeiroEhComissao);
    if (func) lista = lista.filter(f => financeiroDoFuncionario(f, func));
    const querPagas = /\b(pagas|pago|pagos|pagamento|liquidadas|quitadas)\b/.test(q) && !/\ba\s+pagar\b/.test(q);
    const querPendentes = /\b(a\s+pagar|pagar|pendente|pendentes|aberto|abertas|em\s+aberto|devido|devidas)\b/.test(q) || !querPagas;
    if (querPagas) lista = lista.filter(f => isPagoStatus(f.status));
    else if (querPendentes) lista = lista.filter(f => isPendenteStatus(f.status));
    const tituloPessoa = func ? ` de ${esc(func.nome || func.usuario || 'colaborador')}` : '';
    if (!lista.length) return `Nao encontrei comissoes${tituloPessoa} ${querPagas ? 'pagas' : 'a pagar'} nos dados carregados.`;
    const total = lista.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const porPessoa = {};
    lista.forEach(f => {
      const id = f.mecId || f.funcId || f.funcionarioId || f.colaboradorId || f.vinculo || 'sem-vinculo';
      const nome = (ctx.equipe.find(e => [e.id,e.uid,e.usuario].map(x=>String(x||'')).includes(String(id))) || {}).nome || f.mecNome || f.funcionario || f.colaborador || (func && (func.nome || func.usuario)) || 'Sem colaborador identificado';
      porPessoa[nome] = (porPessoa[nome] || 0) + num(f.valor || f.total || 0);
    });
    const resumo = Object.keys(porPessoa).length > 1
      ? '<br><strong>Resumo por colaborador:</strong><br>' + Object.entries(porPessoa).sort((a,b)=>b[1]-a[1]).map(([nome, total]) => `- ${esc(nome)}: ${moeda(total)}`).join('<br>')
      : '';
    return `<strong>Comissões ${querPagas ? 'pagas' : 'a pagar'}${tituloPessoa} (${lista.length}):</strong><br>${lista.slice(0, 10).map(formatarLinhaFinanceiro).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}${resumo}`;
  }

  function responderFinanceiroDetalhado(texto, q, ctx, opts) {
    const consultaFinanceira = /boleto|boletos|conta|contas|titulo|duplicata|financeiro|pix|vencid|vencendo|vencimento|pagar|receber|paga|pagas|pago|pagos|pendente|pendentes|atrasad|hoje|amanha|dre|caixa|comiss/.test(q);
    if (!consultaFinanceira) return null;
    const comissoes = responderComissoesDetalhadas(texto, q, ctx, opts);
    if (comissoes && /comiss|mecanico|funcionario|colaborador/.test(q)) return comissoes;
    if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar financeiro. Posso consultar O.S., historico tecnico, defeitos, veiculos e execucao.';
    const hoje = hojeISO();
    const amanha = (() => { const d = new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const analiseFinanceira = /analis|analise|resumo|risco|prioridade|dre|atual|geral/.test(q);
    let lista = ctx.financeiro.slice();

    if (/\bhoje\b/.test(q) || /vencimento\s+hoje/.test(q)) lista = lista.filter(f => dataISO(f.venc || f.vencimento || f.data) === hoje);
    if (/\bamanha\b/.test(q)) lista = lista.filter(f => dataISO(f.venc || f.vencimento || f.data) === amanha);
    if (/vencid|atrasad/.test(q)) lista = lista.filter(f => {
      const venc = dataISO(f.venc || f.vencimento || f.data);
      return venc && venc < hoje && isPendenteStatus(f.status);
    });

    const querPagas = /\b(contas?\s+pagas?|pagas|pago|pagos|liquidadas|quitadas)\b/.test(q) && !/\ba\s+pagar\b/.test(q);
    const querPendentes = /\b(contas?\s+a\s+pagar|a\s+pagar|pagar|pendente|pendentes|aberto|abertas|em\s+aberto|boletos?)\b/.test(q) && !querPagas;
    if (querPagas) lista = lista.filter(f => isPagoStatus(f.status));
    if (querPendentes) lista = lista.filter(f => isPendenteStatus(f.status));

    if (/receber|recebimento|entrada/.test(q) && !/pagar/.test(q)) lista = lista.filter(f => /entrada|receb/.test(tipoFinanceiro(f)));
    if (/pagar|boleto|conta/.test(q) && !/receber/.test(q)) {
      const saidas = lista.filter(f => !/entrada|recebimento/.test(tipoFinanceiro(f)));
      if (saidas.length) lista = saidas;
    }

    if (/pix/.test(q) && /parcel/.test(q)) {
      lista = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
      if (!lista.length) return 'Nao encontrei PIX parcelado nos dados carregados.';
    }

    const numeroNF = extrairNumeroNF(texto);
    if (numeroNF && /\bnf\b|nota|fiscal/.test(q)) lista = lista.filter(f => norm(textoFinanceiro(f)).includes(numeroNF));

    const stop = /^(financeiro|boleto|boletos|conta|contas|pagar|pagas|pago|pagos|pendente|pendentes|vencimento|vencendo|vencidas|vencidos|atrasadas|atrasados|hoje|amanha|nf|nota|fiscal|a|o|as|os|de|do|da|das|dos|para|com|em|no|na)$/;
    const termos = q.split(/\s+/).filter(t => t.length >= 4 && !stop.test(t) && !/^\d+$/.test(t));
    if (termos.length) {
      const filtrada = lista.filter(f => {
        const hay = norm(textoFinanceiro(f));
        return termos.every(t => hay.includes(t));
      });
      lista = filtrada;
    }

    if (analiseFinanceira) {
      const vencidos = ctx.financeiro.filter(f => {
        const venc = dataISO(f.venc || f.vencimento || f.data);
        return venc && venc < hoje && isPendenteStatus(f.status);
      });
      const hojeLista = ctx.financeiro.filter(f => dataISO(f.venc || f.vencimento || f.data) === hoje);
      const pendentes = ctx.financeiro.filter(f => isPendenteStatus(f.status));
      const totalPendente = pendentes.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      const linhas = [
        `<strong>Análise financeira local:</strong> ${ctx.financeiro.length} lançamento(s) carregado(s).`,
        `Pendentes/em aberto: ${pendentes.length} (${moeda(totalPendente)}).`,
        `Vencidos: ${vencidos.length}. Vencendo hoje: ${hojeLista.length}.`
      ];
      const prioridades = [...vencidos, ...hojeLista, ...pendentes]
        .filter((f, i, arr) => arr.findIndex(x => (x.id || x.desc || x.descricao) === (f.id || f.desc || f.descricao)) === i)
        .slice(0, 5);
      if (prioridades.length) linhas.push('<br><strong>Prioridades:</strong><br>' + prioridades.map(formatarLinhaFinanceiro).join('<br>'));
      return linhas.join('<br>');
    }

    if (!lista.length) return 'Nao encontrei lancamento financeiro para essa pergunta nos dados carregados.';
    const total = lista.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    return `<strong>Financeiro localizado (${lista.length}):</strong><br>${lista.slice(0, 30).map(formatarLinhaFinanceiro).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
  }

  function responderJarvisDadosPrecisos(texto, q, ctx, opts) {
    // Uma placa válida sempre tem prioridade. Sem esta trava, palavras genéricas
    // como "serviço" podiam ser confundidas com o cadastro "SERVIÇO TERCEIRIZADO".
    if (extrairPlaca(texto)) return null;
    // Consultas operacionais de O.S./pátio devem cair no bloco próprio,
    // para listar TODAS as O.S. da condição pedida, e não virar resumo genérico.
    if (/\b(o\.?s\.?|os|ordem|ordens|veiculo|veiculos|patio|pátio)\b/.test(q) && /(patio|pátio|entreg|fechad|finaliz|concluid|receb|pagamento|sem receb|sem pagar|abert|abertas|andamento|orcamento|orçamento|triagem|pronto)/.test(q)) {
      return null;
    }
    const servicosLancados = responderServicosLancadosFuncionarioPeriodo(texto, q, ctx, opts);
    if (servicosLancados) return servicosLancados;
    const eventosFuncionario = responderEventosFuncionarioPeriodoIA(texto, q, ctx);
    if (eventosFuncionario) return eventosFuncionario;
    const veiculosMecanico = responderVeiculosMecanicoIA(texto, q, ctx);
    if (veiculosMecanico) return veiculosMecanico;
    const atendimentos = responderAtendimentosFuncionarioPeriodo(texto, q, ctx, opts);
    if (atendimentos) return atendimentos;
    const servicosTerceirizados = responderServicosTerceirizadosFinanceiro(texto, q, ctx, opts);
    if (servicosTerceirizados) return servicosTerceirizados;
    const financeiroFornecedor = responderFinanceiroFornecedorPreciso(texto, q, ctx, opts);
    if (financeiroFornecedor) return financeiroFornecedor;
    const notas = responderNotasDetalhadas(texto, q, ctx);
    if (notas) return notas;
    const comissoes = responderComissoesDetalhadas(texto, q, ctx, opts);
    if (comissoes && /comiss|mecanico|funcionario|colaborador/.test(q)) return comissoes;
    const financeiro = responderFinanceiroDetalhado(texto, q, ctx, opts);
    if (financeiro) return financeiro;
    const func = funcionarioPorPergunta(ctx, q);
    const consultaPessoaExplicita = /\b(comiss|mecanico|mecanicos|funcionario|funcionarios|colaborador|colaboradores|responsavel|responsaveis)\b/.test(q);
    const perguntaSoNome = func && (() => {
      const limpo = norm(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const aliases = [func.nome, func.usuario, func.apelido, func.login].map(norm).filter(v => v.length >= 3);
      return aliases.some(a => limpo === a || (a.split(/\s+/).length > 1 && limpo === a.split(/\s+/)[0]));
    })();
    if (func && (consultaPessoaExplicita || perguntaSoNome) && podeFinanceiro(opts)) {
      const pend = ctx.financeiro.filter(f => financeiroEhComissao(f) && financeiroDoFuncionario(f, func) && isPendenteStatus(f.status));
      const pagas = ctx.financeiro.filter(f => financeiroEhComissao(f) && financeiroDoFuncionario(f, func) && isPagoStatus(f.status));
      const totalPend = pend.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      const totalPagas = pagas.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
      return `<strong>Colaborador localizado:</strong> ${esc(func.nome || func.usuario || func.id)}<br>Cargo: ${esc(func.cargo || '-')}<br>Comissões a pagar: ${pend.length} (${moeda(totalPend)}).<br>Comissões pagas: ${pagas.length} (${moeda(totalPagas)}).`;
    }
    return null;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function uniq(arr) {
    return Array.from(new Set((arr || []).map(v => String(v || '').trim()).filter(Boolean)));
  }

  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
    if (typeof value === 'object') return Object.values(value);
    return [];
  }

  function getJ() {
    if (W.J && Object.keys(W.J).length) return W.J;
    try {
      if (typeof J !== 'undefined' && J) return J;
    } catch (_) {}
    return {};
  }

  function dataSets(opts) {
    const J = opts?.J || getJ();
    let osEquipe = [];
    let clientesEquipe = [];
    let veiculosEquipe = [];
    let estoqueEquipe = [];
    try { if (typeof dbOS !== 'undefined' && Array.isArray(dbOS)) osEquipe = dbOS; } catch (_) {}
    try { if (typeof dbClientes !== 'undefined' && Array.isArray(dbClientes)) clientesEquipe = dbClientes; } catch (_) {}
    try { if (typeof dbVeiculos !== 'undefined' && Array.isArray(dbVeiculos)) veiculosEquipe = dbVeiculos; } catch (_) {}
    try { if (typeof dbEstoque !== 'undefined' && Array.isArray(dbEstoque)) estoqueEquipe = dbEstoque; } catch (_) {}
    return {
      J,
      os: Array.isArray(J.os) ? J.os : (Array.isArray(W.dbOS) ? W.dbOS : osEquipe),
      clientes: Array.isArray(J.clientes) ? J.clientes : (Array.isArray(W.dbClientes) ? W.dbClientes : clientesEquipe),
      veiculos: Array.isArray(J.veiculos) ? J.veiculos : (Array.isArray(W.dbVeiculos) ? W.dbVeiculos : veiculosEquipe),
      estoque: Array.isArray(J.estoque) ? J.estoque : (Array.isArray(W.dbEstoque) ? W.dbEstoque : estoqueEquipe),
      financeiro: Array.isArray(J.financeiro) ? J.financeiro : [],
      equipe: Array.isArray(J.equipe) ? J.equipe : [],
      fornecedores: Array.isArray(J.fornecedores) ? J.fornecedores : [],
      notas: Array.isArray(J.notasFiscaisEntrada) ? J.notasFiscaisEntrada : [],
      vinculos: Array.isArray(J.nfItensVinculos) ? J.nfItensVinculos : [],
      pacotes: Array.isArray(J.pacotesBoletos) ? J.pacotesBoletos : []
    };
  }

  function role(opts) {
    return norm(opts?.perfil || getJ().role || sessionStorage.getItem('j_role') || '');
  }

  function podeFinanceiro(opts) {
    const r = role(opts);
    return /superadmin|admin|jarvis|gestor|gerente|financeiro|vendedor|dono|proprietario|owner|oficina_admin|caixa/.test(r);
  }

  function placaLimpa(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function dataValidaPeriodo(dia, mes, ano) {
    const d = Number(dia);
    const m = Number(mes);
    let a = Number(ano);
    if (a > 0 && a < 100) a += 2000;
    if (!a || d < 1 || m < 1 || m > 12) return '';
    const dt = new Date(a, m - 1, d, 12, 0, 0);
    if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function extrairPeriodoPergunta(texto) {
    const datas = Array.from(String(texto || '').matchAll(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/g));
    if (!datas.length) return null;
    const anoAtual = new Date().getFullYear();
    const anoExplicito = datas.map(m => Number(m[3] || 0)).find(Boolean);
    let anoInicio = Number(datas[0][3] || anoExplicito || anoAtual);
    if (anoInicio < 100) anoInicio += 2000;
    let inicio = dataValidaPeriodo(datas[0][1], datas[0][2], anoInicio);
    if (!inicio) return null;

    // Uma única data significa consulta daquele dia, não uma busca de comissão genérica.
    if (datas.length === 1) return { inicio, fim: inicio };

    let anoFim = Number(datas[1][3] || anoExplicito || anoAtual);
    if (anoFim < 100) anoFim += 2000;
    let fim = dataValidaPeriodo(datas[1][1], datas[1][2], anoFim);
    if (!fim) return null;
    if (!datas[0][3] && !datas[1][3] && inicio > fim) {
      anoInicio = anoFim - 1;
      inicio = dataValidaPeriodo(datas[0][1], datas[0][2], anoInicio);
    }
    if (inicio > fim) [inicio, fim] = [fim, inicio];
    return { inicio, fim };
  }

  function periodoContem(periodo, valor) {
    if (!periodo) return true;
    const iso = dataISO(valor);
    return !!(iso && iso >= periodo.inicio && iso <= periodo.fim);
  }

  function funcionarioDaPerguntaOperacional(ctx, texto, q) {
    const m = norm(texto).match(/\b(?:mecanico|funcionario|colaborador|responsavel)\s+(?:o|a|os|as|do|da|de|dos|das)?\s*(.+?)(?=\s+(?:atendeu|atendimentos?|realizou|executou|trabalhou|do\s+dia|entre|de\s+\d|no\s+periodo)|[?,.!]|$)/);
    const nome = limparTermoFuncionarioPergunta(m?.[1] || '');
    const porNome = funcionarioPorNomeExtraido(ctx, nome);
    if (porNome) return porNome;
    const cadastrado = funcionarioPorPergunta(ctx, q);
    if (cadastrado) return cadastrado;
    return nome.length >= 3 ? { id: '', nome, origemHistorica: true } : null;
  }

  function idsFuncionario(func) {
    return [func?.id, func?.uid, func?.userId, func?.usuarioId, func?.fid, func?.usuario, func?.login]
      .map(v => String(v || '').trim())
      .filter(Boolean);
  }

  function nomeCombinaFuncionario(valor, func) {
    const alvo = norm(func?.nome || func?.usuario || func?.apelido || '').trim();
    const hay = norm(valor).trim();
    if (!alvo || !hay) return false;
    if (hay.includes(alvo) || alvo.includes(hay)) return true;
    const tokens = alvo.split(/\s+/).filter(t => t.length >= 3);
    return tokens.length >= 2 && tokens.every(t => hay.includes(t));
  }

  function idCombinaFuncionario(valor, func) {
    const id = String(valor || '').trim();
    return !!id && idsFuncionario(func).includes(id);
  }

  function rateiosFuncionarioItem(item, os) {
    const direto = Array.isArray(item?.rateiosComissao) ? item.rateiosComissao : [];
    const origem = Number.isInteger(Number(item?.index)) && Array.isArray(os?.servicos)
      ? (os.servicos[Number(item.index)] || {})
      : {};
    const salvos = Array.isArray(origem?.rateiosComissao) ? origem.rateiosComissao : [];
    const lista = direto.length ? direto : salvos;
    const unicos = new Map();
    lista.forEach(r => {
      const id = String(r?.mecId || r?.id || '').trim();
      const nome = String(r?.mecNome || r?.nome || '').trim();
      const chave = id || ('nome:' + norm(nome));
      if (!chave || unicos.has(chave)) return;
      unicos.set(chave, {
        mecId: id,
        mecNome: nome,
        valorBase: Math.max(0, num(r?.valorBase ?? r?.valorDividido ?? r?.baseComissao ?? 0))
      });
    });
    return Array.from(unicos.values());
  }

  function rateioDoFuncionarioNoItem(item, func, os) {
    const rateios = rateiosFuncionarioItem(item, os);
    if (!rateios.length) return null;
    return rateios.find(r => idCombinaFuncionario(r.mecId, func) || nomeCombinaFuncionario(r.mecNome, func)) || null;
  }

  function osAtribuidaFuncionario(os, func) {
    const servicos = Array.isArray(os?.servicos) ? os.servicos : [];
    const ids = [
      os?.mecId, os?.mecanicoId, os?.responsavelId, os?.funcionarioId, os?.colaboradorId, os?.executorId,
      ...(Array.isArray(os?.mecIds) ? os.mecIds : []),
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.id || m?.mecId) : []),
      ...servicos.flatMap(s => [
        s?.mecId || s?.mecanicoId || s?.responsavelId,
        ...(Array.isArray(s?.rateiosComissao) ? s.rateiosComissao.map(r => r?.mecId || r?.id) : [])
      ])
    ];
    if (ids.some(v => idCombinaFuncionario(v, func))) return true;
    return [
      os?.mecNome, os?.mecanicoNome, os?.mecanico, os?.responsavelNome, os?.responsavel, os?.executorNome,
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.nome || m?.mecNome) : []),
      ...servicos.flatMap(s => [
        s?.mecNome || s?.mecanicoNome || s?.responsavelNome,
        ...(Array.isArray(s?.rateiosComissao) ? s.rateiosComissao.map(r => r?.mecNome || r?.nome) : [])
      ])
    ].some(v => nomeCombinaFuncionario(v, func));
  }

  function itemPertenceFuncionario(item, func, os) {
    const rateios = rateiosFuncionarioItem(item, os);
    if (rateios.length) {
      return rateios.some(r => idCombinaFuncionario(r.mecId, func) || nomeCombinaFuncionario(r.mecNome, func));
    }
    const itemIds = [item?.mecId, item?.mecanicoId, item?.responsavelId].filter(Boolean);
    const itemNomes = [item?.mecNome, item?.mecanicoNome, item?.responsavelNome].filter(Boolean);
    if (itemIds.length || itemNomes.length) {
      return itemIds.some(v => idCombinaFuncionario(v, func)) || itemNomes.some(v => nomeCombinaFuncionario(v, func));
    }
    const idsOS = [
      os?.mecId,
      ...(Array.isArray(os?.mecIds) ? os.mecIds : []),
      ...(Array.isArray(os?.mecanicos) ? os.mecanicos.map(m => m?.id || m?.mecId) : [])
    ].filter(Boolean);
    return idsOS.length <= 1 && osAtribuidaFuncionario(os, func);
  }

  function baseComissaoFuncionarioItem(item, func, os) {
    const rateio = rateioDoFuncionarioNoItem(item, func, os);
    const valorIntegral = Math.max(0, num(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valorUnit ?? 0));
    if (rateio) return Math.min(valorIntegral, Math.max(0, num(rateio.valorBase)));
    if (rateiosFuncionarioItem(item, os).length) return 0;
    return itemPertenceFuncionario(item, func, os) ? valorIntegral : 0;
  }

  function autoriaRegistroFuncionario(registro, func, osAtribuida) {
    const ids = [
      registro?.atualizadoPorId, registro?.usuarioId, registro?.mecId, registro?.mecanicoId,
      registro?.responsavelId, registro?.executorId, registro?.funcionarioId, registro?.colaboradorId
    ].filter(Boolean);
    const nomes = [
      registro?.atualizadoPor, registro?.usuario, registro?.user, registro?.por,
      registro?.mecNome, registro?.mecanicoNome, registro?.responsavel, registro?.executorNome
    ].filter(Boolean);
    if (ids.length || nomes.length) {
      return ids.some(v => idCombinaFuncionario(v, func)) || nomes.some(v => nomeCombinaFuncionario(v, func));
    }
    return osAtribuida;
  }

  function dataPrincipalOS(os) {
    return os?.data || os?.dataEntrada || os?.entrada || os?.createdAt || os?.updatedAt || '';
  }

  function itensOrcamentoParaIA(os, ctx) {
    const U = W.JOS || W.JarvisOSUtils || {};
    const cliente = (Array.isArray(ctx?.clientes) ? ctx.clientes : []).find(c => c.id === os?.clienteId) || null;
    const itens = U.buildBudgetItems?.(os, cliente);
    if (Array.isArray(itens) && itens.length) return itens;
    return (Array.isArray(os?.servicos) ? os.servicos : []).map((s, index) => ({
      key: `servico-${index}`,
      tipo: 'servico',
      index,
      desc: s?.desc || s?.descricao || s?.nome || '',
      valorFinal: num(s?.valorFinal ?? s?.total ?? s?.valor ?? s?.valorBruto ?? 0),
      mecId: s?.mecId || s?.mecanicoId || s?.responsavelId || '',
      mecNome: s?.mecNome || s?.mecanicoNome || s?.responsavelNome || '',
      rateiosComissao: Array.isArray(s?.rateiosComissao) ? s.rateiosComissao : []
    }));
  }

  function statusOperacionalAtendimento(os) {
    const bruto = norm(os?.status || '').replace(/[^a-z0-9]+/g, '');
    // Aliases confirmados na base Web atual (js/os.js e equipe.html).
    // A normalizacao e somente de leitura; nenhum valor e gravado de volta no banco.
    const mapa = {
      aguardando: 'Triagem',
      triagem: 'Triagem',
      patio: 'Triagem',
      orcamento: 'Orcamento',
      orcamentoenviado: 'Orcamento_Enviado',
      aprovacao: 'Orcamento_Enviado',
      aprovado: 'Aprovado',
      andamento: 'Andamento',
      box: 'Andamento',
      emservico: 'Andamento',
      pronto: 'Pronto',
      prontoretirada: 'Pronto',
      faturado: 'Pronto',
      entregue: 'Entregue',
      concluido: 'Entregue',
      cancelado: 'Cancelado'
    };
    const canonico = mapa[bruto] || '';
    const rotulos = {
      Triagem: 'TRIAGEM',
      Orcamento: 'ORÇAMENTO',
      Orcamento_Enviado: 'ORÇAMENTO ENVIADO / AGUARDANDO APROVAÇÃO',
      Aprovado: 'SERVIÇO APROVADO',
      Andamento: 'EM SERVIÇO',
      Pronto: 'VEÍCULO PRONTO',
      Entregue: 'VEÍCULO ENTREGUE',
      Cancelado: 'CANCELADO'
    };
    return {
      canonico,
      rotulo: rotulos[canonico] || String(os?.status || 'STATUS NAO RECONHECIDO'),
      // Atendimento operacional é relação do mecânico com a O.S., não regra de comissão.
      // Triagem/orçamento/sem valor também contam; somente cancelada é excluída.
      permitido: !!canonico && canonico !== 'Cancelado'
    };
  }

  function osFinalizadaParaComissao(os) {
    const status = statusOperacionalAtendimento(os).canonico;
    return status === 'Pronto' || status === 'Entregue';
  }

  function somarValoresServicos(lista) {
    return +((Array.isArray(lista) ? lista : []).reduce((soma, item) => soma + num(item?.valor), 0)).toFixed(2);
  }

  function servicosFuncionarioNaOS(os, func, periodo, ctx) {
    const atribuida = osAtribuidaFuncionario(os, func);
    const U = W.JOS || W.JarvisOSUtils || {};
    const itensServico = itensOrcamentoParaIA(os, ctx).filter(it => norm(it?.tipo).includes('servico'));
    const mapa = new Map(itensServico.map(it => [String(it.key || ''), it]));
    const confirmados = [];
    Object.entries(os?.execucaoItens || {}).forEach(([key, registro]) => {
      const status = norm(registro?.status || '');
      if (!/^(executado|executado obs|concluido|finalizado|feito|realizado)$/.test(status.replace(/[_-]+/g, ' '))) return;
      const item = mapa.get(String(key)) || {};
      if (!norm(item?.tipo || registro?.tipo || '').includes('servico')) return;
      if (!autoriaRegistroFuncionario(registro, func, atribuida)) return;
      if (!itemPertenceFuncionario(Object.assign({}, item, {
        mecId: registro?.mecId || registro?.responsavelId || item?.mecId,
        mecNome: registro?.mecNome || registro?.responsavelNome || item?.mecNome
      }), func, os)) return;
      const dataExecucao = registro?.atualizadoEm || registro?.updatedAt || registro?.data || registro?.em || dataPrincipalOS(os);
      if (!periodoContem(periodo, dataExecucao)) return;
      const desc = item?.desc || registro?.desc || registro?.descricao || key;
      if (desc) {
        const valorIntegral = num(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valorUnit ?? registro?.valor ?? 0);
        confirmados.push({
          key: String(key),
          desc,
          valor: valorIntegral,
          baseComissao: baseComissaoFuncionarioItem(item, func, os),
          status: registro?.status || 'executado',
          data: dataISO(dataExecucao)
        });
      }
    });
    const unicosConfirmados = Array.from(new Map(confirmados.map(s => [`${s.key}|${s.data}`, s])).values());
    const registrados = [];
    if (!unicosConfirmados.length && atribuida && periodoContem(periodo, dataPrincipalOS(os))) {
      const temAprovacao = typeof U.hasApproval === 'function'
        ? U.hasApproval(os)
        : !!((os?.aprovacao && Array.isArray(os.aprovacao.itens)) || Array.isArray(os?.itensAprovados));
      const aprovados = typeof U.getApprovedKeys === 'function'
        ? U.getApprovedKeys(os)
        : new Set((os?.itensAprovados || []).map(item => typeof item === 'string' ? item : item?.key).filter(Boolean));
      itensServico.forEach(item => {
        if (temAprovacao && !aprovados.has(item.key)) return;
        if (!itemPertenceFuncionario(item, func, os)) return;
        const desc = item?.desc || '';
        if (!desc) return;
        registrados.push({
          key: String(item.key || ''),
          desc,
          valor: num(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valorUnit ?? 0),
          baseComissao: baseComissaoFuncionarioItem(item, func, os)
        });
      });
    }
    const legadoFinalizado = !unicosConfirmados.length && registrados.length > 0 && osFinalizadaParaComissao(os);
    return {
      confirmados: unicosConfirmados,
      registrados,
      legadoFinalizado,
      totalConfirmado: somarValoresServicos(unicosConfirmados),
      totalRegistrado: somarValoresServicos(registrados),
      baseComissaoConfirmada: +unicosConfirmados.reduce((soma, item) => soma + num(item?.baseComissao ?? item?.valor), 0).toFixed(2),
      baseComissaoRegistrada: +registrados.reduce((soma, item) => soma + num(item?.baseComissao ?? item?.valor), 0).toFixed(2)
    };
  }

  function evidenciaAtendimentoFuncionario(os, func, periodo) {
    const atribuida = osAtribuidaFuncionario(os, func);
    if (atribuida && periodoContem(periodo, dataPrincipalOS(os))) return true;
    const execucao = Object.values(os?.execucaoItens || {}).some(registro => {
      const data = registro?.atualizadoEm || registro?.updatedAt || registro?.data || registro?.em;
      return autoriaRegistroFuncionario(registro, func, atribuida) && periodoContem(periodo, data);
    });
    if (execucao) return true;
    return (Array.isArray(os?.timeline) ? os.timeline : []).some(evento => {
      const autor = evento?.user || evento?.usuario || evento?.por || evento?.atualizadoPor || '';
      const data = evento?.dt || evento?.data || evento?.createdAt || evento?.ts;
      return nomeCombinaFuncionario(autor, func) && periodoContem(periodo, data);
    });
  }

  function dataLancamentoServicoIA(os, item) {
    const direta = item?.lancadoEm || item?.atribuidoEm || item?.createdAt || item?.updatedAt || item?.dataLancamento || '';
    if (dataISO(direta)) return { data: direta, fonte: 'servico' };
    const desc = norm(item?.desc || item?.descricao || item?.nome || '').trim();
    if (desc && Array.isArray(os?.timeline)) {
      const tokens = desc.split(/\s+/).filter(t => t.length >= 4).slice(0, 3);
      const evento = os.timeline.find(ev => {
        const hay = norm([ev?.acao,ev?.msg,ev?.mensagem,ev?.descricao,ev?.detalhe,ev?.texto].join(' '));
        if (!/(servic|atrib|mecanic|lanc|adicion)/.test(hay)) return false;
        return tokens.length > 0 && tokens.every(t => hay.includes(t));
      });
      const dt = evento?.dt || evento?.data || evento?.createdAt || evento?.ts || '';
      if (dataISO(dt)) return { data: dt, fonte: 'timeline' };
    }
    const dataOS = os?.data || os?.dataEntrada || os?.entrada || os?.createdAt || '';
    return dataISO(dataOS) ? { data: dataOS, fonte: 'data_os' } : { data: '', fonte: 'sem_data' };
  }

  function responderServicosLancadosFuncionarioPeriodo(texto, q, ctx, opts) {
    const falaLancamento = /(?:servico|servicos).*(?:lancad|atribuid|designad|em nome)|(?:lancad|atribuid|designad).*(?:servico|servicos)|em nome do mecanico/.test(q);
    if (!falaLancamento) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return 'Informe o nome do mec&acirc;nico para localizar os servi&ccedil;os atribu&iacute;dos.';
    const periodo = extrairPeriodoNaturalIA(texto);
    const resultados = [];
    (ctx.os || []).forEach(os => {
      const servicos = Array.isArray(os?.servicos) ? os.servicos : [];
      servicos.forEach((s, index) => {
        if (!itemPertenceFuncionario(s, func, os)) return;
        const evidencia = dataLancamentoServicoIA(os, s);
        if (periodo && !periodoContem(periodo, evidencia.data)) return;
        resultados.push({ os, item:s, index, evidencia });
      });
    });
    resultados.sort((a,b) => dataISO(a.evidencia.data).localeCompare(dataISO(b.evidencia.data)) || String(a.os?.id||'').localeCompare(String(b.os?.id||'')));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!resultados.length) return `N&atilde;o encontrei servi&ccedil;o atribu&iacute;do a <strong>${esc(nome)}</strong>${periodoRotuloIA(periodo)}. A busca n&atilde;o exige que a O.S. esteja finalizada.`;
    const linhas = resultados.slice(0, 50).map(({os,item,evidencia}) => {
      const placa = placaOS(ctx, os) || os?.placa || '-';
      const status = os?.status || '-';
      const valor = podeFinanceiro(opts) ? ` | ${moeda(item?.valorFinal ?? item?.total ?? item?.valorBruto ?? item?.valor ?? 0)}` : '';
      const fonte = evidencia.fonte === 'data_os' ? ' | data da O.S. (registro legado sem data individual do servi&ccedil;o)' : '';
      return `- ${esc(dataBR(evidencia.data) || '-')} | O.S. ${esc(String(os?.numero || os?.id || '-').slice(-10))} | ${esc(placa)} | ${esc(item?.desc || item?.descricao || item?.nome || 'Servi&ccedil;o')} | status ${esc(status)}${valor}${fonte}`;
    });
    const legados = resultados.filter(r => r.evidencia.fonte === 'data_os').length;
    return `<strong>Servi&ccedil;os atribu&iacute;dos a ${esc(nome)}${periodoRotuloIA(periodo)} (${resultados.length}):</strong><br>${linhas.join('<br>')}<br><br><small>Foram inclu&iacute;das O.S. abertas, em triagem, or&ccedil;amento, aprovadas, em servi&ccedil;o, prontas ou entregues. ${legados ? `${legados} item(ns) legado(s) n&atilde;o possuem data individual de lan&ccedil;amento; nesses casos foi usada e identificada a data da O.S., sem inventar uma data de servi&ccedil;o.` : 'As datas individuais dispon&iacute;veis foram preservadas.'}</small>`;
  }

  function modoRelatorioFuncionario(q) {
    if (/\b(detalhado|detalhada|detalhes|completo|completa|analitico|analitica|listar tudo|todos os servicos)\b/.test(q)) return 'detalhado';
    return 'resumo';
  }

  function responderAtendimentosFuncionarioPeriodo(texto, q, ctx, opts) {
    const periodoInformado = extrairPeriodoNaturalIA(texto);
    const periodo = periodoInformado || { inicio: '1900-01-01', fim: '2999-12-31', origem: 'historico_carregado' };
    const citaCargo = /\b(mecanico|funcionario|colaborador|responsavel)\b/.test(q);
    const funcDireto = funcionarioPorPergunta(ctx, q);
    const perguntaAtendimentoComNome = /\batendimentos?\b/.test(q) && (!!funcDireto || /\b(fez|atendeu|realizou|executou|trabalhou)\b/.test(q));
    if (!citaCargo && !perguntaAtendimentoComNome) return null;
    if (!/(atendeu|atendimento|realizou|executou|trabalhou|fez|servico|servicos|veiculo|veiculos|o\.?s\.?|ordem|ordens|comiss|relatorio|valor|valores|total)/.test(q)) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return 'Informe o nome do mec&acirc;nico para consultar os atendimentos por per&iacute;odo.';
    const lista = ctx.os
      .map(os => ({ os, statusOperacional: statusOperacionalAtendimento(os) }))
      .filter(item => item.statusOperacional.permitido)
      .filter(item => evidenciaAtendimentoFuncionario(item.os, func, periodo))
      .map(item => ({
        os: item.os,
        statusOperacional: item.statusOperacional,
        servicos: servicosFuncionarioNaOS(item.os, func, periodo, ctx)
      }))
      // Não exige serviço, valor ou comissão: estar relacionado à O.S. já é atendimento operacional.
      .sort((a, b) => dataISO(dataPrincipalOS(a.os)).localeCompare(dataISO(dataPrincipalOS(b.os))));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!lista.length) {
      const faixa = periodoInformado ? ` entre ${esc(dataBR(periodo.inicio))} e ${esc(dataBR(periodo.fim))}` : '';
      return `N&atilde;o encontrei atendimento de <strong>${esc(nome)}</strong>${faixa} nos dados carregados.`;
    }
    const veiculosUnicos = new Set(lista.map(({ os }) => os.veiculoId || placaOS(ctx, os) || os.id));
    const podeVerValores = podeFinanceiro(opts);
    const percentualRaw = func?.comissaoServico ?? func?.comissao;
    const percentualCadastrado = percentualRaw != null && String(percentualRaw).trim() !== '';
    const percentualComissao = percentualCadastrado ? num(percentualRaw) : null;
    const modoRelatorio = modoRelatorioFuncionario(q);
    function formatarServicosAtendimento(servicos) {
      const confirmados = servicos.confirmados.map(s => ({
        ...s,
        baseLiberada: num(s.baseComissao),
        baseAguardando: 0,
        situacao: 'EXECUCAO CONFIRMADA'
      }));
      const registrados = servicos.registrados.map(s => ({
        ...s,
        baseLiberada: servicos.legadoFinalizado ? num(s.baseComissao) : 0,
        baseAguardando: servicos.legadoFinalizado ? 0 : num(s.baseComissao),
        situacao: servicos.legadoFinalizado
          ? 'LIBERADO PELA FINALIZACAO DA O.S. (REGRA LEGADA)'
          : 'AGUARDANDO EXECUCAO CONFIRMADA OU FINALIZACAO'
      }));
      return [...confirmados, ...registrados];
    }

    function formatarOSAtendimento(item, compacto) {
      const { os, servicos, statusOperacional } = item;
      const veiculo = veiculoDeOS(ctx, os);
      const placa = placaOS(ctx, os) || '-';
      const modelo = veiculo.modelo || os.veiculoSnapshot?.modelo || os.veiculoModelo || os.veiculo || os.tipoVeiculo || '-';
      const osNumero = String(os.numero || os.id || '').slice(-6).toUpperCase();
      const data = dataBR(dataPrincipalOS(os));
      const itens = formatarServicosAtendimento(servicos);
      const linhasServico = itens.map(s => {
        const valores = podeVerValores ? [
          `<br>&nbsp;&nbsp;&nbsp;&nbsp;Valor cobrado do cliente: <strong>${moeda(s.valor)}</strong>`,
          `<br>&nbsp;&nbsp;&nbsp;&nbsp;Parte interna atribu&iacute;da ao mec&acirc;nico consultado: <strong>${moeda(s.baseComissao)}</strong>`,
          `<br>&nbsp;&nbsp;&nbsp;&nbsp;Base liberada para comiss&atilde;o: <strong>${moeda(s.baseLiberada)}</strong>`,
          `<br>&nbsp;&nbsp;&nbsp;&nbsp;Valor aguardando execu&ccedil;&atilde;o/finaliza&ccedil;&atilde;o: <strong>${moeda(s.baseAguardando)}</strong>`
        ].join('') : '';
        return [
          `<br>&nbsp;&nbsp;<strong>Servi&ccedil;o:</strong> ${esc(s.desc)}`,
          valores,
          compacto ? '' : `<br>&nbsp;&nbsp;&nbsp;&nbsp;Situa&ccedil;&atilde;o da base: <strong>${esc(s.situacao)}</strong>`
        ].join('');
      }).join('');
      return [
        `- ${esc(data)} | O.S. #${esc(osNumero)} | ${esc(placa)} | ${esc(modelo)}`,
        `<br>&nbsp;&nbsp;<strong>Status atual:</strong> ${esc(statusOperacional.rotulo)}`,
        linhasServico || '<br>&nbsp;&nbsp;Nenhum servi&ccedil;o atribu&iacute;do foi identificado.'
      ].join('');
    }

    const linhas = lista.map(item => formatarOSAtendimento(item, false));
    const totalConfirmado = +lista.reduce((soma, item) => soma + num(item.servicos.totalConfirmado), 0).toFixed(2);
    const baseConfirmadaComissao = +lista.reduce((soma, item) => soma + num(item.servicos.baseComissaoConfirmada), 0).toFixed(2);
    const totalLegadoFinalizado = +lista
      .filter(item => item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.totalRegistrado), 0)
      .toFixed(2);
    const baseLegadaComissao = +lista
      .filter(item => item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.baseComissaoRegistrada), 0)
      .toFixed(2);
    const totalSomenteOrcado = +lista
      .filter(item => !item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.totalRegistrado), 0)
      .toFixed(2);
    const baseAguardandoExecucao = +lista
      .filter(item => !item.servicos.legadoFinalizado)
      .reduce((soma, item) => soma + num(item.servicos.baseComissaoRegistrada), 0)
      .toFixed(2);
    const baseComissao = +(baseConfirmadaComissao + baseLegadaComissao).toFixed(2);
    const valorComissao = percentualComissao == null
      ? null
      : +(baseComissao * (percentualComissao / 100)).toFixed(2);
    const resumoComissao = podeVerValores ? [
      '<br><strong>Resumo para comiss&atilde;o:</strong>',
      `<br>- M&atilde;o de obra com execu&ccedil;&atilde;o confirmada: <strong>${moeda(totalConfirmado)}</strong>`,
      baseConfirmadaComissao !== totalConfirmado ? `<br>- Parte interna atribu&iacute;da ao colaborador nesses servi&ccedil;os: <strong>${moeda(baseConfirmadaComissao)}</strong>` : '',
      `<br>- M&atilde;o de obra de O.S. finalizada legada: <strong>${moeda(totalLegadoFinalizado)}</strong>`,
      baseLegadaComissao !== totalLegadoFinalizado ? `<br>- Parte interna legada atribu&iacute;da ao colaborador: <strong>${moeda(baseLegadaComissao)}</strong>` : '',
      `<br>- Base total considerada para comiss&atilde;o: <strong>${moeda(baseComissao)}</strong>`,
      totalSomenteOrcado > 0
        ? `<br>- Valor cobrado em servi&ccedil;os ainda aguardando execu&ccedil;&atilde;o/finaliza&ccedil;&atilde;o: <strong>${moeda(totalSomenteOrcado)}</strong>`
        : '',
      baseAguardandoExecucao > 0
        ? `<br>- Parte interna ainda aguardando execu&ccedil;&atilde;o/finaliza&ccedil;&atilde;o: <strong>${moeda(baseAguardandoExecucao)}</strong>`
        : '',
      percentualComissao == null
        ? '<br>- Percentual de comiss&atilde;o: <strong>n&atilde;o localizado no cadastro do colaborador</strong>'
        : `<br>- Percentual de comiss&atilde;o sobre m&atilde;o de obra: <strong>${esc(percentualComissao.toLocaleString('pt-BR'))}%</strong>`,
      valorComissao == null
        ? '<br>- Comiss&atilde;o a pagar: <strong>n&atilde;o calculada; cadastre o percentual do colaborador</strong>'
        : `<br>- Comiss&atilde;o calculada: <strong>${moeda(valorComissao)}</strong>`
    ].join('') : '';
    if (modoRelatorio === 'resumo') {
      const linhasResumo = lista.map(item => formatarOSAtendimento(item, true));
      const resumoValores = podeVerValores ? [
        `<br><strong>Total de O.S.:</strong> ${esc(lista.length)} | <strong>Ve&iacute;culos:</strong> ${esc(veiculosUnicos.size)}`,
        `<br><strong>M&atilde;o de obra confirmada:</strong> ${moeda(totalConfirmado)}`,
        `<br><strong>M&atilde;o de obra finalizada legada:</strong> ${moeda(totalLegadoFinalizado)}`,
        `<br><strong>Base liberada para comiss&atilde;o:</strong> ${moeda(baseComissao)}`,
        `<br><strong>Base ainda aguardando execu&ccedil;&atilde;o/finaliza&ccedil;&atilde;o:</strong> ${moeda(baseAguardandoExecucao)}`,
        valorComissao == null ? '' : `<br><strong>Comiss&atilde;o calculada sobre a base liberada:</strong> ${moeda(valorComissao)}`
      ].join('') : `<br><strong>Total de O.S.:</strong> ${esc(lista.length)} | <strong>Ve&iacute;culos:</strong> ${esc(veiculosUnicos.size)}`;
      const periodoTitulo = !periodoInformado
        ? 'no hist&oacute;rico carregado'
        : (periodo.inicio === periodo.fim
          ? `em ${esc(dataBR(periodo.inicio))}`
          : `de ${esc(dataBR(periodo.inicio))} at&eacute; ${esc(dataBR(periodo.fim))}`);
      return [
        `<strong>Resumo de ${esc(nome)} ${periodoTitulo}:</strong>`,
        linhasResumo.join('<br><br>'),
        resumoValores
      ].join('<br>');
    }
    return [
      `<strong>Atendimentos de ${esc(nome)}${periodoInformado ? ` de ${esc(dataBR(periodo.inicio))} at&eacute; ${esc(dataBR(periodo.fim))}` : ' no hist&oacute;rico carregado'}:</strong>`,
      `${lista.length} O.S. em ${veiculosUnicos.size} ve&iacute;culo(s).`,
      linhas.join('<br><br>'),
      resumoComissao,
      '<br><small>Crit&eacute;rio operacional: toda O.S. n&atilde;o cancelada em que o mec&acirc;nico esteja relacionado entra como atendimento, inclusive Triagem, Or&ccedil;amento e itens sem valor/sem servi&ccedil;o lan&ccedil;ado. A libera&ccedil;&atilde;o de comiss&atilde;o permanece separada e continua dependendo das regras financeiras existentes.</small>'
    ].join('<br>');
  }

  function extrairPlaca(txt) {
    const m = String(txt || '').match(/\b[A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}\b/i);
    if (!m) return '';
    const placa = placaLimpa(m[0]);
    // Evita interpretar "ano 2011", códigos e referências como placa Mercosul.
    if (/^(ANO|COD|REF|OEM|DSD|DNI|DPL|BRK|AJE)/.test(placa)) return '';
    return placa;
  }

  function clienteDeOS(ctx, os) {
    return ctx.clientes.find(c => c.id === os?.clienteId) || {};
  }

  function clienteTextoOS(ctx, os) {
    const c = clienteDeOS(ctx, os);
    return textoLivre(Object.assign({}, c || {}, os || {}), [
      'id','nome','razaoSocial','fantasia','apelido','cpf','cnpj','cliente','clienteNome','nomeCliente','clienteRazao',
      'clienteId','responsavel','contato','telefone','celular','placa','veiculo'
    ]);
  }

  function clienteFiltroDaPergunta(texto, q, ctx) {
    const raw = String(texto || '');
    let termo = '';
    const aspas = raw.match(/["“”']([^"“”']{2,80})["“”']/);
    if (aspas) termo = aspas[1];
    if (!termo) {
      const m = raw.match(/cliente\s+(.+?)(?:\s+(?:foram|foi|forao|tem|estao|está|entreg|sem|com|que|quais|quantos|quantas|do|da|depois)|[?.!,]|$)/i);
      if (m) termo = m[1];
    }
    termo = norm(termo).replace(/^(o|a|os|as|do|da|de|dos|das)\s+/, '').trim();

    let melhor = null;
    let melhorScore = 0;
    (Array.isArray(ctx.clientes) ? ctx.clientes : []).forEach(c => {
      const nome = norm([c.nome, c.razaoSocial, c.fantasia, c.apelido, c.cpf, c.cnpj].filter(Boolean).join(' '));
      if (!nome) return;
      let score = 0;
      if (termo && nome.includes(termo)) score += termo.length + 20;
      const tokensNome = nome.split(/\s+/).filter(t => t.length >= 3);
      tokensNome.forEach(t => { if (q.includes(t)) score += t.length; });
      if (score > melhorScore) { melhor = c; melhorScore = score; }
    });

    if (melhor && melhorScore >= 4) {
      const alvo = norm([melhor.nome, melhor.razaoSocial, melhor.fantasia, melhor.apelido, melhor.cpf, melhor.cnpj, melhor.id].filter(Boolean).join(' '));
      return { cliente: melhor, termo: alvo, label: melhor.nome || melhor.razaoSocial || melhor.fantasia || melhor.id || 'cliente' };
    }

    if (termo && termo.length >= 3) return { cliente: null, termo, label: termo };
    return null;
  }

  function filtrarOSPorClientePergunta(ctx, lista, texto, q) {
    if (!/cliente|clientes|frota|empresa|batalhao|batalhão|policia|polícia/i.test(texto)) return { lista, filtro: null };
    const filtro = clienteFiltroDaPergunta(texto, q, ctx);
    if (!filtro || !filtro.termo) return { lista, filtro: null };
    const termos = filtro.termo.split(/\s+/).filter(t => t.length >= 3);
    const filtrada = lista.filter(o => {
      const cliente = clienteDeOS(ctx, o);
      if (filtro.cliente && (String(o.clienteId || '') === String(filtro.cliente.id || '') || String(o.cliente?.id || '') === String(filtro.cliente.id || ''))) return true;
      const hay = norm(clienteTextoOS(ctx, o));
      if (hay.includes(filtro.termo)) return true;
      return termos.length && termos.every(t => hay.includes(t));
    });
    return { lista: filtrada, filtro };
  }

  function veiculoDeOS(ctx, os) {
    return ctx.veiculos.find(v => v.id === os?.veiculoId) || {};
  }

  function placaOS(ctx, os) {
    return placaLimpa(os?.placa || veiculoDeOS(ctx, os)?.placa || '');
  }

  function osMatchesPlaca(ctx, placa) {
    const p = placaLimpa(placa);
    if (!p) return [];
    return ctx.os.filter(o => placaOS(ctx, o) === p);
  }

  function itemExecucao(os, item) {
    const key = item?.key || item?.id || '';
    const e = key && os?.execucaoItens ? os.execucaoItens[key] : null;
    return e?.status || '';
  }

  function resumoOS(ctx, o, opts) {
    const c = clienteDeOS(ctx, o);
    const v = veiculoDeOS(ctx, o);
    const placa = placaOS(ctx, o) || '-';
    const partes = [
      `<strong>O.S. #${esc(String(o.numero || o.id || '').slice(-6).toUpperCase())}</strong>`,
      `placa ${esc(placa)}`,
      `status ${esc(o.status || '-')}`,
      `cliente ${esc(c.nome || o.cliente || '-')}`,
      `veiculo ${esc(v.modelo || o.veiculo || o.tipoVeiculo || '-')}`,
      `entrada ${esc(o.data || String(o.createdAt || '').slice(0, 10) || '-')}`
    ];
    if (opts?.comDiagnostico !== false && (o.desc || o.diagnostico)) {
      partes.push(`relato/diag: ${esc([o.desc, o.diagnostico].filter(Boolean).join(' | '))}`);
    }
    if (opts?.comValores && podeFinanceiro(opts)) partes.push(`total ${moeda(o.total || o.totalAprovado || 0)}`);
    return partes.join(' | ');
  }


  function valorOS(o) {
    return num(o?.totalAprovado || o?.total || o?.valorTotal || o?.valor || o?.orcamentoTotal || 0);
  }

  function financeiroMatchesOS(ctx, f, o) {
    if (!f || !o) return false;
    const txtF = norm(textoFinanceiro(f));
    const osId = norm(o.id || '');
    const osNum = norm(o.numero || '');
    const placa = norm(placaOS(ctx, o));
    const cliente = norm(clienteDeOS(ctx, o)?.nome || o.cliente || '');
    if (osId && txtF.includes(osId)) return true;
    if (osNum && txtF.includes(osNum)) return true;
    if (placa && txtF.includes(placa)) return true;
    if (cliente && cliente.length >= 4 && txtF.includes(cliente)) return true;
    return false;
  }

  function financeiroDaOS(ctx, o) {
    return ctx.financeiro.filter(f => financeiroMatchesOS(ctx, f, o));
  }

  function resumoRecebimentoOS(ctx, o) {
    const fins = financeiroDaOS(ctx, o);
    const pagos = fins.filter(f => isPagoStatus(f.status));
    const pendentes = fins.filter(f => isPendenteStatus(f.status));
    const totalPago = pagos.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const totalPendente = pendentes.reduce((s, f) => s + num(f.valor || f.total || 0), 0);
    const totalOS = valorOS(o);
    const semRecebimento = totalOS > 0
      ? totalPago <= 0 && totalPendente <= 0
      : (!pagos.length && !pendentes.length);
    return { fins, pagos, pendentes, totalPago, totalPendente, totalOS, semRecebimento };
  }

  function resumoFaturamentoOS(ctx, o) {
    const fins = financeiroDaOS(ctx, o);
    const txtOS = norm(textoLivre(o, [
      'id','numero','status','faturado','nfEmitida','notaEmitida','nfeEmitida','numeroNF','nfNumero','nfeNumero','notaFiscal',
      'fatura','faturaId','documentoFiscal','financeiroGerado','orcamentoFaturado','cliente','clienteNome','placa'
    ]));
    const temFlagOS = o?.faturado === true || o?.nfEmitida === true || o?.notaEmitida === true || o?.nfeEmitida === true ||
      !!(o?.numeroNF || o?.nfNumero || o?.nfeNumero || o?.notaFiscal || o?.fatura || o?.faturaId || o?.documentoFiscal || o?.financeiroGerado || o?.orcamentoFaturado);
    const finsFaturamento = fins.filter(f => /receb|entrada|fatur|cliente|orcamento|orçamento|os|o\.s|nota|nf|nfe/.test(tipoFinanceiro(f) + ' ' + norm(textoFinanceiro(f))));
    const temTextoFaturado = /faturad|nf emitid|nota emitid|nfe emitid|fatura/.test(txtOS) && !/nao faturad|não faturad|sem fatur/.test(txtOS);
    const temFaturamento = !!temFlagOS || !!temTextoFaturado || finsFaturamento.length > 0;
    return { temFaturamento, semFaturamento: !temFaturamento, finsFaturamento };
  }

  function statusNormalizadoOS(o) {
    return norm(o?.status || '');
  }

  function isEntregueOS(o) {
    return /entreg|finaliz|concluid/.test(statusNormalizadoOS(o));
  }

  function isCanceladaOS(o) {
    return /cancel|recus/.test(statusNormalizadoOS(o));
  }

  function isAbertaOS(o) {
    return !isEntregueOS(o) && !isCanceladaOS(o);
  }

  function responderVeiculosOSOperacional(texto, q, ctx, opts) {
    // Placa explícita é tratada pelo bloco dedicado, que cruza somente as O.S. daquele veículo.
    if (extrairPlaca(texto)) return null;
    const falaOS = /\b(o\.?s\.?|os|ordem|ordens|veiculo|veiculos|patio|pátio)\b/.test(q);
    if (!falaOS) return null;
    const querReceb = /receb|pago|pagas|pagos|pagamento|sem recebimento|sem receber|sem pagar/.test(q);
    const querFatur = /fatur|nota emitid|nf emitid|nfe emitid|sem nota|sem nf/.test(q);
    const querEntregue = /entreg|fechad|finaliz|concluid/.test(q);
    const querPatio = /patio|pátio|abert|abertas|andamento|aprovad|orcamento|orçamento|triagem|pronto/.test(q);
    const querHoje = /\bhoje\b/.test(q);
    let lista = ctx.os.slice();

    if (querEntregue) lista = lista.filter(isEntregueOS);
    else if (querPatio || /\bveiculos?\b/.test(q)) lista = lista.filter(isAbertaOS);

    const clienteFiltroAplicado = filtrarOSPorClientePergunta(ctx, lista, texto, q);
    lista = clienteFiltroAplicado.lista;

    if (querReceb || querFatur) {
      lista = lista.filter(o => {
        const r = resumoRecebimentoOS(ctx, o);
        const fat = resumoFaturamentoOS(ctx, o);
        const pedeSemReceber = /sem recebimento|sem receber|sem pagamento|sem pagar/.test(q);
        const pedeSemFaturar = /sem fatur|nao fatur|não fatur|sem nota|sem nf/.test(q);
        if (pedeSemReceber && pedeSemFaturar) return r.semRecebimento || r.totalPendente > 0 || fat.semFaturamento;
        if (pedeSemReceber) return r.semRecebimento || r.totalPendente > 0;
        if (pedeSemFaturar) return fat.semFaturamento;
        if (querFatur) return fat.temFaturamento || fat.semFaturamento;
        return r.fins.length || r.totalOS > 0;
      });
    }

    if (querHoje) {
      const hoje = hojeISO();
      lista = lista.filter(o => String(o.data || o.createdAt || o.updatedAt || '').slice(0, 10) === hoje);
    }

    if (!querPatio && !querEntregue && !querReceb && !querFatur && !/\b(os|o\.s\.)\b/.test(q)) return null;

    lista = lista.sort((a, b) => String(b.updatedAt || b.createdAt || b.data || '').localeCompare(String(a.updatedAt || a.createdAt || a.data || '')));

    if (!lista.length) {
      if (querReceb && querEntregue) return 'Não encontrei veículo entregue sem recebimento nos dados carregados.';
      if (querReceb) return 'Não encontrei O.S. sem recebimento nos dados carregados.';
      if (querEntregue) return 'Não encontrei veículo entregue/fechado nos dados carregados.';
      return 'Não encontrei O.S. nessa condição nos dados carregados.';
    }

    const tituloBase = querFatur && querReceb && querEntregue
      ? 'Veículos entregues sem faturar e/ou sem receber'
      : querFatur && querEntregue
        ? 'Veículos entregues sem faturar / sem NF'
        : querReceb && querEntregue
          ? 'Veículos entregues com pendência/sem recebimento'
          : querFatur
            ? 'O.S. sem faturamento/NF identificado'
            : querReceb
              ? 'O.S. com pendência/sem recebimento'
              : querEntregue
                ? 'Veículos entregues / O.S. fechadas'
                : 'Veículos no pátio / O.S. abertas';
    const titulo = clienteFiltroAplicado.filtro?.label ? `${tituloBase} — cliente ${esc(clienteFiltroAplicado.filtro.label)}` : tituloBase;

    const totalValor = lista.reduce((s, o) => s + valorOS(o), 0);
    const linhas = lista.slice(0, 30).map(o => {
      const r = resumoRecebimentoOS(ctx, o);
      const base = resumoOS(ctx, o, Object.assign({}, opts, { comDiagnostico: false, comValores: podeFinanceiro(opts) }));
      const fat = resumoFaturamentoOS(ctx, o);
      const rec = podeFinanceiro(opts)
        ? ` | recebido ${moeda(r.totalPago)} | pendente ${moeda(r.totalPendente)} | ${fat.temFaturamento ? 'faturado/NF localizado' : 'sem faturamento/NF localizado'}`
        : '';
      const prisma = String(o.prisma || o.numeroPrisma || '').trim();
      const prismaTxt = prisma && !isEntregueOS(o) ? ` | prisma ${esc(prisma)}` : '';
      return `- ${base}${prismaTxt}${rec}`;
    });

    const cab = `<strong>${titulo} (${lista.length}):</strong>`;
    const rod = podeFinanceiro(opts) ? `<br><br><strong>Total orçado/aprovado listado:</strong> ${moeda(totalValor)}` : '';
    return `${cab}<br>${linhas.join('<br>')}${rod}`;
  }

  function linhasExecucao(os) {
    const U = W.JOS || W.JarvisOSUtils || {};
    const itens = U.buildBudgetItems?.(os, null) || [];
    if (!itens.length) return '';
    const keys = U.getApprovedKeys?.(os) || new Set(os?.itensAprovados || []);
    const aprovados = itens.filter(it => keys.has(it.key)).slice(0, 12).map(it => {
      const st = itemExecucao(os, it) || 'pendente';
      return `- ${esc(it.labelTipo || it.tipo || 'item')}: ${esc(it.desc || '-')} | execucao ${esc(st)}`;
    }).join('<br>');
    if (!aprovados) return '';
    return `<br><br><strong>Itens aprovados/executados:</strong><br>${aprovados}`;
  }

  function itensOrcamentoOS(ctx, os) {
    const U = W.JOS || W.JarvisOSUtils || {};
    const cliente = clienteDeOS(ctx, os);
    const itens = U.buildBudgetItems?.(os, cliente) || [];
    const aprovados = U.getApprovedKeys?.(os) || new Set(os?.itensAprovados || []);
    return itens.map(item => {
      const status = itemExecucao(os, item);
      const aprovado = aprovados.has(item.key);
      const executado = /executad|concluid|finaliz|instalad|trocad|feito|ok/.test(norm(status));
      const legadoFinalizado = aprovado && !status && isEntregueOS(os);
      return Object.assign({}, item, { aprovado, status, executado, legadoFinalizado });
    });
  }

  function statusVerdadeiroItem(os, item) {
    if (item.executado) return `execução confirmada${item.status ? ` (${esc(item.status)})` : ''}`;
    if (item.legadoFinalizado) return 'O.S. finalizada, sem confirmação individual deste item';
    if (item.aprovado) return 'aprovado, mas execução não confirmada';
    return 'apenas orçado/não aprovado';
  }

  function termosItemPergunta(texto, placa) {
    const p = norm(placa || '');
    return norm(texto)
      .replace(new RegExp(`\\b${p}\\b`, 'g'), ' ')
      .replace(/\b(?:veiculo|veículo|placa|historico|histórico|resumo|servico|serviço|servicos|serviços|peca|peça|pecas|peças|item|itens|foi|foram|trocado|trocada|trocados|trocadas|substituido|substituida|instalado|instalada|feito|feita|executado|executada|realizado|realizada|realizados|realizadas|consta|tem|houve|nesse|nessa|neste|nesta|qual|quais|do|da|de|dos|das|no|na|nos|nas|o|a|os|as|em)\b/g, ' ')
      .replace(/[^a-z0-9./-]+/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3);
  }

  function itemCombinaTermos(item, termos) {
    if (!termos.length) return false;
    const hay = norm([item.codigo, item.codigoInterno, item.codigoTabela, item.desc, item.sistema].join(' '));
    const compacto = hay.replace(/[^a-z0-9]/g, '');
    return termos.every(t => hay.includes(t) || compacto.includes(t.replace(/[^a-z0-9]/g, '')));
  }

  function responderItemEspecificoDaPlaca(texto, q, ctx, opts, placa, listaOS) {
    const querResumo = /resumo.*(?:servic|peca|item)|(?:servic|peca|item).*resumo/.test(q);
    const querServicosRealizados = /(?:qual|quais|liste|mostrar|mostre).*(?:servic).*(?:realiz|execut|feito|fizeram|fizer)|(?:servic).*(?:realiz|execut|feito).*(?:veiculo|placa)/.test(q);
    const querPecasAplicadas = /(?:qual|quais|liste|mostrar|mostre).*(?:peca|item).*(?:troc|substitu|instal|aplic|usad|coloc)|(?:peca|item).*(?:troc|substitu|instal|aplic|usad|coloc).*(?:veiculo|placa)/.test(q);
    const querConfirmar = /foi|foram|troc|substitu|instal|execut|realiz|feito|feita|consta|tem/.test(q);
    if (!querResumo && !querServicosRealizados && !querPecasAplicadas && !querConfirmar) return null;

    const osOrdenadas = listaOS.slice().sort((a, b) => String(b.updatedAt || b.createdAt || b.data || '').localeCompare(String(a.updatedAt || a.createdAt || a.data || '')));
    if (querResumo || querServicosRealizados || querPecasAplicadas) {
      const modo = querServicosRealizados ? 'servico' : (querPecasAplicadas ? 'peca' : 'todos');
      const blocos = osOrdenadas.slice(0, 8).map(o => {
        const itens = itensOrcamentoOS(ctx, o);
        const relevantesBase = itens.filter(i => i.aprovado || i.executado || i.legadoFinalizado);
        const relevantes = modo === 'todos' ? relevantesBase : relevantesBase.filter(i => i.tipo === modo);
        const servicos = relevantesBase.filter(i => i.tipo === 'servico');
        const pecas = relevantesBase.filter(i => i.tipo === 'peca');
        const amostra = relevantes.slice(0, modo === 'todos' ? 8 : 15).map(i => `- ${esc(i.labelTipo || i.tipo)}: ${esc(i.codigo ? `[${i.codigo}] ` : '')}${esc(i.desc || '-') } | ${statusVerdadeiroItem(o, i)}`);
        const extra = Math.max(0, relevantes.length - amostra.length);
        const cabQtd = modo === 'servico' ? `Serviços localizados: ${servicos.length}` : modo === 'peca' ? `Peças localizadas: ${pecas.length}` : `Serviços: ${servicos.length} | Peças: ${pecas.length}`;
        return `${resumoOS(ctx, o, Object.assign({}, opts, { comDiagnostico:false, comValores:false }))}<br>${cabQtd}${amostra.length ? `<br>${amostra.join('<br>')}` : `<br>Nenhum ${modo === 'servico' ? 'serviço' : modo === 'peca' ? 'item de peça' : 'item'} aprovado/executado identificado.`}${extra ? `<br><small>+ ${extra} item(ns).</small>` : ''}`;
      });
      const titulo = modo === 'servico' ? `Serviços realizados/localizados na placa ${esc(placa)}` : modo === 'peca' ? `Peças aplicadas/localizadas na placa ${esc(placa)}` : `Resumo de serviços da placa ${esc(placa)}`;
      return `<strong>${titulo}:</strong><br>${blocos.join('<br><br>')}`;
    }

    const termos = termosItemPergunta(texto, placa);
    if (!termos.length) return null;
    const encontrados = [];
    osOrdenadas.forEach(o => {
      itensOrcamentoOS(ctx, o).forEach(item => {
        if (itemCombinaTermos(item, termos)) encontrados.push({ o, item });
      });
    });
    const descricaoBusca = termos.join(' ');
    if (!encontrados.length) {
      return `Não encontrei ${esc(descricaoBusca)} nas O.S. carregadas da placa ${esc(placa)}. Portanto, não há dado comprovado de troca/instalação desse item.`;
    }
    const linhas = encontrados.slice(0, 8).map(({o,item}) => {
      return `- O.S. #${esc(String(o.numero || o.id || '').slice(-6).toUpperCase())} | ${esc(dataBR(o.data || o.createdAt))} | ${esc(item.codigo ? `[${item.codigo}] ` : '')}${esc(item.desc || '-')} | ${statusVerdadeiroItem(o, item)}`;
    });
    const confirmados = encontrados.filter(x => x.item.executado).length;
    const legados = encontrados.filter(x => x.item.legadoFinalizado).length;
    const conclusao = confirmados
      ? `Sim. Há ${confirmados} registro(s) com execução confirmada.`
      : legados
        ? `O item consta em O.S. finalizada, mas sem confirmação individual de execução. Não é correto afirmar troca comprovada.`
        : `O item consta, porém não há execução confirmada.`;
    return `<strong>${esc(conclusao)}</strong><br>${linhas.join('<br>')}`;
  }

  function extrairTermoPecaUso(texto) {
    const bruto = String(texto || '').toUpperCase();
    const mCodigo = bruto.match(/\b(?:PE[CÇ]A|CODIGO|CÓDIGO|ITEM|REF(?:ERENCIA)?)\s+([A-Z0-9][A-Z0-9./-]{2,18})\b/);
    if (mCodigo) return mCodigo[1];
    const tokens = bruto.match(/[A-Z0-9][A-Z0-9./-]{2,18}/g) || [];
    const stop = new Set(['QUAL','VEICULO','VEÍCULO','PECA','PEÇA','ITEM','FOI','ONDE','USADA','USADO','INSTALADA','INSTALADO','APLICADA','APLICADO','TROCADA','TROCADO','CODIGO','CÓDIGO']);
    return tokens.reverse().find(t => !stop.has(t) && /\d/.test(t)) || '';
  }

  function responderOndePecaFoiUsada(texto, q, ctx) {
    const perguntaUso = /(?:em qual|qual veiculo|qual veículo|onde).*(?:peca|peça|codigo|código|item)|(?:peca|peça|codigo|código|item).*(?:em qual|qual veiculo|qual veículo|onde)/.test(q)
      && /instal|usad|aplic|troc|coloc|baixad/.test(q);
    if (!perguntaUso) return null;
    const termo = extrairTermoPecaUso(texto);
    if (!termo) return 'Informe o código ou a descrição exata da peça que deseja rastrear.';
    const alvo = norm(termo);
    const alvoCompacto = alvo.replace(/[^a-z0-9]/g, '');
    const achados = [];
    ctx.os.forEach(o => {
      itensOrcamentoOS(ctx, o).forEach(item => {
        const hay = norm([item.codigo, item.codigoInterno, item.codigoTabela, item.desc].join(' '));
        const hc = hay.replace(/[^a-z0-9]/g, '');
        if (hay.includes(alvo) || hc.includes(alvoCompacto)) achados.push({ o, item });
      });
    });
    if (!achados.length) {
      const vinculos = ctx.vinculos.filter(v => norm([v.codigo,v.codigoFornecedor,v.codigoComercial,v.desc,v.descricao].join(' ')).replace(/[^a-z0-9]/g, '').includes(alvoCompacto));
      if (!vinculos.length) return `Não encontrei a peça ${esc(termo)} vinculada a veículo ou O.S. nos dados carregados.`;
      return `<strong>Vínculos localizados para ${esc(termo)}:</strong><br>${vinculos.slice(0,10).map(v => `- placa ${esc(v.placa || '-')} | O.S. ${esc(v.osNumero || v.osId || '-')} | ${esc(v.codigo || v.codigoFornecedor || '')} ${esc(v.desc || v.descricao || '')}`).join('<br>')}`;
    }
    const linhas = achados.slice(0, 12).map(({o,item}) => {
      const v = veiculoDeOS(ctx, o);
      return `- ${esc(placaOS(ctx,o) || '-')} | ${esc(v.modelo || o.veiculo || '-')} | O.S. #${esc(String(o.numero || o.id || '').slice(-6).toUpperCase())} | ${esc(item.codigo ? `[${item.codigo}] ` : '')}${esc(item.desc || '-')} | ${statusVerdadeiroItem(o,item)}`;
    });
    const confirmados = achados.filter(x => x.item.executado).length;
    return `<strong>Uso da peça ${esc(termo)}:</strong><br>${linhas.join('<br>')}<br><small>${confirmados ? `${confirmados} ocorrência(s) com execução confirmada.` : 'Nenhuma ocorrência possui execução individual confirmada; os registros acima distinguem item finalizado legado, aprovado ou apenas orçado.'}</small>`;
  }


  function statusConsultaIA(q) {
    const alvo = [];
    if (/orcamento\s+enviado|aguardando\s+aprovacao/.test(q)) alvo.push('Orcamento_Enviado');
    else if (/\borcamento\b/.test(q)) alvo.push('Orcamento', 'Orcamento_Enviado');
    if (/\btriagem\b/.test(q)) alvo.push('Triagem');
    if (/servico\s+aprovado|\baprovad/.test(q)) alvo.push('Aprovado');
    if (/em\s+servico|em\s+atendimento|\bandamento\b/.test(q)) alvo.push('Andamento');
    if (/\bpront/.test(q)) alvo.push('Pronto');
    if (/\bentreg|finaliz|concluid/.test(q)) alvo.push('Entregue');
    return uniq(alvo);
  }

  function responderContagemStatusOSIA(texto, q, ctx) {
    if (!/\bquant[oa]s?\b|\btotal\b|\bquais\b|\bliste\b|\bmostrar\b|\bmostre\b/.test(q)) return null;
    if (!/veiculo|veiculos|o\.?s\.?|ordem|ordens/.test(q)) return null;
    const statusAlvo = statusConsultaIA(q);
    if (!statusAlvo.length) return null;
    const periodo = extrairPeriodoNaturalIA(texto);
    let lista = (ctx.os || []).filter(o => statusAlvo.includes(statusOperacionalAtendimento(o).canonico));
    if (periodo) {
      lista = lista.filter(o => periodoContem(periodo, o.updatedAt || o.finalizadoEm || o.createdAt || o.data));
    }
    const placas = new Set(lista.map(o => placaOS(ctx, o) || o.veiculoId || o.id).filter(Boolean));
    const rotulos = statusAlvo.map(st => ({
      Triagem:'Triagem', Orcamento:'Or&ccedil;amento', Orcamento_Enviado:'Or&ccedil;amento enviado/aguardando aprova&ccedil;&atilde;o',
      Aprovado:'Servi&ccedil;o aprovado', Andamento:'Em servi&ccedil;o', Pronto:'Ve&iacute;culo pronto', Entregue:'Entregue'
    }[st] || st));
    const querLista = /\bquais\b|\bliste\b|\bmostrar\b|\bmostre\b/.test(q);
    const detalhe = querLista && lista.length
      ? '<br>' + lista.slice(0,50).map(o => `- ${esc(placaOS(ctx,o) || '-')} | O.S. ${esc(String(o.numero || o.id || '-').slice(-10))} | ${esc(statusOperacionalAtendimento(o).rotulo)}`).join('<br>')
      : '';
    return `<strong>${esc(placas.size)} ve&iacute;culo(s)</strong> em ${rotulos.join(' / ')}${periodoRotuloIA(periodo)}. ${lista.length !== placas.size ? `${esc(lista.length)} O.S. correspondentes.` : ''}${detalhe}`;
  }

  function servicosDoFuncionarioNaOSIA(os, func) {
    return (Array.isArray(os?.servicos) ? os.servicos : []).filter(s => itemPertenceFuncionario(s, func, os));
  }

  function responderVeiculosMecanicoIA(texto, q, ctx) {
    if (/comiss/.test(q)) return null;
    const fala = /(?:mecanico|funcionario|colaborador).*(?:veiculo|veiculos)|(?:veiculo|veiculos).*(?:mecanico|funcionario|colaborador)|(?:esta|estao|fazendo).*(?:atend).*(?:quais|qual|veiculo|veiculos)/.test(q);
    if (!fala) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return null;
    const periodo = extrairPeriodoNaturalIA(texto);
    const querAtual = /\besta\b|\bestao\b|agora|atualmente|fazendo|em atendimento/.test(q) && !periodo;
    let lista = (ctx.os || []).filter(o => !isCanceladaOS(o) && osAtribuidaFuncionario(o, func));
    if (querAtual) lista = lista.filter(o => !isEntregueOS(o));
    if (periodo) lista = lista.filter(o => evidenciaAtendimentoFuncionario(o, func, periodo));
    lista.sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!lista.length) return `N&atilde;o encontrei ve&iacute;culo relacionado a <strong>${esc(nome)}</strong>${periodoRotuloIA(periodo)}.`;
    const linhas = lista.slice(0,50).map(o => {
      const serv = servicosDoFuncionarioNaOSIA(o, func);
      const resumo = serv.length ? serv.slice(0,5).map(s => esc(s.desc || s.descricao || 'Servi&ccedil;o')).join('; ') : 'mec&acirc;nico relacionado &agrave; O.S., sem servi&ccedil;o individual atribu&iacute;do';
      return `- ${esc(placaOS(ctx,o) || '-')} | O.S. ${esc(String(o.numero || o.id || '-').slice(-10))} | ${esc(statusOperacionalAtendimento(o).rotulo)} | ${resumo}`;
    });
    return `<strong>${esc(nome)} — ${lista.length} O.S. / ${new Set(lista.map(o => placaOS(ctx,o) || o.veiculoId || o.id)).size} ve&iacute;culo(s)${periodoRotuloIA(periodo)}:</strong><br>${linhas.join('<br>')}`;
  }

  function eventoMencionaFuncionarioIA(ev, func) {
    return idCombinaFuncionario(ev?.mecanicoId || ev?.mecId || ev?.responsavelId, func)
      || nomeCombinaFuncionario(ev?.mecanicoNome || ev?.mecNome || ev?.responsavelNome || '', func);
  }

  function responderEventosFuncionarioPeriodoIA(texto, q, ctx) {
    if (/comiss/.test(q)) return null;
    const periodo = extrairPeriodoNaturalIA(texto);
    if (!periodo) return null;
    if (!/(?:fez).*(?:que|o que)|(?:o que).*(?:fez|realizou|executou)|atividade|trabalhou.*(?:que|onde)|realizou.*(?:que|quais)|executou.*(?:que|quais)/.test(q)) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return null;
    const resultados = [];
    (ctx.os || []).forEach(os => {
      const placa = placaOS(ctx, os) || '-';
      (Array.isArray(os.timeline) ? os.timeline : []).forEach(ev => {
        const dt = ev?.dt || ev?.data || ev?.createdAt || ev?.ts || '';
        if (!periodoContem(periodo, dt) || !eventoMencionaFuncionarioIA(ev, func)) return;
        resultados.push({ dt, texto: `${esc(dataBR(dt))} ${esc(String(dt).includes('T') ? new Date(dt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '')} | ${esc(placa)} | ${esc(ev.acao || ev.mensagem || ev.descricao || 'Evento operacional')}` });
      });
      Object.values(os?.execucaoItens || {}).forEach(reg => {
        const dt = reg?.atualizadoEm || reg?.updatedAt || reg?.data || reg?.em || '';
        if (!periodoContem(periodo, dt) || !autoriaRegistroFuncionario(reg, func, osAtribuidaFuncionario(os, func))) return;
        resultados.push({ dt, texto: `${esc(dataBR(dt))} | ${esc(placa)} | execu&ccedil;&atilde;o ${esc(reg?.desc || reg?.descricao || reg?.status || 'registrada')}` });
      });
      servicosDoFuncionarioNaOSIA(os, func).forEach(sv => {
        const evid = dataLancamentoServicoIA(os, sv);
        if (!periodoContem(periodo, evid.data)) return;
        resultados.push({ dt:evid.data, texto: `${esc(dataBR(evid.data))} | ${esc(placa)} | relacionado ao servi&ccedil;o: ${esc(sv.desc || sv.descricao || 'Servi&ccedil;o')}${evid.fonte === 'data_os' ? ' <small>(registro legado: data da O.S., sem hora individual comprovada)</small>' : ''}` });
      });
      if (osAtribuidaFuncionario(os, func) && periodoContem(periodo, dataPrincipalOS(os)) && !servicosDoFuncionarioNaOSIA(os, func).length) {
        resultados.push({ dt:dataPrincipalOS(os), texto: `${esc(dataBR(dataPrincipalOS(os)))} | ${esc(placa)} | mec&acirc;nico relacionado &agrave; O.S.; nenhum servi&ccedil;o individual atribu&iacute;do foi localizado.` });
      }
    });
    const unicos = Array.from(new Map(resultados.map(r => [`${r.dt}|${norm(r.texto.replace(/<[^>]+>/g,''))}`, r])).values()).sort((a,b)=>String(a.dt).localeCompare(String(b.dt)));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!unicos.length) return `N&atilde;o encontrei evento comprovado de <strong>${esc(nome)}</strong>${periodoRotuloIA(periodo)}.`;
    return `<strong>Atividade de ${esc(nome)}${periodoRotuloIA(periodo)}:</strong><br>${unicos.slice(0,80).map(r=>'- '+r.texto).join('<br>')}`;
  }

  function dataHoraEventoIA(valor) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return dataBR(valor) || String(valor);
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function responderPlacaMecanicoIA(texto, q, ctx, placa, listaOS) {
    if (/comiss/.test(q)) return null;
    const func = funcionarioDaPerguntaOperacional(ctx, texto, q);
    if (!func) return null;
    if (!/(servic|fez|realiz|execut|atend|trabalh|relacionad)/.test(q)) return null;
    const osRelacionadas = listaOS.filter(o => osAtribuidaFuncionario(o, func));
    const nome = func.nome || func.usuario || func.id || 'mec&acirc;nico';
    if (!osRelacionadas.length) return `N&atilde;o encontrei <strong>${esc(nome)}</strong> relacionado &agrave;s O.S. carregadas da placa ${esc(placa)}.`;
    const querQuando = /\bquando\b|que\s+dia|que\s+hora|data.*(?:servic|troc|fez)/.test(q);
    const linhas = [];
    osRelacionadas.forEach(os => {
      const servicos = servicosDoFuncionarioNaOSIA(os, func);
      if (servicos.length) {
        servicos.forEach(sv => {
          const desc = sv.desc || sv.descricao || 'Servi&ccedil;o';
          if (querQuando) {
            const tokens = norm(desc).split(/\s+/).filter(t => t.length >= 4).slice(0,4);
            const exec = Object.values(os?.execucaoItens || {}).find(reg => {
              const hay = norm([reg?.desc,reg?.descricao,reg?.servicoDescricao,reg?.status].join(' '));
              const dt = reg?.atualizadoEm || reg?.updatedAt || reg?.data || reg?.em;
              return dt && autoriaRegistroFuncionario(reg, func, osAtribuidaFuncionario(os,func)) && (!tokens.length || tokens.every(t=>hay.includes(t)));
            });
            if (exec) {
              const dt = exec.atualizadoEm || exec.updatedAt || exec.data || exec.em;
              linhas.push(`- ${esc(dataHoraEventoIA(dt))} | O.S. ${esc(String(os.numero || os.id || '-').slice(-10))} | execu&ccedil;&atilde;o registrada de <strong>${esc(desc)}</strong> por ${esc(nome)}.`);
              return;
            }
            const ev = (Array.isArray(os.timeline) ? os.timeline : []).find(e => {
              const hay = norm([e?.servicoDescricao,e?.acao,e?.descricao,e?.mensagem].join(' '));
              return eventoMencionaFuncionarioIA(e, func) && (!tokens.length || tokens.every(t=>hay.includes(t)));
            });
            if (ev) {
              const ator = ev.usuarioNome || ev.user || ev.usuario || 'usuário não identificado';
              const perfil = ev.usuarioPerfil || ev.perfil || 'usuário';
              linhas.push(`- ${esc(dataHoraEventoIA(ev.dt || ev.data || ev.createdAt))} | ${esc(perfil)} ${esc(ator)} registrou: ${esc(ev.acao || `relacionou ${nome} ao servi&ccedil;o ${desc}`)}.`);
              return;
            }
            const dtAtrib = sv.mecAtribuidoEm || sv.lancadoEm || sv.atribuidoEm || '';
            if (dtAtrib) {
              const ator = sv.mecAtribuidoPorNome || sv.lancadoPorNome || '';
              linhas.push(`- ${esc(dataHoraEventoIA(dtAtrib))} | ${ator ? `${esc(ator)} registrou ` : ''}${esc(nome)} relacionado ao servi&ccedil;o <strong>${esc(desc)}</strong>.${!sv.mecAtribuidoEm ? ' <small>O registro n&atilde;o possui evento individual de atribui&ccedil;&atilde;o; foi usada a data de lan&ccedil;amento dispon&iacute;vel.</small>' : ''}`);
              return;
            }
          }
          const evid = dataLancamentoServicoIA(os, sv);
          const status = itemExecucao(os, sv) || sv.statusExecucao || '';
          linhas.push(`- O.S. ${esc(String(os.numero || os.id || '-').slice(-10))} | ${esc(dataBR(evid.data) || '-')} | ${esc(desc)} | ${status ? `execu&ccedil;&atilde;o ${esc(status)}` : 'atribu&iacute;do ao mec&acirc;nico; execu&ccedil;&atilde;o individual n&atilde;o confirmada'}`);
        });
      } else {
        linhas.push(`- O.S. ${esc(String(os.numero || os.id || '-').slice(-10))} | ${esc(statusOperacionalAtendimento(os).rotulo)} | ${esc(nome)} est&aacute; relacionado &agrave; O.S., mas n&atilde;o existe servi&ccedil;o individual atribu&iacute;do a ele nesse registro.`);
      }
    });
    return `<strong>${esc(nome)} na placa ${esc(placa)}:</strong><br>${linhas.join('<br>')}`;
  }

  function responderDatasPlacaIA(texto, q, ctx, placa, listaOS) {
    if (!/\bquando\b|\bdata\b/.test(q)) return null;
    const querFinal = /finaliz|entreg|concluid/.test(q);
    const querAbertura = /abri|abertura|entrada|entrou/.test(q);
    if (!querFinal && !querAbertura) return null;
    const linhas = listaOS.slice(0,20).map(os => {
      const abertura = os.createdAt || os.abertaEm || os.dataAbertura || os.data || '';
      const finalizacao = os.finalizadoEm || os.entregueEm || os.dataFinalizacao || '';
      const prontoEm = os.prontoEm || os.servicoFinalizadoEm || '';
      const finalTxt = finalizacao
        ? esc(dataHoraEventoIA(finalizacao))
        : (prontoEm ? `<strong>O.S. ainda sem entrega/finaliza&ccedil;&atilde;o formal</strong>; ve&iacute;culo ficou pronto em ${esc(dataHoraEventoIA(prontoEm))}` : '<strong>n&atilde;o registrada/finalizada</strong>');
      return `- O.S. ${esc(String(os.numero || os.id || '-').slice(-10))}${querAbertura ? ` | abertura: ${esc(dataHoraEventoIA(abertura))}` : ''}${querFinal ? ` | finaliza&ccedil;&atilde;o: ${finalTxt}` : ''} | status ${esc(statusOperacionalAtendimento(os).rotulo)}`;
    });
    return `<strong>Datas da placa ${esc(placa)}:</strong><br>${linhas.join('<br>')}`;
  }

  function responderAtendimentosPlacaIA(texto, q, ctx, placa, listaOS) {
    if (!/atendimentos?|historico.*(?:os|ordem)|ordens.*placa/.test(q)) return null;
    const linhas = listaOS.slice().sort((a,b)=>String(a.createdAt || a.data || '').localeCompare(String(b.createdAt || b.data || ''))).map(os => {
      const mecs = uniq([
        os.mecNome,
        ...(Array.isArray(os.mecanicos) ? os.mecanicos.map(m=>m?.nome || m?.mecNome) : []),
        ...(Array.isArray(os.servicos) ? os.servicos.flatMap(s=>[s?.mecNome,s?.mecanicoNome,...(Array.isArray(s?.rateiosComissao)?s.rateiosComissao.map(r=>r?.mecNome||r?.nome):[])]) : [])
      ]).filter(Boolean);
      const serv = (Array.isArray(os.servicos) ? os.servicos : []).filter(s=>s?.desc || s?.descricao).slice(0,10).map(s=>esc(s.desc || s.descricao)).join('; ');
      const abertura = os.createdAt || os.abertaEm || os.data || '';
      const fim = os.finalizadoEm || os.entregueEm || '';
      return `- O.S. ${esc(String(os.numero || os.id || '-').slice(-10))} | abertura ${esc(dataBR(abertura) || '-')} | ${esc(statusOperacionalAtendimento(os).rotulo)}${fim ? ` | finalizada ${esc(dataBR(fim))}` : ''}${mecs.length ? ` | mec&acirc;nico(s): ${esc(mecs.join(', '))}` : ''}${serv ? `<br>&nbsp;&nbsp;Servi&ccedil;os: ${serv}` : '<br>&nbsp;&nbsp;Sem servi&ccedil;o lan&ccedil;ado.'}`;
    });
    return `<strong>Atendimentos da placa ${esc(placa)} (${listaOS.length} O.S.):</strong><br>${linhas.join('<br>')}`;
  }

  function normalizeBrainJson(raw, fallback) {
    let obj = raw;
    if (typeof raw === 'string') {
      const txt = raw.trim();
      if (!txt) obj = {};
      else obj = JSON.parse(txt);
    }
    obj = obj && typeof obj === 'object' ? obj : {};
    const comportamento = Object.assign({
      tom: 'direto',
      permitirPiadas: false
    }, obj.comportamento || {});
    const escopo = ['global', 'tenant'].includes(String(obj.escopo || '').toLowerCase())
      ? String(obj.escopo).toLowerCase()
      : (fallback?.escopo || 'tenant');
    return {
      versao: Number(obj.versao || 1),
      escopo,
      comportamento: {
        tom: ['direto', 'tecnico', 'brincalhao'].includes(norm(comportamento.tom)) ? norm(comportamento.tom) : 'direto',
        permitirPiadas: comportamento.permitirPiadas === true
      },
      contexto: obj.contexto || fallback?.contexto || '',
      catalogos: obj.catalogos || fallback?.catalogos || '',
      erros: obj.erros || fallback?.erros || '',
      regras: asArray(obj.regras || fallback?.regras),
      procedimentos: asArray(obj.procedimentos || fallback?.procedimentos),
      diagnosticos: asArray(obj.diagnosticos || fallback?.diagnosticos),
      conhecimento: asArray(obj.conhecimento || fallback?.conhecimento),
      fontes: asArray(obj.fontes || fallback?.fontes),
      pendenciasConhecimento: asArray(obj.pendenciasConhecimento || obj.pendencias || fallback?.pendenciasConhecimento),
      duvidasResolvidas: asArray(obj.duvidasResolvidas || fallback?.duvidasResolvidas),
      conflitosConhecimento: asArray(obj.conflitosConhecimento || fallback?.conflitosConhecimento),
      atualizadoEm: obj.atualizadoEm || new Date().toISOString()
    };
  }

  function brainLocal() {
    const ofi = (typeof W.thiaGetOficinaAtual === 'function' ? W.thiaGetOficinaAtual() : null) || getJ().oficina || {};
    const base = ofi.brain || ofi.cerebro || ofi.thiaguinhoBrain || {};
    try { return normalizeBrainJson(base, { escopo: 'tenant' }); }
    catch (_) { return normalizeBrainJson({}, { escopo: 'tenant' }); }
  }

  function brainGlobal() {
    try {
      const raw = sessionStorage.getItem('thia_cerebro_global') || localStorage.getItem('thia_cerebro_global') || '';
      return raw ? normalizeBrainJson(raw, { escopo: 'global' }) : null;
    } catch (_) {
      return null;
    }
  }

  function combinarCerebrosGlobais(base, adicional) {
    const a = base ? normalizeBrainJson(base, { escopo: 'global' }) : normalizeBrainJson({}, { escopo: 'global' });
    const b = adicional ? normalizeBrainJson(adicional, { escopo: 'global' }) : null;
    if (!b) return a;
    return normalizeBrainJson({
      versao: Math.max(Number(a.versao || 1), Number(b.versao || 1)),
      escopo: 'global',
      comportamento: Object.assign({}, a.comportamento || {}, b.comportamento || {}),
      contexto: [a.contexto, b.contexto].filter(Boolean).join('\n'),
      catalogos: [a.catalogos, b.catalogos].filter(Boolean).join('\n'),
      erros: [a.erros, b.erros].filter(Boolean).join('\n'),
      regras: [...asArray(a.regras), ...asArray(b.regras)],
      procedimentos: [...asArray(a.procedimentos), ...asArray(b.procedimentos)],
      diagnosticos: [...asArray(a.diagnosticos), ...asArray(b.diagnosticos)],
      conhecimento: [...asArray(a.conhecimento), ...asArray(b.conhecimento)],
      fontes: [...asArray(a.fontes), ...asArray(b.fontes)],
      pendenciasConhecimento: [...asArray(a.pendenciasConhecimento), ...asArray(b.pendenciasConhecimento)],
      duvidasResolvidas: [...asArray(a.duvidasResolvidas), ...asArray(b.duvidasResolvidas)],
      conflitosConhecimento: [...asArray(a.conflitosConhecimento), ...asArray(b.conflitosConhecimento)]
    }, { escopo: 'global' });
  }

  async function carregarCerebroGlobal() {
    if (W._thiaCerebroGlobalCarregado) return brainGlobal();
    W._thiaCerebroGlobalCarregado = true;
    let embarcado = null;
    let central = null;
    try {
      const resp = await fetch('data/ia-base-global.json?v=19.0.0', { cache: 'no-store' });
      if (resp.ok) embarcado = await resp.json();
    } catch (e) {
      console.warn('[thIAguinho IA] base global embarcada nao carregada:', e.message || e);
    }
    try {
      const cdb = typeof W.initCentralFirebase === 'function' ? W.initCentralFirebase() : null;
      if (cdb) {
        const doc = await cdb.collection('cerebros_ia').doc('global').get();
        if (doc.exists) central = doc.data();
      }
    } catch (e) {
      console.warn('[thIAguinho IA] complemento global do Superadmin nao carregado:', e.message || e);
    }
    const data = combinarCerebrosGlobais(embarcado, central);
    try { sessionStorage.setItem('thia_cerebro_global', JSON.stringify(data)); } catch (_) {}
    return data;
  }

  function juntarBrain() {
    const tenant = brainLocal();
    const global = brainGlobal();
    const comportamento = Object.assign({}, global?.comportamento || {}, tenant?.comportamento || {});
    return {
      comportamento: {
        tom: comportamento.tom || 'direto',
        permitirPiadas: comportamento.permitirPiadas === true
      },
      conhecimento: [...asArray(global?.conhecimento), ...asArray(tenant?.conhecimento)],
      regras: [...asArray(global?.regras), ...asArray(tenant?.regras)],
      procedimentos: [...asArray(global?.procedimentos), ...asArray(tenant?.procedimentos)],
      diagnosticos: [...asArray(global?.diagnosticos), ...asArray(tenant?.diagnosticos)],
      pendenciasConhecimento: [...asArray(global?.pendenciasConhecimento), ...asArray(tenant?.pendenciasConhecimento)],
      duvidasResolvidas: [...asArray(global?.duvidasResolvidas), ...asArray(tenant?.duvidasResolvidas)],
      textos: uniq([
        global?.contexto, global?.catalogos, global?.erros,
        tenant?.contexto, tenant?.catalogos, tenant?.erros
      ])
    };
  }

  function itemTexto(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item;
    return [
      item.titulo, item.nome, item.marca, item.modelo, item.motor, item.sistema,
      item.placa, item.defeito, item.problema, item.solucao, item.texto,
      item.descricao, item.resposta, Array.isArray(item.codigos) ? item.codigos.join(' ') : '',
      item.fonte && item.fonte.arquivo ? item.fonte.arquivo : ''
    ]
      .filter(Boolean).join(' | ');
  }

  function buscarNoCerebro(q) {
    const tenant = brainLocal();
    const global = brainGlobal();
    const termos = norm(q).split(/\s+/).filter(t => t.length >= 4);
    const montar = (arr, tipo, prio) => asArray(arr).map(x => ({ tipo, txt: itemTexto(x), prio }));
    const textos = (brain, prio) => [brain?.contexto, brain?.catalogos, brain?.erros]
      .filter(Boolean).map(x => ({ tipo: 'Contexto', txt: x, prio }));
    const fontes = [
      ...montar(tenant?.conhecimento, 'Conhecimento da oficina', 2),
      ...montar(tenant?.diagnosticos, 'Diagnostico da oficina', 2),
      ...montar(tenant?.procedimentos, 'Procedimento da oficina', 2),
      ...montar(tenant?.regras, 'Regra da oficina', 2),
      ...textos(tenant, 2),
      ...montar(global?.conhecimento, 'Conhecimento global', 1),
      ...montar(global?.diagnosticos, 'Diagnostico global', 1),
      ...montar(global?.procedimentos, 'Procedimento global', 1),
      ...montar(global?.regras, 'Regra global', 1),
      ...textos(global, 1)
    ].filter(x => x.txt);
    const achados = fontes.map(f => {
      const n = norm(f.txt);
      const score = termos.reduce((s, t) => s + (n.includes(t) ? 1 : 0), 0);
      return Object.assign({ score }, f);
    }).filter(x => x.score > 0).sort((a, b) => (b.score - a.score) || (b.prio - a.prio)).slice(0, 6);
    return achados;
  }

  function pareceConsultaCatalogo(texto) {
    const q = norm(texto);
    const codigoFabricante = /\b(ds|dni|dpl|brk|aje|jurid|nytron|ranalle|wahler|ete)[-./ ]?\d{3,}\b/.test(q);
    const documental = /catalog|aplic|equival|referencia|codigo|rainha|aje|wahler|dni|nytron|ranalle|dpl|forcecar|brk|brasilkits|jurid|ds automotive/.test(q);
    const pecaComAplicacao = /(sensor|valvula|bico|pastilha|sapata|tensor|polia|diafragma|bomba|terminal|bucha|rolamento|correia|filtro|chicote|interruptor|tomada|conector|plug|soquete|bobina|ignicao|medidor|boia|flange)/.test(q)
      && /(\b(?:19|20)\d{2}\b|\b1[.,][034568]\b|celta|palio|corsa|gol|uno|fiat|gm|chevrolet|ford|volkswagen|renault|toyota|honda)/.test(q);
    return codigoFabricante || documental || pecaComAplicacao;
  }

  function buscarNosCatalogos(q) {
    try {
      return typeof W.thiaCatalogosBuscar === 'function' ? (W.thiaCatalogosBuscar(q, 6) || []) : [];
    } catch (e) {
      console.warn('[thIAguinho IA] busca em catálogos:', e?.message || e);
      return [];
    }
  }

  function respostaCatalogos(q) {
    const hits = buscarNosCatalogos(q);
    if (!hits.length) return '';
    if (typeof W.thiaCatalogosFormatar === 'function') return W.thiaCatalogosFormatar(hits, q);
    const h = hits[0];
    return `<strong>${esc(h.fonte)}:</strong> ${esc(h.texto).slice(0, 320)}<br><small>Fonte: ${esc(h.pdf || '')}, página ${esc(h.pagina)}.</small>`;
  }

  function aplicarComportamento(html) {
    const b = juntarBrain();
    if (b.comportamento.permitirPiadas && b.comportamento.tom === 'brincalhao') {
      return html + '<br><br><small>Pra descontrair: se o carro tossiu, eu nao passo xarope, passo scanner.</small>';
    }
    return html;
  }

  function responderSuperadmin(pergunta) {
    const q = norm(pergunta);
    const tenants = Array.isArray(W.allTenants) ? W.allTenants : [];
    if (!tenants.length) return null;
    const ativos = tenants.filter(t => t.status === 'Online').length;
    const bloqueados = tenants.filter(t => t.status === 'Bloqueado').length;
    const modCount = nome => tenants.filter(t => t.modulos?.[nome] !== false).length;
    if (/tenant|oficina|modulo|licenca|bloquead|online|resumo|saas/.test(q)) {
      return aplicarComportamento([
        `<strong>Resumo Superadmin:</strong> ${tenants.length} tenant(s), ${ativos} online, ${bloqueados} bloqueado(s).`,
        `Modulos liberados: O.S. ${modCount('os')}, Financeiro ${modCount('financeiro')}, Estoque ${modCount('estoque')}, IA ${modCount('ia')}, Chat ${modCount('chat')}.`,
        `Tenants recentes: ${esc(tenants.slice(0, 12).map(t => `${t.nomeFantasia || t.id} (${t.status || 'sem status'})`).join(' | '))}`
      ].join('<br>'));
    }
    return null;
  }

  function thiaResponderLocal(pergunta, opts) {
    const texto = String(pergunta || '').trim();
    const q = norm(texto);
    const ctx = dataSets(opts);
    const r = role(opts);

    if (!texto) return '';

    if (/superadmin/.test(r) || location.pathname.toLowerCase().includes('superadmin')) {
      const sup = responderSuperadmin(texto);
      if (sup) return sup;
    }

    const respostaDadosPrecisos = responderJarvisDadosPrecisos(texto, q, ctx, opts);
    if (respostaDadosPrecisos) return aplicarComportamento(respostaDadosPrecisos);

    const contagemStatus = responderContagemStatusOSIA(texto, q, ctx);
    if (contagemStatus) return aplicarComportamento(contagemStatus);

    const respostaOSOperacional = responderVeiculosOSOperacional(texto, q, ctx, opts);
    if (respostaOSOperacional) return aplicarComportamento(respostaOSOperacional);

    const usoPeca = responderOndePecaFoiUsada(texto, q, ctx);
    if (usoPeca) return aplicarComportamento(usoPeca);

    // Códigos e aplicações documentais têm prioridade sobre qualquer padrão parecido com placa.
    const consultaDocumentalPrioritaria = pareceConsultaCatalogo(texto)
      && !/estoque critico|estoque minimo|saldo.*estoque/.test(q);
    if (consultaDocumentalPrioritaria) {
      const documental = respostaCatalogos(texto);
      if (documental) return aplicarComportamento(documental);
    }

    const placa = extrairPlaca(texto);
    if (placa) {
      const lista = osMatchesPlaca(ctx, placa).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      if (!lista.length) return `Nao encontrei O.S. carregada para a placa ${esc(placa)}. Confirme se a placa esta correta ou se os dados ja sincronizaram.`;
      const placaMecanico = responderPlacaMecanicoIA(texto, q, ctx, placa, lista);
      if (placaMecanico) return aplicarComportamento(placaMecanico);
      const datasPlaca = responderDatasPlacaIA(texto, q, ctx, placa, lista);
      if (datasPlaca) return aplicarComportamento(datasPlaca);
      const atendimentosPlaca = responderAtendimentosPlacaIA(texto, q, ctx, placa, lista);
      if (atendimentosPlaca) return aplicarComportamento(atendimentosPlaca);
      const itemEspecifico = responderItemEspecificoDaPlaca(texto, q, ctx, opts, placa, lista);
      if (itemEspecifico) return aplicarComportamento(itemEspecifico);
      if (/histor|defeit|problema|resolvid|garantia|ja.*fez|troco|trocad|diagnost/.test(q)) {
        const linhas = lista.slice(0, 8).map(o => resumoOS(ctx, o, opts) + linhasExecucao(o));
        return aplicarComportamento(`<strong>Historico da placa ${esc(placa)}:</strong><br>${linhas.join('<br><br>')}`);
      }
      return aplicarComportamento(lista.slice(0, 5).map(o => resumoOS(ctx, o, opts)).join('<br>'));
    }

    // Perguntas explicitamente documentais consultam primeiro os PDFs. Assim,
    // termos como "aplicação", um código de peça ou o nome do fabricante não
    // são confundidos com histórico de diagnóstico da oficina.
    const querCatalogo = pareceConsultaCatalogo(texto)
      && !/estoque critico|estoque minimo|saldo.*estoque/.test(q);
    if (querCatalogo) {
      const documental = respostaCatalogos(texto);
      if (documental) return aplicarComportamento(documental);
    }

    if (/histor|defeit|problema|resolvid|garantia|diagnost/.test(q)) {
      const termos = q.split(/\s+/).filter(t => t.length >= 4 && !/histor|defeit|problema|resolvid|garantia|diagnost|geral/.test(t));
      const encontrados = ctx.os.filter(o => {
        const v = veiculoDeOS(ctx, o);
        const hay = norm([o.desc, o.diagnostico, o.status, v.modelo, v.marca, o.veiculo, (o.pecas || []).map(p => p.desc).join(' '), (o.servicos || []).map(s => s.desc).join(' ')].join(' '));
        return termos.length && termos.every(t => hay.includes(t));
      }).slice(0, 10);
      if (encontrados.length) {
        return aplicarComportamento(`<strong>Historico encontrado:</strong><br>${encontrados.map(o => resumoOS(ctx, o, opts) + linhasExecucao(o)).join('<br><br>')}`);
      }
      return 'Para buscar historico tecnico com precisao, informe a placa, modelo ou o defeito principal. Exemplo: "historico da ETR7E65" ou "falhas de arrefecimento do Siena".';
    }

    if (/resumo|geral|painel|patio/.test(q) && /(oficina|geral|hoje|dados|patio|os)/.test(q)) {
      const abertas = ctx.os.filter(o => !/entreg|cancel|recus|finaliz/i.test(String(o.status || '')));
      const estoqueCritico = ctx.estoque.filter(p => num(p.qtd) <= num(p.min || p.minimo || 0));
      const linhas = [
        `<strong>Resumo local do tenant ${esc(ctx.J.tid || '-')}:</strong>`,
        `O.S.: ${ctx.os.length} (${abertas.length} abertas)`,
        `Clientes: ${ctx.clientes.length}`,
        `Veiculos: ${ctx.veiculos.length}`,
        `Estoque: ${ctx.estoque.length} itens (${estoqueCritico.length} criticos)`,
        `Equipe: ${ctx.equipe.length}`
      ];
      if (podeFinanceiro(opts)) linhas.push(`Financeiro: ${ctx.financeiro.length} lancamento(s)`);
      return aplicarComportamento(linhas.join('<br>'));
    }

    if (/estoque|peca|pecas|critico|minimo|comprar/.test(q)) {
      const crit = ctx.estoque.filter(p => num(p.qtd) <= num(p.min || p.minimo || 0));
      if (/critico|minimo|baixo|comprar/.test(q)) {
        if (!crit.length) return 'Nao ha peca abaixo do minimo nos dados carregados.';
        const exibidos = crit.slice(0, 10);
        const restantes = Math.max(0, crit.length - exibidos.length);
        return `<strong>Estoque cr&iacute;tico (${crit.length}):</strong><br>${exibidos.map(p => `- ${esc(p.codigo ? '[' + p.codigo + '] ' : '')}${esc(p.desc || p.descricao || 'Pe&ccedil;a')} | saldo ${esc(p.qtd || 0)} | m&iacute;nimo ${esc(p.min || p.minimo || 0)}`).join('<br>')}${restantes ? `<br><small>+ ${restantes} item(ns). Pe&ccedil;a &quot;listar estoque cr&iacute;tico completo&quot; para ver todos.</small>` : ''}`;
      }
      const termos = q.split(/\s+/).filter(t => t.length >= 4);
      const achados = ctx.estoque.filter(p => termos.some(t => norm([p.codigo, p.desc, p.descricao, p.oem, p.ean].join(' ')).includes(t))).slice(0, 20);
      if (!achados.length) {
        const catalogos = respostaCatalogos(texto);
        if (catalogos) return catalogos;
        return 'Qual peca, codigo ou aplicacao voce quer consultar no estoque ou nos catalogos tecnicos?';
      }
      return `<strong>Pecas localizadas:</strong><br>${achados.map(p => `- ${esc(p.codigo || '')} ${esc(p.desc || p.descricao || 'Peca')} | saldo ${esc(p.qtd || 0)}`).join('<br>')}`;
    }

    if (/boleto|conta|titulo|duplicata|financeiro|pix|vencid|vencendo|pagar|receber/.test(q)) {
      if (!podeFinanceiro(opts)) return 'Seu perfil nao tem permissao para consultar financeiro. Posso consultar O.S., historico tecnico, defeitos, veiculos e execucao.';
      const hoje = hojeISO();
      const analiseFinanceira = /analis|analise|resumo|risco|prioridade|dre|atual|geral/.test(q);
      let lista = ctx.financeiro;
      if (/hoje/.test(q)) lista = lista.filter(f => String(f.venc || f.vencimento || '').slice(0, 10) === hoje);
      if (!analiseFinanceira && /vencid|atrasad/.test(q)) lista = lista.filter(f => {
        const venc = String(f.venc || f.vencimento || '').slice(0, 10);
        return venc && venc < hoje && !/pago|liquid|baix|cancel/.test(norm(f.status));
      });
      if (/pix/.test(q) && /parcel/.test(q)) {
        lista = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
        if (!lista.length) return 'Nao encontrei PIX parcelado nos dados carregados.';
      }
      if (analiseFinanceira) {
        const vencidos = ctx.financeiro.filter(f => {
          const venc = String(f.venc || f.vencimento || '').slice(0, 10);
          return venc && venc < hoje && !/pago|liquid|baix|cancel/.test(norm(f.status));
        });
        const hojeLista = ctx.financeiro.filter(f => String(f.venc || f.vencimento || '').slice(0, 10) === hoje);
        const pendentes = ctx.financeiro.filter(f => !/pago|liquid|baix|cancel/.test(norm(f.status)));
        const pixParcelado = ctx.financeiro.filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (num(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\s*\/\s*\d+\)/.test(String(f.desc || ''))));
        const totalPendente = pendentes.reduce((s, f) => s + num(f.valor), 0);
        const linhas = [
          `<strong>Análise financeira local:</strong> ${ctx.financeiro.length} lançamento(s) carregado(s).`,
          `Pendentes/em aberto: ${pendentes.length} (${moeda(totalPendente)}).`,
          `Vencidos: ${vencidos.length}. Vencendo hoje: ${hojeLista.length}. PIX parcelado suspeito: ${pixParcelado.length}.`
        ];
        const prioridades = [...vencidos, ...hojeLista, ...pixParcelado, ...pendentes]
          .filter((f, i, arr) => arr.findIndex(x => (x.id || x.desc || x.descricao) === (f.id || f.desc || f.descricao)) === i)
          .slice(0, 5);
        if (prioridades.length) linhas.push('<br><strong>Prioridades:</strong><br>' + prioridades.map(f => `- ${esc(f.venc || f.vencimento || '-')} | ${esc(f.desc || f.descricao || 'Lancamento')} | ${moeda(f.valor)} | ${esc(f.status || '-')}`).join('<br>'));
        return linhas.join('<br>');
      }
      if (!lista.length) return 'Nao encontrei lancamento financeiro para essa pergunta nos dados carregados.';
      const total = lista.reduce((s, f) => s + num(f.valor), 0);
      return `<strong>Financeiro localizado (${lista.length}):</strong><br>${lista.slice(0, 10).map(f => `- ${esc(f.venc || f.vencimento || '-')} | ${esc(f.desc || f.descricao || 'Lancamento')} | ${moeda(f.valor)} | ${esc(f.status || '-')}`).join('<br>')}<br><br><strong>Total:</strong> ${moeda(total)}`;
    }

    if (/equipe|mecanico|mecanicos|funcionario|responsavel/.test(q)) {
      if (!ctx.equipe.length) return 'Nao ha equipe carregada nesta sessao.';
      return `<strong>Equipe carregada:</strong><br>${ctx.equipe.slice(0, 30).map(f => `- ${esc(f.nome || f.usuario || f.id)} | ${esc(f.cargo || 'equipe')}`).join('<br>')}`;
    }

    if (/nota fiscal|\bnf\b|xml|\bnotas?\b/.test(q)) {
      if (!ctx.notas.length) {
        const catalogosFornecedor = respostaCatalogos(texto);
        if (catalogosFornecedor) return aplicarComportamento(catalogosFornecedor);
        return 'Nao ha notas fiscais carregadas nesta sessao.';
      }
      return `<strong>Notas fiscais carregadas:</strong><br>${ctx.notas.slice(0, 20).map(n => `- NF ${esc(n.numero || '-')} | ${esc(n.fornecedorSnapshot?.nome || n.fornecedorNome || '-')} | ${esc(n.dataNF || '-')} | ${moeda(n.totalNF || n.totalItens || 0)}`).join('<br>')}`;
    }

    if (/fornecedor|fornecedores/.test(q)) {
      const fornecedor = fornecedorPorPerguntaIA(ctx, texto);
      if (fornecedor) {
        return `<strong>Fornecedor localizado:</strong> ${esc(fornecedor.nome || fornecedor.razaoSocial || fornecedor.fantasia || fornecedor.id)}${fornecedor.cnpj ? `<br>CNPJ: ${esc(fornecedor.cnpj)}` : ''}${fornecedor.telefone || fornecedor.wpp ? `<br>Contato: ${esc(fornecedor.telefone || fornecedor.wpp)}` : ''}${fornecedor.email ? `<br>E-mail: ${esc(fornecedor.email)}` : ''}`;
      }
      return 'Informe o nome do fornecedor e o que deseja consultar: boletos, pagamentos, notas fiscais, compras ou estoque.';
    }

    const catalogos = respostaCatalogos(texto);
    if (catalogos) return aplicarComportamento(catalogos);

    const brainHits = buscarNoCerebro(texto);
    if (brainHits.length) {
      return aplicarComportamento(`<strong>Base de conhecimento:</strong><br>${brainHits.map(h => `- ${esc(h.tipo)}: ${esc(h.txt).slice(0, 280)}`).join('<br>')}`);
    }

    if (/ajuda|o que voce|o que consegue|comando/.test(q)) {
      return 'Posso responder internamente sobre O.S. por placa, historico de defeitos, problemas resolvidos, estoque, equipe, notas fiscais, pecas vinculadas, boletos e gastos por fornecedor e servicos atribuidos a mecanicos por periodo. Para valores financeiros, respeito as permissoes do perfil. Se a pergunta ficar aberta, vou pedir placa, fornecedor, mecanico, periodo ou entidade em vez de adivinhar.';
    }

    return 'Preciso de mais contexto para responder com dado verdadeiro. Informe placa, modelo, cliente, periodo ou modulo. Exemplo: "historico da placa ETR7E65", "estoque critico" ou "defeitos recorrentes do Siena".';
  }

  function addUser(txt) {
    if (typeof W._iaMsgUser === 'function') return W._iaMsgUser(txt);
    if (typeof W.adicionarMsgIA === 'function') return W.adicionarMsgIA('user', esc(txt));
    const c = D.getElementById('iaMsgs');
    if (!c) return null;
    const d = D.createElement('div');
    d.className = 'ia-msg user';
    d.textContent = txt;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return d.id || null;
  }

  function addBot(html) {
    if (typeof W._iaMsgBot === 'function') return W._iaMsgBot(html);
    if (typeof W.adicionarMsgIA === 'function') {
      W.adicionarMsgIA('bot', html);
      return '__legacy__';
    }
    const c = D.getElementById('iaMsgs');
    if (!c) return null;
    const id = 'ia-local-' + Date.now();
    const d = D.createElement('div');
    d.id = id;
    d.className = 'ia-msg bot';
    d.innerHTML = '<strong>thIAguinho:</strong> ' + html;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
    return id;
  }

  function replaceBot(id, html) {
    if (typeof W._iaReplace === 'function' && id && id !== '__legacy__') return W._iaReplace(id, html);
    const c = D.getElementById('iaMsgs');
    const el = id === '__legacy__' ? c?.lastElementChild : D.getElementById(id);
    if (el) el.innerHTML = '<strong>thIAguinho:</strong> ' + html;
  }

  async function thiaIAAsk(inputId, perfil) {
    const input = D.getElementById(inputId || 'iaInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    addUser(msg);
    const consultaCatalogo = pareceConsultaCatalogo(msg);
    const lid = addBot(`<span class="j-spinner"></span> ${consultaCatalogo ? 'Consultando dados internos e catálogos técnicos...' : 'Consultando dados internos...'}`);
    const resp = await thiaResponderLocalAsync(msg, { perfil });
    W.iaHistorico.push({ role: 'user', text: msg });
    W.iaHistorico.push({ role: 'model', text: String(resp).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '') });
    replaceBot(lid, resp);
  }

  async function thiaResponderLocalAsync(pergunta, opts) {
    const msg = String(pergunta || '').trim();
    if (!msg) return '';
    try { await carregarCerebroGlobal(); } catch (_) {}
    if (pareceConsultaCatalogo(msg) && typeof W.thiaCatalogosPrepararPergunta === 'function') {
      try { await W.thiaCatalogosPrepararPergunta(msg); } catch (e) {
        console.warn('[thIAguinho IA] falha ao preparar catálogos:', e?.message || e);
      }
    }
    return thiaResponderLocal(msg, opts);
  }

  function setPromptAndAsk(txt, perfil) {
    const el = D.getElementById('iaInput');
    if (el) el.value = txt;
    if (W.ir) W.ir('ia');
    setTimeout(() => thiaIAAsk('iaInput', perfil), 100);
  }

  W.thiaNormalizeBrainJson = normalizeBrainJson;
  W.thiaCarregarCerebroGlobal = carregarCerebroGlobal;
  W.thiaResponderLocal = thiaResponderLocal;
  W.thiaResponderLocalAsync = thiaResponderLocalAsync;
  W.thiaPareceConsultaCatalogo = pareceConsultaCatalogo;
  W.thiaIAAsk = thiaIAAsk;
  W.thiaResponderPendenciaConhecimento = async function (pergunta, resposta) {
    const J = getJ();
    const database = W.db || J.db;
    const textoPergunta = String(pergunta || '').trim();
    const textoResposta = String(resposta || '').trim();
    if (!textoPergunta || !textoResposta) throw new Error('Informe pergunta/pendencia e resposta validada.');
    const payload = {
      tenantId: J.tid || '',
      pergunta: textoPergunta,
      resposta: textoResposta,
      respondidoPor: J.nome || J.usuario || J.role || 'jarvis',
      perfil: J.role || 'jarvis',
      origem: 'jarvis_validacao_conhecimento',
      createdAt: new Date().toISOString()
    };
    if (database) {
      await database.collection('cerebro_respostas').add(payload);
      const FieldValue = W.firebase?.firestore?.FieldValue;
      if (FieldValue && J.tid) {
        const item = Object.assign({ atualizadoEm: payload.createdAt }, payload);
        try { await database.collection('oficinas').doc(J.tid).set({ brain: { duvidasResolvidas: FieldValue.arrayUnion(item), atualizadoEm: payload.createdAt } }, { merge: true }); } catch (_) {}
        try { await database.collection('tenants').doc(J.tid).set({ brain: { duvidasResolvidas: FieldValue.arrayUnion(item), atualizadoEm: payload.createdAt } }, { merge: true }); } catch (_) {}
      }
    }
    const ofi = J.oficina = J.oficina || {};
    ofi.brain = ofi.brain || ofi.cerebro || {};
    ofi.brain.duvidasResolvidas = asArray(ofi.brain.duvidasResolvidas);
    ofi.brain.duvidasResolvidas.push(payload);
    return payload;
  };

  W.iaPerguntar = function () { return thiaIAAsk('iaInput', podeFinanceiro({ perfil: getJ().role }) ? 'jarvis' : getJ().role); };
  W.iaEnviar = function () { return thiaIAAsk('iaInput', 'equipe'); };
  W.iaAnalisarDRE = function () { return setPromptAndAsk('Analise o financeiro atual e aponte riscos, vencidos e prioridades.', 'jarvis'); };
  W.iaAnalisarEstoque = function () { return setPromptAndAsk('Quais pecas estao em nivel critico para reposicao?', getJ().role || 'jarvis'); };

  W.thiaGerarModeloCerebroJSON = function (escopo) {
    return JSON.stringify({
      versao: 1,
      escopo: escopo || 'tenant',
      comportamento: { tom: 'direto', permitirPiadas: false },
      conhecimento: [
        { titulo: 'Exemplo', texto: 'Descreva conhecimento verdadeiro da oficina.' }
      ],
      regras: ['Nunca afirmar peca trocada sem execucao registrada.'],
      procedimentos: [],
      diagnosticos: []
    }, null, 2);
  };

  W.adicionarMsgIA = W.adicionarMsgIA || function (roleName, html) {
    const el = D.getElementById('iaMsgs');
    if (!el) return;
    const div = D.createElement('div');
    div.className = 'ia-msg ' + roleName;
    div.innerHTML = roleName === 'bot' ? '<strong>thIAguinho:</strong> ' + html : html;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  };

  D.addEventListener('DOMContentLoaded', function () {
    const input = D.getElementById('iaInput');
    if (input && !input.__thiaLocalEnter) {
      input.__thiaLocalEnter = true;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (location.pathname.toLowerCase().includes('equipe')) W.iaEnviar();
          else W.iaPerguntar();
        }
      });
    }
  });
})();
