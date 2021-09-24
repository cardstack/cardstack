import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import WorkflowPersistence, {
  WorkflowPersistencePersistedData,
} from '@cardstack/web-client/services/workflow-persistence';
import {
  WorkflowName,
  WORKFLOW_NAMES,
} from '@cardstack/web-client/models/workflow';

import { MILESTONE_TITLES as MERCHANT_CREATION_MILESTONES } from '@cardstack/web-client/components/card-pay/create-merchant-workflow';
import { MILESTONE_TITLES as PREPAID_CARD_ISSUANCE_MILESTONES } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import { MILESTONE_TITLES as RESERVE_POOL_DEPOSIT_MILESTONES } from '@cardstack/web-client/components/card-pay/deposit-workflow';
import { MILESTONE_TITLES as WITHDRAWAL_MILESTONES } from '@cardstack/web-client/components/card-pay/withdrawal-workflow';

const WORKFLOW_TITLE_TO_MILESTONES: Record<WorkflowName, string[]> = {
  'PREPAID_CARD_ISSUANCE': PREPAID_CARD_ISSUANCE_MILESTONES,
  'MERCHANT_CREATION': MERCHANT_CREATION_MILESTONES,
  'RESERVE_POOL_DEPOSIT': RESERVE_POOL_DEPOSIT_MILESTONES,
  'WITHDRAWAL': WITHDRAWAL_MILESTONES,
};

interface CardPayHeaderWorkflowTrackerItemArgs {
  workflow: { workflow: WorkflowPersistencePersistedData, id: string};
}

export default class CardPayHeaderWorkflowTrackerItem extends Component<CardPayHeaderWorkflowTrackerItemArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  get workflow() {
    return this.args.workflow.workflow;
  }

  get workflowId() {
    return this.args.workflow.id;
  }

  get workflowName() {
    return (
      WORKFLOW_NAMES[this.workflow.name as WorkflowName] ||
      'Unknown workflow type'
    );
  }

  get workflowState() {
    return this.workflow.state;
  }

  get currentMilestoneTitle() {
    let workflowMilestones = WORKFLOW_TITLE_TO_MILESTONES[this.workflow.name as WorkflowName];

    if (workflowMilestones) {
      return workflowMilestones[this.workflowState.completedMilestonesCount] || '';
    } else {
      return '';
    }
  }

  get isComplete() {
    return (
      this.workflowState.completedMilestonesCount ===
      this.workflowState.milestonesCount
    );
  }

  get fractionComplete() {
    return (
      this.workflowState.completedMilestonesCount /
      this.workflowState.milestonesCount
    );
  }

  @action visit() {
    this.workflowPersistence.visitPersistedWorkflow(this.workflowId);
  }
}
