import { For, Show, createEffect, createMemo, createSignal, on, type JSX } from 'solid-js';
import { Btn, Card, Empty, ask, copyText } from '../ui';
import { cli } from '../api';
import { fmtBytes, joinPath, parentPath, parseBrowse } from '../parse';
import { browseId, browsePath, cfg, setBrowseId, setBrowsePath, setStatus, snaps } from '../state';
import { runJob } from '../jobs';
import type { BrowseRow } from '../types';

export default function Browse(): JSX.Element {
  const [rows, setRows] = createSignal<BrowseRow[]>([]);
  const [err, setErr] = createSignal('');
  const [pick, setPick] = createSignal('');
  const [filter, setFilter] = createSignal('');
  const [idInput, setIdInput] = createSignal(browseId());

  const load = async () => {
    const id = browseId();
    setPick('');
    if (!(parseInt(id, 10) > 0)) { setRows([]); setErr(''); return; }
    try {
      const r = await cli(cfg(), ['browse', id, browsePath(), '--porcelain']);
      if (r.rc === 0) { setRows(parseBrowse(r.out)); setErr(''); }
      else { setRows([]); setErr('Cannot open #' + id + ' ' + browsePath() + ' (root may be required, or the path does not exist).'); }
    } catch (e) { setErr(String((e as { message?: string })?.message ?? e)); }
  };
  createEffect(on([browseId, browsePath, cfg], () => { setIdInput(browseId()); void load(); }));

  const shown = createMemo(() => {
    const f = filter().trim().toLowerCase();
    return rows().filter((r) => f === '' || r.name.toLowerCase().includes(f))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  });
  const crumbs = createMemo(() => {
    const parts = browsePath().split('/').filter(Boolean);
    const out = [{ name: '/', path: '/' }];
    let cur = '';
    for (const p of parts) { cur += '/' + p; out.push({ name: p, path: cur }); }
    return out;
  });
  const target = () => (pick() !== '' ? joinPath(browsePath(), pick()) : browsePath());
  const enter = (r: BrowseRow) => { if (r.dir) { setBrowsePath(joinPath(browsePath(), r.name)); setFilter(''); } else setPick(r.name); };

  const restore = async (to?: string) => {
    const t = target(); const id = browseId();
    if (t === '/') { setStatus('Pick a file or folder first (the whole system: use "Restore whole system")'); return; }
    const msg = to ? 'Copy ' + t + ' from snapshot #' + id + ' into ' + to + '?' : 'Replace ' + t + ' with the version from snapshot #' + id + '?\nThe current version is kept in /var/lib/hackeros-snapshots/restore-backups/.';
    if (!(await ask('Restore from snapshot #' + id, msg))) return;
    const args = ['-c', cfg(), 'restore', id, t, '--yes'];
    if (to) args.push('--to', to);
    runJob({ label: 'Restoring ' + t, kind: 'restore', args });
  };
  const restoreTo = async () => {
    const dir = await silver.dialog.folder({ title: 'Restore into…' });
    if (dir) await restore(dir);
  };
  const go = () => { setBrowseId(idInput().trim()); setBrowsePath('/'); };

  return (
    <div>
      <Card title="Browse a snapshot">
        <div class="row">
          <span class="lbl">Snapshot #</span>
          <input class="num" type="text" value={idInput()} onInput={(e) => setIdInput((e.target as HTMLInputElement).value)} />
          <Btn label="Open" kind="primary" onClick={go} />
          <Btn label="Up" disabled={browsePath() === '/'} onClick={() => setBrowsePath(parentPath(browsePath()))} />
          <Show when={snaps().length > 0}>
            <span class="lbl">latest: #{snaps().reduce((m, s) => Math.max(m, s.id), 0)}</span>
          </Show>
        </div>
        <div class="row">
          <For each={crumbs()}>{(c) => <div class="chip" onClick={() => setBrowsePath(c.path)}><span>{c.name}</span></div>}</For>
        </div>
        <div class="row">
          <input class="wide" type="text" value={filter()} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} />
          <span class="lbl">filter · {shown().length} entries</span>
        </div>
      </Card>

      <Show when={err() !== ''}><p class="err">{err()}</p></Show>
      <Show when={browseId() !== '' && err() === ''}>
        <div class="card">
          <p class="sel">{target()}</p>
          <div class="row">
            <Btn label="Restore here" kind="primary" onClick={() => void restore()} />
            <Btn label="Restore into a folder…" onClick={() => void restoreTo()} />
            <Btn label="Copy path" onClick={() => void copyText(target(), 'path', setStatus)} />
          </div>
        </div>
      </Show>

      <Show when={rows().length > 0 || browseId() === ''} fallback={<Empty text="Empty directory." />}>
        <Show when={browseId() === ''}><Empty text="Enter a snapshot number and press Open." /></Show>
        <For each={shown()}>{(r) => (
          <div class={'drow' + (!r.dir && pick() === r.name ? ' picked' : '')} onClick={() => enter(r)}>
            <span class={'c-kind ' + (r.dir ? 'k-dir' : 'k-file')}>{r.dir ? '▸ folder' : 'file'}</span>
            <span class="c-id">{r.dir ? '' : fmtBytes(r.size)}</span>
            <span class="c-path">{r.name}</span>
          </div>
        )}</For>
      </Show>
    </div>
  );
}
