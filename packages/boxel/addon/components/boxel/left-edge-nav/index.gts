import Component from '@glimmer/component';
import { EmptyObject } from '@ember/component/helper';
import BasicButton from './basic-button';
import CardManagementButton from './card-management-button';
import OrgSwitcher from '../org-switcher';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import { concat } from '@ember/helper';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import truncate from 'ember-string-helpers/helpers/truncate';
import optional from 'ember-composable-helpers/helpers/optional';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    home?: any; // TODO: better types
    user?: any;
    orgs?: any;
    currentOrg?: any;
    ariaLabel?: string;
    onChooseOrg?: any;
    bottomActions?: any;
  };
  Blocks: EmptyObject
}

export default class BoxelLeftEdgeNav extends Component<Signature> {
  <template>
    <div class="boxel-left-edge-nav" data-test-left-edge-nav ...attributes>
      <ul class="boxel-left-edge-nav__top-btn-group">
        {{#if @home}}
          <li>
            <BasicButton aria-label="home" {{on "click" (optional @home.action)}}>
              {{svgJar @home.icon width=@home.width height=@home.height}}
            </BasicButton>
          </li>
        {{/if}}
        {{#if @user}}
          <li>
            <BasicButton aria-label={{concat @user.title " profile"}} {{on "click" @user.action}}>
              <div class="boxel-left-edge-nav__user-icon" style={{cssUrl "background-image" @user.imgURL}}>
                {{#unless @user.imgURL}}
                  {{truncate @user.title 1 false}}
                {{/unless}}
              </div>
            </BasicButton>
          </li>
        {{/if}}
      </ul>

      <OrgSwitcher
        class="boxel-left-edge-nav__middle-btn-group"
        @orgs={{@orgs}}
        @currentOrg={{@currentOrg}}
        @onChooseOrg={{@onChooseOrg}}
      />

      <ul class="boxel-left-edge-nav__bottom-btn-group">
        {{#if @bottomActions}}
          {{#each @bottomActions as |bottomAction|}}
            <li>
              <CardManagementButton aria-label={{bottomAction.icon}} {{on "click" bottomAction.action}}>
                {{svgJar bottomAction.icon width="20px" height="20px"}}
              </CardManagementButton>
            </li>
          {{/each}}
        {{/if}}
      </ul>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::LeftEdgeNav': typeof BoxelLeftEdgeNav;
  }
}
