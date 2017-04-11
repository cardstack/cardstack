const Encryptor = require('./encryptor');
const logger = require('heimdalljs-logger');
const Session = require('./session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');

class Authentication {
  constructor(key, searcher, plugins) {
    this.encryptor = new Encryptor(key);
    this.log = logger('auth');

    // TODO: these should move into config
    let userContentType = 'users';
    let controllingBranch = 'master';

    this.userSearcher = {
      get(userId) {
        return searcher.get(controllingBranch, userContentType, userId);
      },
      search(params) {
        let { filter } = params;
        if (!filter) {
          filter = {};
        }
        filter.type = userContentType;
        return searcher.search(controllingBranch, Object.assign({}, params, { filter }));
      }
    };

    this.plugins = plugins;
  }

  async createToken(sessionPayload, validSeconds) {
    let validUntil = Math.floor(Date.now()/1000 + validSeconds);
    return {
      token: this.encryptor.encryptAndSign([sessionPayload, validUntil]),
      validUntil
    };
  }

  _tokenToSession(token) {
    try {
      let [sessionPayload, validUntil] = this.encryptor.verifyAndDecrypt(token);
      if (validUntil <= Date.now()/1000) {
        this.log.debug("Ignoring expired token");
      } else {
        return new Session(sessionPayload, this.userSearcher);
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
    const prefix = 'auth';
    return compose([
      this._tokenVerifier(),
      this._tokenIssuerPreflight(prefix),
      this._tokenIssuer(prefix)
    ]);
  }

  _tokenVerifier() {
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

  _tokenIssuerPreflight(prefix) {
    return route.options(`/${prefix}/:module`,  async (ctxt) => {
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
      ctxt.response.set('Access-Control-Allow-Headers', 'Content-Type');
      ctxt.status = 200;
    });
  }

  _locateAuthenticatorPlugin(name) {
    try {
      return this.plugins.lookup('authenticators', name);
    } catch(err) {
      if (/Unknown authenticators/.test(err.message)) {
        this.log.warn(`No such authenticator ${name}`);
      } else {
        throw err;
      }
    }
  }

  async _invokeAuthenticatorPlugin(ctxt, plugin) {
    try {
      let result = await plugin.authenticate(ctxt.request.body, this.userSearcher);
      if (!result || result.userId == null) {
        ctxt.status = 401;
        return;
      }
      ctxt.body = await this.createToken({ userId: result.userId }, 86400);
      ctxt.status = 200;
    } catch (err) {
      if (!err.isCardstackError) { throw err; }
      let errors = [err];
      if (err.additionalErrors) {
        errors = errors.concat(err.additionalErrors);
      }
      ctxt.body = { errors };
      ctxt.status = errors[0].status;
    }
  }

  _tokenIssuer(prefix){
    return route.post(`/${prefix}/:module`, compose([
      koaJSONBody({ limit: '1mb' }),
      async (ctxt) => {
        ctxt.response.set('Access-Control-Allow-Origin', '*');
        let plugin = this._locateAuthenticatorPlugin(ctxt.routeParams.module);
        if (plugin) {
          await this._invokeAuthenticatorPlugin(ctxt, plugin);
        }
      }
    ]));
  }
}


module.exports = Authentication;
