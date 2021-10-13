import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import {
  Workflow,
  Milestone,
  NetworkAwareWorkflowMessage,
  PostableCollection,
  WorkflowName,
  WorkflowMessage,
  WorkflowCard,
  UNSUPPORTED_WORKFLOW_STATE_VERSION,
  conditionalCancelationMessage,
  defaultCancelationCard,
} from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';
import RouterService from '@ember/routing/router-service';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { tracked } from '@glimmer/tracking';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  RESTORATION_L1_ADDRESS_CHANGED: 'RESTORATION_L1_ADDRESS_CHANGED',
  RESTORATION_L1_DISCONNECTED: 'RESTORATION_L1_DISCONNECTED',
  RESTORATION_L2_ADDRESS_CHANGED: 'RESTORATION_L2_ADDRESS_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
  UNSUPPORTED_WORKFLOW_STATE_VERSION: UNSUPPORTED_WORKFLOW_STATE_VERSION,
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer1.conversationalName} wallet`,
  `Connect ${c.layer2.fullName} wallet`,
  'Deposit into reserve pool',
  `Receive tokens on ${c.layer2.shortName}`,
];

export const WORKFLOW_VERSION = 1;

class DepositWorkflow extends Workflow {
  @service declare router: RouterService;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  name = 'RESERVE_POOL_DEPOSIT' as WorkflowName;
  version = WORKFLOW_VERSION;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [
        new WorkflowMessage({
          message: 'Hi there, we’re happy to see you!',
        }),
        new WorkflowMessage({
          message: `In order to make a deposit, you need to connect two wallets:

  * **${c.layer1.fullName} wallet:**

      Linked to the ${c.layer1.shortName} blockchain on ${c.layer1.conversationalName}
  * **${c.layer2.fullName} wallet:**

      Linked to the ${c.layer2.shortName} blockchain for low-cost transactions
`,
        }),
        new WorkflowMessage({
          message: `The funds you wish to deposit must be available in your ${c.layer1.conversationalName} wallet, so that you can add
        them to the reserve pool on ${c.layer1.conversationalName}. Once you have made your deposit, an equivalent amount of
        tokens will be minted and added to your ${c.layer2.fullName} wallet.`,
        }),
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer1.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer1Account;
          },
        }),
        new WorkflowCard({
          cardName: 'LAYER1_CONNECT',
          componentName: 'card-pay/layer-one-connect-card',
        }),
      ],
      completedDetail: `${capitalize(
        c.layer1.conversationalName
      )} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      postables: [
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `You have connected your ${c.layer1.fullName} wallet. Now it’s time to connect your ${c.layer2.fullName}
          wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
          new wallet/account. Use your account to scan this QR code, which will connect your account
          with Card Pay.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          cardName: 'LAYER2_CONNECT',
          componentName: 'card-pay/layer-two-connect-card',
        }),
      ],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [
        new WorkflowMessage({
          message:
            'Let’s get down to business. Please choose the asset you would like to deposit into the CARD Protocol’s reserve pool.',
        }),
        new WorkflowCard({
          cardName: 'TXN_SETUP',
          componentName: 'card-pay/deposit-workflow/transaction-setup',
        }),
        new WorkflowMessage({
          message: 'How many tokens would you like to deposit?',
        }),
        new WorkflowCard({
          cardName: 'TXN_AMOUNT',
          componentName: 'card-pay/deposit-workflow/transaction-amount',
        }),
      ],
      completedDetail: 'Deposited into reserve pool',
    }),
    new Milestone({
      title: MILESTONE_TITLES[3],
      postables: [
        new WorkflowMessage({
          message: `Congrats! Now that you have deposited funds into the CARD Protocol’s reserve pool, your token will be bridged to the ${c.layer2.shortName} blockchain. You can check the status below.`,
        }),
        new WorkflowCard({
          cardName: 'TXN_STATUS',
          componentName: 'card-pay/deposit-workflow/transaction-status',
        }),
      ],
      completedDetail: `Tokens received on ${c.layer2.shortName}`,
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      message: 'Thank you for your contribution!',
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_CONFIRMATION',
      componentName: 'card-pay/deposit-workflow/confirmation',
    }),
    new WorkflowMessage({
      message: `This is the remaining balance in your ${c.layer1.fullName} wallet:`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_LAYER1_CONNECT',
      componentName: 'card-pay/layer-one-connect-card',
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      componentName: 'card-pay/deposit-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // cancelation for disconnection
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.DISCONNECTED,
      message:
        'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.ACCOUNT_CHANGED,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to deposit funds, please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L1_ADDRESS_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Layer 1 wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card Wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Card Wallet got disconnected. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L1_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Layer 1 wallet got disconnected. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.UNSUPPORTED_WORKFLOW_STATE_VERSION,
      message:
        'You attempted to restore an unfinished workflow, but the workflow has been upgraded by the Cardstack development team since then, so you will need to start again. Sorry about that!',
    }),
    defaultCancelationCard(),
  ]);

  restorationErrors() {
    let { layer1Network, layer2Network } = this;

    let errors = super.restorationErrors();

    if (!layer1Network.isConnected) {
      errors.push(FAILURE_REASONS.RESTORATION_L1_DISCONNECTED);
    }

    let persistedLayer1Address = this.session.getValue<string>(
      'layer1WalletAddress'
    );
    if (
      layer1Network.isConnected &&
      persistedLayer1Address &&
      layer1Network.walletInfo.firstAddress !== persistedLayer1Address
    ) {
      errors.push(FAILURE_REASONS.RESTORATION_L1_ADDRESS_CHANGED);
    }

    if (!layer2Network.isConnected) {
      errors.push(FAILURE_REASONS.RESTORATION_L2_DISCONNECTED);
    }

    let persistedLayer2Address = this.session.getValue<string>(
      'layer2WalletAddress'
    );
    if (
      layer2Network.isConnected &&
      persistedLayer2Address &&
      layer2Network.walletInfo.firstAddress !== persistedLayer2Address
    ) {
      errors.push(FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED);
    }

    return errors;
  }

  beforeRestorationChecks() {
    return [this.layer1Network.waitForAccount];
  }

  constructor(owner: unknown, workflowPersistenceId?: string) {
    super(owner, workflowPersistenceId);
    this.attachWorkflow();
  }
}

class DepositWorkflowComponent extends Component {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;
  @tracked workflow: DepositWorkflow | null = null;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    let workflow = new DepositWorkflow(getOwner(this), workflowPersistenceId);

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

export default DepositWorkflowComponent;
