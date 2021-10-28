import {
  WorkflowCard,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer1-network';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { getOwner } from '@ember/application';
import {
  CardConfiguration,
  ConfigurableWorkflowCardOptions,
  WorkflowCardOptions,
} from '@cardstack/web-client/models/workflow/workflow-card';

/**
 * Documentation on the Typescript stuff is in {@see {@link WorkflowCard}}
 */
export default class NetworkAwareWorkflowCard<
  T extends
    | ConfigurableWorkflowCardOptions
    | WorkflowCardOptions = WorkflowCardOptions
> extends WorkflowCard<T> {
  constructor(
    options: T extends ConfigurableWorkflowCardOptions
      ? T &
          (undefined extends CardConfiguration[T['componentName']]
            ? {
                config?: CardConfiguration[T['componentName']];
              }
            : { config: CardConfiguration[T['componentName']] })
      : never | WorkflowCardOptions
  ) {
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
