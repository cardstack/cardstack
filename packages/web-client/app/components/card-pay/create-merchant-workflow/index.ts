import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { formatUsd, spendToUsd } from '@cardstack/cardpay-sdk';
import {
  cardbot,
  ArbitraryDictionary,
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
import { next } from '@ember/runloop';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import RouterService from '@ember/routing/router-service';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  INSUFFICIENT_PREPAID_CARD_BALANCE: 'INSUFFICIENT_PREPAID_CARD_BALANCE',
  NO_PREPAID_CARD: 'NO_PREPAID_CARD',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
  RESTORATION_L2_ADDRESS_CHANGED: 'RESTORATION_L2_ADDRESS_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

class CreateMerchantWorkflow extends Workflow {
  name = 'MERCHANT_CREATION' as WorkflowName;
  workflowPersistenceId: string;

  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  milestones = [
    new Milestone({
      title: `Connect ${c.layer2.fullName} wallet`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Hello, nice to see you!`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `To receive payment through Card Pay, you need to create a merchant account.
          All you need is to choose a name for your merchant account and sign a transaction to create your merchant on the ${c.layer2.fullName}.`,
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
          message: `To get started, connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new account. Scan this QR code with your account, which will connect your account with Cardstack.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          cardName: 'LAYER2_CONNECT',
          author: cardbot,
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let { layer2Network } = this.workflow as CreateMerchantWorkflow;

            let merchantRegistrationFee = await taskFor(
              layer2Network.fetchMerchantRegistrationFeeTask
            ).perform();

            this.workflow?.session.update(
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
      title: 'Save merchant details',
      postables: [
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `To store data in the Cardstack Hub, you need to authenticate using your Card Wallet.
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
          message: 'Let’s create a new merchant account.',
        }),
        new WorkflowCard({
          cardName: 'MERCHANT_CUSTOMIZATION',
          author: cardbot,
          componentName:
            'card-pay/create-merchant-workflow/merchant-customization',
        }),
      ],
      completedDetail: 'Merchant details saved',
    }),
    new Milestone({
      title: 'Create merchant',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: 'Looking great!',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `On the next step: You need to pay a small protocol fee to create your merchant.
          Please select a prepaid card and balance from your ${c.layer2.fullName} wallet`,
        }),
        new WorkflowCard({
          cardName: 'PREPAID_CARD_CHOICE',
          author: cardbot,
          componentName:
            'card-pay/create-merchant-workflow/prepaid-card-choice',
        }),
      ],
      completedDetail: 'Merchant created',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `Congratulations! You have created a merchant.`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      author: cardbot,
      componentName: 'card-pay/create-merchant-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    new WorkflowMessage({
      author: cardbot,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a merchant, please start again by connecting your wallet.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    // cancelation for changing accounts
    new WorkflowMessage({
      author: cardbot,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a merchant, please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
    // cancelation for not having prepaid card
    new SessionAwareWorkflowMessage({
      author: cardbot,
      template: (session: ArbitraryDictionary) =>
        `It looks like you don’t have a prepaid card in your wallet. You will need one to pay the ${
          session.merchantRegistrationFee
        } SPEND (${formatUsd(
          spendToUsd(session.merchantRegistrationFee)!
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.NO_PREPAID_CARD
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.NO_PREPAID_CARD
        );
      },
    }),
    // cancelation for insufficient balance
    new SessionAwareWorkflowMessage({
      author: cardbot,
      template: (session: ArbitraryDictionary) =>
        `It looks like you don’t have a prepaid card with enough funds to pay the ${
          session.merchantRegistrationFee
        } SPEND (${formatUsd(
          spendToUsd(session.merchantRegistrationFee)!
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE
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
        'You attempted to restore an unfinished workflow, but you changed your Card wallet adress. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED
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
            FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE,
            FAILURE_REASONS.RESTORATION_UNAUTHENTICATED,
            FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED,
            FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
          ] as String[]
        ).includes(String(this.workflow?.cancelationReason));
      },
    }),
  ]);

  constructor(owner: unknown) {
    super(owner);
    this.workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    this.attachWorkflow();
  }

  restorationErrors(persistedState: any) {
    let { hubAuthentication, layer2Network } = this;

    let errors = [];

    if (!hubAuthentication.isAuthenticated) {
      errors.push(FAILURE_REASONS.RESTORATION_UNAUTHENTICATED);
    }

    if (!layer2Network.isConnected) {
      errors.push(FAILURE_REASONS.RESTORATION_L2_DISCONNECTED);
    }

    if (
      layer2Network.isConnected &&
      persistedState.layer2WalletAddress &&
      layer2Network.walletInfo.firstAddress !==
        persistedState.layer2WalletAddress
    ) {
      errors.push(FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED);
    }

    return errors;
  }
}

class CreateMerchantWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;

  workflow!: CreateMerchantWorkflow;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    const workflow = new CreateMerchantWorkflow(getOwner(this));
    const persistedState = workflow.session.getPersistedData()?.state ?? {};
    const willRestore = Object.keys(persistedState).length > 0;

    if (willRestore) {
      const errors = workflow.restorationErrors(persistedState);

      if (errors.length > 0) {
        next(this, () => {
          workflow.cancel(errors[0]);
        });
      } else {
        workflow.restoreFromPersistedWorkflow();
      }
    }

    this.workflow = workflow;
  }

  @action onDisconnect() {
    this.workflow.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default CreateMerchantWorkflowComponent;
