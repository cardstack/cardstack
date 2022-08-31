import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { EmptyObject } from '@ember/component/helper';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { on } from '@ember/modifier';
import toggle from 'ember-composable-helpers/helpers/toggle';
import DropDownList from './dropdown-list';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import ToElsewhere from 'ember-elsewhere/components/to-elsewhere';

interface Signature {
  Element: HTMLButtonElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}

export default class CardPayHeaderWorkflowTracker extends Component<Signature> {
  @service declare workflowPersistence: WorkflowPersistence;
  @tracked showing = false;
  <template>
    <BoxelButton
      @kind='primary'
      {{on 'click' (toggle 'showing' this)}}
      data-test-workflow-tracker-toggle
      data-workflow-tracker-toggle
      class="workflow-tracker__toggle"
    >
      {{svgJar 'task-active' class='workflow-tracker__toggle-icon'}}
      <span data-test-workflow-tracker-count>{{this.workflowPersistence.activeWorkflows.length}}</span>
    </BoxelButton>

    {{#if this.showing}}
      <ToElsewhere
        @named="workflow-tracker-dropdown-target"
        @send={{component DropDownList close=(toggle 'showing' this)}}
      />
    {{/if}}
  </template>
}
