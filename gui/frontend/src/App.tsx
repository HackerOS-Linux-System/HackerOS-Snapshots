import { For, Match, Show, Switch, createEffect, type JSX } from 'solid-js';
import {
  cfg, configs, goto, loading, refreshAll, savePrefsSoon, setView, status, switchConfig, view, snaps, sort, typeFilter, pinnedOnly,
} from './state';
import { jobs, queuedCount, running, tick } from './jobs';
import type { View } from './types';
import Dashboard from './views/Dashboard';
import Snapshots from './views/Snapshots';
import Diff from './views/Diff';
import Browse from './views/Browse';
import Settings from './views/Settings';
import Offsite from './views/Offsite';
import Activity from './views/Activity';
import Wizard from './views/Wizard';

export const TABS: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'snaps', label: 'Snapshots' }, { id: 'diff', label: 'Diff' },
  { id: 'browse', label: 'Browse' }, { id: 'settings', label: 'Settings' }, { id: 'offsite', label: 'Offsite' },
  { id: 'activity', label: 'Activity' }, { id: 'wizard', label: 'Setup' },
];
const SPIN = ['|', '/', '-', '\\'];

export default function App(): JSX.Element {
  // keep prefs in sync (debounced inside savePrefsSoon)
  createEffect(() => { view(); cfg(); sort(); typeFilter(); pinnedOnly(); savePrefsSoon(); });

  const busy = () => { void tick(); const r = running(); return r ? SPIN[tick() % SPIN.length] + ' ' + r.label + (queuedCount() ? '  (+' + queuedCount() + ' queued)' : '') : ''; };
  const activityBadge = () => jobs().filter((j) => j.state === 'running' || j.state === 'queued').length;

  return (
    <div class="page">
      <div class="row top">
        <h1>HackerOS Snapshots</h1>
        <div class="grow" />
        <Show when={configs().length > 1}>
          <span class="lbl">config</span>
          <For each={configs()}>{(c) => <div class={'chip' + (cfg() === c ? ' on' : '')} onClick={() => void switchConfig(c)}><span>{c}</span></div>}</For>
        </Show>
      </div>
      <div class="row">
        <For each={TABS}>{(t) => (
          <div class={'tab' + (view() === t.id ? ' on' : '')} onClick={() => goto(t.id)}>
            <span>{t.label}{t.id === 'activity' && activityBadge() > 0 ? ' (' + activityBadge() + ')' : ''}{t.id === 'snaps' && snaps().length > 0 ? ' · ' + snaps().length : ''}</span>
          </div>
        )}</For>
      </div>
      <Switch>
        <Match when={view() === 'dashboard'}><Dashboard /></Match>
        <Match when={view() === 'snaps'}><Snapshots /></Match>
        <Match when={view() === 'diff'}><Diff /></Match>
        <Match when={view() === 'browse'}><Browse /></Match>
        <Match when={view() === 'settings'}><Settings /></Match>
        <Match when={view() === 'offsite'}><Offsite /></Match>
        <Match when={view() === 'activity'}><Activity /></Match>
        <Match when={view() === 'wizard'}><Wizard /></Match>
      </Switch>
      <div class="status">
        <p>{busy() !== '' ? busy() : status()}{loading() ? '   · refreshing…' : ''}</p>
      </div>
    </div>
  );
}

/** Ctrl+R refresh · Alt+1…8 switch tab (typing in a field is never intercepted). */
export function installShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) { void refreshAll(); return; }
    if (e.altKey && e.key >= '1' && e.key <= '8') {
      const t = TABS[parseInt(e.key, 10) - 1];
      if (t) setView(t.id);
    }
  });
}
