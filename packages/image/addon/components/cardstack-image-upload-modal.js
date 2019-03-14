import Component from '@ember/component';
import { hubURL } from "@cardstack/plugin-utils/environment";
import layout from '../templates/components/cardstack-image-upload-modal';
import { inject as service } from "@ember/service";
import { computed } from "@ember/object";
import { task } from "ember-concurrency";


export default Component.extend({
  classNames: ['cardstack-image-upload-modal'],
  store: service(),
  cardstackSession: service(),
  layout,

  endpointUrl: computed('typeName', function() {
    return `${hubURL}/api/cardstack-files`;
  }),

  uploadFile: task(function * (event) {
    let token = this.get('cardstackSession.token');
    let file = event.target.files[0];
    let body = new FormData();
    body.append('file', file);

    let response = yield fetch(this.get('endpointUrl'), {
      method: 'POST',
      body,
      headers: { 'authorization': `Bearer ${token}` }
    });
    let jsonApiDocument = yield response.json();

    this.get('store').pushPayload(jsonApiDocument);
    let { type, id } = jsonApiDocument.data;
    let fileRecord = this.get('store').peekRecord(type, id);

    this.get('updateImage')(fileRecord);
  }).drop(),
});
