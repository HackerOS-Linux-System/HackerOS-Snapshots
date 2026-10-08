import type { BrowseRow, DiffRow, PlanLine, Snap } from './types';

const ANSI = /\x1b\[[0-9;]*m/g;
export const stripAnsi = (s: string): string => s.replace(ANSI, '');

/** Job output ends with "@@rc=N" (added by the H# side). */
export function splitRc(raw: string): { out: string; rc: number } {
  const i = raw.lastIndexOf('@@rc=');
  if (i < 0) return { out: raw, rc: 1 };
  const n = parseInt(raw.slice(i + 5).trim(), 10);
  return { out: raw.slice(0, i), rc: Number.isFinite(n) ? n : 1 };
}

const lines = (s: string): string[] => s.split('\n').filter((l) => l.trim() !== '');

/** id \t type \t epoch \t date \t pin(*|-) \t desc \t kernel \t pre */
export function parseSnaps(out: string): Snap[] {
  const rows: Snap[] = [];
  for (const ln of lines(out)) {
    const f = ln.split('\t');
    const id = parseInt(f[0] ?? '', 10);
    if (!Number.isFinite(id)) continue;
    rows.push({
      id,
      type: f[1] ?? '',
      epoch: parseInt(f[2] ?? '0', 10) || 0,
      date: f[3] ?? '',
      pinned: f[4] === '*',
      desc: f[5] ?? '',
      kernel: f[6] ?? '',
      pre: parseInt(f[7] ?? '0', 10) || 0,
    });
  }
  return rows;
}

/** id \t megabytes */
export function parseUsage(out: string): Record<number, number> {
  const m: Record<number, number> = {};
  for (const ln of lines(out)) {
    const f = ln.split('\t');
    const id = parseInt(f[0] ?? '', 10);
    const mb = parseInt(f[1] ?? '', 10);
    if (Number.isFinite(id) && Number.isFinite(mb)) m[id] = mb;
  }
  return m;
}

/** kind \t path   with kind one of + - c m r */
export function parseDiff(out: string): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const ln of out.split('\n')) {
    if (ln.length > 2 && ln[1] === '\t' && '+-cmr'.includes(ln[0])) {
      rows.push({ kind: ln[0] as DiffRow['kind'], path: ln.slice(2) });
    }
  }
  return rows;
}

/** d|f \t size(bytes) \t name */
export function parseBrowse(out: string): BrowseRow[] {
  const rows: BrowseRow[] = [];
  for (const ln of lines(out)) {
    const f = ln.split('\t');
    if (f.length >= 3) rows.push({ dir: f[0] === 'd', size: parseInt(f[1] ?? '0', 10) || 0, name: f[2] });
  }
  return rows;
}

/** `config show`:  -> key => value */
export function parseCfg(out: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const ln of out.split('\n')) {
    const r = /^\s*->\s*([\w.-]+)\s*=>\s*(.*)$/.exec(ln);
    if (r) m[r[1]] = r[2].trim();
  }
  return m;
}

export function parsePlan(out: string): PlanLine[] {
  const rows: PlanLine[] = [];
  for (const ln of lines(out)) {
    const f = ln.split('\t');
    if (f[0] === 'fs' || f[0] === 'step' || f[0] === 'warn' || f[0] === 'error') {
      rows.push({ kind: f[0], msg: f[1] ?? '' });
    }
  }
  return rows;
}

export const parseNames = (out: string): string[] => lines(out).map((l) => l.trim());

// ── formatting ─────────────────────────────────────────────────────────────────
export function fmtMb(mb: number | undefined): string {
  if (mb === undefined) return '—';
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return mb + ' MB';
}

export function fmtBytes(b: number): string {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
}

export const parentPath = (p: string): string => {
  if (p === '/' || p === '') return '/';
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
};
export const joinPath = (base: string, name: string): string => (base === '/' ? '/' + name : base + '/' + name);
