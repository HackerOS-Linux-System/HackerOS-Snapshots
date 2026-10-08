import assert from 'node:assert/strict';
import { fmtBytes, fmtDuration, fmtMb, joinPath, parentPath, parseBrowse, parseCfg, parseDiff, parsePlan, parseSnaps, parseUsage, splitRc, stripAnsi } from '../frontend/src/parse';

let n = 0;
const t = (name: string, fn: () => void): void => { fn(); n++; console.log('  ok  ' + name); };

t('parseSnaps reads all fields and skips junk', () => {
  const r = parseSnaps('7\tmanual\t1700000000\t2026-10-01 08:00\t*\tBefore update\t6.1.0\t3\nnot a row\n\n8\tboot\t1700000100\t2026-10-01 08:05\t-\tBoot\t\t0\n');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { id: 7, type: 'manual', epoch: 1700000000, date: '2026-10-01 08:00', pinned: true, desc: 'Before update', kernel: '6.1.0', pre: 3 });
  assert.equal(r[1].pinned, false);
  assert.equal(r[1].kernel, '');
});
t('parseUsage', () => assert.deepEqual(parseUsage('1\t120\n2\t2048\nx\ty\n'), { 1: 120, 2: 2048 }));
t('parseDiff keeps only valid kinds and tabs in paths', () => {
  const r = parseDiff('+\t/etc/a\n-\t/etc/b\nc\t/with space/x\nz\t/bad\nplain line\n.\t/meta');
  assert.deepEqual(r.map((x) => x.kind), ['+', '-', 'c']);
  assert.equal(r[2].path, '/with space/x');
});
t('parseBrowse', () => {
  const r = parseBrowse('d\t0\tetc\nf\t2048\tvmlinuz\nbroken\n');
  assert.deepEqual(r, [{ dir: true, size: 0, name: 'etc' }, { dir: false, size: 2048, name: 'vmlinuz' }]);
});
t('parseCfg strips ANSI-free key => value lines', () => {
  const r = parseCfg('[root]\n-> keep_boot => 5\n-> excludes => \n-> grub_max=>3\nnoise\n');
  assert.equal(r.keep_boot, '5');
  assert.equal(r.excludes, '');
  assert.equal(r.grub_max, '3');
});
t('parsePlan', () => assert.deepEqual(parsePlan('fs\tbtrfs\nstep\tdo it\nbogus\tx\nerror\tno'), [{ kind: 'fs', msg: 'btrfs' }, { kind: 'step', msg: 'do it' }, { kind: 'error', msg: 'no' }]));
t('splitRc', () => {
  assert.deepEqual(splitRc('hello\n@@rc=0\n'), { out: 'hello\n', rc: 0 });
  assert.deepEqual(splitRc('bad\n@@rc=13'), { out: 'bad\n', rc: 13 });
  assert.equal(splitRc('no marker').rc, 1);
  assert.equal(splitRc('x@@rc=1 and later text @@rc=2').rc, 2);
});
t('stripAnsi', () => assert.equal(stripAnsi('\x1b[1;32mok\x1b[0m done'), 'ok done'));
t('formatters', () => {
  assert.equal(fmtMb(undefined), '—'); assert.equal(fmtMb(512), '512 MB'); assert.equal(fmtMb(2048), '2.0 GB');
  assert.equal(fmtBytes(10), '10 B'); assert.equal(fmtBytes(2048), '2.0 KB'); assert.equal(fmtBytes(5 * 1048576), '5.0 MB');
  assert.equal(fmtDuration(4000), '4 s'); assert.equal(fmtDuration(125000), '2 min 5 s');
});
t('paths', () => {
  assert.equal(parentPath('/a/b'), '/a'); assert.equal(parentPath('/a'), '/'); assert.equal(parentPath('/'), '/');
  assert.equal(joinPath('/', 'etc'), '/etc'); assert.equal(joinPath('/etc', 'fstab'), '/etc/fstab');
});
console.log(n + ' tests passed');
