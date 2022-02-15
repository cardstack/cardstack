import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import WorkflowPersistence, {
  WorkflowPersistenceMeta,
} from '@cardstack/ssr-web/services/workflow-persistence';
import {
  CardPayWorkflowName,
  CARD_PAY_WORKFLOW_NAMES,
} from '@cardstack/ssr-web/models/workflow';

import { MILESTONE_TITLES as MERCHANT_CREATION_MILESTONES } from '@cardstack/ssr-web/components/card-pay/create-merchant-workflow';
import { MILESTONE_TITLES as PREPAID_CARD_ISSUANCE_MILESTONES } from '@cardstack/ssr-web/components/card-pay/issue-prepaid-card-workflow';
import { MILESTONE_TITLES as RESERVE_POOL_DEPOSIT_MILESTONES } from '@cardstack/ssr-web/components/card-pay/deposit-workflow';
import { MILESTONE_TITLES as WITHDRAWAL_MILESTONES } from '@cardstack/ssr-web/components/card-pay/withdrawal-workflow';
import { tracked } from '@glimmer/tracking';

const WORKFLOW_TITLE_TO_MILESTONES: Record<CardPayWorkflowName, string[]> = {
  PREPAID_CARD_ISSUANCE: PREPAID_CARD_ISSUANCE_MILESTONES,
  MERCHANT_CREATION: MERCHANT_CREATION_MILESTONES,
  RESERVE_POOL_DEPOSIT: RESERVE_POOL_DEPOSIT_MILESTONES,
  WITHDRAWAL: WITHDRAWAL_MILESTONES,
};

interface CardPayHeaderWorkflowTrackerItemArgs {
  workflowMeta: WorkflowPersistenceMeta;
  closeList: () => void;
}

export default class CardPayHeaderWorkflowTrackerItem extends Component<CardPayHeaderWorkflowTrackerItemArgs> {
  @service declare workflowPersistence: WorkflowPersistence;
  @tracked deleteButtonShown: boolean = false;
  @tracked deleteConfirmDialogShown: boolean = false;

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

  get fractionComplete() {
    return (
      this.args.workflowMeta.completedMilestonesCount! /
      this.args.workflowMeta.milestonesCount!
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
}
