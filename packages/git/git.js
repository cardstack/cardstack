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

module.exports = {
  Branch,
  Clone,
  Commit,
  Cred,
  Merge,
  Remote,
  Repository,
  Reset,
  Revwalk,
  Signature,
  Tree,
  Treebuilder,
  TreeEntry,
  FILEMODE
};

