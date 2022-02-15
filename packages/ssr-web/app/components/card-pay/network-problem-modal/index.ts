import config from '@cardstack/ssr-web/config/environment';
import Component from '@glimmer/component';

export default class NetworkProblemModalComponent extends Component {
  get mailToSupportUrl() {
    return config.urls.mailToSupportUrl;
  }
}
