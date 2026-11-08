// Turntable setup page: a live calculator for the encoder ring (marker band)
// and the platter sticker, on paper or a 4x6 label. The generator itself is
// ring.js, copied from hamster/badge-turntable.
import { planRing, paperSvgs, paperLayout, labelSvgs, labelLayout, labelZpl, topStickerSvg, cameraViewSvg, PAPER, LABEL } from './ring.js';

const $ = (id) => document.getElementById(id);
const form = $('ts-form');
const f = form.elements;
const STORE = 'badges-turntable-setup';
const PRESETS = {
  // Measured: 145.3 mm across, 456.5 mm round, a 9.6 mm black rim.
  jayegt: { measure: 'circumference', size: '456.5', height: '9.5', platter: '145.3', invert: true },
};
let current = null;

// ---- Form state ------------------------------------------------------------

function values() {
  return {
    preset: f.preset.value, measure: f.measure.value, size: f.size.value, height: f.height.value,
    platter: f.platter.value, invert: f.invert.checked, output: f.output.value,
    count: f.count.value, strip: f.strip.value, inset: f.inset.value,
  };
}

function setValues(v) {
  for (const [k, val] of Object.entries(v)) {
    if (!f[k] || val == null) continue;
    if (k === 'invert') f.invert.checked = !!val;
    else f[k].value = val;
  }
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(values())); } catch (_) { /* private mode */ }
}

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved) setValues(saved);
} catch (_) { /* nothing saved */ }

const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

function sizeLabel() {
  $('ts-size-label').textContent = f.measure.value === 'diameter' ? 'Rim diameter' : 'Rim circumference';
}

// ---- Rendering ---------------------------------------------------------------

function sheet(svg, kind) {
  const div = document.createElement('div');
  div.className = 'ts-sheet ' + kind;
  div.innerHTML = svg;
  return div;
}

// The paper sticker cropped to a 4x6 label around the disc, when it fits. The
// cropped-off header and scale bar are only for paper.
function labelSticker(diameter, inset) {
  const svg = topStickerSvg({ diameter, paperKey: 'letter', inset });
  const cx = PAPER.letter.w / 2, cy = PAPER.letter.h / 2 + 4;
  const x = cx - LABEL.w / 2, y = cy - LABEL.h / 2;
  return svg.replace(/<svg [^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL.w}mm" height="${LABEL.h}mm" ` +
    `viewBox="${x} ${y} ${LABEL.w} ${LABEL.h}" font-family="Helvetica, Arial, sans-serif">`);
}

function fmt(n, d = 1) { return Number.isInteger(n) ? String(n) : n.toFixed(d); }

function stat(value, label) {
  const d = document.createElement('div');
  d.className = 'ts-stat';
  d.innerHTML = '<span class="ts-stat-value"></span><span class="ts-stat-label"></span>';
  d.firstChild.textContent = value;
  d.lastChild.textContent = label;
  return d;
}

