import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

class CardPayBalancesController extends Controller {
  queryParams = ['flow'];
  @tracked flow: 'deposit' | null = null;
}

export default CardPayBalancesController;
