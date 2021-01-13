import Component from '@glimmer/component';
import "./style.css";
import { action } from '@ember/object';
export default class extends Component {
  get size() {
    return this.args.size || 80;
  }

  get maxWidth() {
    return this.args.maxWidth || 190;
  }

  get coverArtSpacing() {
    let { maxWidth, args: { covers }} = this;
    let naturalWidth = (this.coverArtSize(covers.length) + this.coverArtLeft(covers.length, 1.0)); // approx
    let spacingRatio = maxWidth / naturalWidth;

    return Math.min(1, spacingRatio);
  }

  @action coverArtSize(index) {
    return this.size * (0.8**index);
  }

  @action coverArtSizePx(index) {
    return `${this.coverArtSize(index)}px`;
  }

  @action coverArtLeft(index, spacing) {
    return this.size * 0.8 * index * (0.85**index) * spacing;
  }

  @action coverArtLeftPx(index, spacing) {
    return `${this.coverArtLeft(index, spacing)}px`;
  }

}
