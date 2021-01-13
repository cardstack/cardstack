import { helper } from '@ember/component/helper';

export function coverArtSize(index, size) {
  return size * (0.8**index);
}

export function coverArtLeft(index, size, spacingRatio) {
  return size * 0.8 * index * (0.85**index) * spacingRatio;
}

export default helper(function coverArtLayout([size, count, spacingRatio, index]/*, hash*/) {
  return {
    size: coverArtSize(index, size),
    left: coverArtLeft(index, size, spacingRatio),
    zindex: count - index
  };
});
