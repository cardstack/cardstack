import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelProgressCircle from './index';
import { fn } from '@ember/helper';

export default class ProgressCircle extends Component {
  percentComplete = 40;
  size = 120;

  <template>
    <FreestyleUsage @name="ProgressCircle">
      <:example>
        <BoxelProgressCircle
          @size={{this.size}}
          @percentComplete={{this.percentComplete}}
        />
      </:example>

      <:api as |Args|>
        <Args.Number
          @name="size"
          @required={{true}}
          @min={{40}}
          @max={{200}}
          @description="the size of the circle, in px"
          @value={{this.size}}
          @onInput={{fn (mut this.size)}}
        />
        <Args.Number
          @name="percentComplete"
          @defaultValue={{0}}
          @min={{0}}
          @max={{100}}
          @description="completeness from 0 to 100"
          @value={{this.percentComplete}}
          @onInput={{fn (mut this.percentComplete)}}
        />
      </:api>
    </FreestyleUsage>

  </template>
}
