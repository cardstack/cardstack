import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';

export default class CardPayErrorMessageComponent extends Component {
  mailToSupportUrl = config.urls.mailToSupportUrl;
}
