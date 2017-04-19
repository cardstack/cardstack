import Ember from 'ember';
import layout from '../templates/components/github-login';
import { configure, getConfiguration } from 'torii/configuration';

export default Ember.Component.extend({
  layout,
  tagName: '',
  session: Ember.inject.service(),
  torii: Ember.inject.service(),

  actions: {
    login() {
      let toriiConfig = Object.assign({}, getConfiguration());
      if (!toriiConfig.providers) {
        toriiConfig.providers = {};
      }
      Object.assign(toriiConfig.providers, {
        'github-oauth2': {
          apiKey: '2680c97f309a904b41b0',
          redirectUri: 'http://localhost:4200',
          scope: 'user:email',
        }
      })
      configure(toriiConfig);
      this.get('torii').open('github').then(({ authorizationCode }) => {
        // TODO this "github" should actually be the configurable
        // server authentication source id
        this.get('session').authenticate('authenticator:cardstack', 'github', { authorizationCode });
      });
    }
  }
});
