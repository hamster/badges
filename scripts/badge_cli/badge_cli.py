#!/usr/bin/env python3
"""Terminal tool to create, edit, or duplicate a badge entry.

Covers the same fields as badge_gui/ (the browser-based equivalent) with
one deliberate exception: photos, video, and the live preview all need a
browser, so this tool can't touch them. Creating or duplicating a badge
here still makes the assets/ directory and prints next steps for adding
photos by hand; editing a badge leaves its existing images/videos exactly
as they are. See scripts/README.md for how the two tools relate, and
scripts/badge_gui/README.md if you want the photo/video workflow (which
also covers getting ffmpeg working on Windows).

Run:  python scripts/badge_cli/badge_cli.py
"""

import sys
from datetime import date
from pathlib import Path

# badge_lib.py lives one directory up, alongside badge_gui/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import badge_lib as lib


# ---------------------------------------------------------------------------
# Input helpers — each supports a `default` so editing an existing badge can
# pre-fill the current value and let Enter keep it.
# ---------------------------------------------------------------------------

def choose(label, options, allow_skip=False, default=None):
    """Single-select from a numbered list. Blank input keeps `default` if
    given, else (when allow_skip) returns "". Returns "" if skipped."""
    print(f"\n{label}:")
    for i, opt in enumerate(options, 1):
        marker = "  (current)" if opt == default else ""
        print(f"  {i}. {opt}{marker}")
    if allow_skip:
        print("  0. (skip)")
    hint = f", Enter=keep '{default}'" if default is not None else ""
    prompt = f"  [{'0-' if allow_skip else ''}1-{len(options)}{hint}]: "
    while True:
        raw = input(prompt).strip()
        if not raw and default is not None:
            return default
        if allow_skip and raw == "0":
            return ""
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  Invalid — enter a number from the list.")


def choose_multi(label, options, default=None):
    """Multi-select from a numbered list. Blank input keeps `default`
    (or means "none" if there is no default); '-' always means "none"."""
    default = default or []
    print(f"\n{label} (space-separated numbers):")
    for i, opt in enumerate(options, 1):
        marker = "  (current)" if opt in default else ""
        print(f"  {i}. {opt}{marker}")
    hint = "blank=keep current" if default else "blank=none"
    while True:
        raw = input(f"  [1-{len(options)}, {hint}, '-'=none]: ").strip()
        if not raw:
            return list(default)
        if raw == "-":
            return []
        parts = raw.split()
        if all(p.isdigit() and 1 <= int(p) <= len(options) for p in parts):
            return [options[int(p) - 1] for p in parts]
        print("  Invalid — space-separated numbers, blank, or '-'.")


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


def csv_join(items):
    return ", ".join(items or [])


def csv_split(raw):
    return [x.strip() for x in raw.split(",") if x.strip()] if raw else []


# ---------------------------------------------------------------------------
# Pick an existing badge (for edit / duplicate)
# ---------------------------------------------------------------------------

def pick_existing_badge():
    badges = lib.list_badges()
    if not badges:
        print("\nNo existing badges found in _badges/.")
        return None
    labels = [
        f"{b['title']}  ({b['con']}/{b['slug']}, {b['year']}, {b['type']}, {b['status']})"
        for b in badges
    ]
    picked_label = choose("Pick a badge", labels)
    return badges[labels.index(picked_label)]


# ---------------------------------------------------------------------------
# Field collection — shared by create / edit / duplicate. `loaded` is the
# dict from badge_lib.get_badge_fields() when editing/duplicating, else None.
# ---------------------------------------------------------------------------

