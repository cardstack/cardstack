import MediaRegistryDiscrepanciesDiscrepancyCardController from '../card';
import { action } from '@ember/object';

export default class MediaRegistryDiscrepanciesDiscrepancyCardCardController extends MediaRegistryDiscrepanciesDiscrepancyCardController {
  @action
  drillDown(field, value) {
    let innerCardCardType = field.title;
    let innerCardCardId = value.id || value.value[0].id;

    this.transitionToRoute(
      'media-registry.discrepancies.discrepancy.card.card.card',
      innerCardCardType,
      innerCardCardId
    );
  }
}
