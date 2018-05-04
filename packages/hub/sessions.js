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
          return this.searcher.get(Session.INTERNAL_PRIVILEGED, this.controllingBranch.name, type, userId);
        },
        search: (params) => {
          return this.searcher.search(Session.INTERNAL_PRIVILEGED, this.controllingBranch.name, params);
        }
      };
    }
    return this._userSearcher;
  }

  create(type, id) {
    return new Session({ type, id }, this.userSearcher);
  }
});
