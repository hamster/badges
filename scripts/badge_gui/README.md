# badge_gui/

A local web app for adding, editing, or duplicating a badge. See [../README.md](../README.md) for how this relates to `badge_cli/`.

```bash
python scripts/badge_gui/badge_gui.py
```

Opens `http://127.0.0.1:8420/` in your browser and binds only to localhost — nothing here is reachable from the network, and nothing it does reaches out to the network either (known-option lists are scanned from your local `_badges/` checkout, not fetched from anywhere).

## What it does

- Known-option dropdowns and checkbox groups for every field, each with a "+ Add new…" entry so a value that isn't in the list yet doesn't force you into "other" — type it and it's used as-is (and shows up as a known option for next time, once the badge is saved).
- Drag-and-drop photo upload, with reordering and per-photo captions.
- Drag-and-drop video upload — converted into a small looping, muted MP4 (see **Video / ffmpeg** below).
- A "☆ Set as highlight" button on every photo/video: exactly one across both is ever the highlight, and it's what leads — the card-grid thumbnail if it's a photo, or the hero clip above the gallery if it's a video.
- A live, side-by-side preview that mirrors the actual badge page layout (toggle to raw YAML, or pop it out into its own tab).
- **"📂 Load existing badge…"** to edit a badge already in the checkout (including renaming its convention/slug, which moves the directory) or duplicate one as a starting point for a new entry (photos/video are left out, since it's a different physical item; duplicating also appends "COPY" to the title so it's never mistaken for the original). The picker opens on a list of groups/makers to narrow down by first — click one to see just its badges, or "All badges" for the old flat list — and typing in the search box at any point jumps straight to a flat, filtered result across everything, ignoring whichever group you were browsing.
- A banner if it can't reach its own backend — usually means `badge_gui.py` isn't running or was stopped; restart it and reload the page.

Saving writes straight into this checkout (`_badges/{con}/{slug}/index.md` and `assets/badges/{con}/{slug}/`) and prints the `git add`/`commit` commands — nothing is committed automatically.

## Video / ffmpeg

Video upload needs **ffmpeg** on your `PATH`. If it's missing, the app tells you so (a banner near the dropzone, and a clear error if you try anyway) — everything else works fine without it.

The conversion itself (roughly): scale down to a max width of 1080px, cap the length at 30s, strip audio, encode as H.264/yuv420p with `+faststart`. `-maxrate`/`-bufsize` bound the worst case (a full 30s clip at sustained peak rate) to comfortably under a ~10MB output, even though `-crf` alone doesn't guarantee a file size. Deliberately not a GIF — GIF is far less efficient for anything longer than a couple of seconds, so an equivalent-quality MP4 ends up dramatically smaller. Doing it by hand looks like:

```bash
ffmpeg -i clip.mov -t 30 -vf "scale=w='min(1080,iw)':h=-2,fps=24" -an \
  -c:v libx264 -crf 22 -preset medium -maxrate 2600k -bufsize 5200k \
  -pix_fmt yuv420p -movflags +faststart spin.mp4
```

### Getting ffmpeg working on Windows

`winget install ffmpeg` installs the `Gyan.FFmpeg` package, which is just a folder of prebuilt `.exe`s (`ffmpeg.exe`, `ffprobe.exe`, ...) under:

```
%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-<version>-full_build\bin\
```

Two gotchas, both easy to miss:

1. **This package does not register a PATH shim.** Most winget packages add themselves to your PATH automatically; this one doesn't. `winget` itself does still write the folder above into your *User* `PATH` environment variable — but:
2. **No already-open terminal ever sees that change.** Environment variables are copied into a process when it starts; a running shell (or an IDE's integrated terminal, or `badge_gui.py` itself if it's already running) keeps whatever `PATH` it started with. Editing the registry value doesn't reach back into it.

So after `winget install ffmpeg`:
- Close **every** open terminal window (all of them — each one is a separate stale copy of `PATH`).
- Open a brand-new terminal and run `ffmpeg -version` to confirm it resolves.
- Start (or restart) `badge_gui.py` from that fresh terminal.

If `ffmpeg -version` still fails from a genuinely new terminal, check whether the PATH entry actually made it into the registry:

```powershell
[Environment]::GetEnvironmentVariable("Path", "User") -split ";" | Select-String ffmpeg
```

If that comes back empty, add it yourself (adjust the version folder to match what's actually installed):

```powershell
$ffmpegBin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin"
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$ffmpegBin", "User")
```

Then, again, open a fresh terminal before trying `ffmpeg` or `badge_gui.py`.

## Files

```
badge_gui.py     The server (stdlib http.server — no pip install needed)
static/          Its HTML/CSS/JS front end (index.html, app.js, app.css)
```
