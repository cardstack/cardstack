import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Participant {
  type: string;
  title: string;
  imgURL: string;
  role: string;
}

interface ParticipantsSummaryArgs {
  participants: Partial<Participant>[];
}

export default class ParticipantsSummary extends Component<ParticipantsSummaryArgs> {
  max = 2;

  get participantsString(): string | null {
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

  get iconName(): string {
    let { participants } = this.args;
    return participants.length > 1 ? 'users' : 'user';
  }
}
