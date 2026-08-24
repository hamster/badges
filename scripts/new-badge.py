#!/usr/bin/env python3
"""Stub out a new badge entry with data file and assets directory."""

import re
import sys
from datetime import date
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

POWER_SOURCES = ["battery", "usb", "sao"]

SAO_VERSIONS = ["SAOv1", "SAOv2", "SAOv3"]

# Pins/features an SAO device itself uses (as a peripheral on the connector)
SAO_IMPLEMENTS = ["i2c", "gpio1", "gpio2", "3v3"]

# Signals a minibadge device implements from the SAINTCON minibadge spec
MINIBADGE_IMPLEMENTS = ["i2c", "clk", "gpio", "3v3"]

# Signals a host badge provides on its SAO ports
SAO_PORT_FEATURES = ["i2c", "gpio", "3v3"]

# Signals a host badge provides on its minibadge ports
MINIBADGE_PORT_FEATURES = ["i2c", "clk", "gpio", "3v3"]

# Voltage level of the power rail on host ports
PORT_POWER = ["3v3", "vbat", "5v"]

INTERFACES = ["none", "USB-C", "micro-USB", "mini-USB"]

PROGRAMMING = ["none", "JTAG", "SWD", "UART", "USB-DFU", "other"]

CONNECTIVITY = ["wifi", "bluetooth", "ir", "nfc", "lora", "zigbee", "rf", "other"]

RARITIES = ["unknown", "limited", "small-run", "mass-produced"]

STATUSES = ["stub", "wip", "complete"]


# ---------------------------------------------------------------------------
# Input helpers
# ---------------------------------------------------------------------------

def choose(label, options, allow_skip=False):
    """Single-select from a numbered list. Returns empty string if skipped."""
    print(f"\n{label}:")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    if allow_skip:
        print(f"  0. (skip)")
    prompt = f"  [{'0-' if allow_skip else ''}1-{len(options)}]: "
    while True:
        raw = input(prompt).strip()
        if allow_skip and raw == "0":
            return ""
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  Invalid — enter a number from the list.")


def choose_multi(label, options):
    """Multi-select from a numbered list. Returns list of selected values."""
    print(f"\n{label} (space-separated numbers, blank for none):")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    while True:
        raw = input(f"  [1-{len(options)}]: ").strip()
        if not raw:
            return []
        parts = raw.split()
        if all(p.isdigit() and 1 <= int(p) <= len(options) for p in parts):
            return [options[int(p) - 1] for p in parts]
        print("  Invalid — space-separated numbers only, or blank for none.")


def ask(label, default=""):
    """Free-text input with optional default."""
    hint = f" [{default}]" if default else ""
    val = input(f"{label}{hint}: ").strip()
    return val if val else default


def ask_yn(label, default=True):
    """Yes/no prompt. Returns bool."""
    hint = " [Y/n]" if default else " [y/N]"
    val = input(f"{label}{hint}: ").strip().lower()
    if not val:
        return default
    return val in ("y", "yes")


# ---------------------------------------------------------------------------
# YAML formatting helpers
# ---------------------------------------------------------------------------

