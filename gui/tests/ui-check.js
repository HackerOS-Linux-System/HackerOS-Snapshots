(function () {
  const root = document.getElementById('root');
  const report = (ok, msg) => silver.invoke('__report', { ok: !!ok, msg: msg });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  const text = (el) => (el ? el.textContent : '');
  const click = (el) => el.dispatchEvent(new CustomEvent('click', { bubbles: true }));
  const type = (el, v) => { el.value = v; el.dispatchEvent(new CustomEvent('input', { bubbles: true })); };
  const byText = (sel, t) => $$(sel).find((e) => text(e).trim().indexOf(t) === 0);
  const lastText = (sel, t) => $$(sel).filter((e) => text(e).trim().indexOf(t) === 0).pop();
  // record every back-end call so the checks can assert on the real arguments
  const calls = [];
  const realInvoke = silver.invoke.bind(silver);
  silver.invoke = (c, a) => { if (c.charAt(0) !== '_') calls.push({ c: c, a: a || {} }); return realInvoke(c, a); };
  const called = (cmd, pred) => calls.some((x) => x.c === cmd && (!pred || pred(x.a)));
  const check = async (name, fn) => {
    try { const r = await fn(); await report(r === undefined ? true : r, name); }
    catch (e) { await report(false, name + ' — threw ' + (e && e.message)); }
  };

  (async () => {
    await wait(300);
    await check('boot: 8 tabs rendered', () => $$('.tab').length === 8);
    await check('dashboard: counts from `list`', () => text(root).indexOf('3 snapshots · 1 pinned') >= 0);
    await check('dashboard: total size from `usage`', () => text(root).indexOf('2.2 GB') >= 0);
    await check('dashboard: service inactive offers a start button', () => !!byText('.btn', 'Enable and start'));
    await check('config chips (root, home) shown', () => $$('.chip').filter((c) => text(c) === 'home').length === 1);

    click(byText('.tab', 'Snapshots'));
    await wait(50);
    await check('snapshots: 3 rows', () => $$('.srow').length === 3);
    await check('snapshots: size column from usage', () => text(root).indexOf('2.0 GB') >= 0);
    click(lastText('.chip', 'boot'));
    await wait(30);
    await check('snapshots: type filter -> 1 row', () => $$('.srow').length === 1);
    click(lastText('.chip', 'all'));
    const search = $$('input')[1];
    type(search, 'kernel');
    await wait(30);
    await check('snapshots: search "kernel" -> only #2', () => $$('.srow').length === 1 && text($('.srow')).indexOf('#2') >= 0);
    type(search, '');
    await wait(30);
    click(byText('.chip', 'Pinned only'));
    await wait(30);
    await check('snapshots: pinned only -> 1 row', () => $$('.srow').length === 1);
    click(byText('.chip', 'Pinned only'));
    click(byText('.chip', 'Largest'));
    await wait(30);
    await check('snapshots: sort by size puts #2 first', () => text($('.srow')).indexOf('#2') >= 0);
    click($$('.srow')[0]);
    await wait(30);
    await check('snapshots: selecting a row shows the action card', () => !!byText('.btn', 'Restore whole system') && !!byText('.btn', 'Unpin'));
    click($$('.mark')[0]); click($$('.mark')[1]);
    await wait(30);
    await check('snapshots: marking two rows enables "Compare the two"', () => text(root).indexOf('2 marked') >= 0 && !/off/.test($$('.btn').find((b) => text(b).indexOf('Compare the two') >= 0).className));

    // create snapshot -> job -> status
    click(byText('.btn', 'Create snapshot'));
    await wait(120);
    await check('create: job finished, status shows success', () => text($('.status')).indexOf('✓ Creating snapshot') >= 0);
    await check('create: job_start got -t manual and the default description', () => called('job_start', (a) => a.args.join(' ').indexOf('create -t manual -d Manual snapshot (GUI)') >= 0 && a.tool === 'hs'));
    await check('create: snapshot list is refreshed afterwards', () => calls.filter((x) => x.c === 'cli_read' && x.a.args.indexOf('list') >= 0).length >= 2);

    // diff via row action
    click(byText('.btn', 'Clear marks'));
    click($$('.srow')[0]);
    await wait(20);
    click(byText('.btn', 'vs. the system'));
    await wait(150);
    await check('diff: switched to Diff tab and listed 4 changes', () => $$('.drow').length === 4);
    await check('diff: summary chips show counts', () => !!byText('.chip', '~ 2 changed') && !!byText('.chip', '+ 1 added'));
    click(byText('.chip', '~ 2 changed'));
    await wait(30);
    await check('diff: hiding "changed" leaves 2 rows', () => $$('.drow').length === 2);
    click(byText('.chip', '~ 2 changed'));
    type($$('input').find((i) => i.className.indexOf('wide') >= 0), 'fstab');
    await wait(30);
    await check('diff: path filter "fstab" -> 1 row', () => $$('.drow').length === 1);
    click($('.drow'));
    await wait(20);
    await check('diff: picking a path offers restore', () => !!byText('.btn', 'Restore from #'));
    click(byText('.btn', 'Export list'));
    await wait(80);
    await check('diff: export writes the visible rows through file_write', () => called('file_write', (a) => a.path === '/tmp/hs-export.txt' && a.text.indexOf('c\t/etc/fstab') >= 0));
    await check('diff: job_start used --porcelain against the live system', () => called('job_start', (a) => a.args.join(' ').indexOf('diff 2 current --porcelain') >= 0));

    // browse
    click(byText('.tab', 'Browse'));
    type($$('input')[0], '2');
    click(byText('.btn', 'Open'));
    await wait(120);
    await check('browse: lists folders then files', () => $$('.drow').length === 3 && text($$('.drow')[2]).indexOf('vmlinuz') >= 0);
    click($$('.drow')[0]);
    await wait(80);
    await check('browse: entering a folder updates the breadcrumb', () => $$('.chip').some((c) => text(c) === 'etc'));

    // settings draft + save
    click(byText('.tab', 'Settings'));
    await wait(50);
    const keep = $$('input').find((i) => i.value === '5');
    await check('settings: value loaded from `config show`', () => !!keep);
    type(keep, '9');
    await wait(30);
    await check('settings: edit marks the form dirty', () => !!byText('.btn', 'Save 1 change'));
    click(byText('.btn', 'Save 1 change'));
    await wait(150);
    await check('settings: job_start carries config apply keep_boot=9', () => called('job_start', (a) => a.args.join(' ') === '-c root config apply keep_boot=9'));
    await check('settings: save clears the draft and reports success', () => !!byText('.btn', 'Save settings') && text($('.status')).indexOf('✓ Saving settings') >= 0);
    type($$('input').find((i) => i.value === '5' || i.value === '9') || $$('input')[0], 'abc');
    click(byText('.btn', 'Save'));
    await wait(60);
    await check('settings: non-numeric value is rejected', () => text($('.status')).indexOf('must be a whole number') >= 0);

    // failing job
    click(byText('.tab', 'Snapshots'));
    await wait(30);
    click($$('.srow')[0]);
    click(byText('.btn', 'Delete'));
    await wait(150);
    await check('delete: failed job is reported', () => text($('.status')).indexOf('✗ Deleting') >= 0);

    // activity, offsite, wizard
    click(byText('.tab', 'Activity'));
    await wait(40);
    await check('activity: lists the session jobs with output', () => $$('.drow').length >= 4 && $$('.pre').length === 1);
    click(byText('.tab', 'Offsite'));
    await wait(80);
    await check('offsite: status lines loaded', () => text(root).indexOf('target: (not set)') >= 0);
    click(byText('.tab', 'Setup'));
    await wait(120);
    await check('wizard: plan shows the warning', () => text(root).indexOf('free space is low') >= 0);
    await check('wizard: Apply is enabled (no error lines)', () => !/off/.test(byText('.btn', 'Apply').className));

    // dashboard recent activity + keyboard
    document.dispatchEvent(Object.assign(new CustomEvent('keydown', { bubbles: true }), { key: '1', altKey: true, ctrlKey: false }));
    await wait(40);
    await check('shortcut Alt+1 opens the dashboard', () => text(root).indexOf('Recent activity') >= 0);
    await report(true, 'done');
  })();
})();
