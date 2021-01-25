import Controller from '@ember/controller';
import { action } from '@ember/object';

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

  @action
  drillDown(field, value) {
    let cardType = field.title;
    let cardId = value.id;
    this.transitionToRoute(
      'media-registry.discrepancies.discrepancy.card',
      cardType,
      cardId
    );
  }
}
