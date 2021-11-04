import { Octokit } from '@octokit/rest';
import { Message } from 'discord.js';
import { Command } from '../types';
import config from '../config.json';

const usage = `you're missing some arguments.
\`\`\`
usage: !deploy APP[:ref] [environment]
example:
!deploy foo:some-branch some-env
!deploy bar:some-tag  # deploy to ${config.deploy.default.environment} by default
!deploy baz           # deploy from ${config.deploy.default.ref} by default
\`\`\``;

let octokit: Octokit;
const init = () => {
  octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
};

const auth = async (message: Message): Promise<boolean> => {
  const allowedChannels: string[] = config.deploy.allowedChannels;
  if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) {
    console.error(`Unauthorized channel: ${message.channel.id}`);
    await message.reply("Command 'deploy' is disallowed in this channel");
    return false;
  }

  const allowedRoles: string[] = config.deploy.allowedRoles.map((role: string) => role.toLowerCase());
  if (
    allowedRoles.length > 0 &&
    !message.member?.roles.cache.find((role) => allowedRoles.includes(role.name.toLowerCase()))
  ) {
    console.error(`Unauthorized user: ${message.author.username}`);
    await message.reply(`you do not have any authorized roles to run command 'deploy'`);
    return false;
  }

  return true;
};

const fetchWorkflowID = async (app: string): Promise<number | null> => {
  const re = new RegExp(`^.github/workflows/manual-${app}.ya?ml$`);
  for (let i = 1; true; i++) {
    const respond = await octokit.rest.actions.listRepoWorkflows({
      owner: config.github.owner,
      repo: config.github.repo,
      page: i,
    });
    if (respond.data.workflows.length <= 0) break;
    for (const workflow of respond.data.workflows) {
      if (re.test(workflow.path)) return workflow.id;
    }
  }
  return null;
};

const triggerWorkflowRun = async (workflowID: number, environment: string, ref: string) => {
  await octokit.rest.actions.createWorkflowDispatch({
    owner: config.github.owner,
    repo: config.github.repo,
    workflow_id: workflowID,
    ref,
    inputs: {
      environment,
    },
  });
};

type ListWorkflowRunsStatus = 'queued' | 'in_progress';
const listWorkflowRuns = async (workflowID: number, status: ListWorkflowRunsStatus) => {
  const respond = await octokit.rest.actions.listWorkflowRuns({
    owner: config.github.owner,
    repo: config.github.repo,
    workflow_id: workflowID,
    status,
  });
  return respond.data.workflow_runs;
};

const getMostRecentRun = async (workflowID: number, now: Date) => {
  let workflows: string[] = [];
  while (workflows.length === 0) {
    const respond = await Promise.all([
      listWorkflowRuns(workflowID, 'queued'),
      listWorkflowRuns(workflowID, 'in_progress'),
    ]);
    workflows = [...respond[0], ...respond[1]]
      .filter((workflow) => {
        const t = new Date(workflow.created_at);
        return t.getTime() > now.getTime();
      })
      .map((workflow) => workflow.html_url);
  }
  return workflows[0];
};

const execute = async (message: Message, args: string[]) => {
  const authValid = await auth(message);
  if (!authValid) return;

  if (!args || args.length <= 0) {
    message.reply(usage);
    return;
  }

  let ref = config.deploy.default.ref;
  const arg0 = args[0].split(':');
  const app = arg0[0];
  if (arg0.length > 1) ref = arg0[1];

  let environment;
  if (args.length > 1) environment = args[1];
  else environment = config.deploy.default.environment;

  const deployMessage = `:rocket: Deploying **${app}** [${ref}] to *${environment}*.`;

  message = await message.channel.send(`${deployMessage}\n:hourglass: Give me a minute...`);

  init();
  console.info(`deploy: status=pending app=${app} environment=${environment} ref=${ref}`);

  const workflowID = await fetchWorkflowID(app);
  if (workflowID) {
    const now = new Date();
    try {
      await triggerWorkflowRun(workflowID, environment, ref);
      const workflow = await getMostRecentRun(workflowID, now);
      await message.edit(`${deployMessage}\n:arrow_forward: Workflow: ${workflow}`);
      console.info(`deploy: status=done app=${app} environment=${environment} ref=${ref}`);
    } catch (err) {
      console.error(err);
      await message.edit(`${deployMessage}\n:warning: Error: \n\`\`\`${err}\`\`\``);
    }
  } else {
    console.error(
      `deploy: status=failed message="workflow not found" app=${app} environment=${environment} ref=${ref}`
    );
    await message.edit(`:warning: Can't find workflow for **${app}**`);
  }
};

const deploy: Command = {
  name: 'deploy',
  description: 'Deploy',
  execute,
};

export default deploy;
