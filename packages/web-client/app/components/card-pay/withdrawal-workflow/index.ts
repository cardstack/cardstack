import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import NetworkAwareWorkflowMessage from '@cardstack/web-client/components/workflow-thread/network-aware-message';
import { Workflow, cardbot } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
} as const;

class WithdrawalWorkflow extends Workflow {
  name = 'Withdrawal';
  milestones = [
    new Milestone({
      title: `Connect ${c.layer1.conversationalName} wallet`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: 'Hi there, it’s good to see you!',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `In order to make a withdrawal, you need to connect two wallets:

  * **${c.layer1.fullName} wallet:**

      Linked to the ${c.layer1.shortName} blockchain on ${c.layer1.conversationalName}
  * **${c.layer2.fullName} wallet:**

      Linked to the ${c.layer2.shortName} blockchain for low-cost transactions
`,
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Looks like you've already connected your ${c.layer1.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer1Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-one-connect-card',
        }),
      ],
      completedDetail: `${capitalize(
        c.layer1.conversationalName
      )} wallet connected`,
    }),
    new Milestone({
      title: `Connect ${c.layer2.fullName} wallet`,
      postables: [
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
          message: `You have connected your ${c.layer1.fullName} wallet. Now it's time to connect your ${c.layer2.fullName}
          wallet via your Card Wallet mobile app. If you don't have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
          new wallet/account. Use your account to scan this QR code, which will connect your account
          with Card Pay.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-two-connect-card',
        }),
      ],
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: 'Set withdrawal amount',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Please choose the asset you would like to withdraw.`,
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/choose-balance',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: 'How much would you like to withdraw from your balance?',
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/transaction-amount',
        }),
      ],
      completedDetail: 'Withdrawal amount set',
    }),
    new Milestone({
      title: 'Confirm transaction',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message:
            'Now, we just need your confirmation to make the withdrawal.',
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/transaction-approval',
        }),
      ],
      completedDetail: 'Transaction confirmed',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `You have successfully withdrawn tokens from your ${c.layer2.fullName} wallet! The corresponding amount of tokens has been added to your ${c.layer1.fullName} wallet.`,
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/withdrawal-workflow/transaction-confirmed',
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
      componentName: 'card-pay/withdrawal-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    new NetworkAwareWorkflowMessage({
      author: cardbot,
      message:
        'It looks like your wallet(s) got disconnected. If you still want to withdraw tokens, please start again by connecting your wallet(s).',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/withdrawal-workflow/disconnection-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
  ]);

  constructor(owner: unknown) {
    super(owner);
    this.attachWorkflow();
  }
}

class WithdrawalWorkflowComponent extends Component {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  workflow!: WithdrawalWorkflow;
  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.workflow = new WithdrawalWorkflow(getOwner(this));
  }

  @action onDisconnect() {
    this.workflow.cancel(FAILURE_REASONS.DISCONNECTED);
  }
}

export default WithdrawalWorkflowComponent;
