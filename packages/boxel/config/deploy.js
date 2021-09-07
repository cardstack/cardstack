/* eslint-env node */
'use strict';

module.exports = function (deployTarget) {
  let ENV = {
    build: {
      environment: 'production',
    },
  };
  if (deployTarget === 'production' || deployTarget === 's3-preview') {
    ENV.pipeline = {
      activateOnDeploy: true,
    };
    ENV.s3 = {
      accessKeyId: process.env.PREVIEW_DEPLOY_AWS_ACCESS_KEY,
      secretAccessKey: process.env.PREVIEW_DEPLOY_AWS_ACCESS_SECRET,
      bucket: process.env.S3_PREVIEW_ASSET_BUCKET_NAME,
      region: process.env.S3_PREVIEW_REGION,
      filePattern:
        '**/*.{js,css,png,gif,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,otf,wasm,json,flac}',
    };
    ENV.manifest = {
      filePattern:
        '**/*.{js,css,png,gif,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,otf,wasm,json,flac}',
    };
    ENV['s3-index'] = {
      accessKeyId: process.env.PREVIEW_DEPLOY_AWS_ACCESS_KEY,
      secretAccessKey: process.env.PREVIEW_DEPLOY_AWS_ACCESS_SECRET,
      bucket: process.env.S3_PREVIEW_INDEX_BUCKET_NAME,
      region: process.env.S3_PREVIEW_REGION,
      allowOverwrite: true,
    };
  }
  if (deployTarget === 's3-preview') {
    ENV['s3-index']['prefix'] = process.env.PR_BRANCH_NAME;
  } else if (deployTarget === 'production') {
    ENV['s3-index']['prefix'] = 'main';
  }

  return ENV;
};
