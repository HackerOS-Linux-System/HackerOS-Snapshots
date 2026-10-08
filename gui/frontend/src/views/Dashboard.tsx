import { For, Show, createMemo, type JSX } from 'solid-js';
import { Btn, Card, Empty, barClass } from '../ui';
import { fmtMb } from '../parse';
import { cfg, diskLines, goto, setSel, setView, sizes, sizesKnown, snaps, sys, refreshAll, loading } from '../state';
import { jobs, runJob, setSelectedJob } from '../jobs';
import type { Snap } from '../types';

export default function Dashboard(): JSX.Element {
  const byType = createMemo(() => {
    const m: Record<string, number> = {};
    for (const s of snaps()) m[s.type] = (m[s.type] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  });
  const maxCount = () => byType().reduce((mx, [, n]) => Math.max(mx, n), 1);
  const pinned = () => snaps().filter((s) => s.pinned).length;
  const newest = (): Snap | undefined => snaps().reduce<Snap | undefined>((a, s) => (!a || s.epoch > a.epoch ? s : a), undefined);
  const oldest = (): Snap | undefined => snaps().reduce<Snap | undefined>((a, s) => (!a || s.epoch < a.epoch ? s : a), undefined);
  const total = () => Object.values(sizes()).reduce((a, b) => a + b, 0);
  const service = () => sys()?.service ?? '…';
  const recent = () => jobs().slice(0, 5);

  const createNow = () => runJob({ label: 'Creating snapshot', kind: 'create', args: ['-c', cfg(), 'create', '-d', 'Manual snapshot (GUI)'] });
  const preview = () => {
    runJob({ label: 'Cleanup preview', kind: 'plan', args: ['-c', cfg(), 'cleanup', '--dry-run'], after: (j) => { setSelectedJob(j.id); setView('activity'); } });
  };

  return (
    <div>
      <div class="row">
        <Btn label="New snapshot" kind="primary" onClick={createNow} />
        <Btn label="Preview cleanup" onClick={preview} />
        <Btn label={loading() ? 'Refreshing…' : 'Refresh'} onClick={() => void refreshAll()} />
      </div>

      <div class="row top">
        <div class="card half">
          <h2>Overview — {cfg()}</h2>
          <p class="sel">{snaps().length} snapshots · {pinned()} pinned</p>
          <p class="sub">Newest: {newest() ? '#' + newest()!.id + '  ' + newest()!.date : '—'}</p>
          <p class="sub">Oldest: {oldest() ? '#' + oldest()!.id + '  ' + oldest()!.date : '—'}</p>
          <p class="sub">Space used by snapshots: {sizesKnown() ? fmtMb(total()) : 'unknown (needs root)'}</p>
        </div>
        <div class="card half">
          <h2>Background service</h2>
          <p class={service() === 'active' ? 'sel ok' : 'warn'}>{service() === 'active' ? '● running' : '○ ' + service()}</p>
          <p class="sub">Takes boot / timeline snapshots and applies the retention rules.</p>
          <Show when={service() !== 'active'}>
            <Btn label="Enable and start" onClick={() => runJob({ label: 'Starting the background service', kind: 'service', args: [], tool: 'service' })} />
          </Show>
        </div>
      </div>

      <Card title="Snapshots by type">
        <Show when={byType().length > 0} fallback={<Empty text="No snapshots yet — create the first one." />}>
          <For each={byType()}>{([type, n]) => (
            <div class="row">
              <span class="lbl tl">{type}</span>
              <div class={barClass(n, maxCount())}><span> </span></div>
              <span class="lbl">{n}</span>
            </div>
          )}</For>
        </Show>
      </Card>

      <Show when={diskLines().length > 0}>
        <Card title="Disk">
          <For each={diskLines()}>{(l) => <p class="mono">{l}</p>}</For>
        </Card>
      </Show>

      <Card title="Recent activity">
        <Show when={recent().length > 0} fallback={<Empty text="Nothing has been run in this session." />}>
          <For each={recent()}>{(j) => (
            <div class="row" onClick={() => { setSelectedJob(j.id); goto('activity'); }}>
              <span class={'lbl ' + (j.state === 'ok' ? 'k-add' : j.state === 'fail' ? 'k-del' : 'k-chg')}>
                {j.state === 'ok' ? '✓' : j.state === 'fail' ? '✗' : '…'}
              </span>
              <span class="lbl">{j.label}</span>
            </div>
          )}</For>
        </Show>
      </Card>
      <Btn label="Open the snapshot list" onClick={() => { setSel(null); goto('snaps'); }} />
    </div>
  );
}
