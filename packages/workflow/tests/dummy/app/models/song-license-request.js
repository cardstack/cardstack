import SongLicenseRequest from '@cardstack/models/generated/song-change-request';
import hasMessage from 'dummy/utils/has-message';

export default SongLicenseRequest.extend({
  message: hasMessage('song-license-requests'),

  approve() {
    this.set('status', 'approved');
  },

  deny() {
    this.set('status', 'denied');
  }
});
