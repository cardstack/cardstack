import config from '@cardstack/web-client/config/environment';
import Component from '@glimmer/component';

export default class NetworkProblemModalComponent extends Component {
  get mailToSupportUrl() {
    return config.urls.mailToSupportUrl;
  }
}
