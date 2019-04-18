const { declareInjections }   = require('@cardstack/di');
const SftpClient = require('ssh2-sftp-client');
const { dirname, basename } = require('path');
const moment = require('moment');
const { lookup } = require('mime-types');

module.exports = declareInjections({
  currentSchema: 'hub:current-schema'
},

class SftpSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, config, currentSchema, connection }) {
    this.config        = config;
    this.dataSource    = dataSource;
    this.connection    = connection;
    this.currentSchema = currentSchema;
  }

  async get(session, type, id, next) {

    let result = await next();

    if (result) { return result; }

    if (type === 'content-types') { return next(); }

    let schema = await this.currentSchema.getSchema();
    let contentType = schema.types.get(type);
    if (!contentType) { return result; }

    // only look for files on the server if the content type is actually stored
    // in this data source
    let dataSource = contentType.dataSource;
    if (!dataSource || dataSource.id !== this.dataSource.id) { return result; }

    let client = await this.makeClient();
    let list = await client.list(dirname(id));
    let name = basename(id);

    let entry = list.find(e => e.name === name );

    if (entry) {
      let mimeContentType = lookup(name) || 'application/octet-stream';

      let attributes = {
        'access-time':  moment(entry.accessTime).format(),
        'modify-time':  moment(entry.modifyTime).format(),
        'size':         entry.size,
        'file-name':    name,
        'content-type': mimeContentType
      };

      let data = {
        type,
        id,
        attributes
      };

      return { data };
    } else {
      return result;
    }

  }

  async search(session, query, next) {
    return next();
  }

  async getBinary(session, type, id) {
    let client = await this.makeClient();
    return client.get(id, true, null);
  }

  async makeClient() {
    let client = new SftpClient();

    await client.connect(this.connection);

    return client;
  }
});
