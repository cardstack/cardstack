import Component from '@glimmer/component';
import Layer2Network from '../../../services/layer2-network';
import CardstackLogoForQR from '../../../images/icons/cardstack-logo-opaque-bg.svg';
import CardstackLogo from '../../../images/icons/cardstack.svg';
import CardstackMobileAppPhone from '../../../images/cardstack-mobile-app-phone.png';
import CardstackMobileAppPhone2x from '../../../images/cardstack-mobile-app-phone@2x.png';
import AppStoreBadge from '../../../images/icons/download-on-the-app-store-badge.svg';
import GooglePlayBadge from '../../../images/icons/google-play-badge.png';
import config from '@cardstack/web-client/config/environment';
import { inject as service } from '@ember/service';
import { reads } from 'macro-decorators';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { next } from '@ember/runloop';
import { timeout } from 'ember-concurrency';
import { action } from '@ember/object';

interface CardPayLayerTwoConnectCardComponentArgs {
  onComplete: (() => void) | undefined;
  onConnect: (() => void) | undefined;
  onDisconnect: (() => void) | undefined;
  isComplete: boolean;
}

class CardPayLayerTwoConnectCardComponent extends Component<CardPayLayerTwoConnectCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  cardstackLogoForQR = CardstackLogoForQR;
  cardstackLogo = CardstackLogo;
  cardstackMobileAppPhone = CardstackMobileAppPhone;
  cardstackMobileAppPhone2x = CardstackMobileAppPhone2x;
  appStoreBadge = AppStoreBadge;
  googlePlayBadge = GooglePlayBadge;
  appStoreUrl = config.urls.appStoreLink;
  googlePlayUrl = config.urls.googlePlayLink;

  @reads('layer2Network.isConnected') declare isConnected: boolean;
  constructor(owner: unknown, args: CardPayLayerTwoConnectCardComponentArgs) {
    super(owner, args);
    if (this.isConnected) {
      next(this, () => {
        this.args.onComplete?.();
      });
    }
    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }

  get hasBalance() {
    return (
      this.layer2Network.defaultTokenBalance &&
      !this.layer2Network.defaultTokenBalance.isZero()
    );
  }

  @task *connectWalletTask() {
    yield this.layer2Network.waitForAccount;
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection
    if (this.isConnected) {
      this.args.onConnect?.();
      this.args.onComplete?.();
    }
  }

  @action disconnect() {
    this.layer2Network.disconnect();
  }

  @action onDisconnect() {
    this.args.onDisconnect?.();
    taskFor(this.connectWalletTask).perform();
  }

  get cardState(): string {
    if (this.isConnected) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
}

export default CardPayLayerTwoConnectCardComponent;
