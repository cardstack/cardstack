const { declareInjections }   = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/s3');
const { makeS3Client } = require('./s3');


module.exports = declareInjections({
  searcher: 'hub:searchers'
},

class S3Searcher {
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
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }

  async getObject(branch, options) {
    let config = this.branches[branch];
    log.debug(`Attempting to read ${options.Key} from bucket ${config.bucket}`);

    return await makeS3Client(config).getObject(options).promise();
  }

  async getBinary(session, branch, type, id) {
    let result = await this.getObject(branch, { Key: id });
    return result.Body;
  }
});
