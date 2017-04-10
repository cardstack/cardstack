const Encryptor = require('./encryptor');
const logger = require('heimdalljs-logger');
const Session = require('./session');
const bearerTokenPattern = /bearer +(.*)$/i;
const Router = require('koa-better-router');
const koaJSONBody = require('koa-json-body');

class Authentication {
  constructor(key, searcher, plugins) {
    this.encryptor = new Encryptor(key);
    this.log = logger('auth');

    // TODO: these should move into config
    let userContentType = 'users';
    let controllingBranch = 'master';

    this.userLookup = async function(userId) {
      return searcher.get(controllingBranch, userContentType, userId);
    };

    this.plugins = plugins;
    this.tokenMiddleware = this._setupTokenMiddleware();
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
      return this.tokenMiddleware(ctxt, next);
    };
  }

  _setupTokenMiddleware() {
    let router = new Router({ prefix: 'auth' });

    router.addRoute('OPTIONS', '/:module',
      async function(ctxt) {
        ctxt.response.set('Access-Control-Allow-Origin', '*');
        ctxt.response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
        ctxt.response.set('Access-Control-Allow-Headers', 'Content-Type');
        ctxt.status = 200;
      }
    );

    router.addRoute('POST', '/:module', [
      koaJSONBody({ limit: '1mb' }),
      async (ctxt) => {
        ctxt.response.set('Access-Control-Allow-Origin', '*');
        let plugin;
        try {
          plugin = this.plugins.lookup('authenticators', ctxt.params.module);
        } catch(err) {
          if (/Unknown authenticators/.test(err.message)) {
            this.log.warn(`No such authenticator ${ctxt.params.module}`);
          } else {
            throw err;
          }
        }
        if (!plugin) {
          ctxt.status = 404;
          return;
        }
        try {
          let result = await plugin.authenticate(ctxt.request.body);
          if (!result || result.id == null) {
            ctxt.status = 401;
            return;
          }
        } catch (err) {
          if (!err.isCardstackError) { throw err; }
          let errors = [err];
          if (err.additionalErrors) {
            errors = errors.concat(err.additionalErrors);
          }
          ctxt.body = { errors };
          console.log("setting error body");
          ctxt.status = errors[0].status;
        }
      }
    ]);

    return router.middleware();
  }

}


module.exports = Authentication;
