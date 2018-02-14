/* eslint-env node */
'use strict';
const Handlebars = require('handlebars');
const log = require('@cardstack/logger')('cardstack/auth');

module.exports = {
  name: '@cardstack/authentication',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },

  // this is part of our public API to other cardstack plugins.
  // Authenticators get this behavior automatically, but Searchers or
  // Indexers may also want to support it, and can use this function
  // for it.
  rewriteExternalUser(externalUser, source) {
    let userTemplate = source.userTemplate || source.authenticator.defaultUserTemplate;
    log.debug("external user %j", externalUser);
    let rewritten;
    if (!userTemplate) {
      rewritten = Object.assign({}, externalUser);
    } else {
      let compiled = Handlebars.compile(userTemplate);
      let stringRewritten = compiled(externalUser);
      try {
        rewritten = JSON.parse(stringRewritten);
      } catch (err) {
        log.error("user-template resulted in invalid json: %s", stringRewritten);
        throw err;
      }
    }
    log.debug("rewritten user %j", rewritten);
    return rewritten;
  }


};
