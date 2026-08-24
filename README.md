# The Hamster Badge Museum

A personal catalog of electronic conference badges — DEF CON, SAINTCON, and beyond — with photos, specs, and source links. Built with Jekyll and hosted on GitHub Pages at **https://hamster.github.io/badges**.

---

## Tech stack

- **Jekyll 4** static site generator
- **GitHub Pages** hosting via GitHub Actions
- **No build-time dependencies** beyond the Gemfile — pure Jekyll collections, Liquid templates, and vanilla JS

---

## Local development

```bash
bundle install
bundle exec jekyll serve --livereload
```

The site will be available at `http://localhost:4000/badges/`.

---

## Project structure

```
_badges/            Badge content, organized by con then slug
  defcon/
    dc32-2024/
      index.md      Badge frontmatter + notes (Markdown)

assets/
  badges/           Badge photos, organized to match _badges/
    defcon/
      dc32-2024/
        front.jpg
        back.jpg

_layouts/
  default.html      Site chrome / nav
  badge.html        Individual badge detail page
  category.html     Category listing (Badges, SAOs, etc.)

_includes/
  badge-card.html   Reusable badge card for grid views

_template/
  index.md          Blank badge template — copy this when adding manually

scripts/
  new-badge.py      Interactive CLI to scaffold a new badge entry

badge/              Category landing page — type: badge
sao/                Category landing page — type: sao
minibadge/          Category landing page — type: minibadge
other/              Category landing page — type: other
```

---

## Adding a badge

### Option A — use the script (recommended)

```bash
python scripts/new-badge.py
```

The script prompts for all fields, creates `_badges/{con}/{slug}/index.md`, and makes the `assets/badges/{con}/{slug}/` directory.

### Option B — copy the template manually

```bash
cp -r _template _badges/{con}/{slug}
mkdir -p assets/badges/{con}/{slug}
```

Then edit `_badges/{con}/{slug}/index.md` with the badge details.

---

## Editing a badge

Open `_badges/{con}/{slug}/index.md`. All metadata is in the YAML frontmatter at the top; prose notes go below the `---` separator. Markdown is fully supported in the notes body.

Change `status: stub` → `status: wip` as you fill things in, and `status: complete` when photos and specs are done.

---

## Frontmatter field reference

