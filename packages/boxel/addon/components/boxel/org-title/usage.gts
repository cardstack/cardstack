import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgTitle from './index';
import { LinkTo } from '@ember/routing';
import cssVar from '@cardstack/boxel/helpers/css-var';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, hash } from '@ember/helper';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class OrgTitleUsage extends Component {
  @tracked title = 'CRD Records';
  @tracked subtitle = 'Since 1919';
  @tracked iconURL = CRDLogo;

  cssClassName = 'boxel-org-title';
  @cssVariable declare boxelOrgTitleColor: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleTitleFont: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleSubtitleFont: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleLetterSpacing: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleLogoSize: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleLogoPosition: CSSVariableInfo;
  @cssVariable declare boxelOrgTitleTextTransform: CSSVariableInfo;

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
            boxel-org-title-color=this.boxelOrgTitleColor.value
            boxel-org-title-title-font=this.boxelOrgTitleTitleFont.value
            boxel-org-title-subtitle-font=this.boxelOrgTitleSubtitleFont.value
            boxel-org-title-letter-spacing=this.boxelOrgTitleLetterSpacing.value
            boxel-org-title-logo-size=this.boxelOrgTitleLogoSize.value
            boxel-org-title-logo-position=this.boxelOrgTitleLogoPosition.value
            boxel-org-title-text-transform=this.boxelOrgTitleTextTransform.value
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
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-org-title-color"
          @type="color"
          @description="color CSS style"
          @defaultValue={{this.boxelOrgTitleColor.defaults}}
          @value={{this.boxelOrgTitleColor.value}}
          @onInput={{this.boxelOrgTitleColor.update}}
        />
        <Css.Basic
          @name="boxel-org-title-title-font"
          @type="font"
          @description="font override for title"
          @defaultValue={{this.boxelOrgTitleTitleFont.defaults}}
          @value={{this.boxelOrgTitleTitleFont.value}}
          @onInput={{this.boxelOrgTitleTitleFont.update}}
        />
        <Css.Basic
          @name="boxel-org-title-subtitle-font"
          @type="font"
          @description="font override for title"
          @defaultValue={{this.boxelOrgTitleSubtitleFont.defaults}}
          @value={{this.boxelOrgTitleSubtitleFont.value}}
          @onInput={{this.boxelOrgTitleSubtitleFont.update}}
        />
        <Css.Basic
          @name="boxel-org-letter-spacing"
          @type="dimension"
          @description="letter-spacing override for title"
          @defaultValue={{this.boxelOrgTitleLetterSpacing.defaults}}
          @value={{this.boxelOrgTitleLetterSpacing.value}}
          @onInput={{this.boxelOrgTitleLetterSpacing.update}}
        />
        <Css.Basic
          @name="boxel-org-title-logo-size"
          @type="bg-size"
          @description="background-size CSS style for the icon"
          @defaultValue={{this.boxelOrgTitleLogoSize.defaults}}
          @value={{this.boxelOrgTitleLogoSize.value}}
          @onInput={{this.boxelOrgTitleLogoSize.update}}
        />
        <Css.Basic
          @name="boxel-org-title-logo-position"
          @type="position"
          @description="background-position CSS style for the icon"
          @defaultValue={{this.boxelOrgTitleLogoPosition.defaults}}
          @value={{this.boxelOrgTitleLogoPosition.value}}
          @onInput={{this.boxelOrgTitleLogoPosition.update}}
        />
        <Css.Basic
          @name="boxel-org-text-transform"
          @type="text-transform"
          @description="text-transform override for title"
          @defaultValue={{this.boxelOrgTitleTextTransform.defaults}}
          @value={{this.boxelOrgTitleTextTransform.value}}
          @onInput={{this.boxelOrgTitleTextTransform.update}}
        />
      </:cssVars>
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
            boxel-org-title-color=this.boxelOrgTitleColor.value
            boxel-org-title-title-font=this.boxelOrgTitleTitleFont.value
            boxel-org-title-letter-spacing=this.boxelOrgTitleLetterSpacing.value
            boxel-org-title-logo-size=this.boxelOrgTitleLogoSize.value
            boxel-org-title-logo-position=this.boxelOrgTitleLogoPosition.value
            boxel-org-title-text-transform=this.boxelOrgTitleTextTransform.value
          }}
        />
      </div>
      </:example>
    </FreestyleUsage>
  </template>
}
