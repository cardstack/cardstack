import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelMilestoneBanner from './index';
import { fn } from '@ember/helper';

export default class MilestoneBannerUsage extends Component {
  @tracked title = 'Layout customized';
  @tracked status = 'Milestone reached';
  
  <template>
    <FreestyleUsage @name="MilestoneBanner">
      <:example>
        <BoxelMilestoneBanner @title={{this.title}} @status={{this.status}} />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="title"
          @value={{this.title}}
          @description="The milestone title"
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="status"
          @value={{this.status}}
          @description="The milestone status"
          @onInput={{fn (mut this.status)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
