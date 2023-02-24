import Component from '@glimmer/component';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { getConstantByNetwork, TransactionHash } from '@cardstack/cardpay-sdk';
import cn from '@cardstack/boxel/helpers/cn';
import './index.css';
import not from 'ember-truth-helpers/helpers/not';
import cssVar from '@cardstack/boxel/helpers/css-var';

interface Signature {
  Element: HTMLAnchorElement | HTMLButtonElement;
  Args: {
    networkSymbol: string;
    transactionHash?: TransactionHash;
    kind?: string;
  }
}

export default class BlockExplorerButton extends Component<Signature> {
  get blockExplorerUrlRoot(): string {
    return getConstantByNetwork('blockExplorer', this.args.networkSymbol);
  }
  get blockExplorerUrl(): string {
    return `${this.blockExplorerUrlRoot}/tx/${this.args.transactionHash}`;
  }

  get blockExplorerName(): string {
    let { blockExplorerUrlRoot } = this;
    if (blockExplorerUrlRoot.startsWith('https://blockscout.com')) {
      return 'Blockscout';
    }
    if (blockExplorerUrlRoot.includes('etherscan.io')) {
      return 'Etherscan';
    }
    if (blockExplorerUrlRoot.includes('polygonscan.com')) {
      return 'Polygonscan';
    }
    return 'block explorer';
  }

  <template>
    <BoxelButton
      @as="anchor"
      @size="extra-small"
      @kind={{@kind}}
      @href={{this.blockExplorerUrl}}
      @disabled={{not @transactionHash}}
      target="_blank"
      rel="noopener"
      class={{cn "block-explorer-button" block-explorer-button--disabled=(not @transactionHash)}}
      style={{cssVar
        boxel-button-color="transparent"
        boxel-button-border=(if @transactionHash "1px solid var(--boxel-purple-300)" "1px solid var(--boxel-purple-200)")
        boxel-button-text-color=(if @transactionHash "var(--boxel-dark);" "var(--boxel-purple-300)")
      }}
      data-hover="Not submitted to blockchain"
      ...attributes
    >
      View on {{this.blockExplorerName}}
    </BoxelButton>
  </template>
}