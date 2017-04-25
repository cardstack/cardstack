import Ember from 'ember';
import layout from '../templates/components/github-login';
import { configure, getConfiguration } from 'torii/configuration';
import { task } from 'ember-concurrency';
const { getOwner } = Ember;

export default Ember.Component.extend({
  layout,
  tagName: '',
  session: Ember.inject.service(),
  torii: Ember.inject.service(),

  // This is the id of the authentication-sources model on the
  // server. Ours uses 'github' by default. It would theoretically be
  // possible to configure others so that you could use multiple
  // different github oauth2 apps at once.
  source: 'github',

  fetchConfig: task(function * () {
    let { clientId } = yield getOwner(this).lookup('authenticator:cardstack').fetchConfig(this.get('source'));
    extendToriiProviders({
      'github-oauth2': {
        apiKey: clientId,
        scope: 'user:email'
      }
    });
  }).observes('source').on('init'),

  login: task(function * () {
    // this should wait for fetchConfig to be done, but if we block
    // before opening the popup window we run afoul of popup
    // blockers. So instead in our template we don't render ourself at
    // all until after fetchConfig finishes. Fixing this more nicely
    // would require changes to Torii.
    let { authorizationCode } = yield this.get('torii').open('github-oauth2');
    yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode });
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
