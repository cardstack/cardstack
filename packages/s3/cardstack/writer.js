const uuidv4 = require('uuid/v4');
const { statSync } = require("fs");
const sha1File = require('sha1-file');
const moment = require("moment");
const { makeS3Client } = require('./s3');
const log = require('@cardstack/logger')('cardstack/image');
const { extension } = require('mime-types');

module.exports = class Writer {
  static create(...args) {
    return new this(...args);
  }

  constructor({ dataSource, config }) {
    this.dataSource = dataSource;
    this.config     = config;
  }

  async s3Upload(options) {
    let config = this.config;
    log.debug(`Uploading file to S3 key ${options.Key}`);

    await makeS3Client(config).upload(options).promise();
    log.debug(`Upload of ${options.Key} successful`);
  }

  async prepareBinaryCreate(session, type, stream) {
    let finalizer = async (pendingChange) => {
      let Key = `${pendingChange.finalDocument.id}`;

      let Metadata = {
        "sha-sum": pendingChange.finalDocument.attributes['sha-sum']
      };

      await this.s3Upload({ Key, Body: stream, Metadata });
    };

    let id = `${uuidv4()}.${extension(stream.mimeType)}`;

    let document = {
      type: 'cardstack-files',
      id,
      attributes: {
        'created-at':  moment().format(),
        'size':         statSync(stream.path).size,
        'content-type': stream.mimeType,
        'sha-sum':      sha1File(stream.path),
        'file-name':    stream.filename
      }
    };

    return { finalDocument: document, finalizer };
  }

};