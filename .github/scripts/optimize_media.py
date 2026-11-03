#!/usr/bin/env python3
"""Shrink badge media in the built site.

Runs in the Pages workflow after `jekyll build`, on _site/:

  * Every badge photo gets two WebP copies beside it:
      thumbs/<name>.webp   640 px long edge, for grid cards and gallery strips
      medium/<name>.webp  1600 px long edge, for the gallery's main image
    Production builds point the templates at these (_includes/media-url.html)
    and fall back to the original if one is missing.

  * Every video over the size limit (default 10 MB) is re-encoded in place with
    the settings the old badge_gui used: H.264 yuv420p, at most 1080 px wide,
    24 fps, no audio, faststart. The bitrate is capped so the result fits.

Only folders holding a badge page (index.html or index.md) are touched.
Results are cached by source hash in --cache, so unchanged media is copied
rather than re-encoded.

It can also shrink oversized videos in the repo itself before committing:

    python .github/scripts/optimize_media.py --root _badges --no-images

Needs Pillow (with WebP) for images, and ffmpeg (plus ffprobe, optional) for video.
"""

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Bump when output settings change, so cached results are regenerated.
VERSION = "1"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTS = {".mp4", ".m4v", ".mov"}
VARIANTS = [("thumbs", 640, 78), ("medium", 1600, 82)]

VIDEO_MAX_KBPS = 2600
VIDEO_HEADROOM = 0.92  # container overhead and rate-control slack


def file_hash(path, extra):
    h = hashlib.sha256(extra.encode())
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:32]


def badge_folders(badges_src, root):
    """Folders under root that correspond to a badge (a folder with index.md in _badges/).

    Jekyll copies a badge's photos to /<con>/<slug>/ but writes its page to
    /<con>/<slug>/index/, so the built folders are found from the source tree.
    """
    for index in sorted(Path(badges_src).rglob("index.md")):
        folder = Path(root) / index.parent.relative_to(badges_src)
        if folder.is_dir():
            yield folder


def badge_media(folders, exts):
    for folder in folders:
        for f in sorted(folder.iterdir()):
            if f.is_file() and f.suffix.lower() in exts:
                yield f


class Cache:
    def __init__(self, path):
        self.path = Path(path)
        self.path.mkdir(parents=True, exist_ok=True)
        self.used = set()
        self._locks = {}
        self._guard = threading.Lock()

    def entry(self, name):
        self.used.add(name)
        return self.path / name

    def lock(self, key):
        # Identical photos in two badges share a key; only one thread may build it.
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    def prune(self):
        removed = 0
        for f in self.path.iterdir():
            if f.is_file() and f.name not in self.used:
                f.unlink()
                removed += 1
        return removed


# ---- Images -----------------------------------------------------------------

def make_variants(src, cache):
    from PIL import Image, ImageOps

    key = file_hash(src, "img" + VERSION)
    made = 0
    with cache.lock(key):
        for name, edge, quality in VARIANTS:
            cached = cache.entry(f"{key}-{name}.webp")
            if not cached.exists():
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im)
                    if im.mode not in ("RGB", "RGBA"):
                        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
                    im.thumbnail((edge, edge), Image.LANCZOS, reducing_gap=3.0)
                    tmp = cached.with_suffix(".tmp")
                    im.save(tmp, "WEBP", quality=quality, method=4)
                os.replace(tmp, cached)
                made += 1
            dest = src.parent / name / (src.stem + ".webp")
            dest.parent.mkdir(exist_ok=True)
            shutil.copyfile(cached, dest)
    return made


# ---- Video ------------------------------------------------------------------

def probe(ffmpeg, src):
    """(duration in seconds, is_hdr), read from ffmpeg's banner."""
    out = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src)], capture_output=True, text=True).stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", out)
    if not m:
        raise RuntimeError(f"can't read the duration of {src}")
    h, mnt, s = m.groups()
    video = next((line for line in out.splitlines() if "Video:" in line), "")
    # Phone clips are often HLG (arib-std-b67) or PQ (smpte2084). Browsers render
    # those inconsistently, so they're tone-mapped to SDR even when small enough.
    hdr = "arib-std-b67" in video or "smpte2084" in video
    return int(h) * 3600 + int(mnt) * 60 + float(s), hdr


