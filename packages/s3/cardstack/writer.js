const PendingChange = require('@cardstack/plugin-utils/pending-change');
const uuidv4 = require('uuid/v4');
const { statSync } = require("fs");
const sha1File = require('sha1-file');
const moment = require("moment");
const AWS = require('aws-sdk');
const log = require('@cardstack/logger')('cardstack/image');


module.exports = class Writer {
  static create(params) {
    return new this(params);
  }

  constructor({ dataSource, branches }) {
    this.dataSource         = dataSource;
    this.branches           = branches;
  }

  async s3Upload(branch, options) {
    let config = this.branches[branch];
    log.debug(`Uploading file to S3 key ${options.Key}`);

    let s3 = new AWS.S3({
      accessKeyId:      config.access_key_id,
      secretAccessKey:  config.secret_access_key,
      region:           config.region,
      params:           { Bucket: config.bucket }
    });

    await s3.upload(options).promise();
    log.debug(`Upload of ${options.Key} successful`);
  }

  async prepareBinaryCreate(branch, session, type, stream) {
    let finalizer = async (pendingChange) => {
      let Key = `${pendingChange.finalDocument.id}`;
      // encode metadata as json because values are required to be strings and
      // we want to store various JSON values
      let Metadata = {
        jsonAttrs: JSON.stringify(pendingChange.finalDocument.attributes)
      };
      await this.s3Upload(branch, { Key, Body: stream, Metadata });
    };

    let id = uuidv4();
    let document = {
      type: 'files',
      id,
      attributes: {
        'created-at':  moment().format(),
        'size':         statSync(stream.path).size,
        'content-type': stream.mimeType,
        'sha-sum':      sha1File(stream.path),
        'file-name':    stream.filename
      }
    };

    let change = new PendingChange(null, document, finalizer);
    return change;
  }

};