/**
 * thIAguinho SaaS V26.8 — separação visual independente dos cards fiscais.
 * Move a pesquisa de peças para um card próprio sem alterar busca, filtros,
 * Firebase, estoque, vínculos, notas ou regras fiscais.
 * Powered by thIAguinho Soluções Digitais.
 */
(function (W, D) {
  'use strict';
  if (W.__THIA_JARVIS_FISCAL_CARDS_V268__) return;
  W.__THIA_JARVIS_FISCAL_CARDS_V268__ = true;

  const VERSION = '26.8.0';
  const byId = id => D.getElementById(id);

  function installCSS() {
    if (byId('jarvisFiscalCardsV268CSS')) return;
    const style = D.createElement('style');
    style.id = 'jarvisFiscalCardsV268CSS';
    style.textContent = `
      #fiscalPecasCardV268,
      #docsFiscaisPanel{
        width:100%;
        max-width:100%;
        min-width:0;
        margin:12px 0;
      }
      #fiscalPecasCardV268 .j-card-header,
      #docsFiscaisPanel .j-card-header{
        min-width:0;
      }
      #fiscalPecasCardV268 .j-card-body{
        padding:12px;
        min-width:0;
        overflow-x:hidden;
      }
      #fiscalPecasCardV268 #fiscalPecasV266{
        width:100%;
        max-width:100%;
        min-width:0;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
      }
      #fiscalPecasCardV268 #fiscalPecasV266 > .fp-v266-title{
        display:none!important;
      }
      #fiscalPecasCardV268 .fp-v266-filters,
      #fiscalPecasCardV268 .fp-v266-card{
        width:100%;
        max-width:100%;
        min-width:0;
      }
      #fiscalPecasCardV268 .fp-v266-filters > *,
      #fiscalPecasCardV268 .fp-v266-card > *{
        min-width:0;
      }
      #fiscalPecasCardV268 input,
      #fiscalPecasCardV268 select,
      #fiscalPecasCardV268 button{
        max-width:100%;
      }
      #docsFiscaisPanel .j-card-body{
        min-width:0;
      }
      #docsFiscaisPanel .op-table-wrap{
        width:100%;
        max-width:100%;
        min-width:0;
        overflow-x:auto;
        -webkit-overflow-scrolling:touch;
      }
      @media(max-width:900px){
        #fiscalPecasCardV268 .fp-v266-filters{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }
        #fiscalPecasCardV268 .fp-v266-card{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }
      }
      @media(max-width:650px){
        #fiscalPecasCardV268 .j-card-body{
          padding:10px!important;
        }
        #fiscalPecasCardV268 .fp-v266-filters,
        #fiscalPecasCardV268 .fp-v266-card{
          grid-template-columns:1fr!important;
        }
        #fiscalPecasCardV268 .fp-v266-filters .btn-ghost{
          width:100%!important;
          min-height:42px;
        }
        #fiscalPecasCardV268 input,
        #fiscalPecasCardV268 select{
          width:100%!important;
          min-width:0!important;
          font-size:16px!important;
        }
      }
    `;
    D.head.appendChild(style);
  }

  function createPiecesCard(section, docsPanel) {
    let card = byId('fiscalPecasCardV268');
    if (card) return card;

    card = D.createElement('div');
    card.id = 'fiscalPecasCardV268';
    card.className = 'op-card j-card';
    card.dataset.thiaCardIndependent = '1';
    card.innerHTML = `
      <div class="j-card-header">
        <div class="j-card-title">PESQUISA DE PEÇAS DAS NOTAS FISCAIS</div>
        <div class="j-collapse-tools">
          <button type="button" class="btn-ghost j-collapse-toggle"
            onclick="window.toggleJarvisCollapse(this)"
            aria-expanded="true"
            title="Minimizar somente a pesquisa de peças das notas fiscais">−</button>
        </div>
      </div>
      <div class="j-card-body" id="fiscalPecasCardBodyV268"></div>`;

    section.insertBefore(card, docsPanel);
    return card;
  }

  function removeDuplicatedInnerTitle(box) {
    if (!box) return;
    let title = null;
    try { title = box.querySelector(':scope > .fp-v266-title'); }
    catch (_) { title = Array.from(box.children || []).find(el => el.classList?.contains('fp-v266-title')) || null; }
    if (title) {
      title.setAttribute('aria-hidden', 'true');
      title.style.display = 'none';
    }
  }

  function separateFiscalCards() {
    installCSS();

    const section = byId('s-estoque');
    const docsPanel = byId('docsFiscaisPanel');
    const piecesBox = byId('fiscalPecasV266');
    if (!section || !docsPanel || !piecesBox) return false;

    const card = createPiecesCard(section, docsPanel);
    const body = byId('fiscalPecasCardBodyV268');
    if (!card || !body) return false;

    if (piecesBox.parentElement !== body) body.appendChild(piecesBox);
    removeDuplicatedInnerTitle(piecesBox);

    // Mantém a ordem visual solicitada: pesquisa de peças primeiro e listagem de NFs depois.
    if (card.nextElementSibling !== docsPanel) section.insertBefore(card, docsPanel);

    card.dataset.fiscalSeparated = '1';
    docsPanel.dataset.fiscalSeparated = '1';
    return true;
  }

  function boot() {
    if (D.documentElement.dataset.thiaFiscalCardsV268 === '1') return;
    D.documentElement.dataset.thiaFiscalCardsV268 = '1';
    separateFiscalCards();
    const section = byId('s-estoque');
    if (!section || section.__thiaFiscalCardsObserverV268) return;
    const runtime = W.ThiaRuntimeCoreV2613;
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(m => Array.from(m.addedNodes || []).some(node =>
        node?.nodeType === 1 && (node.matches?.('#docsFiscaisPanel, #fiscalPecasV266') || node.querySelector?.('#docsFiscaisPanel, #fiscalPecasV266'))
      ));
      if (!relevant) return;
      if (runtime?.scheduleDom) runtime.scheduleDom('fiscal-cards-v268', separateFiscalCards, { delay:60, maxRetries:6 });
      else setTimeout(separateFiscalCards, 60);
    });
    observer.observe(section, { childList:true, subtree:true });
    section.__thiaFiscalCardsObserverV268 = observer;
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  W.separarCardsFiscaisV268 = separateFiscalCards;
  console.info('[OFICIN-IA] Cards fiscais separados V' + VERSION);
})(window, document);
