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

class WithdrawalWorkflow extends Workflow {
  name = 'Withdrawal';
  milestones = [
    new Milestone({
      title: 'Connect mainnet wallet',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: 'Hi there, it’s good to see you!',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `In order to make a withdrawal, you need to connect two wallets:

  * **Ethereum mainnet wallet:**

      Linked to the Ethereum blockchain on mainnet
  * **xDai chain wallet:**

      Linked to the xDai blockchain for low-cost transactions
`,
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Looks like you've already connected your Ethereum mainnet wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return (this as NetworkAwareWorkflowMessage).hasLayer1Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-one-connect-card',
        }),
      ],
      completedDetail: 'Mainnet wallet connected',
    }),
    new Milestone({
      title: 'Connect xDai chain wallet',
      postables: [
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Looks like you've already connected your xDai chain wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return (this as NetworkAwareWorkflowMessage).hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `You have connected your Ethereum mainnet wallet. Now it's time to connect your xDai chain
          wallet via your Card Wallet mobile app. If you don't have the app installed, please do so now.`,
          includeIf() {
            return !(this as NetworkAwareWorkflowMessage).hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
          new wallet/account. Use your account to scan this QR code, which will connect your account
          with Card Pay.`,
          includeIf() {
            return !(this as NetworkAwareWorkflowMessage).hasLayer2Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-two-connect-card',
        }),
      ],
      completedDetail: 'xDai chain wallet connected',
    }),
    new Milestone({
      title: 'Set withdrawal amount',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message:
            'From which balance in your xDai chain wallet do you want to withdraw funds?',
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
      message:
        'You have successfully withdrawn tokens from your xDai chain wallet! The corresponding amount of tokens has been added to your Ethereum mainnet wallet.',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/withdrawal-workflow/transaction-confirmed',
    }),
    new WorkflowMessage({
      author: cardbot,
      message: 'This is the remaining balance in your xDai chain wallet:',
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
        let message = this as NetworkAwareWorkflowMessage;
        return !message.hasLayer1Account || !message.hasLayer2Account;
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/withdrawal-workflow/workflow-canceled-cta',
      includeIf() {
        let message = this as NetworkAwareWorkflowMessage;
        return !message.hasLayer1Account || !message.hasLayer2Account;
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

  @action cancelWorkflow() {
    this.workflow.cancel();
  }
}

export default WithdrawalWorkflowComponent;
