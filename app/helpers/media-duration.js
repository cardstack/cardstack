import { helper } from '@ember/component/helper';

export default helper(function mediaDuration([duration]/*, hash*/) {
  let minutes = Math.floor(duration / 60);
  let seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});
