import {
  CheckResult,
  WorkflowCard,
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { getOwner } from '@ember/application';

interface NetworkAwareWorkflowCardOptions {
  cardName?: string;
  cardDisplayName: string;
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf(this: NetworkAwareWorkflowCard): boolean;
  check(this: NetworkAwareWorkflowCard): Promise<CheckResult>;
}

export default class NetworkAwareWorkflowCard extends WorkflowCard {
  constructor(options: Partial<NetworkAwareWorkflowCardOptions>) {
    super(options);
  }

  get layer1Network() {
    let postable = this as WorkflowPostable;
    let layer1Network = getOwner(postable.workflow).lookup(
      'service:layer1-network'
    ) as Layer1Network;
    return layer1Network;
  }

  get hasLayer1Account() {
    return this.layer1Network.isConnected;
  }

  get hasLayer2Account() {
    let postable = this as WorkflowPostable;
    let layer2Network = getOwner(postable.workflow).lookup(
      'service:layer2-network'
    ) as Layer2Network;
    return layer2Network.isConnected;
  }

  get isHubAuthenticated() {
    let postable = this as WorkflowPostable;
    let hubAuthentication = getOwner(postable.workflow).lookup(
      'service:hub-authentication'
    ) as HubAuthentication;
    return hubAuthentication.isAuthenticated;
  }
}
