import { For, Show, createMemo, createSignal, type JSX } from 'solid-js';
import { Btn, Card, Chip, Empty, ask } from '../ui';
import { fmtMb } from '../parse';
import {
  cfg, limit, marked, pinnedOnly, query, sel, setBrowseId, setBrowsePath, setDiffA, setDiffB, setLimit, setMarked, setPinnedOnly,
  setQuery, setSel, setSort, setTypeFilter, setView, sizes, sizesKnown, snaps, sort, toggleMark, typeFilter,
} from '../state';
import { runDiffJob, runJob } from '../jobs';
import type { Snap } from '../types';

const SNAP_TYPES = ['manual', 'pre', 'post', 'boot', 'timeline'];

export default function Snapshots(): JSX.Element {
  const [desc, setDesc] = createSignal('');
  const [ctype, setCtype] = createSignal('manual');

  const types = createMemo(() => Array.from(new Set(snaps().map((s) => s.type))).sort());
  const shown = createMemo<Snap[]>(() => {
    const q = query().trim().toLowerCase();
    const tf = typeFilter();
    const list = snaps().filter((s) =>
      (tf === 'all' || s.type === tf) && (!pinnedOnly() || s.pinned) &&
      (q === '' || (s.id + ' ' + s.type + ' ' + s.desc + ' ' + s.kernel + ' ' + s.date).toLowerCase().includes(q)));
    const m = sort();
    return list.sort((a, b) => (m === 'old' ? a.epoch - b.epoch : m === 'size' ? (sizes()[b.id] ?? -1) - (sizes()[a.id] ?? -1) : b.epoch - a.epoch));
  });
  const picked = (): Snap | undefined => snaps().find((s) => s.id === sel());
  const previous = (): Snap | undefined => {
    const p = picked();
    return p ? snaps().filter((s) => s.epoch < p.epoch).sort((a, b) => b.epoch - a.epoch)[0] : undefined;
  };

  const create = () => runJob({
    label: 'Creating snapshot', kind: 'create',
    args: ['-c', cfg(), 'create', '-t', ctype(), '-d', desc().trim() || 'Manual snapshot (GUI)'],
    after: (j) => { if (j.rc === 0) setDesc(''); },
  });
  const compare = (a: number, b: number | null) => { setDiffA(String(a)); setDiffB(b === null ? '' : String(b)); setView('diff'); runDiffJob(cfg(), String(a), b === null ? '' : String(b), false, 'auto'); };
  const browse = (id: number) => { setBrowseId(String(id)); setBrowsePath('/'); setView('browse'); };

  const togglePin = (s: Snap) => runJob({ label: (s.pinned ? 'Unpinning #' : 'Pinning #') + s.id, kind: 'pin', args: ['-c', cfg(), s.pinned ? 'unpin' : 'pin', String(s.id)] });
  const rollback = async (s: Snap) => {
    if (!(await ask('Restore the whole system', 'Restore the WHOLE system to snapshot #' + s.id + '?\nA reboot is needed afterwards. Everything changed since then is lost.'))) return;
    runJob({ label: 'Restoring snapshot #' + s.id, kind: 'rollback', args: ['-c', cfg(), 'rollback', String(s.id), '--yes'] });
  };
  const remove = async (ids: number[]) => {
    const pinned = snaps().filter((s) => ids.includes(s.id) && s.pinned).length;
    const text = 'Delete ' + (ids.length === 1 ? 'snapshot #' + ids[0] : ids.length + ' snapshots') + '?' + (pinned ? '\n' + pinned + ' of them pinned.' : '') + '\nThis cannot be undone.';
    if (!(await ask('Delete', text))) return;
    for (const id of ids) runJob({ label: 'Deleting #' + id, kind: 'delete', args: ['-c', cfg(), 'delete', String(id)] });
    setMarked([]); setSel(null);
  };
  const compareMarked = () => {
    const m = [...marked()].sort((a, b) => a - b);
    if (m.length === 2) compare(m[0], m[1]);
  };

  return (
    <div>
      <Card title="New snapshot">
        <div class="row">
          <input class="wide" type="text" value={desc()} onInput={(e) => setDesc((e.target as HTMLInputElement).value)} />
          <For each={SNAP_TYPES}>{(t) => <Chip label={t} on={ctype() === t} onClick={() => setCtype(t)} />}</For>
        </div>
        <div class="row">
          <Btn label="Create snapshot" kind="primary" onClick={create} />
          <Btn label="Preview cleanup" onClick={() => runJob({ label: 'Cleanup preview', kind: 'plan', args: ['-c', cfg(), 'cleanup', '--dry-run'], after: () => setView('activity') })} />
          <Btn label="Clean up now" onClick={async () => { if (await ask('Clean up', 'Apply the retention rules now? Snapshots that exceed them are deleted.')) runJob({ label: 'Cleaning up old snapshots', kind: 'cleanup', args: ['-c', cfg(), 'cleanup'] }); }} />
        </div>
      </Card>

      <div class="row">
        <input class="wide" type="text" value={query()} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        <span class="lbl">search</span>
        <Chip label="Newest" on={sort() === 'new'} onClick={() => setSort('new')} />
        <Chip label="Oldest" on={sort() === 'old'} onClick={() => setSort('old')} />
        <Chip label="Largest" on={sort() === 'size'} onClick={() => setSort('size')} />
        <Chip label="Pinned only" on={pinnedOnly()} onClick={() => setPinnedOnly(!pinnedOnly())} />
      </div>
      <div class="row">
        <Chip label="all" on={typeFilter() === 'all'} onClick={() => setTypeFilter('all')} />
        <For each={types()}>{(t) => <Chip label={t} on={typeFilter() === t} onClick={() => setTypeFilter(t)} />}</For>
        <span class="lbl">{shown().length} of {snaps().length}</span>
      </div>

      <Show when={marked().length > 0}>
        <div class="card">
          <div class="row">
            <span class="sel">{marked().length} marked</span>
            <Btn label="Compare the two" disabled={marked().length !== 2} onClick={compareMarked} />
            <Btn label="Delete marked" kind="danger" onClick={() => void remove(marked())} />
            <Btn label="Clear marks" onClick={() => setMarked([])} />
          </div>
        </div>
      </Show>

      <Show when={picked()}>{(s) => (
        <div class="card">
          <p class="sel">#{s().id} · {s().type} · {s().date}{s().pinned ? ' · pinned' : ''}</p>
          <p class="sub">{s().desc}{s().kernel ? '   kernel ' + s().kernel : ''}</p>
          <div class="row">
            <Btn label="vs. the system" onClick={() => compare(s().id, null)} />
            <Show when={previous()}>{(p) => <Btn label={'vs. #' + p().id + ' (previous)'} onClick={() => compare(p().id, s().id)} />}</Show>
            <Btn label="Browse files" onClick={() => browse(s().id)} />
            <Btn label={s().pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(s())} />
            <Btn label="Restore whole system" kind="danger" onClick={() => void rollback(s())} />
            <Btn label="Delete" kind="danger" onClick={() => void remove([s().id])} />
          </div>
        </div>
      )}</Show>

      <div class="thead">
        <span class="c-mark"> </span><span class="c-id">ID</span><span class="c-type">Type</span><span class="c-date">Date</span>
        <span class="c-pin">Pin</span><span class="c-size">Size</span><span class="c-desc">Description</span>
      </div>
      <Show when={shown().length > 0} fallback={<Empty text={snaps().length === 0 ? 'No snapshots (or the store is not set up — see the Setup tab).' : 'Nothing matches the filter.'} />}>
        <For each={shown().slice(0, limit())}>{(s) => (
          <div class="row nogap">
            <div class="mark" onClick={() => toggleMark(s.id)}><span>{marked().includes(s.id) ? '☑' : '☐'}</span></div>
            <div class={'srow grow' + (sel() === s.id ? ' picked' : '')} onClick={() => setSel(s.id)}>
              <span class="c-id">#{s.id}</span><span class="c-type">{s.type}</span><span class="c-date">{s.date}</span>
              <span class="c-pin">{s.pinned ? '★' : ''}</span>
              <span class="c-size">{sizesKnown() ? fmtMb(sizes()[s.id]) : '—'}</span>
              <span class="c-desc">{s.desc}</span>
            </div>
          </div>
        )}</For>
        <Show when={shown().length > limit()}>
          <Btn label={'Show more (' + (shown().length - limit()) + ' left)'} onClick={() => setLimit(limit() + 100)} />
        </Show>
      </Show>
    </div>
  );
}
