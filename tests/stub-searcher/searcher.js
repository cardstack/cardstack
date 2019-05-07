const bootstrapSchema = require('@cardstack/hub/bootstrap-schema');
const systemModels = [{ id: '@cardstack/hub', type: 'groups' }];

module.exports = class StubSearcher {
  static create(params) {
    return new this(params);
  }

  constructor(params) {
    this.params = params;
    this.counter = 0;
  }

  async get(session, type, id, next) {

    if (bootstrapSchema.concat(systemModels).find(m => m.type === type && m.id === id)) {
      return await next();
    }

    if (this.params.injectFirst) {
      return { data: this.makeModel(type, id, this.params.injectFirst), meta: this.makeMeta(type, id) };
    }

    let result = await next();
    if (result) {
      return result;
    }
    if (this.params.injectSecond) {
      return { data: this.makeModel(type, id, this.params.injectSecond), meta: this.makeMeta(type, id) };
    }
  }

  async search(session, query, next) {
    if (this.params.injectFirst) {
      return {
        data: [ this.makeModel('examples', '2', this.params.injectFirst) ],
        meta: {
          page: {}
        }
      };
    }
    return next();
  }

  makeModel(type, id, flavor) {
    return {
      type,
      id,
      attributes: {
        'example-flavor': flavor,
        'example-counter': this.counter++
      }
    };
  }

  makeMeta(type, id) {
    if (this.params.metaFor) {
      return this.params.metaFor[`${type}/${id}`];
    }
    return {};
  }

};


