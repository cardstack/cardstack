import Component from '@glimmer/component';
import './style.css';
import { reads } from 'macro-decorators';

const FONT_SIZE_RATIO = 25 / 120;

export default class extends Component {
  @reads('args.size', 120) size;

  get fontSize() {
    return this.size * FONT_SIZE_RATIO;
  }
  get innerCircleSize() {
    return this.size - this.fontSize;
  }
  get humanPercentComplete() {
    if (this.args.percentComplete) {
      return Math.round(this.args.percentComplete);
    }
    return 0;
  }
}
