import {
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow/workflow-postable';
import { WorkflowMessage } from '@cardstack/web-client/models/workflow/workflow-message';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';

interface NetworkAwareWorkflowMessageOptions {
  author: Participant;
  message: string;
  includeIf: (this: NetworkAwareWorkflowMessage) => boolean;
}

export default class NetworkAwareWorkflowMessage extends WorkflowMessage {
  constructor(options: Partial<NetworkAwareWorkflowMessageOptions>) {
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
}
