'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { analyzeRepository } = require('..');
const { _internals } = require('../lib');

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hotfiles-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Hotfiles Test');
  git(repo, 'config', 'user.email', 'test@example.invalid');
  const write = (name, content) => { const file = path.join(repo, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  const commit = (message, date) => {
    git(repo, 'add', '-A');
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', message], { env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  };
  return { repo, write, commit };
}

test('counts one touch per commit, sorts deterministically, and filters boundaries/extensions', async t => {
  const f = fixture(t);
  f.write('src/a.JS', 'one'); f.write('src2/no.js', 'one'); f.write('src/readme.md', 'one'); f.commit('initial', '2024-01-01T00:00:00Z');
  f.write('src/a.JS', 'two'); f.write('src/readme.md', 'two'); f.commit('fix: both', '2024-02-01T00:00:00Z');
  f.write('src/a.JS', 'three'); f.commit('fix: a', '2024-03-01T00:00:00Z');
  assert.deepEqual(await analyzeRepository({ repo: f.repo, path: 'src', extensions: ['js', '.md'], ignoreExtensions: ['MD'] }), [
    { path: 'src/a.JS', commits: 3 }
  ]);
  assert.deepEqual(await analyzeRepository({ repo: f.repo, message: '^fix:', limit: 1 }), [{ path: 'src/a.JS', commits: 1 }]);
});

test('since is inclusive and limit zero is empty', async t => {
  const f = fixture(t);
  f.write('a.txt', 'one'); f.commit('one', '2024-01-01T00:00:00Z');
  f.write('a.txt', 'two'); f.commit('two', '2024-01-02T00:00:00Z');
  assert.deepEqual(await analyzeRepository({ repo: f.repo, since: '2024-01-02T00:00:00Z' }), [{ path: 'a.txt', commits: 1 }]);
  assert.deepEqual(await analyzeRepository({ repo: f.repo, limit: 0 }), []);
});

test('follows rename chains, excludes deleted files, and treats copies independently', async t => {
  const f = fixture(t);
  f.write('old.txt', 'one'); f.commit('old', '2024-01-01T00:00:00Z');
  git(f.repo, 'mv', 'old.txt', 'middle.txt'); f.commit('rename one', '2024-01-02T00:00:00Z');
  git(f.repo, 'mv', 'middle.txt', 'current.txt'); f.commit('rename two', '2024-01-03T00:00:00Z');
  f.write('gone.txt', 'x'); f.commit('add gone', '2024-01-04T00:00:00Z');
  fs.unlinkSync(path.join(f.repo, 'gone.txt')); f.commit('delete gone', '2024-01-05T00:00:00Z');
  fs.copyFileSync(path.join(f.repo, 'current.txt'), path.join(f.repo, 'copy.txt')); f.commit('copy', '2024-01-06T00:00:00Z');
  f.write('copy.txt', 'copy changed'); f.commit('change copy', '2024-01-07T00:00:00Z');
  assert.deepEqual(await analyzeRepository({ repo: f.repo }), [
    { path: 'current.txt', commits: 3 }, { path: 'copy.txt', commits: 2 }
  ]);
});

test('rejects invalid input with stable codes', async () => {
  await assert.rejects(analyzeRepository({}), { code: 'ERR_HOTFILES_INVALID_OPTIONS' });
  await assert.rejects(analyzeRepository({ repo: os.tmpdir() }), { code: 'ERR_HOTFILES_INVALID_REPOSITORY' });
  await assert.rejects(analyzeRepository({ repo: '.', limit: -1 }), { code: 'ERR_HOTFILES_INVALID_OPTIONS' });
});

test('supports empty repositories and filenames containing newlines', async t => {
  const f = fixture(t);
  assert.deepEqual(await analyzeRepository({ repo: f.repo }), []);
  f.write('odd\nname.txt', 'one'); f.commit('odd', '2024-01-01T00:00:00Z');
  assert.deepEqual(await analyzeRepository({ repo: f.repo }), [{ path: 'odd\nname.txt', commits: 1 }]);
});

test('walks all branches reachable from HEAD while excluding merge commits', async t => {
  const f = fixture(t);
  f.write('a.txt', 'base'); f.write('b.txt', 'base'); f.commit('base', '2024-01-01T00:00:00Z');
  git(f.repo, 'checkout', '-q', '-b', 'feature');
  f.write('a.txt', 'feature'); f.commit('feature', '2024-01-02T00:00:00Z');
  git(f.repo, 'checkout', '-q', 'main');
  f.write('b.txt', 'master'); f.commit('master', '2024-01-03T00:00:00Z');
  execFileSync('git', ['-C', f.repo, 'merge', '--no-ff', '-q', 'feature', '-m', 'merge'], {
    env: { ...process.env, GIT_AUTHOR_DATE: '2024-01-04T00:00:00Z', GIT_COMMITTER_DATE: '2024-01-04T00:00:00Z' }
  });
  assert.deepEqual(await analyzeRepository({ repo: f.repo }), [
    { path: 'a.txt', commits: 2 }, { path: 'b.txt', commits: 2 }
  ]);
});

test('reports missing Git with a stable code', () => {
  const script = "require('.').analyzeRepository({repo:'.'}).catch(e=>{console.log(e.code)})";
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env: { PATH: '' }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'ERR_HOTFILES_GIT_NOT_FOUND');
});

test('rejects malformed NUL-delimited Git change output', () => {
  assert.throws(() => _internals.parseChanges(Buffer.from('R100\0old.txt\0')), {
    code: 'ERR_HOTFILES_GIT', message: 'Git returned malformed rename data'
  });
  assert.throws(() => _internals.parseChanges(Buffer.from('M\0')), {
    code: 'ERR_HOTFILES_GIT', message: 'Git returned malformed change data'
  });
});

test('surfaces corrupt-repository subprocess failures as Git errors', async t => {
  const f = fixture(t);
  f.write('a.txt', 'one'); f.commit('one', '2024-01-01T00:00:00Z');
  const hash = git(f.repo, 'rev-parse', 'HEAD');
  fs.unlinkSync(path.join(f.repo, '.git', 'objects', hash.slice(0, 2), hash.slice(2)));
  await assert.rejects(analyzeRepository({ repo: f.repo }), { code: 'ERR_HOTFILES_GIT' });
});

test('analyzes available history in a shallow clone', async t => {
  const source = fixture(t);
  source.write('a.txt', 'one'); source.commit('one', '2024-01-01T00:00:00Z');
  source.write('a.txt', 'two'); source.commit('two', '2024-01-02T00:00:00Z');
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'hotfiles-shallow-'));
  t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
  execFileSync('git', ['clone', '-q', '--depth=1', `file://${source.repo}`, clone]);
  assert.deepEqual(await analyzeRepository({ repo: clone }), [{ path: 'a.txt', commits: 1 }]);
});

