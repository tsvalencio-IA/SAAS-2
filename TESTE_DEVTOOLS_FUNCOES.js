/*
 * thIAguinho SaaS - teste de fumaça para DevTools
 * Como usar: abrir jarvis.html logado, F12 > Console, colar este arquivo inteiro e pressionar Enter.
 * O script nao grava no Firebase. Ele valida dados carregados, funcoes criticas e riscos visiveis.
 * Powered by thIAguinho Solucoes Digitais
 */
(async function thiaDevSmoke() {
  'use strict';

  const out = [];
  const J = window.J || {};
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const money = v => {
    const n = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
    return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  };
  const pass = (nome, detalhe) => out.push({ status:'OK', nome, detalhe:detalhe || '' });
  const warn = (nome, detalhe) => out.push({ status:'ATENCAO', nome, detalhe:detalhe || '' });
  const fail = (nome, detalhe) => out.push({ status:'FALHA', nome, detalhe:detalhe || '' });
  const fn = nome => typeof window[nome] === 'function';
  const arr = nome => Array.isArray(J[nome]) ? J[nome] : [];
  const has = id => !!document.getElementById(id);

  console.clear();
  console.log('%cthIAguinho SaaS - teste de fumaça DevTools', 'background:#0f172a;color:#7dd3fc;padding:8px 12px;font-weight:700;');

  if (J.tid) pass('Tenant carregado', J.tid);
  else fail('Tenant carregado', 'J.tid vazio. Sem tenant nao existe teste confiavel.');

  if (window.db) pass('Firestore disponível');
  else fail('Firestore disponível', 'window.db ausente.');

  [
    'salvarOS',
    'calcOSTotal',
    'buscarHistoricoOS',
    'iaPerguntar',
    'thiaResponderLocal',
    'exportarOrcamentoPMSP',
    'renderFinanceiro',
    'renderEstoque'
  ].forEach(nome => fn(nome) ? pass('Função ' + nome) : warn('Função ' + nome, 'Nao encontrada nesta tela/perfil.'));

  [
    'modalOS',
    'containerServicosOS',
    'containerPecasOS',
    'histBuscaTermo',
    'histBuscaResultado',
    'iaInput'
  ].forEach(id => has(id) ? pass('Elemento #' + id) : warn('Elemento #' + id, 'Pode nao existir nesta tela/perfil.'));

  const volumes = {
    os: arr('os').length,
    clientes: arr('clientes').length,
    veiculos: arr('veiculos').length,
    estoque: arr('estoque').length,
    financeiro: arr('financeiro').length,
    fornecedores: arr('fornecedores').length,
    notasFiscaisEntrada: arr('notasFiscaisEntrada').length,
    nfItensVinculos: arr('nfItensVinculos').length,
    pacotesBoletos: arr('pacotesBoletos').length
  };
  pass('Volumes carregados', JSON.stringify(volumes));

  const tenantLeaks = ['os','clientes','veiculos','estoque','financeiro','fornecedores','notasFiscaisEntrada','nfItensVinculos'].flatMap(col => {
    return arr(col).filter(x => x && x.tenantId && J.tid && x.tenantId !== J.tid).map(x => `${col}/${x.id || 'sem-id'} tenant=${x.tenantId}`);
  });
  if (tenantLeaks.length) fail('Isolamento de tenant', tenantLeaks.slice(0,20).join(' | '));
  else pass('Isolamento de tenant', 'Nenhum item carregado com tenantId diferente.');

  const pixParcelado = arr('financeiro').filter(f => /pix/i.test(String(f.pgto || f.forma || '')) && (Number(f.pgtoParcelas || f.parcelas || 1) > 1 || /\(\d+\/\d+\)/.test(String(f.desc || ''))));
  if (pixParcelado.length) fail('Financeiro PIX parcelado', pixParcelado.slice(0,10).map(f => `${f.id || 'sem-id'}: ${f.desc || '-'} ${money(f.valor)}`).join(' | '));
  else pass('Financeiro PIX parcelado', 'Nenhum PIX parcelado detectado nos dados carregados.');

  const nfs = arr('notasFiscaisEntrada');
  const nfKeys = new Map();
  nfs.forEach(n => {
    const k = n.chave || [n.numero, n.serie, n.fornecedorCNPJ || n.cnpj].filter(Boolean).join('|');
    if (!k) return;
    nfKeys.set(k, (nfKeys.get(k) || 0) + 1);
  });
  const dupNF = Array.from(nfKeys.entries()).filter(([,q]) => q > 1);
  if (dupNF.length) fail('NFs duplicadas já salvas', dupNF.slice(0,10).map(([k,q]) => `${k} x${q}`).join(' | '));
  else pass('NFs duplicadas já salvas', 'Nenhuma duplicidade visivel nos dados carregados.');

  const localTests = [
    'resumo geral da oficina',
    'quais boletos vencem hoje?',
    'existe pix parcelado?'
  ];
  if (fn('thiaResponderLocal')) {
    localTests.forEach(p => {
      try {
        const r = window.thiaResponderLocal(p);
        r ? pass('IA local: ' + p, String(r).replace(/<[^>]+>/g,' ').slice(0,180)) : warn('IA local: ' + p, 'Sem resposta local; cairia para API/fallback.');
      } catch (e) {
        fail('IA local: ' + p, e.message || e);
      }
    });
  }

  const pickCode = x => x?.codigo || x?.codigoFornecedor || x?.codigoComercial || x?.cProd || x?.oem || x?.ean || '';
  let sampleCode = arr('nfItensVinculos').map(pickCode).find(Boolean)
    || arr('estoque').map(pickCode).find(Boolean)
    || arr('notasFiscaisEntrada').flatMap(n => Array.isArray(n.itens) ? n.itens : []).map(pickCode).find(Boolean)
    || arr('os').flatMap(o => Array.isArray(o.pecasReais) ? o.pecasReais : []).map(pickCode).find(Boolean)
    || '';
  if (sampleCode && fn('buscarHistoricoOS') && has('histBuscaTermo') && has('histBuscaResultado')) {
    const oldSecret = window._pecasReaisDesbloqueadas;
    window._pecasReaisDesbloqueadas = true;
    document.getElementById('histBuscaTermo').value = sampleCode;
    try {
      window.buscarHistoricoOS();
      const html = document.getElementById('histBuscaResultado').innerText || '';
      /Kardex interno|movimento/.test(html) ? pass('Kardex *177 por código', sampleCode) : warn('Kardex *177 por código', 'Resultado nao trouxe layout Kardex.');
    } catch (e) {
      fail('Kardex *177 por código', e.message || e);
    }
    window._pecasReaisDesbloqueadas = oldSecret;
  } else {
    warn('Kardex *177 por código', 'Sem codigo de peça ou elementos de busca carregados.');
  }

  if (fn('thiaListarPixParcelado')) {
    warn('Reparo financeiro disponível', 'Para ver inconsistências: thiaListarPixParcelado(). Para corrigir tudo com auditoria: thiaCorrigirTodosPixParcelado(\"Correção PIX à vista\"). Para um ID: thiaCorrigirPixParcelado(\"ID_DO_LANCAMENTO\").');
  }

  const cssFinanceiroEquipe = document.body.innerText || '';
  if (/equipe|mecanico/i.test(String(J.role || '')) && /R\$\s*\d/.test(cssFinanceiroEquipe)) {
    fail('Equipe sem valores', 'Há valores R$ visiveis no texto da tela atual.');
  } else {
    pass('Equipe sem valores', 'Sem vazamento simples detectado nesta tela/perfil.');
  }

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencao = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado: ${out.length} verificacoes, ${falhas} falha(s), ${atencao} atencao(oes).`);
  return { falhas, atencao, detalhes: out };
})();
