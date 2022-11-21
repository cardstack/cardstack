import Component from '@glimmer/component';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { SelectableToken } from '../../selectable-token';
import { isPresent } from '@ember/utils';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    item: SelectableToken;
  };
}

export default class SelectableTokenAmount extends Component<Signature> {
  get shouldUseSvgJar() {
    return /^[a-zA-Z-_]+$/.test(this.args.item.icon);
  }

  get shouldRenderImage() {
    return isPresent(this.args.item.icon) && !this.shouldUseSvgJar;
  }

  <template>
    <div ...attributes>
      {{#if this.shouldUseSvgJar}}
        {{svgJar
          @item.icon
          class="boxel-input-selectable-token-amount__icon"
          role="presentation"
        }}
      {{/if}}
      {{#if this.shouldRenderImage}}
        <img src={{@item.icon}}
          class="boxel-input-selectable-token-amount__icon"
          role="presentation"
        />
      {{/if}}
      {{@item.name}}
    </div>
  </template>
}
