import Component from '@glimmer/component';
// import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { timeout } from 'ember-concurrency';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { concat, fn, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import focusTrap from 'ember-focus-trap/modifiers/focus-trap';
import not from 'ember-truth-helpers/helpers/not';
import walletProviders from '@cardstack/safe-tools-client/utils/wallet-providers';

import cssVar from '@cardstack/boxel/helpers/css-var';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';

import './index.css';

// import cardstackLogo from '@cardstack/safe-tools-client/images/icons/cardstack-logo-navy-rounded.svg';
// import connectionSymbol from '@cardstack/safe-tools-client/images/icons/connection-symbol.svg';
import { WalletProvider } from '@cardstack/safe-tools-client/utils/wallet-providers';
// import { WorkflowCardComponentArgs } from '@cardstack/safe-tools-client/models/workflow';

interface CardPayLayerConnectModalComponentArgs {
  name: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (() => void) | undefined;
  onDisconnect: (() => void) | undefined;
}

class CardPayLayerConnectModalComponent extends Component<CardPayLayerConnectModalComponentArgs> {
  walletProviders = walletProviders.map((w) =>
    w.id === 'metamask'
      ? {
          ...w,
          enabled: !!window.ethereum?.isMetaMask,
          explanation: window.ethereum?.isMetaMask
            ? ''
            : 'MetaMask extension not detected',
        }
      : { ...w, enabled: true, explanation: '' }
  );

  isConnected = false;

  @action connect() {
    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }

  @task *connectWalletTask() {
    // TODO
    console.log('Would connect…');
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection
    if (this.isConnected) {
      this.args.onConnect?.();
    }
  }

  <template>
    <BoxelModal
      class='layer-connect-modal'
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{@onClose}}
      data-test-layer-connect-modal={{@name}}
    >
      <div class='layer-connect-modal__scroll-wrapper'>
        <BoxelActionContainer
          class='layer-connect-modal__card'
          tabindex='-1'
          {{focusTrap
            isActive=@isOpen
            focusTrapOptions=(hash
              allowOutsideClick=true
              clickOutsideDeactivates=true
              initialFocus='.layer-connect-modal__card'
            )
          }}
          {{!
            Focus is trapped within this element, with the element as the initial focus
            outside clicks are allowed to trigger @onClose

            This should ideally be replaced with a selector for the primary/first action
            in the modal. However, the programmatic focus it introduces does not match
            :focus-visible. This behaviour means the user doesn't know what is being focused.
            Forcing the user to press Tab will create focus that does match :focus-visible
            and hence show a ring.

            Also, there is no distinguishing state for focused radio buttons - leading to the same
            problem of the user not knowing what is being focused, if we try to select the radio
            button for layer one as the initial focus.

            Some reading, if you are up for a slight headache:
            - https://github.com/WICG/focus-visible/issues/88
            - https://github.com/w3c/csswg-drafts/issues/5885
          }}

          as |Section ActionChin|
        >
          <button
            class='layer-connect-modal__close-button'
            type='button'
            aria-label='Close'
            {{on 'click' @onClose}}
          >
            {{svgJar 'close' width='100%' height='100%' aria-hidden=true}}
          </button>

          <Section @title="Connect your wallet">
            <BoxelRadioInput
              @groupDescription='Select a wallet to connect to'
              @items={{this.walletProviders}}
              @disabled={{@isConnecting}}
              @checkedId={{@currentWalletProviderId}}
              @hideRadio={{true}}
              class='card-pay-layer-one-wallet-provider-selection__group'
              ...attributes
              data-test-wallet-selection as |option|
            >
              {{#let option.data as |item|}}
                <option.component
                  @name='wallet-provider-selection'
                  @onChange={{fn (optional @changeWalletProvider) item.id}}
                  @disabled={{not item.enabled}}
                  data-test-wallet-option={{item.id}}
                >
                  <div class='card-pay-layer-one-wallet-provider-selection__item'>
                    <img
                      src={{item.logo}}
                      alt=''
                      role='presentation'
                      class='card-pay-layer-one-wallet-provider-selection__item-image'
                    />
                    <span
                      class='card-pay-layer-one-wallet-provider-selection__item-name'
                    >
                      {{item.name}}
                    </span>
                    {{#if item.explanation}}
                      <span
                        class='card-pay-layer-one-wallet-provider-selection__item-description'
                      >
                        {{item.explanation}}
                      </span>
                    {{/if}}
                  </div>
                </option.component>
              {{/let}}
            </BoxelRadioInput>
          </Section>

          <ActionChin @state={{this.cardState}} @disabled={{@frozen}}>
            <:default as |a|>
              <a.ActionButton {{on "click" this.connect}} data-test-mainnet-connect-button>
                Connect Wallet
              </a.ActionButton>
            </:default>
            <:inProgress as |i|>
              <i.ActionStatusArea class="layer-one-connect-card__in-progress-logo" @icon={{concat
                this.radioWalletProviderId "-logo" }} style={{cssVar status-icon-size="2.5rem" }}>
                <BoxelLoadingIndicator class="layer-one-connect-card__loading-indicator" @color="var(--boxel-light)" />
                <div class="layer-one-connect-card__waiting-status">
                  Waiting for you to connect Card Pay with your {{!-- network-display-info "layer1" "conversationalName" --}} wallet...
                  <i.CancelButton class="layer-one-connect-card__cancel-button" {{on "click" this.cancelConnection}}>
                    Cancel
                  </i.CancelButton>
                </div>
              </i.ActionStatusArea>
            </:inProgress>
          </ActionChin>

        </BoxelActionContainer>
      </div>
    </BoxelModal>
  </template>
}

export default CardPayLayerConnectModalComponent;
