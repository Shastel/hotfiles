const git = require('nodegit');
const { identity } = require('ramda');

exports.loadCommits = async function loadCommits(history, limit = Infinity) {
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

exports.loadHistory = async function loadHistory(path) {
  const repo = await git.Repository.open(path);

  const head = await repo.getHeadCommit();
  return head.history();
}