def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 50)
    print("  New Badge Stub Creator")
    print("=" * 50)

    # --- Core identity ---
    title = ask("\nBadge title (required)")
    if not title:
        print("Title is required. Exiting.")
        sys.exit(1)

    year = ask("Year", default=str(date.today().year))
    con = choose("Convention / source", CONS)
    badge_type = choose("Badge type", TYPES)
    event = ask("Event name (e.g. 'DEF CON 32')", default="")
    edition = choose("Edition", EDITIONS, allow_skip=True)

    # --- Maker info ---
    raw_makers = ask("Maker(s) — comma-separated if multiple", default="")
    makers = [m.strip() for m in raw_makers.split(",") if m.strip()] if raw_makers else []
    group = ask("Maker group / org (e.g. 'Dual Gang')", default="")

    # --- Electronics ---
    if badge_type == "entry":
        has_electronics = False
    elif badge_type in ("sao", "minibadge"):
        has_electronics = True
    else:
        has_electronics = ask_yn("Does this badge have electronics?", default=True)

    mcu = ""
    display = ""
    battery_type = "none"
    battery_cell = ""
    power_sources = []
    current_ma = ""
    interface = "none"
    programming = "none"
    connectivity = []
    features_list = []

    # SAO device fields
    sao_version = ""
    sao_implements = []

    # Minibadge device fields
    minibadge_implements = []

    # Host-side port fields
    sao_port_count = 0
    sao_port_features = []
    sao_port_power = ""
    mb_port_count = 0
    mb_port_features = []
    mb_port_power = ""

    if has_electronics:
        mcu = ask("MCU / main chip (e.g. ESP32-S3)", default="")
        display = choose("Display type", DISPLAYS)

        # Power — SAOs/minibadges can draw from multiple sources
        if badge_type in ("sao", "minibadge"):
            power_sources = choose_multi("Power source(s)", POWER_SOURCES)
            if "battery" in power_sources:
                battery_type = choose("Battery chemistry", BATTERY_TYPES)
                if battery_type != "none":
                    battery_cell = choose("Battery cell type", BATTERY_CELLS)
            raw_ma = ask("Input current draw in mA (or blank)", default="")
            current_ma = raw_ma
        else:
            battery_type = choose("Battery", BATTERY_TYPES)
            if battery_type != "none":
                battery_cell = choose("Battery cell type", BATTERY_CELLS)

        # Device-side connector details — SAO and minibadge use different specs
        if badge_type == "sao":
            sao_version = choose("SAO connector version", SAO_VERSIONS)
            sao_implements = choose_multi("SAO pins this device uses", SAO_IMPLEMENTS)
        elif badge_type == "minibadge":
            minibadge_implements = choose_multi(
                "Minibadge spec features implemented", MINIBADGE_IMPLEMENTS
            )

        # Host-side ports this badge provides to plug SAOs or minibadges into
        if ask_yn("Does this badge have SAO ports?", default=False):
            raw = ask("  Number of SAO ports", default="1")
            sao_port_count = int(raw) if raw.isdigit() else 1
            sao_port_features = choose_multi("  Signals provided on SAO ports", SAO_PORT_FEATURES)
            sao_port_power = choose("  Power rail on SAO ports", PORT_POWER)

        if ask_yn("Does this badge have minibadge ports?", default=False):
            raw = ask("  Number of minibadge ports", default="1")
            mb_port_count = int(raw) if raw.isdigit() else 1
            mb_port_features = choose_multi(
                "  Signals provided on minibadge ports", MINIBADGE_PORT_FEATURES
            )
            mb_port_power = choose("  Power rail on minibadge ports", PORT_POWER)

        interface = choose("USB interface", INTERFACES)
        programming = choose("Programming interface", PROGRAMMING, allow_skip=True)
        connectivity = choose_multi("Wireless / radio", CONNECTIVITY)
        raw_features = ask(
            "Other features — comma-separated (e.g. neopixels,speaker,buttons)", default=""
        )
        features_list = (
            [f.strip() for f in raw_features.split(",") if f.strip()] if raw_features else []
        )

    rarity = choose("Rarity", RARITIES, allow_skip=True)

    # --- Acquisition ---
    acq_date = ask("Acquisition date (YYYY-MM-DD, or blank)", default="")
    acq_source = ask("Acquisition source (e.g. 'DEF CON badge swap')", default="")

    # --- Links ---
    docs_url = ask("Documentation URL", default="")
    source_repo = ask("Source / repo URL", default="")

    # --- Sold at ---
    sold_at = []
    if ask_yn("Add a 'sold at' vendor entry?", default=False):
        while True:
            vendor = ask("  Vendor name", default="")
            url = ask("  URL", default="")
            if vendor or url:
                sold_at.append({"vendor": vendor, "url": url})
            if not ask_yn("  Add another vendor?", default=False):
                break

    purchase_url = ask("Primary purchase URL (or blank)", default="")

    # --- Slug ---
    auto_slug = slugify(f"{con}-{title}-{year}")
    slug = ask("Slug (directory name)", default=auto_slug)

    badge_dir = BADGES_DIR / con / slug
    assets_dir = ASSETS_DIR / con / slug

    if badge_dir.exists():
        print(f"\nERROR: Badge directory already exists: {badge_dir}")
        sys.exit(1)

    badge_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    (assets_dir / ".gitkeep").touch()

    # --- Build conditional frontmatter blocks ---
    makers_yaml = yaml_block_list(makers) if len(makers) != 1 else yaml_str_list(makers)

    # Emit device-side connector block only for the relevant type
    sao_block = ""
    if badge_type == "sao":
        sao_block = (
            f"sao:\n"
            f"  version: {qs(sao_version)}\n"
            f"  implements: {yaml_list(sao_implements)}\n"
        )

    minibadge_block = ""
    if badge_type == "minibadge":
        minibadge_block = (
            f"minibadge:\n"
            f"  implements: {yaml_list(minibadge_implements)}\n"
        )

    # Emit host port blocks only when ports are present
    sao_ports_block = ""
    if sao_port_count > 0:
        sao_ports_block = (
            f"sao_ports:\n"
            f"  count: {sao_port_count}\n"
            f"  implements: {yaml_list(sao_port_features)}\n"
            f"  power: {sao_port_power}\n"
        )

    mb_ports_block = ""
    if mb_port_count > 0:
        mb_ports_block = (
            f"minibadge_ports:\n"
            f"  count: {mb_port_count}\n"
            f"  implements: {yaml_list(mb_port_features)}\n"
            f"  power: {mb_port_power}\n"
        )

    sold_at_yaml = yaml_sold_at(sold_at)

    content = f"""---
layout: badge
title: {qs(title)}
slug: {slug}
year: {year}
con: {con}
event: {qs(event)}
type: {badge_type}
edition: {qs(edition)}
makers: {makers_yaml}
group: {qs(group)}
electronics: {str(has_electronics).lower()}
mcu: {qs(mcu)}
display: {qs(display)}
power:
  sources: {yaml_list(power_sources)}
  battery: {battery_type}
  battery_cell: {qs(battery_cell)}
  current_ma: {current_ma if current_ma else "null"}
{sao_block}{minibadge_block}{sao_ports_block}{mb_ports_block}interface: {interface}
programming: {programming}
connectivity: {yaml_list(connectivity)}
features: {yaml_str_list(features_list)}
rarity: {qs(rarity)}
acquisition:
  date: {qs(acq_date)}
  source: {qs(acq_source)}
docs_url: {qs(docs_url)}
source_repo: {qs(source_repo)}
sold_at: {sold_at_yaml}
purchase_url: {qs(purchase_url)}
images: []
status: stub
---

*Stub — add notes, specs, and photos.*
"""

    index_path = badge_dir / "index.md"
    index_path.write_text(content, encoding="utf-8")

    print(f"""
Done! Badge stub created.

  Data file : {index_path}
  Images dir: {assets_dir}

Next steps:
  1. Copy photos into {assets_dir}/
  2. Edit {index_path} — fill in specs and add an images list:

       images:
         - filename: front.jpg
           caption: "Front of badge"
         - filename: back.jpg
           caption: "Back of badge"

  3. Replace the stub body with real notes.
  4. Set  status: complete  when done.
""")


if __name__ == "__main__":
    main()
