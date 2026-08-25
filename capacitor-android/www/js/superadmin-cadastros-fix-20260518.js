/*
 * thIAguinho SaaS - Superadmin cadastro Brasil
 * Mascara, validacao de CNPJ e bloqueio de duplicidade no cadastro de tenant.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const $ = id => D.getElementById(id);
  const val = id => ($(id)?.value || '').trim();
  const digits = v => typeof W.thiaOnlyDigits === 'function' ? W.thiaOnlyDigits(v) : String(v || '').replace(/\D/g, '');

  function toast(msg, type) {
    if (typeof W.toast === 'function') W.toast(msg, type || 'ok');
    else alert(String(msg).replace(/<[^>]+>/g, ''));
  }

  function tenantDoc(t) {
    return t?.cnpj || t?.doc || t?.documento || t?.cpfCnpj || '';
  }

  function validarTenantDoc() {
    const doc = val('tCnpj');
    const key = digits(doc);
    const id = val('tId');
    if (!key) return true;
    if (W.thiaValidarCNPJ && !W.thiaValidarCNPJ(doc)) {
      toast('CNPJ da oficina inválido. Corrija antes de salvar.', 'warn');
      $('tCnpj')?.focus();
      return false;
    }
    const lista = Array.isArray(W.allTenants) ? W.allTenants : (typeof allTenants !== 'undefined' ? allTenants : []);
    const dup = (lista || []).find(t => String(t.id || '') !== String(id || '') && digits(tenantDoc(t)) === key);
    if (dup) {
      toast('Já existe tenant com este CNPJ: ' + (dup.nomeFantasia || dup.id || key), 'warn');
      $('tCnpj')?.focus();
      return false;
    }
    return true;
  }

  function wrapSalvarTenant() {
    if (typeof W.salvarTenant !== 'function' || W.salvarTenant.__thiaBrasilWrap) return;
    const old = W.salvarTenant;
    W.salvarTenant = async function () {
      if (!validarTenantDoc()) return;
      return old.apply(this, arguments);
    };
    W.salvarTenant.__thiaBrasilWrap = true;
  }

  function install() {
    W.thiaInstalarMascarasBrasil?.();
    ['tCnpj','tCep','tTelefone','tWpp','tAssinaturaDocumento'].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute('inputmode', 'numeric');
    });
    wrapSalvarTenant();
  }

  D.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 500);
  setTimeout(install, 1500);
})();
