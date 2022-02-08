import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';

class CardWalletBadges extends Component {
  appStoreLink = config.urls.appStoreLink;
  googlePlayLink = config.urls.googlePlayLink;
}

export default CardWalletBadges;
