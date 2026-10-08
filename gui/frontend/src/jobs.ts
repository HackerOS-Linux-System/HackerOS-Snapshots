import { createSignal } from 'solid-js';
import * as api from './api';
import { fmtDuration, parseDiff, splitRc, stripAnsi } from './parse';
import { refreshAll, setDiffDone, setDiffRows, setStatus } from './state';
import type { Job } from './types';

export const [jobs, setJobs] = createSignal<Job[]>([]);
export const [tick, setTick] = createSignal(0);
export const [selectedJob, setSelectedJob] = createSignal<number | null>(null);

const MAX_HISTORY = 60;
const READ_ONLY_KINDS = new Set(['diff', 'plan']);
let nextId = 1;
let windowFocused = true;
const afterHooks = new Map<number, (job: Job) => void>();
let spinTimer: ReturnType<typeof setInterval> | undefined;

export interface JobSpec {
  label: string;
  kind: string;
  args: string[];
  tool?: 'hs' | 'service';
  after?: (job: Job) => void;
}

const update = (id: number, patch: Partial<Job>): void => {
  setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
};

export const running = (): Job | undefined => jobs().find((j) => j.state === 'running');
export const queuedCount = (): number => jobs().filter((j) => j.state === 'queued').length;

export function runJob(spec: JobSpec): number {
  const id = nextId++;
  const job: Job = {
    id, label: spec.label, kind: spec.kind, args: spec.args, tool: spec.tool ?? 'hs',
    state: 'queued', rc: null, out: '', started: 0, ended: 0,
  };
  if (spec.after) afterHooks.set(id, spec.after);
  setJobs((list) => [job, ...list].slice(0, MAX_HISTORY));
  setStatus(spec.label + (running() ? ' (queued)' : ' …'));
  pump();
  return id;
}

function pump(): void {
  if (running()) return;
  const next = [...jobs()].reverse().find((j) => j.state === 'queued');
  if (!next) {
    if (spinTimer !== undefined) { clearInterval(spinTimer); spinTimer = undefined; }
    return;
  }
  update(next.id, { state: 'running', started: Date.now() });
  if (spinTimer === undefined) spinTimer = setInterval(() => setTick((n) => n + 1), 250);
  api.jobStart('job-' + next.id, next.args, next.tool).catch((e: unknown) => {
    finish(next.id, 1, 'Could not start: ' + String((e as { message?: string })?.message ?? e));
  });
}

function finish(id: number, rc: number, rawOut: string): void {
  const job = jobs().find((j) => j.id === id);
  if (!job) return;
  const out = stripAnsi(rawOut).trim();
  const ended = Date.now();
  update(id, { state: rc === 0 ? 'ok' : 'fail', rc, out, ended });
  const last = out.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
  const took = fmtDuration(ended - job.started);
  const showLast = last !== '' && job.kind !== 'diff';
  setStatus(rc === 0
    ? '✓ ' + job.label + (showLast ? ' — ' + last : '') + '  (' + took + ')'
    : '✗ ' + job.label + ' failed' + (last ? ': ' + last : ''));
  if (!windowFocused) {
    void silver.window.notify('HackerOS Snapshots', (rc === 0 ? '✓ ' : '✗ ') + job.label).catch(() => undefined);
  }
  const hook = afterHooks.get(id);
  afterHooks.delete(id);
  const done: Job = { ...job, state: rc === 0 ? 'ok' : 'fail', rc, out, ended };
  try { hook?.(done); } catch (e) { console.error(e); }
  if (!READ_ONLY_KINDS.has(job.kind)) void refreshAll();
  pump();
}

/** Called once from main.tsx. */
export function initJobs(): void {
  silver.listen<{ id: string; output: string }>('silver://task', (p) => {
    const m = /^job-(\d+)$/.exec(p.id);
    if (!m) return;
    const { out, rc } = splitRc(p.output ?? '');
    finish(parseInt(m[1], 10), rc, out);
  });
  silver.listen('silver://blur', () => { windowFocused = false; });
  silver.listen('silver://focus', () => { windowFocused = true; });
}

export function clearFinished(): void {
  setJobs((l) => l.filter((j) => j.state === 'queued' || j.state === 'running'));
  setSelectedJob(null);
}

/** Convenience for the diff screen: run `diff` and publish the rows. */
export function runDiffJob(cfgName: string, a: string, b: string, deep: boolean, method: string): void {
  const bid = parseInt(b, 10) > 0 ? b : 'current';
  const args = ['-c', cfgName, 'diff', a, bid, '--porcelain'];
  if (deep) args.push('--deep');
  if (method !== 'auto') args.push('--method', method);
  setDiffDone(false);
  runJob({
    label: 'Comparing #' + a + ' with ' + (bid === 'current' ? 'the system' : '#' + bid),
    kind: 'diff',
    args,
    after: (job) => { setDiffRows(parseDiff(job.out)); setDiffDone(true); },
  });
}
