# badge_cli/

The terminal equivalent of [badge_gui/](../badge_gui/) — see [../README.md](../README.md) for how the two relate.

```bash
python scripts/badge_cli/badge_cli.py
```

## What it does

On start, choose:

1. **Create a new badge** — prompts through every field (type-dependent sections branch the same way the GUI's form does: SAO vs. minibadge device fields, host SAO/minibadge ports, electronics skipped entirely for `entry`-type badges), then writes `_badges/{con}/{slug}/index.md` and creates `assets/badges/{con}/{slug}/`.
2. **Edit an existing badge** — pick one from a numbered list, and every prompt shows and defaults to its current value (blank Enter keeps it). Renaming the convention or slug moves the directory, same as the GUI. Its existing notes and "sold at" vendors are shown and can be kept as-is with a single Enter.
3. **Duplicate an existing badge** — same prompts pre-filled from the source badge, but always creates a new entry with a fresh slug (recomputed once you change the title), and never touches the original.

Every known-option prompt is a numbered list; typing a value that isn't shown isn't possible here the way the GUI's "+ Add new…" allows — instead, add it to the relevant list in [`../badge_lib.py`](../badge_lib.py) once, and it's available in both tools from then on. (Also: a value the GUI adds and you save is automatically picked up here next run, since both tools scan the same `_badges/` checkout for what's already in use.)

## What it can't do

Same fields, same output format as the GUI, with one deliberate gap: **photos, video, and the live preview all need a browser**, so this tool doesn't touch any of them.

- Creating or duplicating a badge here leaves `images: []` / `videos: []` — copy photos into the printed assets directory and add an `images:` list by hand afterward (the printed next-steps show the shape), or open the GUI for drag-and-drop instead.
- Editing a badge leaves its existing `images:`/`videos:` list exactly as they are — this tool has no way to add, remove, reorder, or highlight them. Use the GUI for that.
- There's no rendered preview — the frontmatter is written directly. If you want to see the actual page before committing, `bundle exec jekyll serve` (see the root [README](../../README.md)) or open the GUI, which can load an existing badge (including one this tool just wrote) and show it without changing anything.
