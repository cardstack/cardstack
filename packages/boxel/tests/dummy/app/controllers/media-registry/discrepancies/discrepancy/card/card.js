import MediaRegistryDiscrepanciesDiscrepancyCardController from '../card';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaRegistryDiscrepanciesDiscrepancyCardCardController extends MediaRegistryDiscrepanciesDiscrepancyCardController {
  @service router;

  @action
  drillDown(field, value) {
    let innerCardCardType = field.title;
    let innerCardCardId = value.id || value.value[0].id;

    this.router.transitionTo(
      'media-registry.discrepancies.discrepancy.card.card.card',
      innerCardCardType,
      innerCardCardId
    );
  }
}
