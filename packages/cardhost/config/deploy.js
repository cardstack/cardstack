/* eslint-env node */

module.exports = function(deployTarget) {
  // these get less aggressive caching because they exist at stable URLs
  let s3PagePattern = '**/*.{html,zip,pdf,css}'; // note that fingerprinting has not been implemented in embroider yet, using less agressive caching for css for now

  // these get more aggressive caching because they are sub-resources with fingerprinted URLs
  let s3AssetPattern = '**/*.{js,png,gif,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,ttc,otf}';

  let ENV = {
    build: {},
    pipeline: {
      activateOnDeploy: true,
      disabled: {},
      alias: {
        s3: {
          as: ['s3Pages', 's3Assets'],
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
    cloudfront: {
      objectPaths: [
        '/',
        '/*',
        '/*/*',
        '/index.html',
        '/vendor.css',
        '/assets/vendor.css',
        '/@cardstack/cardhost.css',
        '/assets/@cardstack/cardhost.css',
      ],
    },
  };

  process.env.DEPLOY_TARGET = deployTarget;

  if (deployTarget === 'demo') {
    ENV.build.environment = 'production';
    ENV.s3Assets.bucket = ENV.s3Pages.bucket = 'builder-web';
    ENV.s3Assets.region = ENV.s3Pages.region = 'us-east-1';
    ENV.cloudfront.distribution = 'EFVU91CWZ0Z5M';
  }

  if (deployTarget === 'production') {
    ENV.build.environment = 'production';
    ENV.s3Assets.bucket = ENV.s3Pages.bucket = 'builder-prod-web';
    ENV.s3Assets.region = ENV.s3Pages.region = 'us-east-1';
    ENV.cloudfront.distribution = 'ENI8I3HGY0NM0';
  }

  // Note: if you need to build some configuration asynchronously, you can return
  // a promise that resolves with the ENV object instead of returning the
  // ENV object synchronously.
  return ENV;
};
