/* eslint-disable ember/no-side-effects */

import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MediaRegistryVersionController extends Controller {
  queryParams = ['version'];
  @tracked version = this.model ? this.model.version : null;

  get item() {
    let masterDetail = this.model;
    if (masterDetail.version) {
      this.version = masterDetail.version;
    }
    return masterDetail;
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.version', this.model.id);
  }

  @action
  transitionToCatalog(id) {
    this.transitionToRoute('media-registry.collection', id, {
      queryParams: { version: this.model.version },
    });
  }
}
