const log = require('@cardstack/logger')('cardstack/auth');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');
const Handlebars = require('handlebars');
const _ = require('lodash');

const { declareInjections } = require('@cardstack/di');
const { withJsonErrorHandling } = Error;
const { rewriteExternalUser } = require('..');

function addCorsHeaders(response) {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
}

function isPartialSession(doc) {
  return doc.meta && doc.meta['partial-session'];
}

module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  searcher: 'hub:searchers',
  writer: 'hub:writers',
  sources: 'hub:data-sources',
  controllingBranch: 'hub:controlling-branch'
},

class Authentication {

  get userSearcher() {
    return {
      get: (type, userId) => {
        return this.searcher.get(this.controllingBranch.name, type, userId);
      },
      search: (params) => {
        return this.searcher.search(this.controllingBranch.name, params);
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
      addCorsHeaders(ctxt.response);
      ctxt.status = 200;
    });
  }

  async _locateAuthenticationSource(name) {
    let activeSources = await this.sources.active();
    let source = activeSources.get(name);
    if (source && source.authenticator) {
      return source;
    }
    log.warn('Did not locate authentication source "%s"', name);
    throw new Error(`No such authentication source "${name}"`, { status: 404 });
  }

  async _invokeAuthenticationSource(ctxt, source) {
    let result = await source.authenticator.authenticate(ctxt.request.body, this.userSearcher);

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
      let rewritten = rewriteExternalUser(result, source);
      if (isPartialSession(rewritten)) {
        ctxt.body = rewritten;
        ctxt.status = 200;
        return;
      }
      user = await this._processExternalUser(rewritten, source);
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

  async _processExternalUser(user, source) {
    if (!user.data || !user.data.type) { return; }

    let have;
    let query = source['userCorrelationQuery'];

    try {
      if (user.data.id != null) {
        have = await this.userSearcher.get(user.data.type, user.data.id);
      } else if (query) {
        let compiled = Handlebars.compile(query);
        have = await this.userSearcher.search(JSON.parse(compiled(user)));
      }
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
    }

    if (have && have.data && _.isArray(have.data)) {
      have = have.data.length ? _.merge({ data: have.data[0] }, user) : null; // deep merge
    }

    if (!have && source.mayCreateUser) {
      return { data: await this.writer.create(this.controllingBranch.name, Session.INTERNAL_PRIVLEGED, user.data.type, user.data) };
    }
    if (have && source.mayUpdateUser) {
      user.data.meta = have.data.meta;
      return { data: await this.writer.update(this.controllingBranch.name, Session.INTERNAL_PRIVLEGED, user.data.type, have.data.id, user.data) };
    }
    return have;
  }

  _tokenIssuer(prefix){
    return route.post(`/${prefix}/:module`, compose([
      koaJSONBody({ limit: '1mb' }),
      async (ctxt) => {
        addCorsHeaders(ctxt.response);
        await withJsonErrorHandling(ctxt, async () => {
          let source = await this._locateAuthenticationSource(ctxt.routeParams.module);
          await this._invokeAuthenticationSource(ctxt, source);
        });
      }
    ]));
  }

  _exposeConfiguration(prefix) {
    return route.get(`/${prefix}/:module`, async (ctxt) => {
      addCorsHeaders(ctxt.response);
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
