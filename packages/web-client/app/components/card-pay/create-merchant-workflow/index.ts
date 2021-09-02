import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { formatUsd, spendToUsd } from '@cardstack/cardpay-sdk';
import {
  IWorkflowMessage,
  WorkflowMessage,
} from '@cardstack/web-client/models/workflow/workflow-message';
import { Workflow, cardbot } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import NetworkAwareWorkflowCard from '@cardstack/web-client/components/workflow-thread/network-aware-card';
import NetworkAwareWorkflowMessage from '@cardstack/web-client/components/workflow-thread/network-aware-message';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';

import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';
import { taskFor } from 'ember-concurrency-ts';
import { ArbitraryDictionary } from '@cardstack/web-client/models/workflow/workflow-session';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  INSUFFICIENT_PREPAID_CARD_BALANCE: 'INSUFFICIENT_PREPAID_CARD_BALANCE',
  NO_PREPAID_CARD: 'NO_PREPAID_CARD',
} as const;

interface SessionAwareWorkflowMessageOptions {
  author: Participant;
  includeIf: (this: WorkflowPostable) => boolean;
  template: (session: ArbitraryDictionary) => string;
}

class SessionAwareWorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage {
  private template: (session: ArbitraryDictionary) => string;
  isComplete = true;

  constructor(options: SessionAwareWorkflowMessageOptions) {
    super(options.author, options.includeIf);
    this.template = options.template;
  }

  get message() {
    return this.template(this.workflow?.session.state!);
  }
}

class CreateMerchantWorkflow extends Workflow {
  name = 'Merchant Creation';
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
          author: cardbot,
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let layer2Network = this.workflow?.owner.lookup(
              'service:layer2-network'
            ) as Layer2Network;

            let merchantRegistrationFee = await taskFor(
              layer2Network.fetchMerchantRegistrationFeeTask
            ).perform();

            this.workflow?.session.update(
              'merchantRegistrationFee',
              merchantRegistrationFee
            );

            await layer2Network.safes.fetch();

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
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.INSUFFICIENT_PREPAID_CARD_BALANCE
        );
      },
    }),
  ]);

  constructor(owner: unknown) {
    super(owner);
    this.attachWorkflow();
  }
}

class CreateMerchantWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;

  workflow!: CreateMerchantWorkflow;
  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.workflow = new CreateMerchantWorkflow(getOwner(this));
  }

  @action onDisconnect() {
    this.workflow.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default CreateMerchantWorkflowComponent;
