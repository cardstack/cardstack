/* eslint-env node */

module.exports = function (deployTarget) {
  let ENV = {
    s3: {
      allowOverwrite: true,
    },
    cloudfront: {
      objectPaths: ['/*'],
    },
  };

  if (deployTarget === 'staging') {
    ENV.build.environment = 'production';
    ENV.s3.bucket = 'cardstack-safe-tools-client-staging';
    ENV.cloudfront.distribution = 'PLACEHOLDER';
  }

  if (deployTarget === 'production') {
    ENV.build.environment = 'production';
    ENV.s3.bucket = 'cardstack-safe-tools-client-production';
    ENV.cloudfront.distribution = 'PLACEHOLDER';
  }

  return ENV;
};
