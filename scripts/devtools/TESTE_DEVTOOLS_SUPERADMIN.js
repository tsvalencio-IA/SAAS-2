/*
 * thIAguinho SaaS - smoke test Superadmin
 * Uso: abrir superadmin.html, F12 > Console, colar tudo e Enter.
 * Nao grava no Firebase.
 */
(async function thiaTesteSuperadmin() {
  'use strict';
  const out = [];
  const ok = (nome, detalhe = '') => out.push({ status: 'OK', nome, detalhe });
  const warn = (nome, detalhe = '') => out.push({ status: 'ATENCAO', nome, detalhe });
  const fail = (nome, detalhe = '') => out.push({ status: 'FALHA', nome, detalhe });
  const fn = nome => typeof window[nome] === 'function';
  const has = id => !!document.getElementById(id);
  const arr = nome => Array.isArray(window[nome]) ? window[nome] : [];
  const html = document.documentElement.innerHTML;

  if (window.db) ok('Firestore central disponivel'); else fail('Firestore central disponivel', 'window.db ausente');
  if (window.firebase?.auth) ok('Firebase Auth disponivel'); else warn('Firebase Auth disponivel', 'Pode estar fora da tela logada');
  ['allTenants','allAudit','allSaasFin'].forEach(n => ok('Array ' + n, String(arr(n).length)));

  [
    'prepTenant','salvarTenant','mesclarCerebroSemSobrescrever',
    'importarCerebroGlobalArquivo','importarCerebroTenantArquivo','salvarConfigIA',
    'normalizarCerebroAdmin','validarCerebroTenant','testarCerebroLocal'
  ].forEach(n => fn(n) ? ok('Funcao ' + n) : fail('Funcao ' + n, 'Ausente'));

  [
    'modalTenant','tBrainJsonFile','tBrainJsonRaw','iaBrainGlobalFile','iaBrainGlobalJson'
  ].forEach(id => has(id) ? ok('Elemento #' + id) : fail('Elemento #' + id, 'Ausente'));

  ['SALVAR SEM FECHAR','SALVAR E CONTINUAR','SALVAR E FECHAR'].forEach(txt => {
    html.includes(txt) ? ok('Texto UI: ' + txt) : fail('Texto UI: ' + txt, 'Nao encontrado no HTML');
  });

  if (/Gemini|generativelanguage\.googleapis/i.test(html)) fail('Sem fluxo Gemini ativo', 'Encontrado texto/endpoint Gemini no Superadmin');
  else ok('Sem fluxo Gemini ativo');

  const modIds = ['mOS','mCrm','mEst','mFin','mIA','mChat','mRH','mTabelaTempa','mCotacao','mWhatsappBot'];
  modIds.forEach(id => has(id) ? ok('Modulo check #' + id) : warn('Modulo check #' + id, 'Ausente'));

  try {
    const sampleA = { versao: 1, escopo: 'tenant', conhecimento: [{ texto: 'Filtro de oleo ABC123 aplica no GOL 1.6' }] };
    const sampleB = { versao: 1, escopo: 'tenant', conhecimento: [{ texto: 'Filtro de oleo ABC123 aplica no GOL 1.6' }, { texto: 'Pastilha XYZ987 aplica no Palio' }] };
    const beforePrompt = window.prompt;
    window.prompt = () => '';
    const r = fn('mesclarCerebroSemSobrescrever') ? window.mesclarCerebroSemSobrescrever(sampleA, sampleB, 'tenant') : null;
    window.prompt = beforePrompt;
    if (r?.merged?.conhecimento?.length >= 2) ok('Merge conhecimento sem sobrescrever', 'Complementou sem duplicar amostra');
    else warn('Merge conhecimento sem sobrescrever', 'Nao consegui validar amostra local');
  } catch (e) {
    warn('Merge conhecimento sem sobrescrever', e.message || e);
  }

  console.table(out);
  const falhas = out.filter(x => x.status === 'FALHA').length;
  const atencoes = out.filter(x => x.status === 'ATENCAO').length;
  console.log(`Resultado Superadmin: ${out.length} verificacoes, ${falhas} falha(s), ${atencoes} atencao(oes).`);
  return { falhas, atencoes, detalhes: out };
})();
