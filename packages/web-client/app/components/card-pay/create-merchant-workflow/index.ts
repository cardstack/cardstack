import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import {
  convertAmountToNativeDisplay,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import {
  conditionalCancelationMessage,
  IWorkflowSession,
  Milestone,
  PostableCollection,
  NetworkAwareWorkflowMessage,
  NetworkAwareWorkflowCard,
  SessionAwareWorkflowMessage,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
} from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { taskFor } from 'ember-concurrency-ts';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import RouterService from '@ember/routing/router-service';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { formatAmount } from '@cardstack/web-client/helpers/format-amount';
import { tracked } from '@glimmer/tracking';
import { standardCancelationPostables } from '@cardstack/web-client/models/workflow/cancelation-helpers';

const FAILURE_REASONS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  INSUFFICIENT_PREPAID_CARD_BALANCE: 'INSUFFICIENT_PREPAID_CARD_BALANCE',
  NO_PREPAID_CARD: 'NO_PREPAID_CARD',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
  RESTORATION_L2_ACCOUNT_CHANGED: 'RESTORATION_L2_ACCOUNT_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer2.fullName} wallet`,
  'Save merchant details',
  'Create merchant',
];
export const WORKFLOW_VERSION = 2;

class CreateMerchantWorkflow extends Workflow {
  name = 'MERCHANT_CREATION' as WorkflowName;
  version = WORKFLOW_VERSION;

  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [
        new WorkflowMessage({
          message: `Hello, nice to see you!`,
        }),
        new WorkflowMessage({
          message: `To receive payment through Card Pay, you need to create a merchant account.
          All you need is to choose a name for your merchant account and sign a transaction to create your merchant on the ${c.layer2.fullName}.`,
        }),
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `To get started, connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new account. Scan this QR code with your account, which will connect your account with Cardstack.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          cardName: 'LAYER2_CONNECT',
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let { layer2Network } = this.workflow as CreateMerchantWorkflow;

            let merchantRegistrationFee = await taskFor(
              layer2Network.fetchMerchantRegistrationFeeTask
            ).perform();

            this.workflow?.session.setValue(
              'merchantRegistrationFee',
              merchantRegistrationFee
            );

            await layer2Network.refreshSafesAndBalances();

            let hasPrepaidCardWithSufficientBalance = false;
            let hasPrepaidCard = false;
            for (let safe of layer2Network.safes.value) {
              hasPrepaidCard = safe.type === 'prepaid-card' || hasPrepaidCard;
              hasPrepaidCardWithSufficientBalance =
                safe.type === 'prepaid-card' &&
                safe.spendFaceValue >= merchantRegistrationFee;

              if (hasPrepaidCardWithSufficientBalance) {
                break;
              }
            }

            if (hasPrepaidCardWithSufficientBalance) {
              return {
                success: true,
              };
            } else if (hasPrepaidCard) {
              return {
                success: false,
                reason: FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE,
              };
            } else {
              return {
                success: false,
                reason: FAILURE_REASONS.NO_PREPAID_CARD,
              };
            }
          },
        }),
      ],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      postables: [
        new NetworkAwareWorkflowMessage({
          message: `To store data in the Cardstack Hub, you need to authenticate using your Card Wallet.
          You only need to do this once per browser/device.`,
          includeIf() {
            return !this.isHubAuthenticated;
          },
        }),
        new NetworkAwareWorkflowCard({
          cardName: 'HUB_AUTH',
          componentName: 'card-pay/hub-authentication',
          includeIf(this: NetworkAwareWorkflowCard) {
            return !this.isHubAuthenticated;
          },
        }),
        new WorkflowMessage({
          message: 'Let’s create a new merchant account.',
        }),
        new WorkflowCard({
          cardName: 'MERCHANT_CUSTOMIZATION',
          componentName:
            'card-pay/create-merchant-workflow/merchant-customization',
        }),
      ],
      completedDetail: 'Merchant details saved',
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [
        new WorkflowMessage({
          message: 'Looking great!',
        }),
        new WorkflowMessage({
          message: `On the next step: You need to pay a small protocol fee to create your merchant.
          Please select a prepaid card and balance from your ${c.layer2.fullName} wallet`,
        }),
        new WorkflowCard({
          cardName: 'PREPAID_CARD_CHOICE',
          componentName:
            'card-pay/create-merchant-workflow/prepaid-card-choice',
        }),
      ],
      completedDetail: 'Merchant created',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      message: `Congratulations! You have created a merchant.`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      componentName: 'card-pay/create-merchant-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.DISCONNECTED,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a merchant, please start again by connecting your wallet.`,
    }),
    // cancelation for changing accounts
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.ACCOUNT_CHANGED,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a merchant, please restart the workflow.',
    }),
    // cancelation for not having prepaid card
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `It looks like you don’t have a prepaid card in your wallet. You will need one to pay the ${formatAmount(
          session.getValue('merchantRegistrationFee')
        )} SPEND (${convertAmountToNativeDisplay(
          spendToUsd(session.getValue('merchantRegistrationFee')!)!,
          'USD'
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.NO_PREPAID_CARD
        );
      },
    }),
    // cancelation for insufficient balance
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `It looks like you don’t have a prepaid card with enough funds to pay the ${formatAmount(
          session.getValue('merchantRegistrationFee')
        )} SPEND (${convertAmountToNativeDisplay(
          spendToUsd(session.getValue('merchantRegistrationFee')!)!,
          'USD'
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE
        );
      },
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.UNAUTHENTICATED,
      message: 'You are no longer authenticated. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_UNAUTHENTICATED,
      message:
        'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card Wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Card Wallet got disconnected. Please restart the workflow.',
    }),
    ...standardCancelationPostables(),
  ]);

  constructor(owner: unknown, workflowPersistenceId: string) {
    super(owner, workflowPersistenceId);

    this.attachWorkflow();
  }

  restorationErrors() {
    let { hubAuthentication, layer2Network } = this;

    let errors = super.restorationErrors();

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

    if (!hubAuthentication.isAuthenticated) {
      errors.push(FAILURE_REASONS.RESTORATION_UNAUTHENTICATED);
    }

    return errors;
  }

  beforeRestorationChecks() {
    return [];
  }
}

class CreateMerchantWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;
  @tracked workflow: CreateMerchantWorkflow | null = null;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    let workflow = new CreateMerchantWorkflow(
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

export default CreateMerchantWorkflowComponent;
