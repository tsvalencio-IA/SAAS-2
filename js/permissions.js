/**
 * thIAguinho ERP — PERMISSÕES CLIENTE-SIDE
 *
 * REGRA DE OURO: a segurança REAL está nas Firestore Rules.
 * Esta camada é só defense-in-depth (UI/UX) e não deve ser confiável sozinha.
 *
 * Mecânico nunca vê preço/total/custo/margem em nenhuma tela.
 * Cliente nunca vê notas internas/comentários técnicos privados.
 *
 * Powered by thIAguinho Soluções Digitais
 */
(function() {
  'use strict';

  const ROLES = {
    SUPER:   'superadmin',
    ADMIN:   'oficina_admin',
    GERENTE: 'gerente',
    GESTOR:  'gestor',
    DONO:    'dono',
    FINANC:  'financeiro',
    MEC:     'mecanico',
    CLIENTE: 'cliente',
    EQUIPE:  'equipe'
  };

  function _role() {
    return String(window.J?.role || sessionStorage.getItem('j_role') || '').toLowerCase();
  }

  // ─── PODE VER VALORES FINANCEIROS? ──────────────────────────────
  // Mecânico/equipe NUNCA vê. Cliente também não (vê só seu total quando
  // a OS já estiver aprovada/pronta, e mesmo assim controlado pela tela).
  window.podeVerFinanceiro = function() {
    const r = _role();
    return [ROLES.SUPER, ROLES.ADMIN, ROLES.FINANC, ROLES.GERENTE, ROLES.GESTOR, ROLES.DONO].includes(r);
  };

  // ─── PODE VER NOTAS INTERNAS? ───────────────────────────────────
  window.podeVerNotasInternas = function() {
    const r = _role();
    return [ROLES.SUPER, ROLES.ADMIN, ROLES.FINANC, ROLES.MEC, ROLES.GERENTE, ROLES.GESTOR, ROLES.DONO, ROLES.EQUIPE].includes(r);
  };

  // ─── PODE EXECUTAR ITEM DA OS? ──────────────────────────────────
  window.podeExecutarOS = function() {
    const r = _role();
    return [ROLES.SUPER, ROLES.ADMIN, ROLES.MEC, ROLES.GERENTE, ROLES.GESTOR, ROLES.DONO, ROLES.EQUIPE].includes(r);
  };

  // ─── REMOVE CAMPOS SENSÍVEIS DE UM PAYLOAD ──────────────────────
  // Use isso ANTES de mostrar dados pro mecânico/cliente.
  const CAMPOS_FINANCEIROS = [
    'total','totalServicos','totalPecas','totalAprovado','totalFaturado','totalOrcamento',
    'subtotal','desconto','descontoMO','descontoPeca','descMO','descPeca',
    'custo','venda','margem','lucro',
    'valor','valorHora','valorHoraSecao','valorHoraTabela','valorUnit',
    'precoCusto','precoVenda','preco',
    'pgtoForma','pgtoData','pgtoParcelas','pgtoQuitado','pgtoResumoCliente',
    'aReceberDe','quitadoPeloCliente'
  ];

  window.sanitizarParaMecanico = function(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (window.podeVerFinanceiro()) return obj; // staff vê tudo
    if (_role() !== ROLES.MEC && _role() !== ROLES.EQUIPE) return obj;
    const limpo = {};
    Object.keys(obj).forEach(k => {
      if (!CAMPOS_FINANCEIROS.includes(k)) limpo[k] = obj[k];
    });
    // Sanitiza arrays aninhados (servicos[], pecas[])
    if (Array.isArray(obj.servicos)) {
      limpo.servicos = obj.servicos.map(s => {
        const c = { ...s };
        CAMPOS_FINANCEIROS.forEach(f => delete c[f]);
        return c;
      });
    }
    if (Array.isArray(obj.pecas)) {
      limpo.pecas = obj.pecas.map(p => {
        const c = { ...p };
        CAMPOS_FINANCEIROS.forEach(f => delete c[f]);
        return c;
      });
    }
    return limpo;
  };

  // ─── ESCONDE ELEMENTOS COM atributo data-financ NA TELA ─────────
  // Use <span data-financ="1">R$ 100,00</span> em qualquer template.
  // Se o usuário for mecânico, esses elementos somem.
  window.aplicarRegrasUIporRole = function(root) {
    const r = _role();
    const ehMec = (r === ROLES.MEC || r === ROLES.EQUIPE);
    const ehCli = (r === ROLES.CLIENTE);
    (root || document).querySelectorAll('[data-financ]').forEach(el => {
      el.style.display = (ehMec || ehCli) && !window.podeVerFinanceiro() ? 'none' : '';
    });
    (root || document).querySelectorAll('[data-interno]').forEach(el => {
      el.style.display = ehCli ? 'none' : '';
    });
  };

  // ─── APLICA AUTOMATICAMENTE AO CARREGAR / TROCAR DE TELA ────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.aplicarRegrasUIporRole(document));
  } else {
    window.aplicarRegrasUIporRole(document);
  }
  // Observer pra novos nós (modais, kanban dinâmico)
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(muts => {
      let aplicar = false;
      muts.forEach(m => { if (m.addedNodes.length) aplicar = true; });
      if (aplicar) window.aplicarRegrasUIporRole(document);
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }
})();

/* Powered by thIAguinho Soluções Digitais */
