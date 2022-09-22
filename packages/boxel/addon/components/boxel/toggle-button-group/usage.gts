import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import ToggleButtonGroup from './index';

export default class ToggleButtonGroupUsage extends Component {
  @tracked name = 'example-toggle-button-group-usage';
  @tracked groupDescription = 'Select one';
  @tracked disabled = false;

  @action logValue(value: string): void {
    console.log(value);
  }

  <template>
    <FreestyleUsage
      @name="ToggleButtonGroup"
      @description="A toggle button group"
    >
      <:example>
        <ToggleButtonGroup
          @groupDescription={{this.groupDescription}}
          @name={{this.name}}
          @disabled={{this.disabled}}
          @onChange={{this.logValue}} as |group|
        >
          <group.Button @value="19">
            <strong>
              Good
            </strong>
            <br />
            $19
          </group.Button>
          <group.Button @value="191">
            <strong>
              Better
            </strong>
            <br />
            $191
          </group.Button>
          <group.Button @value="1919">
            <strong>
              Best
            </strong>
            <br />
            $1919
          </group.Button>
        </ToggleButtonGroup>
      </:example>

      <:api as |Args|>
        <Args.String
          @name="name"
          @description="The name attribute for the generated inputs"
          @value={{this.name}}
          @onInput={{fn (mut this.name)}}
          @required={{true}}
        />
        <Args.String
          @name="groupDescription"
          @description="Accessible description for this group of radio buttons"
          @value={{this.groupDescription}}
          @onInput={{fn (mut this.groupDescription)}}
          @required={{true}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether selection is disabled"
          @defaultValue="false"
          @value={{this.disabled}}
          @onInput={{fn (mut this.disabled)}}
          @optional={{true}}
        />
        <Args.Action
          @name="onChange"
          @description="Callback that receives the chosen value"
          @required={{true}}
        />
        <Args.Yield
          @description="Yields { Button } which must be invoked with @value."
        />
      </:api>
    </FreestyleUsage>
  </template>
}
