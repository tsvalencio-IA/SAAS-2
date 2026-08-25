/*
 * thIAguinho SaaS - Cadastro Brasil
 * Mascaras, validacao CPF/CNPJ, duplicidade local e CEP via ViaCEP.
 * Nao grava dados sozinho; apenas padroniza campos e expõe helpers.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;

  function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function maskCPF(v) {
    const d = onlyDigits(v).slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  function maskCNPJ(v) {
    const d = onlyDigits(v).slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function maskCpfCnpj(v) {
    const d = onlyDigits(v);
    return d.length > 11 ? maskCNPJ(d) : maskCPF(d);
  }

  function maskCEP(v) {
    const d = onlyDigits(v).slice(0, 8);
    return d.replace(/^(\d{5})(\d)/, '$1-$2');
  }

  function maskPhoneBR(v) {
    const d = onlyDigits(v).slice(0, 13);
    const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
    if (local.length <= 10) return local.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3').replace(/[-\s]+$/, '');
    return local.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3').replace(/[-\s]+$/, '');
  }

  function validarCPF(v) {
    const cpf = onlyDigits(v);
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let dig = 11 - (soma % 11);
    if (dig >= 10) dig = 0;
    if (dig !== Number(cpf[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    dig = 11 - (soma % 11);
    if (dig >= 10) dig = 0;
    return dig === Number(cpf[10]);
  }

  function validarCNPJ(v) {
    const cnpj = onlyDigits(v);
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const calc = len => {
      const pesos = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
      const soma = pesos.reduce((s, p, i) => s + Number(cnpj[i]) * p, 0);
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
  }

  function validarCpfCnpj(v, opts) {
    const d = onlyDigits(v);
    if (!d) return opts && opts.obrigatorio === false;
    if (d.length === 11) return validarCPF(d);
    if (d.length === 14) return validarCNPJ(d);
    return false;
  }

  function docKey(v) {
    return onlyDigits(v);
  }

  function documentoExiste(lista, doc, idAtual) {
    const key = docKey(doc);
    if (!key) return false;
    return (lista || []).some(item => {
      if (idAtual && String(item.id || '') === String(idAtual)) return false;
      const itemKey = docKey(item.doc || item.documento || item.cpfCnpj || item.cnpj || item.cpf);
      return itemKey && itemKey === key;
    });
  }

  async function buscarCepBrasil(cep, map, opts) {
    const c = onlyDigits(cep);
    if (c.length !== 8) return null;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const data = await resp.json();
      if (data.erro) throw new Error('CEP nao encontrado.');
      const values = {
        cep: maskCEP(c),
        rua: data.logradouro || '',
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        municipio: data.localidade || '',
        uf: data.uf || '',
        complemento: data.complemento || ''
      };
      Object.entries(map || {}).forEach(([id, key]) => {
        const el = D.getElementById(id);
        if (el) el.value = values[key] || '';
      });
      if (opts && opts.focusId) D.getElementById(opts.focusId)?.focus();
      return data;
    } catch (e) {
      if (opts && opts.toast !== false && typeof W.toast === 'function') W.toast('CEP nao localizado: ' + (e.message || e), 'warn');
      return null;
    }
  }

  function setNumeric(el, maxLength) {
    if (!el) return;
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('autocomplete', el.getAttribute('autocomplete') || 'off');
    if (maxLength) el.setAttribute('maxlength', String(maxLength));
  }

  function installField(id, kind, cb) {
    const el = D.getElementById(id);
    if (!el || el.__thiaBrasilMask) return;
    el.__thiaBrasilMask = true;
    if (kind === 'cpfcnpj') setNumeric(el, 18);
    if (kind === 'cpf') setNumeric(el, 14);
    if (kind === 'cnpj') setNumeric(el, 18);
    if (kind === 'cep') setNumeric(el, 9);
    if (kind === 'phone') setNumeric(el, 16);
    el.addEventListener('input', () => {
      const posEnd = el.selectionStart === el.value.length;
      if (kind === 'cpfcnpj') el.value = maskCpfCnpj(el.value);
      if (kind === 'cpf') el.value = maskCPF(el.value);
      if (kind === 'cnpj') el.value = maskCNPJ(el.value);
      if (kind === 'cep') el.value = maskCEP(el.value);
      if (kind === 'phone') el.value = maskPhoneBR(el.value);
      if (posEnd) el.selectionStart = el.selectionEnd = el.value.length;
      if (typeof cb === 'function') cb(el);
    });
  }

  function instalarMascarasBrasil() {
    [
      ['cliDoc', 'cpfcnpj'],
      ['vendaClienteDoc', 'cpfcnpj'],
      ['fornecDoc', 'cpfcnpj'],
      ['fornecCnpj', 'cpfcnpj'],
      ['tCnpj', 'cnpj'],
      ['tAssinaturaDocumento', 'cpfcnpj']
    ].forEach(([id, kind]) => installField(id, kind));
    [
      'cliCep', 'fornecCep', 'tCep'
    ].forEach(id => installField(id, 'cep'));
    [
      'cliWpp', 'vendaClienteWpp', 'fornecWpp', 'fornecTelefone', 'tTelefone', 'tWpp'
    ].forEach(id => installField(id, 'phone'));

    const cliCep = D.getElementById('cliCep');
    if (cliCep && !cliCep.__thiaCepBlur) {
      cliCep.__thiaCepBlur = true;
      cliCep.addEventListener('blur', () => buscarCepBrasil(cliCep.value, {
        cliRua: 'rua', cliBairro: 'bairro', cliCidade: 'cidade'
      }, { focusId: 'cliNum' }));
    }
    const fornecCep = D.getElementById('fornecCep');
    if (fornecCep && !fornecCep.__thiaCepBlur) {
      fornecCep.__thiaCepBlur = true;
      fornecCep.addEventListener('blur', () => buscarCepBrasil(fornecCep.value, {
        fornecRua: 'rua', fornecBairro: 'bairro', fornecCidade: 'cidade', fornecUf: 'uf'
      }, { focusId: 'fornecNumero' }));
    }
    const tCep = D.getElementById('tCep');
    if (tCep && !tCep.__thiaCepBlur) {
      tCep.__thiaCepBlur = true;
      tCep.addEventListener('blur', () => buscarCepBrasil(tCep.value, {
        tEndereco: 'rua', tBairro: 'bairro', tCidade: 'cidade', tUf: 'uf'
      }, { focusId: 'tNumero' }));
    }
  }

  W.thiaOnlyDigits = onlyDigits;
  W.thiaMaskCPF = maskCPF;
  W.thiaMaskCNPJ = maskCNPJ;
  W.thiaMaskCpfCnpj = maskCpfCnpj;
  W.thiaMaskCEP = maskCEP;
  W.thiaMaskPhoneBR = maskPhoneBR;
  W.thiaValidarCPF = validarCPF;
  W.thiaValidarCNPJ = validarCNPJ;
  W.thiaValidarCpfCnpj = validarCpfCnpj;
  W.thiaDocumentoExiste = documentoExiste;
  W.thiaBuscarCepBrasil = buscarCepBrasil;
  W.thiaInstalarMascarasBrasil = instalarMascarasBrasil;

  D.addEventListener('DOMContentLoaded', instalarMascarasBrasil);
  setTimeout(instalarMascarasBrasil, 700);
})();
