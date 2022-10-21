/* eslint-env node */

module.exports = function (deployTarget) {
  let ENV = {
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

  return ENV;
};
