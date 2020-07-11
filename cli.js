#!/usr/bin/env node

const fs = require('fs');

const commandLineArgs = require('command-line-args');

const loadData = require('./lib');
const {
  printUpdates,
} = require('./lib/updates');

const { path, repo, limit, message, ext = [], ignoreExt, json, till } = commandLineArgs([
  { name: 'repo', type: String, alias: 'r', description: 'test' },
  { name: 'limit', type: Number, alias: 'l', defaultValue: Infinity },
  { name: 'till', type: String, alias: 't', defaultValue: ''},
  { name: 'path', type: String, alias: 'p', defaultValue: '/' },
  { name: 'message', type: String, alias: 'm', defaultValue: '' },
  { name: 'ext', type: String, alias: 'e', multiple: true,  },
  { name: 'ignoreExt', type: String, alias: 'i', multiple: true, },
  { name: 'json', type: String, alias: 'j'  }
]);

printUpdates();

(async () => {
  const [ ...entries ] = await loadData({
    repo,
    path,
    limit,
    till,
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
