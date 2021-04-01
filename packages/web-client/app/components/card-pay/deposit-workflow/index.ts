import {
  Milestone,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
} from '@cardstack/web-client/utils/workflow';
import Component from '@glimmer/component';

let cardbot = { name: 'cardbot' };
class DepositWorkflow extends Workflow {
  name = 'Reserve Pool Deposit';
  milestones = [
    new Milestone('Connect Mainnet Wallet', [
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
        componentName: 'card-pay/deposit-workflow/connect-mainnet',
      }),
    ]),
    new Milestone('Deposit into Reserve Pool', []),
    new Milestone('Receive tokens on xDai', []),
  ];
}

class DepositWorkFlowComponent extends Component {
  workflow = new DepositWorkflow();
}

export default DepositWorkFlowComponent;
