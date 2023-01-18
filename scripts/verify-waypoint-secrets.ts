import { WaypointConfig, WaypointDeployAwsEcsPlugin } from './waypoint-hcl/index.js';
import { IAMClient, SimulatePrincipalPolicyCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

let awsAccountId: string = '';
let WAYPOINT_CONFIG_PATH = process.env.WAYPOINT_CONFIG_PATH || 'waypoint.hcl';
let iamClient: IAMClient;

async function main() {
  try {
    const stsClient = new STSClient({});
    const command = new GetCallerIdentityCommand({});
    const res = await stsClient.send(command);

    awsAccountId = res.Account!;
    iamClient = new IAMClient({ retryMode: 'adaptive' });

    if (process.argv.length >= 3) {
      WAYPOINT_CONFIG_PATH = process.argv[2];
    }

    let wc = new WaypointConfig(WAYPOINT_CONFIG_PATH);
    for (const [app, config] of wc.apps) {
      let deploy = config.deploy;
      if (deploy == undefined) {
        throw `missing 'deploy' block for app '${app}'`;
      }

      // skip if app does not deploy using ecs
      if (deploy.uses['aws-ecs'] == undefined) {
        continue;
      }

      let ecs = deploy.uses['aws-ecs'] as WaypointDeployAwsEcsPlugin;
      if (ecs.execution_role_name == undefined) {
        throw `missing 'execution_role_name' for app '${app}'`;
      }

      // skip if app does not have a 'secret' block
      if (ecs.secrets == undefined) {
        continue;
      }

      const denied = await getAccessDeniedSecrets(ecs.execution_role_name, Object.values(ecs.secrets));

      console.log(`${denied.length == 0 ? '✓' : '✗'} ${app}`);
      if (denied.length > 0) {
        process.exitCode = 1;
        console.log(
          `Role ${ecs.execution_role_name} does not have access to:\n` +
            `${denied.map((arn) => `  - ${arn}`).join('\n')}`
        );
      }
    }

    iamClient.destroy();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

async function getAccessDeniedSecrets(role: string, secrets: string[]): Promise<string[]> {
  let denied: string[] = [];
  const roleArn = `arn:aws:iam::${awsAccountId}:role/${role}`;

  let decisions = await simulatePrincipalPolicy(
    'secretsmanager:GetSecretValue',
    roleArn,
    secrets.filter((secret) => secret.startsWith('arn:aws:secretsmanager:'))
  );
  for (const [secret, decision] of decisions.entries()) {
    if (decision != 'allowed') {
      denied.push(secret);
    }
  }

  decisions = await simulatePrincipalPolicy(
    'ssm:GetParameters',
    roleArn,
    secrets.filter((secret) => secret.startsWith('arn:aws:ssm:'))
  );
  for (const [secret, decision] of decisions.entries()) {
    if (decision != 'allowed') {
      denied.push(secret);
    }
  }

  return denied;
}

async function simulatePrincipalPolicy(actionName: string, role: string, arns: string[]): Promise<Map<string, string>> {
  let result = new Map<string, string>();
  if (arns.length == 0) {
    return result;
  }

  const command = new SimulatePrincipalPolicyCommand({
    ActionNames: [actionName],
    PolicySourceArn: role,
    ResourceArns: arns,
  });

  const res = await iamClient.send(command);
  for (const evalutionResult of res.EvaluationResults!) {
    const { EvalResourceName, ResourceSpecificResults, EvalDecision } = evalutionResult;
    if (EvalDecision === 'allowed') {
      result.set(EvalResourceName!, EvalDecision);
      continue;
    }

    for (const resourceSpecificResult of ResourceSpecificResults!) {
      if (resourceSpecificResult.EvalResourceName === EvalResourceName) {
        result.set(EvalResourceName!, resourceSpecificResult.EvalResourceDecision!);
        break;
      }
    }
  }

  return result;
}

main();
