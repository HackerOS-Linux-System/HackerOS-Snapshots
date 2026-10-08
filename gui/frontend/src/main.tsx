import './silverCompat'; // must run before the first template is created
import { render } from 'solid-js/web';
import App, { installShortcuts } from './App';
import { initJobs } from './jobs';
import { loadPrefs, refreshAll, setStatus } from './state';

async function boot(): Promise<void> {
  initJobs();
  installShortcuts();
  render(() => <App />, document.getElementById('root')!);
  try {
    await loadPrefs();
    await refreshAll();
    setStatus('Ready');
  } catch (e) {
    setStatus('Could not talk to the back-end: ' + String((e as { message?: string })?.message ?? e));
  }
}

void boot();
