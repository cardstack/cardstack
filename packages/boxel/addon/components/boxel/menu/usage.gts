import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelMenu from './index';
import menuItem from '@cardstack/boxel/helpers/menu-item'
import menuDivider from '@cardstack/boxel/helpers/menu-divider'
import { fn, array } from '@ember/helper';

import { action } from '@ember/object';

export default class MenuUsage extends Component {
  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }
  @action closeMenu(): void {
    // eslint-disable-next-line no-console
    console.log('closeMenu called');
  }

  <template>
    <FreestyleUsage @name="Menu">
      <:example>
        <BoxelMenu
          @closeMenu={{this.closeMenu}}
          @items={{array
            (menuItem "Duplicate" (fn this.log "Duplicate menu item clicked"))
            (menuItem "Share" (fn this.log "Share menu item clicked"))
            (menuDivider)
            (menuItem "Remove" (fn this.log "Remove menu item clicked") dangerous=true)
          }}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="items"
          @description="An array of MenuItems, created using the 'menu-item' helper. The menu-item helper accepts the menu item text as its first argument, and an action or link (as created using ember-link) as the second argument."
        />
        <Args.Action
          @name="closeMenu"
          @description="Invoke this action to close the menu (e.g. when it is displayed as part of a dropdown"
        />
        <Args.String
          @name="itemClass"
          @description="CSS class to be added to the menu item."
        />
      </:api>
    </FreestyleUsage>
  </template>
}
