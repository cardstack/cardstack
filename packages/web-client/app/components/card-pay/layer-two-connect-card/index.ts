import Component from '@glimmer/component';
import Layer2Network from '../../../services/layer2-network';
import CardstackLogo from '../../../images/icons/cardstack-logo-opaque-efefef-bg.svg';
import CardstackMobileAppIcon from '../../../images/icons/cardstack-mobile-app-icon.svg';
import AppStoreBadge from '../../../images/icons/download-on-the-app-store-badge.svg';
import GooglePlayBadge from '../../../images/icons/google-play-badge.png';
import config from '@cardstack/web-client/config/environment';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';

interface CardPayLayerTwoConnectCardComponentArgs {
  onComplete: (() => void) | undefined;
}

class CardPayLayerTwoConnectCardComponent extends Component<CardPayLayerTwoConnectCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  cardstackLogo = CardstackLogo;
  cardstackMobileAppIcon = CardstackMobileAppIcon;
  appStoreBadge = AppStoreBadge;
  googlePlayBadge = GooglePlayBadge;
  appStoreUrl = config.urls.appStoreLink;
  googlePlayUrl = config.urls.googlePlayLink;

  @reads('layer2Network.hasAccount') declare hasAccount: boolean;
  @tracked isWaitingForConnection = false;
  constructor(owner: unknown, args: CardPayLayerTwoConnectCardComponentArgs) {
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

export default CardPayLayerTwoConnectCardComponent;
