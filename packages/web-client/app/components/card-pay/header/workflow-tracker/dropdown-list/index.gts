import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { EmptyObject } from '@ember/component/helper';
import TrackerItem from '../item';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import onClickOutside from '@cardstack/web-client/modifiers/on-click-outside';
import { on } from '@ember/modifier';
import cn from '@cardstack/boxel/helpers/cn';

interface Signature {
  Element: HTMLElement;
  Args: {
    close: () => void;
  };
  Blocks: EmptyObject;
}

export default class CardPayHeaderWorkflowTrackerDropdownList extends Component<Signature> {
  @service declare workflowPersistence: WorkflowPersistence;
  @tracked isScrolled = false;

  @action checkIfScrolled(e: Event) {
    this.isScrolled = (e.target as HTMLElement).scrollTop > 0;
  }

  @action clearCompletedWorkflows() {
    this.workflowPersistence.completedWorkflows.forEach((workflowAndId) => {
      this.workflowPersistence.clearWorkflowWithId(workflowAndId.id);
    });
  }

  <template>
    <aside tabindex="0" class='workflow-tracker' {{onClickOutside @close ignoreSelector="[data-workflow-tracker-toggle]"}} {{on "scroll" this.checkIfScrolled}}>
      <header class={{cn "workflow-tracker__heading" workflow-tracker__heading--scrolled=this.isScrolled}} aria-label="Active workflows">
        {{svgJar 'task-active' class='workflow-tracker__heading-icon'}}
        Active workflows
        <span
          class='workflow-tracker__count'
          data-test-active-workflow-count
        >
          {{this.workflowPersistence.activeWorkflows.length}}
        </span>
      </header>
      <ul id="workflow-tracker-active-list" class="workflow-tracker__list">
        {{#each this.workflowPersistence.activeWorkflows as |workflowMeta|}}
          <li data-test-active-workflow class="workflow-tracker__li">
            <TrackerItem
              @workflowMeta={{workflowMeta}}
              @closeList={{@close}}
              class="workflow-tracker__li-content"
            />
          </li>
        {{/each}}
      </ul>
      {{#if this.workflowPersistence.completedWorkflows}}
        <header class='workflow-tracker__heading' aria-label="Completed workflows">
          {{svgJar 'task-completed' class='workflow-tracker__heading-icon'}}
          Completed workflows
          <span
            class='workflow-tracker__count'
            data-test-completed-workflow-count
          >
            {{this.workflowPersistence.completedWorkflows.length}}
          </span>
        </header>
        <ul id="workflow-tracker-completed-list" class="workflow-tracker__list">
          {{#each this.workflowPersistence.completedWorkflows as |workflowMeta|}}
            <li data-test-completed-workflow class="workflow-tracker__li">
              <TrackerItem
                @workflowMeta={{workflowMeta}}
                @closeList={{@close}}
                class="workflow-tracker__li-content"
              />
            </li>
          {{/each}}
        </ul>
        <footer class="workflow-tracker__footer">
          <BoxelButton
            class="workflow-tracker__footer-cta"
            @kind='secondary-dark'
            {{on 'click' this.clearCompletedWorkflows}}
            data-test-workflow-tracker-clear-completed
          >
            Clear Completed
          </BoxelButton>
        </footer>
      {{/if}}
    </aside>

  </template>
}
