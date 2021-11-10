import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface ProgressIconArgs {
  isCancelled: boolean;
  isComplete: boolean;
  size: number;
}

export default class ProgressIcon extends Component<ProgressIconArgs> {
  get elementStyle(): SafeString {
    let { size } = this.args;
    let styles = [`width: ${size}px`, `height: ${size}px`];
    if (this.args.isCancelled || this.args.isComplete) {
      styles.push(`background-size: ${size * 0.666}px ${size * 0.666}px`);
    }
    return htmlSafe(styles.join(';'));
  }
}
