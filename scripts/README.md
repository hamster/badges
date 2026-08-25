# scripts/

Two ways to add or edit a badge, sharing one library so they always agree:

| | What it is | Run it |
|---|---|---|
| [badge_gui/](badge_gui/) | A local web app: known-option pickers, drag-and-drop photo/video upload, a live preview of the actual badge page. **Recommended** for anyone who wants photos or video attached. | `python scripts/badge_gui/badge_gui.py` |
| [badge_cli/](badge_cli/) | The same fields, prompt-by-prompt in the terminal. No browser, no photo/video upload, no preview — everything else (create, edit, duplicate) works the same. | `python scripts/badge_cli/badge_cli.py` |
| `badge_lib.py` | Not a tool — the shared option lists, YAML read/write, and directory logic both of the above call into. Add a new option value here (or from either tool's "+ Add new…") and both pick it up. | (imported, not run) |

Each has its own README with more detail — [badge_gui/README.md](badge_gui/README.md) covers the web app and getting **ffmpeg** working for video uploads (including a Windows-specific gotcha); [badge_cli/README.md](badge_cli/README.md) covers the terminal flow and exactly what it can't do that the GUI can.

Both tools only ever touch this local checkout — no git commands, no network calls beyond what your browser does to talk to `badge_gui.py` on `localhost`. Review what they wrote, then `git add` / commit / open a PR yourself.
