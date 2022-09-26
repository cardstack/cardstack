import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

interface Signature {
  Element: HTMLElement;
  Args: {
    width?: string;
    bg?: string;
    textAlign?: string;
    paddingX?: string;
    paddingY?: string;
  };
  Blocks: {
    default: [];
  }
}

export default class DemoStage extends Component<Signature> {
  get style() {
    let properties = { display: 'block' } as any;

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

  <template>
    <demo-stage style={{this.style}}>
      {{yield}}
    </demo-stage>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Doc::DemoStage': typeof DemoStage;
  }
}
