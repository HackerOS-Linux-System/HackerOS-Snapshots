import { For, Show, createMemo, createSignal, type JSX } from 'solid-js';
import { Btn, Card, Chip, Empty, ask, copyText } from '../ui';
import { cfg, diffA, diffB, diffDone, diffRows, setDiffA, setDiffB, setStatus } from '../state';
import { runDiffJob, runJob } from '../jobs';
import { fileWrite } from '../api';
import type { DiffRow } from '../types';

const KINDS: { k: DiffRow['kind']; label: string; cls: string; sign: string }[] = [
  { k: '+', label: 'added', cls: 'k-add', sign: '+' },
  { k: '-', label: 'removed', cls: 'k-del', sign: '−' },
  { k: 'c', label: 'changed', cls: 'k-chg', sign: '~' },
  { k: 'r', label: 'renamed', cls: 'k-ren', sign: '→' },
  { k: 'm', label: 'metadata', cls: 'k-meta', sign: '·' },
];

export default function Diff(): JSX.Element {
  const [deep, setDeep] = createSignal(false);
  const [method, setMethod] = createSignal('auto');
  const [hidden, setHidden] = createSignal<string[]>([]);
  const [filter, setFilter] = createSignal('');
  const [pick, setPick] = createSignal<string>('');
  const [more, setMore] = createSignal(300);

  const counts = createMemo(() => {
    const m: Record<string, number> = {};
    for (const r of diffRows()) m[r.kind] = (m[r.kind] ?? 0) + 1;
    return m;
  });
  const shown = createMemo(() => {
    const f = filter().trim().toLowerCase();
    return diffRows().filter((r) => !hidden().includes(r.kind) && (f === '' || r.path.toLowerCase().includes(f)));
  });
  const kindOf = (k: string) => KINDS.find((x) => x.k === k)!;

  const run = () => {
    const a = parseInt(diffA(), 10);
    if (!(a > 0)) { setStatus('Enter the number of the first snapshot'); return; }
    setPick(''); setMore(300);
    runDiffJob(cfg(), diffA().trim(), diffB().trim(), deep(), method());
  };
  const restore = async (id: string) => {
    const p = pick();
    if (p === '' || p === '/') { setStatus('Pick a file or folder first'); return; }
    if (!(await ask('Restore from snapshot #' + id, 'Replace ' + p + ' with the version from snapshot #' + id + '?\nThe current version is kept in /var/lib/hackeros-snapshots/restore-backups/.'))) return;
    runJob({ label: 'Restoring ' + p, kind: 'restore', args: ['-c', cfg(), 'restore', id, p, '--yes'] });
  };
  const exportReport = async () => {
    const path = await silver.dialog.save({ title: 'Export the diff', name: 'snapshot-diff-' + diffA() + '-' + (diffB() || 'system') + '.txt' });
    if (!path) return;
    const text = shown().map((r) => r.kind + '\t' + r.path).join('\n') + '\n';
    try { await fileWrite(path, text); setStatus('✓ Exported ' + shown().length + ' lines to ' + path); }
    catch (e) { setStatus('✗ Export failed: ' + String((e as { message?: string })?.message ?? e)); }
  };
  const toggleKind = (k: string) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  return (
    <div>
      <Card title="Compare snapshots">
        <div class="row">
          <span class="lbl">From #</span>
          <input class="num" type="text" value={diffA()} onInput={(e) => setDiffA((e.target as HTMLInputElement).value)} />
          <span class="lbl">to # (empty = the live system)</span>
          <input class="num" type="text" value={diffB()} onInput={(e) => setDiffB((e.target as HTMLInputElement).value)} />
          <Btn label="Compare" kind="primary" onClick={run} />
        </div>
        <div class="row">
          <Chip label="Compare contents (slow)" on={deep()} onClick={() => { setDeep(!deep()); if (deep()) setMethod('rsync'); }} />
          <span class="lbl">method</span>
          <For each={['auto', 'send', 'rsync']}>{(m) => <Chip label={m} on={method() === m} onClick={() => setMethod(m)} />}</For>
        </div>
      </Card>

      <Show when={diffDone()} fallback={<Empty text="Run a comparison to see what changed." />}>
        <div class="row">
          <For each={KINDS}>{(k) => (
            <Show when={(counts()[k.k] ?? 0) > 0}>
              <Chip label={k.sign + ' ' + (counts()[k.k] ?? 0) + ' ' + k.label} on={!hidden().includes(k.k)} onClick={() => toggleKind(k.k)} />
            </Show>
          )}</For>
          <input class="wide" type="text" value={filter()} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} />
          <span class="lbl">path filter</span>
        </div>
        <Show when={pick() !== ''}>
          <div class="card">
            <p class="sel">{pick()}</p>
            <div class="row">
              <Btn label={'Restore from #' + diffA()} onClick={() => void restore(diffA().trim())} />
              <Show when={parseInt(diffB(), 10) > 0}><Btn label={'Restore from #' + diffB()} onClick={() => void restore(diffB().trim())} /></Show>
              <Btn label="Copy path" onClick={() => void copyText(pick(), 'path', setStatus)} />
            </div>
          </div>
        </Show>
        <div class="row">
          <span class="lbl">{shown().length} of {diffRows().length} changes</span>
          <Btn label="Export list…" onClick={() => void exportReport()} />
        </div>
        <Show when={shown().length > 0} fallback={<Empty text={diffRows().length === 0 ? 'No differences.' : 'Nothing matches the filter.'} />}>
          <For each={shown().slice(0, more())}>{(r) => (
            <div class={'drow' + (pick() === r.path ? ' picked' : '')} onClick={() => setPick(r.path)}>
              <span class={'c-kind ' + kindOf(r.kind).cls}>{kindOf(r.kind).sign + ' ' + kindOf(r.kind).label}</span>
              <span class="c-path">{r.path}</span>
            </div>
          )}</For>
          <Show when={shown().length > more()}>
            <Btn label={'Show more (' + (shown().length - more()) + ' left)'} onClick={() => setMore(more() + 300)} />
          </Show>
        </Show>
      </Show>
    </div>
  );
}
