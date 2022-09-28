import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import AMPLogo from '@cardstack/boxel/usage-support/images/orgs/amp-logo.png';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgSwitcherButton from './index';
import DemoStage from 'dummy/components/doc/demo-stage';
import { fn } from '@ember/helper';

export default class OrgSwitcherButtonUsage extends Component {
  @tracked isSelected = false;
  org = {
    id: 'foo',
    iconURL: AMPLogo,
    title: 'Foo',
  };
  <template>
    <FreestyleUsage @name="OrgSwitcher::Button">
      <:description>
        This component is used by the OrgSwitcher component and is not intended for standalone use.
      </:description>
      <:example>
        <DemoStage @width="80px" @paddingX="0px" @bg="boxel-purple-800">
          <BoxelOrgSwitcherButton
            @org={{this.org}}
            @isSelected={{this.isSelected}}
            aria-label="Foo organization page"
          />
        </DemoStage>
      </:example>

      <:api as |Args|>
        <Args.Object
          @name="org"
          @value={{this.org}}
          @description="The organization model."
        />
        <Args.Bool
          @name="isSelected"
          @value={{this.isSelected}}
          @description="when true, renders in selected state"
          @defaultValue={{false}}
          @onInput={{fn (mut this.isSelected)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
