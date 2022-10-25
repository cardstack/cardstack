import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelIconButton from './index';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class IconButtonUsageComponent extends Component {
  @tracked icon = 'expand';
  @tracked variant?: string;
  @tracked width = '16px';
  @tracked height = '16px';

  cssClassName = "boxel-icon-button";
  @cssVariable declare boxelIconButtonWidth: CSSVariableInfo;
  @cssVariable declare boxelIconButtonHeight: CSSVariableInfo;

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
          style={{cssVar
            boxel-icon-button-width=this.boxelIconButtonWidth.value
            boxel-icon-button-height=this.boxelIconButtonHeight.value
          }}
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
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-icon-button-width"
          @type="dimension"
          @description="Used to size the boundaries of the button"
          @defaultValue={{this.boxelIconButtonWidth.defaults}}
          @value={{this.boxelIconButtonWidth.value}}
          @onInput={{this.boxelIconButtonWidth.update}}
        />
        <Css.Basic
          @name="boxel-icon-button-height"
          @type="dimension"
          @description="Used to size the boundaries of the button"
          @defaultValue={{this.boxelIconButtonHeight.defaults}}
          @value={{this.boxelIconButtonHeight.value}}
          @onInput={{this.boxelIconButtonHeight.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
