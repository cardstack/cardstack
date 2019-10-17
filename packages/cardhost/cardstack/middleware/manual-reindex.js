const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardhost');

module.exports = declareInjections({
  indexers: 'hub:indexers',
},

// Warning consider adding auth header support to mitigate DDoS attacks on this endpoint
class ManualReindex {
  middleware() {
    return async (ctxt, next) => {
      if (ctxt.request.path !== '/reindex' || ctxt.request.method !== 'POST') {
        return next();
      }
      log.warn('Manually reindexing');
      this.indexers.update({ forceRefresh: true });
      ctxt.status = 200;
    };
  }
});