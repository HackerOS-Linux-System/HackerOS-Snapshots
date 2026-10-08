import { For, createEffect, createSignal, on, type JSX } from 'solid-js';
import { Btn, Card, Switch, TextField } from '../ui';
import { cli } from '../api';
import { stripAnsi } from '../parse';
import { cfg } from '../state';
import { runJob, jobs } from '../jobs';
import { dirtyKeys, edit, isDirty, isOn, resetDraft, saveFields, value, type Field } from '../draft';

const FIELDS: Field[] = [
  { key: 'offsite', label: 'Copy snapshots offsite', kind: 'bool' },
  { key: 'offsite_after_create', label: 'Copy right after they are taken', kind: 'bool' },
  { key: 'offsite_target', label: 'Target (/mnt/disk/dir or root@host:/dir)', kind: 'text', size: 'wide' },
  { key: 'offsite_ssh_opts', label: 'SSH options (e.g. -i /root/.ssh/key)', kind: 'text', size: 'wide' },
  { key: 'offsite_types', label: 'Snapshot types to copy', kind: 'text', size: 'wide' },
  { key: 'offsite_keep', label: 'Keep on target (0 = all)', kind: 'num', size: 'num' },
];

export default function Offsite(): JSX.Element {
  const [lines, setLines] = createSignal<string[]>([]);
  const load = async () => {
    const r = await cli(cfg(), ['offsite', 'status']).catch(() => null);
    setLines(r && r.rc === 0 ? stripAnsi(r.out).split('\n').filter((l) => l.trim() && !l.includes('────')) : []);
  };
  createEffect(on([cfg, () => jobs().filter((j) => j.kind === 'off' && j.state !== 'queued' && j.state !== 'running').length], () => { resetDraft(); void load(); }));
  const go = (label: string, sub: string) => runJob({ label, kind: 'off', args: ['-c', cfg(), 'offsite', sub] });
  const pending = () => dirtyKeys(FIELDS).length;

  return (
    <div>
      <Card title={'Offsite copies — ' + cfg()}>
        <For each={FIELDS}>{(f) => (
          f.kind === 'bool'
            ? <Switch label={f.label + (isDirty(f.key) ? ' •' : '')} on={isOn(f.key)} onChange={(v) => edit(f.key, v ? 'true' : 'false')} />
            : <TextField label={f.label} size={f.size} value={value(f.key)} dirty={isDirty(f.key)} onInput={(v) => edit(f.key, v)} />
        )}</For>
        <div class="row">
          <Btn label={pending() ? 'Save ' + pending() + ' change' + (pending() > 1 ? 's' : '') : 'Save'} kind="primary" onClick={() => saveFields(FIELDS, 'Saving offsite settings')} />
          <Btn label="Discard" disabled={pending() === 0} onClick={resetDraft} />
        </div>
      </Card>
      <Card title="Actions">
        <div class="row">
          <Btn label="Test the target" onClick={() => go('Testing the offsite target', 'test')} />
          <Btn label="Copy now" onClick={() => go('Copying snapshots offsite', 'run')} />
          <Btn label="Prune the target" onClick={() => go('Pruning the offsite target', 'prune')} />
        </div>
      </Card>
      <Card title="Status">
        <For each={lines()} fallback={<p class="sub">No status available.</p>}>{(l) => <p class="mono">{l}</p>}</For>
      </Card>
    </div>
  );
}
