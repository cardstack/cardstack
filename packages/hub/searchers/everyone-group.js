const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  currentSchema: 'hub:current-schema',
  searchers: 'hub:searchers'
},

/*
This Searcher handles resources that have anonymous read, 
such as a blog post that should be visible to non-logged-in users.
It skips validation and returns the "everyone" groups document.
The purpose of this Searcher is to avoid an unnecessary
database query. See bootstrap-schema and group.js for
special handling of "everyone" groups.
*/

class EveryoneGroupSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, currentSchema, searchers}) {
    this.dataSource = dataSource;
    this.currentSchema = currentSchema;
    this.searchers = searchers;
  }

  async get(session, type, id, next) {
    if (type === 'groups' && id === 'everyone') {
      return {
        data: {
           id: 'everyone',
           type: 'groups',
           attributes: {
             'search-query': {}
           }
        }
      };
    } else {
      return next();
    }
  }

  async search(session, query, next) {
    return next();
  }

});
