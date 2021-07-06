import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { Workflow, cardbot } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import NetworkAwareWorkflowMessage from '@cardstack/web-client/components/workflow-thread/network-aware-message';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { BN } from 'bn.js';
import { faceValueOptions } from './workflow-config';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
} as const;

class IssuePrepaidCardWorkflow extends Workflow {
  name = 'Prepaid Card Issuance';
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
          message: `Looks like you've already connected your ${c.layer2.fullName} wallet, which you can see below.
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
          componentName: 'card-pay/layer-two-connect-card',
          async check() {
            let layer2Network = this.workflow?.owner.lookup(
              'service:layer2-network'
            ) as Layer2Network;

            let daiMinValue = await layer2Network.convertFromSpend(
              'DAI',
              Math.min(...faceValueOptions)
            );

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
        new WorkflowMessage({
          author: cardbot,
          message:
            'Let’s get started! First, you can choose the look and feel of your card, so that your customers and other users recognize that this prepaid card came from you.',
        }),
        new WorkflowCard({
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
      author: cardbot,
      componentName: 'card-pay/issue-prepaid-card-workflow/confirmation',
    }),
    new WorkflowMessage({
      author: cardbot,
      message: `This is the remaining balance in your ${c.layer2.fullName} wallet:`,
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/layer-two-connect-card',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/issue-prepaid-card-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    new WorkflowMessage({
      author: cardbot,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to deposit funds, please start again by connecting your wallet.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/issue-prepaid-card-workflow/disconnection-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    // if we don't have enough balance (50 USD equivalent)
    new WorkflowMessage({
      author: cardbot,
      message: `Looks like there's no balance in your ${c.layer2.fullName} wallet to fund a prepaid card. Before you can continue, please add funds to your ${c.layer2.fullName} wallet by bridging some tokens from your ${c.layer1.fullName} wallet.`,
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
  ]);

  constructor(owner: unknown) {
    super(owner);
    this.attachWorkflow();
  }
}

class IssuePrepaidCardWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;

  workflow!: IssuePrepaidCardWorkflow;
  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.workflow = new IssuePrepaidCardWorkflow(getOwner(this));
  }

  @action onDisconnect() {
    this.workflow.cancel(FAILURE_REASONS.DISCONNECTED);
  }
}

export default IssuePrepaidCardWorkflowComponent;
