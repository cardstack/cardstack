/* eslint-env node */

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
    compressPrepaidCardPatterns: {
      filePattern: 'images/prepaid-card-customizations/**/*.svg',
      compression: ['gzip'],
    },
    cloudfront: {
      objectPaths: [
        '/',
        '/*',
        '/*/*',
        '/index.html',
        '/assets/*',
        '/assets/@cardstack/*',
      ],
    },
  };

  process.env.DEPLOY_TARGET = deployTarget;

  if (deployTarget === 'staging') {
    ENV.build.environment = 'production';
    ENV.s3Assets.bucket =
      ENV.s3Pages.bucket =
      ENV.s3WellKnown.bucket =
        'app-staging-assets-cardstack';
    ENV.cloudfront.region =
      ENV.s3Assets.region =
      ENV.s3Pages.region =
      ENV.s3WellKnown.region =
        'us-east-1';
    ENV.cloudfront.accessKeyId =
      ENV.s3Assets.accessKeyId =
      ENV.s3Pages.accessKeyId =
      ENV.s3WellKnown.accessKeyId =
        process.env.EMBER_DEPLOY_AWS_ACCESS_KEY;
    ENV.cloudfront.secretAccessKey =
      ENV.s3Assets.secretAccessKey =
      ENV.s3Pages.secretAccessKey =
      ENV.s3WellKnown.secretAccessKey =
        process.env.EMBER_DEPLOY_AWS_ACCESS_SECRET;
    ENV.cloudfront.distribution = 'E330O30QIWNDYA';
  }

  if (deployTarget === 'production') {
    ENV.build.environment = 'production';
    ENV.s3Assets.bucket =
      ENV.s3Pages.bucket =
      ENV.s3WellKnown.bucket =
        'app-assets-cardstack';
    ENV.cloudfront.region =
      ENV.s3Assets.region =
      ENV.s3Pages.region =
      ENV.s3WellKnown.region =
        'us-east-1';
    ENV.cloudfront.accessKeyId =
      ENV.s3Assets.accessKeyId =
      ENV.s3Pages.accessKeyId =
      ENV.s3WellKnown.accessKeyId =
        process.env.EMBER_DEPLOY_AWS_ACCESS_KEY;
    ENV.cloudfront.secretAccessKey =
      ENV.s3Assets.secretAccessKey =
      ENV.s3Pages.secretAccessKey =
      ENV.s3WellKnown.secretAccessKey =
        process.env.EMBER_DEPLOY_AWS_ACCESS_SECRET;
    ENV.cloudfront.distribution = 'E3VPNGI7F1WEW8';
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
      filePattern: s3AssetPattern.replace('}', ',html}'),
    };
    ENV.plugins = ['build', 'compress', 's3'];
  }

  // Note: if you need to build some configuration asynchronously, you can return
  // a promise that resolves with the ENV object instead of returning the
  // ENV object synchronously.
  return ENV;
};
