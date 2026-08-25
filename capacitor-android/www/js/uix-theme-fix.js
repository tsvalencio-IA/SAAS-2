(function () {
  'use strict';

  if (window.__thiaUixThemeFixInstalled) return;
  window.__thiaUixThemeFixInstalled = true;

  const css = `
    :root[data-theme="dark"]{
      --bg:#101722!important;
      --surf:#172233!important;
      --surf2:#1f2d42!important;
      --surf3:#29394f!important;
      --bg0:#101722!important;
      --bg1:#172233!important;
      --bg2:#1f2d42!important;
      --bg3:#29394f!important;
      --cyan:#7fb7d6!important;
      --cyan2:#5a9fbe!important;
      --cyan-dim:rgba(127,183,214,.11)!important;
      --brand:#7fb7d6!important;
      --brand-dim:rgba(127,183,214,.18)!important;
      --gov:#a8a2d8!important;
      --gov-dim:rgba(168,162,216,.18)!important;
      --success:#6dbb8d!important;
      --warn:#d8ad5f!important;
      --danger:#df6f7b!important;
      --purple:#a8a2d8!important;
      --text:#edf3f8!important;
      --text-primary:#edf3f8!important;
      --muted:#8999aa!important;
      --muted2:#aebdcc!important;
      --text-muted:#8999aa!important;
      --border:rgba(210,222,232,.15)!important;
      --border2:rgba(127,183,214,.24)!important;
    }
    :root[data-theme="light"]{
      --bg:#f6f8fb!important;
      --surf:#ffffff!important;
      --surf2:#f1f5f8!important;
      --surf3:#e6edf3!important;
      --bg0:#f6f8fb!important;
      --bg1:#ffffff!important;
      --bg2:#f1f5f8!important;
      --bg3:#e6edf3!important;
      --cyan:#2f6f8f!important;
      --cyan2:#245f7b!important;
      --cyan-dim:rgba(47,111,143,.10)!important;
      --brand:#2f6f8f!important;
      --brand-dim:rgba(47,111,143,.16)!important;
      --gov:#5f5a9a!important;
      --gov-dim:rgba(95,90,154,.14)!important;
      --success:#2f7d55!important;
      --warn:#946b2d!important;
      --danger:#a3434d!important;
      --purple:#5f5a9a!important;
      --text:#1b2533!important;
      --text-primary:#1b2533!important;
      --muted:#667789!important;
      --muted2:#415367!important;
      --text-muted:#667789!important;
      --border:rgba(27,37,51,.14)!important;
      --border2:rgba(47,111,143,.24)!important;
    }
    :root[data-theme="light"]{
      --uix-bg:#f6f8fb;
      --uix-surface:#ffffff;
      --uix-surface-2:#f1f5f8;
      --uix-surface-3:#e6edf3;
      --uix-field:#ffffff;
      --uix-field-2:#f1f5f8;
      --uix-text:#1b2533;
      --uix-text-2:#415367;
      --uix-muted:#667789;
      --uix-border:rgba(27,37,51,.14);
      --uix-border-2:rgba(47,111,143,.24);
      --uix-cyan:#2f6f8f;
      --uix-success:#2f7d55;
      --uix-warn:#946b2d;
      --uix-danger:#a3434d;
      --uix-select-option:#ffffff;
    }
    :root[data-theme="dark"]{
      --uix-bg:var(--bg,#060a14);
      --uix-surface:var(--surf,#0c1426);
      --uix-surface-2:var(--surf2,#111d35);
      --uix-surface-3:var(--surf3,#162040);
      --uix-field:var(--surf2,#111d35);
      --uix-field-2:var(--surf3,#162040);
      --uix-text:var(--text,#e8f4ff);
      --uix-text-2:var(--muted2,#9ab8d6);
      --uix-muted:var(--muted,#7a9ab8);
      --uix-border:var(--border,rgba(255,255,255,.10));
      --uix-border-2:var(--border2,rgba(0,212,255,.22));
      --uix-cyan:var(--cyan,#00d4ff);
      --uix-success:var(--success,#00ff88);
      --uix-warn:var(--warn,#ffb800);
      --uix-danger:var(--danger,#ff3b3b);
      --uix-select-option:var(--surf2,#111d35);
    }

    :root[data-theme="light"] body,
    :root[data-theme="light"] .main,
    :root[data-theme="light"] .section,
    :root[data-theme="light"] .modal,
    :root[data-theme="light"] .modal-head,
    :root[data-theme="light"] .modal-foot,
    :root[data-theme="light"] .j-card,
    :root[data-theme="light"] .k-col,
    :root[data-theme="light"] .chat-main,
    :root[data-theme="light"] .ia-box{
      color:var(--uix-text)!important;
    }

    :root[data-theme="light"] .modal,
    :root[data-theme="light"] .modal-head,
    :root[data-theme="light"] .modal-foot,
    :root[data-theme="light"] .j-card,
    :root[data-theme="light"] .ia-box,
    :root[data-theme="light"] .chat-main{
      background:var(--uix-surface)!important;
      border-color:var(--uix-border)!important;
      box-shadow:0 18px 42px rgba(15,23,42,.18)!important;
    }

    .j-input,.j-select,.j-textarea,
    input.input,select.select,textarea.textarea,
    input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]),
    select,textarea{
      color:var(--uix-text)!important;
      background:var(--uix-field)!important;
      border-color:var(--uix-border)!important;
      caret-color:var(--uix-cyan)!important;
    }
    .j-input:focus,.j-select:focus,.j-textarea:focus,
    input:focus,select:focus,textarea:focus{
      color:var(--uix-text)!important;
      background:var(--uix-field)!important;
      border-color:var(--uix-cyan)!important;
      box-shadow:0 0 0 2px color-mix(in srgb, var(--uix-cyan) 18%, transparent)!important;
    }
    .j-input::placeholder,.j-textarea::placeholder,
    input::placeholder,textarea::placeholder{
      color:var(--uix-muted)!important;
      opacity:1!important;
    }
    .j-select option,select option{
      color:var(--uix-text)!important;
      background:var(--uix-select-option)!important;
    }
    input[readonly],textarea[readonly]{
      background:var(--uix-field-2)!important;
      color:var(--uix-text-2)!important;
    }

    :root[data-theme="light"] .tempa-inline-box,
    :root[data-theme="light"] .serv-tempa-resultados-list,
    :root[data-theme="light"] .cilia-serv-relac,
    :root[data-theme="light"] .cilia-peca-wrap,
    :root[data-theme="light"] .cot-msg-card,
    :root[data-theme="light"] .cot-forn-card,
    :root[data-theme="light"] .cotacao-peca-box{
      background:var(--uix-surface-2)!important;
      border-color:var(--uix-border)!important;
      color:var(--uix-text)!important;
    }
    :root[data-theme="light"] .tempa-inline-option,
    :root[data-theme="light"] .cilia-tempa-opcao,
    :root[data-theme="light"] .serv-tempa-resultados-list button,
    :root[data-theme="light"] .cot-opcao-row{
      background:var(--uix-surface)!important;
      color:var(--uix-text)!important;
      border-color:var(--uix-border)!important;
    }
    :root[data-theme="light"] .tempa-inline-option:hover,
    :root[data-theme="light"] .cilia-tempa-opcao:hover{
      background:#e0f2fe!important;
      border-color:var(--uix-cyan)!important;
    }
    :root[data-theme="light"] .tempa-inline-none,
    :root[data-theme="light"] .cilia-tempa-empty,
    :root[data-theme="light"] .cilia-tempa-sem-match{
      background:#fff7ed!important;
      border-color:#fed7aa!important;
      color:var(--uix-warn)!important;
    }
    :root[data-theme="light"] .serv-tempa-meta,
    :root[data-theme="light"] .j-label,
    :root[data-theme="light"] small,
    :root[data-theme="light"] .k-desc,
    :root[data-theme="light"] .k-cliente,
    :root[data-theme="light"] .mtab{
      color:var(--uix-muted)!important;
    }
    :root[data-theme="light"] b,
    :root[data-theme="light"] strong,
    :root[data-theme="light"] .modal-title,
    :root[data-theme="light"] .page-title,
    :root[data-theme="light"] .k-placa{
      color:var(--uix-text)!important;
    }
    :root[data-theme="light"] [style*="color:var(--text)"]{color:var(--uix-text)!important;}
    :root[data-theme="light"] [style*="color:var(--muted)"]{color:var(--uix-muted)!important;}
    :root[data-theme="light"] [style*="color:var(--cyan)"]{color:var(--uix-cyan)!important;}
    :root[data-theme="light"] [style*="color:var(--success)"]{color:var(--uix-success)!important;}
    :root[data-theme="light"] [style*="color:var(--warn)"]{color:var(--uix-warn)!important;}
    :root[data-theme="light"] [style*="color:var(--danger)"]{color:var(--uix-danger)!important;}
    :root[data-theme="light"] [style*="background:rgba(0,0,0"],
    :root[data-theme="light"] [style*="background: rgba(0,0,0"],
    :root[data-theme="light"] [style*="background:rgba(5,14,34"],
    :root[data-theme="light"] [style*="background:rgba(0,212,255"]{
      background:var(--uix-surface-2)!important;
    }

    @media(max-width:760px){
      .modal-body{overscroll-behavior:contain;}
      .j-input,.j-select,.j-textarea,input,select,textarea{font-size:16px!important;}
    }
  `;

  const style = document.createElement('style');
  style.id = 'thia-uix-theme-fix';
  style.textContent = css;
  document.head.appendChild(style);
})();
