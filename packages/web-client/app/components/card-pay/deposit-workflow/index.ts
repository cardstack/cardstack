import {
  Milestone,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
} from '@cardstack/web-client/utils/workflow';
import Component from '@glimmer/component';

let cardbot = { name: 'Cardbot', imgURL: '/images/icons/cardbot.svg' };
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
        new WorkflowMessage({
          author: cardbot,
          message: `You have connected your Ethereum mainnet wallet. Now it's time to connect your xDai chain
          wallet via your Cardstack mobile app. If you don't have the app installed, please do so now.`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
          new wallet/account. Use your account to scan this QR code, which will connect your account
          with Card Pay.`,
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/deposit-workflow/connect-layer-two',
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
}

class DepositWorkFlowComponent extends Component {
  workflow = new DepositWorkflow();
}

export default DepositWorkFlowComponent;
