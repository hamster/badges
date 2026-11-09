// Badge turntable stand — parametric, laser-cut from 3 mm acrylic
//
// Two upright "cups" pocket the bottom edge of the badge; a crossbar
// half-laps into both to hold them upright at a set spacing.
//
// The same stand can be made in a web page, with a live preview and one SVG
// holding both the cuts and the engraving:
//   https://hamster.github.io/badges/edit/turntable-setup/#stand
//
// MODES (set `mode` or use the Customizer):
//   "assembly" – 3D preview of the stand at `preview_spacing`, with a ghost badge
//   "cut"      – 2D sheet layout of all cut outlines  -> F6, File > Export > SVG
//   "engrave"  – 2D labels only, same positions         -> export as second SVG
//   "comb"     – the test comb's outline on its own, to cut first and find
//                `slot_w`; its gaps widen from `comb_from` left to right
//
// In LightBurn: import cut.svg and engrave.svg, put the cut file on a cut
// layer and the engrave file on a low-power line layer. To line the two up,
// turn on `registration` before exporting both: it adds a tiny square at two
// opposite corners of each, so they import with the same bounds. Delete the
// squares once they're aligned.
//
// Numbers use sliders with a step so the Customizer takes decimals: it
// treats a plain number like 3.0 as a whole number and won't step below 1.

/* [Mode] */
mode = "assembly"; // [assembly, cut, engrave, comb]
preview_spacing = 40; // [20, 40, 60, 80]

/* [Material] */
// Nominal sheet thickness (for the 3D preview)
thickness = 3.0;   // [1:0.05:10]
// Half-lap slot width as cut: the comb tooth that fits snugly
slot_w    = 3.0;   // [1:0.05:10]
// Chamfer at the slot mouths
lead      = 0.4;   // [0:0.05:2]

/* [Crossbars] */
// Centre-to-centre cup spacing, one crossbar each
spacings  = [20, 40, 60];
// Crossbar height (keep below the badge's bottom edge)
cb_h      = 16;    // [6:0.5:40]
// Crossbar overhang past each slot centre
cb_end    = 8;     // [3:0.5:30]

/* [Uprights / cups] */
// Depth (front-to-back footprint)
up_l      = 40;    // [10:0.5:120]
// Height
up_h      = 30;    // [10:0.5:120]
// Top corner radius
up_r      = 3;     // [0:0.5:20]
num_uprights = 2;  // [1:1:6]

/* [Badge notch] */
// Narrow pocket width (1.6 mm PCB + clearance)
pocket_w  = 2.0;   // [0.5:0.05:10]
// Narrow pocket depth
pocket_d  = 5.0;   // [0:0.5:30]
// Flare width at the top edge
flare_w   = 8.0;   // [0.5:0.5:40]
// Flare (lead-in) depth
flare_d   = 4.0;   // [0:0.5:30]

/* [Test comb] */
include_comb = true;
// Narrowest tooth gap
comb_from    = 2.8;  // [0.5:0.05:10]
// Step between gaps
comb_step    = 0.1;  // [0.01:0.01:1]
// Number of gaps
comb_count   = 6;    // [1:1:12]

/* [Layout] */
// Spacing between parts on the sheet
gap        = 4;    // [1:0.5:20]
// Engraved spacing label height
label_size = 4;    // [1:0.5:10]
font       = "Liberation Sans:style=Bold";
// Tiny squares at two corners, to align the cut and engrave exports
registration = false;

/* [Hidden] */
$fn = 48;
lap = cb_h / 2;   // half-lap depth on both parts
eps = 0.01;
comb_widths = [for (i = [0 : comb_count - 1]) round((comb_from + i * comb_step) * 100) / 100];

// ---------------------------------------------------------------- 2D parts

// Open slot cut from an edge. Drawn opening "up" from y=0 into +y; caller
// mirrors/translates. Includes a small lead-in chamfer at the mouth.
module slot2d(w, depth) {
    s = w / 2;
    polygon([
        [-s - lead, -eps], [ s + lead, -eps],
        [ s, lead], [ s, depth], [-s, depth], [-s, lead]
    ]);
}

