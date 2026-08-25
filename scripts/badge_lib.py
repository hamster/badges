"""Shared option lists, YAML formatting, and frontmatter parsing for badge
entries. Used by both badge_cli/ (terminal) and badge_gui/ (local web app)
so there is exactly one place that knows what a badge index.md looks like.
See scripts/README.md for which tool is which.
"""

import re
import shutil
from collections import defaultdict
from pathlib import Path

SITE_ROOT = Path(__file__).parent.parent
BADGES_DIR = SITE_ROOT / "_badges"
ASSETS_DIR = SITE_ROOT / "assets" / "badges"

# --- Option lists: add new values here as needed ---

CONS = ["defcon", "saintcon", "dc503", "queercon", "layerone", "toorcon", "other"]

TYPES = ["badge", "sao", "minibadge", "standalone", "entry", "other"]

EDITIONS = [
    "regular", "limited", "press", "speaker", "staff",
    "volunteer", "prototype", "artist", "other",
]

DISPLAYS = ["none", "oled", "eink", "lcd", "led-matrix", "7seg", "neopixel-matrix", "other"]

BATTERY_TYPES = ["none", "rechargeable", "non-rechargeable"]

BATTERY_CELLS = ["CR2032", "CR2016", "18650", "LiPo", "AA", "AAA", "9V", "other"]

# Power sources a device can draw from. "sao"/"minibadge" mean "powered
# through the connector itself" — which one applies depends on which kind
# of device it is, hence the two connector-specific subsets below.
POWER_SOURCES = ["battery", "usb", "sao", "minibadge"]
SAO_POWER_SOURCES = ["battery", "usb", "sao"]
MINIBADGE_POWER_SOURCES = ["battery", "usb", "minibadge"]

SAO_VERSIONS = ["SAOv1", "SAOv2", "SAOv3"]

# Pins/features an SAO device itself uses (as a peripheral on the connector)
SAO_IMPLEMENTS = ["i2c", "gpio1", "gpio2", "3v3"]

# Signals a minibadge device implements from the SAINTCON minibadge spec
MINIBADGE_IMPLEMENTS = ["i2c", "clk", "gpio", "3v3"]

# Signals a host badge provides on its SAO/minibadge ports, aside from power
# itself — the rail voltage already has its own dedicated field below, so
# it isn't repeated here.
SAO_PORT_FEATURES = ["i2c", "gpio"]
MINIBADGE_PORT_FEATURES = ["i2c", "clk", "gpio"]

# Voltage level of the power rail on host ports
PORT_POWER = ["3v3", "vbatt", "5v"]

INTERFACES = ["none", "USB-C", "micro-USB", "mini-USB"]

PROGRAMMING = ["none", "JTAG", "SWD", "UART", "USB-DFU", "other"]

CONNECTIVITY = ["wifi", "bluetooth", "ir", "nfc", "lora", "zigbee", "rf", "other"]

RARITIES = ["unknown", "limited", "small-run", "mass-produced"]

STATUSES = ["stub", "wip", "complete"]

# Static option lists keyed by the name used in scan_known_values()'s output —
# used to merge "known good" defaults with whatever values are actually in
# use across the collection.
_STATIC_DEFAULTS = {
    "con": CONS,
    "type": TYPES,
    "edition": EDITIONS,
    "display": DISPLAYS,
    "battery_type": BATTERY_TYPES,
    "battery_cell": BATTERY_CELLS,
    "power_sources": POWER_SOURCES,
    "sao_version": SAO_VERSIONS,
    "sao_implements": SAO_IMPLEMENTS,
    "minibadge_implements": MINIBADGE_IMPLEMENTS,
    "sao_port_features": SAO_PORT_FEATURES,
    "minibadge_port_features": MINIBADGE_PORT_FEATURES,
    "port_power": PORT_POWER,
    "interface": INTERFACES,
    "programming": PROGRAMMING,
    "connectivity": CONNECTIVITY,
    "rarity": RARITIES,
    "status": STATUSES,
}

# Facets that only ever come from what's actually been used — no curated
# static list (free-form by nature).
_SCANNED_ONLY_KEYS = ("makers", "group", "mcu", "features")


# ---------------------------------------------------------------------------
# YAML formatting helpers
# ---------------------------------------------------------------------------

def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


def default_slug(title, year, group=None, makers=None):
    """The repo's actual slug convention (see any existing _badges/*/*/
    index.md): {group-or-creator}-{title}-{year}. `con` is deliberately not
    part of it since con is already the parent directory."""
    creator = (group or "").strip()
    if not creator and makers:
        creator = (makers[0] or "").strip()
    parts = [p for p in (creator, title, str(year or "")) if p]
    return slugify("-".join(parts))


