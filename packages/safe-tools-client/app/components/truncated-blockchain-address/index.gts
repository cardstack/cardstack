import Component from '@glimmer/component';
import BoxelIconButton from '@cardstack/boxel/components/boxel/icon-button';
import { on } from '@ember/modifier';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { later } from '@ember/runloop';
import copyToClipboard from '@cardstack/boxel/helpers/copy-to-clipboard';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import { task } from 'ember-concurrency-decorators';
import perform from 'ember-concurrency/helpers/perform';

import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    address: string;
    isCopyable?: boolean | undefined;
    copyIconColor?: string;
  }
}

export default class TruncatedBlockchainAddress extends Component<Signature> {
  @tracked isShowingCopiedConfirmation = 0;

  @action registerListener(element: Element) {
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      return false;
    });
  }

  @task *flashCopiedConfirmation() {
    this.isShowingCopiedConfirmation = 1;
    later(() => {
      this.isShowingCopiedConfirmation = 0;
    } , 1000)
  }

  <template>
    {{#if @isCopyable}}
      <div class='truncated-blockchain-address' {{didInsert this.registerListener}}>
        <div class='blockchain-address'>{{truncateMiddle @address}}</div>
        <BoxelIconButton
          @icon="copy"
          @width="14px"
          @height="14px"
          aria-label="Copy to Clipboard"
          style={{cssVar
            boxel-icon-button-width="auto"
            boxel-icon-button-height="auto"
            icon-color=@copyIconColor
          }}
          {{on "click"
              (copyToClipboard
                value=@address
                onCopy=(perform this.flashCopiedConfirmation)
              )
            }}
        />
        <div class='truncated-blockchain-address-copied' style={{
          cssVar truncated-blockchain-address-copied-opacity=this.isShowingCopiedConfirmation
        }}>Copied!</div>
      </div>
    {{else}}
        <div class="blockchain-address">{{truncateMiddle @address}}</div>
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'TruncatedBlockchainAddress': typeof TruncatedBlockchainAddress;
  }
}
