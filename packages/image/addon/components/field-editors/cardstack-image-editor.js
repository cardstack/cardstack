import { not } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/cardstack-image-editor';
import { task } from "ember-concurrency";
import { inject as service } from '@ember/service';

const cardPickerOptions = {
  sort: '-image-created-at',
  searchFields: ['image-file-name'],
  searchType: 'prefix'
};

export default Component.extend({
  layout,
  cardPicker: service('cardstack-card-picker'),

  disabled: not('enabled'),

  chooseImage: task(function * () {
    let image;
    try {
      image = yield this.get('cardPicker').pickCard('cardstack-image', cardPickerOptions);
    } catch (e) {
      if (e !== 'no card selected') { throw e; }
    }
    if (!image) { return; }

    let field = this.field;
    this.content.watchRelationship(field, () => {
      this.set(`content.${field}`, image);
    });
  }).drop(),

  actions: {
    removeImage() {
      let field = this.field;
      this.content.watchRelationship(field, () => {
        this.set(`content.${field}`, null);
      });
    }
  }
});
