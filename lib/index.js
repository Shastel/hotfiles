const { extname } = require('path');

const git = require('nodegit');
const { map, flatten, identity } = require('ramda');

const getDiffs = map(c => c.getDiff());
const getPatches = map(d => d.patches());

async function loadCommits(history, limit = Infinity) {
    let resolve = identity;

    const p = new Promise(_ => (resolve = _));
    const commits = [];

    history.on('commit', c => {
        commits.push(c);

        if (commits.length === limit) {
          history.removeAllListeners();
          resolve(commits);
        }
    });

    history.on('end', () => resolve(commits));
    history.start();

    return p;
}

module.exports = async function loadData({ repo: repoPath, path: pathString = '', limit, message = '', ext }) {
  const repo = await git.Repository.open(repoPath);

  const head = await repo.getHeadCommit();
  const history = head.history();

  const commits = await loadCommits(history, limit);

  const commitTest = new RegExp(message);
  const filteredCommits = commits.filter(c => c.message().match(commitTest));

  const diffs = flatten(await Promise.all(getDiffs(filteredCommits)));
  const patches = flatten(await Promise.all(getPatches(diffs)))

  const paths = patches.map(async patch => {
    const file = await patch.newFile();

    return file.path();
  });

  const allPaths = await Promise.all(paths);

  const filteredPaths = allPaths.filter(function (path) {
    if (!path.startsWith(pathString)) {
      return false;
    }

    if (!ext.length) {
      return true;
    }

    return ext.some(e => e === extname(path));
  });


  const pathsMap = filteredPaths.reduce((R, path) => {
    const count = R.get(path) || 0;
    R.set(path, count + 1);
    return R;
  }, new Map())

  return [...pathsMap.entries()].sort((a, b) => b[1] - a[1]);
}
