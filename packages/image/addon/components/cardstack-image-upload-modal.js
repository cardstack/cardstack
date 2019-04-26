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

  uploaded: 0,
  totalToUpload: null,

  uploadPercentage: computed('uploaded', 'totalToUpload', function() {
    if (!this.totalToUpload) {
      return 0;
    }
    return Math.round(100 * this.uploaded / this.totalToUpload);
  }),

  endpointUrl: computed('typeName', function() {
    return `${hubURL}/api/cardstack-files`;
  }),

  uploadRequest(event) {
    let token = this.cardstackSession.token;
    let file = event.target.files[0];
    let body = new FormData();
    body.append('file', file);

    let xhr = new XMLHttpRequest();
    xhr.open('POST', this.get('endpointUrl'));
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        let { loaded, total } = event;
        this.setProperties({
          uploaded: loaded,
          totalToUpload: total
        });
      }
    });
    xhr.send(body);

    return new Promise((resolve, reject) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) {
          return;
        }

        let { status } = xhr;
        if (status >= 200 && status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject({
            status: xhr.status,
            statusText: xhr.statusText
          });
        }
      }
    });
  },

  uploadFile: task(function * (event) {
    let jsonApiDocument = yield this.uploadRequest(event);

    this.store.pushPayload(jsonApiDocument);
    let { type, id } = jsonApiDocument.data;
    let fileRecord = this.store.peekRecord(type, id);

    this.updateImage(fileRecord);
  }).drop(),
});
