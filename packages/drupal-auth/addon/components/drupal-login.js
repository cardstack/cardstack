import { inject as service } from '@ember/service';
import Component from '@ember/component';
import { getOwner } from '@ember/application';
import layout from '../templates/components/drupal-login';
import { configure, getConfiguration } from 'torii/configuration';
import { task } from 'ember-concurrency';

export default Component.extend({
  layout,
  tagName: '',
  session: service(),
  torii: service(),

  // This is the id of the authentication-sources model on the
  // server. Ours uses 'drupal' by default. It would theoretically be
  // possible to configure others so that you could use multiple
  // different drupal oauth2 apps at once.
  source: 'drupal',

  fetchConfig: task(function * () {
    let { clientId, drupalUrl } = yield getOwner(this).lookup('authenticator:cardstack').fetchConfig(this.get('source'));
    extendToriiProviders({
      'drupal-oauth2-code': {
        apiKey: clientId,
        drupalUrl
      }
    });
  }).observes('source').on('init'),

  login: task(function * () {
    // this should wait for fetchConfig to be done, but if we block
    // before opening the popup window we run afoul of popup
    // blockers. So instead in our template we don't render ourself at
    // all until after fetchConfig finishes. Fixing this more nicely
    // would require changes to Torii.
    let { authorizationCode, redirectUri } = yield this.get('torii').open('drupal-oauth2-code');
    yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode, redirectUri });
  }).drop()
});

function extendToriiProviders(newConfig) {
  let toriiConfig = Object.assign({}, getConfiguration());
  if (!toriiConfig.providers) {
    toriiConfig.providers = {};
  }
  Object.assign(toriiConfig.providers, newConfig)
  configure(toriiConfig);
}
