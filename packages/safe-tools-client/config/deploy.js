/* eslint-env node */

module.exports = function (deployTarget) {
  let ENV = {
    s3: {
      allowOverwrite: true,
      bucket: process.env.AWS_S3_BUCKET,
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
