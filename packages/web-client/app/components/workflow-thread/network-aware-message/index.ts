import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';

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
    let layer1Network = postable.workflow?.owner.lookup(
      'service:layer1-network'
    ) as Layer1Network;
    return layer1Network;
  }

  get hasLayer1Account() {
    return this.layer1Network.isConnected;
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

  get layer1NativeTokenBalance() {
    return this.layer1Network.defaultTokenBalance;
  }
}
