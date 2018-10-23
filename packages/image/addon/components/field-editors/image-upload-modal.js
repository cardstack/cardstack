import Component from '@ember/component';
import { hubURL } from "@cardstack/plugin-utils/environment";
import layout from '../../templates/components/field-editors/image-upload-modal';
import $ from "jquery";
import { inject as service } from "@ember/service";
import { computed } from "@ember/object";
import { task } from "ember-concurrency";


export default Component.extend({
  classNames: ['cardstack-image-upload-modal'],
  store: service(),
  layout,

  endpointUrl: computed('typeName', function() {
    return `${hubURL}/api/cs-files`;
  }),

  uploadFile: task(function * (event) {
    let file = event.target.files[0];
    let data = new FormData();
    data.append('file', file);

    let jsonApiDocument = yield $.ajax({
        url: this.get('endpointUrl'),
        type: "POST",
        data,
        contentType: false,
        processData: false
    });

    this.get('store').pushPayload(jsonApiDocument);
    let { type, id } = jsonApiDocument.data;
    let fileRecord = this.get('store').peekRecord(type, id);

    return fileRecord;

  }).restartable(),

  actions: {
    updateImage() {
      this.get('updateImage')(this.get('uploadFile.lastSuccessful.value'));
    }
  }
});
