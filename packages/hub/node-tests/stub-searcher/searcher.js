module.exports = class StubSearcher {
  constructor(params) {
    this.params = params;
  }

  async get(branch, type, id, next) {
    if (this.params.injectFirst) {
      return makeModel(type, id, this.params.injectFirst);
    }

    let result = await next();
    if (result) {
      return result;
    }
    if (this.params.injectSecond) {
      return makeModel(type, id, this.params.injectSecond);
    }
  }

  async search(branch, query, next) {
    if (this.params.injectFirst) {
      return {
        models: [ makeModel('examples', '2', this.params.injectFirst) ]
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
