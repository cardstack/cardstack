import Component from '@glimmer/component';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { SelectableToken } from '../selectable-token';
import { isPresent } from '@ember/utils';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    item: SelectableToken;
  };
}

export default class SelectableTokenAmount extends Component<Signature> {
  get shouldUseSvgJar() {
    return isPresent(this.args.item.logoURI) && /^[a-zA-Z-_]+$/.test(this.args.item.logoURI!);
  }

  get shouldRenderImage() {
    return isPresent(this.args.item.logoURI) && !this.shouldUseSvgJar;
  }

  <template>
    <div ...attributes>
      {{#if this.shouldUseSvgJar}}
        {{svgJar
          @item.logoURI
          class="boxel-selectable-token-icon__icon"
          role="presentation"
        }}
      {{/if}}
      {{#if this.shouldRenderImage}}
        <img src={{@item.logoURI}}
          class="boxel-selectable-token-icon__icon"
          role="presentation"
        />
      {{/if}}
      {{@item.name}}
    </div>
  </template>
}
