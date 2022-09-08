import Component from '@glimmer/component';
import { EmptyObject } from '@ember/component/helper';
import OrgSwitcherButton from './button';
import { concat, fn } from '@ember/helper';
import { on } from '@ember/modifier';
import eq from 'ember-truth-helpers/helpers/eq';
import or from 'ember-truth-helpers/helpers/or';
import { Org } from './org';
import '@cardstack/boxel/styles/global.css';
import './index.css';


interface Signature {
  Element: HTMLUListElement;
  Args: {
    orgs: Org[];
    currentOrg?: Org;
    onChooseOrg: any;
  };
  Blocks: EmptyObject
}

export default class BoxelOrgSwitcher extends Component<Signature> {
  <template>
    <ul class="boxel-org-switcher" ...attributes>
      {{#each @orgs as |org|}}
        <li>
          <OrgSwitcherButton
            @org={{org}}
            @isSelected={{eq @currentOrg org}}
            {{on "click" (fn @onChooseOrg org.id)}}
            aria-label={{concat (or org.title org.id) " organization page"}}
          />
        </li>
      {{/each}}
    </ul>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::OrgSwitcher': typeof BoxelOrgSwitcher;
  }
}
