import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';

export default class CardSpaceUserPage extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @service declare layer2Network: Layer2Network;
  @service declare hubAuthentication: HubAuthentication;
  @tracked mode: 'view' | 'edit' = 'view';

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.layer2Network.on('disconnect', () => (this.mode = 'view'));
  }

  get isOwner() {
    return (
      this.layer2Network.isConnected &&
      this.cardSpaceUserData.currentUserData.ownerAddress ===
        this.layer2Network.walletInfo.firstAddress
    );
  }

  get isAuthenticated() {
    return this.hubAuthentication.isAuthenticated;
  }

  get editable() {
    return this.isOwner && this.isAuthenticated && this.mode === 'edit';
  }

  @action switchMode() {
    this.mode = this.mode === 'view' ? 'edit' : 'view';
  }
}