def resolve_badge_paths(con, slug, original_con=None, original_slug=None):
    """Figure out (and make ready) the on-disk directories for a badge
    that's being created or saved-in-place. If `original_con`/`original_slug`
    are given, this is an edit: the original directories are moved into
    place if the location changed (a con/slug rename), or left as-is
    otherwise. Used by both badge_cli and badge_gui so "create vs. rename
    vs. overwrite-in-place" behaves identically from either tool.

    Returns (badge_dir, assets_dir, is_edit). Raises ValueError if the
    original badge is missing, or if the target location is already taken
    by something else.
    """
    badge_dir = BADGES_DIR / con / slug
    assets_dir = ASSETS_DIR / con / slug
    is_edit = bool(original_con and original_slug)

    if is_edit:
        orig_badge_dir = BADGES_DIR / original_con / original_slug
        orig_assets_dir = ASSETS_DIR / original_con / original_slug
        if not orig_badge_dir.is_dir():
            raise ValueError(f"Original badge not found: {orig_badge_dir}")

        if (original_con, original_slug) != (con, slug):
            if badge_dir.exists():
                raise ValueError(f"Target badge directory already exists: {badge_dir}")
            badge_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(orig_badge_dir), str(badge_dir))
            assets_dir.parent.mkdir(parents=True, exist_ok=True)
            if orig_assets_dir.is_dir():
                shutil.move(str(orig_assets_dir), str(assets_dir))
            else:
                assets_dir.mkdir(parents=True)
    else:
        if badge_dir.exists():
            raise ValueError(f"Badge directory already exists: {badge_dir}")
        badge_dir.mkdir(parents=True)
        assets_dir.mkdir(parents=True)

    return badge_dir, assets_dir, is_edit


def ensure_gitkeep(assets_dir):
    """Add/remove assets_dir/.gitkeep so the directory tracks in git iff it
    would otherwise be empty. Shared tidy-up after writing/removing media."""
    gitkeep = assets_dir / ".gitkeep"
    has_other_files = any(p.name != ".gitkeep" for p in assets_dir.iterdir())
    if not has_other_files:
        gitkeep.touch()
    elif gitkeep.exists():
        gitkeep.unlink()


def qs(val):
    """Quote a value as a YAML string."""
    return f'"{val}"'


def yaml_list(items):
    """Format a list of bare (unquoted) values as inline YAML."""
    if not items:
        return "[]"
    return "[" + ", ".join(items) + "]"


def yaml_str_list(items):
    """Format a list of quoted string values as inline YAML."""
    if not items:
        return "[]"
    return "[" + ", ".join(f'"{i}"' for i in items) + "]"


def yaml_block_list(items, indent=2):
    """Format a list as YAML block sequence."""
    if not items:
        return "[]"
    pad = " " * indent
    return "\n" + "\n".join(f"{pad}- {qs(item)}" for item in items)


def yaml_sold_at(entries, indent=2):
    """Format sold_at list as YAML block sequence of mappings."""
    if not entries:
        return "[]"
    pad = " " * indent
    lines = []
    for e in entries:
        lines.append(f"{pad}- vendor: {qs(e['vendor'])}")
        lines.append(f"{pad}  url: {qs(e['url'])}")
    return "\n" + "\n".join(lines)


def yaml_media_block(items, indent=2):
    """Format a list of {filename, caption, highlight} mappings as a YAML
    block sequence — shared by images: and videos:. `highlight` is sparse:
    the line is only written for the one item that has it, since at most
    one image or video across both lists is ever the highlight."""
    if not items:
        return "[]"
    pad = " " * indent
    lines = []
    for item in items:
        lines.append(f"{pad}- filename: {qs(item['filename'])}")
        lines.append(f"{pad}  caption: {qs(item.get('caption') or '')}")
        if item.get("highlight"):
            lines.append(f"{pad}  highlight: true")
    return "\n" + "\n".join(lines)


# ---------------------------------------------------------------------------
# Frontmatter builder — the single source of truth for badge index.md files
# ---------------------------------------------------------------------------

