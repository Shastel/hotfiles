#!/usr/bin/env node

const fs = require('fs');

const commandLineArgs = require('command-line-args');

const loadData = require('./lib');

const { path, repo, limit, message, ext = [], ignoreExt, output } = commandLineArgs([
  { name: 'repo', type: String, alias: 'r', defaultOption: process.cwd, description: 'test' },
  { name: 'limit', type: Number, alias: 'l', defaultOption: Infinity },
  { name: 'path', type: String, alias: 'p', defaultOption: '/' },
  { name: 'message', type: String, alias: 'm', defaultOption: '' },
  { name: 'ext', type: String, alias: 'e', multiple: true,  },
  { name: 'output', type: String, alias: 'o'  }
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

  if (!output) {
    // eslint-disable-next-line
    entries.forEach(entry => console.log(entry.join(' => ')));
    return ;
  }

  const entriesAsObject = entries.reduce((R, [ fileName, occurrences ]) => {
    R[fileName] = occurrences;

    return R;
  }, {})

  fs.writeFileSync(output, JSON.stringify(entriesAsObject));
})();
