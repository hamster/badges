# TODO

## Open

- [ ] Seamless looping spin videos - the rules are in badge-turntable's Spec.md ("Seamless spin loop"): record from a steady speed, cut exactly one revolution after a lead-in, match frames when there's no ring. The app's auto spin trims with the ring; the by-hand and no-ring paths still need doing (the app's README, Next)
- [ ] Badge Turntable Android app (now its own repo, hamster/badge-turntable) - builds and runs on the OnePlus 9 Pro; next steps are in its README under Handoff → Next (IR on the table, the last round on the phone)
- [ ] Remote control end to end - the app's server and the editor panel are both written; test the panel against the real phone, including from GitHub Pages (Local Network Access prompt)

## Done

- [x] Remote-control API specified (badge-turntable's Remote-API.md), mock phone (its remote-mock/), and the editor's Turntable panel with preview, camera, turntable, capture, prompts, shots tray and save-to-`_capture/`, tested end to end against the mock
- [x] Editor Turntable panel: Auto capture plus by-hand Capture both / stills / spin, simpler camera controls with a held focus point, and a Stop that survives the phone dropping off the network
- [x] JAYEGT turntable remote codes captured and every button's behaviour mapped (badge-turntable's ir-tools/, bundled as the app's jayegt-5.74.ir)
- [x] Encoder ring printed and fitted on the JAYEGT: black band, 45 markers at 8 degrees, generated at 460.9 mm (badge-turntable's encoder-ring/)
- [x] Perspective-corrected ring angle fit, checked against simulated camera images
- [x] Publish-time WebP thumbnails (640 px) and gallery copies (1600 px); videos over 10 MB or in HDR re-encoded (.github/scripts/optimize_media.py)
- [x] `badge-ids.json` listing every badge_id, for the capture app
- [x] Encoder ring generator for the turntable (badge-turntable's encoder-ring/)
- [x] Capture app, spec, encoder ring and IR tools moved out of apps/ into their own repo, hamster/badge-turntable (Nov 7, 2026)

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

