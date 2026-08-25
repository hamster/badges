# the hamster badge museum

A personal catalog of electronic conference badges - DEF CON, SAINTCON, and beyond - with photos, specs, and source links. Built with Jekyll and hosted on GitHub Pages at **https://hamster.github.io/badges**.

---

## Tech stack

- **Jekyll 4** static site generator
- **GitHub Pages** hosting via GitHub Actions
- **No build-time dependencies** beyond the Gemfile - pure Jekyll collections, Liquid templates, and vanilla JS

---

## Local development

```bash
bundle install
bundle exec jekyll serve
```

The site will be available at `http://localhost:4000/badges/`.

---

## Project structure

```
_badges/            Badge content and images, organized by con then slug
  defcon/
    dczia-zippy-2025/
      index.md      Badge frontmatter + notes (Markdown)
      front.jpg     Photos and videos live here, alongside index.md
      back.jpg

_layouts/
  default.html      Site chrome / nav
  badge.html        Individual badge detail page
  category.html     Category listing (Badges, SAOs, etc.)

_includes/
  badge-card.html   Reusable badge card for grid views

_template/
  index.md          Blank badge template - copy this when adding manually

edit/               Web editor - add/edit badges via File System Access API (Chrome/Edge)

badge/              Category landing page - type: badge
sao/                Category landing page - type: sao
minibadge/          Category landing page - type: minibadge
other/              Category landing page - type: other

TODO.md             Pending work
```

---

## Adding a badge

### Option A - the web editor (recommended)

Open `https://hamster.github.io/badges/edit/` (or `http://localhost:4000/badges/edit/` during local dev) in Chrome or Edge, click **Open repo…**, and select your local clone of this repo. The editor writes badge files and photos straight to disk - nothing is committed or pushed automatically. Fill in the form, drag in photos, hit **Save badge to disk**, then `git add` / `git commit` / push as normal.

### Option B - copy the template manually

```bash
cp -r _template _badges/{con}/{slug}
```

Then edit `_badges/{con}/{slug}/index.md` with the badge details, and drop photos into the same folder.

---

## Editing a badge

Open `_badges/{con}/{slug}/index.md`. All metadata is in the YAML frontmatter at the top; prose notes go below the `---` separator. Markdown is fully supported in the notes body.

Change `status: stub` → `status: wip` as you fill things in, and `status: complete` when photos and specs are done.

---

## Filtering and sorting

The home page has a client-side filter bar - no page reload needed.

- **Type chips** - filter by badge type (badge, SAO, minibadge, etc.); only types that exist in the collection are shown
- **Search** - free-text match against title, maker names, and group
- **Year / Con dropdowns** - populated automatically from the badges that exist
- **Advanced filters** - a Digikey-style parametric search: toggling it opens a strip of columns (Con, Group, Maker, Acquired from, Edition, MCU, Display, USB, Programming, Rarity, Status, Power, Wireless, Other features, SAO / Minibadge, Flags) between the filter bar and the grid. Each column scrolls independently with live result counts and a per-column search once it has enough values. "Flags" is a fixed yes/no set (has docs, has repo/source, has vendor/purchase link, has notes). Checking two values in one column is OR; combining columns (and the simple search/year/con/type controls) is AND.
- **Sort** - year descending (default), year ascending, title A-Z, title Z-A, group A-Z, group Z-A, maker A-Z, maker Z-A
- **Grid / Table view** - switch to a row-and-column table. Base columns are Name, Creator, Group, Year, Type, and Conference; a "Columns" menu adds MCU, Display, Edition, Status, or Rarity. Both view and column choices persist in the browser.
- **Clickable tags** - type, con, year, group/maker, edition, and status tags on badge detail pages link back to the home page with that filter pre-applied. The same tags on grid cards filter in-place without navigating away.
- **"✕ clear"** - appears only when filters are active; resets everything

The dedicated category pages (`/badge/`, `/sao/`, etc.) remain as direct-link targets with server-side filtering.

---

## Frontmatter field reference

