import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import RouterService from '@ember/routing/router-service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  cardbot,
  Milestone,
  NetworkAwareWorkflowCard,
  NetworkAwareWorkflowMessage,
  PostableCollection,
  Workflow,
  WorkflowCard,
  WorkflowMessage,
  WorkflowName,
} from '@cardstack/web-client/models/workflow';

const FAILURE_REASONS = {
  L2_DISCONNECTED: 'L2_DISCONNECTED',
  L2_ACCOUNT_CHANGED: 'L2_ACCOUNT_CHANGED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  RESTORATION_L2_DISCONNECTED: 'RESTORATION_L2_DISCONNECTED',
  RESTORATION_L2_ACCOUNT_CHANGED: 'RESTORATION_L2_ACCOUNT_CHANGED',
  RESTORATION_UNAUTHENTICATED: 'RESTORATION_UNAUTHENTICATED',
} as const;

export const MILESTONE_TITLES = [
  `Connect ${c.layer2.conversationalName} wallet`,
  `Pick username`,
  `Save Card Space details`,
  `Create Card Space`,
];

class CreateSpaceWorkflow extends Workflow {
  @service declare router: RouterService;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;

  name = 'CARD_SPACE_CREATION' as WorkflowName;

  milestones = [
    new Milestone({
      title: MILESTONE_TITLES[0],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Hello, welcome to Card Space, we're happy to see you!`,
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
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new account. Scan this QR code with your account, which will connect it with Card Space.`,
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
      completedDetail: `${c.layer2.fullName} wallet connected`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[1],
      postables: [
        // TODO
        // new WorkflowMessage({
        //   author: cardbot,
        //   message: `It looks like you don’t have a prepaid card in your account. You will need one to pay the **100 SPEND ($1 USD)** Card Space creation fee. Please buy a prepaid card before you continue with this workflow.`,
        // }),
        // TODO
        // new WorkflowCard({
        //   author: cardbot,
        //   cardName: 'PREPAID_CARD_PURCHASE_INSTRUCTIONS',
        //   componentName: 'card-pay/prepaid-card-purchase-instructions',
        // }),
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `To store data in the Cardstack Hub, you need to authenticate using your Card Wallet.
          You only need to do this once per browser/device.`,
          includeIf() {
            return !this.isHubAuthenticated;
          },
        }),
        new NetworkAwareWorkflowCard({
          cardName: 'HUB_AUTH',
          author: cardbot,
          componentName: 'card-pay/hub-authentication',
          includeIf(this: NetworkAwareWorkflowCard) {
            return !this.isHubAuthenticated;
          },
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `Please pick a username for your account. This is the name that will be shown to others when you communicate with them. If you like, you can upload a profile picture too.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CARD_SPACE_USERNAME',
          componentName: 'card-space/create-space-workflow/username',
        }),
      ],
      completedDetail: `Username picked`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[2],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Nice choice!`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `Now it's time to set up your space. The preview shows you how your space will be displayed to users who visit the Card Space org.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CARD_SPACE_DETAILS',
          componentName: 'card-space/create-space-workflow/details',
        }),
      ],
      completedDetail: `Card Space details saved`,
    }),
    new Milestone({
      title: MILESTONE_TITLES[3],
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `We have sent your URL reservation badge to your connected account (just check your Card Wallet mobile app).`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CARD_SPACE_BADGE',
          componentName: 'card-space/create-space-workflow/badge',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `On to the next step: You need to pay a small protocol fee to create your Card Space. Please select a prepaid card with a spendable balance from your ${c.layer2.fullName} wallet.`,
        }),
        new WorkflowCard({
          author: cardbot,
          cardName: 'CARD_SPACE_CONFIRM',
          componentName: 'card-space/create-space-workflow/confirm',
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `Thank you for your payment.`,
        }),
      ],
      completedDetail: 'Card Space created',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `This is the remaining balance on your prepaid card:`,
    }),
    // TODO
    // new WorkflowCard({
    //   author: cardbot,
    //   cardName: 'EPILOGUE_PREPAID_CARD_BALANCE',
    //   componentName: 'card-pay/prepaid-card-balance',
    // }),
    new WorkflowMessage({
      author: cardbot,
      message: `Congrats, you have created your Card Space!`,
    }),
    new WorkflowCard({
      cardName: 'EPILOGUE_NEXT_STEPS',
      author: cardbot,
      componentName: 'card-space/create-space-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    new WorkflowMessage({
      author: cardbot,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a Card Space, please start again by connecting your wallet.`,
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.L2_DISCONNECTED
        );
      },
    }),
    // cancelation for changing accounts
    new WorkflowMessage({
      author: cardbot,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a Card Space, please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.L2_ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message: 'You are no longer authenticated. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.UNAUTHENTICATED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_UNAUTHENTICATED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but you changed your Card Wallet address. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowMessage({
      author: cardbot,
      message:
        'You attempted to restore an unfinished workflow, but your Card Wallet got disconnected. Please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason ===
          FAILURE_REASONS.RESTORATION_L2_DISCONNECTED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          [
            FAILURE_REASONS.L2_DISCONNECTED,
            FAILURE_REASONS.L2_ACCOUNT_CHANGED,
            FAILURE_REASONS.UNAUTHENTICATED,
            FAILURE_REASONS.RESTORATION_L2_DISCONNECTED,
            FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED,
            FAILURE_REASONS.RESTORATION_UNAUTHENTICATED,
          ] as String[]
        ).includes(String(this.workflow?.cancelationReason));
      },
    }),
  ]);

  constructor(owner: unknown, workflowPersistenceId?: string) {
    super(owner, workflowPersistenceId);
    this.attachWorkflow();
  }

  restorationErrors() {
    let { hubAuthentication, layer2Network } = this;

    let errors = [];

    if (!hubAuthentication.isAuthenticated) {
      errors.push(FAILURE_REASONS.RESTORATION_UNAUTHENTICATED);
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
      errors.push(FAILURE_REASONS.RESTORATION_L2_ACCOUNT_CHANGED);
    }

    return errors;
  }

  beforeRestorationChecks() {
    return [];
  }
}

class CreateSpaceWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;
  @service declare workflowPersistence: WorkflowPersistence;
  @service declare router: RouterService;

  @tracked workflow: CreateSpaceWorkflow | null = null;

  constructor(owner: unknown, args: {}) {
    super(owner, args);

    let workflowPersistenceId =
      this.router.currentRoute.queryParams['flow-id']!;

    let workflow = new CreateSpaceWorkflow(
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
    this.workflow?.cancel(FAILURE_REASONS.L2_DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow?.cancel(FAILURE_REASONS.L2_ACCOUNT_CHANGED);
  }
}

export default CreateSpaceWorkflowComponent;
