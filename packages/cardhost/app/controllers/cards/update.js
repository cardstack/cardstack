import Controller from '@ember/controller';
import { action } from '@ember/object';
export default class UpdateCardController extends Controller {
  @action
  cardUpdated() {
    this.send('refreshCard');
  }
}