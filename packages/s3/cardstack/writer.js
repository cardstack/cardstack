const PendingChange = require('@cardstack/plugin-utils/pending-change');
const uuidv4 = require('uuid/v4');
const { statSync } = require("fs");
const sha1File = require('sha1-file');
const moment = require("moment");
const { makeS3Client } = require('./s3');
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

    await makeS3Client(config).upload(options).promise();
    log.debug(`Upload of ${options.Key} successful`);
  }

  async prepareBinaryCreate(branch, session, type, stream) {
    let finalizer = async (pendingChange) => {
      let Key = `${pendingChange.finalDocument.id}`;

      let Metadata = {
        "sha-sum": pendingChange.finalDocument.attributes['sha-sum']
      };

      await this.s3Upload(branch, { Key, Body: stream, Metadata });
    };

    let id = uuidv4();
    let document = {
      type: 'cs-files',
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