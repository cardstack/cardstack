import config from 'config';

interface AwsConfigResult {
  credentials: any;
  region: string | undefined;
}

// if credentials or region are configured, return them
export default function awsConfig() {
  let result = {} as AwsConfigResult;

  let accessKeyId = config.get('aws.config.credentials.AccessKeyId');
  let secretAccessKey = config.get('aws.config.credentials.SecretAccessKey');
  if (accessKeyId || secretAccessKey) {
    result.credentials = config.get('aws.config.credentials');
  }

  let region = config.get('aws.config.region');
  if (region) {
    result.region = config.get('aws.config.region');
  }

  return result;
}
