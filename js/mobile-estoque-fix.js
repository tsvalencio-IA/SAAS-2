/**
 * OFICIN-IA — Correção mobile do inventário de peças no Jarvis
 *
 * Camada aditiva: não remove tabela, não muda Kardex, não altera fornecedores.
 * Cria cartões mobile para as peças do estoque e mantém a tabela original.
 *
 * thIAguinho Soluções — tecnologia sob medida.
 */
(function () {
  'use strict';

  var W = window;
  var D = document;

  function byId(id) { return D.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(v) {
    var n = Number(String(v == null ? 0 : v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function moeda(v) {
    try {
      return Number(num(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (e) {
      return 'R$ ' + num(v).toFixed(2).replace('.', ',');
    }
  }

  function norm(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function instalarCSS() {
    if (byId('estoqueMobileFixCSS')) return;
    var st = D.createElement('style');
    st.id = 'estoqueMobileFixCSS';
    st.textContent = `
      #estoqueMobileCardsFix{display:none;}
      @media (max-width: 768px){
        #s-estoque > div{
          display:grid!important;
          grid-template-columns:1fr!important;
          gap:12px!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
        }
        #s-estoque .j-card{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
        }
        #s-estoque .j-card-header{
          gap:8px!important;
          flex-wrap:wrap!important;
          align-items:flex-start!important;
        }
        #s-estoque .j-card-header .j-collapse-tools{
          width:100%!important;
          display:flex!important;
          flex-wrap:wrap!important;
          gap:8px!important;
        }
        #s-estoque .j-card-header .j-collapse-tools button{
          flex:1 1 auto!important;
        }
        #s-estoque .j-card-body{
          width:100%!important;
          max-width:100%!important;
          overflow-x:auto!important;
          -webkit-overflow-scrolling:touch!important;
        }
        #s-estoque .j-card-body > .j-table{
          min-width:760px!important;
        }
        #estoqueMobileCardsFix{
          display:block!important;
          padding:10px 10px 12px!important;
          border-bottom:1px solid var(--border);
        }
        #estoqueMobileCardsFix .emf-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:8px;
          margin-bottom:8px;
          font-family:var(--fm);
          font-size:.68rem;
          color:var(--muted);
          text-transform:uppercase;
          letter-spacing:.04em;
        }
        #estoqueMobileCardsFix .emf-list{
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        #estoqueMobileCardsFix .emf-card{
          border:1px solid var(--border);
          border-radius:12px;
          padding:10px;
          background:rgba(255,255,255,.035);
          box-shadow:0 8px 20px rgba(0,0,0,.16);
        }
        #estoqueMobileCardsFix .emf-title{
          font-weight:800;
          color:var(--text);
          line-height:1.25;
          word-break:break-word;
        }
        #estoqueMobileCardsFix .emf-code{
          font-family:var(--fm);
          font-size:.7rem;
          color:var(--muted);
          margin-bottom:4px;
        }
        #estoqueMobileCardsFix .emf-grid{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:7px;
          margin-top:8px;
        }
        #estoqueMobileCardsFix .emf-k{
          font-family:var(--fm);
          font-size:.58rem;
          color:var(--muted2);
          text-transform:uppercase;
        }
        #estoqueMobileCardsFix .emf-v{
          font-family:var(--fm);
          font-size:.76rem;
          color:var(--text);
          font-weight:700;
          word-break:break-word;
        }
        #estoqueMobileCardsFix .emf-status{
          display:inline-flex;
          align-items:center;
          padding:4px 8px;
          border-radius:999px;
          border:1px solid var(--border);
          font-family:var(--fm);
          font-size:.62rem;
          font-weight:800;
          margin-top:8px;
        }
        #estoqueMobileCardsFix .emf-status.critico{
          color:var(--danger);
          border-color:rgba(255,59,59,.45);
          background:rgba(255,59,59,.08);
        }
        #estoqueMobileCardsFix .emf-status.ok{
          color:var(--success);
          border-color:rgba(0,255,136,.35);
          background:rgba(0,255,136,.06);
        }
        #estoqueMobileCardsFix .emf-actions{
          display:flex;
          gap:8px;
          margin-top:10px;
        }
        #estoqueMobileCardsFix .emf-actions button{
          flex:1 1 auto;
          min-height:38px;
        }
      }
    `;
    D.head.appendChild(st);
  }

  function listaEstoqueFiltrada() {
    var J = W.J || {};
    var estoque = Array.isArray(J.estoque) ? J.estoque : [];
    var termo = norm((byId('buscaEstoquePecas') && byId('buscaEstoquePecas').value) || W._estoqueBuscaPecas || '');
    if (!termo) return estoque;
    return estoque.filter(function (p) {
      return norm([
        p.codigo,
        p.codigoFornecedor,
        p.codigoComercial,
        p.oem,
        p.ean,
        p.desc,
        p.descricao,
        p.marca,
        p.ncm,
        p.cfop,
        p.fornecedor,
        p.fornecedorNome,
        p.nomeFornecedor,
        p.nfNumero,
        p.notaFiscal
      ].filter(Boolean).join(' ')).indexOf(termo) >= 0;
    });
  }

  function ensureBox() {
    var sec = byId('s-estoque');
    var tb = byId('tbEstoque');
    if (!sec || !tb) return null;

    var body = tb.closest('.j-card-body');
    if (!body) return null;

    var box = byId('estoqueMobileCardsFix');
    if (!box) {
      box = D.createElement('div');
      box.id = 'estoqueMobileCardsFix';

      var table = tb.closest('table');
      if (table && table.parentNode === body) {
        body.insertBefore(box, table);
      } else {
        body.insertBefore(box, body.firstChild);
      }
    }
    return box;
  }

  function renderCards() {
    instalarCSS();

    var box = ensureBox();
    if (!box) return;

    var lista = listaEstoqueFiltrada();
    var total = Array.isArray((W.J || {}).estoque) ? W.J.estoque.length : 0;
    var criticos = lista.filter(function (p) { return num(p.qtd) <= num(p.min || p.minimo || 0); }).length;

    if (!lista.length) {
      box.innerHTML = '<div class="emf-head"><span>Peças em estoque</span><span>0 item</span></div>' +
        '<div style="color:var(--muted);font-family:var(--fm);font-size:.75rem;padding:8px 0;">Nenhuma peça encontrada na busca atual.</div>';
      return;
    }

    box.innerHTML = '<div class="emf-head"><span>Peças em estoque</span><span>' +
      esc(lista.length) + ' de ' + esc(total) + ' • críticos ' + esc(criticos) + '</span></div>' +
      '<div class="emf-list">' +
      lista.slice(0, 60).map(function (p) {
        var qtd = num(p.qtd);
        var min = num(p.min || p.minimo || 0);
        var crit = qtd <= min;
        var desc = p.desc || p.descricao || 'Peça sem descrição';
        var cod = p.codigo || p.codigoFornecedor || p.codigoComercial || p.oem || p.ean || '-';
        var fornecedor = p.fornecedor || p.fornecedorNome || p.nomeFornecedor || '-';
        var nf = p.nfNumero || p.notaFiscal || p.nf || '-';
        var id = esc(p.id || '');

        return '<div class="emf-card">' +
          '<div class="emf-code">Código: ' + esc(cod) + '</div>' +
          '<div class="emf-title">' + esc(desc) + '</div>' +
          '<div class="emf-grid">' +
            '<div><div class="emf-k">Qtd</div><div class="emf-v">' + esc(qtd) + '</div></div>' +
            '<div><div class="emf-k">Mínimo</div><div class="emf-v">' + esc(min) + '</div></div>' +
            '<div><div class="emf-k">Custo</div><div class="emf-v">' + esc(moeda(p.custo || p.valorCompra || p.precoCusto || 0)) + '</div></div>' +
            '<div><div class="emf-k">Venda</div><div class="emf-v">' + esc(moeda(p.venda || p.precoVenda || 0)) + '</div></div>' +
            '<div><div class="emf-k">Fornecedor</div><div class="emf-v">' + esc(fornecedor) + '</div></div>' +
            '<div><div class="emf-k">NF</div><div class="emf-v">' + esc(nf) + '</div></div>' +
          '</div>' +
          '<div class="emf-status ' + (crit ? 'critico' : 'ok') + '">' + (crit ? 'CRÍTICO' : 'OK') + '</div>' +
          '<div class="emf-actions">' +
            '<button type="button" class="btn-ghost" onclick="window.prepPeca&&window.prepPeca(\'edit\',\'' + id + '\');window.abrirModal&&window.abrirModal(\'modalPeca\')">Editar peça</button>' +
          '</div>' +
        '</div>';
      }).join('') +
      (lista.length > 60 ? '<div style="color:var(--muted);font-family:var(--fm);font-size:.7rem;padding:8px 2px;">Mostrando 60 itens. Use a busca para filtrar.</div>' : '') +
      '</div>';
  }

  function wrapRenderEstoque() {
    var fn = W.renderEstoque;
    if (typeof fn !== 'function') return false;
    if (fn.__estoqueMobileFixWrap) return true;

    var wrapped = function () {
      var ret = fn.apply(this, arguments);
      try { renderCards(); } catch (e) { console.warn('[estoque-mobile-fix]', e); }
      return ret;
    };

    wrapped.__estoqueMobileFixWrap = true;
    wrapped.__original = fn;
    W.renderEstoque = wrapped;
    return true;
  }

  function boot() {
    instalarCSS();
    wrapRenderEstoque();
    try { renderCards(); } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();

  [250, 700, 1200, 2500, 5000, 9000].forEach(function (ms) {
    setTimeout(boot, ms);
  });

  W.addEventListener('resize', function () {
    try { renderCards(); } catch (e) {}
  });

  W.thiaRenderEstoqueMobileFix = renderCards;
})();
