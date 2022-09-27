import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelDateDivider from './index';
import { fn } from '@ember/helper';

export default class extends Component {
  @tracked date = '2020-01-07T15:00';
  <template>
    <FreestyleUsage @name="DateDivider">
      <:example>
        <BoxelDateDivider @date={{this.date}} />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="date"
          @required={{false}}
          @defaultValue="now"
          @description="Date to show"
          @value={{this.date}}
          @onInput={{fn (mut this.date)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage class="remove-in-percy" @slug="DateDivider-default" @description="With default value">
      <:example>
        <BoxelDateDivider />
      </:example>
    </FreestyleUsage>
  </template>
}
