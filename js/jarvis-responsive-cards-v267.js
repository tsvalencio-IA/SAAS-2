/**
 * thIAguinho SaaS V26.7 — cards independentes e responsividade automática do Jarvis.
 * Camada exclusivamente visual/estrutural. Não altera Firebase, dados ou regras de negócio.
 * Powered by thIAguinho Soluções Digitais.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_JARVIS_RESPONSIVE_CARDS_V267__) return;
  W.__THIA_JARVIS_RESPONSIVE_CARDS_V267__ = true;

  const VERSION = '26.7.0';
  const byId = id => D.getElementById(id);

  function installCSS() {
    if (byId('jarvisResponsiveCardsV267CSS')) return;
    const style = D.createElement('style');
    style.id = 'jarvisResponsiveCardsV267CSS';
    style.textContent = `
      html,body,.layout,.main,.content,.section{max-width:100%;min-width:0;}
      .layout,.main{width:100%;}
      .main{min-width:0!important;}
      .content{width:100%;min-width:0!important;overflow-x:hidden!important;}
      .section{width:100%;min-width:0!important;}
      .j-card{width:100%;max-width:100%;min-width:0!important;container-type:inline-size;}
      .j-card-header,.j-card-body{width:100%;max-width:100%;min-width:0!important;}
      .j-card-header>*{min-width:0;}
      .j-card-title{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word;}
      .j-collapse-tools{min-width:0;max-width:100%;}
      .j-card-body{overscroll-behavior-x:contain;}

      .j-auto-card-grid{
        display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))!important;
        gap:16px!important;
        align-items:start!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
      }
      .j-auto-card-grid>.j-card{min-width:0!important;margin-bottom:0;}
      .j-auto-card-grid-stock{
        grid-template-columns:minmax(0,1.8fr) minmax(300px,1fr)!important;
      }

      .j-card-fornecedores .j-card-body{overflow:hidden!important;}
      .j-card-fornecedores .j-table{width:100%!important;max-width:100%!important;table-layout:fixed;}
      .j-card-fornecedores .j-table th,
      .j-card-fornecedores .j-table td{white-space:normal!important;overflow-wrap:anywhere;word-break:break-word;min-width:0;}
      .j-card-fornecedores .j-table th:nth-child(1),
      .j-card-fornecedores .j-table td:nth-child(1){width:27%;}
      .j-card-fornecedores .j-table th:nth-child(2),
      .j-card-fornecedores .j-table td:nth-child(2){width:26%;}
      .j-card-fornecedores .j-table th:nth-child(3),
      .j-card-fornecedores .j-table td:nth-child(3){width:27%;}
      .j-card-fornecedores .j-table th:nth-child(4),
      .j-card-fornecedores .j-table td:nth-child(4){width:20%;}
      .j-card-fornecedores td:last-child button{display:block;width:100%;max-width:100%;margin:4px 0!important;padding-left:6px;padding-right:6px;white-space:normal;overflow-wrap:anywhere;}

      @container (max-width:620px){
        .j-card-fornecedores .j-table thead{display:none!important;}
        .j-card-fornecedores .j-table,
        .j-card-fornecedores .j-table tbody,
        .j-card-fornecedores .j-table tr,
        .j-card-fornecedores .j-table td{display:block!important;width:100%!important;max-width:100%!important;}
        .j-card-fornecedores .j-table tbody{padding:8px;}
        .j-card-fornecedores .j-table tr{padding:10px;margin:0 0 10px;border:1px solid var(--border);border-radius:6px;background:var(--surf2);}
        .j-card-fornecedores .j-table td{padding:7px 4px!important;border:0!important;}
        .j-card-fornecedores .j-table td::before{content:attr(data-label);display:block;margin-bottom:3px;font-family:var(--fm);font-size:.55rem;line-height:1.25;color:var(--muted);letter-spacing:1px;text-transform:uppercase;}
        .j-card-fornecedores .j-table td[colspan]::before{display:none;}
        .j-card-fornecedores td:last-child{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px;}
        .j-card-fornecedores td:last-child::before{grid-column:1/-1;}
        .j-card-fornecedores td:last-child button{margin:0!important;min-height:40px;}
      }

      .btn-hamburger{
        z-index:2147483000!important;
        pointer-events:auto!important;
        touch-action:manipulation!important;
        -webkit-tap-highlight-color:transparent!important;
        -webkit-user-select:none!important;
        user-select:none!important;
        transform:translateZ(0);
        isolation:isolate;
      }
      .sidebar-backdrop{touch-action:manipulation;}

      @media(max-width:1100px){
        .j-auto-card-grid-stock{grid-template-columns:1fr!important;}
      }

      @media(max-width:768px){
        html,body,.layout{width:100%;min-height:100dvh;height:100dvh;overflow-x:hidden!important;}
        .btn-hamburger{
          display:flex!important;
          top:calc(env(safe-area-inset-top,0px) + 8px)!important;
          left:calc(env(safe-area-inset-left,0px) + 10px)!important;
          width:46px!important;
          height:46px!important;
          min-width:46px!important;
          min-height:46px!important;
        }
        .topbar{
          min-width:0!important;
          min-height:calc(62px + env(safe-area-inset-top,0px));
          padding-top:calc(14px + env(safe-area-inset-top,0px))!important;
          padding-left:calc(70px + env(safe-area-inset-left,0px))!important;
          padding-right:calc(12px + env(safe-area-inset-right,0px))!important;
          gap:8px;
        }
        .topbar-actions{min-width:0;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
        .topbar-badge{padding:5px 7px;font-size:.54rem;white-space:normal;text-align:center;}
        .page-title{min-width:0;font-size:1rem;overflow-wrap:anywhere;}
        .page-title span{font-size:.6rem;letter-spacing:1.5px;}
        .sidebar{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);height:100dvh;}
        .content{
          padding:12px!important;
          padding-left:calc(12px + env(safe-area-inset-left,0px))!important;
          padding-right:calc(12px + env(safe-area-inset-right,0px))!important;
          padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))!important;
        }
        .j-auto-card-grid{grid-template-columns:1fr!important;gap:12px!important;}
        .j-card-header{padding:12px!important;align-items:stretch!important;}
        .j-card-title{width:100%;}
        .j-collapse-tools{width:100%!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(112px,1fr))!important;gap:7px!important;}
        .j-collapse-tools button{width:100%!important;min-width:0!important;min-height:40px;justify-content:center;white-space:normal;line-height:1.2;}
        .j-collapse-toggle{min-width:40px!important;}
        .j-card-body{overflow-x:hidden!important;}

        /* No celular o inventário usa os cards próprios já existentes; a tabela larga deixa de empurrar a tela. */
        #s-estoque .j-card:first-child .j-card-body>.j-table{min-width:0!important;width:100%!important;max-width:100%!important;table-layout:fixed!important;}
        #s-estoque .j-card:first-child .j-card-body>.j-table>thead,
        #s-estoque .j-card:first-child .j-card-body>.j-table>#tbEstoque{display:none!important;}
        #s-estoque #tbEstoqueBusca,
        #s-estoque #tbEstoqueBusca tr,
        #s-estoque #tbEstoqueBusca td{display:block!important;width:100%!important;max-width:100%!important;}
        #s-estoque #tbEstoqueBusca td{padding:10px!important;}
        #s-estoque #buscaEstoquePecas{width:100%!important;min-width:0!important;font-size:16px!important;}

        /* Fallback para iOS sem container queries. */
        .j-card-fornecedores .j-table thead{display:none!important;}
        .j-card-fornecedores .j-table,
        .j-card-fornecedores .j-table tbody,
        .j-card-fornecedores .j-table tr,
        .j-card-fornecedores .j-table td{display:block!important;width:100%!important;max-width:100%!important;}
        .j-card-fornecedores .j-table tbody{padding:8px;}
        .j-card-fornecedores .j-table tr{padding:10px;margin:0 0 10px;border:1px solid var(--border);border-radius:6px;background:var(--surf2);}
        .j-card-fornecedores .j-table td{padding:7px 4px!important;border:0!important;}
        .j-card-fornecedores .j-table td::before{content:attr(data-label);display:block;margin-bottom:3px;font-family:var(--fm);font-size:.55rem;color:var(--muted);letter-spacing:1px;text-transform:uppercase;}
        .j-card-fornecedores .j-table td[colspan]::before{display:none;}
        .j-card-fornecedores td:last-child{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px;}
        .j-card-fornecedores td:last-child::before{grid-column:1/-1;}
        .j-card-fornecedores td:last-child button{margin:0!important;min-height:42px;}
      }

      @media(max-width:420px){
        .topbar-actions .topbar-badge:first-child{display:none;}
        .j-collapse-tools{grid-template-columns:1fr!important;}
        .j-card-fornecedores td:last-child{grid-template-columns:1fr!important;}
      }
    `;
    D.head.appendChild(style);
  }

  function directChild(parent, selector) {
    if (!parent) return null;
    try { return parent.querySelector(':scope > ' + selector); }
    catch (_) { return Array.from(parent.children || []).find(el => el.matches?.(selector)) || null; }
  }

  function syncCollapseButton(card, btn) {
    if (!card || !btn) return;
    const minimized = card.classList.contains('j-minimized');
    const text = minimized ? '+' : '−';
    if (btn.textContent !== text) btn.textContent = text;
    btn.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    btn.setAttribute('aria-label', minimized ? 'Maximizar este card' : 'Minimizar este card');
    btn.title = minimized ? 'Maximizar somente este card' : 'Minimizar somente este card';
  }

  function installCollapseButtons(root) {
    const scope = root?.querySelectorAll ? root : D;
    scope.querySelectorAll('.content .j-card').forEach((card, index) => {
      const header = directChild(card, '.j-card-header');
      const body = directChild(card, '.j-card-body');
      if (!header || !body) return;
      card.dataset.thiaCardIndependent = '1';
      let tools = directChild(header, '.j-collapse-tools');
      if (!tools) {
        tools = D.createElement('div');
        tools.className = 'j-collapse-tools';
        header.appendChild(tools);
      }
      let btn = tools.querySelector('.j-collapse-toggle');
      if (!btn) {
        btn = D.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-ghost j-collapse-toggle';
        btn.dataset.thiaAutoCollapse = String(index + 1);
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          W.toggleJarvisCollapse?.(btn);
        });
        tools.appendChild(btn);
      }
      syncCollapseButton(card, btn);
    });
  }

  function wrapCollapseFunction() {
    if (W.toggleJarvisCollapse?.__thiaV267) return;
    const old = typeof W.toggleJarvisCollapse === 'function' ? W.toggleJarvisCollapse : null;
    const wrapped = function (btn) {
      const card = btn?.closest?.('.j-card');
      let result;
      if (old) result = old.apply(this, arguments);
      else if (card) card.classList.toggle('j-minimized');
      if (card) syncCollapseButton(card, btn);
      return result;
    };
    wrapped.__thiaV267 = true;
    wrapped.__original = old;
    W.toggleJarvisCollapse = wrapped;
  }

  function markCardGrids() {
    D.querySelectorAll('.section').forEach(section => {
      Array.from(section.children || []).forEach(parent => {
        const cards = Array.from(parent.children || []).filter(el => el.classList?.contains('j-card'));
        if (cards.length < 2) return;
        parent.classList.add('j-auto-card-grid');
        if (section.id === 's-estoque') parent.classList.add('j-auto-card-grid-stock');
      });
    });
  }

  function labelSupplierRows() {
    const tb = byId('tbFornec');
    const table = tb?.closest('table');
    const card = tb?.closest('.j-card');
    if (!tb || !table || !card) return;
    card.classList.add('j-card-fornecedores');
    const labels = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    Array.from(tb.rows || []).forEach(row => {
      Array.from(row.cells || []).forEach((cell, index) => {
        if (!cell.hasAttribute('colspan')) cell.dataset.label = labels[index] || `Campo ${index + 1}`;
      });
    });
  }

  function observeSupplierTable() {
    const tb = byId('tbFornec');
    if (!tb || tb.__thiaV267Observer) return;
    tb.__thiaV267Observer = new MutationObserver(labelSupplierRows);
    tb.__thiaV267Observer.observe(tb, { childList:true, subtree:true, characterData:true });
    labelSupplierRows();
  }

  function syncSidebarButton() {
    const btn = byId('btnHamburger');
    const sidebar = D.querySelector('.sidebar');
    if (!btn || !sidebar) return;
    const open = sidebar.classList.contains('open');
    const icon = open ? '×' : '☰';
    if (btn.textContent !== icon) btn.textContent = icon;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    D.body.classList.toggle('sidebar-mobile-open', open);
  }

  function installRobustHamburger() {
    const btn = byId('btnHamburger');
    if (!btn || btn.dataset.thiaV267 === '1') return;
    btn.dataset.thiaV267 = '1';
    btn.removeAttribute('onclick');
    let lastTouch = 0;
    const activate = ev => {
      if (ev?.cancelable) ev.preventDefault();
      ev?.stopPropagation?.();
      W.toggleSidebarMobile?.();
      syncSidebarButton();
    };
    btn.addEventListener('touchend', ev => {
      lastTouch = Date.now();
      activate(ev);
    }, { passive:false });
    btn.addEventListener('click', ev => {
      if (Date.now() - lastTouch < 700) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      activate(ev);
    });
    btn.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') activate(ev);
    });
    syncSidebarButton();
  }

  function wrapSidebarFunction() {
    if (W.toggleSidebarMobile?.__thiaV267) return;
    const old = typeof W.toggleSidebarMobile === 'function' ? W.toggleSidebarMobile : null;
    const wrapped = function () {
      let result;
      if (old) result = old.apply(this, arguments);
      else {
        const sidebar = D.querySelector('.sidebar');
        const backdrop = byId('sidebarBackdrop');
        if (!sidebar || !backdrop) return;
        const force = arguments[0];
        const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', open);
        backdrop.classList.toggle('open', open);
      }
      syncSidebarButton();
      return result;
    };
    wrapped.__thiaV267 = true;
    wrapped.__original = old;
    W.toggleSidebarMobile = wrapped;
  }

  function boot() {
    installCSS();
    wrapCollapseFunction();
    wrapSidebarFunction();
    markCardGrids();
    installCollapseButtons(D);
    labelSupplierRows();
    observeSupplierTable();
    installRobustHamburger();
    syncSidebarButton();
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  const runtime = W.ThiaRuntimeCoreV2613;
  const observerRoot = D.querySelector('main, .main-content, #app') || D.body;
  if (observerRoot && !observerRoot.__thiaResponsiveObserverV267) {
    const observer = new MutationObserver(mutations => {
      let needsCards = false;
      let needsSupplier = false;
      mutations.forEach(m => {
        if (m.type !== 'childList' || !m.addedNodes.length) return;
        if (m.target?.id === 'tbFornec' || m.target?.closest?.('#tbFornec')) needsSupplier = true;
        for (const node of m.addedNodes) {
          if (node?.nodeType !== 1) continue;
          if (node.matches?.('.j-card, .j-grid, #tbFornec, .sidebar, #btnHamburger') || node.querySelector?.('.j-card, .j-grid, #tbFornec, .sidebar, #btnHamburger')) {
            needsCards = true;
            break;
          }
        }
      });
      if (!needsCards && !needsSupplier) return;
      const apply = () => {
        if (needsCards) {
          markCardGrids();
          installCollapseButtons(observerRoot);
        }
        if (needsSupplier) labelSupplierRows();
      };
      if (runtime?.scheduleDom) runtime.scheduleDom('responsive-cards-v267', apply, { delay:70, maxRetries:4 });
      else setTimeout(apply, 70);
    });
    observer.observe(observerRoot, { childList:true, subtree:true });
    observerRoot.__thiaResponsiveObserverV267 = observer;
  }

  const onResize = function () {
    if (W.innerWidth > 768) W.toggleSidebarMobile?.(false);
    markCardGrids();
    labelSupplierRows();
    syncSidebarButton();
  };
  const onOrientation = function () { setTimeout(onResize, 250); };
  if (runtime?.addEventOnce) {
    runtime.addEventOnce(W, 'resize', 'responsive-cards-v267', onResize);
    runtime.addEventOnce(W, 'orientationchange', 'responsive-cards-v267', onOrientation);
  } else {
    W.addEventListener('resize', onResize, { passive:true });
    W.addEventListener('orientationchange', onOrientation, { passive:true });
  }

  console.info('[OFICIN-IA] Jarvis cards/responsividade V' + VERSION + ' instalado');
})(window, document);
