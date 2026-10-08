# hackeros-snapshots-gui 0.3

Silver 0.2 front-end for HackerOS Snapshots, written in **TypeScript + Solid.js**. It contains no snapshot
logic: it reads through the `hackeros-snapshots` CLI and changes the system through background jobs
(`pkexec hackeros-snapshots …`), so the window never freezes while polkit asks for a password.

| tab | what it does |
|---|---|
| Dashboard | counts, space used, snapshots-by-type chart, disk summary, service state (+ enable), recent jobs, quick actions |
| Snapshots | search, type filter, sort (newest / oldest / largest), sizes, multi-select (compare two, delete many), create with a type, cleanup preview (`--dry-run`), pin / delete / rollback |
| Diff | compare two snapshots or a snapshot and the live system (`--deep`, `--method`), filter by change kind and path, export the list, restore a file from either side |
| Browse | breadcrumbs, filter, restore in place or into a chosen folder (`--to`) |
| Settings | typed form with unsaved-change tracking, number validation, extra configs (create / delete) |
| Offsite | target, SSH options, types, retention; test / copy now / prune; live status |
| Activity | every job of the session with duration, exit code and the full output (copy to clipboard) |
| Setup | wizard: choose filesystem → preview what will change → apply → enable the service |

Shortcuts: `Ctrl+R` refresh · `Alt+1…8` switch tab. Last tab, config and list filters are remembered in
`~/.config/hackeros-snapshots/gui.json` (Silver's `localStorage` is memory-only, so the back-end stores it).

## Build

```sh
cd gui && bit            # pre-build hook: npm install + npm run build  →  frontend/dist/app.js
sudo ../packaging/install.sh
```

Needs Node 18+ for the front-end, Silver ^0.2 (stock — no patch) with its native shims (SDL2, SDL2_ttf),
and a TTF font (DejaVu Sans from the system or `frontend/fonts/DejaVuSans.ttf`).
`bit watch` (or `npm run watch` in `frontend/`) rebuilds on change; with `bit run` Silver hot-reloads `dist/app.js`.

## Layout

```
src/main.h#           window + Silver commands + on_tick (spawns the background job)
src/backend.h#        shell quoting, command whitelists, "@@rc=N" wrapper
frontend/index.html   mount point
frontend/style.css    Silver's CSS subset (bars use width classes, no inline styles)
frontend/build.mjs    esbuild + esbuild-plugin-solid  →  dist/app.js (IIFE)
frontend/src/
  api.ts              typed silver.invoke contract with main.h#
  parse.ts            pure parsers for the --porcelain output (unit-tested)
  state.ts jobs.ts draft.ts   global signals · job queue · unsaved-settings draft
  silverCompat.ts     innerHTML shim (see below)
  App.tsx main.tsx views/*.tsx ui.tsx
tests/                parse.test.ts · hs_runner.c + ui-check.js + mocks.tsv · run-ui-test.sh
```

### Back-end commands (`silver.invoke`)

| command | args → result |
|---|---|
| `sys_info` | → `{root, service, store, store_exists, home, silver}` |
| `cli_read` | `{args:[…]}` → `{rc, out}` — read-only CLI calls, **whitelisted** in `backend::read_allowed` |
| `job_start` | `{id, args:[…], tool:"hs"\|"service"}` → `{queued}` — whitelisted in `backend::job_allowed`; the result of the task arrives as `silver://task` `{id, output}` ending in `@@rc=N` |
| `file_write` | `{path, text}` → `{ok}` — capability `fs`, used by "Export list" |
| `prefs_load` / `prefs_save` | → JSON stored in `~/.config/hackeros-snapshots/gui.json` |

A command handler cannot see `App`, so `job_start` answers with the directive `ui::set_state("job_req", …)`;
`on_tick` (which has `App`) reads it and calls `app::spawn_task`. Arguments are shell-quoted one by one in H#.

### Two Silver quirks the front-end works around

1. **No delegated events.** Solid's default delegated handlers redefine `Event.currentTarget` as a getter-only
   property, which Silver's own dispatch then fails to assign (`no setter for property`). `build.mjs` compiles with
   `solid: { delegateEvents: false }`, so `onClick` becomes a plain `addEventListener`.
2. **`<!>` markers.** Silver's built-in `innerHTML` parser drops the empty comment Solid inserts between static text
   and expressions (`#{id} · {type}`), which breaks `nextSibling` walks. `silverCompat.ts` rewrites it to `<!---->`,
   which the parser keeps.

## Tests

```sh
cd frontend && npm run typecheck && npm test      # tsc + 10 parser unit tests
sh tests/run-ui-test.sh /path/to/silver           # 37 UI checks in Silver's QuickJS layer (mocked back-end)
```

`run-ui-test.sh` needs `native/build/libsilverjs.a` from Silver (the JS part of `native/build.sh`; no SDL needed).
The scenario drives the real bundle through tabs, filters, selection, create / diff / export / settings-save / failing
job / wizard and asserts on the DOM **and** on the arguments sent to the back-end.

## Not verified

The H# side (`src/*.h#`) was parsed by H#'s parser and checked for return paths, but never compiled or run: there was
no `bit`/LLVM toolchain. Rendering (layout, colours, fonts, glyphs such as ☑ ★ ▸) was not seen on a real SDL window.
`pkexec`, `spawn_task`, `silver://task` and the dialogs were exercised only against mocks. Try `bit` + a real run
before relying on it.
