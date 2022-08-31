import Component from '@glimmer/component';
import { EmptyObject } from '@ember/component/helper';
import LeftEdgeNavSelectableButton from '../../left-edge-nav/selectable-button';
import { concat } from '@ember/helper';
import or from 'ember-truth-helpers/helpers/or';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from '@cardstack/boxel/helpers/css-url';
import cssVar from '@cardstack/boxel/helpers/css-var';
import truncate from '@cardstack/boxel/helpers/truncate';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    isSelected: boolean;
    org: any;
  };
  Blocks: EmptyObject
}

export default class BoxelOrgSwitcherButton extends Component<Signature> {
  <template>
    <LeftEdgeNavSelectableButton
      @isSelected={{@isSelected}}
      style={{cssVar boxel-org-switcher-button-background-color=(or @org.brandColor "var(--boxel-dark)")}}
      ...attributes
    >
      <div
        class={{cn "boxel-org-switcher-button__logo" (concat "boxel-org-switcher-button__logo--" @org.id)}}
        style={{cssUrl "background-image" @org.iconURL}}
      >
        {{#unless @org.iconURL}}
          {{truncate @org.title 1 false}}
        {{/unless}}
      </div>
    </LeftEdgeNavSelectableButton>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::OrgSwitcher::Button': typeof BoxelOrgSwitcherButton;
  }
}
