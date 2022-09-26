import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import cn from '@cardstack/boxel/helpers/cn';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import tippy from '@cardstack/web-client/modifiers/tippy';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelProgressIcon from '@cardstack/boxel/components/boxel/progress-icon';

import WorkflowPersistence, {
  WorkflowPersistenceMeta,
} from '@cardstack/web-client/services/workflow-persistence';
import {
  CardPayWorkflowName,
  CARD_PAY_WORKFLOW_NAMES,
} from '@cardstack/web-client/models/workflow';

import { MILESTONE_TITLES as PROFILE_CREATION_MILESTONES } from '@cardstack/web-client/components/card-pay/create-profile-workflow';
import { MILESTONE_TITLES as PREPAID_CARD_ISSUANCE_MILESTONES } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import { MILESTONE_TITLES as RESERVE_POOL_DEPOSIT_MILESTONES } from '@cardstack/web-client/components/card-pay/deposit-workflow';
import { MILESTONE_TITLES as WITHDRAWAL_MILESTONES } from '@cardstack/web-client/components/card-pay/withdrawal-workflow';
import { tracked } from '@glimmer/tracking';
import { type EmptyObject } from '@ember/component/helper';

const WORKFLOW_TITLE_TO_MILESTONES: Record<CardPayWorkflowName, string[]> = {
  PREPAID_CARD_ISSUANCE: PREPAID_CARD_ISSUANCE_MILESTONES,
  PROFILE_CREATION: PROFILE_CREATION_MILESTONES,
  RESERVE_POOL_DEPOSIT: RESERVE_POOL_DEPOSIT_MILESTONES,
  WITHDRAWAL: WITHDRAWAL_MILESTONES,
};

debugger;

interface Signature {
  Element: HTMLDivElement;
  Args: {
    workflowMeta: WorkflowPersistenceMeta;
    closeList: () => void;
  };
  Blocks: EmptyObject;
}

export default class CardPayHeaderWorkflowTrackerItem extends Component<Signature> {
  @service declare workflowPersistence: WorkflowPersistence;
  @tracked deleteButtonShown: boolean = false;
  @tracked deleteConfirmDialogShown: boolean = false;

  progressIconSize = 25;

  get workflowId() {
    return this.args.workflowMeta.id;
  }

  get workflowName() {
    return this.args.workflowMeta.name;
  }

  get canDelete() {
    return !this.isComplete;
  }

  get workflowDisplayName() {
    return (
      CARD_PAY_WORKFLOW_NAMES[this.workflowName as CardPayWorkflowName] ||
      'Unknown workflow type'
    );
  }

  get currentMilestoneTitle() {
    let workflowMilestones =
      WORKFLOW_TITLE_TO_MILESTONES[this.workflowName as CardPayWorkflowName];

    if (workflowMilestones) {
      return (
        workflowMilestones[
          this.args.workflowMeta.completedMilestonesCount || -1
        ] || ''
      );
    } else {
      return '';
    }
  }

  get isComplete() {
    return (
      this.args.workflowMeta.completedMilestonesCount ===
      this.args.workflowMeta.milestonesCount
    );
  }

  @action visit() {
    this.workflowPersistence.visitPersistedWorkflow(this.workflowId);
    this.args.closeList();
  }

  @action showDeleteButton() {
    if (this.canDelete) {
      this.deleteButtonShown = true;
    }
  }

  @action hideDeleteButton() {
    this.deleteButtonShown = false;
  }

  @action showDeleteConfirmation() {
    this.deleteConfirmDialogShown = true;
  }

  @action hideDeleteConfirmation() {
    this.deleteConfirmDialogShown = false;
  }

  @action deleteWorkflow() {
    this.workflowPersistence.clearWorkflowWithId(this.workflowId);
    this.deleteConfirmDialogShown = false;
  }

  <template>
    {{!-- template-lint-disable no-invalid-interactive --}}
    <div
      class={{cn "workflow-tracker-item" workflow-tracker-item--completed=this.isComplete}}
      data-test-workflow-tracker-item={{this.workflowId}}
      {{on 'mouseover' this.showDeleteButton}}
      {{on 'mouseleave' this.hideDeleteButton}}
      ...attributes
    >
      <div class="workflow-tracker-item__description">
        <button
          type='button'
          {{on 'click' this.visit}}
          data-test-visit-workflow-button
        >
          <header class='workflow-tracker-item__heading'>
            {{this.workflowDisplayName}}
          </header>
          <div class='workflow-tracker-item__milestone'>
            {{#if this.isComplete}}
              Complete
            {{else}}
              {{this.currentMilestoneTitle}}
            {{/if}}
          </div>
        </button>
      </div>

      <div class="workflow-tracker-item__actions">
        {{#if this.deleteButtonShown}}
          <button
            class="workflow-tracker-item__icon workflow-tracker-item__delete-icon"
            type="button"
            {{on 'click' this.showDeleteConfirmation}}
            data-test-delete-workflow-button
            {{tippy "Abandon workflow"}}
          >
            {{svgJar 'trash' width="16"}}
          </button>
        {{else}}
          <BoxelProgressIcon
            class='workflow-tracker-item__icon'
            @size={{this.progressIconSize}}
            @isComplete={{this.isComplete}}
            @fractionComplete={{this.fractionComplete}}
          />
        {{/if}}
      </div>
    </div>

    {{#if this.deleteConfirmDialogShown}}
      <BoxelModal
        @isOpen={{true}}
        @onClose={{this.hideDeleteConfirmation}}
        @size="small"
        data-test-workflow-delete-confirmation-modal
      >
        <BoxelCardContainer class="abandon-workflow-confirmation">
          <h2> {{svgJar "failure-bordered"}} Abandon this workflow?</h2>
          <p>
            Please confirm if you wish to abandon this workflow. Any progress will be deleted
            and removed from the queue. This action cannot be undone.
          </p>
          <div class="abandon-workflow-confirmation__actions">
            <BoxelButton {{on "click" this.hideDeleteConfirmation}}>Cancel</BoxelButton>
            <BoxelButton
              {{on "click" this.deleteWorkflow}}
              class="abandon-workflow-confirmation__abandon-button"
              @kind="danger"
              data-test-abandon-workflow-button
            >
              Abandon Workflow
            </BoxelButton>
          </div>
        </BoxelCardContainer>
      </BoxelModal>
    {{/if}}
  </template>

  get fractionComplete() {
    return (
      this.args.workflowMeta.completedMilestonesCount! /
      this.args.workflowMeta.milestonesCount!
    );
  }
}
