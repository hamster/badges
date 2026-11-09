// The badge stand for the turntable: two acrylic uprights ("cups") that hold
// the badge's bottom edge, and crossbars that half-lap into them to set the
// spacing. A port of assets/turntable/badge_stand.scad, drawn straight to an
// SVG for LightBurn and similar: cuts in black, engraving in blue, so each
// imports on its own layer. Sizes in mm.

export const DEFAULTS = {
  slot: 3.0,            // half-lap slot width as cut, from the test comb
  lead: 0.4,            // chamfer at the slot mouths
  spacings: [20, 40, 60],
  cbH: 16,              // crossbar height
  cbEnd: 8,             // crossbar overhang past each slot centre
  upL: 40,              // upright depth
  upH: 30,              // upright height
  upR: 3,               // upright top corner radius
  uprights: 2,
  pocketW: 2.0,         // badge pocket: 1.6 mm PCB + clearance
  pocketD: 5.0,
  flareW: 8.0,
  flareD: 4.0,
  comb: true,
  combFrom: 2.8,
  combStep: 0.1,
  combCount: 6,
  gap: 4,               // between parts on the sheet
  labelSize: 4,
  engrave: true,
};

export const CUT = '#000000';      // LightBurn layer 00
export const ENGRAVE = '#0000ff';  // LightBurn layer 01

const COMB_H = 16, COMB_DEPTH = 8;

// ---- A single-stroke font for the labels: digits and the point ---------------
// Glyphs are polylines in a box 0.6 wide and 1 high, y up, so they engrave as
// lines (no font needed in LightBurn).

const GLYPHS = {
  '0': [[[0.15, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.15], [0.45, 0], [0.15, 0], [0, 0.15], [0, 0.85], [0.15, 1]]],
  '1': [[[0.1, 0.8], [0.33, 1], [0.33, 0]], [[0.08, 0], [0.58, 0]]],
  '2': [[[0, 0.85], [0.15, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.62], [0, 0], [0.6, 0]]],
  '3': [[[0, 0.85], [0.15, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.66], [0.45, 0.52], [0.2, 0.52]],
        [[0.45, 0.52], [0.6, 0.38], [0.6, 0.15], [0.45, 0], [0.15, 0], [0, 0.15]]],
  '4': [[[0.45, 0], [0.45, 1], [0, 0.3], [0.6, 0.3]]],
  '5': [[[0.6, 1], [0.05, 1], [0, 0.55], [0.4, 0.6], [0.6, 0.45], [0.6, 0.15], [0.45, 0], [0.15, 0], [0, 0.15]]],
  '6': [[[0.55, 0.9], [0.4, 1], [0.2, 1], [0, 0.8], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15], [0.6, 0.45], [0.45, 0.6], [0.15, 0.6], [0, 0.45]]],
  '7': [[[0, 1], [0.6, 1], [0.2, 0]]],
  '8': [[[0.15, 0.55], [0.05, 0.65], [0.05, 0.88], [0.17, 1], [0.43, 1], [0.55, 0.88], [0.55, 0.65], [0.45, 0.55], [0.15, 0.55],
         [0, 0.4], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15], [0.6, 0.4], [0.45, 0.55]]],
  '9': [[[0.05, 0.1], [0.2, 0], [0.4, 0], [0.6, 0.2], [0.6, 0.85], [0.45, 1], [0.15, 1], [0, 0.85], [0, 0.55], [0.15, 0.4], [0.45, 0.4], [0.6, 0.55]]],
  '.': [[[0.05, 0], [0.15, 0], [0.15, 0.1], [0.05, 0.1], [0.05, 0]]],
};
const ADVANCE = { '.': 0.35 };
const advance = (ch) => ADVANCE[ch] ?? 0.85;

// Polylines for a string of `size` mm tall, centred on x, baseline at y (y up).
function textLines(str, x, y, size) {
  const chars = [...str].filter((ch) => GLYPHS[ch]);
  const width = chars.reduce((w, ch) => w + advance(ch), 0) - 0.25;  // no gap after the last
  let pen = x - (width * size) / 2;
  const lines = [];
  for (const ch of chars) {
    for (const line of GLYPHS[ch]) lines.push(line.map(([u, v]) => [pen + u * size, y + v * size]));
    pen += advance(ch) * size;
  }
  return lines;
}

// ---- The parts, as outlines in mm with y up (as in the .scad) -------------------

