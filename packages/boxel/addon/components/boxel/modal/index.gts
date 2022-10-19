import Component from '@glimmer/component';
import eq from 'ember-truth-helpers/helpers/eq';
import { on } from '@ember/modifier';
import cssVar from '@cardstack/boxel/helpers/css-var';
import cn from '@cardstack/boxel/helpers/cn';
import onKey from 'ember-keyboard/helpers/on-key';
import setBodyClass from 'ember-set-body-class/helpers/set-body-class';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDialogElement;
  Args: {
    imgURL?: string;
    size?: 'small' | 'medium' | 'large';
    layer?: 'urgent';
    isOpen?: boolean;
    disableOverlayDismiss?: boolean;
    onClose: () => void;
  };
  Blocks: {
    default: [];
  };
}

export default class Modal extends Component<Signature> {
  <template>
    {{#if @isOpen}}
      {{setBodyClass "has-modal"}}
      {{onKey "Escape" @onClose event="keydown"}}
      <div
        style={{cssVar
          boxel-modal-z-index=(if (eq @layer "urgent" ) "var(--boxel-layer-modal-urgent)" "var(--boxel-layer-modal-default)")
        }}
      >
        <button
          disabled={{@disableOverlayDismiss}}
          type="button"
          {{on "click" @onClose}}
          class="boxel-modal-overlay"
          tabindex="-1"
        >
          <span class="boxel-sr-only">Close modal</span>
        </button>

        <dialog
          class={{cn
            "boxel-modal"
            boxel-modal--small=(eq @size "small")
            boxel-modal--medium=(eq @size "medium")
            boxel-modal--large=(eq @size "large")
          }}
          open={{@isOpen}}
          aria-modal="true"
          ...attributes
        >
          <div class="boxel-modal__inner">
            {{yield}}
          </div>
        </dialog>
      </div>
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Modal': typeof Modal;
  }
}
