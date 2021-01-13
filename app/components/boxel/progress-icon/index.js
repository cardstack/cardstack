import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

export default class extends Component {
  get elementStyle() {
    let { size } = this.args;
    let styles = [
      `width: ${size}px`,
      `height: ${size}px`
    ]
    if (this.args.isCancelled || this.args.isComplete) {
      styles.push(
        `background-size: ${size * 0.666}px ${size * 0.666}px`
      );
    }
    return htmlSafe(styles.join(';'));
  }
}
