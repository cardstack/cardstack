/* eslint-env node */

// FIXME copypaste from web-client

module.exports = function (deployTarget) {
  // these get less aggressive caching because they exist at stable URLs
  let s3PagePattern = '**/*.{html,zip,pdf,css}'; // note that fingerprinting has not been implemented in embroider yet, using less agressive caching for css for now
  let s3WellKnownPattern = '.well-known/*';

  // these get more aggressive caching because they are sub-resources with fingerprinted URLs
  let s3AssetPattern =
    '**/*.{js,png,gif,webp,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,ttc,otf}';

  let ENV = {
    build: {},
    pipeline: {
      activateOnDeploy: true,
      disabled: {},
      alias: {
        s3: {
          as: ['s3Pages', 's3WellKnown', 's3Assets'],
        },
        compress: {
          as: ['compressOwnAssets', 'compressPrepaidCardPatterns'],
        },
      },
    },
    'revision-data': {
      scm: null,
    },
    s3Assets: {
      filePattern: s3AssetPattern,
      allowOverwrite: true,
    },
    s3Pages: {
      filePattern: s3PagePattern,
      allowOverwrite: true,
      cacheControl: 'max-age=600, public',
    },
    s3WellKnown: {
      filePattern: s3WellKnownPattern,
      allowOverwrite: true,
      cacheControl: 'max-age=600, public',
    },
    compressOwnAssets: {
      filePattern: '**/*.{js,css,json,ico,map,xml,txt,svg,eot,ttf,woff,woff2}',
      ignorePattern: 'images/prepaid-card-customizations/**/*.svg',
      compression: ['best'],
    },
  };

  process.env.DEPLOY_TARGET = deployTarget;

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
    ENV.plugins = ['build', 'compress', 's3'];
  }

  // Note: if you need to build some configuration asynchronously, you can return
  // a promise that resolves with the ENV object instead of returning the
  // ENV object synchronously.
  return ENV;
};
