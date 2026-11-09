// Turntable setup page: the badge stand generator (see badge-stand.js).
import { DEFAULTS, standSvg, check, combWidths } from './badge-stand.js';

const $ = (id) => document.getElementById(id);
const form = $('st-form');
const f = form.elements;
const STORE = 'badges-turntable-stand';
const PX_PER_MM = 4;  // preview scale
let current = null;

// Form field name -> parameter, for the plain numbers.
const NUMBERS = ['slot', 'lead', 'cbH', 'cbEnd', 'upL', 'upH', 'upR', 'uprights', 'pocketW', 'pocketD',
  'flareW', 'flareD', 'combFrom', 'combStep', 'combCount', 'gap', 'labelSize'];

function setForm(p) {
  for (const k of NUMBERS) if (f[k] && p[k] != null) f[k].value = p[k];
  if (p.spacings != null) f.spacings.value = Array.isArray(p.spacings) ? p.spacings.join(', ') : p.spacings;
  if (p.comb != null) f.comb.checked = !!p.comb;
  if (p.engrave != null) f.engrave.checked = !!p.engrave;
}

function params() {
  const p = { ...DEFAULTS };
  for (const k of NUMBERS) {
    const v = parseFloat(f[k].value);
    p[k] = Number.isFinite(v) ? v : (f[k].value.trim() === '' ? DEFAULTS[k] : NaN);
  }
  p.uprights = Math.round(p.uprights);
  p.combCount = Math.round(p.combCount);
  p.spacings = f.spacings.value.split(/[\s,;]+/).filter(Boolean).map(Number);
  p.comb = f.comb.checked;
  p.engrave = f.engrave.checked;
  return p;
}

function save() {
  const v = { spacings: f.spacings.value, comb: f.comb.checked, engrave: f.engrave.checked };
  for (const k of NUMBERS) v[k] = f[k].value;
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (_) { /* private mode */ }
}

setForm(DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved) setForm(saved);
} catch (_) { /* nothing saved */ }

const mm = (v) => `${+v.toFixed(2)} mm`;

function stat(value, label) {
  const d = document.createElement('div');
  d.className = 'ts-stat';
  d.innerHTML = '<span class="ts-stat-value"></span><span class="ts-stat-label"></span>';
  d.firstChild.textContent = value;
  d.lastChild.textContent = label;
  return d;
}

function render() {
  save();
  const p = params();
  const err = $('st-error'), stats = $('st-stats'), box = $('st-preview');
  err.hidden = true;
  stats.innerHTML = '';
  box.innerHTML = '';
  current = null;
  try {
    const info = check(p);
    const sheet = standSvg(p);
    current = { p, sheet };
    stats.append(
      stat(`${+sheet.width.toFixed(1)} × ${+sheet.height.toFixed(1)} mm`, 'sheet'),
      stat(String(sheet.parts), 'parts'),
      stat(mm(p.slot), 'slot width'),
      stat(mm(info.seat), 'badge edge above the table'),
      stat(p.spacings.join(', '), 'cup spacings (mm)'),
    );
    const div = document.createElement('div');
    div.className = 'ts-sheet st-sheet';
    div.style.width = `${sheet.width * PX_PER_MM}px`;
    div.innerHTML = sheet.svg;
    box.appendChild(div);
    const widths = combWidths(p);
    $('st-note').textContent = (p.comb ? `The test comb's gaps run from ${widths[0]} to ${widths[widths.length - 1]} mm, left to right. ` : '') +
      `The crossbars sit ${mm(info.crossbarClear)} below the badge.`;
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    $('st-note').textContent = '';
  }
  $('st-svg').disabled = !current;
  $('st-comb-svg').disabled = !current;
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const slotName = () => String(+current.p.slot.toFixed(2)).replace('.', '_');

$('st-svg').addEventListener('click', () => download(`badge-stand-slot${slotName()}.svg`, current.sheet.svg));
$('st-comb-svg').addEventListener('click', () => download('badge-stand-test-comb.svg', standSvg(current.p, { only: 'comb' }).svg));
$('st-reset').addEventListener('click', () => { setForm(DEFAULTS); render(); });

form.addEventListener('input', render);
form.addEventListener('submit', (e) => e.preventDefault());

render();
