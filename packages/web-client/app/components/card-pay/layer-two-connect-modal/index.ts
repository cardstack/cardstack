import Component from '@glimmer/component';
import Layer2Network from '../../../services/layer2-network';
import { inject as service } from '@ember/service';

class CardPayLayerTwoConnectModalComponent extends Component {
  @service declare layer2Network: Layer2Network;
}

export default CardPayLayerTwoConnectModalComponent;
