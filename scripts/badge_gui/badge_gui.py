#!/usr/bin/env python3
"""Local web app for entering, editing, or duplicating badges: known-option
pickers with an "add new" escape hatch, drag-and-drop photo/video upload,
and a live side-by-side preview of the actual badge page. On save it writes
the stub and media straight into this checkout so you can review the diff
and `git add` / commit / open a PR yourself.

See scripts/README.md for how this relates to badge_cli/ (the terminal
equivalent) and scripts/badge_gui/README.md for setup details, including
getting ffmpeg working for video uploads.

Nothing here touches git, and nothing calls out to the network — known
option values are scanned from your local `_badges/` checkout (see
badge_lib.scan_known_values). The server only binds to localhost.

Run:  python scripts/badge_gui/badge_gui.py
"""

import json
import mimetypes
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# badge_lib.py lives one directory up, alongside badge_cli/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import badge_lib as lib

STATIC_DIR = (Path(__file__).resolve().parent / "static")
HOST = "127.0.0.1"
PORT = 8420

_SAFE_SEGMENT_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")
_SAFE_FILENAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")

# Videos are converted through ffmpeg (scaled down, audio dropped, capped
# length) into a small looping web video — see _handle_upload_video. If
# ffmpeg isn't on PATH, video upload is refused with a clear message
# rather than silently storing a huge raw clip.
FFMPEG_PATH = shutil.which("ffmpeg")
MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024  # generous cap on the *raw* upload
VIDEO_MAX_SECONDS = 30
VIDEO_MAX_WIDTH = 1080
# Output is allowed up to ~10MB. -maxrate/-bufsize bound the worst case
# (VIDEO_MAX_SECONDS at sustained peak rate) to comfortably stay under that
# even though -crf alone doesn't guarantee a file size.
VIDEO_TARGET_MAX_BYTES = 10 * 1024 * 1024
VIDEO_MAXRATE = "2600k"
VIDEO_BUFSIZE = "5200k"

# One temp "draft" directory per server run holds uploaded-but-not-yet-saved
# photos/videos, keyed by the filename the client wants. Cleared on exit.
DRAFT_DIR = Path(tempfile.mkdtemp(prefix="badge-gui-"))


def _safe_segment(value, field):
    value = (value or "").strip()
    if not _SAFE_SEGMENT_RE.fullmatch(value):
        raise ValueError(f"Invalid {field}: {value!r} (letters, numbers, - and _ only)")
    return value


def _safe_filename(value, field="filename"):
    value = Path((value or "").strip()).name
    if not _SAFE_FILENAME_RE.fullmatch(value):
        raise ValueError(f"Invalid {field}: {value!r}")
    return value


def _unique_draft_path(filename):
    """A path under DRAFT_DIR for `filename`, disambiguated with -1, -2, …
    if something with that name is already staged in this draft."""
    dest = DRAFT_DIR / filename
    stem, suffix = dest.stem, dest.suffix
    counter = 1
    while dest.exists():
        dest = DRAFT_DIR / f"{stem}-{counter}{suffix}"
        counter += 1
    return dest


