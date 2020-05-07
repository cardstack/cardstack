import Controller from '@ember/controller';

export default class MediaRegistryItemController extends Controller {
  get catalogs() {
    return this.model.catalog.split(',');
  }
}
