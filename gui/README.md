# hackeros-snapshots-gui

Silver front-end for HackerOS Snapshots. It contains no snapshot logic: it reads through the
`hackeros-snapshots` CLI and changes the system through background jobs (`pkexec hackeros-snapshots …`),
so the window never freezes while polkit asks for a password or a snapshot is taken.

| tab | what it does |
|---|---|
| Snapshots | scrolling list of all snapshots, create / delete / pin, compare, browse, restore the whole system |
| Diff | what changed between two snapshots (or a snapshot and now); restore one file from either side |
| Browse | walk through a snapshot's folders, restore a file or folder |
| Settings | triggers, cleanup rules, disk limits, excludes, GRUB, notifications, extra configs (e.g. /home) |
| Offsite | target, SSH options, test / copy now / prune |
| Setup | wizard: choose filesystem → preview exactly what will change → apply → start the service |

## Build

1. Build the native Silver shims once (SDL2, SDL2_ttf, optionally tinyfiledialogs) — `../vendor/silver/native/README.md`.
2. `cd gui && bit`  →  `gui/cache/build/release/hackeros-snapshots-gui`
3. `sudo ../packaging/install.sh`

`../vendor/silver` is stock Silver plus `../vendor/silver-hsnap.patch` (periodic `on_tick`, id of the clicked
element, scroll clamp). Silver text needs a TTF font: DejaVu Sans from the system, or `frontend/fonts/DejaVuSans.ttf`.

## How it works

```
src/main.h#      window, click handling (state key "_click"), periodic tick, job results
src/views.h#     every screen as an HTML string (loaded with app::load_html_str)
src/jobs.h#      background jobs: sh -c … &  + rc/out files, polled from the tick
src/backend.h#   CLI reads, pkexec prefix, HTML-safe text
frontend/        style.css (Silver's CSS subset)
```
