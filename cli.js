#!/usr/bin/env node

const fs = require('fs');

const commandLineArgs = require('command-line-args');

const loadData = require('./lib');
const {
  checkAvailableVersion,
} = require('./lib/utils');

const { path, repo, limit, message, ext = [], ignoreExt, json } = commandLineArgs([
  { name: 'repo', type: String, alias: 'r', description: 'test' },
  { name: 'limit', type: Number, alias: 'l', defaultOption: Infinity },
  { name: 'path', type: String, alias: 'p', defaultOption: '/' },
  { name: 'message', type: String, alias: 'm', defaultOption: '' },
  { name: 'ext', type: String, alias: 'e', multiple: true,  },
  { name: 'ignoreExt', type: String, alias: 'i', multiple: true, },
  { name: 'json', type: String, alias: 'j'  }
]);

(async () => {
  await checkAvailableVersion();

  const [ ...entries ] = await loadData({
    repo,
    path,
    limit,
    message,
    ext,
    ignoreExt,
  });

  if (!json) {
    // eslint-disable-next-line
    entries.forEach(entry => console.log(entry.join(' => ')));
    return ;
  }

  const entriesAsObject = entries.reduce((R, [ fileName, occurrences ]) => {
    R[fileName] = occurrences;

    return R;
  }, {});

  fs.writeFileSync(json, JSON.stringify(entriesAsObject));
})();
