const Encryptor = require('./encryptor');
const logger = require('heimdalljs-logger');
const Session = require('./session');
const bearerTokenPattern = /bearer +(.*)$/i;

class Authentication {
  constructor(key, searcher) {
    this.encryptor = new Encryptor(key);
    this.log = logger('auth');

    // TODO: these should move into config
    let userContentType = 'users';
    let controllingBranch = 'master';

    this.userLookup = async function(userId) {
      return searcher.get(controllingBranch, userContentType, userId);
    };
  }

  async createToken(sessionPayload, validSeconds) {
    let validUntil = Math.floor(Date.now()/1000 + validSeconds);
    return this.encryptor.encryptAndSign([sessionPayload, validUntil]);
  }

  _tokenToSession(token) {
    try {
      let [sessionPayload, validUntil] = this.encryptor.verifyAndDecrypt(token);
      if (validUntil <= Date.now()/1000) {
        this.log.debug("Ignoring expired token");
      } else {
        return new Session(sessionPayload, this.userLookup);
      }
    } catch (err) {
      if (/unable to authenticate data|invalid key length/.test(err.message)) {
        this.log.warn("Ignoring invalid token");
      } else {
        throw err;
      }
    }
  }

  middleware() {
    return async (ctxt, next) => {
      let m = bearerTokenPattern.exec(ctxt.header['authorization']);
      if (m) {
        let session = this._tokenToSession(m[1]);
        if (session) {
          ctxt.state.cardstackSession = session;
        }
      }
      await next();
    };
  }

}


module.exports = Authentication;
