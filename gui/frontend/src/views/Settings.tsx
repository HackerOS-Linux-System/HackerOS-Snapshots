import { For, Show, createEffect, createSignal, on, type JSX } from 'solid-js';
import { Btn, Card, Chip, Switch, TextField, ask } from '../ui';
import { cfg, configs, setStatus, switchConfig } from '../state';
import { runJob } from '../jobs';
import { dirtyKeys, edit, isDirty, isOn, resetDraft, saveFields, value, type Field } from '../draft';

const bool = (key: string, label: string, rootOnly = false): Field => ({ key, label, kind: 'bool', rootOnly });
const num = (key: string, label: string, rootOnly = false): Field => ({ key, label, kind: 'num', size: 'num', rootOnly });

export const GROUPS: { title: string; fields: Field[] }[] = [
  { title: 'When to take snapshots', fields: [
    bool('enabled', 'Automatic snapshots'), bool('snapshot_on_boot', 'Snapshot at every boot'),
    bool('timeline', 'Timeline snapshots'), num('timeline_minutes', 'Timeline every (minutes)'), bool('apt_hooks', 'Snapshot before/after apt'),
  ] },
  { title: 'What to keep', fields: [
    bool('cleanup_on_boot', 'Clean up at every boot'),
    num('keep_boot', 'Keep boot snapshots'), num('keep_timeline', 'Keep timeline snapshots'),
    num('keep_prepost', 'Keep apt pairs'), num('keep_manual', 'Keep manual snapshots'),
    num('max_age_days', 'Delete older than (days)'), num('keep_min', 'Always keep the newest'),
    num('max_usage_percent', 'Snapshots may use (% of disk)'), num('min_free_percent', 'Keep at least (% free)'),
    bool('emergency_cleanup', 'Delete oldest when the disk is full'),
    num('keep_rollback_roots', 'Keep old roots after rollback', true), num('rollback_root_days', 'Delete old roots after (days)', true),
  ] },
  { title: 'Other', fields: [
    { key: 'excludes', label: 'Exclude paths (comma separated; - clears)', kind: 'text', size: 'wide' },
    bool('grub', 'GRUB restore entries', true), num('grub_max', 'Entries in the GRUB menu', true),
  ] },
];
const ALL: Field[] = [...GROUPS.flatMap((g) => g.fields), { key: 'notify_level', label: 'Notifications', kind: 'text', rootOnly: true }];
const NOTIFY = ['off', 'errors', 'all'];

export default function Settings(): JSX.Element {
  const [newName, setNewName] = createSignal('');
  const [source, setSource] = createSignal('/');
  createEffect(on(cfg, () => resetDraft()));

  const visible = (f: Field) => !f.rootOnly || cfg() === 'root';
  const pending = () => dirtyKeys(ALL).length;

  const create = () => {
    const n = newName().trim();
    if (!/^[A-Za-z0-9_-]+$/.test(n)) { setStatus('Config name: letters, digits, - and _ only'); return; }
    runJob({ label: 'Creating config ' + n, kind: 'cfgnew', args: ['config', 'create', n, '--source', source().trim() || '/'], after: (j) => { if (j.rc === 0) { setNewName(''); void switchConfig(n); } } });
  };
  const remove = async () => {
    if (cfg() === 'root') { setStatus('The root config cannot be deleted'); return; }
    if (!(await ask('Delete config', "Remove config '" + cfg() + "'? Its snapshots are not deleted."))) return;
    runJob({ label: 'Removing config ' + cfg(), kind: 'cfgdel', args: ['config', 'delete', cfg()], after: (j) => { if (j.rc === 0) void switchConfig('root'); } });
  };
  const pickSource = async () => { const d = await silver.dialog.folder({ title: 'Directory to snapshot' }); if (d) setSource(d); };

  return (
    <div>
      <div class="row">
        <Btn label={pending() ? 'Save ' + pending() + ' change' + (pending() > 1 ? 's' : '') : 'Save settings'} kind="primary" onClick={() => saveFields(ALL.filter(visible), 'Saving settings')} />
        <Btn label="Discard changes" disabled={pending() === 0} onClick={resetDraft} />
        <span class="lbl">config: {cfg()}{pending() ? ' · unsaved changes' : ''}</span>
      </div>
      <For each={GROUPS}>{(g) => (
        <Card title={g.title}>
          <For each={g.fields.filter(visible)}>{(f) => (
            f.kind === 'bool'
              ? <Switch label={f.label + (isDirty(f.key) ? ' •' : '')} on={isOn(f.key)} onChange={(v) => edit(f.key, v ? 'true' : 'false')} />
              : <TextField label={f.label} size={f.size} value={value(f.key)} dirty={isDirty(f.key)} onInput={(v) => edit(f.key, v)} />
          )}</For>
        </Card>
      )}</For>
      <Show when={cfg() === 'root'}>
        <Card title="Notifications">
          <div class="row">
            <For each={NOTIFY}>{(n) => <Chip label={n} on={value('notify_level') === n} onClick={() => edit('notify_level', n)} />}</For>
            <Show when={isDirty('notify_level')}><span class="lbl">•</span></Show>
          </div>
          <div class="row"><Btn label="Delete old rollback roots now" onClick={() => runJob({ label: 'Deleting old rollback roots', kind: 'roots', args: ['-c', 'root', 'roots', 'prune'] })} /></div>
        </Card>
      </Show>
      <Card title="Configs">
        <div class="row"><span class="lbl">Active: {cfg()} ({configs().length} total)</span>
          <Show when={cfg() !== 'root'}><Btn label="Delete this config" kind="danger" onClick={() => void remove()} /></Show></div>
        <div class="row">
          <span class="lbl">New config</span>
          <input type="text" value={newName()} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} />
          <span class="lbl">source</span>
          <input class="wide" type="text" value={source()} onInput={(e) => setSource((e.target as HTMLInputElement).value)} />
          <Btn label="Choose…" onClick={() => void pickSource()} />
          <Btn label="Create" onClick={create} />
        </div>
      </Card>
    </div>
  );
}
