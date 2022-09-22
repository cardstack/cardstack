import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelLeftEdgeNavSelectableButton from './index';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import { concat, fn } from '@ember/helper';
import { htmlSafe } from '@ember/template';
import DemoStage from 'dummy/components/doc/demo-stage';

import BunnyLogo from '@cardstack/boxel/usage-support/images/orgs/bunny-logo.svg';

export default class extends Component {
  orgLogo = BunnyLogo;
  @tracked isSelected = false;

  <template>
    <FreestyleUsage
      @name="LeftEdgeNav::SelectableButton"
    >
      <:example>
        <DemoStage @width="80px" @paddingX="0px" @textAlign="center" @bg="boxel-purple-800">
          <BoxelLeftEdgeNavSelectableButton
            aria-label="Bunny Records org page"
            @isSelected={{this.isSelected}}
          >
            <div
              style={{htmlSafe (concat (cssUrl "background-image" this.orgLogo) ";background-size:contain;background-repeat:no-repeat;height:2.5rem;width:100%;")}}
            />
          </BoxelLeftEdgeNavSelectableButton>
        </DemoStage>
      </:example>
      <:api as |Args|>
        <Args.Bool
          @name="isSelected"
          @value={{this.isSelected}}
          @description="when true, renders in selected state"
          @defaultValue={{false}}
          @onInput={{fn (mut this.isSelected)}}
        />
        <Args.Yield @optional={{true}} @description="The content of the button." />
      </:api>
    </FreestyleUsage>
  </template>
}
