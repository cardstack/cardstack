import CardstackController from '../cardstack';
import { inject as service } from '@ember/service';

export default class CardstackIndexController extends CardstackController {
  @service('cardstack-session') cardstackSession;
}
