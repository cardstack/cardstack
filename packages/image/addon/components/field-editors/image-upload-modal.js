import Component from '@ember/component';
import { hubURL } from "@cardstack/plugin-utils/environment";
import layout from '../../templates/components/field-editors/image-upload-modal';
import $ from "jquery";
import { inject as service } from "@ember/service";
import { bind } from "@ember/runloop"
import { pluralize } from 'ember-inflector';
import { computed } from "@ember/object";


export default Component.extend({
  classNames: ['cardstack-image-upload-modal'],
  store: service(),
  layout,

  uploadComplete(jsonApiDocument) {
    this.get('store').pushPayload(jsonApiDocument);
    let file = this.get('store').peekRecord(this.get('typeName'), jsonApiDocument.data.id);
    this.set('file', file);
  },

  endpointUrl: computed('typeName', function() {
    return `${hubURL}/api/${pluralize(this.get('typeName'))}`;
  }),

  typeName: computed('content', 'field', function() {
    return this.get('content').constructor.metaForProperty(this.get('field')).type;
  }),

  actions: {
    uploadFile(event) {
      let file = event.target.files[0];
      let data = new FormData();
      data.append('file', file);


      $.ajax({
          url: this.get('endpointUrl'),
          type: "POST",
          data,
          contentType: false,
          processData: false
      }).then(bind(this, this.uploadComplete));
    },

    updateImage() {
      this.get('updateImage')(this.get('file'));
    }
  }
});
