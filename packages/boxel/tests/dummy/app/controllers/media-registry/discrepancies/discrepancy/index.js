import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaRegistryDiscrepanciesDiscrepancyController extends Controller {
  omittedFields = ['verifi_id'];
  fieldsNotRendered = [
    'id',
    'type',
    'status',
    'new',
    'version',
    'modifiedCount',
    'component',
    'expandable',
  ];

  @service router;

  @action
  drillDown(field, value) {
    let cardType = field.title;
    let cardId = value.id;
    this.router.transitionTo(
      'media-registry.discrepancies.discrepancy.card',
      cardType,
      cardId
    );
  }
}
