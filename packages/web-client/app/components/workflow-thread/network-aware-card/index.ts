import {
  CheckResult,
  WorkflowCard,
} from '@cardstack/web-client/models/workflow/workflow-card';
import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';

interface NetworkAwareWorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf(this: NetworkAwareWorkflowCard): boolean;
  check(this: NetworkAwareWorkflowCard): Promise<CheckResult>;
}

export default class NetworkAwareWorkflowCard extends WorkflowCard {
  constructor(options: Partial<NetworkAwareWorkflowCardOptions>) {
    super(options);
  }

  get hasLayer1Account() {
    let postable = this as WorkflowPostable;
    let layer1Network = postable.workflow?.owner.lookup(
      'service:layer1-network'
    ) as Layer1Network;
    return layer1Network.isConnected;
  }

  get hasLayer2Account() {
    let postable = this as WorkflowPostable;
    let layer2Network = postable.workflow?.owner.lookup(
      'service:layer2-network'
    ) as Layer2Network;
    return layer2Network.isConnected;
  }

  get isHubAuthenticated() {
    let postable = this as WorkflowPostable;
    let hubAuthentication = postable.workflow?.owner.lookup(
      'service:hub-authentication'
    ) as HubAuthentication;
    return hubAuthentication.isAuthenticated;
  }
}
