import Component from '@ember/component';
import { task } from 'ember-concurrency';
import layout from '../../templates/components/field-editors/string-editor';

export default Component.extend({
  layout,

  validate: task(function * () {
    yield this.content.save({
      adapterOptions: {
        onlyValidate: true
      }
    });
  })
});
