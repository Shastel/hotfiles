'use strict';

const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');

class HotfilesError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'HotfilesError';
    this.code = code;
  }
}

function invalid(message, cause) {
  return new HotfilesError('ERR_HOTFILES_INVALID_OPTIONS', message, cause);
}

function normalizeExtensions(value, name) {
  if (value === undefined) return new Set();
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length === 0)) {
    throw invalid(`${name} must be an array of non-empty strings`);
  }
  return new Set(value.map(item => {
    const extension = item.toLowerCase();
    return extension.startsWith('.') ? extension : `.${extension}`;
  }));
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw invalid('options must be an object');
  if (typeof options.repo !== 'string' || options.repo.trim() === '') throw invalid('repo is required');
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 0)) {
    throw invalid('limit must be a non-negative safe integer');
  }
  if (options.path !== undefined && typeof options.path !== 'string') throw invalid('path must be a string');
  if (options.message !== undefined && typeof options.message !== 'string') throw invalid('message must be a string');

  let message;
  try { message = new RegExp(options.message || ''); } catch (error) { throw invalid('message must be a valid regular expression', error); }

  let since;
  if (options.since !== undefined && options.since !== '') {
    if (typeof options.since !== 'string' && !(options.since instanceof Date)) throw invalid('since must be a date string or Date');
    since = new Date(options.since);
    if (Number.isNaN(since.getTime())) throw invalid('since must be a valid date');
  }

  const scopedPath = (options.path || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
  if (scopedPath.split('/').includes('..')) throw invalid('path must stay inside the repository');

  return {
    repo: path.resolve(options.repo), scopedPath,
    limit: options.limit === undefined ? Infinity : options.limit,
    message, since,
    extensions: normalizeExtensions(options.extensions, 'extensions'),
    ignoreExtensions: normalizeExtensions(options.ignoreExtensions, 'ignoreExtensions')
  };
}

function gitError(args, code, stderr, cause) {
  const detail = stderr.trim();
  const message = detail || `git ${args[0]} failed${code === null ? '' : ` with exit code ${code}`}`;
  return new HotfilesError('ERR_HOTFILES_GIT', message, cause);
}

function runGit(repo, args, { allowEmpty = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', repo, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', error => reject(new HotfilesError(
      error.code === 'ENOENT' ? 'ERR_HOTFILES_GIT_NOT_FOUND' : 'ERR_HOTFILES_GIT',
      error.code === 'ENOENT' ? 'Git was not found on PATH' : `Could not start Git: ${error.message}`,
      error
    )));
    child.on('close', code => {
      const output = Buffer.concat(stdout);
      if (code === 0 || (allowEmpty && code === 128)) resolve(output);
      else reject(gitError(args, code, Buffer.concat(stderr).toString('utf8')));
    });
  });
}

async function assertRepository(repo) {
  try {
    const result = (await runGit(repo, ['rev-parse', '--is-inside-work-tree'])).toString().trim();
    if (result !== 'true') throw new Error('not a work tree');
  } catch (error) {
    if (error.code === 'ERR_HOTFILES_GIT_NOT_FOUND') throw error;
    throw new HotfilesError('ERR_HOTFILES_INVALID_REPOSITORY', `Not a Git repository: ${repo}`, error);
  }
}

async function currentFiles(repo) {
  const output = await runGit(repo, ['ls-files', '-z']);
  return new Set(output.toString('utf8').split('\0').filter(Boolean));
}

async function commitMetadata(repo, hash) {
  const output = await runGit(repo, ['show', '-s', '--format=%ct%x00%B', hash]);
  const separator = output.indexOf(0);
  if (separator < 0) throw new HotfilesError('ERR_HOTFILES_GIT', 'Git returned malformed commit metadata');
  return { timestamp: Number(output.subarray(0, separator).toString()), message: output.subarray(separator + 1).toString('utf8').replace(/\n$/, '') };
}

function parseChanges(output) {
  const tokens = output.toString('utf8').split('\0');
  const changes = [];
  for (let index = 0; index < tokens.length - 1;) {
    const status = tokens[index++];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (!oldPath || !newPath) throw new HotfilesError('ERR_HOTFILES_GIT', 'Git returned malformed rename data');
      changes.push({ status: status[0], oldPath, path: newPath });
    } else {
      const filePath = tokens[index++];
      if (!filePath) throw new HotfilesError('ERR_HOTFILES_GIT', 'Git returned malformed change data');
      changes.push({ status: status[0], path: filePath });
    }
  }
  return changes;
}

async function changesForCommit(repo, hash) {
  const output = await runGit(repo, ['diff-tree', '--root', '--no-commit-id', '--name-status', '-z', '-r', '-M', hash]);
  return parseChanges(output);
}

function matches(filePath, options) {
  if (options.scopedPath && filePath !== options.scopedPath && !filePath.startsWith(`${options.scopedPath}/`)) return false;
  const extension = path.posix.extname(filePath).toLowerCase();
  if (options.ignoreExtensions.has(extension)) return false;
  return options.extensions.size === 0 || options.extensions.has(extension);
}

async function analyzeRepository(rawOptions) {
  const options = normalizeOptions(rawOptions);
  await assertRepository(options.repo);
  if (options.limit === 0) return [];

  try { await runGit(options.repo, ['rev-parse', '--verify', 'HEAD']); }
  catch (error) {
    if (error.code === 'ERR_HOTFILES_GIT') return [];
    throw error;
  }

  const existing = await currentFiles(options.repo);
  const counts = new Map();
  const lineage = new Map([...existing].map(file => [file, file]));
  const args = ['rev-list', '--no-merges'];
  if (options.since) args.push(`--since=${options.since.toISOString()}`);
  args.push('HEAD');

  const child = spawn('git', ['-C', options.repo, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  const closed = new Promise(resolve => child.once('close', resolve));
  const started = new Promise((resolve, reject) => child.once('spawn', resolve).once('error', error => reject(new HotfilesError(
    error.code === 'ENOENT' ? 'ERR_HOTFILES_GIT_NOT_FOUND' : 'ERR_HOTFILES_GIT',
    error.code === 'ENOENT' ? 'Git was not found on PATH' : `Could not start Git: ${error.message}`, error
  ))));
  await started;

  let selected = 0;
  let stoppedEarly = false;
  for await (const hash of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    const metadata = await commitMetadata(options.repo, hash);
    if (!options.message.test(metadata.message)) continue;
    if (options.since && metadata.timestamp * 1000 < options.since.getTime()) continue;
    const touched = new Set();
    for (const change of await changesForCommit(options.repo, hash)) {
      const current = lineage.get(change.path);
      if (current && existing.has(current) && matches(current, options)) touched.add(current);
      if (change.status === 'R' && current) {
        lineage.set(change.oldPath, current);
        lineage.delete(change.path);
      }
    }
    for (const file of touched) counts.set(file, (counts.get(file) || 0) + 1);
    selected += 1;
    if (selected === options.limit) {
      stoppedEarly = true;
      child.kill();
      break;
    }
  }

  const code = await closed;
  if (code !== 0 && !stoppedEarly) throw gitError(args, code, stderr);
  return [...counts].map(([filePath, commits]) => ({ path: filePath, commits }))
    .sort((a, b) => b.commits - a.commits || a.path.localeCompare(b.path, 'en'));
}

module.exports = analyzeRepository;
module.exports.analyzeRepository = analyzeRepository;
module.exports.HotfilesError = HotfilesError;
module.exports._internals = { normalizeOptions, matches, parseChanges };
