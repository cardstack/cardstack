import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { hash } from '@ember/helper';
import { LinkTo } from '@ember/routing';
import { MenuItem } from '@cardstack/boxel/helpers/menu-item';
import cn from '@cardstack/boxel/helpers/cn';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { Link } from 'ember-link';
import or from 'ember-truth-helpers/helpers/or';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    class?: string;
    items: MenuItem[];
    spread?: boolean;
  };
  Blocks: EmptyObject
}

export default class BoxelTabBar extends Component<Signature> {
  get linkItems() {
    return this.args.items.filter((item) => item.action instanceof Link).map((item) => ({ link: item.action as Link, menuItem: item, text: item.text }));
  }

  <template>
    <div
      role="tablist"
      class={{cn "boxel-tab-bar" @class boxel-tab-bar--spread=@spread}}
      ...attributes
    >
      {{#if this.linkItems}}
        {{#each this.linkItems as |tab|}}
          {{! template-lint-disable require-context-role }}
          <LinkTo
            id={{or tab.menuItem.id tab.link.routeName}}
            @route={{tab.link.routeName}}
            @query={{or tab.link.queryParams (hash)}}
            @disabled={{tab.menuItem.inactive}}
            role="tab"
            class={{
              cn
              "boxel-tab-bar__item"
              boxel-tab-bar__item--is-active=tab.link.isActive
              boxel-tab-bar__item--is-inactive=tab.menuItem.inactive
            }}
          >
            {{#if tab.menuItem.icon}}
              {{svgJar
                tab.menuItem.icon
                width="18px"
                height="18px"
              }}
            {{/if}}
            <div class="boxel-tab-bar__item-text" data-text={{tab.text}}>
              {{tab.text}}
            </div>
          </LinkTo>
        {{/each}}
      {{/if}}
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::TabBar': typeof BoxelTabBar;
  }
}
