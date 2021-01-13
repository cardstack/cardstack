import { helper } from '@ember/component/helper';
import { coverArtSize, coverArtLeft } from './cover-art-layout';

export default helper(function coverArtSpacing([size, count, maxWidth]/*, hash*/) {
  let naturalWidth = (coverArtSize(count, size) + coverArtLeft(count, size, 1.0)); // approx
  let spacingRatio = maxWidth / naturalWidth;
  return Math.min(1, spacingRatio);
});
