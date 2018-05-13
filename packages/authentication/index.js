'use strict';
const Handlebars = require('handlebars');
const log = require('@cardstack/logger')('cardstack/auth');
const he = require('he');

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
      // replace double quote HTML entities first with escaped quotes
      // so we dont end up escaping legit JSON quotes
      stringRewritten = he.decode(stringRewritten.replace(/\\/g,'')
                                                 .replace(/&quot;/g, '\\"')).replace(/\s/g, ' ');
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
