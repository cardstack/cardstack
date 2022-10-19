import Component from '@glimmer/component';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import { action } from '@ember/object';
import { timeout } from 'ember-concurrency';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { concat, fn, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import focusTrap from 'ember-focus-trap/modifiers/focus-trap';
import not from 'ember-truth-helpers/helpers/not';
import walletProviders, { WalletProvider } from '@cardstack/safe-tools-client/utils/wallet-providers';

import cssVar from '@cardstack/boxel/helpers/css-var';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';

import './index.css';

interface Signature {
  name: string | null;
  isOpen: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  currentWalletProviderId: WalletProvider['id'];
  changeWalletProvider: () => void;
  onClose: () => void;
  onConnect: (() => void) | undefined;
  onDisconnect: (() => void) | undefined;
}

class NetworkConnectModal extends Component<Signature> {
  walletProviders = walletProviders.map((w) =>
    w.id === 'metamask'
      ? {
          ...w,
          //@ts-expect-error This and the below can be removed when this is imported: https://github.com/cardstack/cardstack/blob/c2ddb8ab7b8bc577c8211527f3c5193d5f6accde/packages/web-client/app/utils/web3-strategies/layer-1-connection-manager.ts#L1
          enabled: !!window.ethereum?.isMetaMask,
          //@ts-expect-error
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

  get radioWalletProviderId() {
    // TODO
    return this.walletProviders[0].id;
  }

  @action cancelConnection() {
    // TODO
  }

  <template>
    <BoxelModal
      class='network-connect-modal'
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{@onClose}}
      data-test-network-connect-modal={{@name}}
    >
      <div class='network-connect-modal__scroll-wrapper'>
        <BoxelActionContainer
          class='network-connect-modal__card'
          tabindex='-1'
          {{focusTrap
            isActive=@isOpen
            focusTrapOptions=(hash
              allowOutsideClick=true
              clickOutsideDeactivates=true
              initialFocus='.network-connect-modal__card'
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
            class='network-connect-modal__close-button'
            type='button'
            aria-label='Close'
            {{on 'click' @onClose}}
          >
            {{svgJar 'close' width='100%' height='100%' aria-hidden=true}}
          </button>

          <Section @title="Connect your wallet">
            <BoxelRadioInput
              @name="wallet-provider"
              @orientation="horizontal"
              @spacing="default"
              @groupDescription='Select a wallet to connect to'
              @items={{this.walletProviders}}
              @disabled={{@isConnecting}}
              @checkedId={{@currentWalletProviderId}}
              @hideRadio={{true}}
              class='network-connect-modal__wallet-group'
              data-test-wallet-selection as |option|
            >
              {{#let option.data as |item|}}
                <option.component
                  @name='wallet-provider-selection'
                  @onChange={{fn (optional @changeWalletProvider) item.id}}
                  @disabled={{not item.enabled}}
                  data-test-wallet-option={{item.id}}
                >
                  <div class='network-connect-modal__wallet-item'>
                    <img
                      src={{item.logo}}
                      alt=''
                      role='presentation'
                      class='network-connect-modal__wallet-item-image'
                    />
                    <span
                      class='network-connect-modal__wallet-item-name'
                    >
                      {{item.name}}
                    </span>
                    {{#if item.explanation}}
                      <span
                        class='network-connect-modal__wallet-item-description'
                      >
                        {{item.explanation}}
                      </span>
                    {{/if}}
                  </div>
                </option.component>
              {{/let}}
            </BoxelRadioInput>
          </Section>

          <ActionChin @state='default'>
            <:default as |a|>
              <a.ActionButton {{on "click" this.connect}} data-test-mainnet-connect-button>
                Connect Wallet
              </a.ActionButton>
            </:default>
            <:inProgress as |i|>
              <i.ActionStatusArea class="network-connect-modal__in-progress-logo" @icon={{concat
                this.radioWalletProviderId "-logo" }} style={{cssVar status-icon-size="2.5rem" }}>
                <BoxelLoadingIndicator class="network-connect-modal__loading-indicator" @color="var(--boxel-light)" />
                <div class="network-connect-modal__waiting-status">
                  Waiting for you to connect your {{!-- network-display-info "conversationalName" --}} wallet...
                  <i.CancelButton class="network-connect-modal__cancel-button" {{on "click" this.cancelConnection}}>
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

export default NetworkConnectModal;
