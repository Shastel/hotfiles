# HotFiles

A simple tool for commit based analysis of your codebase.

## Motivation

There are tons upon tons of ways to analyze your code, but with this simple tool, you can map problem of the codebase to problems of business. For example if there are a lot of fixes in file 'a' this file should be refactored or you should write more tests for this file.
It is pretty useful when you start working with large codebases, starting refactoring or writing tests this tool may highlight to  you where to start

## Installation

You should get [nodejs](https://nodejs.org/en/) first.

Then you will be available to install 'hotfiles' globally or you will be able to run the tool with [npx](https://www.npmjs.com/package/npx)
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
`--message, -m` - Filter for commit message (will be treated as regex)  
`--ext, -e` - List of file extensions to check


### Example

```sh
hotfiles --repo='./my-awersome-project' --path='src' --limit=100 --message='fix:' --ext=.js --ext=.rb
```
This call will scan `last 100` commits in `my-awesome-project` under `src` path where commit message contains `fix:` and a report will contain only files with extensions `.js` and `.rb`
