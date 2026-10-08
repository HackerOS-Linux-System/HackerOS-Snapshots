import type { CliResult, Prefs, SysInfo } from './types';

interface Commands {
  sys_info: { args: undefined; result: SysInfo };
  cli_read: { args: { args: string[] }; result: CliResult };
  job_start: { args: { id: string; args: string[]; tool: 'hs' | 'service' }; result: { queued: boolean } };
  file_write: { args: { path: string; text: string }; result: { ok: boolean } };
  prefs_load: { args: undefined; result: Prefs };
  prefs_save: { args: { prefs: Prefs }; result: { ok: boolean } };
}

function call<K extends keyof Commands>(
  cmd: K,
  ...args: Commands[K]['args'] extends undefined ? [] : [Commands[K]['args']]
): Promise<Commands[K]['result']> {
  return silver.invoke(cmd, args[0] as Record<string, unknown> | undefined);
}

export const sysInfo = () => call('sys_info');
export const prefsLoad = () => call('prefs_load');
export const prefsSave = (prefs: Prefs) => call('prefs_save', { prefs });
export const fileWrite = (path: string, text: string) => call('file_write', { path, text });
export const jobStart = (id: string, args: string[], tool: 'hs' | 'service') => call('job_start', { id, args, tool });

/** Read-only CLI call, config-aware:  cli('root', ['list','--porcelain']). */
export const cli = (cfg: string, args: string[]) => call('cli_read', { args: ['-c', cfg, ...args] });
/** Calls that are not tied to a config (config list, config create …). */
export const cliRaw = (args: string[]) => call('cli_read', { args });
