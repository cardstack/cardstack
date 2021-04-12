import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import CardstackLogo from '../../../../images/icons/cardstack-logo-opaque-efefef-bg.svg';

interface CardPayDepositWorkflowConnectLayer2ComponentArgs {
  onComplete: (() => void) | undefined;
}
class CardPayDepositWorkflowConnectLayer2Component extends Component<CardPayDepositWorkflowConnectLayer2ComponentArgs> {
  cardstackLogo = CardstackLogo;
  @service declare layer2Network: Layer2Network;
  @reads('layer2Network.hasAccount') declare hasAccount: boolean;
  @tracked isWaitingForConnection = false;
  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowConnectLayer2ComponentArgs
  ) {
    super(owner, args);
    if (!this.hasAccount) {
      taskFor(this.connectWalletTask).perform();
    }
  }
  @task *connectWalletTask() {
    this.isWaitingForConnection = true;
    yield this.layer2Network.waitForAccount;
    this.isWaitingForConnection = false;
    this.args.onComplete?.();
  }
}

export default CardPayDepositWorkflowConnectLayer2Component;
