const logger = require('@cardstack/plugin-utils/logger');
const Session = require('@cardstack/plugin-utils/session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');
const Handlebars = require('handlebars');
const { declareInjections } = require('@cardstack/di');


module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  searcher: 'hub:searchers',
  writer: 'hub:writers',
  schemaCache: 'hub:schema-cache'
},

class Authentication {

  constructor() {
    this.log = logger('auth');

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
        this.log.debug("Ignoring expired token");
      } else {
        return new Session(sessionPayload, this.userSearcher);
      }
    } catch (err) {
      if (/unable to authenticate data|invalid key length|Not a valid signed message/.test(err.message)) {
        this.log.warn("Ignoring invalid token");
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
    let source = await this.searcher.get(this.controllingBranch, 'authentication-sources', name);
    let schema = await this.schemaCache.schemaForControllingBranch();
    let plugin = schema.plugins.lookupFeature('authenticators', source.data.attributes['authenticator-type']);
    return { plugin, source };
  }

  async _invokeAuthenticationSource(ctxt, sourceAndPlugin) {
    let { source, plugin } = sourceAndPlugin;
    let params = source.data.attributes.params;
    let result = await plugin.authenticate(ctxt.request.body, params, this.userSearcher);

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
      user = await this._processExternalUser(result, source, plugin);
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

    let tokenMeta = await this.createToken({ id: user.data.id, type: user.data.type }, 86400);
    if (!user.data.meta) {
      user.data.meta = tokenMeta;
    } else {
      Object.assign(user.data.meta, tokenMeta);
    }
    ctxt.body = user;
    ctxt.status = 200;
  }

  async _processExternalUser(externalUser, source, plugin) {
    let user = this._rewriteExternalUser(externalUser, source.data.attributes['user-template'] || plugin.defaultUserTemplate);
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

    if (!have && source.data.attributes['may-create-user']) {
      return { data: await this.writer.create(this.controllingBranch, Session.INTERNAL_PRIVLEGED, user.data.type, user.data) };
    }
    if (have && source.data.attributes['may-update-user']) {
      user.data.meta = have.data.meta;
      return { data: await this.writer.update(this.controllingBranch, Session.INTERNAL_PRIVLEGED, user.data.type, have.data.id, user.data) };
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
          } else {
            this.log.warn('Did not locate authentication source %s', ctxt.routeParams.module);
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

  _exposeConfiguration(prefix) {
    return route.get(`/${prefix}/:module`, async (ctxt) => {
      let sourceAndPlugin = await this._locateAuthenticationSource(ctxt.routeParams.module);
      if (sourceAndPlugin) {
        let { source, plugin } = sourceAndPlugin;
        let result;
        if (plugin.exposeConfig) {
          result = await plugin.exposeConfig(source.data.attributes.params);
        } else {
          result = {};
        }
        ctxt.body = result;
      }
    });
  }
});
