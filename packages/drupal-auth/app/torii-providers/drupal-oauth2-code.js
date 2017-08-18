import Ember from 'ember';
import Provider from 'torii/providers/oauth2-code';
import {configurable} from 'torii/configuration';

export default Provider.extend({
  name: 'drupal-oauth2-code',
  drupalUrl: configurable('drupalUrl'),
  baseUrl: Ember.computed('drupalUrl', function() {
    return `${this.get('drupalUrl')}/oauth/authorize`;
  }),
  responseParams: ['code', 'state']
});
