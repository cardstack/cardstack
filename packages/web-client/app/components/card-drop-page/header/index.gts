import Component from '@glimmer/component';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import { type EmptyObject } from '@ember/component/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import BoxelOrgHeader from '@cardstack/boxel/components/boxel/org-header';

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}
export default class CardDropPageHeader extends Component<Signature> {
  <template>
    <div ...attributes>
      <BoxelOrgHeader
        class='card-drop-page-header'
        @iconURL={{CardPayLogo}}
        @title='Card Pay'
        style={{cssVar
          boxel-org-header-logo-size='var(--card-pay-logo-size)'
          boxel-org-header-logo-position='var(--card-pay-logo-position)'
          boxel-org-header-padding='0'
        }}
      />
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardDropPage::Header': typeof CardDropPageHeader;
  }
}
