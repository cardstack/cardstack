import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import OverlaysService from '../services/overlays';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { recentOnly } = ENV;

export default class ApplicationController extends Controller {
  @service overlays!: OverlaysService;
  @service cardLocalStorage: any;

  constructor() {
    super(...arguments);
    if (recentOnly) {
      // If recentOnly env is true, associate cards with a semi-random
      // string saved in local storage, so that test users only see
      // their own cards.
      this.cardLocalStorage.setDevice();
    }
  }
}
