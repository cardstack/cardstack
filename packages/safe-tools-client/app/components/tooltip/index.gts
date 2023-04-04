import Component from '@glimmer/component';
import './index.css';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { taskFor } from 'ember-concurrency-ts';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import config from '@cardstack/safe-tools-client/config/environment';


interface Signature {
  Element: HTMLAnchorElement | HTMLButtonElement;
  Args: {
  },
  Blocks: {
    'trigger': [],
    'content': [],
  };
}

export default class Tooltip extends Component<Signature> {
  @tracked tooltipShown = false;

  @action showTooltip() {
    if (taskFor(this.hideTooltipTask).isRunning) {
      taskFor(this.hideTooltipTask).cancelAll();
    }

    this.tooltipShown = true;
  }

  @action async hideTooltip() {
    taskFor(this.hideTooltipTask).perform();
  }

  @task *hideTooltipTask(): TaskGenerator<void> {
    let maxMsToWaitForUserToMoveMouseFromTriggerToContent = config.environment === 'test' ? 5 : 150;
    // We wait for a little while to see if the user is moving the mouse from the tooltip trigger to the tooltip content
    // If yes, the tooltip content will trigger showTooltip so that it keeps on showing, and cancel this task
    // If not, the tooltip will be hidden after the max wait time is reached
    yield new Promise(r => setTimeout(r, maxMsToWaitForUserToMoveMouseFromTriggerToContent));
    this.tooltipShown = false;
  }

  <template>
    <div class="tooltip" data-test-tooltip {{on "mouseleave" this.hideTooltip}}>
      <div class="tooltip__trigger" data-test-tooltip-trigger {{on "mouseenter" this.showTooltip}}>
        {{yield to="trigger"}}
      </div>
      {{#if this.tooltipShown}}
        <div class="tooltip__content" data-test-tooltip-content {{on "mouseenter" this.showTooltip}}>
          {{yield to="content"}}
        </div>
      {{/if}}
    </div>
  </template>
}
