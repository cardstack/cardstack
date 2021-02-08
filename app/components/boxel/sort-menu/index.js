import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

const MINIMUM_USEFUL_MAX_HEIGHT_PX = 150;
const VERTICAL_BUFFER_BELOW_MENU_PX = 40;
const FALLBACK_MAX_HEIGHT = '40vh';
export default class SortMenuComponent extends Component {
  get styleAttribute() {
    return htmlSafe(`max-height: ${this.maxHeight}`);
  }

  get maxHeight() {
    let maxHeightArg = this.args.maxHeight;
    if (maxHeightArg && maxHeightArg > MINIMUM_USEFUL_MAX_HEIGHT_PX) {
      return `${maxHeightArg - VERTICAL_BUFFER_BELOW_MENU_PX}px`;
    }
    return FALLBACK_MAX_HEIGHT;
  }
}
