import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelProgressSteps from './index';

import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';
import add from 'ember-math-helpers/helpers/add';
import cn from '@cardstack/boxel/helpers/cn';
import { fn } from '@ember/helper';
import './usage.css';

const SAMPLE_PROGRESS_STEPS = [
  {
    title: 'Place order',
    statusOnCompletion: 'Order placed',
  },
  {
    title: 'Reserve products',
    statusOnCompletion: 'Products reserved',
  },
  {
    title: 'Submit payment',
    statusOnCompletion: 'Payment submitted',
  },
  {
    title: 'Track delivery',
    statusOnCompletion: 'Delivery tracked',
  },
];

export default class ProgressStepsUsageComponent extends Component {
  @tracked progressSteps = A(SAMPLE_PROGRESS_STEPS);
  @tracked completedCount = 1;
  @action onClickStep(stepIndex: number): void {
    window.alert(`Step ${stepIndex} clicked`);
  }

  <template>
    <FreestyleUsage
      @name="ProgressSteps"
      @description="The current step will appear in bold, while the completed steps get a checkmark."
    >
      <:example>
        <BoxelProgressSteps
          @progressSteps={{this.progressSteps}}
          @completedCount={{this.completedCount}}
        />
      </:example>
      <:api as |Args|>
        <Args.Array
          @name="progressSteps"
          @type="Object"
          @items={{this.progressSteps}}
          @description="Each object should have a 'title' property with title of the progress step."
          @onChange={{fn (mut this.progressSteps)}}
        />
        <Args.Number
          @name="completedCount"
          @value={{this.completedCount}}
          @defaultValue={{0}}
          @min={{0}}
          @description="(integer) — Number of progress steps completed."
          @onInput={{fn (mut this.completedCount)}}
        />
        <Args.Action
          @name="onClickStep"
          @required={{false}}
          @description="Action to trigger when a step is clicked, the step index is passed"
        />
        <Args.Yield
          @description="Render custom progress steps.Yields an object with keys { title, data, index, completed, current }."
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="ProgressSteps with block">
      <:description>Block is yielded to once per step and is rendered in place of the step name</:description>
      <:example>
        <BoxelProgressSteps
          @progressSteps={{this.progressSteps}}
          @completedCount={{this.completedCount}}
          as |progressStep|
        >
        <div class={{cn
          "progress-steps-usage-item"
          progress-steps-usage-item--current=progressStep.current
          progress-steps-usage-item--completed=progressStep.completed
          }}
        >
          <span class="progress-steps-usage-item__title">{{if progressStep.completed progressStep.data.statusOnCompletion progressStep.title}}</span>
          {{#if progressStep.completed}}
            <span class="progress-steps-usage-item__number">Progress step number {{add progressStep.index 1}} done. <a href="https://www.youtube.com/watch?v=UWLIgjB9gGw">Celebrate!</a></span>
          {{/if}}
        </div>
        </BoxelProgressSteps>
      </:example>
    </FreestyleUsage>

    <FreestyleUsage class="remove-in-percy" @name="ProgressSteps with onClickStep">
      <:description>Anchor element is used, preventDefault is called for you, action called with step index</:description>
      <:example>
        <BoxelProgressSteps
          @progressSteps={{this.progressSteps}}
          @completedCount={{this.completedCount}}
          @onClickStep={{this.onClickStep}}
        />
      </:example>
    </FreestyleUsage>    
  </template>
}
