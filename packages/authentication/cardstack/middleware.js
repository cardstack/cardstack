const log = require('@cardstack/logger')('cardstack/auth');
const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const bearerTokenPattern = /bearer +(.*)$/i;
const compose = require('koa-compose');
const route = require('koa-better-route');
const koaJSONBody = require('koa-json-body');

const { declareInjections } = require('@cardstack/di');
const { withJsonErrorHandling } = Error;

function addCorsHeaders(response) {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function isPartialSession(doc) {
  return doc.meta && doc.meta['partial-session'];
}

module.exports = declareInjections({
  encryptor: 'hub:encryptor',
  sessions: 'hub:sessions',
  searcher: 'hub:searchers',
  writer: 'hub:writers',
  indexers: 'hub:indexers',
  sources: 'hub:data-sources',
  controllingBranch: 'hub:controlling-branch',
  ciSession: 'config:ci-session',
  currentSchema: 'hub:current-schema'
},

class Authentication {

  get userSearcher() {
    return {
      get: (type, userId) => {
        return this.searcher.get(Session.INTERNAL_PRIVILEGED, this.controllingBranch.name, type, userId);
      },
      search: (params) => {
        return this.searcher.search(Session.INTERNAL_PRIVILEGED, this.controllingBranch.name, params);
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

  async _tokenToSession(token, ctxt) {
    let ciSessionId = this.ciSession && this.ciSession.id;
    if (ciSessionId && token === ciSessionId) {
      return Session.INTERNAL_PRIVILEGED;
    }

    try {
      let [sessionPayload, validUntil] = this.encryptor.verifyAndDecrypt(token);
      if (validUntil <= Date.now()/1000) {
        log.debug("Ignoring expired token");
      } else {
        let sessionMeta = await this._sessionMeta(ctxt);
        return this.sessions.create(sessionPayload.type, sessionPayload.id, sessionMeta);
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
      this._tokenStatusPreflight(prefix),
      this._tokenStatus(prefix),
      this._exposeConfiguration(prefix)
    ]);
  }

  _tokenVerifier() {
    return async (ctxt, next) => {
      log.trace(`client headers: ${JSON.stringify(ctxt.header)}`);
      log.trace(`client IP address: ${ctxt.ip}`);

      let m = bearerTokenPattern.exec(ctxt.header['authorization']);
      if (m) {
        let session = await this._tokenToSession(m[1], ctxt);
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

  _tokenStatusPreflight(prefix) {
    return route.options(`/${prefix}/:module/status`,  async (ctxt) => {
      addCorsHeaders(ctxt.response);
      ctxt.status = 200;
    });
  }

  _tokenStatus(prefix){
    return route.get(`/${prefix}/:module/status`, compose([
      async (ctxt) => {
        addCorsHeaders(ctxt.response);
        await withJsonErrorHandling(ctxt, async () => {
          let session = ctxt.state.cardstackSession;
          if (!session) {
            ctxt.status = 401;
            ctxt.body = {
              errors: [{
                title: "Not authorized",
                detail: "The authentication plugin was unable to validate the session"
              }]
            };
            return;
          }
          let user = await this.userSearcher.get(session.type, session.id);

          if (!user) { throw new Error(`cant find user type ${session.type} id ${session.id}`); }

          await this._generateSession(ctxt, user);

          let m = bearerTokenPattern.exec(ctxt.header['authorization']);
          if (m) {
            ctxt.body.data.meta['prevToken'] = m[1];
          }
        });
      }
    ]));
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

  async _sessionMeta(ctxt) {
    let config, ip;

    try {
       config = await this.searcher.getFromControllingBranch(Session.INTERNAL_PRIVILEGED, 'plugin-configs', '@cardstack/authentication');
    } catch (e) {
      // no config for the authentication plugin, assume header should not be respected
    }

    if (config && config.data.attributes['plugin-config'] && config.data.attributes['plugin-config']['allow-x-forwarded-for']) {
      ip = ctxt.header['x-forwarded-for'] || ctxt.ip;
    } else {
      ip = ctxt && ctxt.ip;
    }

    return {ip};
  }

  async _generateSession(ctxt, user, tokenExpirySeconds=24*3600) {
    let sessionPayload = { id: user.data.id, type: user.data.type };
    let sessionMeta = await this._sessionMeta();
    let session = this.sessions.create(sessionPayload.type, sessionPayload.id, sessionMeta);

    let schema = await this.currentSchema.forControllingBranch();
    let canLogin = await schema.hasLoginAuthorization(session);

    if (!canLogin) {
      ctxt.status = 401;
      ctxt.body = {
        errors: [{
          title: "Not authorized",
          detail: "You do not posses a grant that authorizes you to login"
        }]
      };

      return;
    }

    let tokenMeta = await this.createToken(sessionPayload, tokenExpirySeconds);
    if (!user.data.meta) {
      user.data.meta = tokenMeta;
    } else {
      Object.assign(user.data.meta, tokenMeta);
    }

    let authorizedUser = await this._applyReadAuthorization(session, user);

    ctxt.body = authorizedUser;
    ctxt.status = 200;
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
      let rewritten = await source.rewriteExternalUser(result);
      
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

    await this._generateSession(ctxt, user, source.tokenExpirySeconds);
  }

  async _applyReadAuthorization(session, user) {
    let schema = await this.currentSchema.forControllingBranch();
    let authorizedUser = await schema.applyReadAuthorization(user, { session });
    if (!authorizedUser) {
      // User has no grant to even see that their own record
      // exists. But users necessarily know they exists if they're
      // able to log in, so we default to an empty document.
      authorizedUser = {
        data: {
          type: user.data.type,
          id: user.data.id,
          meta: user.data.meta
        }
      };
    }

    return authorizedUser;
  }

  async _processExternalUser(user, source) {
    if (!user.data || !user.data.type) { return; }

    let have;
    try {
      let query = await source.externalUserCorrelationQuery(user);
      if (query) {
        let searchResult = await this.userSearcher.search(query);
        if (searchResult.data.length > 0) {
          have = { data: searchResult.data[0] };
        }
      } else {
        have = await this.userSearcher.get(user.data.type, user.data.id);
      }
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
    }

    let madeIndexUpdate = false;
    if (!have && source.mayCreateUser) {
      have = await this.writer.create(this.controllingBranch.name, Session.INTERNAL_PRIVILEGED, user.data.type, user);
      madeIndexUpdate = true;
    }
    if (have && source.mayUpdateUser) {
      user.data.meta = have.data.meta;
      have = await this.writer.update(this.controllingBranch.name, Session.INTERNAL_PRIVILEGED, user.data.type, have.data.id, user);
      madeIndexUpdate = true;
    }

    if (madeIndexUpdate) {
      await this.indexers.update({ hints: [{ type: have.data.type, id: have.data.id, branch: this.controllingBranch.name }] });
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
