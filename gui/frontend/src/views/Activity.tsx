import { For, Show, type JSX } from 'solid-js';
import { Btn, Card, Empty, Pre, copyText } from '../ui';
import { fmtDuration } from '../parse';
import { setStatus } from '../state';
import { clearFinished, jobs, selectedJob, setSelectedJob, tick } from '../jobs';

export default function Activity(): JSX.Element {
  const current = () => jobs().find((j) => j.id === selectedJob()) ?? jobs().find((j) => j.state !== 'queued') ?? jobs()[0];
  const dur = (j: { started: number; ended: number; state: string }) => {
    void tick();
    return j.started === 0 ? '' : fmtDuration((j.state === 'running' ? Date.now() : j.ended) - j.started);
  };
  return (
    <div>
      <div class="row">
        <Btn label="Clear finished" onClick={clearFinished} />
        <span class="lbl">{jobs().length} job{jobs().length === 1 ? '' : 's'} in this session</span>
      </div>
      <Show when={jobs().length > 0} fallback={<Card title="Activity"><Empty text="Jobs you start (snapshots, restores, cleanups…) appear here with their full output." /></Card>}>
        <For each={jobs()}>{(j) => (
          <div class={'drow' + (current()?.id === j.id ? ' picked' : '')} onClick={() => setSelectedJob(j.id)}>
            <span class={'c-pin ' + (j.state === 'ok' ? 'k-add' : j.state === 'fail' ? 'k-del' : 'k-chg')}>
              {j.state === 'ok' ? '✓' : j.state === 'fail' ? '✗' : j.state === 'running' ? '…' : '·'}
            </span>
            <span class="c-desc">{j.label}</span>
            <span class="c-type">{j.state === 'queued' ? 'queued' : dur(j)}</span>
          </div>
        )}</For>
        <Show when={current()}>{(j) => (
          <Card title={j().label}>
            <p class="sub">{'hackeros-snapshots ' + j().args.join(' ')}{j().rc !== null ? '   (exit ' + j().rc + ')' : ''}</p>
            <div class="row">
              <Btn label="Copy output" disabled={j().out === ''} onClick={() => void copyText(j().out, 'output', setStatus)} />
            </div>
            <Show when={j().out !== ''} fallback={<Empty text={j().state === 'running' || j().state === 'queued' ? 'Waiting for the result…' : 'No output.'} />}>
              <Pre text={j().out} />
            </Show>
          </Card>
        )}</Show>
      </Show>
    </div>
  );
}
