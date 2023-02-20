import Component from '@glimmer/component';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { getConstantByNetwork, TransactionHash } from '@cardstack/cardpay-sdk';
import cn from '@cardstack/boxel/helpers/cn';
import './index.css';

interface Signature {
  Element: HTMLAnchorElement | HTMLButtonElement;
  Args: {
    networkSymbol: string;
    transactionHash: TransactionHash;
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

  get isEmptyTransactionHash(): boolean {
    return this.args.transactionHash === null || this.args.transactionHash === undefined || this.args.transactionHash === '';
  }

  <template>
    <BoxelButton
      @as="anchor"
      @size="extra-small"
      @kind={{@kind}}
      @href={{this.blockExplorerUrl}}
      @disabled={{this.isEmptyTransactionHash}}
      target="_blank"
      rel="noopener"
      class={{cn block-explorer-button-disabled=this.isEmptyTransactionHash}}
      data-hover="Not submitted to blockchain"
      ...attributes
    >
      View on {{this.blockExplorerName}}
    </BoxelButton>
  </template>
}