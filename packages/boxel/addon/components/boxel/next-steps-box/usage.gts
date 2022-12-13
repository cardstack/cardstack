import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelNextStepsBox from './index';
import BoxelButton from '../button';
import { tracked } from '@glimmer/tracking';
import { array, fn } from '@ember/helper';

export default class BoxelNextStepsBoxComponent extends Component {
  @tracked title = 'Available Actions';

  <template>
    <FreestyleUsage @name="NextStepsBox">
      <:example>
        <BoxelNextStepsBox @title={{this.title}}>
          <:default>
              {{#each
                (array
                  "Transfer Prepaid Card"
                  "Create new Prepaid Card"
                  "Split Prepaid Card"
                  "Use as template for new Prepaid Card"
                )
              as |item|}}
                <BoxelButton @kind="primary">
                  {{item}}
                </BoxelButton>
              {{/each}}
          </:default>
          <:footer>
            <BoxelButton @kind="secondary-dark">
              Return to dashboard
            </BoxelButton>
          </:footer>
        </BoxelNextStepsBox>
      </:example>

      <:api as |Args|>
        <Args.String
          @name="title"
          @value={{this.title}}
          @defaultValue="Suggested Next Steps"
          @onInput={{fn (mut this.title)}}
        />
        <Args.Yield
          @name="default"
          @description="Yields the body of this box. Its contents are arranged in a cluster/flex wrapped layout "
        />
        <Args.Yield
          @name="footer"
          @description="Yields footer block"
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="Another example">
      <:example>
        <BoxelNextStepsBox @title="Workflow Canceled">
          <BoxelButton @kind="primary">
            Start Again
          </BoxelButton>
        </BoxelNextStepsBox>
      </:example>
    </FreestyleUsage>
  </template>
}