def has_filter(ffmpeg, name):
    out = subprocess.run([ffmpeg, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return re.search(rf"^\s*\S+\s+{name}\s", out, re.M) is not None


TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv")


def encode(ffmpeg, src, dest, kbps, tonemap):
    # Narrower output at low bitrates looks better than a starved 1080p.
    max_w = 1080 if kbps >= 1200 else 720 if kbps >= 600 else 480
    vf = f"scale='trunc(min({max_w},iw)/2)*2':-2,fps=24"
    if tonemap:
        vf += "," + TONEMAP
    vf += ",format=yuv420p"
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
           "-map", "0:v:0", "-an", "-sn", "-dn", "-map_metadata", "-1",
           "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "23",
           "-maxrate", f"{kbps}k", "-bufsize", f"{kbps * 2}k",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-movflags", "+faststart", str(dest)]
    subprocess.run(cmd, check=True)


def shrink_video(src, limit, cache, ffmpeg, can_tonemap):
    size = src.stat().st_size
    seconds, hdr = probe(ffmpeg, src)
    if size <= limit and not hdr:
        return None
    key = file_hash(src, f"vid{VERSION}-{limit}-{can_tonemap}")
    cached = cache.entry(f"{key}{src.suffix.lower()}")
    if not cached.exists():
        if hdr and not can_tonemap:
            print(f"  ! {src}: HDR, but this ffmpeg has no zscale filter; colours may be off", file=sys.stderr)
        kbps = int(min(VIDEO_MAX_KBPS, limit * 8 * VIDEO_HEADROOM / seconds / 1000))
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir) / ("out" + src.suffix.lower())
            for _ in range(3):
                encode(ffmpeg, src, tmp, kbps, hdr and can_tonemap)
                if tmp.stat().st_size <= limit:
                    break
                kbps = int(kbps * 0.8)
            if tmp.stat().st_size > limit:
                print(f"  ! {src}: still over the limit after 3 tries", file=sys.stderr)
            shutil.move(tmp, cached)
    shutil.copyfile(cached, src)
    return size, src.stat().st_size, hdr


# ---- Main -------------------------------------------------------------------

def mb(n):
    return f"{n / 1e6:.1f} MB"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--root", default="_site", help="folder to process (default _site)")
    ap.add_argument("--badges", default="_badges", help="badge source folder, to find badge folders (default _badges)")
    ap.add_argument("--cache", default=".media-cache", help="cache folder (default .media-cache)")
    ap.add_argument("--video-limit-mb", type=float, default=10, help="max video size (default 10)")
    ap.add_argument("--no-images", action="store_true", help="skip WebP thumbnails")
    ap.add_argument("--no-videos", action="store_true", help="skip video shrinking")
    ap.add_argument("--no-prune", action="store_true", help="keep cache entries not used this run")
    ap.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="ffmpeg binary")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        sys.exit(f"error: {root} is not a folder")
    cache = Cache(args.cache)
    folders = list(badge_folders(args.badges, root))
    summary = []

    if not args.no_images:
        images = list(badge_media(folders, IMAGE_EXTS))
        with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as pool:
            made = sum(pool.map(lambda p: make_variants(p, cache), images))
        line = f"Images: {len(images)} photos, {made} new variants, {len(images) * len(VARIANTS) - made} from cache"
        print(line)
        summary.append(line)

    if not args.no_videos:
        if not args.ffmpeg:
            sys.exit("error: ffmpeg not found (install it or pass --ffmpeg)")
        limit = int(args.video_limit_mb * 1e6)
        can_tonemap = has_filter(args.ffmpeg, "zscale")
        videos = list(badge_media(folders, VIDEO_EXTS))
        done = []
        for v in videos:
            result = shrink_video(v, limit, cache, args.ffmpeg, can_tonemap)
            if result:
                before, after, hdr = result
                note = " (HDR to SDR)" if hdr else ""
                done.append(f"`{v.relative_to(root)}`: {mb(before)} → {mb(after)}{note}")
                print(f"  {v.relative_to(root)}: {mb(before)} -> {mb(after)}{note}")
        line = f"Videos: {len(videos)} checked, {len(done)} re-encoded (limit {args.video_limit_mb:g} MB)"
        print(line)
        summary.append(line)
        summary += [f"- {d}" for d in done]

    if not args.no_prune and not (args.no_images or args.no_videos):
        removed = cache.prune()
        if removed:
            print(f"Cache: pruned {removed} unused entries")

    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as f:
            f.write("### Media\n\n" + "\n".join(summary) + "\n")


if __name__ == "__main__":
    main()
