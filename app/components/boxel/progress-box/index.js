import Component from '@glimmer/component';
import './style.css';

export default class ProgressBoxComponent extends Component {
  get percentComplete() {
    let totalMilestones = this.args.milestones
      ? this.args.milestones.length
      : undefined;
    let completedCount = this.args.completedCount || 0;

    if (!totalMilestones) {
      return 0;
    }

    return Math.round((completedCount / totalMilestones) * 100);
  }
}
