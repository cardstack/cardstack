import Route from '@ember/routing/route';
import DISCREPANCIES from 'dummy/data/discrepancies-list';

export default class MediaRegistryDiscrepanciesDiscrepancyRoute extends Route {
  model({ compId }) {
    return DISCREPANCIES.find(el => el.id === compId);
  }
}
