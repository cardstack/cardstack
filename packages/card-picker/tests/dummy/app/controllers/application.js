import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import { hubURL } from "@cardstack/plugin-utils/environment";

export default Controller.extend({
  tools: service('cardstack-card-picker'),

  imgSrc: computed('card', function() {
    return `${hubURL}/api/cardstack-files/${this.get('content.file.id')}`;
  }),

  actions: {
    openButton() {
      this.get('tools').pickCard('cardstack-image', {
        sort: '-image-created-at',
        searchFields: ['image-file-name'],
        searchType: 'prefix'
      })
      .then(card => {
        this.set('card', card);
      })
      .catch(err => {
        if (err !== 'no card selected') { throw err; }
      });
    }
  }
});
