import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import not from 'ember-truth-helpers/helpers/not';

import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container'

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: { 
    isOpen: boolean 
    loading?: boolean;
    onClose: () => void;
  };
}

//TODO: replace with correct flags and logic
const gasCost = `0.001899365 ETH (USD$3.01)`;
const hasEnoughGas = true;

export default class SetupSafeModal extends Component<Signature> {
  <template>
    <BoxelModal
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{@onClose}}
    >
      <BoxelActionContainer as |Section ActionChin|>
        <Section @title='Set up a Payment Safe' class='setup-safe-modal__section'>
          <p>In this step, you create a safe equipped with a module to schedule
            payments.
            <br />What you need to know:
          </p>
          <ul>
            <li>Your payment safe is used to fund your scheduled payments. </li>
            <li>You are the owner of the safe. Only the safe owner can schedule
              payments.
            </li>
            <li>Once you have scheduled payments, the module 
              <a href="https://github.com/cardstack/cardstack-module-scheduled-payment" target="_blank" rel="external" >
                (source code here) 
              </a>
              triggers the payments at the appointed time.
            </li>
            <li>Creating the safe and enabling the module requires a one-time gas
              fee.
            </li>
          </ul>
          {{! TODO: Gas cost should be handled on this component or be a param ? }}
          <b>Estimated gas cost: {{gasCost}}</b>
          {{#if hasEnoughGas}}
            <div class='safe-setup-modal__section-wallet-info'>
              {{svgJar
                'icon-check-circle-ht'
                class='safe-setup-modal__section-icon'
              }}
              <p>
                Your wallet has sufficient funds to cover the estimated gas cost.
              </p>
            </div>
          {{/if}}
          {{! TODO: What's the behavior for not having enough gas ? }}
        </Section>
        <ActionChin @state='default'>
          <:default as |ac|>
            {{! TODO: Provisioning should be handled on this component or be a param to be handled on a diff controller ? }}
            <ac.ActionButton @loading={{@loading}}>
              Provision
            </ac.ActionButton>
            {{#if (not @loading)}}
              <ac.CancelButton {{on 'click' @onClose}}>
                Cancel
              </ac.CancelButton>
            {{/if}}
          </:default>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}


