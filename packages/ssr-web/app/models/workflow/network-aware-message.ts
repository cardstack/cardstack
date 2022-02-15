import Layer1Network from '@cardstack/ssr-web/services/layer1-network';
import Layer2Network from '@cardstack/ssr-web/services/layer1-network';
import HubAuthentication from '@cardstack/ssr-web/services/hub-authentication';
import { getOwner } from '@ember/application';
import { Participant, WorkflowPostable } from './workflow-postable';
import { WorkflowMessage } from './workflow-message';

interface NetworkAwareWorkflowMessageOptions {
  author: Participant;
  message: string;
  includeIf: (this: NetworkAwareWorkflowMessage) => boolean;
}

export default class NetworkAwareWorkflowMessage extends WorkflowMessage {
  constructor(options: Partial<NetworkAwareWorkflowMessageOptions>) {
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

  get layer1NativeTokenBalance() {
    return this.layer1Network.defaultTokenBalance;
  }
}
