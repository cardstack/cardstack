import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
import { Router } from '@ember/routing';

export default class ViewCardController extends Controller {
  @service router!: Router;
  @service cardstackSession!: CardstackSession;
}
