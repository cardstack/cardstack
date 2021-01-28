import Component from '@glimmer/component';

export default class QueueCardComponent extends Component {
  get userTasks() {
    let tasks = this.args.card.tasks;
    let user = this.args.user;
    if (!tasks || !user) {
      return null;
    }

    return tasks.filter((el) => !el.completed && el.assigned_to === user.id);
  }

  get assignedTasks() {
    let tasks = this.args.card.tasks;
    let user = this.args.user;
    if (!tasks || !user) {
      return null;
    }
    // do not count completed or self-assigned tasks
    return tasks.filter(
      (el) =>
        !el.completed &&
        el.assigned_by === user.id &&
        el.assigned_to !== user.id
    );
  }

  get progress() {
    if (this.args.card.isCancelled) {
      return 'Cancelled';
    } else if (this.args.card.isComplete) {
      return 'Complete';
    }
    if (!this.args.card.currentMilestone) {
      return null;
    }
    return this.args.card.currentMilestone;
  }

  get progressPct() {
    let pct = this.args.card.progressPct;
    if (!pct) {
      return null;
    }
    return Number(pct) / 100;
  }
}
