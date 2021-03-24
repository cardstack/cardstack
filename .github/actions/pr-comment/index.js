// This action was vendored from: https://github.com/Janealter/branch-pr-comment/blob/master/src/main.ts
// and then edited

const core = require('@actions/core'); // eslint-disable-line node/no-unpublished-require
const github = require('@actions/github'); // eslint-disable-line node/no-unpublished-require

async function run() {
  const message = core.getInput('message');
  const branch = core.getInput('branch');

  if (!message) throw new Error("Required 'message' input");

  if (!branch) throw new Error("Required 'branch' input");

  if (!process.env.GITHUB_TOKEN)
    throw new Error('Required Github access token');

  const octokit = new github.GitHub(process.env.GITHUB_TOKEN);

  const { data: pullRequests } = await octokit.pulls.list({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  });

  const prAssociatedWithBranch = pullRequests.find(
    ({ head, base }) => base.ref === 'main' && head.ref === branch
  );

  if (prAssociatedWithBranch) {
    await octokit.issues.createComment({
      owner: prAssociatedWithBranch.head.repo.owner.login,
      repo: prAssociatedWithBranch.head.repo.name,
      issue_number: prAssociatedWithBranch.number,
      body: message,
    });
  }
}

try {
  run();
} catch (e) {
  core.setFailed(e.message);
  throw e;
}