// The outline of each part is a list of points, anticlockwise; an arc is
// written as { arc: [x, y], r }, an anticlockwise quarter round to (x, y).

// A slot cut into an edge, with a chamfered mouth: points along the edge,
// going in the +x direction, for an edge at y with the slot going in by dir.
function slotPoints(c, y, w, depth, lead, dir) {
  const s = w / 2;
  const pts = [];
  if (lead > 0) pts.push([c - s - lead, y]);
  pts.push([c - s, y + dir * lead], [c - s, y + dir * depth], [c + s, y + dir * depth], [c + s, y + dir * lead]);
  if (lead > 0) pts.push([c + s + lead, y]);
  return pts;
}

function upright(p) {
  const { upL: L, upH: H, upR: r, slot, lead, flareW, flareD, pocketW, pocketD } = p;
  const lap = p.cbH / 2, c = L / 2;
  const pts = [[0, 0], ...slotPoints(c, 0, slot, lap, lead, 1), [L, 0]];
  // Up the right side and round the corner (anticlockwise, y up).
  if (r > 0) pts.push([L, H - r], { arc: [L - r, H], r });
  else pts.push([L, H]);
  // The badge notch from the top: the flare, then the narrow pocket.
  pts.push([c + flareW / 2, H], [c + pocketW / 2, H - flareD], [c + pocketW / 2, H - flareD - pocketD],
    [c - pocketW / 2, H - flareD - pocketD], [c - pocketW / 2, H - flareD], [c - flareW / 2, H]);
  if (r > 0) pts.push([r, H], { arc: [0, H - r], r });
  else pts.push([0, H]);
  return pts;
}

const cbLen = (p, sp) => sp + 2 * p.cbEnd;

function crossbar(p, sp) {
  const len = cbLen(p, sp), h = p.cbH, lap = h / 2;
  // Along the top edge, right to left, with the slots coming down.
  const top = [p.cbEnd + sp, p.cbEnd].flatMap((c) => slotPoints(-c, -h, p.slot, lap, p.lead, 1).map(([x, y]) => [-x, -y]));
  return [[0, 0], [len, 0], [len, h], ...top, [0, h]];
}

export function combWidths(p) {
  return Array.from({ length: p.combCount }, (_, i) => Math.round((p.combFrom + i * p.combStep) * 100) / 100);
}

function combPitch(p) {
  const w = combWidths(p);
  return Math.max(9, w[w.length - 1] + 5.5);
}

function comb(p) {
  const pitch = combPitch(p), widths = combWidths(p);
  const len = pitch * (widths.length + 1);
  const top = [];
  for (let i = widths.length - 1; i >= 0; i--) {
    const c = pitch * (i + 1), s = widths[i] / 2;
    top.push([c + s, COMB_H], [c + s, COMB_H - COMB_DEPTH], [c - s, COMB_H - COMB_DEPTH], [c - s, COMB_H]);
  }
  return { len, pts: [[0, 0], [len, 0], [len, COMB_H], ...top, [0, COMB_H]] };
}

const fmt1 = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

// ---- Checks --------------------------------------------------------------------

export function check(p) {
  const bad = (msg) => { throw new Error(msg); };
  const pos = { slot: 'Slot width', upL: 'Upright depth', upH: 'Upright height', cbH: 'Crossbar height', cbEnd: 'Crossbar overhang',
    pocketW: 'Pocket width', flareW: 'Flare width', gap: 'Part spacing' };
  for (const [k, name] of Object.entries(pos)) if (!(p[k] > 0)) bad(`${name} must be more than 0.`);
  for (const [k, name] of Object.entries({ lead: 'Slot chamfer', upR: 'Corner radius', pocketD: 'Pocket depth', flareD: 'Flare depth' })) {
    if (!(p[k] >= 0)) bad(`${name} can't be negative.`);
  }
  if (!p.spacings.length) bad('Give at least one crossbar spacing.');
  if (p.spacings.some((s) => !(s > 0))) bad('Crossbar spacings must be numbers more than 0.');
  if (!(p.uprights >= 1)) bad('Make at least one upright.');
  if (p.flareW < p.pocketW) bad('The flare must be at least as wide as the pocket.');
  if (p.flareW + 2 * p.upR > p.upL) bad('The flare and corner radii are wider than the upright.');
  if (p.slot + 2 * p.lead >= p.upL) bad('The slot is wider than the upright.');
  const seat = p.upH - p.flareD - p.pocketD;
  if (p.cbH / 2 >= seat) bad(`The upright is too short: its slot (${fmt1(p.cbH / 2)} mm) runs into the badge pocket.`);
  if (p.cbEnd <= p.slot / 2 + p.lead) bad('The crossbar overhang must be more than half the slot width.');
  if (Math.min(...p.spacings) <= p.slot + 2 * p.lead) bad('A crossbar spacing is narrower than its slots.');
  if (p.comb) {
    if (!(p.combCount >= 1) || !(p.combFrom > 0) || !(p.combStep >= 0)) bad('Check the test comb settings.');
  }
  return {
    seat,                                       // the badge's bottom edge above the table
    crossbarClear: seat - p.cbH,                // gap between the crossbar's top and the badge
  };
}

