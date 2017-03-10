const Change = require('./change');

exports.mergeCommit = async function(repo, parentId, targetBranch, operations, commitOpts) {
  let change = await Change.create(repo, parentId, targetBranch, commitOpts);
  await change.applyOperations(operations);
  let mergeCommitId = await change.finalize();
  return mergeCommitId;
};

exports.GitConflict = Change.GitConflict;
exports.NotFound = Change.NotFound;
exports.OverwriteRejected = Change.OverwriteRejected;
