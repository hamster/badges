# TODO

## Badges to fill in

All current entries are stubs. For each, the work is the same:
1. Copy photos into `assets/badges/{con}/{slug}/`
2. Add an `images:` list to the frontmatter
3. Write notes in the body (what's interesting, any puzzle/game, quirks)
4. Advance `status: stub` → `wip` → `complete`

| Badge | Status | Notes |
|---|---|---|
| [dczia / Zippy (2025)](/_badges/defcon/dczia-zippy-2025/) | stub | |
| [dczia / Mk9 (2026)](/_badges/defcon/dczia-mk9-2026/) | stub | |
| [dczia / Ziatron (2024)](/_badges/defcon/dczia-ziatron-2024/) | stub | |
| [dczia / Electric Sampler (2023)](/_badges/defcon/dczia-electric-sampler-2023/) | stub | |
| [dczia / 30-in-One (2022)](/_badges/defcon/dczia-30-in-one-2022/) | stub | |
| [dczia / Hal9000 (2022)](/_badges/other/dczia-hal9000-2022/) | stub | |

## Mobile

- [x] Header bar doesn't wrap on mobile — nav now wraps: brand on its own line, links below on narrow screens
- [x] Some cards appear slightly greyed out vs full-brightness — hover effects (transform/shadow) now gated behind `@media (hover: hover)` so touch devices never get stuck-hover state

## Badge data

- [x] Co-locate badge `index.md` with its images — images now live in `_badges/{con}/{slug}/` alongside `index.md`; layout uses `/_badges/...` URLs; GUI and CLI updated
- [x] Add external links field to frontmatter (`links:` list with label/url/type) — `type: youtube` renders as embedded iframe; `type: web` renders as a link in the badge-links section

## Badge video

- [ ] 360 rotating-platform videos — explore whether looping stitched video is feasible without heavy tooling (low priority)

## Badge Add/Edit (admin)

- [x] Rename "Badge Admin" → "Badge Add/Edit" — nav link and page title updated
- [x] Web-based editor at `/edit/` — uses File System Access API (`showDirectoryPicker()`); user opens their local checkout, edits/adds badges, files write straight to disk. Chrome/Edge only (Firefox not supported).
- [ ] Remove `scripts/` (CLI + GUI Python tools) once the web editor is confirmed working

## Schema / site

- [ ] Verify SAO port signal list on Electric Sampler — currently only `[3v3]`, check if i2c/gpio are wired
- [ ] Add photos workflow to CI or document image compression step in README
- [ ] Consider adding a `saintcon` con tag color to `main.css` once a SAINTCON badge is added

## Possible future badges to catalog

Add entries for any other badges in the collection.
