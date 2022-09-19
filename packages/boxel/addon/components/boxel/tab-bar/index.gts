import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { hash } from '@ember/helper';
import { LinkTo } from '@ember/routing';
import { MenuItem } from '@cardstack/boxel/helpers/menu-item';
import cn from '@cardstack/boxel/helpers/cn';
import cssVar from '@cardstack/boxel/helpers/css-var';
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
      style={{
        cssVar
        boxel-tab-bar-background-color="var(--boxel-tab-bar-background-color)"
        boxel-tab-bar-font="var(--boxel-tab-bar-font)"
      }}
      ...attributes
    >
      {{#if this.linkItems}}
        {{#each this.linkItems as |tab|}}
          {{#if tab.menuItem.inactive}}
            <div
              role="tab"
              data-text={{tab.text}}
              aria-disabled="true"
              class={{
                cn
                "boxel-tab-bar__item"
                "boxel-tab-bar__item--is-inactive"
                boxel-tab-bar__item--is-active=tab.link.isActive
              }}
            >
              {{#if tab.menuItem.icon}}
                {{svgJar
                  tab.menuItem.icon
                  width="18px"
                  height="18px"
                }}
              {{/if}}
              <div class="boxel-tab-bar__item-text">
                {{tab.text}}
              </div>
            </div>
          {{else}}
            {{! template-lint-disable require-context-role }}
            <LinkTo
              id={{or tab.menuItem.id tab.link.routeName}}
              @route={{tab.link.routeName}}
              @query={{or tab.link.queryParams (hash)}}
              role="tab"
              class={{
                cn
                "boxel-tab-bar__item"
                "boxel-tab-bar__item"
                boxel-tab-bar__item--is-active=tab.link.isActive
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
          {{/if}}
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
