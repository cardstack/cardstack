import Route from '@ember/routing/route';
import DISCREPANCIES from '../../../data/discrepancies-list';

export default class MediaRegistryDiscrepanciesIndexRoute extends Route {
  model() {
    return DISCREPANCIES;
  }
}