module upright2d() {
    difference() {
        // body with rounded top corners
        hull() {
            square([up_l, eps]);
            if (up_r > 0) {
                translate([up_r, up_h - up_r]) circle(r = up_r);
                translate([up_l - up_r, up_h - up_r]) circle(r = up_r);
            } else {
                translate([0, up_h - eps]) square([up_l, eps]);
            }
        }
        // badge notch: flare + pocket, from the top
        translate([up_l / 2, up_h])
            polygon([
                [-flare_w / 2,  eps], [ flare_w / 2,  eps],
                [ pocket_w / 2, -flare_d],
                [ pocket_w / 2, -flare_d - pocket_d],
                [-pocket_w / 2, -flare_d - pocket_d],
                [-pocket_w / 2, -flare_d]
            ]);
        // half-lap slot from the bottom
        translate([up_l / 2, 0]) slot2d(slot_w, lap);
    }
}

function cb_len(sp) = sp + 2 * cb_end;

module crossbar2d(sp) {
    difference() {
        square([cb_len(sp), cb_h]);
        for (c = [cb_end, cb_end + sp])
            translate([c, cb_h]) mirror([0, 1]) slot2d(slot_w, lap);
    }
}

module crossbar_label2d(sp) {
    translate([cb_len(sp) / 2, 2])
        text(str(sp), size = label_size, font = font,
             halign = "center", valign = "baseline");
}

// 9 mm apart, or more for wide gaps, so the teeth stay at least 5.5 mm.
comb_pitch = max(9, comb_widths[comb_count - 1] + 5.5);
comb_h = 16;
comb_depth = 8;
function comb_len() = comb_pitch * (comb_count + 1);

module comb2d() {
    difference() {
        square([comb_len(), comb_h]);
        for (i = [0 : comb_count - 1])
            translate([comb_pitch * (i + 1) - comb_widths[i] / 2,
                       comb_h - comb_depth])
                square([comb_widths[i], comb_depth + eps]);
    }
}

function fmt1(v) = v == floor(v) ? str(v, ".0") : str(v);

module comb_labels2d() {
    for (i = [0 : comb_count - 1])
        translate([comb_pitch * (i + 1), 1.5])
            text(fmt1(comb_widths[i]), size = 2.4, font = font,
                 halign = "center", valign = "baseline");
}

// ---------------------------------------------------------------- layout

// cumulative x offsets for the crossbar row
function cb_x(i) = i == 0 ? 0 : cb_x(i - 1) + cb_len(spacings[i - 1]) + gap;

row_cb_y   = 0;
row_comb_y = -(comb_h + gap);
row_up_y   = cb_h + gap;

module sheet(engrave = false) {
    // uprights (top row)
    if (!engrave)
        for (i = [0 : num_uprights - 1])
            translate([i * (up_l + gap), row_up_y]) upright2d();
    // crossbars (middle row)
    for (i = [0 : len(spacings) - 1])
        translate([cb_x(i), row_cb_y])
            if (engrave) crossbar_label2d(spacings[i]);
            else crossbar2d(spacings[i]);
    // test comb (bottom row)
    if (include_comb)
        translate([0, row_comb_y])
            if (engrave) comb_labels2d(); else comb2d();
    if (registration) reg();
}

// tiny squares at the layout's extreme corners so the cut and engrave
// exports import with identical bounds (delete after aligning)
module reg() {
    w = max(num_uprights * (up_l + gap), cb_x(len(spacings)),
            include_comb ? comb_len() : 0);
    bottom = include_comb ? row_comb_y : row_cb_y;
    for (p = [[-2, bottom - 2], [w, row_up_y + up_h + 2 - 0.5]])
        translate(p) square(0.5);
}

// ---------------------------------------------------------------- 3D assembly
// Badge plane = XZ. Crossbar runs along X; uprights run along Y.

module assembly(sp) {
    T = thickness;
    // crossbar, centred on origin
    color("LightBlue", 0.6)
        translate([-cb_len(sp) / 2, T / 2, 0]) rotate([90, 0, 0])
            linear_extrude(T) crossbar2d(sp);
    // uprights
    for (x = [-sp / 2, sp / 2])
        color("LightCyan", 0.6)
            translate([x - T / 2, -up_l / 2, 0]) rotate([90, 0, 90])
                linear_extrude(T) upright2d();
    // ghost badge sitting in the pockets
    badge_w = sp + 30;
    color("SeaGreen", 0.35)
        translate([-badge_w / 2, -0.8, up_h - flare_d - pocket_d])
            cube([badge_w, 1.6, 60]);
}

// ---------------------------------------------------------------- main
if (mode == "assembly") assembly(preview_spacing);
else if (mode == "cut") sheet(false);
else if (mode == "engrave") sheet(true);
else if (mode == "comb") comb2d();