def collect_fields(loaded, is_edit):
    def L(key, fallback=None):
        return (loaded or {}).get(key, fallback)

    f = {}

    # --- Core identity ---
    title = ask("\nBadge title (required)", default=L("title", ""))
    if not title:
        print("Title is required. Exiting.")
        sys.exit(1)
    f["title"] = title

    f["year"] = ask("Year", default=str(L("year") or date.today().year))
    f["con"] = choose("Convention / source", lib.CONS, default=L("con"))
    f["badge_type"] = badge_type = choose("Badge type", lib.TYPES, default=L("badge_type"))
    f["event"] = ask("Event name (e.g. 'DEF CON 32')", default=L("event", ""))
    f["edition"] = choose("Edition", lib.EDITIONS, allow_skip=True, default=L("edition") or None)

    # --- Maker info ---
    raw_makers = ask("Maker(s) — comma-separated if multiple", default=csv_join(L("makers", [])))
    f["makers"] = csv_split(raw_makers)
    f["group"] = ask("Maker group / org (e.g. 'Dual Gang')", default=L("group", ""))

    # --- Electronics ---
    if badge_type == "entry":
        has_electronics = False
    elif badge_type in ("sao", "minibadge"):
        has_electronics = True
    else:
        has_electronics = ask_yn("Does this badge have electronics?", default=bool(L("has_electronics", True)))
    f["has_electronics"] = has_electronics

    f["battery_type"] = "none"
    f["interface"] = "none"
    f["programming"] = "none"

    if has_electronics:
        f["mcu"] = ask("MCU / main chip (e.g. ESP32-S3)", default=L("mcu", ""))
        f["display"] = choose("Display type", lib.DISPLAYS, default=L("display"))

        # Power — SAOs/minibadges can draw from multiple sources. Which
        # connector-power option applies depends on which kind of device
        # this is (an SAO is powered "sao", a minibadge is powered
        # "minibadge" — both can also run on battery/usb).
        if badge_type in ("sao", "minibadge"):
            power_list = lib.SAO_POWER_SOURCES if badge_type == "sao" else lib.MINIBADGE_POWER_SOURCES
            f["power_sources"] = choose_multi("Power source(s)", power_list, default=L("power_sources", []))
            if "battery" in f["power_sources"]:
                f["battery_type"] = choose("Battery chemistry", lib.BATTERY_TYPES, default=L("battery_type"))
                if f["battery_type"] != "none":
                    f["battery_cell"] = choose("Battery cell type", lib.BATTERY_CELLS, default=L("battery_cell"))
            f["current_ma"] = ask("Input current draw in mA (or blank)", default=str(L("current_ma") or ""))
        else:
            f["battery_type"] = choose("Battery", lib.BATTERY_TYPES, default=L("battery_type"))
            if f["battery_type"] != "none":
                f["battery_cell"] = choose("Battery cell type", lib.BATTERY_CELLS, default=L("battery_cell"))

        # Device-side connector details — SAO and minibadge use different specs
        if badge_type == "sao":
            f["sao_version"] = choose("SAO connector version", lib.SAO_VERSIONS, default=L("sao_version"))
            f["sao_implements"] = choose_multi("SAO pins this device uses", lib.SAO_IMPLEMENTS, default=L("sao_implements", []))
        elif badge_type == "minibadge":
            f["minibadge_implements"] = choose_multi(
                "Minibadge spec features implemented", lib.MINIBADGE_IMPLEMENTS, default=L("minibadge_implements", [])
            )

        # Host-side ports this badge provides to plug SAOs or minibadges into
        if ask_yn("Does this badge have SAO ports?", default=bool(L("sao_port_count", 0))):
            raw = ask("  Number of SAO ports", default=str(L("sao_port_count") or 1))
            f["sao_port_count"] = int(raw) if raw.isdigit() else 1
            f["sao_port_features"] = choose_multi("  Signals provided on SAO ports", lib.SAO_PORT_FEATURES, default=L("sao_port_features", []))
            f["sao_port_power"] = choose("  Power rail on SAO ports", lib.PORT_POWER, default=L("sao_port_power"))

        if ask_yn("Does this badge have minibadge ports?", default=bool(L("mb_port_count", 0))):
            raw = ask("  Number of minibadge ports", default=str(L("mb_port_count") or 1))
            f["mb_port_count"] = int(raw) if raw.isdigit() else 1
            f["mb_port_features"] = choose_multi(
                "  Signals provided on minibadge ports", lib.MINIBADGE_PORT_FEATURES, default=L("mb_port_features", [])
            )
            f["mb_port_power"] = choose("  Power rail on minibadge ports", lib.PORT_POWER, default=L("mb_port_power"))

        f["interface"] = choose("USB interface", lib.INTERFACES, default=L("interface"))
        f["programming"] = choose("Programming interface", lib.PROGRAMMING, allow_skip=True, default=L("programming"))
        f["connectivity"] = choose_multi("Wireless / radio", lib.CONNECTIVITY, default=L("connectivity", []))
        raw_features = ask(
            "Other features — comma-separated (e.g. neopixels,speaker,buttons)",
            default=csv_join(L("features_list", [])),
        )
        f["features_list"] = csv_split(raw_features)

    f["rarity"] = choose("Rarity", lib.RARITIES, allow_skip=True, default=L("rarity") or None)
    f["status"] = choose("Status", lib.STATUSES, default=L("status") if is_edit else "stub")

    # --- Acquisition ---
    f["acq_date"] = ask("Acquisition date (YYYY-MM-DD, or blank)", default=L("acq_date", ""))
    f["acq_source"] = ask("Acquisition source (e.g. 'DEF CON badge swap')", default=L("acq_source", ""))

    # --- Links ---
    f["docs_url"] = ask("Documentation URL", default=L("docs_url", ""))
    f["source_repo"] = ask("Source / repo URL", default=L("source_repo", ""))

    # --- Sold at ---
    sold_at = [dict(e) for e in (L("sold_at", []) or [])]
    if sold_at:
        print("\nExisting 'sold at' vendors:")
        for e in sold_at:
            print(f"  - {e.get('vendor', '')}: {e.get('url', '')}")
        if not ask_yn("Keep these as-is?", default=True):
            sold_at = []
    if ask_yn("Add a 'sold at' vendor entry?", default=False):
        while True:
            vendor = ask("  Vendor name", default="")
            url = ask("  URL", default="")
            if vendor or url:
                sold_at.append({"vendor": vendor, "url": url})
            if not ask_yn("  Add another vendor?", default=False):
                break
    f["sold_at"] = sold_at

    f["purchase_url"] = ask("Primary purchase URL (or blank)", default=L("purchase_url", ""))

    # --- Notes ---
    existing_notes = L("notes")
    if is_edit and existing_notes:
        print("\nCurrent notes:\n---\n" + existing_notes + "\n---")
        if ask_yn("Keep existing notes as-is?", default=True):
            f["notes"] = existing_notes
        else:
            f["notes"] = ask("New notes (single line — edit the file directly afterward for multi-line prose)", default="")
    else:
        f["notes"] = None  # build_frontmatter falls back to the stub placeholder

    # --- Photos / video — this tool can't manage attachments; see module
    # docstring. Editing carries the existing list through untouched;
    # creating/duplicating starts empty (a duplicate is a different
    # physical item, so its photos shouldn't carry over either).
    f["images"] = L("images", []) if is_edit else []
    f["videos"] = L("videos", []) if is_edit else []

    # --- Slug ---
    slug_default = L("slug") if is_edit else lib.default_slug(title, f["year"], f["group"], f["makers"])
    f["slug"] = ask("Slug (directory name)", default=slug_default)

    return f


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 50)
    print("  Badge CLI")
    print("=" * 50)

    mode = choose(
        "What would you like to do?",
        ["Create a new badge", "Edit an existing badge", "Duplicate an existing badge"],
    )
    is_edit = mode == "Edit an existing badge"
    is_duplicate = mode == "Duplicate an existing badge"

    picked = None
    loaded = None
    if is_edit or is_duplicate:
        picked = pick_existing_badge()
        if picked is None:
            sys.exit(1)
        loaded = lib.get_badge_fields(picked["con"], picked["slug"])

    f = collect_fields(loaded, is_edit)

    original_con = picked["con"] if is_edit else None
    original_slug = picked["slug"] if is_edit else None

    try:
        badge_dir, assets_dir, _ = lib.resolve_badge_paths(f["con"], f["slug"], original_con, original_slug)
    except ValueError as e:
        print(f"\nERROR: {e}")
        sys.exit(1)

    content = lib.build_frontmatter(f)
    index_path = badge_dir / "index.md"
    index_path.write_text(content, encoding="utf-8")
    lib.ensure_gitkeep(assets_dir)

    if is_edit:
        print(f"""
Done! Badge updated.

  Data file : {index_path}
  Images dir: {assets_dir}
""")
    else:
        verb = "duplicated" if is_duplicate else "created"
        print(f"""
Done! Badge stub {verb}.

  Data file : {index_path}
  Images dir: {assets_dir}

Next steps:
  1. Copy photos into {assets_dir}/ (or use the GUI's drag-and-drop instead —
     see scripts/badge_gui/README.md)
  2. Edit {index_path} — fill in specs and add an images list:

       images:
         - filename: front.jpg
           caption: "Front of badge"
         - filename: back.jpg
           caption: "Back of badge"

  3. Replace the stub body with real notes.
  4. Set  status: complete  when done — or re-run this tool and choose
     "Edit an existing badge".
""")


if __name__ == "__main__":
    main()
