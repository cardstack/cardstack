import config from '@cardstack/web-client/config/environment';
import { action } from '@ember/object';
import Component from '@glimmer/component';

export default class NetworkProblemModalComponent extends Component {
  @action openDiscord() {
    window.open(config.urls.discordSupportChannelUrl, '_blank');
  }
}
