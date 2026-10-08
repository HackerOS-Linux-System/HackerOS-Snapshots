import { createSignal, batch } from 'solid-js';
import * as api from './api';
import { parseCfg, parseNames, parseSnaps, parseUsage, stripAnsi } from './parse';
import type { DiffRow, Prefs, Snap, SysInfo, View } from './types';

export const [view, setView] = createSignal<View>('dashboard');
export const [cfg, setCfg] = createSignal('root');
export const [configs, setConfigs] = createSignal<string[]>(['root']);
export const [snaps, setSnaps] = createSignal<Snap[]>([]);
export const [sizes, setSizes] = createSignal<Record<number, number>>({});
export const [sizesKnown, setSizesKnown] = createSignal(false);
export const [cfgMap, setCfgMap] = createSignal<Record<string, string>>({});
export const [sys, setSys] = createSignal<SysInfo | null>(null);
export const [diskLines, setDiskLines] = createSignal<string[]>([]);
export const [status, setStatus] = createSignal('Ready');
export const [loading, setLoading] = createSignal(false);

// snapshot list UI
export const [sel, setSel] = createSignal<number | null>(null);
export const [marked, setMarked] = createSignal<number[]>([]);
export const [query, setQuery] = createSignal('');
export const [typeFilter, setTypeFilter] = createSignal('all');
export const [sort, setSort] = createSignal<'new' | 'old' | 'size'>('new');
export const [pinnedOnly, setPinnedOnly] = createSignal(false);
export const [limit, setLimit] = createSignal(100);

// diff
export const [diffA, setDiffA] = createSignal('');
export const [diffB, setDiffB] = createSignal('');
export const [diffRows, setDiffRows] = createSignal<DiffRow[]>([]);
export const [diffDone, setDiffDone] = createSignal(false);

// browse
export const [browseId, setBrowseId] = createSignal('');
export const [browsePath, setBrowsePath] = createSignal('/');

export const goto = (v: View): void => { setView(v); };

export async function refreshSnaps(): Promise<void> {
  const c = cfg();
  const [l, u] = await Promise.all([
    api.cli(c, ['list', '--porcelain']).catch(() => null),
    api.cli(c, ['usage', '--porcelain']).catch(() => null),
  ]);
  batch(() => {
    if (l && l.rc === 0) setSnaps(parseSnaps(l.out));
    else setSnaps([]);
    const ok = !!u && u.rc === 0;
    setSizes(ok ? parseUsage(u!.out) : {});
    setSizesKnown(ok && Object.keys(parseUsage(u!.out)).length > 0);
    const cur = sel();
    if (cur !== null && !snaps().some((s) => s.id === cur)) setSel(null);
    setMarked(marked().filter((id) => snaps().some((s) => s.id === id)));
  });
}

export async function refreshCfg(): Promise<void> {
  const [show, names] = await Promise.all([
    api.cli(cfg(), ['config', 'show']).catch(() => null),
    api.cliRaw(['config', 'list']).catch(() => null),
  ]);
  batch(() => {
    setCfgMap(show && show.rc === 0 ? parseCfg(stripAnsi(show.out)) : {});
    const n = names && names.rc === 0 ? parseNames(names.out) : [];
    setConfigs(n.length ? n : ['root']);
    if (!configs().includes(cfg())) setCfg('root');
  });
}

export async function refreshDisk(): Promise<void> {
  const r = await api.cli(cfg(), ['usage']).catch(() => null);
  const ls = r && r.rc === 0 ? stripAnsi(r.out).split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('────')) : [];
  setDiskLines(ls.slice(0, 8));
}

export async function refreshSys(): Promise<void> {
  try { setSys(await api.sysInfo()); } catch { /* keep the last value */ }
}

export async function refreshAll(): Promise<void> {
  setLoading(true);
  try { await Promise.all([refreshSnaps(), refreshCfg(), refreshSys(), refreshDisk()]); }
  finally { setLoading(false); }
}

export async function switchConfig(name: string): Promise<void> {
  batch(() => {
    setCfg(name); setSel(null); setMarked([]); setDiffRows([]); setDiffDone(false);
    setBrowseId(''); setBrowsePath('/');
  });
  await refreshAll();
}

// ── preferences (stored by the H# side: localStorage in Silver is memory-only) ───
export async function loadPrefs(): Promise<void> {
  try {
    const p = await api.prefsLoad();
    batch(() => {
      if (p.view) setView(p.view);
      if (p.cfg) setCfg(p.cfg);
      if (p.sort) setSort(p.sort);
      if (p.typeFilter) setTypeFilter(p.typeFilter);
      if (typeof p.pinnedOnly === 'boolean') setPinnedOnly(p.pinnedOnly);
    });
  } catch { /* first start: no file */ }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function savePrefsSoon(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p: Prefs = { view: view(), cfg: cfg(), sort: sort(), typeFilter: typeFilter(), pinnedOnly: pinnedOnly() };
    void api.prefsSave(p).catch(() => undefined);
  }, 600);
}

export function toggleMark(id: number): void {
  setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
}
