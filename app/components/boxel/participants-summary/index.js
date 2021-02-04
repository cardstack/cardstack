import Component from '@glimmer/component';
import './index.css';
export default class ParticipantsSummary extends Component {
  max = 2;

  get participantsString() {
    let { max } = this;
    let { participants } = this.args;

    if (!participants) {
      return null;
    }
    let parts = participants
      .filter(Boolean)
      .slice(0, max)
      .map((p) => p.title);
    if (participants.length > max) {
      let remaining = participants.length - max;
      parts = parts.concat(`+${remaining}`);
    }
    return parts.join(', ');
  }

  get iconName() {
    let { participants } = this.args;
    return participants.length > 1 ? 'users' : 'user';
  }
}
