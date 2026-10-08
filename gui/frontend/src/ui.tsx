import { For, Show, type JSX } from 'solid-js';

export const Btn = (p: { label: string; kind?: 'primary' | 'danger' | 'toggle'; disabled?: boolean; onClick: () => void }): JSX.Element => (
  <div class={'btn ' + (p.kind ?? '') + (p.disabled ? ' off' : '')} onClick={() => { if (!p.disabled) p.onClick(); }}>
    <span>{p.label}</span>
  </div>
);

export const Chip = (p: { label: string; on: boolean; onClick: () => void }): JSX.Element => (
  <div class={'chip' + (p.on ? ' on' : '')} onClick={() => p.onClick()}>
    <span>{p.label}</span>
  </div>
);

export const Card = (p: { title?: string; children: JSX.Element }): JSX.Element => (
  <div class="card">
    <Show when={p.title}><h2>{p.title}</h2></Show>
    {p.children}
  </div>
);

/** ON/OFF switch (checkbox widgets are avoided on purpose: plain divs render the same everywhere). */
export const Switch = (p: { label: string; on: boolean; onChange: (v: boolean) => void }): JSX.Element => (
  <div class="row">
    <div class={'chip sw' + (p.on ? ' on' : '')} onClick={() => p.onChange(!p.on)}><span>{p.on ? 'ON' : 'OFF'}</span></div>
    <span class="lbl">{p.label}</span>
  </div>
);

export const TextField = (p: {
  label: string; value: string; size?: 'num' | 'wide' | ''; dirty?: boolean; onInput: (v: string) => void;
}): JSX.Element => (
  <div class="row">
    <span class="lbl fl">{p.label}{p.dirty ? ' •' : ''}</span>
    <input class={p.size ?? ''} type="text" value={p.value} onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} />
  </div>
);

export const Pre = (p: { text: string }): JSX.Element => (
  <div class="pre">
    <For each={p.text.split('\n').slice(0, 400)}>{(l) => <p class="mono">{l === '' ? ' ' : l}</p>}</For>
  </div>
);

export const Empty = (p: { text: string }): JSX.Element => <p class="sub">{p.text}</p>;

export const ask = (title: string, text: string): Promise<boolean> => silver.dialog.confirm(text, { title });
export const copyText = async (text: string, what: string, say: (s: string) => void): Promise<void> => {
  try { await silver.clipboard.writeText(text); say('Copied ' + what); } catch { say('Clipboard is not available'); }
};

/** width class bucket 1..20 for the bar charts (inline styles are not relied upon) */
export const barClass = (n: number, max: number): string => 'bar w' + Math.min(20, Math.max(n > 0 ? 1 : 0, Math.round((n / Math.max(1, max)) * 20)));
