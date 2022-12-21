import Component from '@glimmer/component';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';

type TransactionHash = string; // TODO extract to somewhere we can share this, perhaps across projects?

interface Signature {
  Element: HTMLAnchorElement | HTMLButtonElement;
  Args: {
    networkSymbol: string;
    transactionHash: TransactionHash;
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
      href={{this.blockExplorerUrl}} 
      target="_blank"
      rel="noopener"
      ...attributes
    >
      View on {{this.blockExplorerName}}
    </BoxelButton>
  </template>
}