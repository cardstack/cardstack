import Component from '@ember/component';
import layout from '../templates/components/cs-active-composition-panel';
import { task, timeout } from 'ember-concurrency';
import scrollToBounds from '../scroll-to-bounds';
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  classNames: ['cs-active-composition-panel'],

  validationErrors: null,

  data: service('cardstack-data'),

  validate: task(function * () {
    let errors = yield this.get('data').validate(this.model);
    this.set('validationErrors', errors);
  }),

  highlightAndScrollToField: task(function * (field) {
    this.get('highlightField')(field);
    if (field) {
      yield timeout(500);
      scrollToBounds(field.bounds());
    }
  }).restartable()
});
