# HotFiles

A simple tool for commit-based analysis of your codebase.

[![hotfiles](https://circleci.com/gh/Shastel/hotfiles.svg?style=shield)](https://circleci.com/gh/shastel/hotfiles)

## Motivation

There are tons upon tons of ways to analyze your code but with this simple tool you can map codebase problems to business problems. For example if there are a lot of fixes in file 'a' this file should be refactored or you should write more tests for this file.
It is pretty useful when you are beginning working with a large codebase, considering refactoring or writing tests, this tool may indicate where to start.

The tool is language agnostic, you can run it against `js`, `ts`, `dart`, `java`, basically against whatever you want.  
You need just to pass an extension and that it.

## Installation

You should get [nodejs](https://nodejs.org/en/) first.

Then you will be able to install 'hotfiles' globally or you will be able to run the tool with [npx](https://www.npmjs.com/package/npx)
```sh
npm i -g hotfiles
```

## Usage

```sh
hotfiles --repo=path_to_your_cloned_repo
```
or
```sh
npx hotfiles --repo=path_to_your_cloned_repo
```

### Available options
`--repo, -r` - Path to your project (mandatory)  
`--path, -p` - Specific path inside of your project  
`--limit, -l` - Number of commits to analyze (Infinity by default)  
`--message, -m` - Filter for commit message (will be treated as a regex)  
`--ext, -e` - List of file extensions to check  
`--json, -j` - Path to output file


### Examples

```sh
hotfiles --repo='./my-awesome-project' --path='src' --limit=100 --message='fix:' --ext=.js --ext=.rb
```
This call will scan `last 100` commits in `my-awesome-project` under `src` path where commit message contains `fix:` and a report will contain only files with extensions `.js` and `.rb`.


```sh
hotfiles --repo='./my-awesome-project' --limit=100 --ext=.ts --ext=.tsx --json=./output.json
```
This call will scan `last 100` commits in `my-awesome-project`, report will contain only files with extensions `.ts` and `.tsx` and will be saved as json to `./output.json`