// ---- The sheet -------------------------------------------------------------------

const n = (v) => +v.toFixed(3);

// Outline points (y up) to an SVG path (y down) at offset (ox, oy).
function pathD(pts, ox, oy, top) {
  let d = '';
  pts.forEach((pt, i) => {
    if (pt.arc) {
      const [x, y] = pt.arc;
      d += ` A ${n(pt.r)} ${n(pt.r)} 0 0 0 ${n(ox + x)} ${n(top - (oy + y))}`;
    } else {
      d += `${i ? ' L' : 'M'} ${n(ox + pt[0])} ${n(top - (oy + pt[1]))}`;
    }
  });
  return d + ' Z';
}

function linesD(lines, top) {
  return lines.map((l) => l.map(([x, y], i) => `${i ? 'L' : 'M'} ${n(x)} ${n(top - y)}`).join(' ')).join(' ');
}

// What to draw: the whole stand, or only the comb. Returns the SVG and its size.
export function standSvg(p, { only = 'all', margin = 2 } = {}) {
  check(p);
  const g = p.gap;
  const cuts = [], engr = [];  // { pts, ox, oy } and polylines (y up, absolute)
  let w = 0, top, bottom;

  const combPart = comb(p);
  if (only === 'comb') {
    cuts.push({ pts: combPart.pts, ox: 0, oy: 0 });
    combWidths(p).forEach((cw, i) => engr.push(...textLines(fmt1(cw), combPitch(p) * (i + 1), 1.5, 2.4)));
    w = combPart.len; top = COMB_H; bottom = 0;
  } else {
    const rowUp = p.cbH + g, rowComb = -(COMB_H + g);
    for (let i = 0; i < p.uprights; i++) cuts.push({ pts: upright(p), ox: i * (p.upL + g), oy: rowUp });
    w = p.uprights * (p.upL + g) - g;
    let x = 0;
    for (const sp of p.spacings) {
      cuts.push({ pts: crossbar(p, sp), ox: x, oy: 0 });
      engr.push(...textLines(String(sp), x + cbLen(p, sp) / 2, 2, p.labelSize));
      x += cbLen(p, sp) + g;
    }
    w = Math.max(w, x - g);
    top = rowUp + p.upH; bottom = 0;
    if (p.comb) {
      cuts.push({ pts: combPart.pts, ox: 0, oy: rowComb });
      combWidths(p).forEach((cw, i) => engr.push(...textLines(fmt1(cw), combPitch(p) * (i + 1), rowComb + 1.5, 2.4)));
      w = Math.max(w, combPart.len);
      bottom = rowComb;
    }
  }

  const W = n(w + 2 * margin), H = n(top - bottom + 2 * margin), T = top + margin;
  const ox = margin;
  const cutD = cuts.map((c) => pathD(c.pts, c.ox + ox, c.oy, T)).join(' ');
  const engrD = p.engrave && engr.length ? linesD(engr.map((l) => l.map(([x, y]) => [x + ox, y])), T) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n` +
    `<title>Badge stand${only === 'comb' ? ' test comb' : ''}: cut black, engrave blue</title>\n` +
    `<g id="cut" fill="none" stroke="${CUT}" stroke-width="0.1"><path d="${cutD}"/></g>\n` +
    (engrD ? `<g id="engrave" fill="none" stroke="${ENGRAVE}" stroke-width="0.1" stroke-linecap="round" stroke-linejoin="round"><path d="${engrD}"/></g>\n` : '') +
    '</svg>\n';
  return { svg, width: W, height: H, parts: cuts.length };
}
