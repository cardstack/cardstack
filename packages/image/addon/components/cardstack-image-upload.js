import Component from '@ember/component';
import layout from '../templates/components/cardstack-image-upload';
import { task } from "ember-concurrency";
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  tagName: '',
  store: service(),

  updateImage: task(function * (file) {
    let image = this.get('store').createRecord('cardstack-image', { file });
    yield image.save();
    this.set('showUploader', false);

    let uploadedImage = this.get('uploadedImage');
    if (typeof uploadedImage === 'function') {
      uploadedImage(image);
    }
  }).restartable(),
});