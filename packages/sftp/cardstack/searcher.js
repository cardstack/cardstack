const { declareInjections }   = require('@cardstack/di');
const SftpClient = require('ssh2-sftp-client');
const { dirname, basename } = require('path');
const moment = require('moment');
const { get } = require('lodash');
const { lookup } = require('mime-types');

module.exports = declareInjections({
  searcher: 'hub:searchers'
},

class SftpSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, config, searcher, branches }) {
    this.config       = config;
    this.branches     = branches;
    this.dataSource   = dataSource;
    this.searcher     = searcher;
  }

  async get(session, branch, type, id, next) {

    let result = await next();

    if (result) { return result; }

    if (type === 'content-types') { return next(); }

    let contentType = await this.searcher.get(session, branch, 'content-types', type);

    let dataSourceId = get(contentType, 'data.relationships.data-source.data.id');

    // only look for files on the server if the content type is actually stored
    // in this data source
    if (dataSourceId !== this.dataSource.id) {
      return result;
    }

    let client = await this.makeClient(branch);
    let list = await client.list(dirname(id));
    let name = basename(id);

    let entry = list.find(e => e.name === name );

    if (entry) {
      let contentType = lookup(name) || 'application/octet-stream';

      let attributes = {
        'access-time':  moment(entry.accessTime).format(),
        'modify-time':  moment(entry.modifyTime).format(),
        'size':         entry.size,
        'file-name':    name,
        'content-type': contentType
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

  async search(session, branch, query, next) {
    return next();
  }

  async getBinary(session, branch, type, id) {
    let client = await this.makeClient(branch);
    return client.get(id, true, null);
  }

  async makeClient(branch) {
    let client = new SftpClient();

    await client.connect(this.branches[branch]);

    return client;
  }
});
