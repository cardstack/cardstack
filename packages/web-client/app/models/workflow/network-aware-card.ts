import {
  WorkflowCard,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';
import { strongGetOwner as getOwner } from '@cardstack/web-client/utils/owner';

/**
 * Documentation on the Typescript stuff is in {@link WorkflowCard}
 */
export default class NetworkAwareWorkflowCard<
  T extends string = string
> extends WorkflowCard<T> {
  get layer1Network() {
    let postable = this as WorkflowPostable;
    let layer1Network = getOwner(postable.workflow).lookup(
      'service:layer1-network'
    );
    return layer1Network;
  }

  get hasLayer1Account() {
    return this.layer1Network.isConnected;
  }

  get hasLayer2Account() {
    let postable = this as WorkflowPostable;
    let layer2Network = getOwner(postable.workflow).lookup(
      'service:layer2-network'
    );
    return layer2Network.isConnected;
  }

  get isHubAuthenticated() {
    let postable = this as WorkflowPostable;
    let hubAuthentication = getOwner(postable.workflow).lookup(
      'service:hub-authentication'
    );
    return hubAuthentication.isAuthenticated;
  }
}
