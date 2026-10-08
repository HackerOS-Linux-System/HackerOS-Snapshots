import { For, Show, createEffect, createSignal, on, type JSX } from 'solid-js';
import { Btn, Card, Chip, Empty, Pre } from '../ui';
import { cli } from '../api';
import { parsePlan } from '../parse';
import { cfg, setStatus, sys } from '../state';
import { jobs, runJob } from '../jobs';
import type { PlanLine } from '../types';

export default function Wizard(): JSX.Element {
  const [fs, setFs] = createSignal('auto');
  const [plan, setPlan] = createSignal<PlanLine[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [step, setStep] = createSignal(1);

  const loadPlan = async () => {
    setLoaded(false);
    const args = ['init', '--plan', '--porcelain'];
    if (fs() !== 'auto') args.push('--fs', fs());
    const r = await cli(cfg(), args).catch(() => null);
    setPlan(r ? parsePlan(r.out) : [{ kind: 'error', msg: 'Could not run hackeros-snapshots init --plan' }]);
    setLoaded(true);
  };
  createEffect(on([cfg, fs], () => { if (step() === 1) void loadPlan(); }));

  const blocked = () => plan().some((p) => p.kind === 'error');
  const apply = () => {
    const args = ['-c', cfg(), 'init', '--yes'];
    if (fs() === 'btrfs' || fs() === 'ext4') args.push('--fs', fs());
    setStep(2);
    runJob({ label: "Setting up '" + cfg() + "'", kind: 'init', args });
  };
  const initJob = () => jobs().find((j) => j.kind === 'init');
  const cls = (k: PlanLine['kind']) => (k === 'error' ? 'err' : k === 'warn' ? 'warn' : k === 'fs' ? 'sel' : 'step');
  const mark = (k: PlanLine['kind']) => (k === 'step' ? '  → ' : k === 'warn' ? '  ! ' : k === 'error' ? '  ✗ ' : '');

  return (
    <div>
      <Show when={step() === 1}>
        <Card title={"Set up '" + cfg() + "'"}>
          <p class="sub">Prepares the snapshot store. Nothing is changed until you press Apply.</p>
          <div class="row">
            <span class="lbl">File system</span>
            <For each={['auto', 'btrfs', 'ext4']}>{(f) => <Chip label={f} on={fs() === f} onClick={() => setFs(f)} />}</For>
          </div>
        </Card>
        <Card title="What will change">
          <Show when={loaded()} fallback={<Empty text="Checking the system…" />}>
            <For each={plan()} fallback={<Empty text="No plan available." />}>{(p) => <p class={cls(p.kind)}>{mark(p.kind) + p.msg}</p>}</For>
          </Show>
        </Card>
        <div class="row">
          <Btn label="Apply" kind="primary" disabled={!loaded() || blocked()} onClick={apply} />
          <Btn label="Re-check" onClick={() => void loadPlan()} />
        </div>
      </Show>
      <Show when={step() === 2}>
        <Card title="Setting up…">
          <Show when={initJob()} fallback={<Empty text="Starting…" />}>{(j) => (
            <>
              <p class={j().state === 'ok' ? 'sel ok' : j().state === 'fail' ? 'err' : 'sub'}>
                {j().state === 'ok' ? '✓ Done' : j().state === 'fail' ? '✗ Failed (exit ' + j().rc + ')' : 'Working…'}
              </p>
              <Show when={j().out !== ''}><Pre text={j().out} /></Show>
            </>
          )}</Show>
        </Card>
        <div class="row">
          <Show when={sys()?.service !== 'active'}>
            <Btn label="Enable the background service" kind="primary" onClick={() => runJob({ label: 'Starting the background service', kind: 'service', args: [], tool: 'service' })} />
          </Show>
          <Btn label="Run the check again" onClick={() => { setStep(1); void loadPlan(); setStatus('Ready'); }} />
        </div>
      </Show>
    </div>
  );
}
