export type View = 'dashboard' | 'snaps' | 'diff' | 'browse' | 'settings' | 'offsite' | 'activity' | 'wizard';

export interface Snap {
  id: number;
  type: string;
  epoch: number;
  date: string;
  pinned: boolean;
  desc: string;
  kernel: string;
  pre: number;
}

export interface DiffRow { kind: '+' | '-' | 'c' | 'r' | 'm'; path: string }
export interface BrowseRow { dir: boolean; size: number; name: string }
export interface PlanLine { kind: 'fs' | 'step' | 'warn' | 'error'; msg: string }

export interface SysInfo {
  root: boolean;
  service: string;
  store: string;
  store_exists: boolean;
  home: string;
  silver: string;
}

export interface CliResult { rc: number; out: string }

export type JobState = 'queued' | 'running' | 'ok' | 'fail';
export interface Job {
  id: number;
  label: string;
  kind: string;
  args: string[];
  tool: 'hs' | 'service';
  state: JobState;
  rc: number | null;
  out: string;
  started: number;
  ended: number;
}

export interface Prefs {
  view?: View;
  cfg?: string;
  sort?: 'new' | 'old' | 'size';
  typeFilter?: string;
  pinnedOnly?: boolean;
}
