import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
export default class SortMenuComponent extends Component {
  get styleAttribute() {
    return htmlSafe(`max-height: ${this.maxHeight}`);
  }

  get maxHeight() {
    let maxHeightArg = this.args.maxHeight;
    if (maxHeightArg && maxHeightArg > 150) {
      return `${maxHeightArg - 40}px`;
    }
    return '40vh';
  }
}
