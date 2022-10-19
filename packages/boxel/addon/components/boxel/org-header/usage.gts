import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgHeader from './index';
import { LinkTo } from '@ember/routing';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, hash } from '@ember/helper';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class OrgHeaderUsage extends Component {
  @tracked title = 'CRD Records';
  @tracked subtitle = 'Since 1919';
  @tracked iconURL = CRDLogo;
  
  cssClassName = 'boxel-org-header';
  @cssVariable declare boxelOrgHeaderBackgroundColor: CSSVariableInfo;
  @cssVariable declare boxelOrgHeaderColor: CSSVariableInfo;
  @cssVariable declare boxelOrgHeaderLogoSize: CSSVariableInfo;
  @cssVariable declare boxelOrgHeaderLogoPosition: CSSVariableInfo;
  @cssVariable declare boxelOrgHeaderPadding: CSSVariableInfo;

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
            boxel-org-header-background-color=this.boxelOrgHeaderBackgroundColor.value
            boxel-org-header-color=this.boxelOrgHeaderColor.value
            boxel-org-header-logo-size=this.boxelOrgHeaderLogoSize.value
            boxel-org-header-logo-position=this.boxelOrgHeaderLogoPosition.value
            boxel-org-header-padding=this.boxelOrgHeaderPadding.value
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
        <Args.Yield
          @description="Other header content"
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-org-header-background-color"
          @type="color"
          @description="background-color CSS style"
          @defaultValue={{this.boxelOrgHeaderBackgroundColor.defaults}}
          @value={{this.boxelOrgHeaderBackgroundColor.value}}
          @onInput={{this.boxelOrgHeaderBackgroundColor.update}}
        />
        <Css.Basic
          @name="boxel-org-header-color"
          @type="color"
          @description="color CSS style"
          @defaultValue={{this.boxelOrgHeaderColor.defaults}}
          @value={{this.boxelOrgHeaderColor.value}}
          @onInput={{this.boxelOrgHeaderColor.update}}
        />
        <Css.Basic
          @name="boxel-org-header-logo-size"
          @type="bg-size"
          @description="background-size CSS style for the icon"
          @defaultValue={{this.boxelOrgHeaderLogoSize.defaults}}
          @value={{this.boxelOrgHeaderLogoSize.value}}
          @onInput={{this.boxelOrgHeaderLogoSize.update}}
        />
        <Css.Basic
          @name="boxel-org-header-logo-position"
          @type="position"
          @description="background-position CSS style for the icon"
          @defaultValue={{this.boxelOrgHeaderLogoPosition.defaults}}
          @value={{this.boxelOrgHeaderLogoPosition.value}}
          @onInput={{this.boxelOrgHeaderLogoPosition.update}}
        />
        <Css.Basic
          @name="boxel-org-header-padding"
          @type="dimension"
          @description="padding CSS style for the icon"
          @defaultValue={{this.boxelOrgHeaderPadding.defaults}}
          @value={{this.boxelOrgHeaderPadding.value}}
          @onInput={{this.boxelOrgHeaderPadding.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
