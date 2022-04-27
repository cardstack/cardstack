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
  let allowedSecretArns = queryPolicyForAllowedSecretAccess(appConfig);
  for (const neededSecretArn of appConfig.secretArns) {
    if (!allowedSecretArns.includes(neededSecretArn)) {
      errors.push({
        app: appSlug,
        missingSecretArn: neededSecretArn,
      });
    }
  }
}

if (errors.length > 0) {
  let errorMessage = 'Task execution roles do not have permission to read required secrets:\n\n';
  errorMessage += errors.map(
    (e) => `
  app: ${e.app}
  secretArn: ${e.missingSecretArn}

`
  );
  console.log(errorMessage);
  throw new Error(errorMessage);
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
  // console.log(`executing: ${command}`);
  return execSync(command, options ?? {})
    .toString()
    .trim();
}

function queryPolicyForAllowedSecretAccess(appConfig: RelevantWaypointConfig) {
  const policiesCmd = `aws iam list-attached-role-policies --role-name ${appConfig.executionRoleName} | grep PolicyArn | grep secrets | awk '{ print $2 }' | sed 's/[",]//g'`;
  let secretsPolicyArn = execute(policiesCmd, { env: { ...process.env, PAGER: '' } });

  const policyVersionsCmd = `aws iam list-policy-versions --policy-arn ${secretsPolicyArn} --query 'Versions[?IsDefaultVersion].VersionId' | grep v | awk '{ print $1 }' | sed 's/[",]//g'`;
  let defaultVersion = execute(policyVersionsCmd, { env: { ...process.env, PAGER: '' } });

  const policyDocumentCmd = `aws iam get-policy-version --policy-arn ${secretsPolicyArn} --version-id ${defaultVersion} --query 'PolicyVersion.Document.Statement[0].Resource'`;
  let allowedSecretArns = execute(policyDocumentCmd, { env: { ...process.env, PAGER: '' } });
  return allowedSecretArns;
}