test('CLI exposes help/version and emits ordered JSON', async t => {
  const f = fixture(t);
  f.write('a.txt', 'one'); f.commit('one', '2024-01-01T00:00:00Z');
  const cli = path.join(__dirname, '..', 'cli.js');
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /--since/);
  const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  assert.equal(version.stdout.trim(), '1.0.0');
  const json = spawnSync(process.execPath, [cli, '--repo', f.repo, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(json.status, 0); assert.deepEqual(JSON.parse(json.stdout), [{ path: 'a.txt', commits: 1 }]);
});

test('CLI refuses collisions unless force is supplied', async t => {
  const f = fixture(t);
  f.write('a.txt', 'one'); f.commit('one', '2024-01-01T00:00:00Z');
  const output = path.join(f.repo, 'result.json'); fs.writeFileSync(output, 'keep');
  const cli = path.join(__dirname, '..', 'cli.js');
  const collision = spawnSync(process.execPath, [cli, '-r', f.repo, '-j', output], { encoding: 'utf8' });
  assert.equal(collision.status, 1); assert.equal(fs.readFileSync(output, 'utf8'), 'keep');
  const forced = spawnSync(process.execPath, [cli, '-r', f.repo, '-j', output, '--force'], { encoding: 'utf8' });
  assert.equal(forced.status, 0); assert.ok(Array.isArray(JSON.parse(fs.readFileSync(output, 'utf8'))));
});

test('CLI reports destination failures without leaving a temporary file', async t => {
  const f = fixture(t);
  f.write('a.txt', 'one'); f.commit('one', '2024-01-01T00:00:00Z');
  const missingDirectory = path.join(f.repo, 'missing', 'result.json');
  const cli = path.join(__dirname, '..', 'cli.js');
  const result = spawnSync(process.execPath, [cli, '-r', f.repo, '-j', missingDirectory], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /^hotfiles:/);
  assert.equal(fs.existsSync(`${missingDirectory}.${result.pid}.tmp`), false);
  assert.equal(fs.existsSync(missingDirectory), false);
});

test('CLI interruption does not leave partial output', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  for (let index = 0; index < 20; index += 1) {
    f.write('a.txt', String(index));
    f.commit(`commit ${index}`, new Date(Date.UTC(2024, 0, index + 1)).toISOString());
  }
  const output = path.join(f.repo, 'interrupted.json');
  const cli = path.join(__dirname, '..', 'cli.js');
  const child = spawn(process.execPath, [cli, '-r', f.repo, '-j', output]);
  await new Promise(resolve => setTimeout(resolve, 50));
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('close', resolve));
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.readdirSync(f.repo).some(name => name.includes('.tmp')), false);
});
