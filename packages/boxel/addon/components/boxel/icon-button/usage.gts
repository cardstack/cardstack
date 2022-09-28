import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelIconButton from './index';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';

export default class IconButtonUsageComponent extends Component {
  @tracked icon = 'expand';
  @tracked variant?: string;
  @tracked width = '16px';
  @tracked height = '16px';
  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  <template>
    <FreestyleUsage
      @name="IconButton"
    >
      <:example>
        <BoxelIconButton
          @icon={{this.icon}}
          @variant={{this.variant}}
          @width={{this.width}}
          @height={{this.height}}
          aria-label="Special Button"
          {{on "click" (fn this.log "Button clicked")}}
        />
      </:example>

      <:api as |Args|>
        <Args.String @name="icon"
          @description="the name of the svg to show"
          @value={{this.icon}}
          @onInput={{fn (mut this.icon)}}
        />
        <Args.String @name="variant"
          @description="the variant to render as (applies CSS class) - 'null' or 'primary' or 'secondary'";
          @value={{this.variant}}
          @onInput={{fn (mut this.variant)}}
        />
        <Args.Number @name="width"
          @description="used to size the SVG rendering"
          @defaultValue={{"16px"}}
          @value={{this.width}}
          @onInput={{fn (mut this.width)}}
        />
        <Args.Number @name="height"
          @description="used to size the SVG rendering"
          @defaultValue={{"16px"}}
          @value={{this.height}}
          @onInput={{fn (mut this.height)}}
        />
        <tr><td colspan="4">
          To size the boundaries of the button, the <code>--icon-button-width</code> and <code>--icon-button-height</code> css variables
          may be used. The default is 40px.
        </td></tr>
      </:api>
    </FreestyleUsage>
  </template>
}
