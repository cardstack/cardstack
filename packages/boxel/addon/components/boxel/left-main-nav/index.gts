import Component from '@glimmer/component';
import { Link } from 'ember-link';
import { MenuItem } from '@cardstack/boxel/helpers/menu-item';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { Org } from '../org-switcher/org';
import OrgTitle from '../org-title';
import Searchbox from '../searchbox';
import { EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import optional from 'ember-composable-helpers/helpers/optional';
import or from 'ember-truth-helpers/helpers/or';
import { LinkTo } from '@ember/routing';
import { hash } from '@ember/helper';

interface Signature {
  Element: HTMLElement,
  Args: {
    org: Org,
    items: MenuItem[],
    onSearchInput?: (e: InputEvent) => void;
    onSearchChange?: (e: InputEvent) => void;
  },
  Blocks: EmptyObject
}

export default class BoxelLeftMainNav extends Component<Signature> {
  get linkItems() {
    return this.args.items.filter((item) => item.action instanceof Link);
  }

  <template>
    <section class="boxel-left-main-nav">
      <OrgTitle
        @title={{@org.title}}
        @iconURL={{@org.iconURL}}

      />
      <Searchbox
        @hideIcon={{true}}
        @placeholder="Search"
        @label="Search accounts and members"
        @value=""
        @onChange={{optional @onSearchChange}}
        @onInput={{optional @onSearchInput}}
        class="boxel-left-main-nav__searchbox"
      />

      {{#if this.linkItems}}
        <nav class="boxel-left-main-nav__nav" role="tablist">
          {{#each this.linkItems as |link|}}
              <LinkTo
                @route={{link.action.routeName}}
                @query={{or link.action.queryParams (hash)}}
                role="tab"
                data-text={{link.text}}
                class={{cn
                  "boxel-left-main-nav__link"
                  boxel-left-main-nav__link--is-active=link.action.isActive
                }}
              >
                {{link.text}}
              </LinkTo>
          {{/each}}
        </nav>
      {{/if}}
    </section>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::LeftMainNav': typeof BoxelLeftMainNav;
  }
}
