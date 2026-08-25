# TODO

## Open

- [ ] 360 rotating-platform videos - explore whether looping stitched video is feasible without heavy tooling (low priority)
- [ ] Editor enumerator fails if line endings are not \n
- [ ] Add a three digit hex unique identifier
- [ ] Cache the repo dir so the user does not need to re-select if they navigate away from the editor

## Done

- [x] Header bar doesn't wrap on mobile
- [x] Hover effects gated behind `@media (hover: hover)` so touch devices don't get stuck-hover state
- [x] Co-locate badge `index.md` with its images - images now live in `_badges/{con}/{slug}/` alongside `index.md`
- [x] Add external links field to frontmatter (`links:` list with label/url/type)
- [x] Rename "Badge Admin" to "Badge Add/Edit"
- [x] Web-based editor at `/edit/` - uses File System Access API; Chrome/Edge only
- [x] Remove `scripts/` CLI + GUI Python tools
- [x] Clickable tags on badge detail pages (type, con, year, group/maker, edition, status) link to home page with filter pre-applied
- [x] Clickable tags on grid cards (type, con, year, group/maker, MCU) filter in-place without navigating away
- [x] Edit page help text shown inline (no flyout)

