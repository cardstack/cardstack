import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class EditCardController extends Controller {
  @service routeInfo!: { mode: string };
}
