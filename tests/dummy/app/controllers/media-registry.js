import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import METADATASTEPS from 'dummy/data/amend-metadata-steps';
import MILESTONES from 'dummy/data/catalog-transfer-workflow';

export default class MediaRegistryController extends Controller {
  @tracked org = this.model;
  @tracked actionSteps = METADATASTEPS;
  @tracked milestones = MILESTONES;

  get latestMilestone() {
    let milestone =  this.milestones.filter(el => el.current)[0];
    if (!milestone) {
      return this.milestones[1];
    }
    return milestone;
  }

  @action
  setOrg(val) {
    if (this.org.id === val.id) { return; }
    this.org = val;
  }

  @action
  transition(id) {
    let { currentRouteName } = this.target;

    if (this.model.id !== id) {
      if (currentRouteName === 'media-registry.agreements' || currentRouteName === 'media-registry.cardflow') {
        return this.transitionToRoute(currentRouteName, id);
      }
    }

    this.transitionToRoute('media-registry', id);
  }
}
