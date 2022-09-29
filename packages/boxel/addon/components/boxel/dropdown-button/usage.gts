import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelDropdownButton from './index';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';
import menuItem from '@cardstack/boxel/helpers/menu-item'
import menuDivider from '@cardstack/boxel/helpers/menu-divider'

export default class DropdownButtonUsageComponent extends Component {
  @tracked button = 'gear';
  @tracked icon: string | undefined;
  @tracked size = 30;
  @tracked iconSize = 16;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  <template>
    <FreestyleUsage @name="DropdownButton">
      <:example>
        <BoxelDropdownButton
          @button={{this.button}}
          @size={{this.size}}
          @iconSize={{this.iconSize}}
          as |ddb|
        >
          <ddb.Menu
            @items={{array
              (menuItem "Duplicate" (fn this.log "Duplicate menu item clicked"))
              (menuItem "Share" (fn this.log "Share menu item clicked"))
              (menuDivider)
              (menuItem
                "Remove" (fn this.log "Remove menu item clicked") dangerous=true
              )
            }}
          />
        </BoxelDropdownButton>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="button"
          @description="the name to use as the aria-label and added on the trigger element as a css class. If @icon is not specified, this value is also used to specify an svg to use."
          @value={{this.button}}
          @required={{true}}
          @onInput={{fn (mut this.button)}}
        />
        <Args.String
          @name="icon"
          @description="the name of the svg to show"
          @value={{this.icon}}
          @defaultValue="falls back to the value of @button"
          @onInput={{fn (mut this.icon)}}
        />
        <Args.Number
          @name="size"
          @description="the size of the button"
          @value={{this.size}}
          @defaultValue={{40}}
          @min={{20}}
          @max={{80}}
          @onInput={{fn (mut this.size)}}
        />
        <Args.Number
          @name="iconSize"
          @description="the size of the icon"
          @value={{this.iconSize}}
          @defaultValue={{16}}
          @min={{8}}
          @max={{36}}
          @onInput={{fn (mut this.iconSize)}}
        />
        <Args.Yield
          @description="The provided block is rendered when the button is triggered. Yields a 'Menu' component (instance of Boxel::Menu that is preconfigured with @closeMenu defined) and the 'dropdown' object documented in Boxel::Dropdown"
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
