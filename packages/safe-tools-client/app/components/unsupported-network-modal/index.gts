import Component from '@glimmer/component';
import { inject as service} from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import arrayJoin from '@cardstack/safe-tools-client/helpers/array-join';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import { noop } from '@cardstack/safe-tools-client/helpers/noop';

import './index.css';

interface Signature {
  isOpen: boolean;
  onClose: () => void;
}

class UnsupportedNetworkModal extends Component<Signature> {
  @service declare network: NetworkService;

  @tracked chosenProviderId: string | undefined;

  <template>
    <BoxelModal
      class='unsupported-network-modal'
      @size='small'
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
          <span>Choose a supported one on your wallet and reconnect.</span>
          <span>Supported networks: {{arrayJoin this.network.supportedNetworksName ','}}</span>
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
