import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import NetworkAwareWorkflowMessage from '@cardstack/web-client/components/workflow-thread/network-aware-message';
import NetworkAwareWorkflowCard from '@cardstack/web-client/components/workflow-thread/network-aware-card';
import { Workflow, cardbot } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import {
  CheckResult,
  WorkflowCard,
} from '@cardstack/web-client/models/workflow/workflow-card';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';
import BN from 'bn.js';
import { WorkflowPostable } from '@cardstack/web-client/models/workflow/workflow-postable';
import { tracked } from '@glimmer/tracking';
import { taskFor } from 'ember-concurrency-ts';
import {
  rawTimeout,
  TaskGenerator,
  waitForProperty,
  waitForQueue,
} from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { formatTokenAmount } from '@cardstack/web-client/helpers/format-token-amount';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
} as const;

class CheckBalanceWorkflowMessage extends WorkflowPostable {
  @tracked minimumBalanceForWithdrawalClaim: BN | undefined;

  constructor() {
    super(cardbot);
    taskFor(this.fetchMininumBalanceForWithdrawalClaimTask).perform();
  }

  @task
  *fetchMininumBalanceForWithdrawalClaimTask() {
    yield waitForQueue('afterRender'); // avoid error from using and setting workflow in the render queue
    yield waitForProperty(this, 'workflow', Boolean);
    yield waitForProperty(this, 'layer1Network', Boolean);
    // couldn't use waitForProperty for the layer1Network.defaultTokenBalance because waitForProperty is not reliable for tracked properties
    yield taskFor(this.waitUntilTask).perform(
      () => !!this.layer1Network.defaultTokenBalance
    );
    let minimum: BN = yield this.layer1Network.getEstimatedGasForWithdrawalClaim();
    this.minimumBalanceForWithdrawalClaim = minimum;
    this.workflow?.session.update('minimumBalanceForWithdrawalClaim', minimum);

    this.workflow!.emit('visible-postables-will-change');
    this.isComplete = true;
  }

  get message() {
    let { layer1Network, minimumBalanceForWithdrawalClaim } = this;
    if (
      layer1Network.defaultTokenBalance === undefined ||
      minimumBalanceForWithdrawalClaim === undefined
    ) {
      return 'Checking your balance...';
    }
    if (
      layer1Network.defaultTokenBalance!.gte(minimumBalanceForWithdrawalClaim)!
    ) {
      return `Checking your balance...
      
It looks like you have enough ${c.layer1.nativeTokenSymbol} in you account on ${
        c.layer1.fullName
      }, to perform the last step of this withrawal workflow, which requires ~${formatTokenAmount(
        minimumBalanceForWithdrawalClaim
      )} ${c.layer1.nativeTokenSymbol}.`;
    } else {
      return `Checking your balance...
      
The last step of this withdrawal requires that you have at least **~${formatTokenAmount(
        minimumBalanceForWithdrawalClaim
      )} ${c.layer1.nativeTokenSymbol}**.
You only have **${formatTokenAmount(layer1Network.defaultTokenBalance)} ${
        c.layer1.nativeTokenSymbol
      }**. You will need to deposit more
${
  c.layer1.nativeTokenSymbol
} to your account shown below to continue the withdrawal.`;
    }
  }

  get layer1Network() {
    return this.workflow?.owner.lookup(
      'service:layer1-network'
    ) as Layer1Network;
  }

  @task *waitUntilTask(
    predicate: () => boolean,
    delayMs = 1000
  ): TaskGenerator<void> {
    while (!predicate()) {
      yield rawTimeout(delayMs);
    }
  }
}

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
          message: `Looks like you’ve already connected your ${c.layer1.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer1Account;
          },
        }),
        new NetworkAwareWorkflowCard({
          author: cardbot,
          componentName: 'card-pay/layer-one-connect-card',
          async check(this: NetworkAwareWorkflowCard): Promise<CheckResult> {
            // delay completion until balances are loaded
            await this.waitUntil(() => {
              return !!this.layer1Network.defaultTokenBalance;
            }, 200);
            return {
              success: true,
            };
          },
        }),
      ],
      completedDetail: `${capitalize(
        c.layer1.conversationalName
      )} wallet connected`,
    }),
    new Milestone({
      title: `Check ${c.layer1.nativeTokenSymbol} balance`,
      postables: [
        new CheckBalanceWorkflowMessage(),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/check-balance',
        }),
      ],
      completedDetail: `${c.layer1.nativeTokenSymbol} balance checked`,
    }),
    new Milestone({
      title: `Connect ${c.layer2.conversationalName} wallet`,
      postables: [
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
      completedDetail: `${c.layer2.conversationalName} wallet connected`,
    }),
    new Milestone({
      title: `Withdraw from ${c.layer2.conversationalName}`,
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
      completedDetail: `Withdrawn from ${c.layer2.conversationalName}`,
    }),
    new Milestone({
      title: `Bridge tokens to ${c.layer1.conversationalName}`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Now that you have withdrawn funds from the ${c.layer2.fullName},
          your tokens will be bridged to ${c.layer1.fullName}. You can check the status below.`,
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/transaction-status',
        }),
      ],
      completedDetail: `Tokens bridged to ${c.layer1.conversationalName}`,
    }),
    new Milestone({
      title: `Claim tokens on ${c.layer1.conversationalName}`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `As a final step, please sign this transaction to claim the bridged tokens into your
          ${c.layer1.fullName} wallet. You will have to pay ${c.layer1.conversationalName} gas fee for this operation.`,
        }),
        new WorkflowCard({
          author: cardbot,
          componentName: 'card-pay/withdrawal-workflow/token-claim',
        }),
      ],
      completedDetail: `Tokens claimed on ${c.layer1.conversationalName}`,
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `Congrats! Your withdrawal is complete.`,
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
      componentName: 'workflow-thread/disconnection-cta',
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

export default class WithdrawalWorkflowComponent extends Component {
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
