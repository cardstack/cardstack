import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { later } from '@ember/runloop';

import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import copyToClipboard from '@cardstack/boxel/helpers/copy-to-clipboard';
import cssVar from '@cardstack/boxel/helpers/css-var';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container'
import BoxelInputGroup from '@cardstack/boxel/components/boxel/input-group'

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: { 
    isOpen: boolean 
    onClose: () => void;
    safeAddress: string;
    networkName: string;
  };
}

export default class DepositModal extends Component<Signature> {
  @tracked isShowingCopiedConfirmation = false;

  @action flashCopiedConfirmation() {
    this.isShowingCopiedConfirmation = true;
    later(() => {
      this.isShowingCopiedConfirmation = false;
    } , 1000)
  }

  <template>
    <BoxelModal @size="small" @isOpen={{@isOpen}} @onClose={{@onClose}}>
      <BoxelActionContainer as |Section ActionChin|>
        <Section @title="Deposit Instructions" class="deposit-modal__section">
          <p>
            it is the user's responsibility to ensure that sufficient funds are
            present in their wallet at the time of each transaction
          </p>
          <p>To deposit into your {{@networkName}} safe, transfer assets to:</p>
          <BoxelInputGroup
            @value={{@safeAddress}}
            @readonly={{true}}
            style={{cssVar
              boxel-input-group-border-radius="var(--boxel-border-radius)"
            }}
          >
            <:after as |Accessories inputGroup|>
              {{#if this.isShowingCopiedConfirmation}}
                <Accessories.Text>Copied!</Accessories.Text>
              {{/if}}
              <Accessories.IconButton
                @width='20px'
                @height='20px'
                @icon="copy"
                aria-label="Copy to Clipboard"
                {{on "click"
                  (copyToClipboard
                    elementId=inputGroup.elementId
                    onCopy=this.flashCopiedConfirmation
                  )
                }}
              />
            </:after>
          </BoxelInputGroup>
          <div class="deposit-modal__section-funds-info">
            {{svgJar "info" class="deposit-modal__section-funds-info-icon"}}
            <div class="deposit-modal__section-funds-info-header">
              How much should you transfer?
              <p>
                It is your choice how far in advance you fund your safe. As a convenience,
                we have calculated this safe's funding needs for your currently scheduled
                transactions:
              </p>
            </div>
          </div>
        </Section>
        <ActionChin @state="default">
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


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'DepositModal': typeof DepositModal;
  }
}
