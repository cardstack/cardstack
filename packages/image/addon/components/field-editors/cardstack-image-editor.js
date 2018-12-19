import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/cardstack-image-editor';
import { task } from "ember-concurrency";
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  store: service(),

  disabled: not('enabled'),

  updateImage: task(function * (file) {
    let image = this.get('store').createRecord('cardstack-image', { file });
    yield image.save();
    let field = this.field;
    this.content.watchRelationship(field, () => {
      this.set(`content.${field}`, image);
    });
    this.set('showUploader', false);
  }).restartable(),

  actions: {
    removeImage() {
      let field = this.field;
      this.content.watchRelationship(field, () => {
        this.set(`content.${field}`, null);
      });
    }
  }
});
