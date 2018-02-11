import Ember from 'ember';
import layout from '../templates/components/mock-login';

export default Ember.Component.extend({
  layout,
  tagName: '',
  mockLogin: Ember.inject.service()
});
