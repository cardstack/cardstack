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
import BoxelActionChin from '@cardstack/boxel/components/boxel/action-chin';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
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
  // @service declare layer1Network: Layer1Network;
  // @service declare layer2Network: Layer2Network;
  constructor(owner: unknown, args: CardPayLayerConnectModalComponentArgs) {
    super(owner, args);
    taskFor(this.closeOnConnectedTask).perform();
  }
  @task *closeOnConnectedTask() {
    // if (this.args.name === 'layer1') {
    //   yield this.layer1Network.waitForAccount;
    // } else {
    //   yield this.layer2Network.waitForAccount;
    // }
    this.args.onClose();
  }

  // cardstackLogo = cardstackLogo;
  // connectionSymbol = connectionSymbol;
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
  // FIXME sortby
  // .sortBy('enabled:desc');

  isConnected = false;
  // @service declare layer1Network: Layer1Network;
  // @reads('layer1Network.isConnected') declare isConnected: boolean;
  @tracked isWaitingForConnection = false;
  /*
     Set a starting wallet provider for the focus trap library in the modal
     - focus trapping requires checking what the next tabbable element is
     - radios with their roving tabindex confuse tabbable, so they cannot be the last focusable element
       , otherwise focus leaves the page
     - selecting a radio makes the connect button enabled and focusable.
   */
  @tracked radioWalletProviderId: WalletProvider['id'] = 'wallet-connect';

  get connectedWalletProvider(): WalletProvider | undefined {
    if (!this.isConnected) return undefined;
    else
      return this.walletProviders.find(
        (walletProvider) =>
          walletProvider.id === this.layer1Network.strategy.currentProviderId
      );
  }
  get connectedWalletLogo(): string {
    if (this.connectedWalletProvider) return this.connectedWalletProvider.logo;
    else return '';
  }

  get cardState(): string {
    if (this.isConnected) {
      return 'memorialized';
    } else if (this.isWaitingForConnection) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  get showActions(): boolean {
    return this.isConnected;
  }

  @action changeWalletProvider(id: WalletProvider['id']): void {
    this.radioWalletProviderId = id;
  }

  @action connect() {
    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }

  @action cancelConnection() {
    // given the way users connect, I don't think we need to do anything else here
    // since most of the other actions are delegated to the user + browser plugins
    // so we can't control it anyway. The situation where the corresponding button is visible is
    // usually when the user decides not to complete the connection by closing connection
    // prompt ui without taking action.
    this.isWaitingForConnection = false;
  }

  @action disconnect() {
    // FIXME
    // this.layer1Network.disconnect();
  }

  @action onDisconnect() {
    this.args.onDisconnect?.();
  }

  @task *connectWalletTask() {
    this.isWaitingForConnection = true;

    // FIXME
    console.log('Would connect…');
    // yield this.layer1Network.connect({
    //   id: this.radioWalletProviderId,
    // } as WalletProvider);
    this.isWaitingForConnection = false;
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
        <BoxelCardContainer
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
        >
          <button
            class='layer-connect-modal__close-button'
            type='button'
            aria-label='Close'
            {{on 'click' @onClose}}
          >
            {{svgJar 'close' width='100%' height='100%' aria-hidden=true}}
          </button>

          <header class="layer-connect-modal__title">Connect your wallet</header>

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

            <BoxelActionChin @state={{this.cardState}} @disabled={{@frozen}}>
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
        <i.InfoArea>
          Only visible to you
        </i.InfoArea>
      </:inProgress>
      <:memorialized as |m|>
        <m.ActionButton {{on "click" this.disconnect}} data-test-mainnet-disconnect-button>
          Disconnect Wallet
        </m.ActionButton>
      </:memorialized>
    </BoxelActionChin>

        </BoxelCardContainer>
      </div>
    </BoxelModal>
  </template>
}

export default CardPayLayerConnectModalComponent;