function render() {
  sizeLabel();
  save();
  const v = values();
  const isLabel = v.output.startsWith('label');
  const dpi = v.output === 'label300' ? 300 : 203;
  const size = num(v.size);
  const err = $('ts-error');
  const stats = $('ts-stats'), bandBox = $('ts-band-preview'), stickerBox = $('ts-sticker-preview');
  stats.innerHTML = '';
  bandBox.innerHTML = '';
  stickerBox.innerHTML = '';
  current = null;
  err.hidden = true;

  let plan;
  try {
    plan = planRing({
      circumference: v.measure === 'circumference' ? size : 0,
      diameter: v.measure === 'diameter' ? size : 0,
      height: num(v.height),
      count: parseInt(v.count, 10) || 0,
      maxStrip: num(v.strip),
      invert: v.invert,
    });
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    buttons();
    return;
  }

  current = { plan, isLabel, dpi, output: v.output, band: null, zpl: '', sticker: null, stickerPage: null };
  try {
    const layout = isLabel ? labelLayout(plan) : paperLayout(plan, v.output);
    current.band = isLabel ? labelSvgs(plan) : paperSvgs(plan, v.output);
    current.zpl = isLabel ? labelZpl(plan, dpi) : '';
    const sheets = current.band.length;
    stats.append(
      stat(`${plan.count} × ${fmt(plan.step)}°`, 'markers'),
      stat(`${plan.marker.toFixed(1)} mm`, 'marker size'),
      stat(`${plan.pitch.toFixed(2)} mm`, 'marker spacing'),
      stat(`${plan.diameter.toFixed(1)} mm`, 'rim diameter'),
      stat(String(layout.strips.length), layout.strips.length === 1 ? 'strip' : 'strips'),
      stat(String(sheets), isLabel ? (sheets === 1 ? 'label' : 'labels') : (sheets === 1 ? 'page' : 'pages')),
    );
    current.band.forEach((svg) => bandBox.appendChild(sheet(svg, isLabel ? 'label' : 'paper')));
    const cell = plan.cell;
    $('ts-band-note').textContent =
      `Each strip is captioned with its markers and angles; strip 1 starts at 0°. ` +
      (plan.invert ? 'Black band with white markers, with 1 mm of black past the cut lines. ' : '') +
      (cell < 1.1 ? `The marker cells are only ${cell.toFixed(2)} mm, so frame the turntable closely. ` : '') +
      (isLabel ? 'The label printer may feed a little short or long: the fit check below corrects for it.' : '');
  } catch (e) {
    current.band = null;
    $('ts-band-note').textContent = '';
    err.textContent = e.message;
    err.hidden = false;
  }

  // The sticker: on the label when it fits, else on paper.
  const platter = Math.round((num(v.platter) || plan.diameter) * 10) / 10;
  const inset = v.inset === '' ? 1 : Math.max(0, num(v.inset));
  const disc = platter - 2 * inset;
  let note = `A ${disc.toFixed(1)} mm disc for a ${platter.toFixed(1)} mm platter, ${fmt(inset)} mm inside its edge. `;
  try {
    if (isLabel && disc <= LABEL.w - 4) {
      current.sticker = labelSticker(platter, inset);
      current.stickerPage = 'label';
      note += 'Cut round the red circle.';
    } else {
      const paperKey = isLabel ? 'letter' : v.output;
      current.sticker = topStickerSvg({ diameter: platter, paperKey, inset });
      current.stickerPage = paperKey;
      note += isLabel ? `Too wide for a 4×6 label, so it's on US Letter paper.` : 'Cut the red circle with a cutter, or by hand.';
    }
    stickerBox.appendChild(sheet(current.sticker, current.stickerPage === 'label' ? 'label' : 'paper'));
  } catch (e) {
    current.sticker = null;
    note = e.message;
  }
  $('ts-sticker-note').textContent = note;
  buttons();
  fixResult();
  drawView();
}

function buttons() {
  const band = !!(current && current.band), lbl = band && current.isLabel;
  $('ts-print-band').disabled = !band;
  $('ts-svg-band').disabled = !band;
  $('ts-zpl').hidden = !lbl;
  $('ts-copy-zpl').hidden = !lbl;
  $('ts-print-sticker').disabled = !(current && current.sticker);
  $('ts-svg-sticker').disabled = !(current && current.sticker);
}

// ---- Printing and downloads ------------------------------------------------------

const printArea = document.createElement('div');
printArea.id = 'ts-print-area';
document.body.appendChild(printArea);
const pageStyle = document.createElement('style');
document.head.appendChild(pageStyle);

