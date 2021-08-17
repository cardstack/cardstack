import Component from '@glimmer/component';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import { Workflow, cardbot } from '@cardstack/web-client/models/workflow';
import { Milestone } from '@cardstack/web-client/models/workflow/milestone';
import { WorkflowCard } from '@cardstack/web-client/models/workflow/workflow-card';
import PostableCollection from '@cardstack/web-client/models/workflow/postable-collection';
import NetworkAwareWorkflowCard from '@cardstack/web-client/components/workflow-thread/network-aware-card';
import NetworkAwareWorkflowMessage from '@cardstack/web-client/components/workflow-thread/network-aware-message';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';

import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

const FAILURE_REASONS = {
  DISCONNECTED: 'DISCONNECTED',
  ACCOUNT_CHANGED: 'ACCOUNT_CHANGED',
} as const;

class CreateMerchantWorkflow extends Workflow {
  name = 'Merchant Creation';
  milestones = [
    new Milestone({
      title: `Connect ${c.layer2.fullName} wallet`,
      postables: [
        new WorkflowMessage({
          author: cardbot,
          message: `Hello, nice to see you!`,
        }),
        new WorkflowMessage({
          author: cardbot,
          message: `To receive payment through Card Pay, you need to create a merchant account.
          All you need is to choose a name for your merchant account and sign a transaction to create your merchant on the ${c.layer2.fullName}.`,
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
          message: `Once you have installed the app, open the app and add an existing wallet/account or create a new account. Scan this QR code with your account, which will connect your account with Cardstack.`,
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
      title: 'Create merchant account',
      postables: [
        new NetworkAwareWorkflowMessage({
          author: cardbot,
          message: `To store data in the Cardstack Hub, you need to authenticate using your Card Wallet.
          You only need to do this once per browser/device.`,
          includeIf() {
            return !this.isHubAuthenticated;
          },
        }),
        new NetworkAwareWorkflowCard({
          author: cardbot,
          componentName: 'card-pay/hub-authentication',
          includeIf(this: NetworkAwareWorkflowCard) {
            return !this.isHubAuthenticated;
          },
        }),
        new WorkflowMessage({
          author: cardbot,
          message: 'Let’s create a new merchant account.',
        }),
        new WorkflowCard({
          author: cardbot,
          componentName:
            'card-pay/create-merchant-workflow/merchant-customization',
        }),
        new WorkflowCard({
          author: cardbot,
          componentName:
            'card-pay/create-merchant-workflow/prepaid-card-choice',
        }),
      ],
      completedDetail: 'Merchant created',
    }),
  ];
  epilogue = new PostableCollection([
    new WorkflowMessage({
      author: cardbot,
      message: `Congratulations! You have created a merchant.`,
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'card-pay/create-merchant-workflow/next-steps',
    }),
  ]);
  cancelationMessages = new PostableCollection([
    // if we disconnect from layer 2
    new WorkflowMessage({
      author: cardbot,
      message: `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a merchant, please start again by connecting your wallet.`,
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
    // cancelation for changing accounts
    new WorkflowMessage({
      author: cardbot,
      message:
        'It looks like you changed accounts in the middle of this workflow. If you still want to create a merchant, please restart the workflow.',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
    new WorkflowCard({
      author: cardbot,
      componentName: 'workflow-thread/default-cancelation-cta',
      includeIf() {
        return (
          this.workflow?.cancelationReason === FAILURE_REASONS.ACCOUNT_CHANGED
        );
      },
    }),
  ]);

  constructor(owner: unknown) {
    super(owner);
    this.attachWorkflow();
  }
}

class CreateMerchantWorkflowComponent extends Component {
  @service declare layer2Network: Layer2Network;

  workflow!: CreateMerchantWorkflow;
  constructor(owner: unknown, args: {}) {
    super(owner, args);
    this.workflow = new CreateMerchantWorkflow(getOwner(this));
  }

  @action onDisconnect() {
    this.workflow.cancel(FAILURE_REASONS.DISCONNECTED);
  }

  @action onAccountChanged() {
    this.workflow.cancel(FAILURE_REASONS.ACCOUNT_CHANGED);
  }
}

export default CreateMerchantWorkflowComponent;
