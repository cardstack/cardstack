import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgHeader from './index';
import { LinkTo } from '@ember/routing';
import cssVar from '@cardstack/boxel/helpers/css-var';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, hash } from '@ember/helper';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class OrgHeaderUsage extends Component {
  @tracked title = 'CRD Records';
  @tracked subtitle = 'Since 1919';
  @tracked iconURL = CRDLogo;
  @tracked backgroundColor = 'var(--boxel-blue)';
  @tracked color = 'var(--boxel-light)';
  @tracked logoSize = 'auto 2rem';
  @tracked logoPosition = 'center';
  @tracked padding = 'var(--boxel-sp-lg)';

  <template>
    <FreestyleUsage @name="Boxel:OrgHeader">
      <:description>
        Usually shown at the top of a dashboard. See also
          <LinkTo @query={{hash f=null s="Components" ss="<Boxel::OrgTitle>"}} class="doc-link">
            Boxel::OrgTitle
          </LinkTo>
        which allows you to use just the title + an optional icon.
      </:description>
      <:example>
        <BoxelOrgHeader
          @title={{this.title}}
          @subtitle={{this.subtitle}}
          @iconURL={{this.iconURL}}
          style={{cssVar
            boxel-org-header-background-color=this.backgroundColor
            boxel-org-header-color=this.color
            boxel-org-header-logo-size=this.logoSize
            boxel-org-header-logo-position=this.logoPosition
            boxel-org-header-padding=this.padding
          }}
        >
          More Stuff Here
        </BoxelOrgHeader>
      </:example>
      <:api as |Args|>
      <Args.String
          @name="title"
          @value={{this.title}}
          @required={{true}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="subtitle"
          @value={{this.subtitle}}
          @onInput={{fn (mut this.subtitle)}}
        />
        <Args.String
          @name="iconURL"
          @value={{this.iconURL}}
          @onInput={{fn (mut this.iconURL)}}
        />
        <Args.String
          @name="--boxel-org-header-background-color"
          @description="background-color CSS style"
          @defaultValue="inherit"
          @value={{this.backgroundColor}}
          @onInput={{fn (mut this.backgroundColor)}}
        />
        <Args.String
          @name="--boxel-org-header-color"
          @description="color CSS style"
          @defaultValue="inherit"
          @value={{this.color}}
          @onInput={{fn (mut this.color)}}
        />
        <Args.String
          @name="--boxel-org-header-logo-size"
          @description="background-size CSS style for the icon"
          @defaultValue="auto 2rem"
          @value={{this.logoSize}}
          @onInput={{fn (mut this.logoSize)}}
        />
        <Args.String
          @name="--boxel-org-header-logo-position"
          @description="background-position CSS style for the icon"
          @defaultValue="center"
          @value={{this.logoPosition}}
          @onInput={{fn (mut this.logoPosition)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-org-header-padding"
          @description="padding CSS style for the icon"
          @defaultValue={{unbound this.padding}}
          @value={{this.padding}}
          @onInput={{fn (mut this.padding)}}
        />
        <Args.Yield
          @description="Other header content"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
