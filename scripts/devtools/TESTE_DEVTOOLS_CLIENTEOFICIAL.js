/*
 * thIAguinho SaaS - smoke test Cliente Oficial / orgao publico
 * Uso: abrir clienteOficial.html com link publico, F12 > Console, colar tudo e Enter.
 * Nao grava no Firebase.
 */
(async function thiaTesteClienteOficial() {
  'use strict';
  const out = [];
  const ok = (nome, detalhe = '') => out.push({ status: 'OK', nome, detalhe });
  const warn = (nome, detalhe = '') => out.push({ status: 'ATENCAO', nome, detalhe });
  const fail = (nome, detalhe = '') => out.push({ status: 'FALHA', nome, detalhe });
  const has = id => !!document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const html = document.documentElement.innerHTML;
  const text = document.body.innerText || '';

  ok('URL', location.href);
  ['tenant','login','os','placa','token'].forEach(k => params.get(k) ? ok('Parametro ' + k, params.get(k)) : warn('Parametro ' + k, 'Ausente no link atual'));
  window.firebase ? ok('Firebase SDK carregado') : fail('Firebase SDK carregado', 'window.firebase ausente');
  window.db ? ok('Firestore ativo') : warn('Firestore ativo', 'Pode inicializar apos autenticacao');

  ['loginBox','clienteLogin','clientePin','portalCliente','listaOS','assinaturaBox','aprovacaoBox','chatCliente'].forEach(id =>
    has(id) ? ok('Elemento #' + id) : warn('Elemento #' + id, 'Ausente ou nome mudou')
  );

  ['PDF','assinatura','aprovar','orçamento','laudo'].forEach(term =>
    new RegExp(term, 'i').test(text) ? ok('Fluxo texto: ' + term) : warn('Fluxo texto: ' + term, 'Nao visivel no estado atual')
  );

  if (/Portal.*indispon[ií]vel/i.test(text)) fail('Portal oficial disponivel', 'Tela mostra portal indisponivel');
  else ok('Portal oficial disponivel', 'Nao ha bloqueio visivel');

  if (/Gemini|generativelanguage/i.test(html)) fail('Sem Gemini no clienteOficial', 'Encontrado Gemini/API externa');
  else ok('Sem Gemini no clienteOficial');

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado ClienteOficial: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
