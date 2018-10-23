import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/image-editor';
import { task } from "ember-concurrency";
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  store: service(),

  disabled: not('enabled'),

  updateImage: task(function * (file) {
    let image = this.get('store').createRecord('image', { file });
    yield image.save();
    this.set(`content.${this.get('field')}`, image);
    this.set('showUploader', false);
  }).restartable()
});
