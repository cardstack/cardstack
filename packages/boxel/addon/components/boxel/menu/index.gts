import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Link } from 'ember-link';
import { type MenuItem } from '@cardstack/boxel/helpers/menu-item';
import { type MenuDivider } from '@cardstack/boxel/helpers/menu-divider';
import { type EmptyObject } from '@ember/component/helper';
import eq from 'ember-truth-helpers/helpers/eq';
import cn from '@cardstack/boxel/helpers/cn';
import compact from 'ember-composable-helpers/helpers/compact';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { fn } from '@ember/helper';

import '@cardstack/boxel/styles/global.css';
import './index.css';

// This little component helps to make glint understand when we have a MenuItem and when we have a MenuDivider
class MenuItemRenderer extends Component<{
  Args: { menuItem: MenuItem|MenuDivider };
  Blocks: {
    divider: []
    item: [MenuItem],
  }
}> {
  get asMenuItem(): MenuItem {
    return this.args.menuItem as MenuItem;
  }
  <template>
    {{#if (eq @menuItem.type "divider")}}
      {{yield to="divider"}}
    {{else}}
      {{yield this.asMenuItem to="item"}}
    {{/if}}
  </template>
}

interface Signature {
  Element: HTMLUListElement;
  Args: {
    class?: string;
    closeMenu?: () => void;
    items: Array<MenuItem|MenuDivider>;
    itemClass?: string;
  };
  Blocks: EmptyObject;
}

export default class Menu extends Component<Signature> {
  invokeMenuItemAction(actionOrLink: () => never, e: Event): void;
  invokeMenuItemAction(actionOrLink: Link, e: Event): void;
  @action invokeMenuItemAction(actionOrLink: unknown, e: Event): void {
    e.preventDefault();
    let { closeMenu } = this.args;
    closeMenu && closeMenu();
    if (actionOrLink instanceof Link && actionOrLink.transitionTo) {
      actionOrLink.transitionTo();
    } else {
      (actionOrLink as () => never)();
    }
  }

  <template>
    {{! template-lint-disable no-invalid-role }}
    <ul role="menu" class={{cn "boxel-menu" @class}} ...attributes>
      {{#if @items}}
        {{#each (compact @items) as |menuItem|}}
          <MenuItemRenderer @menuItem={{menuItem}}>
            <:divider>
              <hr class="boxel-menu__separator" data-test-boxel-menu-separator />
            </:divider>
            <:item as |menuItem|>
              <li
                role="none"
                class={{cn
                  "boxel-menu__item"
                  @itemClass
                  boxel-menu__item--dangerous=menuItem.dangerous
                  boxel-menu__item--has-icon=menuItem.icon
                  boxel-menu__item--selected=menuItem.selected
                  boxel-menu__item--disabled=menuItem.disabled
                }}
                data-test-boxel-menu-item
              >
                {{!-- template-lint-disable require-context-role --}}
                <a
                  role="menuitem"
                  href="#"
                  data-test-boxel-menu-item-text={{menuItem.text}}
                  tabindex={{menuItem.tabindex}}
                  {{on "click" (fn this.invokeMenuItemAction menuItem.action)}}
                >
                  {{#if menuItem.icon}}
                    {{svgJar
                      menuItem.icon
                      width="18"
                      height="18"
                      data-test-boxel-menu-item-icon=true
                    }}
                  {{/if}}
                  {{menuItem.text}}
                </a>
              </li>
            </:item>
          </MenuItemRenderer>
        {{/each}}
      {{/if}}
    </ul>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Menu': typeof Menu;
  }
}
