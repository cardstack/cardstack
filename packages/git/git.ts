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


async function logFromCommit(commit: any) {
  let log: any[] = [];

  await new Promise((resolve, reject) => {
    let history = commit.history(Revwalk.SORT.TIME);
    history.on("commit", (c: any) => log.push(c) );
    history.on('end', resolve);
    history.on('error', reject);
    history.start();
  });

  return log;
}

async function cloneRepo(url:String, path:String, { fetchOpts }: {fetchOpts:any}) {
  return await Clone(url, path, { fetchOpts });
}

async function createRemote(repo:any, name:String, url:String) {
  return await Remote.create(repo, name, url);
}

export {
  Branch,
  Commit,
  Cred,
  Merge,
  Repository,
  Reset,
  Signature,
  Tree,
  Treebuilder,
  TreeEntry,
  FILEMODE,
  // wrapped
  logFromCommit,
  cloneRepo,
  createRemote
};

