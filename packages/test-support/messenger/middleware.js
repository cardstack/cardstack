const { declareInjections } = require('@cardstack/di');

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
        ctxt.state.cardstackSession = {
          userId: self.userId,
          async loadUser() {
            return self.searcher.get('master', 'users', self.userId);
          }
        };
      }
      await next();
    };
  }
});
