import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/github-login';
import { configure, getConfiguration } from 'torii/configuration';
import { task } from 'ember-concurrency';
import { clientId } from '@cardstack/github-auth/environment';

export default Component.extend({
  layout,
  tagName: '',
  session: service(),
  torii: service(),

  // This is the id of the authentication-sources model on the
  // server. Ours uses 'github' by default. It would theoretically be
  // possible to configure others so that you could use multiple
  // different github oauth2 apps at once.
  source: 'github',

  init() {
    this._super();

    extendToriiProviders({
      'github-oauth2': {
        apiKey: clientId,
        scope: 'user:email',
      },
    });
  },

  login: task(function*() {
    // this should wait for fetchConfig to be done, but if we block
    // before opening the popup window we run afoul of popup
    // blockers. So instead in our template we don't render ourself at
    // all until after fetchConfig finishes. Fixing this more nicely
    // would require changes to Torii.
    let { authorizationCode } = yield this.get('torii').open('github-oauth2');
    yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode });
  }).drop(),
});

function extendToriiProviders(newConfig) {
  let toriiConfig = Object.assign({}, getConfiguration());
  if (!toriiConfig.providers) {
    toriiConfig.providers = {};
  }
  Object.assign(toriiConfig.providers, newConfig);
  configure(toriiConfig);
}
