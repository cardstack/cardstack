import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgTitle from './index';
import { LinkTo } from '@ember/routing';
import cssVar from '@cardstack/boxel/helpers/css-var';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, hash } from '@ember/helper';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class OrgTitleUsage extends Component {
  @tracked title = 'CRD Records';
  @tracked subtitle = 'Since 1919';
  @tracked iconURL = CRDLogo;
  @tracked color = '#ffffff';
  @tracked titleFont = '900 1.125rem/1.333 var(--boxel-font-family)';
  @tracked subtitleFont = '900 0.8125rem/1.333 var(--boxel-font-family)';
  @tracked letterSpacing = 'var(--boxel-lsp-xxl)';
  @tracked logoSize = 'auto 2rem';
  @tracked logoPosition = 'center';
  @tracked textTransform = 'uppercase';

  <template>
    <FreestyleUsage @name="Boxel:OrgTitle">
      <:description>
        Shows an organization's title +- logo/icon with some preset styling. See also
          <LinkTo @query={{hash f=null s="Components" ss="<Boxel::OrgHeader>"}} class="doc-link">
            Boxel::OrgHeader
          </LinkTo>
        which applies some built-in layout concerns.
      </:description>
      <:example>
      <div
        {{!-- template-lint-disable no-inline-styles --}}
        style="background-color: var(--boxel-blue)"
      >
        <BoxelOrgTitle
          @title={{this.title}}
          @subtitle={{this.subtitle}}
          @iconURL={{this.iconURL}}
          style={{cssVar
            boxel-org-title-color=this.color
            boxel-org-title-title-font=this.titleFont
            boxel-org-title-subtitle-font=this.subtitleFont
            boxel-org-title-letter-spacing=this.letterSpacing
            boxel-org-title-logo-size=this.logoSize
            boxel-org-title-logo-position=this.logoPosition
            boxel-org-title-text-transform=this.textTransform
          }}
        />
      </div>
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
          @name="--boxel-org-title-color"
          @description="color CSS style"
          @defaultValue="inherit"
          @value={{this.color}}
          @onInput={{fn (mut this.color)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-org-title-title-font"
          @description="font override for title"
          @defaultValue={{unbound this.titleFont}}
          @value={{this.titleFont}}
          @onInput={{fn (mut this.titleFont)}}
        />
        <Args.String
          @name="--boxel-org-title-subtitle-font"
          @description="font override for title"
          @defaultValue={{unbound this.subtitleFont}}
          @value={{this.subtitleFont}}
          @onInput={{fn (mut this.subtitleFont)}}
        />
        <Args.String
          @name="--boxel-org-letter-spacing"
          @description="letter-spacing override for title"
          @defaultValue={{unbound this.letterSpacing}}
          @value={{this.letterSpacing}}
          @onInput={{fn (mut this.letterSpacing)}}
        />
        <Args.String
          @name="--boxel-org-title-logo-size"
          @description="background-size CSS style for the icon"
          @defaultValue="auto 2rem"
          @value={{this.logoSize}}
          @onInput={{fn (mut this.logoSize)}}
        />
        <Args.String
          @name="--boxel-org-title-logo-position"
          @description="background-position CSS style for the icon"
          @defaultValue="center"
          @value={{this.logoPosition}}
          @onInput={{fn (mut this.logoPosition)}}
        />
        <Args.String
          @name="--boxel-org-text-transform"
          @description="text-transform override for title"
          @defaultValue={{unbound this.textTransform}}
          @value={{this.textTransform}}
          @onInput={{fn (mut this.textTransform)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="Boxel:OrgTitle with no subtitle">
      <:example>
      <div
        {{!-- template-lint-disable no-inline-styles --}}
        style="background-color: var(--boxel-purple)"
      >
        <BoxelOrgTitle
          @title={{this.title}}
          @iconURL={{this.iconURL}}
          style={{cssVar
            boxel-org-title-color=this.color
            boxel-org-title-title-font=this.titleFont
            boxel-org-title-letter-spacing=this.letterSpacing
            boxel-org-title-logo-size=this.logoSize
            boxel-org-title-logo-position=this.logoPosition
            boxel-org-title-text-transform=this.textTransform
          }}
        />
      </div>
      </:example>
    </FreestyleUsage>
  </template>
}
