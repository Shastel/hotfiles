#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { analyzeRepository } = require('./lib');
const pkg = require('./package.json');

const HELP = `Usage: hotfiles --repo <path> [options]

Options:
  -r, --repo <path>              Git repository (required)
  -p, --path <path>              Limit results to a directory
  -l, --limit <number>           Newest eligible commits to analyze
  -m, --message <regex>          Filter commit messages
  -e, --ext <extension>          Include extension (repeatable)
  -i, --ignoreExt <extension>    Exclude extension (repeatable)
      --since <date>             Include commits on or after date
  -t, --till <date>              Deprecated alias for --since
      --format <text|json>       Output format (default: text)
      --color                    Force colors in text output
      --no-color                 Disable colors
  -o, --output <file>            Write output atomically to a file
  -j, --json <file>              Shorthand for --format json --output <file>
      --force                    Replace an existing output file
  -h, --help                     Show help
  -v, --version                  Show version`;

function parse(argv) {
  const valueFlags = new Map([
    ['-r', 'repo'], ['--repo', 'repo'], ['-p', 'path'], ['--path', 'path'], ['-l', 'limit'], ['--limit', 'limit'],
    ['-m', 'message'], ['--message', 'message'], ['-e', 'extensions'], ['--ext', 'extensions'],
    ['-i', 'ignoreExtensions'], ['--ignoreExt', 'ignoreExtensions'], ['--since', 'since'], ['-t', 'till'], ['--till', 'till'],
    ['--format', 'format'], ['-o', 'output'], ['--output', 'output'], ['-j', 'json'], ['--json', 'json']
  ]);
  const result = { extensions: [], ignoreExtensions: [] };
  for (let i = 0; i < argv.length; i += 1) {
    let flag = argv[i];
    let inline;
    if (flag.startsWith('--') && flag.includes('=')) [flag, inline] = flag.split(/=(.*)/s, 2);
    if (flag === '--help' || flag === '-h') result.help = true;
    else if (flag === '--version' || flag === '-v') result.version = true;
    else if (flag === '--force') result.force = true;
    else if (flag === '--color') result.color = true;
    else if (flag === '--no-color') result.color = false;
    else if (valueFlags.has(flag)) {
      const key = valueFlags.get(flag);
      const value = inline === undefined ? argv[++i] : inline;
      if (value === undefined) throw new Error(`${flag} requires a value`);
      if (Array.isArray(result[key])) result[key].push(value); else result[key] = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (result.till && result.since) throw new Error('--till and --since cannot be used together');
  if (result.till) result.since = result.till;
  if (result.json) { result.format = 'json'; result.output = result.json; }
  result.format ||= 'text';
  if (!['text', 'json'].includes(result.format)) throw new Error('--format must be text or json');
  if (result.limit !== undefined) {
    if (!/^\d+$/.test(result.limit)) throw new Error('--limit must be a non-negative integer');
    result.limit = Number(result.limit);
  }
  return result;
}

async function writeAtomic(destination, content, force) {
  const resolved = path.resolve(destination);
  if (!force) {
    try { await fs.access(resolved); throw new Error(`Output already exists: ${resolved} (use --force to replace it)`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const temporary = `${resolved}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, content, { flag: 'wx' });
    await fs.rename(temporary, resolved);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

function shouldUseColor(args, stream = process.stdout) {
  return args.format === 'text' && !args.output && (args.color === true || (args.color === undefined && stream.isTTY === true));
}

async function main(argv = process.argv.slice(2)) {
  const args = parse(argv);
  if (args.help) { process.stdout.write(`${HELP}\n`); return; }
  if (args.version) { process.stdout.write(`${pkg.version}\n`); return; }
  if (args.till) process.stderr.write('Warning: --till is deprecated; use --since instead.\n');
  const results = await analyzeRepository(args);
  const useColor = shouldUseColor(args);
  const paint = (code, value) => useColor ? `\u001b[${code}m${value}\u001b[0m` : value;
  const text = results.flatMap(item => {
    const lines = [`${paint('36', item.path)} => ${paint('33', String(item.commits))}`];
    for (const detail of item.details) {
      const subject = detail.message.split(/\r?\n/, 1)[0];
      lines.push(`  ${paint('90', detail.hash.slice(0, 12))} ${detail.date} ${subject}`);
    }
    return lines;
  }).join('\n');
  const content = args.format === 'json' ? `${JSON.stringify(results, null, 2)}\n` : text + (results.length ? '\n' : '');
  if (args.output) await writeAtomic(args.output, content, args.force);
  else process.stdout.write(content);
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`hotfiles: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { main, parse, shouldUseColor };
