import { WaypointConfig, WaypointDeployAwsEcsPlugin } from './waypoint-hcl';
import { IAMClient, SimulatePrincipalPolicyCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

let awsAccountId: string = '';
let WAYPOINT_CONFIG_PATH = process.env.WAYPOINT_CONFIG_PATH || 'waypoint.hcl';

async function main() {
  try {
    const stsClient = new STSClient({});
    const command = new GetCallerIdentityCommand({});
    const res = await stsClient.send(command);

    awsAccountId = res.Account!;

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
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

async function getAccessDeniedSecrets(role: string, secrets: string[]): Promise<string[]> {
  let denied: string[] = [];

  for (const secret of secrets) {
    let actionName: string;
    if (secret.startsWith('arn:aws:secretsmanager:')) {
      actionName = 'secretsmanager:GetSecretValue';
    } else if (secret.startsWith('arn:aws:ssm:')) {
      actionName = 'ssm:GetParameters';
    } else {
      continue;
    }

    const command = new SimulatePrincipalPolicyCommand({
      ActionNames: [actionName],
      PolicySourceArn: `arn:aws:iam::${awsAccountId}:role/${role}`,
      ResourceArns: [secret],
    });
    const iamClient = new IAMClient({});
    const res = await iamClient.send(command);
    if (res.EvaluationResults![0].EvalDecision != 'allowed') {
      denied.push(secret);
    }
    iamClient.destroy();
  }

  return denied;
}

main();
