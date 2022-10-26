import Component from '@glimmer/component';
import { inject as service} from '@ember/service';
import { action } from '@ember/object';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import cn from '@cardstack/boxel/helpers/cn';
import or from 'ember-truth-helpers/helpers/or';
import { on } from '@ember/modifier';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';
import WalletService from '@cardstack/safe-tools-client/services/wallet';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    address: string;
    isInitializing: boolean;
    isConnected: boolean;
    onConnect: () => void;
  }
}

export default class ConnectButton extends Component<Signature> {
  @service declare wallet: WalletService;

  @action async disconnect(): Promise<void> {
    // TODO
  }

  <template>
    {{#if this.wallet.isConnected}}
      <BoxelButton
        @kind="secondary-dark"
        {{on "click" this.disconnect}}
        data-test-disconnect-button
        {{! @glint-ignore See notes here https://github.com/typed-ember/glint/pull/138#issue-852455350 }}
        ...attributes
      >
        Disconnect
      </BoxelButton>
    {{else}}
      <BoxelButton
        @kind={{if (or @isConnected @isInitializing) "secondary-dark" "primary"}}
        @loading={{@isInitializing}}
        class={{cn
          "connect-button__button"
          connect-button__button--connected=(or @isConnected @isInitializing)
        }}
        {{on "click" @onConnect}}
        data-test-connect-button
      >
        {{#if @isInitializing}}
          {{!-- just show the spinner --}}
          <span class="boxel-sr-only">Reconnecting</span>
        {{else if @isConnected}}
          {{truncateMiddle @address}}
        {{else}}
          Connect Wallet
        {{/if}}
      </BoxelButton>
    {{/if}}
  </template>
}

