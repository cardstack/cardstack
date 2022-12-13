import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelDropTarget from './index';
import { fn, array } from '@ember/helper';

export default class DropUsage extends Component {
  @tracked state = 'rest';
  
  <template>
    <FreestyleUsage @name="DropTarget" @description="Presentational drop target. Requires assembly for drop logic">
      <:example>
        <BoxelDropTarget
          @state={{this.state}}
        />
      </:example>

      <:api as |Args|>
        <Args.String
          @name="state"
          @options={{array "rest" "dragover"}}
          @default="rest"
          @value={{this.state}}
          @onInput={{fn (mut this.state)}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
