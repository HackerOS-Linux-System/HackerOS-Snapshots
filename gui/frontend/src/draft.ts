import { createSignal } from 'solid-js';
import { cfg, cfgMap, setStatus } from './state';
import { runJob } from './jobs';

export type FieldKind = 'bool' | 'num' | 'text';
export interface Field { key: string; label: string; kind: FieldKind; size?: 'num' | 'wide'; rootOnly?: boolean }

/** Unsaved edits for the Settings / Offsite forms (only changed keys are stored). */
export const [draft, setDraft] = createSignal<Record<string, string>>({});

export const value = (key: string): string => draft()[key] ?? cfgMap()[key] ?? '';
export const isOn = (key: string): boolean => value(key) === 'true';
export const isDirty = (key: string): boolean => key in draft() && draft()[key] !== (cfgMap()[key] ?? '');

export function edit(key: string, v: string): void {
  setDraft((d) => {
    const n = { ...d };
    if (v === (cfgMap()[key] ?? '')) delete n[key]; else n[key] = v;
    return n;
  });
}
export const dirtyKeys = (fields: Field[]): string[] => fields.filter((f) => isDirty(f.key)).map((f) => f.key);
export const resetDraft = (): void => { setDraft({}); };

/** Validates and sends `config apply k=v …`. Returns false (and says why) on invalid input. */
export function saveFields(fields: Field[], label: string): boolean {
  const pairs: string[] = [];
  for (const f of fields) {
    if (!isDirty(f.key)) continue;
    const v = value(f.key).trim();
    if (f.kind === 'num' && !/^\d+$/.test(v)) { setStatus("'" + f.label + "' must be a whole number"); return false; }
    pairs.push(f.key + '=' + (f.kind === 'text' && v === '-' ? '' : v));
  }
  if (pairs.length === 0) { setStatus('Nothing to change'); return true; }
  runJob({
    label, kind: 'cfg', args: ['-c', cfg(), 'config', 'apply', ...pairs],
    after: (j) => { if (j.rc === 0) resetDraft(); },
  });
  return true;
}
