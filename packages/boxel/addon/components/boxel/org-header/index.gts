import Component from '@glimmer/component';
import BoxelOrgTitle from '../org-title';
import cssVar from '@cardstack/boxel/helpers/css-var';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    iconURL?: string;
    title: string;
    subtitle?: string;
  };
  Blocks: {
    default: [];
  }
}

export default class BoxelOrgHeader extends Component<Signature> {
  <template>
    <header class="boxel-org-header" ...attributes>
      <BoxelOrgTitle
        @iconURL={{@iconURL}}
        @title={{@title}}
        @subtitle={{@subtitle}}
        style={{cssVar
          boxel-org-title-text-color="var(--boxel-org-header-color)"
          boxel-org-title-logo-position="var(--boxel-org-header-logo-position)"
          boxel-org-title-logo-size="var(--boxel-org-header-logo-size)"
        }}
      />

      {{yield}}
    </header>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::OrgHeader': typeof BoxelOrgHeader;
  }
}
