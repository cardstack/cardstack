import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelParticipantList from '../participant-list';
import { Participant } from '../participant/model';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLElement;
  Args: {
    expanded?: boolean;
    label?: string;
    notificationCount?: number;
    participants?: Partial<Participant>[];
    title: string;
    toggleExpand?: () => void;
  };
  Blocks: {
    'default': [],
  }
}

const ThreadHeader: TemplateOnlyComponent<Signature> = <template>
  <header class="boxel-thread-header" data-test-boxel-thread-header ...attributes>
    {{#if @notificationCount}}
      <div class="boxel-thread-header__notification">{{@notificationCount}}</div>
    {{/if}}
    <div>
      <div class="boxel-thread-header__label">{{@label}}</div>
      <h2 class="boxel-thread-header__title">{{@title}}</h2>
    </div>
    <div>
      {{#if @toggleExpand}}
        <button {{on "click" @toggleExpand}} class="boxel-thread-header__expand-button">
          {{#if @expanded}}
            <span>Collapse</span> {{svgJar "contract" width="16px" height="16px"}}
          {{else}}
            <span>Full screen</span> {{svgJar "expand" width="16px" height="16px"}}
          {{/if}}
        </button>
      {{/if}}
      {{#if @participants}}
        <div class="boxel-thread-header__participants">
          <span>{{@participants.length}} {{svgJar "users" width="16px" height="16px"}}</span>
          <BoxelParticipantList
            @participants={{@participants}}
            @iconSize="2rem"
            @fanned={{true}}
          />
        </div>
      {{/if}}
    </div>

    {{yield}}
  </header>
</template>

export default ThreadHeader;

