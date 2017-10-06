const log = require('@cardstack/plugin-utils/logger')('auth');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');

const { declareInjections } = require('@cardstack/di');
const { withJsonErrorHandling } = Error;
const { rewriteExternalUser } = require('..');

module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  searcher: 'hub:searchers',
  writer: 'hub:writers',
  schemaCache: 'hub:schema-cache'
},

class Authentication {

  constructor() {

    // TODO: move these two settings into config
    this.controllingBranch = 'master';

  }

  get userSearcher() {
    return {
      get: (type, userId) => {
        return this.searcher.get(this.controllingBranch, type, userId);
      },
      search: (params) => {
        return this.searcher.search(this.controllingBranch, params);
      }
    };
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
        log.debug("Ignoring expired token");
      } else {
        return new Session(sessionPayload, this.userSearcher);
      }
    } catch (err) {
      if (/unable to authenticate data|invalid key length|Not a valid signed message/.test(err.message)) {
        log.warn("Ignoring invalid token");
      } else {
        throw err;
      }
    }
  }

  get category() {
    return 'authentication';
  }

  middleware() {
    const prefix = 'auth';
    return compose([
      this._tokenVerifier(),
      this._tokenIssuerPreflight(prefix),
      this._tokenIssuer(prefix),
      this._exposeConfiguration(prefix)
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

  async _locateAuthenticationSource(name) {
    let schema = await this.schemaCache.schemaForControllingBranch();
    let source = schema.dataSources.get(name);
    if (source && source.authenticator) {
      return source;
    }
    log.warn('Did not locate authentication source "%s"', name);
    throw new Error(`No such authentication source "${name}"`, { status: 404 });
  }

  async _invokeAuthenticationSource(ctxt, source) {
    let result = await source.authenticator.authenticate(ctxt.request.body, this.userSearcher);

    if (result && result.meta && result.meta.partialSession) {
      if (result.data.type == null) {
        result.data.type = 'partial-sessions';
      }

      // top-level meta is not passed through (it was for
      // communicating from plugin to us). Plugins could use
      // resource-level metadata instead if they want to.
      delete result.meta;

      ctxt.body = result;
      ctxt.status = 200;
      return;
    }

    if (!result) {
      ctxt.status = 401;
      ctxt.body = {
        errors: [{
          title: "Not authorized",
          detail: "The authentication plugin did not approve your request"
        }]
      };
      return;
    }

    let user;
    if (result.meta && result.meta.preloaded) {
      delete result.meta;
      user = result;
    } else {
      user = await this._processExternalUser(result, source);
    }

    if (!user || !user.data) {
      ctxt.status = 401;
      ctxt.body = {
        errors: [{
          title: "Not authorized",
          detail: "The authentication plugin attempted to approve you but we found no corresponding user record"
        }]
      };

      return;
    }

    let tokenMeta = await this.createToken({ id: user.data.id, type: user.data.type }, source.tokenExpirySeconds);
    if (!user.data.meta) {
      user.data.meta = tokenMeta;
    } else {
      Object.assign(user.data.meta, tokenMeta);
    }
    ctxt.body = user;
    ctxt.status = 200;
  }

  async _processExternalUser(externalUser, source) {
    let user = rewriteExternalUser(externalUser, source);
    if (!user.data || !user.data.type) { return; }

    let have;

    if (user.data.id != null) {
      try {
        have = await this.userSearcher.get(user.data.type, user.data.id);
      } catch (err) {
        if (err.status !== 404) {
          throw err;
        }
      }
    }

    if (!have && source.mayCreateUser) {
      return { data: await this.writer.create(this.controllingBranch, Session.INTERNAL_PRIVLEGED, user.data.type, user.data) };
    }
    if (have && source.mayUpdateUser) {
      user.data.meta = have.data.meta;
      return { data: await this.writer.update(this.controllingBranch, Session.INTERNAL_PRIVLEGED, user.data.type, have.data.id, user.data) };
    }
    return have;
  }

  _tokenIssuer(prefix){
    return route.post(`/${prefix}/:module`, compose([
      koaJSONBody({ limit: '1mb' }),
      async (ctxt) => {
        ctxt.response.set('Access-Control-Allow-Origin', '*');
        await withJsonErrorHandling(ctxt, async () => {
          let source = await this._locateAuthenticationSource(ctxt.routeParams.module);
          await this._invokeAuthenticationSource(ctxt, source);
        });
      }
    ]));
  }

  _exposeConfiguration(prefix) {
    return route.get(`/${prefix}/:module`, async (ctxt) => {
      await withJsonErrorHandling(ctxt, async () => {
        let source = await this._locateAuthenticationSource(ctxt.routeParams.module);
        if (source.authenticator.exposeConfig) {
          ctxt.body = await source.authenticator.exposeConfig();
        } else {
          ctxt.body = {};
        }
      });
    });
  }
});
