import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';

import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { dayjsFormat } from '@cardstack/boxel/helpers/dayjs-format';
import dayjs from 'dayjs';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    imgURL?: string;
    name?: string;
    hideMeta?: boolean;
    hideName?: boolean;
    notRound?: boolean;
    fullWidth?: boolean;
    datetime?: any;
  }
  Blocks: {
    'default': []
  }
}

export default class ThreadMessage extends Component<Signature> {
  <template>
    <div
      class={{cn
        "boxel-thread-message"
        boxel-thread-message--hide-meta=@hideMeta
        boxel-thread-message--full-width=@fullWidth
      }}
      data-test-boxel-thread-message
      ...attributes
    >
      <div class={{cn "boxel-thread-message__meta"  boxel-sr-only=@hideMeta}}>
        {{#unless @hideMeta}}
          {{#if @imgURL}}
            <img
              src={{@imgURL}}
              alt={{or @name "participant"}}
              width="40px"
              height="40px"
              class={{cn "boxel-thread-message__avatar-img" boxel-thread-message__avatar-img--not-round=@notRound}}
              data-test-boxel-thread-message-avatar
            />
          {{else}}
            {{svgJar "profile" width="40px" height="40px" aria-label=(or @name "participant")}}
          {{/if}}
        {{/unless}}
        <h3 class="boxel-thread-message__info">
          {{#if @name}}
            <span class={{cn "boxel-thread-message__name" boxel-sr-only=@hideName}} data-test-boxel-thread-message-name>
              {{@name}}
            </span>
          {{/if}}
          {{#let (or @datetime (dayjs)) as |datetime|}}
            <time datetime={{datetime}} class="boxel-thread-message__time">
              {{dayjsFormat datetime "MMM D, h:mm A"}}
            </time>
          {{/let}}
        </h3>
      </div>
      <div class="boxel-thread-message__content">
        {{yield}}
      </div>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ThreadMessage': typeof ThreadMessage;
  }
}
