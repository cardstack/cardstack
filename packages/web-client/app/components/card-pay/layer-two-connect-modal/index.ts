import Component from '@glimmer/component';
import Layer2Network from '../../../services/layer2-network';
import { inject as service } from '@ember/service';
import CardstackLogo from '../../../images/icons/cardstack-logo-opaque-efefef-bg.svg';
import CardstackMobileAppIcon from '../../../images/icons/cardstack-mobile-app-icon.svg';
import AppStoreBadge from '../../../images/icons/download-on-the-app-store-badge.svg';
import GooglePlayBadge from '../../../images/icons/google-play-badge.png';
import config from '@cardstack/web-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';

interface CardPayLayerTwoConnectModalComponentArgs {
  onClose: () => void;
}

class CardPayLayerTwoConnectModalComponent extends Component<CardPayLayerTwoConnectModalComponentArgs> {
  @service declare layer2Network: Layer2Network;
  cardstackLogo = CardstackLogo;
  cardstackMobileAppIcon = CardstackMobileAppIcon;
  appStoreBadge = AppStoreBadge;
  googlePlayBadge = GooglePlayBadge;
  appStoreUrl = config.urls.appStoreLink;
  googlePlayUrl = config.urls.googlePlayLink;
  constructor(owner: unknown, args: CardPayLayerTwoConnectModalComponentArgs) {
    super(owner, args);
    taskFor(this.closeOnConnectedTask).perform();
  }
  @task *closeOnConnectedTask() {
    yield this.layer2Network.waitForAccount;
    this.args.onClose();
  }
}

export default CardPayLayerTwoConnectModalComponent;
