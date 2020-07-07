import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MediaRegistryAgreementsController extends Controller {
  @tracked status;

  @action
  viewAgreement() {
    this.status = 'view';
  }

  @action
  rejectAgreement() {
    this.transitionToRoute('media-registry.collection', 'batch-f');
  }

  @action
  createAgreement() {
    this.status = 'create';
  }

  @action
  completeAgreement() {
    this.status = 'complete';
  }

  createCatalogFields = [
    {
      title: 'Assigner',
      value: [
        'Bunny Records'
      ]
    },
    {
      title: 'Assignee',
      value: [
        'CRD Records'
      ]
    },
    {
      title: 'Catalog',
      type: 'card',
      format: 'grid',
      component: 'cards/master-collection',
      value: {
        id: 'catalog-card',
        type: 'catalog',
        title: 'Batch F',
        catalog_title: 'Batch F',
        catalog_description: 'Transfer to CRD Records',
        number_of_songs: 16,
        selected_art: [
          "media-registry/covers/thumb/Sunlight.jpg",
          "media-registry/covers/thumb/Change-Is-Good.jpg",
          "media-registry/covers/thumb/Full-Moon.jpg",
          "media-registry/covers/thumb/Love-Never-Dies.jpg",
          "media-registry/covers/thumb/Animals.jpg"
        ]
      }
    }
  ]
}
