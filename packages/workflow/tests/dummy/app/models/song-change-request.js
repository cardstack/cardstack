import SongChangeRequest from '@cardstack/models/generated/song-change-request';
import { computed } from '@ember/object';

export default SongChangeRequest.extend({
  message: computed(function() {
    let messages = this.get('store').peekAll('message');
    return messages.find((message) => {
      return message.get('cardId') === this.get('id') &&
        message.get('cardType') === 'song-change-requests';
     });
  }),

  // _loadMessage: task(function * () {
  //   let message = yield this.get('store').queryRecord('message', {
  //     cardId: this.get('id'),
  //     cardType: 'song-change-requests'
  //   });
  //   this.set('message', message);
  // }),
})
