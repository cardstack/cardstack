import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MediaRegistryAgreementsController extends Controller {
  @tracked status;
  @tracked org = this.model.org;
  @tracked catalog = this.model.collection;
  @tracked agreement = this.model.agreement;

  get agreementFields() {
    if (!this.model) { return null; }
    return [
      {
        title: 'Assigner',
        value: [ this.agreement.from ]
      },
      {
        title: 'Assignee',
        value: [ this.agreement.to ]
      },
      {
        title: 'Catalog',
        type: 'card',
        format: 'grid',
        component: 'cards/master-collection',
        value: this.catalog
      }
    ];
  }

  @action
  viewAgreement() {
    this.status = 'view';
  }

  @action
  rejectAgreement() {
    this.transitionToRoute('media-registry.collection', 'bunny_records', this.catalog.id);
  }

  @action
  createAgreement() {
    this.status = 'create';
  }

  @action
  completeAgreement() {
    this.status = 'complete';
  }

  @action
  expandAction() {
    this.transitionToRoute('media-registry.collection', 'bunny_records', this.catalog.id);
  }
}
