import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

class CardPayBalancesController extends Controller {
  @tracked isShowingDepositWorkflow = false;
}

export default CardPayBalancesController;