function printSvgs(svgs, page) {
  const w = page === 'label' ? LABEL.w : PAPER[page].w, h = page === 'label' ? LABEL.h : PAPER[page].h;
  pageStyle.textContent = `@page { size: ${w}mm ${h}mm; margin: 0; }`;
  printArea.innerHTML = svgs.join('');
  window.print();
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function baseName() {
  return `ring-${current.plan.count}x${fmt(current.plan.step)}deg` + (current.plan.invert ? '-black' : '');
}

$('ts-print-band').addEventListener('click', () => printSvgs(current.band, current.isLabel ? 'label' : current.output));
$('ts-svg-band').addEventListener('click', () => {
  const kind = current.isLabel ? 'label-4x6' : current.output;
  current.band.forEach((svg, i) => download(`${baseName()}-${kind}-${i + 1}.svg`, svg, 'image/svg+xml'));
});
$('ts-zpl').addEventListener('click', () => download(`${baseName()}-4x6-${current.dpi}dpi.zpl`, current.zpl, 'text/plain'));
$('ts-copy-zpl').addEventListener('click', async () => {
  const b = $('ts-copy-zpl');
  try { await navigator.clipboard.writeText(current.zpl); b.textContent = 'Copied'; } catch (_) { b.textContent = 'Couldn\'t copy'; }
  setTimeout(() => { b.textContent = 'Copy ZPL'; }, 1500);
});
$('ts-print-sticker').addEventListener('click', () => printSvgs([current.sticker], current.stickerPage));
$('ts-svg-sticker').addEventListener('click', () => download(`platter-sticker-${current.stickerPage}.svg`, current.sticker, 'image/svg+xml'));

// ---- Fit check: reprint at the size that closes the gap ------------------------

function fixResult() {
  const out = $('ts-fix-result'), use = $('ts-fix-use');
  const gap = parseFloat($('ts-gap').value);
  use.hidden = true;
  if (!current || !Number.isFinite(gap) || gap === 0) {
    out.textContent = current ? `The band now prints for a ${current.plan.circumference.toFixed(1)} mm circumference.` : '';
    return;
  }
  const next = current.plan.circumference + gap;
  out.textContent = Math.abs(gap) <= 2
    ? `${Math.abs(gap)} mm is close enough: no need to reprint.`
    : `Reprint at a ${next.toFixed(1)} mm circumference (${(next / Math.PI).toFixed(1)} mm diameter).`;
  if (Math.abs(gap) > 2) {
    use.hidden = false;
    use.onclick = () => {
      f.measure.value = 'circumference';
      f.size.value = next.toFixed(1);
      f.preset.value = 'custom';
      $('ts-gap').value = '';
      render();
      document.getElementById('make').scrollIntoView({ behavior: 'smooth' });
    };
  }
}
$('ts-gap').addEventListener('input', fixResult);

// ---- Form events ---------------------------------------------------------------

f.preset.addEventListener('change', () => {
  const p = PRESETS[f.preset.value];
  if (p) setValues(p);
  render();
});
// Switching circumference and diameter converts the number, so the band stays the same.
let lastMeasure = f.measure.value;
f.measure.addEventListener('change', () => {
  const s = num(f.size.value);
  if (s) f.size.value = (f.measure.value === 'diameter' && lastMeasure === 'circumference' ? s / Math.PI
    : f.measure.value === 'circumference' && lastMeasure === 'diameter' ? s * Math.PI : s).toFixed(1);
  lastMeasure = f.measure.value;
  render();
});
form.addEventListener('input', (e) => {
  if (e.target === f.measure || e.target === f.preset) return;  // their change handlers render
  // Typing your own numbers leaves the preset.
  const p = PRESETS[f.preset.value];
  if (p && e.target.name in p && String(p[e.target.name]) !== String(e.target.type === 'checkbox' ? e.target.checked : e.target.value)) {
    f.preset.value = 'custom';
  }
  render();
});
form.addEventListener('submit', (e) => e.preventDefault());

// ---- The turning illustration ------------------------------------------------------

const view = $('ts-camera-view');
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let theta = 20, lastDraw = 0, visible = true;

// cameraViewSvg's drawing: the platter's centre, its radius across and the
// half-height of its top ellipse, in the drawing's units.
const XC = 160, YC = 70, RX = 130, RY = 26;

// A badge standing at the platter's centre, turning with it: its front faces
// ring angle 0, so it faces the camera at a table angle of 0. A point u along
// the badge lands at platter direction 90° − θ, so the badge is drawn in its
// own coordinates through an affine map: across it shrinks by cos θ, and
// its base tilts with the platter's ellipse.
function badgeSvg(deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const m = `matrix(${c.toFixed(4)} ${((RY / RX) * s).toFixed(4)} 0 1 ${XC} ${YC - 2})`;
  const front = c > 0;
  return `<g transform="${m}">` +
    `<rect x="-22" y="-56" width="44" height="56" rx="5" fill="${front ? '#2f6f4f' : '#24533c'}" stroke="#1d4a33" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` +
    `<rect x="-6" y="-53" width="12" height="3" rx="1.5" fill="#fff"/>` +
    (front ? '<rect x="-14" y="-40" width="28" height="18" rx="2" fill="#173a2a"/><circle cx="-8" cy="-12" r="3" fill="#c8f7d8"/><circle cx="0" cy="-12" r="3" fill="#c8f7d8"/><circle cx="8" cy="-12" r="3" fill="#c8f7d8"/>' : '') +
    '</g>';
}

function drawView() {
  if (!current) return;
  let svg = cameraViewSvg(current.plan, theta);
  // The illustration draws a white band; show a black one as it'll look.
  if (current.plan.invert) svg = svg.replace('fill="#fafafa"', 'fill="#161616"').replace('fill="#111"', 'fill="#f2f2f2"');
  // Its badge stands still: swap it for one that turns with the table, under the camera axis line.
  svg = svg.split('\n').filter((l) => !/^<rect x="[\d.-]+" y="[\d.-]+" width="(44|12|28)"/.test(l)).join('\n')
    .replace(/(<path [^>]*stroke="#d33")/, badgeSvg(theta) + '$1');
  view.innerHTML = svg;
}

function tick(t) {
  if (visible && t - lastDraw > 66) {  // about 15 frames a second
    theta = (theta + (t - lastDraw > 500 ? 0 : (t - lastDraw) * 0.012)) % 360;  // a turn in 30 s
    lastDraw = t;
    drawView();
  }
  requestAnimationFrame(tick);
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(view);
}

render();
drawView();
if (!still) requestAnimationFrame(tick);
