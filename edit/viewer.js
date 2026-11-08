/* Photo viewer: click a photo to see it scaled to fit the window; click the
 * picture for full size (scroll or drag to look around), and again to fit.
 * The Close button (top right), Escape, or a click beside the picture closes
 * it. Used by the badge's Photos list (app.js) and the Turntable panel's
 * On the phone tray (turntable.js), whose spin videos play in it too.
 *
 *   BadgeViewer.open({ kind: 'image' | 'video', title, info,
 *                      src,       // a URL to show, or
 *                      load,      // () => Promise<Blob>, downloaded on open
 *                      preview }) // a URL to show while `load` runs
 */
(function () {
  'use strict';

  var dlg, stage, titleEl, infoEl, media = null;
  var opts = null, full = false, owned = null, openN = 0, press = null, loading = false;

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'viewer';
    dlg.setAttribute('aria-label', 'Photo viewer');
    var bar = document.createElement('div'); bar.className = 'viewer-bar';
    var text = document.createElement('div'); text.className = 'viewer-text';
    titleEl = document.createElement('div'); titleEl.className = 'viewer-title';
    infoEl = document.createElement('div'); infoEl.className = 'viewer-info';
    text.appendChild(titleEl); text.appendChild(infoEl);
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'viewer-close'; close.textContent = '✕ Close';
    close.title = 'Close (Esc)';
    close.addEventListener('click', function () { dlg.close(); });
    bar.appendChild(text); bar.appendChild(close);
    stage = document.createElement('div'); stage.className = 'viewer-stage';
    dlg.appendChild(bar); dlg.appendChild(stage);
    document.body.appendChild(dlg);

    dlg.addEventListener('close', reset);
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', function () { press = null; stage.classList.remove('panning'); });
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
    window.addEventListener('resize', function () { if (dlg.open) layout(); });
  }

  function open(o) {
    if (!dlg) build();
    reset();
    opts = o || {};
    var n = ++openN;
    titleEl.textContent = opts.title || '';
    if (!dlg.open) dlg.showModal();  // first, so the stage has a size to fit to
    if (opts.src) show(opts.src, false);
    else if (opts.load) {
      if (opts.preview) show(opts.preview, true); else { stage.innerHTML = ''; media = null; }
      loading = true;
      opts.load().then(function (blob) {
        if (n !== openN || !dlg.open) return;
        owned = URL.createObjectURL(blob);
        loading = false;
        show(owned, false);
        info();
      }, function (e) {
        if (n !== openN || !dlg.open) return;
        loading = false;
        info('Couldn\'t load it: ' + (e && e.message || 'unknown error'));
      });
    }
    info();
  }

  // Puts the picture (or video) in the stage. A preview is the thumbnail,
  // stretched to fit while the full picture downloads.
  // A photo's preview stays up until the full picture has loaded. A video
  // takes the preview as its poster and shows straight away, because the
  // browser won't load a hidden one.
  function show(url, isPreview) {
    full = false;
    var old = media && media.classList.contains('preview') ? media : null;
    var video = opts.kind === 'video' && !isPreview;
    var m = document.createElement(video ? 'video' : 'img');
    m.className = 'viewer-media' + (isPreview ? ' preview' : '');
    if (video && old) {
      m.poster = old.src;
      m.style.width = old.style.width;
      m.style.height = old.style.height;
      old = null;
    }
    if (!old) stage.innerHTML = '';
    m.hidden = !!old;
    function ready() {
      if (m !== media) return;
      if (old && old.parentNode) old.remove();
      m.hidden = false;
      layout();
      info();
    }
    if (video) {
      m.controls = true; m.autoplay = true; m.loop = true; m.muted = true; m.playsInline = true;
      m.addEventListener('loadedmetadata', ready);
    } else {
      m.alt = opts.title || '';
      m.addEventListener('load', ready);
    }
    m.addEventListener('error', function () { if (m === media) info("Couldn't show this file in the browser."); });
    m.src = url;
    media = m;
    stage.appendChild(m);
  }

  function natural() {
    if (!media) return null;
    var w = media.naturalWidth || media.videoWidth, h = media.naturalHeight || media.videoHeight;
    return w && h ? { w: w, h: h } : null;
  }

  // Scaled to fit: never bigger than the picture itself, except a preview.
  // The stage's own box, not clientWidth, which a full-size picture's
  // scrollbars would shrink.
  function fitScale(n) {
    var b = stage.getBoundingClientRect();
    var s = Math.min(b.width / n.w, b.height / n.h);
    return media.classList.contains('preview') ? s : Math.min(1, s);
  }

  function layout() {
    var n = natural();
    if (!n) return;
    var s = full ? 1 : fitScale(n);
    media.style.width = Math.round(n.w * s) + 'px';
    media.style.height = Math.round(n.h * s) + 'px';
    stage.classList.toggle('full', full);
    stage.classList.toggle('zoomable', canZoom());
  }

  function canZoom() {
    var n = natural();
    return !!(n && media.tagName === 'IMG' && !media.classList.contains('preview') && fitScale(n) < 1);
  }

  function info(text) {
    if (text) { infoEl.textContent = text; return; }
    var n = natural(), parts = [];
    if (opts.info) parts.push(opts.info);
    if (loading) parts.push('Loading…');
    else if (n) {
      parts.push(n.w + ' × ' + n.h + ' px');
      if (media.tagName === 'IMG') {
        if (full) parts.push('full size · click to fit, drag to look around');
        else if (canZoom()) parts.push(Math.round(fitScale(n) * 100) + '% · click the photo for full size');
        else parts.push('full size');
      }
    }
    infoEl.textContent = parts.join(' · ');
  }

  // A click (pointer down and up without moving) on the photo switches
  // between fit and full size, keeping the clicked spot under the pointer; a
  // click beside it closes. At full size, dragging scrolls.
  function down(e) {
    if (e.button !== 0 || (media && media.tagName === 'VIDEO' && e.target === media)) return;
    press = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, onMedia: e.target.classList.contains('viewer-media'), moved: false };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function move(e) {
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    press.moved = true;
    if (full) {
      stage.classList.add('panning');
      stage.scrollLeft = press.sl - dx;
      stage.scrollTop = press.st - dy;
    }
  }

  function up(e) {
    var p = press;
    press = null;
    stage.classList.remove('panning');
    if (!p || p.moved) return;
    if (!p.onMedia) { if (!full) dlg.close(); return; }
    if (!canZoom() && !full) return;
    var r = media.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    full = !full;
    layout();
    if (full) {
      var n = natural();
      stage.scrollLeft = media.offsetLeft + fx * n.w - (e.clientX - sr.left);
      stage.scrollTop = media.offsetTop + fy * n.h - (e.clientY - sr.top);
    }
    info();
  }

  // On close, and before showing another picture in the open viewer.
  function reset() {
    openN++;
    loading = false;
    press = null;
    if (media && media.tagName === 'VIDEO') media.pause();
    if (stage) stage.innerHTML = '';
    media = null;
    if (owned) { URL.revokeObjectURL(owned); owned = null; }
  }

  window.BadgeViewer = { open: open, close: function () { if (dlg && dlg.open) dlg.close(); } };
})();
