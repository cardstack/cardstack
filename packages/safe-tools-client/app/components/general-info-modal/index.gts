import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import { noop } from '@cardstack/safe-tools-client/helpers/noop';
import { type Signature as SectionSignature } from '@cardstack/boxel/components/boxel/action-container/section';
import { ComponentLike } from '@glint/template';

import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    isOpen: boolean;
    onClose: () => void;
  };
  Blocks: {
    'default': [ComponentLike<SectionSignature>,],
  }
}

class GeneralInfoModal extends Component<Signature> {
  <template>
    <BoxelModal
      class='general-info-modal'
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{noop}}
      data-test-general-info-modal
    >
      <BoxelActionContainer
        class='general-info-modal__card'
        tabindex='-1'
        as |Section ActionChin|
      >
        {{yield Section}}
        <ActionChin @state='default'>
          <:default as |a|>
            <a.ActionButton {{on "click" @onClose}}>
              Close
            </a.ActionButton>
          </:default>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}

export default GeneralInfoModal;


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'GeneralInfoModal': typeof GeneralInfoModal;
  }
}
