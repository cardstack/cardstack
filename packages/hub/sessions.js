const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

module.exports = declareInjections(
  {
    searcher: 'hub:searchers',
  },

  class Sessions {
    constructor() {
      this._userSearcher = null;
    }

    get userSearcher() {
      if (!this._userSearcher) {
        this._userSearcher = {
          get: (type, userId) => {
            return this.searcher.get(Session.INTERNAL_PRIVILEGED, 'local-hub', type, userId);
          },
          search: params => {
            return this.searcher.search(Session.INTERNAL_PRIVILEGED, params);
          },
        };
      }
      return this._userSearcher;
    }

    create(type, id, meta) {
      return new Session({ type, id }, this.userSearcher, null, null, meta);
    }
  }
);
