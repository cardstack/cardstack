import { Helpers } from 'graphile-worker';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import awsConfig from '../utils/aws-config';

export default async function s3PutJson(payload: any, helpers: Helpers) {
  const { bucket, path, invalidateOnDistribution, invalidationRoleChain, json, region, roleChain } = payload;
  let s3Config = await awsConfig({ roleChain });
  if (region) {
    s3Config.region = region;
  }
  helpers.logger.info(`Writing JSON to S3 bucket ${bucket} at ${path}...`);
  let s3Client = new S3Client(s3Config);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Body: JSON.stringify(json),
    ContentType: 'application/json',
    Key: path,
  });

  const response = await s3Client.send(command);
  helpers.logger.info(`S3 PUT completed ${bucket}:${path} [${response.$metadata.httpStatusCode}]`);

  if (invalidateOnDistribution) {
    helpers.addJob(
      'create-cloudfront-invalidation',
      {
        distributionId: invalidateOnDistribution,
        region,
        roleChain: invalidationRoleChain,
        path,
      },
      {
        maxAttempts: 1,
      }
    );
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    's3-put-json': typeof s3PutJson;
  }
}
