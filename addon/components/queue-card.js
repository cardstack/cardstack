import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

export default class QueueCardComponent extends Component {
  @service router;

  get progress() {
    switch(this.args.card.progressPct) {
      case (20):
        return {
          status: 'proposal',
          icon: '/media-registry/progress-pie/progress-20pct.svg'
        }
      case (40):
        return {
          status: 'under-review',
          icon: '/media-registry/progress-pie/progress-40pct-dark.svg'
        }
      case (60):
        return {
          status: 'under-review',
          icon: '/media-registry/progress-pie/progress-40pct-dark.svg'
        }
      case (80):
        return {
          status: 'redeliver',
          icon: '/media-registry/progress-pie/progress-80pct.svg'
        }
        case (100):
          return {
            status: 'complete',
            icon: '/media-registry/progress-pie/progress-80pct.svg'
          }
      default:
        return {
          status: 'not started',
          icon: '/assets/images/icons/progress-circle.svg'
        }
    }
  }

  @action
  openThread(card) {
    set(card, "status", "open");
    this.router.transitionTo('media-registry.cardflow');
  }
}
