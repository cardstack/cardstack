import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { CardstackSession } from '../../../services/cardstack-session';
import RouterService from '@ember/routing/router-service';

export default class ViewCardController extends Controller {
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;
}
