const { extname } = require('path');


const { map, flatten } = require('ramda');

const {
  loadCommits,
  loadHistory,
} = require('./git-utils');
const {
  getExistingFileMap,
} = require('./fs-utils');

const getDiffs = map(c => c.getDiff());
const getPatches = map(d => d.patches());

module.exports = async function loadData({ repo: repoPath, path: pathString = '', limit, message = '', ext }) {
  const history = await loadHistory(repoPath);

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
  }, new Map());

  const files = await getExistingFileMap(pathsMap, repoPath);

  return [...files.entries()].sort((a, b) => b[1] - a[1]);
}
