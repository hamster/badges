# the hamster badge museum

A personal catalog of electronic conference badges — DEF CON, SAINTCON, and beyond — with photos, specs, and source links. Built with Jekyll and hosted on GitHub Pages at **https://hamster.github.io/badges**.

---

## Tech stack

- **Jekyll 4** static site generator
- **GitHub Pages** hosting via GitHub Actions
- **No build-time dependencies** beyond the Gemfile — pure Jekyll collections, Liquid templates, and vanilla JS
- The local tools in `scripts/` are Python stdlib only; **ffmpeg** is an optional extra needed only for video upload in the GUI — see [scripts/badge_gui/README.md](scripts/badge_gui/README.md#video--ffmpeg)

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
    dczia-zippy-2025/
      index.md      Badge frontmatter + notes (Markdown)

assets/
  badges/           Badge photos, organized to match _badges/
    defcon/
      dczia-zippy-2025/
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

scripts/              See scripts/README.md for which tool is which
  badge_gui/            Local web app to add/edit/duplicate a badge (recommended)
  badge_cli/            Terminal equivalent — same fields, no photos/video/preview
  badge_lib.py          Shared option lists + frontmatter read/write logic

badge/              Category landing page — type: badge
sao/                Category landing page — type: sao
minibadge/          Category landing page — type: minibadge
other/              Category landing page — type: other

TODO.md             Pending work — badges to fill in, site tasks
```

---

## Adding a badge

### Option A — the GUI (recommended)

```bash
python scripts/badge_gui/badge_gui.py
```

A local form with known-option pickers (each with a "+ Add new…" escape hatch), drag-and-drop photo/video upload with a "☆ Set as highlight" button, a "📂 Load existing badge…" picker to edit or duplicate what's already here, and a live side-by-side preview of the actual badge page. See [scripts/badge_gui/README.md](scripts/badge_gui/README.md) for the full feature list and for getting **ffmpeg** working (needed only for video upload).

### Option B — the terminal script

```bash
python scripts/badge_cli/badge_cli.py
```

Same fields and output, prompt-by-prompt in the terminal — including edit and duplicate. No browser, no photos/video/preview. See [scripts/badge_cli/README.md](scripts/badge_cli/README.md).

Both tools share their option lists and file-writing logic (`scripts/badge_lib.py`), so they always produce identical output — see [scripts/README.md](scripts/README.md) for how they relate.

### Option C — copy the template manually

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

## Filtering and sorting

The home page has a client-side filter bar — no page reload needed.

- **Type chips** — filter by badge type (badge, SAO, minibadge, etc.); only types that exist in the collection are shown
- **Search** — free-text match against title, maker names, and group
- **Year / Con dropdowns** — populated automatically from the badges that exist
- **Advanced filters** — a Digikey-style parametric filter panel: multi-select checkboxes grouped by facet (edition, MCU, display, USB, programming, wireless, features, rarity, status), with live result counts per option. Checking two values in one facet is OR; combining facets (and the simple search/year/con/type controls) is AND.
- **Sort** — year descending (default), year ascending, title A–Z, title Z–A
- **Grid / Table view** — switch to a row-and-column table for the same filtered results. Base columns are Name, Creator, Group, Year, Type, and Conference; a "Columns" menu lets you add MCU, Display, Edition, Status, or Rarity. Both the view choice and extra columns persist in the browser.
- **"✕ clear"** — appears only when filters are active; resets everything

The dedicated category pages (`/badge/`, `/sao/`, etc.) remain as direct-link targets with server-side filtering.

---

## Frontmatter field reference

Fields are all optional except `title`, `slug`, `year`, `con`, and `type`. The layout gracefully skips any field that is blank or missing, so add only what you know.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Display name of the badge |
| `slug` | string | Directory name — must match `_badges/{con}/{slug}/` and `assets/badges/{con}/{slug}/`. Default: `{group-or-creator}-{title}-{year}` (con isn't repeated since it's already the parent directory) |
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
| `power.sources` | list | An SAO draws from `[battery, usb, sao]`, a minibadge from `[battery, usb, minibadge]` (any subset — `sao`/`minibadge` mean "powered through its own connector") |
| `power.current_ma` | integer | Input current draw in mA (SAO/minibadge) |
| `sao.version` | string | SAO device only — `SAOv1` \| `SAOv2` \| `SAOv3` |
| `sao.implements` | list | SAO device only — pins this device uses: `[i2c, gpio1, gpio2, 3v3]` |
| `minibadge.implements` | list | Minibadge device only — signals from the spec it implements: `[i2c, clk, gpio, 3v3]` |
| `sao_ports.count` | integer | Number of SAO host ports on this badge |
| `sao_ports.implements` | list | Non-power signals provided to connected SAOs: `[i2c, gpio]` (the rail voltage is `sao_ports.power`, not repeated here) |
| `sao_ports.power` | string | Voltage on the SAO power pin: `3v3` \| `vbatt` \| `5v` |
| `minibadge_ports.count` | integer | Number of minibadge host ports on this badge |
| `minibadge_ports.implements` | list | Non-power signals provided to connected minibadges: `[i2c, clk, gpio]` (the rail voltage is `minibadge_ports.power`, not repeated here) |
| `minibadge_ports.power` | string | Voltage on the minibadge power pin: `3v3` \| `vbatt` \| `5v` |
| `interface` | string | USB connector: `none` \| `USB-C` \| `micro-USB` \| `mini-USB` |
| `programming` | string | Flash/debug interface: `JTAG` \| `SWD` \| `UART` \| `USB-DFU` \| `other` |
| `connectivity` | list | Wireless: `wifi` \| `bluetooth` \| `ir` \| `nfc` \| `lora` \| `zigbee` \| `rf` |
| `features` | list | Free-form feature tags: `neopixels`, `speaker`, `buttons`, etc. |
| `rarity` | string | `unknown` \| `limited` \| `small-run` \| `mass-produced` |
| `acquisition.date` | string | `YYYY-MM-DD` |
| `acquisition.source` | string | Where / how you got it |
| `docs_url` | string | Documentation URL (Hackaday, wiki, project page) |
| `source_repo` | string | Source code / schematics repo URL |
| `sold_at` | list | `[{vendor: "Tindie", url: "https://..."}]` — all known storefronts (preferred) |
| `purchase_url` | string | Single purchase URL — superseded by `sold_at`, kept for compatibility |
| `images` | list | `[{filename: "front.jpg", caption: "...", highlight: true}]` — card thumbnail is the `highlight: true` image if one exists, else the first |
| `videos` | list | `[{filename: "spin.mp4", caption: "...", highlight: true}]` — short muted, looping clips (e.g. the badge rotating); a `highlight: true` video leads as a hero clip above the photo gallery, others render below it |
| `status` | string | `stub` \| `wip` \| `complete` |

### Adding new field values

Option lists (cons, types, editions, etc.) live at the top of [scripts/badge_lib.py](scripts/badge_lib.py) as plain Python lists, shared by both `badge_cli/` and `badge_gui/`. Add to them freely — or just type a new value into the "+ Add new…" box in the GUI when adding a badge; either way, the Jekyll templates use `{% if %}` guards throughout, so new or unknown values render gracefully without any template changes.

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

### Video

A short clip (e.g. slowly rotating the badge) can go in `videos:` alongside `images:`, same `{filename, caption}` shape, files living in the same `assets/badges/{con}/{slug}/` directory. It renders as a muted, looping, autoplaying `<video>` — deliberately not a GIF, which would be far larger for the same quality over more than a couple of seconds. The GUI's dropzone handles the conversion (and highlighting one clip as the hero) automatically; see [scripts/badge_gui/README.md](scripts/badge_gui/README.md#video--ffmpeg) for the ffmpeg command to do it by hand, and for getting ffmpeg itself working on Windows.

---

## Badge status workflow

| Status | Meaning |
|---|---|
| `stub` | Entry created, minimal data, no photos |
| `wip` | Partially filled in — some specs or photos present but incomplete |
| `complete` | Photos, specs, and notes are all filled in to satisfaction |

---

## Adding a new convention / type

1. Add the new value to the relevant list in `scripts/badge_lib.py` — or just type it into the "+ Add new…" box in the GUI; either way it'll show up as a known option next time in both tools, since both scan the local checkout
2. If it's a new `con`, add a CSS rule in `assets/css/main.css` for `.tag-con-{newcon}` if you want a distinct color
3. If it's a new `type`:
   - The home page type filter chip appears automatically once a badge of that type exists
   - If you want a dedicated category landing page, create `{type}/index.md` using the pattern from `badge/index.md`

---

## Deployment

Pushes to `main` automatically build and deploy via `.github/workflows/deploy.yml` using:

1. `ruby/setup-ruby` → `bundle exec jekyll build`
2. `actions/upload-pages-artifact` + `actions/deploy-pages`

No manual deploy step is needed.
