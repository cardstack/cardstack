import { Octokit } from '@octokit/rest';
import { GuildMember, Message } from 'discord.js';
import { Command, RepositoryConfig, WorkflowInfo } from '../types';
import config from '../config.json';

const usage = `you're missing some arguments.
\`\`\`
usage: !deploy APP[:ref] [environment]
example:
!deploy hub:some-branch staging # deploy some-branch, hub package, to staging
!deploy relay:some-tag  # deploy some-tag, relay app, to the default environment (${config.deploy.default.environment})
!deploy web-client      # deploy default branch (usually main) of web-client package to the default environment from (${config.deploy.default.environment})
\`\`\``;

let octokit: Octokit;
const init = () => {
  octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
};

const isInAllowedChannel = (message: Message): boolean => {
  const allowedChannelIds: string[] = config.deploy.allowedChannels;
  return allowedChannelIds.includes(message.channel.id);
};

const hasAllowedRole = (member: GuildMember | null): boolean => {
  if (!member) return false;
  const allowedRoles: string[] = config.deploy.allowedRoles.map((role: string) => role.toLowerCase());
  if (allowedRoles.length === 0) return false;
  return member.roles.cache.some((role: any) => allowedRoles.includes(role.name.toLowerCase()));
};

const auth = async (message: Message): Promise<boolean> => {
  if (!isInAllowedChannel(message)) {
    console.error(`Unauthorized channel: ${message.channel.id}`);
    await message.reply("Command 'deploy' is disallowed in this channel");
    return false;
  }

  if (!hasAllowedRole(message.member)) {
    console.error(`Unauthorized user: ${message.author.username}`);
    await message.reply(`you do not have any authorized roles to run command 'deploy'`);
    return false;
  }

  return true;
};

const repositoryWorkflowMatches = (repoWorkflow: any, app: string, repository: RepositoryConfig): boolean => {
  const appDeployWorkflowPathRegex = new RegExp(`^.github/workflows/manual-${app}.ya?ml$`);
  const repoDeployWorkflowPathRegex = new RegExp(`^.github/workflows/manual-deploy.ya?ml$`);
  if (appDeployWorkflowPathRegex.test(repoWorkflow.path)) {
    return true;
  } else if (
    (app === repository.name || app === repository.alias) &&
    repoDeployWorkflowPathRegex.test(repoWorkflow.path)
  ) {
    return true;
  }
  return false;
};

const findWorkflow = async (app: string): Promise<WorkflowInfo | null> => {
  let repositories: RepositoryConfig[] = config.github.repositories;
  for (const repository of repositories) {
    for (let i = 1; true; i++) {
      const response = await octokit.rest.actions.listRepoWorkflows({
        owner: config.github.owner,
        repo: repository.name,
        page: i,
      });
      if (response.data.workflows.length <= 0) break;
      for (const repoWorkflow of response.data.workflows) {
        if (repositoryWorkflowMatches(repoWorkflow, app, repository)) {
          return { id: repoWorkflow.id, repository: repository };
        }
      }
    }
  }
  return null;
};

const triggerWorkflowRun = async (workflow: WorkflowInfo, environment: string, ref: string) => {
  await octokit.rest.actions.createWorkflowDispatch({
    owner: config.github.owner,
    repo: workflow.repository.name,
    workflow_id: workflow.id,
    ref,
    inputs: {
      environment,
    },
  });
};

type ListWorkflowRunsStatus = 'queued' | 'in_progress';
const listWorkflowRuns = async (workflow: WorkflowInfo, status: ListWorkflowRunsStatus) => {
  const respond = await octokit.rest.actions.listWorkflowRuns({
    owner: config.github.owner,
    repo: workflow.repository.name,
    workflow_id: workflow.id,
    status,
  });
  return respond.data.workflow_runs;
};

const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getMostRecentRun = async (workflow: WorkflowInfo, now: Date) => {
  let workflowRuns: string[] = [];
  let attempts = 0;
  while (workflowRuns.length === 0 && attempts <= 10) {
    attempts++;
    const respond = await Promise.all([
      listWorkflowRuns(workflow, 'queued'),
      listWorkflowRuns(workflow, 'in_progress'),
    ]);
    workflowRuns = [...respond[0], ...respond[1]]
      .filter((workflowRun) => {
        const t = new Date(workflowRun.created_at);
        return t.getTime() > now.getTime();
      })
      .map((workflowRun) => workflowRun.html_url);
    if (workflowRuns.length === 0) {
      await delayMs(500);
    }
  }
  return workflowRuns[0];
};

const execute = async (message: Message, args: string[]) => {
  const authValid = await auth(message);
  if (!authValid) return;

  if (!args || args.length <= 0) {
    message.reply(usage);
    return;
  }

  const arg0 = args[0].split(':');
  const app = arg0[0];
  let ref = undefined;
  if (arg0.length > 1) ref = arg0[1];

  let environment;
  if (args.length > 1) environment = args[1];
  else environment = config.deploy.default.environment;

  const deployMessage = `:rocket: Deploying **${app}** [${ref || 'default branch'}] to *${environment}*.`;

  message = await message.channel.send(`${deployMessage}\n:hourglass: Give me a minute...`);

  init();
  console.info(`deploy: status=pending app=${app} environment=${environment} ref=${ref}`);

  const workflow = await findWorkflow(app);
  if (!workflow) {
    console.error(
      `deploy: status=failed message="workflow not found" app=${app} environment=${environment} ref=${ref}`
    );
    await message.edit(`:warning: Can't find workflow for **${app}**`);
    return;
  }
  const now = new Date();
  ref = ref || workflow.repository.default_branch || 'main';
  try {
    await triggerWorkflowRun(workflow, environment, ref);
    const workflowRun = await getMostRecentRun(workflow, now);
    if (workflowRun) {
      await message.edit(`${deployMessage}\n:arrow_forward: Workflow: ${workflowRun}`);
      console.info(`deploy: status=done app=${app} environment=${environment} ref=${ref}`);
    } else {
      console.warn('Initiated workflow but could not find the workflow run');
      await message.edit(`${deployMessage}\n:arrow_forward: Initiated workflow but could not find the workflow run`);
    }
  } catch (err) {
    console.error(err);
    await message.edit(`${deployMessage}\n:warning: Error: \n\`\`\`${err}\`\`\``);
  }
};

const deploy: Command = {
  name: 'deploy',
  description: 'Deploy',
  execute,
};

export default deploy;