def _json_bytes(obj):
    return json.dumps(obj).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "BadgeGUI/1.0"

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet

    # ----- routing -----

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", ""):
            self._serve_static(STATIC_DIR, "index.html")
        elif path == "/api/ping":
            # Deliberately cheap (no badge scan) — polled every few seconds
            # by the client purely to detect whether the server is up.
            self._send_json({"ok": True})
        elif path == "/api/options":
            options = lib.scan_known_values()
            options["_meta"] = {"ffmpeg_available": FFMPEG_PATH is not None}
            self._send_json(options)
        elif path == "/api/badges":
            self._send_json(lib.list_badges())
        elif path == "/api/badge":
            self._handle_get_badge(parse_qs(urlparse(self.path).query))
        elif path.startswith("/api/"):
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
        elif path.startswith("/assets/") or path.startswith("/_badges/"):
            # /assets/ for site CSS; /_badges/ for badge images now co-located with index.md
            self._serve_static(lib.SITE_ROOT, path.lstrip("/"))
        else:
            self._serve_static(STATIC_DIR, path.lstrip("/"))

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/preview":
            self._handle_preview()
        elif parsed.path == "/api/upload-image":
            self._handle_upload_image(parse_qs(parsed.query))
        elif parsed.path == "/api/upload-video":
            self._handle_upload_video(parse_qs(parsed.query))
        elif parsed.path == "/api/save":
            self._handle_save()
        else:
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

    # ----- static files -----

    def _serve_static(self, base_dir, rel_path):
        target = (base_dir / rel_path).resolve()
        if target != base_dir and base_dir not in target.parents:
            self._send_json({"error": "forbidden"}, status=HTTPStatus.FORBIDDEN)
            return
        if not target.is_file():
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ----- JSON helpers -----

    def _send_json(self, obj, status=HTTPStatus.OK):
        data = _json_bytes(obj)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # ----- API handlers -----

    def _handle_preview(self):
        try:
            fields = self._read_json()
            content = lib.build_frontmatter(fields)
            self._send_json({"content": content})
        except Exception as e:
            self._send_json({"error": str(e)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_get_badge(self, query):
        con = (query.get("con") or [""])[0]
        slug = (query.get("slug") or [""])[0]
        try:
            con = _safe_segment(con, "con")
            slug = _safe_segment(slug, "slug")
        except ValueError as e:
            self._send_json({"error": str(e)}, status=HTTPStatus.BAD_REQUEST)
            return
        fields = lib.get_badge_fields(con, slug)
        if fields is None:
            self._send_json({"error": f"Badge not found: {con}/{slug}"}, status=HTTPStatus.NOT_FOUND)
            return
        self._send_json(fields)

    def _handle_upload_image(self, query):
        names = query.get("name") or []
        if not names or not names[0]:
            self._send_json({"error": "missing ?name="}, status=HTTPStatus.BAD_REQUEST)
            return
        filename = Path(names[0]).name  # strip any path components
        length = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(length) if length else b""

        dest = _unique_draft_path(filename)
        dest.write_bytes(data)
        self._send_json({"filename": dest.name})

    def _handle_upload_video(self, query):
        if FFMPEG_PATH is None:
            self._send_json({
                "error": "ffmpeg not found on PATH. Install it (e.g. `winget install ffmpeg`, "
                         "`choco install ffmpeg`, or from ffmpeg.org) to enable video uploads, "
                         "then restart badge_gui.py. See scripts/badge_gui/README.md for Windows notes."
            }, status=HTTPStatus.SERVICE_UNAVAILABLE)
            return

        names = query.get("name") or []
        if not names or not names[0]:
            self._send_json({"error": "missing ?name="}, status=HTTPStatus.BAD_REQUEST)
            return
        base_name = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(names[0]).stem).strip("-") or "video"

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            self._send_json({"error": "empty upload"}, status=HTTPStatus.BAD_REQUEST)
            return
        if length > MAX_VIDEO_UPLOAD_BYTES:
            mb = length // (1024 * 1024)
            self._send_json(
                {"error": f"Video is {mb} MB before conversion — trim it first (limit {MAX_VIDEO_UPLOAD_BYTES // (1024*1024)} MB)."},
                status=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )
            return

        raw_path = DRAFT_DIR / f".upload-{base_name}.tmp"
        remaining = length
        try:
            with open(raw_path, "wb") as fh:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    fh.write(chunk)
                    remaining -= len(chunk)

            dest = _unique_draft_path(base_name + ".mp4")
            cmd = [
                FFMPEG_PATH, "-y", "-i", str(raw_path),
                "-t", str(VIDEO_MAX_SECONDS),
                "-vf", f"scale=w='min({VIDEO_MAX_WIDTH},iw)':h=-2,fps=24",
                "-an",
                "-c:v", "libx264", "-crf", "22", "-preset", "medium",
                "-maxrate", VIDEO_MAXRATE, "-bufsize", VIDEO_BUFSIZE,
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(dest),
            ]
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            except subprocess.TimeoutExpired:
                self._send_json({"error": "ffmpeg timed out converting this video"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return

            if result.returncode != 0 or not dest.is_file():
                err_tail = (result.stderr or "").strip().splitlines()
                err_tail = " ".join(err_tail[-3:]) if err_tail else "unknown ffmpeg error"
                self._send_json({"error": f"ffmpeg conversion failed: {err_tail}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return

            self._send_json({"filename": dest.name, "size_bytes": dest.stat().st_size})
        finally:
            raw_path.unlink(missing_ok=True)

    def _handle_save(self):
        try:
            fields = self._read_json()
            result = self._save_badge(fields)
            self._send_json(result)
        except ValueError as e:
            self._send_json({"error": str(e)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as e:
            self._send_json({"error": str(e)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def _place_media(self, items, assets_dir, kind):
        placed = []
        for item in items:
            name = _safe_filename(item.get("filename") or item.get("draft_filename") or item.get("original_filename"))
            if item.get("draft_filename"):
                src = DRAFT_DIR / _safe_filename(item["draft_filename"], "draft_filename")
                if not src.is_file():
                    raise ValueError(f"Uploaded {kind} not found: {item.get('draft_filename')}")
                shutil.move(str(src), str(assets_dir / name))
            elif item.get("original_filename"):
                old_path = assets_dir / _safe_filename(item["original_filename"], "original_filename")
                new_path = assets_dir / name
                if old_path != new_path and old_path.is_file():
                    old_path.rename(new_path)
            placed.append({"filename": name, "caption": item.get("caption") or "", "highlight": bool(item.get("highlight"))})
        return placed

    def _save_badge(self, fields):
        title = (fields.get("title") or "").strip()
        badge_type = (fields.get("badge_type") or "").strip()
        year = str(fields.get("year") or "").strip()
        if not title or not badge_type or not year:
            raise ValueError("title, year, con, and badge_type are all required")

        con = _safe_segment(fields.get("con"), "con")
        slug = fields.get("slug") or lib.default_slug(
            title, year, fields.get("group"), fields.get("makers")
        )
        slug = _safe_segment(slug, "slug")
        fields["con"] = con
        fields["slug"] = slug

        original_con = fields.get("original_con")
        original_slug = fields.get("original_slug")
        if original_con:
            original_con = _safe_segment(original_con, "original_con")
        if original_slug:
            original_slug = _safe_segment(original_slug, "original_slug")

        badge_dir, assets_dir, is_edit = lib.resolve_badge_paths(con, slug, original_con, original_slug)

        # Each media item (image or video) is either a fresh upload (has
        # draft_filename, staged in DRAFT_DIR — videos already ffmpeg-
        # converted at upload time) or one already on disk from the badge
        # being edited (has original_filename, possibly renamed by the
        # user). Removing one in the UI just drops it from this list — the
        # underlying file, if any, is left alone rather than auto-deleted.
        final_images = self._place_media(fields.get("images") or [], assets_dir, "image")
        final_videos = self._place_media(fields.get("videos") or [], assets_dir, "video")

        content = lib.build_frontmatter({**fields, "images": final_images, "videos": final_videos})
        (badge_dir / "index.md").write_text(content, encoding="utf-8")
        lib.ensure_gitkeep(assets_dir)

        rel_badge = badge_dir.relative_to(lib.SITE_ROOT).as_posix()
        rel_assets = assets_dir.relative_to(lib.SITE_ROOT).as_posix()
        commit_verb = "Update" if is_edit else "Add"
        return {
            "con": con,
            "slug": slug,
            "badge_dir": rel_badge,
            "assets_dir": rel_assets,
            "git_commands": [
                f"git add {rel_badge} {rel_assets}",
                f'git commit -m "{commit_verb} badge: {title}"',
            ],
        }


def main():
    if not STATIC_DIR.is_dir():
        print(f"ERROR: static assets not found at {STATIC_DIR}", file=sys.stderr)
        return 1

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"Badge admin running at {url}  (Ctrl+C to stop)")
    print(f"Draft uploads staged in {DRAFT_DIR}")
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        shutil.rmtree(DRAFT_DIR, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
