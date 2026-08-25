/**
 * MÓDULO DE ASSINATURA POR O.S. — v4.0.0
 * Powered by thIAguinho Soluções Digitais
 *
 * Responsabilidades DESTE arquivo:
 *   1. Canvas de assinatura (Pointer Events + Bézier + pressão)
 *   2. Upload PNG → Cloudinary
 *   3. window._osSignGetPayload() — getter chamado pelo os.js
 *   4. Reset ao abrir nova O.S. / load ao editar O.S. existente
 *
 * O os.js injeta a assinatura no payload principal antes de salvar.
 * Zero wraps de salvarOS. Zero race condition. Zero double-write.
 *
 * Deve ser carregado APÓS js/os.js e ANTES de js/exportar-pmsp.js.
 */
;(function () {
  'use strict';

  // ── Estado ────────────────────────────────────────────────
  const SP = {
    canvas:    null,
    ctx:       null,
    isDrawing: false,
    hasSigned: false,
    pts:       [],
    penColor:  '#000000',
    penSize:   2,
    dpr:       1,
    cssW:      0,
    cssH:      160,
    cloudUrl:  null,
    uploading: false
  };

  // ── DOM helpers ───────────────────────────────────────────
  function g(id)      { return document.getElementById(id); }
  function gv(id)     { const el = g(id); return el ? el.value.trim() : ''; }
  function sv(id, v)  { const el = g(id); if (el) el.value = v || ''; }

  // ── Status visual ─────────────────────────────────────────
  const EST = {
    vazio:         { txt: 'Aguardando assinatura...',            cor: '#64748b', upload: false },
    assinando:     { txt: '✍ Assinando...',                      cor: '#f59e0b', upload: false },
    pronto:        { txt: '✓ Pronto — clique em Enviar',         cor: '#10b981', upload: true  },
    enviando:      { txt: '⏳ Enviando ao Cloudinary...',         cor: '#3b82f6', upload: false },
    salva:         { txt: '✅ Assinatura salva no Cloudinary',    cor: '#10b981', upload: false },
    carregada:     { txt: '✅ Assinatura carregada da O.S.',      cor: '#10b981', upload: false },
    erro_upload:   { txt: '✕ Falha no envio. Tente novamente.',  cor: '#ef4444', upload: true  },
    erro_carregar: { txt: '⚠ Não foi possível carregar imagem.', cor: '#f59e0b', upload: false }
  };

  function setStatus(k) {
    const s   = EST[k] || EST['vazio'];
    const elS = g('osSignStatus');
    const btn = g('btnOsUploadSign');
    if (elS) { elS.textContent = s.txt; elS.style.color = s.cor; }
    if (btn)   btn.disabled = !s.upload;
  }

  // ── Inicialização do canvas ───────────────────────────────
  window.initOSSignaturePad = function () {
    const canvasEl = g('osSignCanvas');
    const wrapEl   = g('osSignWrap');
    if (!canvasEl || !wrapEl) return;

    SP.canvas = canvasEl;
    SP.ctx    = canvasEl.getContext('2d');
    SP.dpr    = window.devicePixelRatio || 1;
    SP.cssW   = wrapEl.getBoundingClientRect().width || 320;
    SP.cssH   = 160;

    canvasEl.width  = Math.round(SP.cssW * SP.dpr);
    canvasEl.height = Math.round(SP.cssH * SP.dpr);
    canvasEl.style.width  = SP.cssW + 'px';
    canvasEl.style.height = SP.cssH + 'px';

    SP.ctx.resetTransform();
    SP.ctx.scale(SP.dpr, SP.dpr);
    SP.ctx.lineCap  = 'round';
    SP.ctx.lineJoin = 'round';

    // Remove listeners antigos antes de adicionar (evita duplicatas em reaberturas)
    canvasEl.removeEventListener('pointerdown',   _onDown);
    canvasEl.removeEventListener('pointermove',   _onMove);
    canvasEl.removeEventListener('pointerup',     _onUp);
    canvasEl.removeEventListener('pointerleave',  _onUp);
    canvasEl.removeEventListener('pointercancel', _onUp);
    canvasEl.addEventListener('pointerdown',   _onDown, { passive: false });
    canvasEl.addEventListener('pointermove',   _onMove, { passive: false });
    canvasEl.addEventListener('pointerup',     _onUp,   { passive: false });
    canvasEl.addEventListener('pointerleave',  _onUp,   { passive: false });
    canvasEl.addEventListener('pointercancel', _onUp,   { passive: false });

    // Restaura imagem se já houver URL salva
    const url = SP.cloudUrl || gv('osAssinaturaUrl');
    if (url) _restoreFromUrl(url);
  };

  // ── Restaura imagem salva no canvas ──────────────────────
  function _restoreFromUrl(url) {
    if (!SP.ctx || !url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => {
      SP.ctx.drawImage(img, 0, 0, SP.cssW, SP.cssH);
      SP.hasSigned = true;
      setStatus('carregada');
      _showPreview(url);
    };
    img.onerror = () => setStatus('erro_carregar');
    img.src = url + (url.includes('?') ? '&' : '?') + '_nc=' + Date.now();
  }

  function _showPreview(url) {
    const wrap   = g('osSignPreviewWrap');
    const imgEl  = g('osSignPreviewImg');
    const urlEl  = g('osSignPreviewUrl');
    if (wrap)  wrap.style.display  = url ? 'block' : 'none';
    if (imgEl && url) imgEl.src    = url;
    if (urlEl) urlEl.textContent   = url || '';
  }

  // ── Captura de posição e pressão ─────────────────────────
  function _getPos(e) {
    if (!SP.canvas) return { x: 0, y: 0 };
    const r   = SP.canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  function _getW(e) {
    const p = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.5;
    return SP.penSize * (0.4 + p * 1.6);
  }

  // ── Pointer Events ────────────────────────────────────────
  function _onDown(e) {
    e.preventDefault();
    if (!SP.ctx) return;
    SP.isDrawing = true;
    SP.pts = [];
    SP.canvas.setPointerCapture(e.pointerId);

    const pos = _getPos(e);
    SP.pts.push(pos);
    SP.ctx.strokeStyle = SP.penColor;
    SP.ctx.lineWidth   = _getW(e);
    SP.ctx.beginPath();
    SP.ctx.arc(pos.x, pos.y, SP.ctx.lineWidth / 2, 0, Math.PI * 2);
    SP.ctx.fillStyle = SP.penColor;
    SP.ctx.fill();

    if (!SP.hasSigned) {
      SP.hasSigned = true;
      const hint = g('osSignHint');
      if (hint) hint.style.opacity = '0';
      setStatus('assinando');
      const btn = g('btnOsUploadSign');
      if (btn) btn.disabled = false;
    }
  }

  function _onMove(e) {
    if (!SP.isDrawing || !SP.ctx) return;
    e.preventDefault();

    const pos = _getPos(e);
    SP.pts.push(pos);
    SP.ctx.strokeStyle = SP.penColor;
    SP.ctx.lineWidth   = _getW(e);

    if (SP.pts.length === 2) {
      SP.ctx.beginPath();
      SP.ctx.moveTo(SP.pts[0].x, SP.pts[0].y);
      SP.ctx.lineTo(SP.pts[1].x, SP.pts[1].y);
      SP.ctx.stroke();
      return;
    }

    const p1   = SP.pts[SP.pts.length - 3];
    const p2   = SP.pts[SP.pts.length - 2];
    const p3   = SP.pts[SP.pts.length - 1];
    const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
    SP.ctx.beginPath();
    SP.ctx.moveTo(mid1.x, mid1.y);
    SP.ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
    SP.ctx.stroke();
  }

  function _onUp(e) {
    if (!SP.isDrawing) return;
    SP.isDrawing = false;
    if (SP.pts.length >= 2) {
      const last = SP.pts[SP.pts.length - 1];
      const prev = SP.pts[SP.pts.length - 2];
      const mid  = { x: (prev.x + last.x) / 2, y: (prev.y + last.y) / 2 };
      SP.ctx.beginPath();
      SP.ctx.moveTo(mid.x, mid.y);
      SP.ctx.lineTo(last.x, last.y);
      SP.ctx.stroke();
    }
    SP.pts = [];
    SP.ctx.beginPath();
    if (SP.hasSigned && !SP.cloudUrl) setStatus('pronto');
  }

  // ── Limpar canvas ─────────────────────────────────────────
  window.limparOsSignature = function () {
    if (!SP.ctx) return;
    SP.ctx.clearRect(0, 0, SP.cssW, SP.cssH);
    SP.hasSigned = false;
    SP.cloudUrl  = null;
    SP.pts       = [];
    sv('osAssinaturaUrl', '');
    const hint = g('osSignHint');
    if (hint) hint.style.opacity = '1';
    _showPreview('');
    setStatus('vazio');
  };

  // ── Upload Cloudinary ─────────────────────────────────────
  window.uploadOsAssinatura = async function () {
    if (!SP.hasSigned || !SP.canvas) {
      window.toast?.('⚠ Desenhe a assinatura antes de enviar.', 'warn');
      return;
    }
    const J = window.J || {};
    if (!J.cloudName || !J.cloudPreset) {
      window.toast?.('⚠ Cloudinary não configurado.', 'warn');
      return;
    }
    if (SP.uploading) return;
    SP.uploading = true;
    setStatus('enviando');

    try {
      // PNG com fundo branco (necessário para XLSX e PDF)
      const off = document.createElement('canvas');
      off.width  = SP.canvas.width;
      off.height = SP.canvas.height;
      const oc   = off.getContext('2d');
      oc.fillStyle = '#ffffff';
      oc.fillRect(0, 0, off.width, off.height);
      oc.drawImage(SP.canvas, 0, 0);

      const blob  = await new Promise(res => off.toBlob(res, 'image/png', 1.0));
      const osId  = gv('osId') || 'nova';
      const nome  = gv('osSignNome') || 'resp';
      const fname = `ass_os_${osId}_${nome.replace(/[^a-z0-9]/gi,'_').slice(0,30)}_${Date.now()}.png`;

      const fd = new FormData();
      fd.append('file', blob, fname);
      fd.append('upload_preset', J.cloudPreset);
      fd.append('folder', 'assinaturas_os');

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${J.cloudName}/image/upload`, {
        method: 'POST', body: fd
      });
      const data = await res.json();

      if (data && data.secure_url) {
        SP.cloudUrl = data.secure_url;
        sv('osAssinaturaUrl', data.secure_url);
        setStatus('salva');
        _showPreview(data.secure_url);
        window.toast?.('✅ Assinatura enviada ao Cloudinary!');
      } else {
        throw new Error(data?.error?.message || 'Resposta inesperada');
      }
    } catch (err) {
      console.error('[SIGN OS] Upload falhou:', err);
      setStatus('erro_upload');
      window.toast?.('✕ Falha: ' + (err.message || err), 'err');
    } finally {
      SP.uploading = false;
    }
  };

  // ── GETTER público — chamado pelo os.js antes de salvar ───
  // Retorna o objeto pronto para ser injetado em payload.assinaturaResponsavel
  window._osSignGetPayload = function () {
    const url = SP.cloudUrl || gv('osAssinaturaUrl');
    return {
      url:             url || '',
      cloudUrl:        url || '',
      nomeResponsavel: gv('osSignNome'),
      cargo:           gv('osSignCargo'),
      documento:       gv('osSignDoc'),
      assinadoEm:      url ? new Date().toISOString() : ''
    };
  };

  // ── Reset (nova O.S.) ─────────────────────────────────────
  function _reset() {
    SP.hasSigned = false;
    SP.cloudUrl  = null;
    SP.pts       = [];
    SP.uploading = false;
    sv('osAssinaturaUrl', '');
    ['osSignNome', 'osSignCargo', 'osSignDoc'].forEach(id => sv(id, ''));
    if (SP.ctx) SP.ctx.clearRect(0, 0, SP.cssW, SP.cssH);
    const hint = g('osSignHint');
    if (hint) hint.style.opacity = '1';
    _showPreview('');
    setStatus('vazio');
  }

  // ── Load (editar O.S. existente) ──────────────────────────
  function _loadFromOS(o) {
    const ass = o.assinaturaResponsavel || o.assinaturaOS || {};
    const url  = ass.url || ass.cloudUrl || '';
    SP.cloudUrl = url;
    sv('osAssinaturaUrl', url);
    sv('osSignNome',  ass.nomeResponsavel || '');
    sv('osSignCargo', ass.cargo           || '');
    sv('osSignDoc',   ass.documento       || '');
    _showPreview(url);
    setStatus(url ? 'carregada' : 'vazio');
  }

  // ── Wrap de prepOS (reset / load) ─────────────────────────
  // ÚNICO wrap mantido. Não toca em salvarOS.
  function _wrapPrepOS() {
    const orig = window.prepOS;
    if (typeof orig !== 'function') { setTimeout(_wrapPrepOS, 100); return; }

    window.prepOS = function (mode, id) {
      orig(mode, id);
      if (mode === 'add') {
        _reset();
      } else if (mode === 'edit' && id) {
        const o = (window.J?.os || []).find(x => x.id === id);
        if (o) _loadFromOS(o);
      }
    };
  }

  // ── Inicializar canvas ao clicar no tab 4 ────────────────
  document.addEventListener('click', function (e) {
    const tab = e.target?.closest?.('.mtab');
    if (tab && tab.getAttribute('onclick')?.includes('tabOS4')) {
      setTimeout(window.initOSSignaturePad, 60);
    }
  }, true);

  // ── Boot ──────────────────────────────────────────────────
  function _init() { _wrapPrepOS(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
// // thIAgui
