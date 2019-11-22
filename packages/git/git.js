const {
  Branch,
  Clone,
  Commit,
  Cred,
  Merge,
  Remote,
  Repository,
  Reset,
  Revwalk,
  setThreadSafetyStatus,
  Signature,
  Tree,
  Treebuilder,
  TreeEntry,
  TreeEntry: { FILEMODE },
} = require("nodegit");

// This is supposed to enable thread-safe locking around all async
// operations.
setThreadSafetyStatus(1);


async function logFromCommit(commit) {
  let log = [];

  await new Promise((resolve, reject) => {
    let history = commit.history(Revwalk.SORT.TIME);
    history.on("commit", (c) => log.push(c) );
    history.on('end', resolve);
    history.on('error', reject);
    history.start();
  });

  return log;
}

module.exports = {
  Branch,
  Clone,
  Commit,
  Cred,
  Merge,
  Remote,
  Repository,
  Reset,
  Signature,
  Tree,
  Treebuilder,
  TreeEntry,
  FILEMODE,
  logFromCommit
};

