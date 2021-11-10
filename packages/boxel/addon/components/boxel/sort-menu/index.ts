import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import { SafeString } from '@ember/template/-private/handlebars';
import '@cardstack/boxel/styles/global.css';
import './index.css';

const MINIMUM_USEFUL_MAX_HEIGHT_PX = 150;
const VERTICAL_BUFFER_BELOW_MENU_PX = 40;
const FALLBACK_MAX_HEIGHT = '40vh';

interface SortMenuComponentArgs {
  maxHeight: number | undefined;
}

export default class SortMenuComponent extends Component<SortMenuComponentArgs> {
  get styleAttribute(): SafeString {
    return htmlSafe(`max-height: ${this.maxHeight}`);
  }

  get maxHeight(): string {
    let maxHeightArg = this.args.maxHeight;
    if (maxHeightArg && maxHeightArg > MINIMUM_USEFUL_MAX_HEIGHT_PX) {
      return `${maxHeightArg - VERTICAL_BUFFER_BELOW_MENU_PX}px`;
    }
    return FALLBACK_MAX_HEIGHT;
  }
}
