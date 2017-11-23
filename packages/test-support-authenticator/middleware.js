const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

module.exports = declareInjections({
  searcher: 'hub:searchers'
},

class TestAuthenticator {
  constructor() {
    this.userId = 'the-default-test-user';
  }
  get category() {
    return 'authentication';
  }
  middleware() {
    let self = this;
    return async (ctxt, next) => {
      if (self.userId != null) {
        ctxt.state.cardstackSession = new Session(
          { id: self.userId, type: 'users' },
          (id) => self.searcher.get('master', 'users', id)
        );
      }
      await next();
    };
  }
});
