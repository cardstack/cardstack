module.exports = class StubSearcher {
  static create(params) {
    return new this(params);
  }

  constructor(params) {
    this.params = params;
  }

  //TODO rename 'type'
  async get({ session, sourceId, type, id, snapshotVersion, next }) {
    if (type === 'sample-searcher-models' && id === '1') {
      return {
        data: makeModel(type, id)
      };
    }
    return next();
  }

  async search({ session, query, next }) {
    if (query.filter && query.filter.type && query.filter.type === 'sample-searcher-models') {
      return {
        data: [ makeModel('sample-searcher-models', '1') ],
        meta: {
          page: {}
        }
      };
    }
    return next();
  }
};

function makeModel(type, id) {
  return {
    type,
    id,
    attributes: {
      'height': 1
    }
  };
}
