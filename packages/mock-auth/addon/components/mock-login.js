import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/mock-login';

export default Component.extend({
  layout,
  tagName: '',
  mockLogin: service()
});
