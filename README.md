# hotfiles

Find the files that change most often in a Git repository.

`hotfiles` analyzes non-merge commits, follows file renames, and reports each current file together with the commits that touched it. Use it to identify refactoring candidates, unstable modules, and frequently modified areas of a codebase.

## Status

Hotfiles 1.0 is release-ready but has not yet been published to npm.

Requirements:

- Node.js 22 or newer
- Git available on `PATH`
- A local Git working tree

The package has no runtime npm dependencies.

## Installation

Until 1.0 is published, build and install a local package from this repository:

```sh
npm ci
npm pack
npm install --global ./hotfiles-1.0.0.tgz
```

The package can also be installed into another local Node.js project:

```sh
npm install /path/to/hotfiles-1.0.0.tgz
```

## Quick start

Analyze an entire repository:

```sh
hotfiles --repo ./my-project
```

Example output:

```text
src/parser.js => 3
  a72e1bd929f0 2026-08-18T10:42:03.000Z fix parser recovery
  25f845a48d30 2026-08-11T14:20:19.000Z support escaped names
  b17b86336da2 2026-08-02T09:13:51.000Z add parser
```

Analyze the newest 100 matching commits under `src`:

```sh
hotfiles \
  --repo ./my-project \
  --path src \
  --limit 100 \
  --message '^fix:' \
  --ext js \
  --ext ts
```

Produce machine-readable output:

```sh
hotfiles --repo ./my-project --format json
hotfiles --repo ./my-project --json hotfiles.json
```

## How counting works

Hotfiles processes commits reachable from `HEAD`, from newest to oldest.

- Merge commits are excluded.
- A file receives at most one touch per commit.
- Message and date filters are applied before `--limit`.
- `--since` includes commits at the specified instant.
- Rename history is attributed to the file's current path.
- Deleted files are omitted.
- Copies have independent histories.
- Results are sorted by commit count, then by path.
- Commit details are ordered newest first.

Hotfiles measures commit frequency, not lines changed or code complexity.

## CLI options

| Option | Description |
| --- | --- |
| `-r, --repo <path>` | Git repository to analyze; required |
| `-p, --path <path>` | Restrict results to a file or directory |
| `-l, --limit <number>` | Analyze the newest eligible commits |
| `-m, --message <regex>` | Filter commit messages with a regular expression |
| `-e, --ext <extension>` | Include an extension; repeatable |
| `-i, --ignoreExt <extension>` | Exclude an extension; repeatable |
| `--since <date>` | Include commits on or after a date |
| `-t, --till <date>` | Deprecated alias for `--since` |
| `--format <text\|json>` | Select text or JSON output |
| `-o, --output <file>` | Write output atomically to a file |
| `-j, --json <file>` | JSON file-output shorthand |
| `--force` | Replace an existing output file |
| `--color` | Force colors in terminal text |
| `--no-color` | Disable colors |
| `-h, --help` | Show CLI help |
| `-v, --version` | Show the installed version |

Extension matching is case-insensitive. Exclusions take precedence over inclusions. JSON and file output never contain ANSI color sequences.

## Library API

Hotfiles is a CommonJS package:

```js
const { analyzeRepository } = require('hotfiles');

const files = await analyzeRepository({
  repo: '/path/to/repository',
  path: 'src',
  limit: 100,
  since: '2026-01-01T00:00:00Z',
  message: '^fix:',
  extensions: ['js', 'ts'],
  ignoreExtensions: ['map']
});
```

### `analyzeRepository(options)`

Returns a promise resolving to `HotFile[]`.

```ts
interface AnalyzeOptions {
  repo: string;
  path?: string;
  limit?: number;
  since?: string | Date;
  message?: string;
  extensions?: string[];
  ignoreExtensions?: string[];
}

interface HotFile {
  path: string;
  commits: number;
  details: CommitDetail[];
}

interface CommitDetail {
  hash: string;
  date: string;
  message: string;
}
```

Example result:

```json
[
  {
    "path": "src/parser.js",
    "commits": 1,
    "details": [
      {
        "hash": "a72e1bd929f04a8ba37b62ba280d9e52f66ab821",
        "date": "2026-08-18T10:42:03.000Z",
        "message": "fix parser recovery"
      }
    ]
  }
]
```

Dates are ISO 8601 UTC timestamps. Hashes are full Git commit IDs.

## Errors

Library errors expose one of these stable codes:

| Code | Meaning |
| --- | --- |
| `ERR_HOTFILES_INVALID_OPTIONS` | An option is missing or invalid |
| `ERR_HOTFILES_GIT_NOT_FOUND` | Git is unavailable on `PATH` |
| `ERR_HOTFILES_INVALID_REPOSITORY` | The path is not a Git working tree |
| `ERR_HOTFILES_GIT` | A Git subprocess or response failed |

CLI errors are written to stderr and return a non-zero exit status.

## Limitations

Hotfiles analyzes only commits reachable from the checked-out `HEAD`. Unrelated local branches and remote-only branches are not included.

It does not report:

- Deleted files
- Merge commits
- Lines changed or weighted churn
- Author statistics
- Code complexity

A shallow clone produces results from the locally available history only. Full commit details make result size proportional to the number of reported file touches.

## Migrating from 0.x

- The package now has a working root export and returns `{ path, commits, details }[]`, not tuple arrays.
- CLI JSON is an ordered array instead of a filename-keyed object.
- Library option names are `extensions`, `ignoreExtensions`, and `since`; the CLI retains `--ext`, `--ignoreExt`, and deprecated `--till` compatibility.
- The system Git executable replaces NodeGit.

## Development

```sh
npm ci
npm test
npm run lint
npm audit
npm pack --dry-run
```

CI tests Node.js 22, 24, and 26, plus packed-package installation and real-repository analysis on Linux, macOS, and Windows.

## Support and security

- Report bugs through [GitHub Issues](https://github.com/Shastel/hotfiles/issues).
- Report vulnerabilities according to [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
