# hotfiles

`hotfiles` finds the files touched by the most Git commits. Version 1 is a Node.js 22+ CommonJS library and CLI. It requires the `git` executable on `PATH` and has no runtime npm dependencies.

## CLI

```sh
hotfiles --repo ./my-project --path src --limit 100 --message '^fix:' --ext js --ext ts
hotfiles -r ./my-project --since 2025-01-01 --format json
hotfiles -r ./my-project --json report.json
```

Run `hotfiles --help` for every option. `--output` refuses to overwrite a file unless `--force` is supplied and writes through a temporary file. The legacy `--till/-t` option remains as a deprecated alias for `--since`; `--json/-j <file>` is shorthand for JSON file output.

## Library

```js
const { analyzeRepository } = require('hotfiles');

const files = await analyzeRepository({
  repo: '/path/to/repository',
  path: 'src',
  limit: 100,
  since: '2025-01-01T00:00:00Z',
  message: '^fix:',
  extensions: ['js', '.ts'],
  ignoreExtensions: ['test.js']
});
```

`repo` is required. History is unlimited by default; `limit: 0` returns `[]`. Extensions are case-insensitive and may include the leading dot. Exclusions override inclusions. Path filters respect directory boundaries.

The promise resolves to a deterministically ordered JSON-compatible array:

```json
[{ "path": "src/index.js", "commits": 12 }]
```

Results sort by descending commit count and then ascending path. Each non-merge commit contributes at most one touch per file. Message and inclusive date filters are applied before the newest eligible `limit` commits are chosen. Rename history is attributed to the path at `HEAD`; deleted files are omitted. Copies retain separate histories.

Errors expose stable `code` values: `ERR_HOTFILES_INVALID_OPTIONS`, `ERR_HOTFILES_GIT_NOT_FOUND`, `ERR_HOTFILES_INVALID_REPOSITORY`, and `ERR_HOTFILES_GIT`.

## Migrating from 0.x

- The package now has a working root export and returns `{ path, commits }[]`, not tuple arrays.
- CLI JSON is an ordered array instead of a filename-keyed object.
- Library option names are `extensions`, `ignoreExtensions`, and `since`; the CLI retains `--ext`, `--ignoreExt`, and deprecated `--till` compatibility.
- The system Git executable replaces NodeGit.

## Development

```sh
npm test
npm run lint
npm pack --dry-run
```

These commands build and verify a local package candidate. This repository has no npm publishing workflow.
