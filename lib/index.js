const { extname } = require('path');

const {
  map,
  flatten,
  complement,
  both,
  when,
  always,
  length,
  includes,
  __,
 } = require('ramda');

const {
  loadCommits,
  loadHistory,
} = require('./git-utils');
const {
  getExistingFileMap,
} = require('./fs-utils');

const getDiffs = map(c => c.getDiff());
const getPatches = map(d => d.patches());

function getFilterFn (ext, ignoreExt) {
  return both(
    when(always(length(ext)), includes(__, ext)),
    complement(includes(__, ignoreExt))
  )
}

module.exports = async function loadData({ repo: repoPath, path: pathString = '', limit, message = '', ext = [], ignoreExt = [], till }) {
  const history = await loadHistory(repoPath);

  const commits = await loadCommits(history, limit, till);

  const commitTest = new RegExp(message);
  const filteredCommits = commits.filter(c => c.message().match(commitTest));

  const diffs = flatten(await Promise.all(getDiffs(filteredCommits)));
  const patches = flatten(await Promise.all(getPatches(diffs)))

  const paths = patches.map(async patch => {
    const file = await patch.newFile();

    return file.path();
  });

  const allPaths = await Promise.all(paths);

  const filterFn = getFilterFn(ext, ignoreExt)

  const filteredPaths = allPaths.filter(function (path) {
    if (!path.startsWith(pathString)) {
      return false;
    }

    const extension = extname(path);

    return filterFn(extension);
  });

  const pathsMap = filteredPaths.reduce((R, path) => {
    const count = R.get(path) || 0;
    R.set(path, count + 1);
    return R;
  }, new Map());

  const files = await getExistingFileMap(pathsMap, repoPath);

  return [...files.entries()].sort((a, b) => b[1] - a[1]);
}
