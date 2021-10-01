import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';

import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';

// import BN from 'bn.js';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import {
  // cardbot,
  Milestone,
  // NetworkAwareWorkflowCard,
  // NetworkAwareWorkflowMessage,
  PostableCollection,
  Workflow,
  // WorkflowCard,
  // WorkflowMessage,
  WorkflowName,
} from '@cardstack/web-client/models/workflow';

import { tracked } from '@glimmer/tracking';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
} as const;

export const MILESTONE_TITLES = [];

class CardSpaceSetupWorkflow extends Workflow {
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  name = 'CARD_SPACE_SETUP' as WorkflowName;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      postables: [],
      completedDetail: '',
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [],
      completedDetail: '',
    }),
  ];
  epilogue = new PostableCollection([]);
  cancelationMessages = new PostableCollection([]);

  constructor(owner: unknown, workflowPersistenceId?: string) {
    super(owner, workflowPersistenceId);
    this.attachWorkflow();
    this.restore();
  }

  restorationErrors() {
    return [];
  }

  beforeRestorationChecks() {
    return [];
  }
}

class CardSpaceSetupWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;

  @tracked workflow: CardSpaceSetupWorkflow | null = null;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    let workflow = new CardSpaceSetupWorkflow(
      getOwner(this),
      workflowPersistenceId
    );

    this.restore(workflow);
  }

  async restore(workflow: any) {
    await workflow.restore();
    this.workflow = workflow;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default CardSpaceSetupWorkflowComponent;
