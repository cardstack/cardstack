import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import * as short from 'short-uuid';

class CardPayBalancesController extends Controller {
  @service declare layer2Network: Layer2Network;

  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];
  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;

  get prepaidCards() {
    return this.layer2Network.safes.value?.filterBy('type', 'prepaid-card');
  }

  @action setFlow(flow: string) {
    this.flow = flow;
    this.workflowPersistenceId = short.generate();
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }
}

export default CardPayBalancesController;
