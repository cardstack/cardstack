import Component from '@ember/component';
import layout from '../templates/components/cardstack-image-upload';
import { task } from "ember-concurrency";
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  tagName: '',
  store: service(),

  updateImage: task(function * (file) {
    let image = this.store.createRecord('cardstack-image', { file });
    yield image.save();
    this.set('showUploader', false);

    if (typeof this.uploadedImage === 'function') {
      this.uploadedImage(image);
    }
  }).restartable(),
});
