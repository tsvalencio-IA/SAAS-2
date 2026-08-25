/*
 * thIAguinho SaaS - smoke test Portal Cliente
 * Uso: abrir cliente.html com link publico, F12 > Console, colar tudo e Enter.
 * Nao grava no Firebase.
 */
(async function thiaTesteCliente() {
  'use strict';
  const out = [];
  const ok = (nome, detalhe = '') => out.push({ status: 'OK', nome, detalhe });
  const warn = (nome, detalhe = '') => out.push({ status: 'ATENCAO', nome, detalhe });
  const fail = (nome, detalhe = '') => out.push({ status: 'FALHA', nome, detalhe });
  const has = id => !!document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const text = document.body.innerText || '';

  ok('URL', location.href);
  ['tenant','login','os','placa','token'].forEach(k => params.get(k) ? ok('Parametro ' + k, params.get(k)) : warn('Parametro ' + k, 'Ausente no link atual'));
  window.firebase ? ok('Firebase SDK carregado') : fail('Firebase SDK carregado', 'window.firebase ausente');
  window.db ? ok('Firestore ativo') : warn('Firestore ativo', 'Pode inicializar apos login');

  ['loginBox','portalCliente','clienteLogin','clientePin','btnAcessar','listaOS','chatCliente','clienteMsgs'].forEach(id =>
    has(id) ? ok('Elemento #' + id) : warn('Elemento #' + id, 'Ausente ou nome mudou')
  );

  if (/Portal do cliente indispon[ií]vel/i.test(text)) fail('Portal disponivel', 'Tela mostra portal indisponivel');
  else ok('Portal disponivel', 'Nao ha bloqueio visivel');

  if (/R\$\s*\d/.test(text) && !/or[cç]amento|total/i.test(text)) warn('Valores visiveis', 'Cliente pode ver valores fora de contexto de orcamento');
  else ok('Valores no portal', 'Sem vazamento simples fora de contexto');

  if (/Gemini|generativelanguage/i.test(document.documentElement.innerHTML)) fail('Sem Gemini no cliente', 'Encontrado Gemini/API externa');
  else ok('Sem Gemini no cliente');

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado Cliente: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
