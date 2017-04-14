const logger = require('heimdalljs-logger');
const Session = require('./session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');

// This is how this module's actions will appear in git history.
// Also, the user id "@cardstack/hub" is special -- it has a grant to
// do all the things (see bootstrap-schema.js)
const actingUser = {
  id: '@cardstack/hub',
  type: 'users',
  attributes: {
    'full-name': '@cardstack/hub/authentication',
    email: 'noreply@nowhere.com'
  }
};

module.exports = declareInjections({
  encryptor: 'encryptor:main',
  searcher: 'searcher:main',
  writer: 'writers:main',
  schemaCache: 'schema-cache:main'
},

class Authentication {

  constructor() {
    this.log = logger('auth');

    // TODO: move these two settings into config
    this.controllingBranch = 'master';
    this.userContentType = 'users';
  }

  get userSearcher() {
    return {
      get: (userId) => {
        return this.searcher.get(this.controllingBranch, this.userContentType, userId);
      },
      search: (params) => {
        let { filter } = params;
        if (!filter) {
          filter = {};
        }
        filter.type = this.userContentType;
        return this.searcher.search(this.controllingBranch, Object.assign({}, params, { filter }));
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

  async _locateAuthenticationSource(name) {
    let source = await this.searcher.get(this.controllingBranch, 'authentication-sources', name);
    let schema = await this.schemaCache.schemaForControllingBranch();
    let plugin = schema.plugins.lookup('authenticators', source.attributes['authenticator-type']);
    return { plugin, source };
  }

  async _invokeAuthenticationSource(ctxt, sourceAndPlugin) {
    let { source, plugin } = sourceAndPlugin;
    let params = source.attributes.params;
    let result = await plugin.authenticate(ctxt.request.body, params, this.userSearcher);
    if (!result || !(result.preloadedUser || result.user)) {
      ctxt.status = 401;
      return;
    }

    let user = result.preloadedUser || await this._processExternalUser(result.user, source);

    if (!user) {
      ctxt.status = 401;
      return;
    }

    ctxt.body = {
      data: user,
      meta: await this.createToken({ userId: user.id }, 86400)
    };
    ctxt.status = 200;
  }

  async _processExternalUser(externalUser, source) {
    let user = this._rewriteExternalUser(externalUser, source.attributes['user-template']);
    let have;
    try {
      have = await this.userSearcher.get(user.id);
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
    }
    if (!have && source.attributes['may-create-user']) {
      return this.writer.create(this.controllingBranch, actingUser, this.userContentType, user);
    }
    if (have && source.attributes['may-update-user']) {
      user.meta = have.meta;
      return this.writer.update(this.controllingBranch, actingUser, this.userContentType, have.id, user);
    }
    return have;
  }

  _rewriteExternalUser(externalUser, userTemplate) {
    this.log.debug("external user %j", externalUser);
    let rewritten;
    if (!userTemplate) {
      rewritten = Object.assign({}, externalUser);
    } else {
      let compiled = Handlebars.compile(userTemplate);
      let stringRewritten = compiled(externalUser);
      try {
        rewritten = JSON.parse(stringRewritten);
      } catch (err) {
        this.log.error("user-template resulted in invalid json: %s", stringRewritten);
        throw err;
      }
    }
    rewritten.type = this.userContentType;
    this.log.debug("rewritten user %j", rewritten);
    return rewritten;
  }

  _tokenIssuer(prefix){
    return route.post(`/${prefix}/:module`, compose([
      koaJSONBody({ limit: '1mb' }),
      async (ctxt) => {
        ctxt.response.set('Access-Control-Allow-Origin', '*');
        try {
          let sourceAndPlugin = await this._locateAuthenticationSource(ctxt.routeParams.module);
          if (sourceAndPlugin) {
            await this._invokeAuthenticationSource(ctxt, sourceAndPlugin);
          }
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
    ]));
  }
});
