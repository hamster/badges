# TODO

## Open

- [ ] 360 rotating-platform videos - explore whether looping stitched video is feasible without heavy tooling (low priority). The Badge Turntable app trims spins to exactly one revolution using the encoder ring (apps/Spec.md)
- [ ] Badge Turntable Android app - first draft in apps/badge-turntable/, needs building and testing in Android Studio

## Done

- [x] Publish-time WebP thumbnails (640 px) and gallery copies (1600 px); videos over 10 MB or in HDR re-encoded (.github/scripts/optimize_media.py)
- [x] `badge-ids.json` listing every badge_id, for the capture app
- [x] Encoder ring generator for the turntable (apps/encoder-ring/)

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
- [x] Editor fails to parse badge files with CRLF line endings - normalize `\r\n` → `\n` on file read
- [x] Cache repo dir handle in IndexedDB so returning users get one-click "Reopen" instead of directory picker
- [x] Add a three digit hex unique identifier per physical badge (badge_id field, shown on cards and detail pages)