def build_frontmatter(f):
    """Build a full badge index.md (frontmatter + body) from a dict of
    fields. `f` uses the same field names the CLI (badge_cli.py) collects,
    so both it and badge_gui produce byte-identical output for the
    same inputs.
    """
    makers = f.get("makers") or []
    makers_yaml = yaml_block_list(makers) if len(makers) != 1 else yaml_str_list(makers)

    badge_type = f.get("badge_type", "")

    sao_block = ""
    if badge_type == "sao":
        sao_block = (
            f"sao:\n"
            f"  version: {qs(f.get('sao_version', ''))}\n"
            f"  implements: {yaml_list(f.get('sao_implements', []))}\n"
        )

    minibadge_block = ""
    if badge_type == "minibadge":
        minibadge_block = (
            f"minibadge:\n"
            f"  implements: {yaml_list(f.get('minibadge_implements', []))}\n"
        )

    sao_port_count = int(f.get("sao_port_count") or 0)
    sao_ports_block = ""
    if sao_port_count > 0:
        sao_ports_block = (
            f"sao_ports:\n"
            f"  count: {sao_port_count}\n"
            f"  implements: {yaml_list(f.get('sao_port_features', []))}\n"
            f"  power: {f.get('sao_port_power', '')}\n"
        )

    mb_port_count = int(f.get("mb_port_count") or 0)
    mb_ports_block = ""
    if mb_port_count > 0:
        mb_ports_block = (
            f"minibadge_ports:\n"
            f"  count: {mb_port_count}\n"
            f"  implements: {yaml_list(f.get('mb_port_features', []))}\n"
            f"  power: {f.get('mb_port_power', '')}\n"
        )

    sold_at_yaml = yaml_sold_at(f.get("sold_at", []))
    images_yaml = yaml_media_block(f.get("images", []))
    videos_yaml = yaml_media_block(f.get("videos", []))
    current_ma = f.get("current_ma") or ""
    # Leave the body empty rather than writing placeholder boilerplate —
    # "*Stub — add notes…*" is shown as a hint (textarea placeholder / empty
    # -state message) but should never itself land in a saved badge file.
    notes = f.get("notes") or ""

    return f"""---
layout: badge
title: {qs(f.get('title', ''))}
slug: {f.get('slug', '')}
year: {f.get('year', '')}
con: {f.get('con', '')}
event: {qs(f.get('event', ''))}
type: {badge_type}
edition: {qs(f.get('edition', ''))}
makers: {makers_yaml}
group: {qs(f.get('group', ''))}
electronics: {str(bool(f.get('has_electronics', False))).lower()}
mcu: {qs(f.get('mcu', ''))}
display: {qs(f.get('display', ''))}
power:
  sources: {yaml_list(f.get('power_sources', []))}
  battery: {f.get('battery_type', 'none')}
  battery_cell: {qs(f.get('battery_cell', ''))}
  current_ma: {current_ma if current_ma else "null"}
{sao_block}{minibadge_block}{sao_ports_block}{mb_ports_block}interface: {f.get('interface', 'none')}
programming: {f.get('programming', 'none')}
connectivity: {yaml_list(f.get('connectivity', []))}
features: {yaml_str_list(f.get('features_list', []))}
rarity: {qs(f.get('rarity', ''))}
acquisition:
  date: {qs(f.get('acq_date', ''))}
  source: {qs(f.get('acq_source', ''))}
docs_url: {qs(f.get('docs_url', ''))}
source_repo: {qs(f.get('source_repo', ''))}
sold_at: {sold_at_yaml}
purchase_url: {qs(f.get('purchase_url', ''))}
images: {images_yaml}
videos: {videos_yaml}
status: {f.get('status', 'stub')}
---

{notes}
"""


# ---------------------------------------------------------------------------
# Minimal frontmatter parser — only as capable as build_frontmatter()'s own
# output. NOT a general YAML parser: handles top-level scalars/inline lists,
# one level of block sequences (of scalars or of {key: value} mappings), and
# one level of nested mappings (power:, sao:, minibadge:, sao_ports:,
# minibadge_ports:, acquisition:).
# ---------------------------------------------------------------------------

def _strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        return s[1:-1]
    return s


def _parse_inline_list(s):
    inner = s.strip()[1:-1].strip()
    if not inner:
        return []
    return [_strip_quotes(p) for p in inner.split(",")]


def _parse_mapping_sequence(block_lines):
    """Parse a block sequence of flat {key: value} mappings, e.g.:
        - filename: "front.jpg"
          caption: "Front of badge"
    Returns a list of dicts."""
    items = []
    current = None
    for line in block_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("- "):
            if current is not None:
                items.append(current)
            current = {}
            stripped = stripped[2:]
        if current is None:
            continue
        m = re.match(r"^(\w+):\s*(.*)$", stripped)
        if m:
            current[m.group(1)] = _strip_quotes(m.group(2))
    if current is not None:
        items.append(current)
    return items


