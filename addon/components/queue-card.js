import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class QueueCardComponent extends Component {
  @service router;

  get progress() {
    switch(this.args.card.progressPct) {
      case (20):
        return {
          status: 'proposal',
          icon: '/media-registry/progress-pie/progress-20pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-20pct.svg'
        }
      case (40):
        return {
          status: 'under-review',
          icon: '/media-registry/progress-pie/progress-40pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-40pct.svg'
        }
      case (60):
        return {
          status: 'under-review',
          icon: '/media-registry/progress-pie/progress-40pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-40pct.svg'
        }
      case (80):
        return {
          status: 'redeliver',
          icon: '/media-registry/progress-pie/progress-80pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-80pct.svg'
        }
      case (100):
        return {
          status: 'complete',
          icon: '/media-registry/progress-pie/progress-100pct.svg',
          iconOpen: '/media-registry/progress-pie/progress-100pct.svg'
        }
      default:
        return {
          status: 'not started',
          icon: '/media-registry/progress-pie/progress-circle-dark.svg',
          iconOpen: '/assets/images/icons/progress-circle.svg'
        }
    }
  }

  @action
  openThread() {
    this.router.transitionTo('media-registry.cardflow');
  }
}
