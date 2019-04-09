const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

module.exports = declareInjections({
  searcher: 'hub:searchers',
  controllingBranch: 'hub:controlling-branch'
},

class Sessions {

  constructor() {
    this._userSearcher = null;
  }

  get userSearcher() {
    if (!this._userSearcher) {
      this._userSearcher = {
        get: (type, userId) => {
          return this.searcher.getCard(Session.INTERNAL_PRIVILEGED, type, userId, { version: this.controllingBranch.name });
        },
        search: (params) => {
          return this.searcher.searchForCard(Session.INTERNAL_PRIVILEGED, this.controllingBranch.name, params);
        }
      };
    }
    return this._userSearcher;
  }

  create(type, id, meta) {
    return new Session({ type, id }, this.userSearcher, null, null, meta);
  }
});
