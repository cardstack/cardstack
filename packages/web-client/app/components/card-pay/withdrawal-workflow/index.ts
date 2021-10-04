import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import {
  cardbot,
  IWorkflowMessage,
  Milestone,
  NetworkAwareWorkflowCard,
  NetworkAwareWorkflowMessage,
  PostableCollection,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';
import BN from 'bn.js';
import { tracked } from '@glimmer/tracking';
import { taskFor } from 'ember-concurrency-ts';
import {
  rawTimeout,
  TaskGenerator,
  waitForProperty,
  waitForQueue,
} from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { formatWeiAmount } from '@cardstack/web-client/helpers/format-wei-amount';
import { action } from '@ember/object';
import { isPresent } from '@ember/utils';
const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
  RESTORATION_L1_ADDRESS_CHANGED: 'RESTORATION_L1_ADDRESS_CHANGED',
  RESTORATION_L1_DISCONNECTED: 'RESTORATION_L1_DISCONNECTED',
  RESTORATION_L2_ADDRESS_CHANGED: 'RESTORATION_L2_ADDRESS_CHANGED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer1.conversationalName} wallet`,
  `Check ${c.layer1.nativeTokenSymbol} balance`,
  `Connect ${c.layer2.conversationalName} wallet`,
  `Withdraw from ${c.layer2.conversationalName}`,
  `Bridge tokens to ${c.layer1.conversationalName}`,
  `Claim tokens on ${c.layer1.conversationalName}`,
];

class CheckBalanceWorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage
{
  @tracked minimumBalanceForWithdrawalClaim: BN | undefined;

  cardName = 'CHECK_BALANCE_MESSAGE';

  constructor() {
    super(cardbot);
    taskFor(this.fetchMininumBalanceForWithdrawalClaimTask).perform();
  }

