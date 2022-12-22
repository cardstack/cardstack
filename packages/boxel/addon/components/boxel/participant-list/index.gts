import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import { reads } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';

import cssVar from '@cardstack/boxel/helpers/css-var';
import BoxelParticipant from '../participant';
import { type Participant } from '../participant/model';
import eq from 'ember-truth-helpers/helpers/eq';
import lt from 'ember-truth-helpers/helpers/lt';
import or from 'ember-truth-helpers/helpers/or';

interface Signature {
  Element: HTMLUListElement;
  Args: {
    fanned?: boolean;
    fullWidth?: boolean;
    hasLogo?: boolean;
    iconOnly?: boolean;
    iconSize?: string;
    maxCount?: number;
    participants: Partial<Participant>[];
  };
  Blocks: EmptyObject;
}

export default class ParticipantList extends Component<Signature> {
  @reads('args.iconSize', '2rem') declare iconSize: string;
  @reads('args.maxCount', 5) declare maxCount: number;

  <template>
    <ul
      class={{cn
        "boxel-participant-list"
        boxel-participant-list__fanned=@fanned
        boxel-participant-list--full-width=@fullWidth
      }}
      style={{cssVar icon-size=this.iconSize}}
      ...attributes
    >
      {{#each @participants as |participant i|}}
        {{#if (lt i this.maxCount)}}
          <li>
            <BoxelParticipant
              class="boxel-participant-list__participant"
              @title={{participant.title}}
              @description={{participant.role}}
              @image={{participant.imgURL}}
              @hasLogo={{or @hasLogo (eq participant.type "organization")}}
              @iconSize={{this.iconSize}}
              @iconOnly={{or @iconOnly @fanned}}
            />
          </li>
        {{/if}}
      {{/each}}
    </ul>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ParticipantList': typeof ParticipantList;
  }
}
