import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import {
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
  conditionalCancelationMessage,
} from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';
import BN from 'bn.js';
import { tracked, cached } from '@glimmer/tracking';
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
import { standardCancelationPostables } from '@cardstack/web-client/models/workflow/cancelation-helpers';

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

export const WORKFLOW_VERSION = 5;

class CheckBalanceWorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage
{
  @tracked minimumBalanceForWithdrawalClaim: BN | undefined;

  cardName = 'CHECK_BALANCE_MESSAGE';

  constructor() {
    super();
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
      return `Checking your balance...

      It looks like you have enough ${
        c.layer1.nativeTokenSymbol
      } in your account on ${
        c.layer1.fullName
      } to perform the last step of this withdrawal workflow, which requires ~${formatWeiAmount(
        minimumBalanceForWithdrawalClaim,
        false
      )} ${c.layer1.nativeTokenSymbol}.`;
    } else {
      return `Checking your balance...

      The last step of this withdrawal requires that you have at least **~${formatWeiAmount(
        minimumBalanceForWithdrawalClaim,
        false
      )} ${c.layer1.nativeTokenSymbol}**.
      You only have **${formatWeiAmount(
        layer1Network.defaultTokenBalance,
        false
      )} ${c.layer1.nativeTokenSymbol}**. You will need to deposit more
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

export class WithdrawalWorkflow extends Workflow {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  name = 'WITHDRAWAL' as WorkflowName;
  version = WORKFLOW_VERSION;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [
        new WorkflowMessage({
          message: 'Hi there, it’s good to see you!',
        }),
        new WorkflowMessage({
          message: `In order to make a withdrawal, you need to connect two wallets:

  * **${c.layer1.fullName} wallet:**

      Linked to the ${c.layer1.shortName} blockchain on ${c.layer1.conversationalName}
  * **${c.layer2.fullName} wallet:**

      Linked to the ${c.layer2.shortName} blockchain for low-cost transactions
`,
        }),
        new NetworkAwareWorkflowMessage({
          message: `Looks like you’ve already connected your ${c.layer1.fullName} wallet, which you can see below.
          Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer1Account;
          },
        }),
        new NetworkAwareWorkflowCard({
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
          message: `Looks like you’ve already connected your ${c.layer2.fullName} wallet, which you can see below.
Please continue with the next step of this workflow.`,
          includeIf() {
            return this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `You have connected your ${c.layer1.fullName} wallet. Now it’s time to connect your ${c.layer2.fullName}
wallet via your Card Wallet mobile app. If you don’t have the app installed, please do so now.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new NetworkAwareWorkflowMessage({
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a
new wallet/account. Use your account to scan this QR code, which will connect your account
with Card Pay.`,
          includeIf() {
            return !this.hasLayer2Account;
          },
        }),
        new WorkflowCard({
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
          message: `Please choose the asset you would like to withdraw.`,
        }),
        new WorkflowCard({
          cardName: 'CHOOSE_BALANCE',
          componentName: 'card-pay/withdrawal-workflow/choose-balance',
        }),
        new WorkflowMessage({
          message: 'How much would you like to withdraw from your balance?',
        }),
        new WorkflowCard({
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
          message: `Now that you have withdrawn funds from the ${c.layer2.fullName},
          your tokens will be bridged to ${c.layer1.fullName}. You can check the status below.`,
        }),
        new WorkflowCard({
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
          message: `As a final step, please sign this transaction to claim the bridged tokens into your
          ${c.layer1.fullName} wallet. You will have to pay ${c.layer1.conversationalName} gas fee for this operation.`,
        }),
        new WorkflowCard({
          cardName: 'TOKEN_CLAIM',
          componentName: 'card-pay/withdrawal-workflow/token-claim',
        }),
      ],
      completedDetail: `Tokens claimed on ${c.layer1.conversationalName}`,
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      message: `Congrats! Your withdrawal is complete.`,
    }),
    new WorkflowCard({
      cardName: 'TRANSACTION_CONFIRMED',
      componentName: 'card-pay/withdrawal-workflow/transaction-confirmed',
    }),
    new WorkflowMessage({
      message: `This is the remaining balance in your ${c.layer2.fullName} wallet:`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_SAFE_BALANCE_CARD',
      componentName: 'card-pay/safe-balance-card',
      config: {
        safeAddressKey: 'withdrawalSafe',
      },
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      componentName: 'card-pay/withdrawal-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.DISCONNECTED,
      message:
        'It looks like your wallet(s) got disconnected. If you still want to withdraw tokens, please start again by connecting your wallet(s).',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.ACCOUNT_CHANGED,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to withdraw funds, please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L1_ADDRESS_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Layer 1 wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_ADDRESS_CHANGED,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card Wallet address. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Card Wallet got disconnected. Please restart the workflow.',
    }),
    conditionalCancelationMessage({
      forReason: FAILURE_REASONS.RESTORATION_L1_DISCONNECTED,
      message:
        'You attempted to restore an unfinished workflow, but your Layer 1 wallet got disconnected. Please restart the workflow.',
    }),
    ...standardCancelationPostables(),
  ]);

  restorationErrors() {
    let { layer1Network, layer2Network } = this;

    let errors = super.restorationErrors();

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
  @service declare router: RouterService;

  @tracked isInitializing = true;

  get workflowPersistenceId() {
    return this.router.currentRoute.queryParams['flow-id']!;
  }

  @cached
  get workflow() {
    return new WithdrawalWorkflow(getOwner(this), this.workflowPersistenceId);
  }

  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.restore();
  }

  async restore() {
    await this.workflow.restore();
    this.isInitializing = false;
  }

  @action onDisconnect() {
    this.workflow?.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}
