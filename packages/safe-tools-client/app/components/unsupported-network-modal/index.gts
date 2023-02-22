import Component from '@glimmer/component';
import { inject as service} from '@ember/service';
import { on } from '@ember/modifier';
import arrayJoin from '@cardstack/safe-tools-client/helpers/array-join';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import { noop } from '@cardstack/safe-tools-client/helpers/noop';
import {
  convertChainIdToName
} from '@cardstack/cardpay-sdk';

import './index.css';

interface Signature {
  isOpen: boolean;
  onClose: () => void;
}

class UnsupportedNetworkModal extends Component<Signature> {
  @service declare network: NetworkService;
  @service declare wallet: WalletService;

  get providerName() {
    return this.wallet.unsupportedConnectCache?.providerId === 'metamask' ? 'Metamask' : 'WalletConnect';
  }

  get networkName() {
    const chainId = this.wallet.unsupportedConnectCache?.chainId;
    return convertChainIdToName(chainId!) ?? 'an unknown';
  }

  <template>
    <BoxelModal
      class='unsupported-network-modal'
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{noop}}
      data-test-unsupported-network-modal
    >
      <BoxelActionContainer
        class='unsupported-network-modal__card'
        tabindex='-1'
        as |Section ActionChin|
      >
        <Section @title="Unsupported network!">
          <p>Your {{this.providerName}} wallet is connected to {{this.networkName}} network, which we don't support.</p>
          <p>In your wallet, please first connect to a supported network, and then reload the page.</p>
          <p class="unsupported-network-modal__card__text-row">Supported networks: <p class="unsupported-network-modal__card__supported-chain">{{arrayJoin this.network.supportedNetworksName ','}}</p></p>
        </Section>

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

export default UnsupportedNetworkModal;


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'UnsupportedNetworkModal': typeof UnsupportedNetworkModal;
  }
}
