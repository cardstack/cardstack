import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';
import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { WorkflowPostable } from '@cardstack/web-client/models/workflow/workflow-postable';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';

let cardbot = { name: 'Cardbot', imgURL: '/images/icons/cardbot.svg' };

class NetworkAwareWorflowMessage extends WorkflowMessage {
  get hasLayer1Account() {
    let postable = this as WorkflowPostable;
    let layer1Network = postable.workflow?.owner.lookup(
      'service:layer1-network'
    ) as Layer1Network;
    return layer1Network.hasAccount;
  }
  get hasLayer2Account() {
    let postable = this as WorkflowPostable;
    let layer2Network = postable.workflow?.owner.lookup(
      'service:layer2-network'
    ) as Layer2Network;
    return layer2Network.hasAccount;
  }
}

class DepositWorkflow extends Workflow {
  name = 'Reserve Pool Deposit';
  milestones = [
    new Milestone({
      title: 'Connect Mainnet wallet',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: "Hi there, we're happy to see you!",
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `In order to make a deposit, you need to connect two wallets:

  * Ethereum Mainnet Wallet: linked to the Ethereum blockchain on mainnet
  * xDai Chain Wallet: linked to the xDai blockchain for low-cost transactions
`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `The funds you wish to deposit must be available in your Mainnet Wallet, so that you can add
        them to the Reserve Pool on mainnet. Once you have made your deposit, an equivalent amount of
        tokens will be minted and added to your xDai Chain Wallet.`,
        }),
        new NetworkAwareWorflowMessage({
          author: cardbot,
          message: `Looks like you've already connected your Ethereum mainnet wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return (this as NetworkAwareWorflowMessage).hasLayer1Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/deposit-workflow/connect-layer-one',
        }),
      ],
      completedDetail: 'Mainnet Wallet connected',
    }),
    new Milestone({
      title: 'Connect xDai chain wallet',
      postables: [
        new NetworkAwareWorflowMessage({
          author: cardbot,
          message: `Looks like you've already connected your xDai chain wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return (this as NetworkAwareWorflowMessage).hasLayer2Account;
          },
        }),
        new NetworkAwareWorflowMessage({
          author: cardbot,
          message: `You have connected your Ethereum mainnet wallet. Now it's time to connect your xDai chain
          wallet via your Cardstack mobile app. If you don't have the app installed, please do so now.`,
          includeIf() {
            return !(this as NetworkAwareWorflowMessage).hasLayer2Account;
          },
        }),
        new NetworkAwareWorflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
          new wallet/account. Use your account to scan this QR code, which will connect your account
          with Card Pay.`,
          includeIf() {
            return !(this as NetworkAwareWorflowMessage).hasLayer2Account;
          },
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-two-connect-card',
        }),
      ],
      completedDetail: 'xDai Chain wallet connected',
    }),
    new Milestone({
      title: 'Deposit into reserve pool',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message:
            "Let's get down to business. Please choose the asset you would like to deposit into the CARD Protocol's Reserve Pool.",
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/deposit-workflow/transaction-setup',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: 'How many tokens would you like to deposit?',
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/deposit-workflow/transaction-amount',
        }),
      ],
      completedDetail: 'Deposited into Reserve Pool',
    }),
    new Milestone({
      title: 'Receive tokens on xDai',
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message:
            "Congrats! Now that you have deposited funds into the CARD Protocol's Reserve Pool, your token will be bridged to the xDai blockchain. You can check the status below.",
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/deposit-workflow/transaction-status',
        }),
      ],
      completedDetail: 'Tokens received on xDai',
    }),
  ];
  epiloguePostables = [
    new WorkflowMessage({
      author: cardbot,
      message: 'Thank you for your contribution!',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/deposit-workflow/confirmation',
    }),
    new WorkflowMessage({
      author: cardbot,
      message: 'This is the remaining balance in your Ethereum mainnet wallet:',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/deposit-workflow/connect-layer1',
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You have earned a Supplier badge. It has been sent to your xDai chain address.',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/deposit-workflow/supplier-badge',
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/deposit-workflow/next-steps',
    }),
  ];
  constructor(owner: unknown) {
    super(owner);
    this.attachWorkflow();
  }
}

class DepositWorkFlowComponent extends Component {
  workflow!: DepositWorkflow;
  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.workflow = new DepositWorkflow(getOwner(this));
  }
}

export default DepositWorkFlowComponent;
