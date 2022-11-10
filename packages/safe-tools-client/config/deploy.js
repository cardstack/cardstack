/* eslint-env node */

module.exports = function (deployTarget) {
  let ENV = {
    pipeline: {
      activateOnDeploy: true,
    },
    plugins: ['build', 'compress', 's3', 'cloudfront'],
    build: {},
    s3: {
      allowOverwrite: true,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      filePattern: '**/*',
    },
    cloudfront: {
      objectPaths: ['/*'],
      distribution: process.env.AWS_CLOUDFRONT_DISTRIBUTION,
    },
  };

  if (deployTarget === 'staging') {
    ENV.build.environment = 'production';
  }

  if (deployTarget === 'production') {
    ENV.build.environment = 'production';
  }

  if (
    deployTarget === 's3-preview-staging' ||
    deployTarget === 's3-preview-production'
  ) {
    ENV.s3.prefix = process.env.PR_BRANCH_NAME;
  }

  return ENV;
};
