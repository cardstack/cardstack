import { inject as service } from '@ember/service';

import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';

import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import {
  IWorkflowSession,
  Milestone,
  NetworkAwareWorkflowCard,
  NetworkAwareWorkflowMessage,
  PostableCollection,
  SessionAwareWorkflowMessage,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
  conditionalCancelationMessage,
} from '@cardstack/web-client/models/workflow';

import {
  convertAmountToNativeDisplay,
  fromWei,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import { standardCancelationPostables } from '@cardstack/web-client/models/workflow/cancelation-helpers';
import RestorableWorkflowComponent from '../restorable-workflow-component';

export const faceValueOptions = [500, 1000, 2500, 5000, 10000, 50000];

export const FAILURE_REASONS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  DISCONNECTED: 'DISCONNECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  RESTORATION_INSUFFICIENT_FUNDS: 'RESTORATION_INSUFFICIENT_FUNDS',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
  RESTORATION_L2_ACCOUNT_CHANGED: 'RESTORATION_L2_ACCOUNT_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer2.fullName} wallet`,
  'Customize layout',
  'Choose face value',
  'Confirm transaction',
];

export const WORKFLOW_VERSION = 4;

class IssuePrepaidCardWorkflow extends Workflow {
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  name = 'PREPAID_CARD_ISSUANCE' as WorkflowName;
  version = WORKFLOW_VERSION;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [
        new WorkflowMessage({
          message: `Hello, it’s nice to see you!`,
        }),
        new WorkflowMessage({
          message: `Let’s issue a prepaid card.`,
        }),
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `Before we get started, please connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new wallet/account. Use your account to scan this QR code, which will connect your account with Card Pay.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          cardName: 'LAYER2_CONNECT',
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let previouslyCanceledForInsufficientFunds =
              this.workflow?.isCanceled &&
              this.workflow.cancelationReason ===
                FAILURE_REASONS.INSUFFICIENT_FUNDS;
            /**
             * Use the previous cancelation's daiMinValue
             */
            if (previouslyCanceledForInsufficientFunds)
              return {
                success: false,
                reason: FAILURE_REASONS.INSUFFICIENT_FUNDS,
              };

            let { layer2Network } = this.workflow as IssuePrepaidCardWorkflow;

            this.workflow?.session.setValue(
              'spendMinValue',
              layer2Network.issuePrepaidCardSpendMinValue
            );
            this.workflow?.session.setValue(
              'daiMinValue',
              layer2Network.issuePrepaidCardDaiMinValue?.toString()
            );

            await layer2Network.waitForAccount;

            let sufficientBalanceSafes =
              layer2Network.safes.issuePrepaidCardSourceSafes;
            let sufficientFunds = sufficientBalanceSafes.length > 0;

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
      title: MILESTONE_TITLES[1],
      postables: [
        new NetworkAwareWorkflowMessage({
          message: `To store card customization data in the Cardstack Hub, you need to authenticate using your Card Wallet.
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
          message:
            'Let’s get started! First, you can choose the look and feel of your card, so that your customers and other users recognize that this prepaid card came from you.',
        }),
        new WorkflowCard({
          cardName: 'LAYOUT_CUSTOMIZATION',
          componentName:
            'card-pay/issue-prepaid-card-workflow/layout-customization',
        }),
      ],
      completedDetail: 'Layout customized',
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [
        new WorkflowMessage({
          message: 'Nice choice!',
        }),
        new WorkflowMessage({
          message: `On to the next step: How do you want to fund your prepaid card? Please select a source and balance from your ${c.layer2.fullName} wallet.`,
        }),
        new WorkflowCard({
          cardName: 'FUNDING_SOURCE',
          componentName: 'card-pay/issue-prepaid-card-workflow/funding-source',
        }),
        new WorkflowMessage({
          message: `When you choose the face value of your prepaid card, you may want to consider creating one card with a larger balance,
            as opposed to several cards with smaller balances (which would require a separate transaction, incl. fees, for each card).
            After you have created your card, you can split it up into multiple cards with smaller balances to transfer to your customers.`,
        }),
        new WorkflowCard({
          cardName: 'FACE_VALUE',
          componentName: 'card-pay/issue-prepaid-card-workflow/face-value',
        }),
      ],
      completedDetail: 'Face value chosen',
    }),
    new Milestone({
      title: MILESTONE_TITLES[3],
      postables: [
        new WorkflowMessage({
          message: `This is what your prepaid card will look like.
            Now, we just need your confirmation to create the card.`,
        }),
        new WorkflowCard({
          cardName: 'PREVIEW',
          componentName: 'card-pay/issue-prepaid-card-workflow/preview',
        }),
      ],
      completedDetail: 'Transaction confirmed',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      message: `Congratulations, you have created a prepaid card! This prepaid card has been added to your ${c.layer2.fullName} wallet.`,
    }),
    new WorkflowCard({
      cardName: 'CONFIRMATION',
      componentName: 'card-pay/issue-prepaid-card-workflow/confirmation',
    }),
    new WorkflowMessage({
      message: `This is the remaining balance in your ${c.layer2.fullName} wallet:`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_SAFE_BALANCE_CARD',
      componentName: 'card-pay/safe-balance-card',
      config: {
        safeAddressKey: 'prepaidFundingSafeAddress',
      },
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      componentName: 'card-pay/issue-prepaid-card-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.DISCONNECTED,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a prepaid card, please start again by connecting your wallet.`,
    }),
    // if we don't have enough balance (50 USD equivalent)
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `Looks like you don’t have a business account or depot with enough balance to fund a prepaid card. Before you can continue, you can add funds by bridging some tokens from your ${
          c.layer2.fullName
        } wallet, or by claiming business revenue in Card Wallet. The minimum balance needed to issue a prepaid card is approximately **${Math.ceil(
          Number(fromWei(session.getValue<string>('daiMinValue')!))
        )} ${c.layer2.daiToken} (${convertAmountToNativeDisplay(
          spendToUsd(session.getValue<number>('spendMinValue')!)!,
          'USD'
        )})**.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_FUNDS
        );
      },
    }),
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `You attempted to restore an unfinished workflow, but the chosen source does not have enough balance to fund a prepaid card. Before you can continue, you can add funds by bridging some tokens from your ${
          c.layer2.fullName
        } wallet, or by claiming business revenue in Card Wallet. The minimum balance needed to issue a prepaid card is approximately **${Math.ceil(
          Number(fromWei(session.getValue<string>('daiMinValue')!))
        )} ${c.layer2.daiToken} (${convertAmountToNativeDisplay(
          spendToUsd(session.getValue<number>('spendMinValue')!)!,
          'USD'
        )})**.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_INSUFFICIENT_FUNDS
        );
      },
    }),
    new WorkflowCard({
      componentName:
        'card-pay/issue-prepaid-card-workflow/insufficient-funds-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
            FAILURE_REASONS.INSUFFICIENT_FUNDS ||
          this.workflow?.cancelationReason ===
            FAILURE_REASONS.RESTORATION_INSUFFICIENT_FUNDS
        );
      },
    }),
    // cancelation for changing accounts
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.ACCOUNT_CHANGED,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a prepaid card, please restart the workflow.',
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

  constructor(owner: unknown, workflowPersistenceId?: string) {
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

    let prepaidFundingSafeAddress = this.session.getValue<string>(
      'prepaidFundingSafeAddress'
    );

    if (prepaidFundingSafeAddress) {
      if (
        !this.layer2Network.safes.issuePrepaidCardSourceSafes
          .mapBy('address')
          .includes(prepaidFundingSafeAddress)
      ) {
        errors.push(FAILURE_REASONS.RESTORATION_INSUFFICIENT_FUNDS);
      }
    }

    return errors;
  }

  beforeRestorationChecks() {
    return [this.layer2Network.waitForAccount];
  }
}

class IssuePrepaidCardWorkflowComponent extends RestorableWorkflowComponent<IssuePrepaidCardWorkflow> {
  @service declare layer2Network: Layer2Network;

  get workflowClass() {
    return IssuePrepaidCardWorkflow;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default IssuePrepaidCardWorkflowComponent;
