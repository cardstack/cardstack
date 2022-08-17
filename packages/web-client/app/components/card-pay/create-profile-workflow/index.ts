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
import { standardCancelationPostables } from '@cardstack/web-client/models/workflow/cancelation-helpers';
import RestorableWorkflowComponent from '../restorable-workflow-component';

const FAILURE_REASONS = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  INSUFFICIENT_PREPAID_CARD_BALANCE: 'INSUFFICIENT_PREPAID_CARD_BALANCE',
  NO_PREPAID_CARD: 'NO_PREPAID_CARD',
  HAS_PROFILE: 'HAS_PROFILE',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
  RESTORATION_L2_ACCOUNT_CHANGED: 'RESTORATION_L2_ACCOUNT_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer2.fullName} wallet`,
  'Save profile details',
  'Create profile',
];
export const WORKFLOW_VERSION = 1;

class CreateProfileWorkflow extends Workflow {
  name = 'PROFILE_CREATION' as WorkflowName;
  version = WORKFLOW_VERSION;

  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      editableIf(session) {
        return !session.getValue('txnHash');
      },
      postables: [
        new WorkflowMessage({
          message: `Hello, nice to see you!`,
        }),
        new WorkflowMessage({
          message: `To receive payment through Card Pay, you need to create a profile.
          All you need is to choose a name for your profile and sign a transaction to create your profile on the ${c.layer2.fullName}.`,
        }),
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `To get started, connect your ${c.layer2.fullName} wallet via your Cardstack Wallet mobile app. If you don’t have the app installed, please do so now.`,
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
            let { layer2Network } = this.workflow as CreateProfileWorkflow;

            let profileRegistrationFee = await taskFor(
              layer2Network.fetchProfileRegistrationFeeTask
            ).perform();

            this.workflow?.session.setValue(
              'profileRegistrationFee',
              profileRegistrationFee
            );

            await layer2Network.refreshSafesAndBalances();

            let hasPrepaidCardWithSufficientBalance = false;
            let hasPrepaidCard = false;
            let hasProfile = false;
            for (let safe of layer2Network.safes.value) {
              hasPrepaidCard = safe.type === 'prepaid-card' || hasPrepaidCard;
              hasPrepaidCardWithSufficientBalance =
                hasPrepaidCardWithSufficientBalance ||
                (safe.type === 'prepaid-card' &&
                  safe.spendFaceValue >= profileRegistrationFee);
              hasProfile = hasProfile || safe.type === 'merchant';
              if (hasProfile) {
                return {
                  success: false,
                  reason: FAILURE_REASONS.HAS_PROFILE,
                };
              }
            }

            if (!hasPrepaidCard) {
              return {
                success: false,
                reason: FAILURE_REASONS.NO_PREPAID_CARD,
              };
            } else if (!hasPrepaidCardWithSufficientBalance) {
              return {
                success: false,
                reason: FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE,
              };
            } else {
              return {
                success: true,
              };
            }
          },
        }),
      ],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      editableIf(session) {
        return !session.getValue('txnHash');
      },
      postables: [
        new NetworkAwareWorkflowMessage({
          message: `To store data in the Cardstack Hub, you need to authenticate using your Cardstack Wallet.
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
          message: 'Let’s create a new profile.',
        }),
        new WorkflowCard({
          cardName: 'PROFILE_CUSTOMIZATION',
          componentName:
            'card-pay/create-profile-workflow/profile-customization',
        }),
      ],
      completedDetail: 'Profile details saved',
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [
        new WorkflowMessage({
          message: 'Looking great!',
        }),
        new WorkflowMessage({
          message: `On the next step: You need to pay a small protocol fee to create your profile.
          Please select a prepaid card and balance from your ${c.layer2.fullName} wallet`,
        }),
        new WorkflowCard({
          cardName: 'PREPAID_CARD_CHOICE',
          componentName: 'card-pay/create-profile-workflow/prepaid-card-choice',
        }),
      ],
      completedDetail: 'Payment profile created',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      message: `Congratulations! You have created a profile.`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      componentName: 'card-pay/create-profile-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.DISCONNECTED,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a profile, please start again by connecting your wallet.`,
    }),
    // cancelation for changing accounts
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.ACCOUNT_CHANGED,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a profile, please restart the workflow.',
    }),
    // cancelation for not having prepaid card
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `It looks like you don’t have a prepaid card in your wallet. You will need one to pay the ${convertAmountToNativeDisplay(
          spendToUsd(session.getValue('profileRegistrationFee')!)!,
          'USD'
        )} profile creation fee. Please buy a prepaid card in your Cardstack Wallet mobile app before you continue with this workflow.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.NO_PREPAID_CARD
        );
      },
    }),
    // cancelation for insufficient balance
    new SessionAwareWorkflowMessage({
      template: (session: IWorkflowSession) =>
        `It looks like you don’t have a prepaid card with enough funds to pay the ${convertAmountToNativeDisplay(
          spendToUsd(session.getValue('profileRegistrationFee')!)!,
          'USD'
        )} profile creation fee. Please buy a prepaid card in your Cardstack Wallet mobile app before you continue with this workflow.`,
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
      forReason: FAILURE_REASONS.HAS_PROFILE,
      message:
        'You already have a profile. You can not create another one with this account.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_UNAUTHENTICATED,
      message:
        'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Cardstack Wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Cardstack Wallet got disconnected. Please restart the workflow.',
    }),

    new WorkflowCard({
      componentName: 'card-pay/create-profile-workflow/has-profile-cancelation',
      includeIf() {
        return this.workflow?.cancelationReason === FAILURE_REASONS.HAS_PROFILE;
      },
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

class CreateProfileWorkflowComponent extends RestorableWorkflowComponent<CreateProfileWorkflow> {
  @service declare layer2Network: Layer2Network;

  get workflowClass() {
    return CreateProfileWorkflow;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default CreateProfileWorkflowComponent;
