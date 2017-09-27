import SongChangeRequest from '@cardstack/models/generated/song-change-request';
import hasMessage from 'dummy/utils/has-message';

export default SongChangeRequest.extend({
  message: hasMessage('song-change-requests'),
})
