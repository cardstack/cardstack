import Component from '@glimmer/component';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import { on } from '@ember/modifier';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { type ActionChinState } from '@cardstack/boxel/components/boxel/action-chin/state';
import { tracked } from '@glimmer/tracking';

import './index.css';

export default class HubAuthModal extends Component {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  @service declare wallet: WalletService;
  @tracked isAuthenticating = false;

  get isModalOpen() {
    return this.wallet.isConnected && this.hubAuthentication.isAuthenticated === false;
  }

  onClose() {
    // noop, needed for the BoxelModal component API
  }

  @action async authorize() {
    this.isAuthenticating = true;
    try {
      await this.hubAuthentication.ensureAuthenticated();
    } finally {
      this.isAuthenticating = false;
    }
  }

  get connectionState(): ActionChinState {
    return this.isAuthenticating ? 'in-progress' : 'default';
  }

  <template>
    <BoxelModal
      @size='medium'
      @isOpen={{this.isModalOpen}}
      @onClose={{this.onClose}}
      data-test-hub-auth-modal
    >
      <BoxelActionContainer
        as |Section ActionChin|
      >
        <Section @title="Authenticate with the Cardstack Hub">
          <div>
            <p>To manage and see the status of your payments, you need to authenticate using your wallet.</p>

            <p>This is needed so we can associate your wallet address with encrypted data stored in Cardstack Hub.</p>

            <p>You only need to do this once per browser per device.</p>
          </div>
        </Section>

        <ActionChin @state={{this.connectionState}}>
          <:default as |a|>
            <a.ActionButton {{on "click" this.authorize}}>
              Authenticate
            </a.ActionButton>
          </:default>
          <:inProgress as |i|>
            <i.ActionStatusArea class="network-connect-modal__in-progress-logo">
              <BoxelLoadingIndicator class="network-connect-modal__loading-indicator" @color="var(--boxel-light)" />

              <div class="network-connect-modal__waiting-status">
                Waiting for you to sign the request in your wallet...
              </div>
            </i.ActionStatusArea>
          </:inProgress>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'HubAuthModal': typeof HubAuthModal;
  }
}
