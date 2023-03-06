import Component from '@glimmer/component';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import './index.css';
import { getConstantByNetwork, TransactionHash } from '@cardstack/cardpay-sdk';
import not from 'ember-truth-helpers/helpers/not';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { concat } from '@ember/helper';

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

  get textColor() {
    if (this.args.kind == 'secondary-dark') {
      return undefined;
    }
    if (this.args.transactionHash) {
      return 'var(--boxel-dark)';
    } else {
      return 'var(--boxel-purple-300)'
    }
  }

  <template>
    <BoxelButton
      @as="anchor"
      @size="extra-small"
      @kind={{@kind}}
      @href={{this.blockExplorerUrl}}
      @disabled={{not @transactionHash}}
      @tooltip={{if @transactionHash undefined "Not submitted to blockchain"}}
      target="_blank"
      rel="noopener"
      class="BlockExplorerButton"
      title={{concat 'View transaction on ' this.blockExplorerName}}
      style={{cssVar
        boxel-button-color="transparent"
        boxel-button-border=(if @transactionHash "1px solid var(--boxel-purple-300)" "1px solid var(--boxel-purple-200)")
        boxel-button-text-color=this.textColor
      }}
      ...attributes
    >
      {{this.blockExplorerName}} {{svgJar "external-link" width="14px" height="14px"}}
    </BoxelButton>
  </template>
}