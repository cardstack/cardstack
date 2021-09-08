import Component from '@glimmer/component';

export default class CardflowComponent extends Component {
  get user() {
    return this.args.model.user;
  }

  get thread() {
    return this.args.model.thread;
  }

  get milestones() {
    if (!this.args.model.workflow || !this.args.model.workflow.milestones) {
      return null;
    }

    return this.args.model.workflow.milestones;
  }

  get participants() {
    return this.args.model.participants;
  }

  get org() {
    return this.args.model.currentOrg;
  }

  get participatingOrgMembers() {
    let [...members] = this.participants.filter(
      (el) => el.org_ids && el.org_ids.includes(this.org.id)
    );
    return [this.org, ...members];
  }

  get otherParticipants() {
    if (!this.participants) {
      return null;
    }
    if (!this.participatingOrgMembers || !this.participatingOrgMembers.length) {
      return this.participants;
    }
    return this.participants.filter(
      (el) => !el.org_ids || !el.org_ids.includes(this.org.id)
    );
  }

  get milestone() {
    if (!this.milestones || !this.thread || !this.thread.currentMilestone) {
      return null;
    }

    return this.milestones.find(
      (el) => el.title === this.thread.currentMilestone
    );
  }

  get progress() {
    if (this.thread.isComplete) {
      return this.milestones.length;
    }

    if (!this.milestone) {
      return null;
    }

    let index = this.milestones.findIndex((el) => el.id === this.milestone.id);
    if (index < 0) {
      return null;
    }

    return index;
  }

  get progressStatus() {
    if (this.thread && this.thread.isCancelled) {
      return 'Cancelled';
    }

    if (this.thread && this.thread.isComplete) {
      if (this.milestone) {
        return this.milestone.statusOnCompletion || 'Completed';
      }

      if (this.milestones && this.milestones.length) {
        let lastMilestone = this.milestones[this.milestones.length - 1];
        return lastMilestone.statusOnCompletion || 'Completed';
      }

      return 'Completed';
    }

    if (!this.milestone || !this.milestones || !this.thread) {
      return null;
    }

    if (this.progress === 0) {
      return 'Workflow started';
    }

    let previousMilestone =
      this.args.model.workflow.milestones[this.progress - 1];
    return previousMilestone ? previousMilestone.statusOnCompletion : null;
  }
}
