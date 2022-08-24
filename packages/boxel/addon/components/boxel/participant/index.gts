import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';

import or from '@cardstack/boxel/helpers/truth-helpers/or';
import not from '@cardstack/boxel/helpers/truth-helpers/not';
import cssVar from '@cardstack/boxel/helpers/css-var';
import cssUrl from '@cardstack/boxel/helpers/css-url';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    iconOnly?: boolean;
    iconSize?: string;
    title?: string;
    description?: string;
    image?: string;
    hasLogo?: boolean;
    vertical?: boolean;
  };
  Blocks: {
    default: [];
  };
}

export default class ParticipantComponent extends Component<Signature> {
  @reads('args.iconSize', '2rem') declare iconSize: string;

  <template>
    {{#let (or @iconOnly (not @title)) as |iconOnly|}}
      <div
        class={{cn
          "boxel-participant"
          boxel-participant__icon-only=iconOnly
          boxel-participant__has-logo=@hasLogo
          boxel-participant__vertical=@vertical
        }}
        style={{cssVar boxel-participant-icon-size=this.iconSize}}
        ...attributes
      >
        <div class="boxel-participant__image" style={{cssUrl "background-image" @image}} />
        {{#unless iconOnly}}
          <div>
            <span class="boxel-participant__title">
              {{@title}}
            </span>
            <p class="boxel-participant__description">
              {{@description}}
            </p>
          </div>
        {{/unless}}

        {{yield}}
      </div>
    {{/let}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Participant': typeof ParticipantComponent;
  }
}
