const HCL = require('js-hcl-parser');
const fs = require('fs');
const { execSync } = require('child_process');

interface RelevantWaypointConfig {
  executionRoleName: string;
  secretArns: string[];
}

interface RelevantWaypointConfigByApp {
  [app: string]: RelevantWaypointConfig;
}

let waypointConfigFile = process.argv[2];
let errors = [];
let waypointConfig = parseWaypointConfig(waypointConfigFile);
let appSlugs = Object.keys(waypointConfig);
for (const appSlug of appSlugs) {
  let appConfig = waypointConfig[appSlug];
  if (appConfig.secretArns.length === 0) {
    continue;
  }

  let valid = true;
  let allowedSecretArns = [];

  try {
    allowedSecretArns = [
      ...queryAttachedPoliciesForAllowedSecretAccess(appConfig),
      ...queryRolePoliciesForAllowedSecretAccess(appConfig),
    ];
  } catch (err) {
    errors.push({ app: appSlug, error: err.message });
    valid = false;
  }

  if (valid) {
    let missingSecretArns = [];
    for (const neededSecretArn of appConfig.secretArns) {
      if (!allowedSecretArns.includes(neededSecretArn)) {
        missingSecretArns.push(neededSecretArn);
      }
    }

    if (missingSecretArns.length > 0) {
      valid = false;
      errors.push({
        app: appSlug,
        error: `The role '${
          appConfig.executionRoleName
        }' is missing access to the following secrets:\n${missingSecretArns.join('\n')}\n`,
      });
    }
  }

  console.log(`${valid ? '✓' : '✗'} ${appSlug}`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`app: ${error.app}\nerror: ${error.error}`));
  throw new Error(errors.join('\n'));
}

console.log(`Task policy access to secrets configured in ${waypointConfigFile} has been confirmed.`);

function parseWaypointConfig(waypointConfigFile): RelevantWaypointConfigByApp {
  let hclInput = fs.readFileSync(waypointConfigFile, 'utf8');
  let waypointJson = JSON.parse(HCL.parse(hclInput));
  let appSlugs = waypointJson.app.map((app) => Object.keys(app)[0]);
  let result = {} as RelevantWaypointConfigByApp;
  for (const appSlug of appSlugs) {
    let deployNode = waypointJson.app.find((a) => a[appSlug])[appSlug][0].deploy[0];
    let secretsNode = deployNode.use[0]['aws-ecs'][0].secrets?.[0];
    result[appSlug] = {
      executionRoleName: deployNode.use[0]['aws-ecs'][0]['execution_role_name'],
      secretArns: secretsNode ? Object.values(secretsNode) : [],
    };
  }
  return result;
}

function execute(command, options) {
  return execSync(command, options ?? {})
    .toString()
    .trim();
}

function queryAttachedPoliciesForAllowedSecretAccess(appConfig: RelevantWaypointConfig) {
  const policiesCmd = `aws iam list-attached-role-policies --role-name ${appConfig.executionRoleName} | grep PolicyArn | grep secrets | awk '{ print $2 }' | sed 's/[",]//g'`;
  let secretsPolicyArn = execute(policiesCmd, { env: { ...process.env, PAGER: '' } });

  if (secretsPolicyArn == '') return [];

  const policyVersionsCmd = `aws iam list-policy-versions --policy-arn ${secretsPolicyArn} --query 'Versions[?IsDefaultVersion].VersionId' | grep v | awk '{ print $1 }' | sed 's/[",]//g'`;
  let defaultVersion = execute(policyVersionsCmd, { env: { ...process.env, PAGER: '' } });

  const policyDocumentCmd = `aws iam get-policy-version --policy-arn ${secretsPolicyArn} --version-id ${defaultVersion} --query 'PolicyVersion.Document.Statement[0].Resource'`;
  let allowedSecretArns = execute(policyDocumentCmd, { env: { ...process.env, PAGER: '' } });

  return JSON.parse(allowedSecretArns);
}

function queryRolePoliciesForAllowedSecretAccess(appConfig: RelevantWaypointConfig) {
  let allowedSecretArns = [];

  const policiesCmd = `aws iam list-role-policies --role-name ${appConfig.executionRoleName} --query 'PolicyNames'`;
  const policiesNames = JSON.parse(execute(policiesCmd, { env: { ...process.env, PAGER: '' } }));

  for (const policyName of policiesNames) {
    const statementsCmd = `aws iam get-role-policy --role-name ${appConfig.executionRoleName} --policy-name ${policyName} --query 'PolicyDocument.Statement'`;
    const statements = JSON.parse(execute(statementsCmd, { env: { ...process.env, PAGER: '' } }));
    for (const statement of statements) {
      if (
        statement.Action.includes('ssm:GetParameters') &&
        statement.Action.includes('secretsmanager:GetSecretValue')
      ) {
        const arnRegex = new RegExp('arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^:]+');
        allowedSecretArns = allowedSecretArns.concat(statement.Resource.filter((resource) => arnRegex.test(resource)));
      }
    }
  }

  return allowedSecretArns;
}