Fields are all optional except `title`, `slug`, `year`, `con`, and `type`. The layout gracefully skips any field that is blank or missing.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Display name of the badge |
| `slug` | string | Directory name - must match `_badges/{con}/{slug}/`. Default: `{group-or-creator}-{title}-{year}` |
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
| `power.sources` | list | `[battery, usb, sao]` etc. - where the badge draws power from |
| `power.current_ma` | integer | Input current draw in mA (SAO/minibadge) |
| `sao.version` | string | SAO device only - `SAOv1` \| `SAOv2` \| `SAOv3` |
| `sao.implements` | list | SAO device only - pins this device uses: `[i2c, gpio1, gpio2, 3v3]` |
| `minibadge.implements` | list | Minibadge device only - signals from the spec it implements |
| `sao_ports.count` | integer | Number of SAO host ports on this badge |
| `sao_ports.implements` | list | Non-power signals provided to connected SAOs: `[i2c, gpio]` |
| `sao_ports.power` | string | Voltage on the SAO power pin: `3v3` \| `vbatt` \| `5v` |
| `minibadge_ports.count` | integer | Number of minibadge host ports |
| `minibadge_ports.implements` | list | Non-power signals provided to connected minibadges |
| `minibadge_ports.power` | string | Voltage on the minibadge power pin: `3v3` \| `vbatt` \| `5v` |
| `interface` | string | USB connector: `none` \| `USB-C` \| `micro-USB` \| `mini-USB` |
| `programming` | string | `JTAG` \| `SWD` \| `UART` \| `USB-DFU` \| `other` |
| `connectivity` | list | `wifi` \| `bluetooth` \| `ir` \| `nfc` \| `lora` \| `zigbee` \| `rf` |
| `features` | list | Feature tags: `neopixels`, `speaker`, `buttons`, etc. |
| `rarity` | string | `unknown` \| `limited` \| `small-run` \| `mass-produced` |
| `acquisition.date` | string | `YYYY-MM-DD` |
| `acquisition.source` | string | Where / how you got it |
| `docs_url` | string | Documentation URL (Hackaday, wiki, project page) |
| `source_repo` | string | Source code / schematics repo URL |
| `sold_at` | list | `[{vendor: "Tindie", url: "https://..."}]` - known storefronts |
| `images` | list | `[{filename: "front.jpg", caption: "...", highlight: true}]` - card thumbnail is the `highlight: true` image, else the first |
| `videos` | list | `[{filename: "spin.mp4", caption: "...", highlight: true}]` - muted looping clips; a `highlight: true` video leads as a hero above the gallery |
| `status` | string | `stub` \| `wip` \| `complete` |

`group` (or the first `makers` entry if there's no group) drives the colored credit tag on badge detail pages - no separate field needed.

### Adding new field values

The web editor scans your local checkout to suggest known values in dropdowns, and you can always type a new value directly. The Jekyll templates use `{% if %}` guards throughout, so new or unknown values render gracefully without any template changes.

---

## Photos

### Where to put them

Images go in `_badges/{con}/{slug}/` alongside `index.md`. Jekyll 4 serves non-document files from collection directories as static files at `/{con}/{slug}/filename` (the `_badges/` prefix is stripped).

### Naming convention

```
front.jpg           Main front-face photo
back.jpg            Back of the badge
detail-screen.jpg   Close-up of display / interesting feature
assembled.jpg       Fully assembled with lanyards, SAOs attached, etc.
```

Use kebab-case. Order in the `images:` list determines gallery order; the `highlight: true` entry (or first if none) is the card thumbnail.

### Format and size

- **JPEG** for photos; **PNG** for screenshots or graphics with transparency
- Minimum 800 px wide; 1600 px or wider preferred for the main gallery view
- Keep file size reasonable - aim for under 1 MB per image
- Show the full badge with a little breathing room around the edges

### Video

Short clips go in `videos:` using the same `{filename, caption, highlight}` shape, files in the same `_badges/{con}/{slug}/` directory. They render as muted, looping, autoplaying `<video>` elements. Use MP4 for best browser compatibility.

---

## Badge status workflow

| Status | Meaning |
|---|---|
| `stub` | Entry created, minimal data, no photos |
| `wip` | Partially filled in - some specs or photos present but incomplete |
| `complete` | Photos, specs, and notes are all filled in |

---

## Adding a new convention or type

1. Just use the new value in the web editor or frontmatter - the site scans existing badges to populate known options, and unknown values render gracefully
2. If it's a new `con`, add a CSS rule in `assets/css/main.css` for `.tag-con-{newcon}` if you want a distinct color
3. If it's a new `type`:
   - The home page type filter chip appears automatically once a badge of that type exists
   - For a dedicated category landing page, create `{type}/index.md` following the pattern from `badge/index.md`

---

## Fork this for your own collection

1. **Fork** this repo on GitHub

2. **Update `_config.yml`**:
   ```yaml
   title: "your collection name"
   description: "A short description"
   url: "https://{your-github-username}.github.io"
   baseurl: "/{repo-name}"   # or "" if the repo is {username}.github.io
   repository: "{your-github-username}/{repo-name}"
   ```

3. **Enable GitHub Pages**: repo Settings → Pages → Build and deployment → Source → **GitHub Actions**

4. **Push to `main`** - the included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically. No manual deploy step needed.

5. **Start adding badges**: open `https://{username}.github.io/{repo}/edit/` in Chrome or Edge, click **Open repo…**, point it at your local clone, and go.

Optional tweaks:
- **Colors**: CSS custom properties are at the top of `assets/css/main.css`
- **Category pages**: `badge/`, `sao/`, `minibadge/`, `other/` are standalone pages - add more by creating `{type}/index.md` following the existing pattern
- **Site title / nav**: edit `_layouts/default.html`

---

## Deployment

Pushes to `main` automatically build and deploy via `.github/workflows/deploy.yml` using:

1. `ruby/setup-ruby` → `bundle exec jekyll build`
2. `actions/upload-pages-artifact` + `actions/deploy-pages`
