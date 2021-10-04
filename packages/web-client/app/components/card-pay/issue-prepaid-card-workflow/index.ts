import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';

import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';

import BN from 'bn.js';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import {
  cardbot,
  Milestone,
  NetworkAwareWorkflowCard,
  NetworkAwareWorkflowMessage,
  PostableCollection,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
} from '@cardstack/web-client/models/workflow';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { tracked } from '@glimmer/tracking';

export const faceValueOptions = [500, 1000, 2500, 5000, 10000, 50000];
export const spendToUsdRate = 0.01;

const FAILURE_REASONS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  DISCONNECTED: 'DISCONNECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
  RESTORATION_L2_ACCOUNT_CHANGED: 'RESTORATION_L2_ACCOUNT_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

class IssuePrepaidCardWorkflow extends Workflow {
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  workflowPersistenceId: string;
  name = 'PREPAID_CARD_ISSUANCE' as WorkflowName;

  milestones = [
    new Milestone({
      title: `Connect ${c.layer2.fullName} wallet`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Hello, it’s nice to see you!`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `Let’s issue a prepaid card.`,
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Before we get started, please connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new wallet/account. Use your account to scan this QR code, which will connect your account with Card Pay.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'LAYER2_CONNECT',
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let { layer2Network } = this.workflow as IssuePrepaidCardWorkflow;

            let daiMinValue = await layer2Network.convertFromSpend(
              'DAI',
              Math.min(...faceValueOptions)
            );
            await layer2Network.waitForAccount;
            let sufficientFunds = !!layer2Network.defaultTokenBalance?.gte(
              new BN(daiMinValue)
            );

            if (sufficientFunds) {
              return {
                success: true,
              };
            } else {
              return {
                success: false,
                reason: FAILURE_REASONS.INSUFFICIENT_FUNDS,
              };
            }
          },
        }),
      ],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: 'Customize layout',
      postables: [
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `To store card customization data in the Cardstack Hub, you need to authenticate using your Card Wallet.
          You only need to do this once per browser/device.`,
          includeIf() {
            return !this.isHubAuthenticated;
          },
        }),
        new NetworkAwareWorkflowCard({
          cardName: 'HUB_AUTH',
          author: cardbot,
          componentName: 'card-pay/hub-authentication',
          includeIf(this: NetworkAwareWorkflowCard) {
            return !this.isHubAuthenticated;
          },
        }),
        new WorkflowMessage({
          author: cardbot,
          message:
            'Let’s get started! First, you can choose the look and feel of your card, so that your customers and other users recognize that this prepaid card came from you.',
        }),
        new WorkflowCard({
          cardName: 'LAYOUT_CUSTOMIZATION',
          author: cardbot,
          componentName:
            'card-pay/issue-prepaid-card-workflow/layout-customization',
        }),
      ],
      completedDetail: 'Layout customized',
    }),
    new Milestone({
      title: 'Choose face value',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: 'Nice choice!',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `On to the next step: How do you want to fund your prepaid card? Please select a depot and balance from your ${c.layer2.fullName} wallet.`,
        }),
        new WorkflowCard({
          cardName: 'FUNDING_SOURCE',
          author: cardbot,
          componentName: 'card-pay/issue-prepaid-card-workflow/funding-source',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `When you choose the face value of your prepaid card, you may want to consider creating one card with a larger balance,
            as opposed to several cards with smaller balances (which would require a separate transaction, incl. fees, for each card).
            After you have created your card, you can split it up into multiple cards with smaller balances to transfer to your customers.`,
        }),
        new WorkflowCard({
          cardName: 'FACE_VALUE',
          author: cardbot,
          componentName: 'card-pay/issue-prepaid-card-workflow/face-value',
        }),
      ],
      completedDetail: 'Face value chosen',
    }),
    new Milestone({
      title: 'Confirm transaction',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `This is what your prepaid card will look like.
            Now, we just need your confirmation to create the card.`,
        }),
        new WorkflowCard({
          cardName: 'PREVIEW',
          author: cardbot,
          componentName: 'card-pay/issue-prepaid-card-workflow/preview',
        }),
      ],
      completedDetail: 'Transaction confirmed',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `Congratulations, you have created a prepaid card! This prepaid card has been added to your ${c.layer2.fullName} wallet.`,
    }),
    new WorkflowCard({
      cardName: 'CONFIRMATION',
      author: cardbot,
      componentName: 'card-pay/issue-prepaid-card-workflow/confirmation',
    }),
    new WorkflowMessage({
      author: cardbot,
      message: `This is the remaining balance in your ${c.layer2.fullName} wallet:`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_LAYER_TWO_CONNECT_CARD',
      author: cardbot,
      componentName: 'card-pay/layer-two-connect-card',
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      author: cardbot,
      componentName: 'card-pay/issue-prepaid-card-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    new WorkflowMessage({
      author: cardbot,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a prepaid card, please start again by connecting your wallet.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    // if we don't have enough balance (50 USD equivalent)
    new WorkflowMessage({
      author: cardbot,
      message: `Looks like there’s no balance in your ${c.layer2.fullName} wallet to fund a prepaid card. Before you can continue, please add funds to your ${c.layer2.fullName} wallet by bridging some tokens from your ${c.layer1.fullName} wallet.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_FUNDS
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName:
        'card-pay/issue-prepaid-card-workflow/insufficient-funds-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_FUNDS
        );
      },
    }),
    // cancelation for changing accounts
    new WorkflowMessage({
      author: cardbot,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a prepaid card, please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message: 'You are no longer authenticated. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.UNAUTHENTICATED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_UNAUTHENTICATED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card wallet address. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but your Card wallet got disconnected. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L2_DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          [
            FAILURE_REASONS.DISCONNECTED,
            FAILURE_REASONS.ACCOUNT_CHANGED,
            FAILURE_REASONS.UNAUTHENTICATED,
            FAILURE_REASONS.RESTORATION_UNAUTHENTICATED,
            FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED,
            FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
          ] as String[]
        ).includes(String(this.workflow?.cancelationReason));
      },
    }),
  ]);

  constructor(owner: any) {
    super(owner);
    this.workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    this.attachWorkflow();
  }

  restorationErrors() {
    let { hubAuthentication, layer2Network } = this;

    let errors = [];

    if (!hubAuthentication.isAuthenticated) {
      errors.push(FAILURE_REASONS.RESTORATION_UNAUTHENTICATED);
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
      errors.push(FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED);
    }

    return errors;
  }
}

class IssuePrepaidCardWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;

  @tracked workflow: IssuePrepaidCardWorkflow | null = null;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflow = new IssuePrepaidCardWorkflow(getOwner(this));
    let willRestore = workflow.session.hasPersistedState();

    if (willRestore) {
      workflow.session.restoreFromStorage();
      taskFor(this.restoreTask).perform(workflow);
    } else {
      this.workflow = workflow;
    }
  }

  @task *restoreTask(workflow: IssuePrepaidCardWorkflow) {
    let errors = workflow.restorationErrors();
    if (errors.length > 0) {
      next(this, () => {
        workflow.cancel(errors[0]);
      });
    } else {
      yield this.layer2Network.waitForAccount;
      workflow.restoreFromPersistedWorkflow();
    }
    this.workflow = workflow;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default IssuePrepaidCardWorkflowComponent;