  @task
  *fetchMininumBalanceForWithdrawalClaimTask() {
    yield waitForQueue('afterRender'); // avoid error from using and setting workflow in the render queue
    yield waitForProperty(this, 'layer1Network', Boolean);
    // couldn't use waitForProperty for the layer1Network.defaultTokenBalance because waitForProperty is not reliable for tracked properties
    yield taskFor(this.waitUntilTask).perform(
      () => !!this.layer1Network.defaultTokenBalance
    );
    // HACK: We are passing "DAI" in the next line, but the user hasn't actually specified what token they will be withdrawing yet.
    let minimum: BN =
      yield this.layer1Network.getEstimatedGasForWithdrawalClaim('DAI');
    this.minimumBalanceForWithdrawalClaim = minimum;
    this.workflow?.session.setValue(
      'minimumBalanceForWithdrawalClaim',
      minimum
    );

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
      // The awkward positioning is a temporary hack to prevent commonmark from parsing this as a code block
      // https://spec.commonmark.org/0.30/#indented-code-blocks
      return `Checking your balance...

It looks like you have enough ${
        c.layer1.nativeTokenSymbol
      } in your account on ${
        c.layer1.fullName
      } to perform the last step of this withdrawal workflow, which requires ~${formatWeiAmount(
        minimumBalanceForWithdrawalClaim
      )} ${c.layer1.nativeTokenSymbol}.`;
    } else {
      return `Checking your balance...

The last step of this withdrawal requires that you have at least **~${formatWeiAmount(
        minimumBalanceForWithdrawalClaim
      )} ${c.layer1.nativeTokenSymbol}**.
You only have **${formatWeiAmount(layer1Network.defaultTokenBalance)} ${
        c.layer1.nativeTokenSymbol
      }**. You will need to deposit more
      ${
        c.layer1.nativeTokenSymbol
      } to your account shown below to continue the withdrawal.`;
    }
  }

  get layer1Network() {
    let workflow = this.workflow as WithdrawalWorkflow;
    return workflow?.layer1Network;
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
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  name = 'WITHDRAWAL' as WorkflowName;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
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
          cardName: 'LAYER1_CONNECT',
          componentName: 'card-pay/layer-one-connect-card',
        }),
      ],
      completedDetail: `${capitalize(
        c.layer1.conversationalName
      )} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      postables: [
        new CheckBalanceWorkflowMessage(),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CHECK_BALANCE',
          componentName: 'card-pay/withdrawal-workflow/check-balance',
        }),
      ],
      completedDetail: `${c.layer1.nativeTokenSymbol} balance checked`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
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
          cardName: 'LAYER2_CONNECT',
          componentName: 'card-pay/layer-two-connect-card',
        }),
      ],
      completedDetail: `${c.layer2.conversationalName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[3],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Please choose the asset you would like to withdraw.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CHOOSE_BALANCE',
          componentName: 'card-pay/withdrawal-workflow/choose-balance',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: 'How much would you like to withdraw from your balance?',
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'TRANSACTION_AMOUNT',
          componentName: 'card-pay/withdrawal-workflow/transaction-amount',
        }),
      ],
      completedDetail: `Withdrawn from ${c.layer2.conversationalName}`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[4],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Now that you have withdrawn funds from the ${c.layer2.fullName},
          your tokens will be bridged to ${c.layer1.fullName}. You can check the status below.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'TRANSACTION_STATUS',
          componentName: 'card-pay/withdrawal-workflow/transaction-status',
        }),
      ],
      completedDetail: `Tokens bridged to ${c.layer1.conversationalName}`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[5],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `As a final step, please sign this transaction to claim the bridged tokens into your
          ${c.layer1.fullName} wallet. You will have to pay ${c.layer1.conversationalName} gas fee for this operation.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'TOKEN_CLAIM',
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
      cardName: 'TRANSACTION_CONFIRMED',
      componentName: 'card-pay/withdrawal-workflow/transaction-confirmed',
    }),
    new WorkflowMessage({
      author: cardbot,
      message: `This is the remaining balance in your ${c.layer2.fullName} wallet:`,
    }),
    new WorkflowCard({
      author: cardbot,
      cardName: 'EPILOGUE_LAYER_TWO_CONNECT_CARD',
      componentName: 'card-pay/layer-two-connect-card',
    }),
    new WorkflowCard({
      author: cardbot,
      cardName: 'EPILOGUE_NEXT_STEPS',
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
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.DISCONNECTED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to withdraw funds, please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Layer 1 wallet address. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L1_ADDRESS_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card wallet address. Please restart the workflow.',
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
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but your Layer 1 wallet got disconnected. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L1_DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return isPresent(this.workflow?.cancelationReason);
      },
    }),
  ]);

  restorationErrors() {
    let { layer1Network, layer2Network } = this;

    let errors = [];

    if (!layer1Network.isConnected) {
      errors.push(FAILURE_REASONS.RESTORATION_L1_DISCONNECTED);
    }

    let persistedLayer1Address = this.session.getValue<string>(
      'layer1WalletAddress'
    );
    if (
      layer1Network.isConnected &&
      persistedLayer1Address &&
      layer1Network.walletInfo.firstAddress !== persistedLayer1Address
    ) {
      errors.push(FAILURE_REASONS.RESTORATION_L1_ADDRESS_CHANGED);
    }

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
      errors.push(FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED);
    }

    return errors;
  }

  beforeRestorationChecks() {
    return [this.layer1Network.waitForAccount];
  }

  constructor(owner: unknown, workflowPersistenceId?: string) {
    super(owner, workflowPersistenceId);
    this.attachWorkflow();
  }
}

export default class WithdrawalWorkflowComponent extends Component {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked workflow: WithdrawalWorkflow | null = null;
  @service declare router: RouterService;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    let workflow = new WithdrawalWorkflow(
      getOwner(this),
      workflowPersistenceId
    );

    this.restore(workflow);
  }

  async restore(workflow: any) {
    await workflow.restore();
    this.workflow = workflow;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}
