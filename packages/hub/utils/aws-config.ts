import config from 'config';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import Logger from '@cardstack/logger';
let log = Logger('utils:aws-config');

interface AwsConfigResult {
  credentials: any;
  region: string | undefined;
}

// If credentials or region are configured, use them. If roleChain is present, assume the specified role,
// in order, using the original or previous role's credentials to assume the role.
export default async function awsConfig({ roleChain = [] }) {
  let result = {} as AwsConfigResult;

  let accessKeyId = config.get('aws.config.credentials.AccessKeyId');
  let secretAccessKey = config.get('aws.config.credentials.SecretAccessKey');
  if (accessKeyId || secretAccessKey) {
    result.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  let region = config.get('aws.config.region');
  if (region) {
    result.region = config.get('aws.config.region');
  }

  for (const role of roleChain) {
    let assumedRole = await assumeRole(role, result);
    log.debug(`AssumedRole ${role}: ${assumedRole.AssumedRoleUser?.Arn}`);
    result.credentials = result.credentials || {};
    result.credentials.accessKeyId = assumedRole.Credentials?.AccessKeyId;
    result.credentials.secretAccessKey = assumedRole.Credentials?.SecretAccessKey;
    result.credentials.sessionToken = assumedRole.Credentials?.SessionToken;
  }

  return result;
}

async function assumeRole(roleName: string, config: any) {
  const stsClient = new STSClient(config);

  const stsParams = {
    RoleArn: roleArn(roleName),
    RoleSessionName: roleSessionName(roleName),
  };

  const stsCommand = new AssumeRoleCommand(stsParams);
  try {
    let result = await stsClient.send(stsCommand);
    return result;
  } catch (e) {
    log.error(`Failed to assumeRole '${roleName}'`, e);
    throw e;
  }
}

function roleArn(roleName: string) {
  let awsAccountId = config.get('aws.accountId');
  if (roleName.startsWith('prod:')) {
    awsAccountId = config.get('aws.prodAccountId');
    roleName = roleName.replace(/^prod:/, '');
  }
  return `arn:aws:iam::${awsAccountId}:role/${roleName}`;
}

function roleSessionName(roleName: string) {
  roleName = roleName.replace(/^prod:/, '');
  return `${roleName}-session`;
}
