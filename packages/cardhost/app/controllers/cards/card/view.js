import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class ViewCardController extends Controller {
  @service router;
  @service cardstackSession;
}
