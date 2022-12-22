import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { type EmptyObject } from '@ember/component/helper';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { type Participant } from '../participant/model';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    participants: Partial<Participant>[];
  };
  Blocks: EmptyObject;
}

export default class ParticipantsSummary extends Component<Signature> {
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
      .map((p: Partial<Participant>) => p.title);
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

  <template>
    <div class="boxel-participants-summary" ...attributes>
      {{svgJar this.iconName width="14px" height="12px"}}
      <span>{{this.participantsString}}</span>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ParticipantsSummary': typeof ParticipantsSummary;
  }
}
