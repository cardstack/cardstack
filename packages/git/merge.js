const Change = require('./change');

exports.createEmptyRepo = async function(path, commitOpts) {
  let change = await Change.createInitial(path, 'master', commitOpts);
  await change.finalize();
  return change.repo;
};


exports.mergeCommit = async function(repo, parentId, targetBranch, operations, commitOpts) {
  let change = await Change.create(repo, parentId, targetBranch, commitOpts);
  await change.applyOperations(operations);
  let mergeCommitId = await change.finalize();
  return mergeCommitId;
};

exports.GitConflict = Change.GitConflict;
exports.NotFound = Change.NotFound;
exports.OverwriteRejected = Change.OverwriteRejected;
