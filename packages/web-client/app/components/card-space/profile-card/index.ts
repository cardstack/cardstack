import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';

class CreateSpaceProfileCardComponent extends Component {
  cardSpaceHostnameSuffix = config.cardSpaceHostnameSuffix;
}

export default CreateSpaceProfileCardComponent;
