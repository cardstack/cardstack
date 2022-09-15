import Component from '@glimmer/component';
import BoxelOrgHeader from '@cardstack/boxel/components/boxel/org-header';
import ConnectionButton from './connection-button';
import WorkflowTracker from './workflow-tracker';
import and from 'ember-truth-helpers/helpers/and';
import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLElement;
  Args: {
    title: string;
    logoURL: string;
    layer1ChainName: string;
    layer1Address: string;
    isLayer1Initializing: boolean;
    isLayer1Connected: boolean;
    layer1Connect: () => void;
    layer2ChainName: string;
    layer2Address: string;
    isLayer2Initializing: boolean;
    isLayer2Connected: boolean;
    layer2Connect: () => void;
  }
  Blocks: EmptyObject
}

export default class CardPayHeader extends Component<Signature> {
  <template>
    <BoxelOrgHeader
      @title={{@title}}
      @iconURL={{@logoURL}}
      class="card-pay-header"
      data-test-card-pay-header
    >
      <ul class="card-pay-header__item-list">
        <li class="card-pay-header__item" data-test-card-pay-layer-1-connect>
          <ConnectionButton
            @chainName={{@layer1ChainName}}
            @address={{@layer1Address}}
            @isInitializing={{@isLayer1Initializing}}
            @isConnected={{@isLayer1Connected}}
            @onConnect={{@layer1Connect}}
          />
        </li>
        <li class="card-pay-header__item" data-test-card-pay-layer-2-connect>
          <ConnectionButton
            @chainName={{@layer2ChainName}}
            @address={{@layer2Address}}
            @isInitializing={{@isLayer2Initializing}}
            @isConnected={{@isLayer2Connected}}
            @onConnect={{@layer2Connect}}
          />
        </li>
        {{#if (and @isLayer1Connected @isLayer2Connected)}}
          <li class="card-pay-header__item">
            <WorkflowTracker />
          </li>
        {{/if}}
      </ul>
    </BoxelOrgHeader>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardPay::Header': typeof CardPayHeader;
  }
}