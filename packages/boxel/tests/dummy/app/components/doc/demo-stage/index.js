import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

export default class extends Component {
  get style() {
    let properties = { display: 'block' };

    if (this.args.width) {
      properties.width = this.args.width;
    }

    if (this.args.bg) {
      properties['background-color'] = `var(--${this.args.bg})`;
    }

    if (this.args.textAlign) {
      properties['text-align'] = this.args.textAlign;
    }

    properties['padding-left'] = this.args.paddingX || '10px;';
    properties['padding-right'] = this.args.paddingX || '10px;';
    properties['padding-top'] = this.args.paddingY || '10px;';
    properties['padding-bottom'] = this.args.paddingY || '10px;';

    return htmlSafe(
      Object.entries(properties)
        .map(([key, value]) => `${key}:${value}`)
        .join(';')
    );
  }
}