Fields are all optional except `title`, `slug`, `year`, `con`, and `type`. The layout gracefully skips any field that is blank or missing, so add only what you know.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Display name of the badge |
| `slug` | string | Directory name — must match `_badges/{con}/{slug}/` and `assets/badges/{con}/{slug}/` |
| `year` | integer | Year the badge was made / first appeared |
| `con` | string | `defcon` \| `saintcon` \| `dc503` \| `queercon` \| `layerone` \| `toorcon` \| `other` |
| `event` | string | Human-readable event name, e.g. `"DEF CON 32"` |
| `type` | string | `badge` \| `sao` \| `minibadge` \| `standalone` \| `entry` \| `other` |
| `edition` | string | `regular` \| `limited` \| `press` \| `speaker` \| `staff` \| `volunteer` \| `prototype` \| `artist` \| `other` |
| `makers` | list | Creator name(s) / handle(s) |
| `group` | string | Maker group or org, e.g. `"Dual Gang"` |
| `electronics` | bool | Set `false` for entry/art badges with no circuitry |
| `mcu` | string | Microcontroller, e.g. `ESP32-S3`, `RP2040` |
| `display` | string | `none` \| `oled` \| `eink` \| `lcd` \| `led-matrix` \| `7seg` \| `neopixel-matrix` \| `other` |
| `power.battery` | string | `none` \| `rechargeable` \| `non-rechargeable` |
| `power.battery_cell` | string | `CR2032` \| `18650` \| `LiPo` \| `AA` \| etc. |
| `power.sources` | list | For SAOs/minibadges — `[battery, usb, sao]` (any subset) |
| `power.current_ma` | integer | Input current draw in mA (SAO/minibadge) |
| `sao.version` | string | SAO device only — `SAOv1` \| `SAOv2` \| `SAOv3` |
| `sao.implements` | list | SAO device only — pins this device uses: `[i2c, gpio1, gpio2, 3v3, gnd]` |
| `minibadge.implements` | list | Minibadge device only — signals from the spec it implements: `[i2c, clk, gpio, 3v3, gnd]` |
| `sao_ports.count` | integer | Number of SAO host ports on this badge |
| `sao_ports.implements` | list | Signals provided to connected SAOs: `[i2c, gpio, 3v3, gnd]` |
| `sao_ports.power` | string | Voltage on the SAO power pin: `3v3` \| `vbat` \| `5v` |
| `minibadge_ports.count` | integer | Number of minibadge host ports on this badge |
| `minibadge_ports.implements` | list | Signals provided to connected minibadges: `[i2c, clk, gpio, 3v3, gnd]` |
| `minibadge_ports.power` | string | Voltage on the minibadge power pin: `3v3` \| `vbat` \| `5v` |
| `interface` | string | USB connector: `none` \| `USB-C` \| `micro-USB` \| `mini-USB` |
| `programming` | string | Flash/debug interface: `JTAG` \| `SWD` \| `UART` \| `USB-DFU` \| `other` |
| `connectivity` | list | Wireless: `wifi` \| `bluetooth` \| `ir` \| `nfc` \| `lora` \| `zigbee` \| `rf` |
| `features` | list | Free-form feature tags: `neopixels`, `speaker`, `buttons`, etc. |
| `rarity` | string | `unknown` \| `limited` \| `small-run` \| `mass-produced` |
| `acquisition.date` | string | `YYYY-MM-DD` |
| `acquisition.source` | string | Where / how you got it |
| `docs_url` | string | Documentation URL (Hackaday, wiki, project page) |
| `source_repo` | string | Source code / schematics repo URL |
| `sold_at` | list | `[{vendor: "Tindie", url: "https://..."}]` — all known storefronts |
| `purchase_url` | string | Primary current purchase URL (short-form alternative to `sold_at`) |
| `images` | list | `[{filename: "front.jpg", caption: "Front of badge"}]` — first image is the card thumbnail |
| `status` | string | `stub` \| `wip` \| `complete` |

### Adding new field values

Option lists (cons, types, editions, etc.) live at the top of [scripts/new-badge.py](scripts/new-badge.py) as plain Python lists. Add to them freely. The Jekyll templates use `{% if %}` guards throughout, so new or unknown values render gracefully without any template changes.

---

## Photos

### Where to put them

Images go in `assets/badges/{con}/{slug}/` — **not** inside `_badges/`. Jekyll doesn't reliably serve static files from inside a collection directory.

### Naming convention

```
front.jpg           Main front-face photo
back.jpg            Back of the badge
detail-screen.jpg   Close-up of display / interesting feature
assembled.jpg       Fully assembled with lanyards, SAOs attached, etc.
```

Use kebab-case. Order in the `images:` list determines gallery order; first entry is the card thumbnail.

### Format and size

- **JPEG** for photos; **PNG** for screenshots or graphics with transparency
- Minimum 800 px wide; 1600 px or wider preferred for the main gallery view
- Keep file size reasonable — aim for under 1 MB per image (compress before committing)
- Show the full badge — don't crop too tightly; include a little breathing room around the edges
- Consistent orientation within a badge (all landscape or all portrait) looks best in the gallery

---

## Badge status workflow

| Status | Meaning |
|---|---|
| `stub` | Entry created, minimal data, no photos |
| `wip` | Partially filled in — some specs or photos present but incomplete |
| `complete` | Photos, specs, and notes are all filled in to satisfaction |

---

## Adding a new convention / type

1. Add the new value to the relevant list in `scripts/new-badge.py`
2. If it's a new `con`, add a CSS rule in `assets/css/main.css` for `.tag-con-{newcon}` if you want a distinct color
3. If it's a new `type` that warrants its own category page, create `{type}/index.md` using the pattern from `badge/index.md`

---

## Deployment

Pushes to `main` automatically build and deploy via `.github/workflows/deploy.yml` using:

1. `ruby/setup-ruby` → `bundle exec jekyll build`
2. `actions/upload-pages-artifact` + `actions/deploy-pages`

No manual deploy step is needed.
