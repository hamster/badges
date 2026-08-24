#!/usr/bin/env python3
"""Stub out a new badge entry with data file and assets directory."""

import os
import re
import sys
from datetime import date
from pathlib import Path

SITE_ROOT = Path(__file__).parent.parent
BADGES_DIR = SITE_ROOT / "_badges"
ASSETS_DIR = SITE_ROOT / "assets" / "badges"

CONS = ["defcon", "saintcon", "other"]
TYPES = ["badge", "sao", "minibadge", "standalone", "other"]
BATTERIES = ["CR2032", "CR2016", "18650", "LiPo", "AAA", "AA", "USB only", "none"]
INTERFACES = ["USB-C", "micro-USB", "mini-USB", "none"]
STATUSES = ["stub", "wip", "complete"]


def choose(label, options):
    print(f"\n{label}:")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    while True:
        raw = input(f"  [1-{len(options)}]: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  Invalid — enter a number from the list.")


def ask(label, default=""):
    hint = f" [{default}]" if default else ""
    val = input(f"{label}{hint}: ").strip()
    return val if val else default


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


def main():
    print("=" * 50)
    print("  New Badge Stub Creator")
    print("=" * 50)

    title = ask("\nBadge title (required)")
    if not title:
        print("Title is required. Exiting.")
        sys.exit(1)

    year = ask("Year", default=str(date.today().year))
    con = choose("Convention / source", CONS)
    badge_type = choose("Badge type", TYPES)
    event = ask("Event name (e.g. 'DEF CON 32')", default="")
    maker = ask("Maker / group", default="")
    mcu = ask("MCU (e.g. ESP32-S3)", default="")
    battery = choose("Battery", BATTERIES)
    interface = choose("Interface", INTERFACES)
    source_repo = ask("Source repo URL", default="")

    auto_slug = slugify(f"{con}-{title}-{year}")
    slug = ask(f"Slug (directory name)", default=auto_slug)

    badge_dir = BADGES_DIR / con / slug
    assets_dir = ASSETS_DIR / con / slug

    if badge_dir.exists():
        print(f"\nERROR: Badge directory already exists: {badge_dir}")
        sys.exit(1)

    badge_dir.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    (assets_dir / ".gitkeep").touch()

    index_path = badge_dir / "index.md"
    index_path.write_text(
        f"""---
layout: badge
title: "{title}"
slug: {slug}
year: {year}
con: {con}
event: "{event}"
type: {badge_type}
maker: "{maker}"
mcu: "{mcu}"
battery: "{battery}"
interface: "{interface}"
connectivity: []
features: []
source_repo: "{source_repo}"
purchase_url: ""
images: []
status: stub
---

*Stub — add notes, specs, and photos.*
""",
        encoding="utf-8",
    )

    print(f"""
Done! Badge stub created.

  Data file : {index_path}
  Images dir: {assets_dir}

Next steps:
  1. Copy photos into {assets_dir}/
  2. Edit {index_path} — fill in specs and add images list:

       images:
         - filename: front.jpg
           caption: "Front of badge"
         - filename: back.jpg
           caption: "Back of badge"

  3. Replace the stub notes with real content.
  4. Set  status: complete  when done.
""")


if __name__ == "__main__":
    main()
