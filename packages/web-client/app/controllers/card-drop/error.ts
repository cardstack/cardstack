import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

class CardDropErrorController extends Controller {
  queryParams = ['message'];
  @tracked message: string = 'An unknown error occurred.';
}

export default CardDropErrorController;
