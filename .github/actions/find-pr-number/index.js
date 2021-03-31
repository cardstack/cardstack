/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('@actions/core'); // eslint-disable-line node/no-unpublished-require
const github = require('@actions/github'); // eslint-disable-line node/no-unpublished-require

async function run() {
  const branch = core.getInput('branch');

  if (!branch)
    throw new Error('The branch was not provided to the find-pr-number action');

  if (!process.env.GITHUB_TOKEN)
    throw new Error('Required Github access token');

  const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

  const { data: pullRequests } = await octokit.pulls.list({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  });

  const prAssociatedWithBranch = pullRequests.find(({ head, base }) => {
    console.log(head, base);
    return base.ref === 'main' && head.ref === branch;
  });

  core.setOutput(
    'pr-number',
    prAssociatedWithBranch && prAssociatedWithBranch.number
  );
}

try {
  run();
} catch (e) {
  core.setFailed(e.message);
  throw e;
}
