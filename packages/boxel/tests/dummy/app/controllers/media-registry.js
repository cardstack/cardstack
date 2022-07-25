import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import METADATASTEPS from '../data/amend-metadata-steps';
import MILESTONES from '../data/catalog-transfer-workflow';

export default class MediaRegistryController extends Controller {
  @service router;

  @tracked actionSteps = METADATASTEPS;
  @tracked milestones = MILESTONES;

  get latestMilestone() {
    let milestone = this.milestones.filter((el) => el.current)[0];
    if (!milestone) {
      return this.milestones[1];
    }
    return milestone;
  }

  @action
  transition(id) {
    let { currentRouteName } = this.target;

    if (this.model.currentOrg.id !== id) {
      if (currentRouteName === 'media-registry.agreements') {
        return this.router.transitionTo(
          'media-registry.agreements',
          id,
          'TA-38185847898'
        );
      }

      if (currentRouteName === 'media-registry.cardflow') {
        return this.router.transitionTo('media-registry.cardflow', id);
      }
    }

    this.router.transitionTo('media-registry', id);
  }

  @action
  goHome() {
    this.router.transitionTo('media-registry.index', this.model.orgs[0].id);
  }
}
