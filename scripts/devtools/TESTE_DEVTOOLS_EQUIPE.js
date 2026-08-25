/*
 * thIAguinho SaaS - smoke test Equipe/Mecanico
 * Uso: abrir equipe.html logado, F12 > Console, colar tudo e Enter.
 * Nao grava no Firebase.
 */
(async function thiaTesteEquipe() {
  'use strict';
  const out = [];
  const J = window.J || {};
  const ok = (nome, detalhe = '') => out.push({ status: 'OK', nome, detalhe });
  const warn = (nome, detalhe = '') => out.push({ status: 'ATENCAO', nome, detalhe });
  const fail = (nome, detalhe = '') => out.push({ status: 'FALHA', nome, detalhe });
  const fn = nome => typeof window[nome] === 'function';
  const has = id => !!document.getElementById(id);
  const arr = nome => Array.isArray(J[nome]) ? J[nome] : [];
  const text = document.body.innerText || '';

  J.tid ? ok('Tenant carregado', J.tid) : fail('Tenant carregado', 'J.tid vazio');
  window.db ? ok('Firestore ativo') : fail('Firestore ativo', 'window.db ausente');
  ok('Perfil atual', J.role || sessionStorage.getItem('j_role') || '-');
  ['os','clientes','veiculos','equipe'].forEach(n => ok('Volume ' + n, String(arr(n).length)));

  ['thiaResponderLocal','thiaCarregarCerebroGlobal','iaEnviar','abrirOS','salvarChecklist','salvarExecucaoOS'].forEach(n =>
    fn(n) ? ok('Funcao ' + n) : warn('Funcao ' + n, 'Pode ter outro nome nesta tela')
  );

  ['iaInput','modalOS','chatInput','listaOS','containerChecklist','containerFotos'].forEach(id =>
    has(id) ? ok('Elemento #' + id) : warn('Elemento #' + id, 'Ausente/nao renderizado agora')
  );

  if (/R\$\s*\d/.test(text)) fail('Equipe sem valores financeiros', 'Ha valor R$ visivel na tela atual');
  else ok('Equipe sem valores financeiros');

  if (/Financeiro|DRE|comiss[aã]o|lucro/i.test(text)) warn('Texto sensivel financeiro', 'Revise se aparece apenas por permissao correta');
  else ok('Sem textos financeiros obvios');

  try {
    const r = fn('thiaResponderLocal') ? window.thiaResponderLocal('historico tecnico da placa ABC1234', { perfil: 'equipe' }) : '';
    r ? ok('IA equipe responde tecnico', String(r).replace(/<[^>]+>/g, ' ').slice(0, 160)) : warn('IA equipe responde tecnico', 'Sem resposta local');
  } catch (e) {
    fail('IA equipe responde tecnico', e.message || e);
  }

  const leaks = ['os','clientes','veiculos'].flatMap(col =>
    arr(col).filter(x => x?.tenantId && J.tid && x.tenantId !== J.tid).map(x => `${col}/${x.id || 'sem-id'} tenant=${x.tenantId}`)
  );
  leaks.length ? fail('Isolamento tenant em memoria', leaks.slice(0, 12).join(' | ')) : ok('Isolamento tenant em memoria');

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado Equipe: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
