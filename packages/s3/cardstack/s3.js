const AWS = require('aws-sdk');

function makeS3Client(config) {
  return new AWS.S3({
    accessKeyId:      config.access_key_id,
    secretAccessKey:  config.secret_access_key,
    region:           config.region,
    params:           { Bucket: config.bucket }
  });
}

module.exports = { makeS3Client };