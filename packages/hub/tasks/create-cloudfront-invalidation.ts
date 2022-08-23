import { Helpers } from 'graphile-worker';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import awsConfig from '../utils/aws-config';
import * as Sentry from '@sentry/node';

export default class CreateCloudfrontInvalidation {
  async perform(
    {
      distributionId,
      region,
      roleChain,
      path,
    }: { distributionId: string; region?: string; roleChain: string[]; path: string },
    helpers: Helpers
  ) {
    let cloudfrontConfig = await awsConfig({
      roleChain,
    });

    if (region) {
      cloudfrontConfig.region = region;
    }

    let invalidationPath = path;

    if (!path.startsWith('/')) {
      invalidationPath = `/${path}`;
    }

    let cloudfrontClient = new CloudFrontClient(cloudfrontConfig);
    let invalidationCommand = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: [invalidationPath],
        },
      },
    });

    try {
      let invalidationResponse = await cloudfrontClient.send(invalidationCommand);
      helpers.logger.info(
        `Cloudfront invalidation completed:${path} [${invalidationResponse.$metadata.httpStatusCode}]`
      );
    } catch (e) {
      Sentry.captureException(e);
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'create-cloudfront-invalidation': CreateCloudfrontInvalidation;
  }
}
