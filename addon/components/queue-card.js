import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class QueueCardComponent extends Component {
  @service router;

  get participants() {
    let participants = this.args.card.participants;
    let max = 2;

    if (!participants) { return null; }

    if (participants.length > max) {
      let remaining = participants.length - max;
      return `${participants[0]}, ${participants[1]}, +${remaining} more`;
    }

    return participants.toString().replace(',', ', ');
  }

  get progress() {
    let progressPct = Number(this.args?.currentMilestone?.pct) || Number(this.args.card.progressPct);
    let progressStatus = this.args.card.currentMilestone || null;

    switch(progressPct) {
      case (0):
        return {
          status: progressStatus || 'not started',
          icon: '/media-registry/progress-pie/progress-circle-dark.svg',
          iconOpen: '/assets/images/icons/progress-circle.svg'
        }
      case (20):
        return {
          status: progressStatus || 'proposal',
          icon: '/media-registry/progress-pie/progress-20pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-20pct.svg'
        }
      case (40):
        return {
          status: progressStatus || 'under-review',
          icon: '/media-registry/progress-pie/progress-40pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-40pct.svg'
        }
      case (60):
        return {
          status: progressStatus || 'transfer-accepted',
          icon: '/media-registry/progress-pie/progress-60pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-60pct.svg'
        }
      case (80):
        return {
          status: progressStatus || 'redeliver',
          icon: '/media-registry/progress-pie/progress-80pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-80pct.svg'
        }
      case (100):
        return {
          status: progressStatus || 'complete',
          icon: '/media-registry/progress-pie/progress-100pct-dark.svg',
          iconOpen: '/media-registry/progress-pie/progress-100pct.svg'
        }
      default:
        return null;
    }
  }

  @action
  openThread() {
    let pct = Number(this.args?.currentMilestone?.pct) || Number(this.args.card.progressPct);
    if (this.args.updateProgress && pct === 20 && this.args.orgId === 'crd_records') {
      // when steve opens the thread for the first time, thread should get to 40% completion
      this.args.updateProgress(40);
    }
    this.router.transitionTo('media-registry.cardflow', this.args.orgId);
  }
}
