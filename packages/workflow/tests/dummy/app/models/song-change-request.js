import SongChangeRequest from '@cardstack/models/generated/song-change-request';
import hasMessage from '@cardstack/workflow/utils/has-message';

export default SongChangeRequest.extend({
  message: hasMessage('song-change-requests'),

  approve() {
    this.set('status', 'approved');
  },

  deny() {
    this.set('status', 'denied');
  }
});
