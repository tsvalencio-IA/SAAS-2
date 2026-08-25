/*
 * thIAguinho SaaS - smoke test Jarvis/Admin
 * Uso: abrir jarvis.html logado, F12 > Console, colar tudo e Enter.
 * Nao grava no Firebase.
 */
(async function thiaTesteJarvis() {
  'use strict';
  const out = [];
  const J = window.J || {};
  const ok = (nome, detalhe = '') => out.push({ status: 'OK', nome, detalhe });
  const warn = (nome, detalhe = '') => out.push({ status: 'ATENCAO', nome, detalhe });
  const fail = (nome, detalhe = '') => out.push({ status: 'FALHA', nome, detalhe });
  const fn = nome => typeof window[nome] === 'function';
  const has = id => !!document.getElementById(id);
  const arr = nome => Array.isArray(J[nome]) ? J[nome] : [];
  const html = document.documentElement.innerHTML;

  J.tid ? ok('Tenant carregado', J.tid) : fail('Tenant carregado', 'J.tid vazio');
  window.db ? ok('Firestore ativo') : fail('Firestore ativo', 'window.db ausente');
  ['os','clientes','veiculos','estoque','financeiro','fornecedores','notasFiscaisEntrada','equipe'].forEach(n => ok('Volume ' + n, String(arr(n).length)));

  [
    'salvarOS','salvarOSContinuar','renderFinanceiro','renderEstoque','buscarHistoricoOS',
    'iaPerguntar','thiaResponderLocal','thiaNormalizeBrainJson','thiaCarregarCerebroGlobal',
    'thiaCatalogosBuscar','thiaCatalogosPrepararPergunta',
    'abrirCotacaoFornecedoresOSLote','gerarEnvioCotacaoOS','exportarOrcamentoPMSP'
  ].forEach(n => fn(n) ? ok('Funcao ' + n) : warn('Funcao ' + n, 'Ausente nesta versao/tela'));

  [
    'modalOS','osId','containerServicosOS','containerPecasOS','cotacaoPecasOSSlot',
    'histBuscaTermo','histBuscaResultado','iaInput'
  ].forEach(id => has(id) ? ok('Elemento #' + id) : warn('Elemento #' + id, 'Ausente nesta tela/perfil'));

  if (/generativelanguage\.googleapis|chave Gemini|Testar Gemini/i.test(html)) fail('Sem Gemini ativo', 'Texto/endpoint Gemini ainda aparece no Jarvis');
  else ok('Sem Gemini ativo');

  try {
    const r = fn('thiaResponderLocal') ? window.thiaResponderLocal('resumo geral da oficina', { perfil: 'jarvis' }) : '';
    r ? ok('IA local responde Jarvis', String(r).replace(/<[^>]+>/g, ' ').slice(0, 180)) : fail('IA local responde Jarvis', 'Sem resposta');
  } catch (e) {
    fail('IA local responde Jarvis', e.message || e);
  }

  const leaks = ['os','clientes','veiculos','estoque','financeiro','fornecedores'].flatMap(col =>
    arr(col).filter(x => x?.tenantId && J.tid && x.tenantId !== J.tid).map(x => `${col}/${x.id || 'sem-id'} tenant=${x.tenantId}`)
  );
  leaks.length ? fail('Isolamento tenant em memoria', leaks.slice(0, 12).join(' | ')) : ok('Isolamento tenant em memoria');

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado Jarvis: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
