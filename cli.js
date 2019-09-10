#!/usr/bin/env node

const commandLineArgs = require('command-line-args');

const loadData = require('./lib');

const { path, repo, limit, message, ext = [], ignoreExt } = commandLineArgs([
  { name: 'repo', type: String, alias: 'r', defaultOption: process.cwd, description: 'test' },
  { name: 'limit', type: Number, alias: 'l', defaultOption: Infinity },
  { name: 'path', type: String, alias: 'p', defaultOption: '/' },
  { name: 'message', type: String, alias: 'm', defaultOption: '' },
  { name: 'ext', type: String, alias: 'e', multiple: true,  }
]);

(async () => {
  const [ ...entries ]  = await loadData({
    repo,
    path,
    limit,
    message,
    ext,
    ignoreExt,
  });

  entries.forEach(entry => console.log(entry.join(' => ')));

})();
