import Component from '@glimmer/component';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import or from 'ember-truth-helpers/helpers/or';
import { on } from '@ember/modifier';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    chainName: string;
    address: string;
    isInitializing: boolean;
    isConnected: boolean;
    onConnect: () => void;
  }
  Blocks: EmptyObject
}

export default class ConnectButton extends Component<Signature> {
  <template>
    <div class="connect-button__label">
      {{@chainName}}
    </div>
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
        <span class="boxel-sr-only">Reconnecting to {{@chainName}}</span>
      {{else if @isConnected}}
        {{truncateMiddle @address}}
      {{else}}
        Connect Wallet
      {{/if}}
    </BoxelButton>
  </template>
}

