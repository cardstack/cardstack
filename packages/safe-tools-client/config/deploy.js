/* eslint-env node */

module.exports = function (deployTarget) {
  // these get more aggressive caching because they are sub-resources with fingerprinted URLs
  let s3AssetPattern =
    '**/*.{js,png,gif,webp,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,ttc,otf}';

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

  if (
    deployTarget === 's3-preview-staging' ||
    deployTarget === 's3-preview-production'
  ) {
    ENV.pipeline = {
      activateOnDeploy: true,
    };
    ENV.s3 = {
      accessKeyId: process.env.PREVIEW_DEPLOY_AWS_ACCESS_KEY,
      secretAccessKey: process.env.PREVIEW_DEPLOY_AWS_ACCESS_SECRET,
      bucket: process.env.S3_PREVIEW_BUCKET_NAME,
      region: process.env.S3_PREVIEW_REGION,
      prefix: process.env.PR_BRANCH_NAME,
      filePattern: s3AssetPattern.replace('}', ',css,html}'),
    };
    ENV.cloudfront = {
      objectPaths: [
        '/',
        '/*',
        '/*/*',
        '/index.html',
        '/assets/*',
        '/assets/@cardstack/*',
      ],
    };
    ENV.plugins = ['build', 'compress', 's3', 'cloudfront'];
  }

  if (deployTarget === 's3-preview-staging') {
    ENV.cloudfront.distribution = 'E66H0MDT3X9YI';
  }

  if (deployTarget === 's3-preview-production') {
    ENV.cloudfront.distribution = 'E1JUY2L1CT49O';
  }

  return ENV;
};
