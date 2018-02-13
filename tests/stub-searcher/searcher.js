module.exports = class StubSearcher {
  static create(params) {
    return new this(params);
  }

  constructor(params) {
    this.params = params;
  }

  async get(session, branch, type, id, next) {
    if (this.params.injectFirst) {
      return { data: makeModel(type, id, this.params.injectFirst) };
    }

    let result = await next();
    if (result) {
      return result;
    }
    if (this.params.injectSecond) {
      return { data: makeModel(type, id, this.params.injectSecond) };
    }
  }

  async search(session, branch, query, next) {
    if (this.params.injectFirst) {
      return {
        data: [ makeModel('examples', '2', this.params.injectFirst) ],
        meta: {
          page: {}
        }
      };
    }
    return next();
  }
};

function makeModel(type, id, flavor) {
  return {
    type,
    id,
    attributes: {
      'example-flavor': flavor
    }
  };
}