def _collect_indented_block(lines, start):
    """Collect contiguous lines more indented than their parent key,
    dedented by the block's own base indent. Returns (block_lines, count)."""
    block = []
    j = start
    base_indent = None
    while j < len(lines):
        line = lines[j]
        if not line.strip():
            j += 1
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            break
        if base_indent is None:
            base_indent = indent
        if indent < base_indent:
            break
        block.append(line[base_indent:])
        j += 1
    return block, j - start


def parse_frontmatter(text):
    """Parse a frontmatter YAML block (no `---` delimiters) into a flat dict.
    Nested mapping keys are dotted, e.g. `power.battery`."""
    lines = text.splitlines()
    result = {}
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if not line.strip() or line.strip().startswith("#"):
            i += 1
            continue
        m = re.match(r"^(\w[\w.]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2).strip()

        if rest in ("", "{}"):
            block, consumed = _collect_indented_block(lines, i + 1)
            i += 1 + consumed
            if not block:
                result[key] = ""
                continue
            first = block[0].strip()
            if first.startswith("- "):
                item_body = first[2:].strip()
                if ":" in item_body and not item_body.startswith(('"', "'")):
                    # Block sequence of mappings, e.g. images:/sold_at:
                    result[key] = _parse_mapping_sequence(block)
                else:
                    result[key] = [
                        _strip_quotes(bl.strip()[2:])
                        for bl in block
                        if bl.strip().startswith("- ")
                    ]
            else:
                nested = parse_frontmatter("\n".join(block))
                for nk, nv in nested.items():
                    result[f"{key}.{nk}"] = nv
            continue

        if rest.startswith("["):
            result[key] = _parse_inline_list(rest)
        else:
            result[key] = _strip_quotes(rest)
        i += 1
    return result


def extract_frontmatter_block(text):
    """Return the raw YAML text between the leading `---` fences, or None."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Scan the local checkout for values already in use
# ---------------------------------------------------------------------------

def scan_known_values(badges_dir=None):
    """Walk _badges/**/index.md and merge the values actually in use with
    the curated static option lists above, so the admin UI always offers at
    least the defaults plus anything already used (including past custom
    entries)."""
    badges_dir = Path(badges_dir) if badges_dir else BADGES_DIR
    scanned = defaultdict(set)

    for index_path in sorted(badges_dir.glob("*/*/index.md")):
        try:
            text = index_path.read_text(encoding="utf-8")
        except OSError:
            continue
        fm_text = extract_frontmatter_block(text)
        if fm_text is None:
            continue
        data = parse_frontmatter(fm_text)
        _accumulate(scanned, data)

    out = {}
    for key, defaults in _STATIC_DEFAULTS.items():
        combined = list(defaults)
        for v in sorted(scanned.get(key, [])):
            if v not in combined:
                combined.append(v)
        out[key] = combined
    for key in _SCANNED_ONLY_KEYS:
        out[key] = sorted(scanned.get(key, []))
    return out


def _accumulate(scanned, data):
    def add(key, val):
        if val is None:
            return
        if isinstance(val, list):
            for v in val:
                if v:
                    scanned[key].add(v)
        elif val:
            scanned[key].add(val)

    add("con", data.get("con"))
    add("type", data.get("type"))
    add("edition", data.get("edition"))
    add("makers", data.get("makers"))
    add("group", data.get("group"))
    add("mcu", data.get("mcu"))
    add("display", data.get("display"))
    add("battery_type", data.get("power.battery"))
    add("battery_cell", data.get("power.battery_cell"))
    add("power_sources", data.get("power.sources"))
    add("sao_version", data.get("sao.version"))
    add("sao_implements", data.get("sao.implements"))
    add("minibadge_implements", data.get("minibadge.implements"))
    add("sao_port_features", data.get("sao_ports.implements"))
    add("minibadge_port_features", data.get("minibadge_ports.implements"))
    add("port_power", data.get("sao_ports.power"))
    add("port_power", data.get("minibadge_ports.power"))
    add("interface", data.get("interface"))
    add("programming", data.get("programming"))
    add("connectivity", data.get("connectivity"))
    add("features", data.get("features"))
    add("rarity", data.get("rarity"))
    add("status", data.get("status"))


# ---------------------------------------------------------------------------
# Browse / edit / duplicate — reading a badge (or all of them) back out
# ---------------------------------------------------------------------------

def _as_list(v):
    if isinstance(v, list):
        return v
    return [v] if v else []


def _normalize_media_list(items):
    """Clean up a parsed images/videos list for consumption by the admin
    app: guarantee filename/caption are present, and turn `highlight` into
    a real bool (the raw frontmatter parser hands back YAML scalars as
    plain strings, e.g. the literal string "true")."""
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if not isinstance(item, dict) or not item.get("filename"):
            continue
        out.append({
            "filename": item["filename"],
            "caption": item.get("caption") or "",
            "highlight": str(item.get("highlight", "")).lower() == "true",
        })
    return out


def list_badges(badges_dir=None):
    """Summary info for every badge on disk, for badge_gui's browse
    picker: enough to render a row and to fetch the full record on demand."""
    badges_dir = Path(badges_dir) if badges_dir else BADGES_DIR
    out = []
    for index_path in sorted(badges_dir.glob("*/*/index.md")):
        con = index_path.parent.parent.name
        slug = index_path.parent.name
        try:
            text = index_path.read_text(encoding="utf-8")
        except OSError:
            continue
        fm_text = extract_frontmatter_block(text)
        if fm_text is None:
            continue
        data = parse_frontmatter(fm_text)

        images = _normalize_media_list(data.get("images"))
        thumb_source = next((i for i in images if i["highlight"]), None) or (images[0] if images else None)
        thumbnail_url = f"/assets/badges/{con}/{slug}/{thumb_source['filename']}" if thumb_source else None

        out.append({
            "con": con,
            "slug": slug,
            "title": data.get("title") or slug,
            "year": data.get("year") or "",
            "type": data.get("type") or "",
            "group": data.get("group") or "",
            "makers": _as_list(data.get("makers")),
            "status": data.get("status") or "",
            "thumbnail_url": thumbnail_url,
        })
    out.sort(key=lambda b: (b["con"], b["title"].lower()))
    return out


def get_badge_fields(con, slug, badges_dir=None):
    """Read one badge's index.md back into the same field-name shape the
    badge_gui's form (and build_frontmatter) use, for editing or
    duplicating. Returns None if the badge doesn't exist."""
    badges_dir = Path(badges_dir) if badges_dir else BADGES_DIR
    index_path = badges_dir / con / slug / "index.md"
    if not index_path.is_file():
        return None

    text = index_path.read_text(encoding="utf-8")
    fm_text = extract_frontmatter_block(text) or ""
    data = parse_frontmatter(fm_text)

    body_match = re.match(r"^---\s*\n.*?\n---\s*\n?(.*)$", text, re.DOTALL)
    notes = body_match.group(1).strip() if body_match else ""

    current_ma = data.get("power.current_ma")
    if current_ma in (None, "", "null"):
        current_ma = ""

    images = _normalize_media_list(data.get("images"))
    videos = _normalize_media_list(data.get("videos"))
    sold_at = data.get("sold_at")

    return {
        "title": data.get("title", ""),
        "slug": slug,
        "con": con,
        "year": data.get("year", ""),
        "event": data.get("event", ""),
        "badge_type": data.get("type", ""),
        "edition": data.get("edition", ""),
        "makers": _as_list(data.get("makers")),
        "group": data.get("group", ""),
        "has_electronics": str(data.get("electronics", "")).lower() == "true",
        "mcu": data.get("mcu", ""),
        "display": data.get("display", ""),
        "power_sources": _as_list(data.get("power.sources")),
        "battery_type": data.get("power.battery", "none"),
        "battery_cell": data.get("power.battery_cell", ""),
        "current_ma": current_ma,
        "sao_version": data.get("sao.version", ""),
        "sao_implements": _as_list(data.get("sao.implements")),
        "minibadge_implements": _as_list(data.get("minibadge.implements")),
        "sao_port_count": int(data.get("sao_ports.count") or 0),
        "sao_port_features": _as_list(data.get("sao_ports.implements")),
        "sao_port_power": data.get("sao_ports.power", ""),
        "mb_port_count": int(data.get("minibadge_ports.count") or 0),
        "mb_port_features": _as_list(data.get("minibadge_ports.implements")),
        "mb_port_power": data.get("minibadge_ports.power", ""),
        "interface": data.get("interface", "none"),
        "programming": data.get("programming", "none"),
        "connectivity": _as_list(data.get("connectivity")),
        "features_list": _as_list(data.get("features")),
        "rarity": data.get("rarity", ""),
        "acq_date": data.get("acquisition.date", ""),
        "acq_source": data.get("acquisition.source", ""),
        "docs_url": data.get("docs_url", ""),
        "source_repo": data.get("source_repo", ""),
        "sold_at": sold_at if isinstance(sold_at, list) else [],
        "purchase_url": data.get("purchase_url", ""),
        "status": data.get("status", "stub"),
        "notes": notes,
        "images": images,
        "videos": videos,
    }
