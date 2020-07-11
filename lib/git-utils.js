const git = require('nodegit');
const { identity } = require('ramda');

exports.loadCommits = async function loadCommits(history, limit = Infinity, till) {
    let resolve = identity;

    const p = new Promise(_ => (resolve = _));
    const commits = [];

    const timeLimit = +(new Date(till || 0));

    history.on('commit', c => {
        const commitDate = new Date(c.date());

        if (commits.length === limit || (timeLimit >= +commitDate) ) {
          history.removeAllListeners();
          resolve(commits);
        }

        commits.push(c);
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
