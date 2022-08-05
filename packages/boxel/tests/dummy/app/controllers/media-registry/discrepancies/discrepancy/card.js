import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaRegistryDiscrepanciesDiscrepancyCardController extends Controller {
  omittedFields = ['verifi_id'];
  fieldsNotRendered = [
    'id',
    'type',
    'status',
    'new',
    'version',
    'fields',
    'modifiedCount',
    'component',
    'expandable',
  ];

  @service router;

  @action
  drillDown(field, value) {
    let innerCardType = field.title;
    let innerCardId = value.id || value.value[0].id;

    this.router.transitionTo(
      'media-registry.discrepancies.discrepancy.card.card',
      innerCardType,
      innerCardId
    );
  }
}
