import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import or from 'ember-truth-helpers/helpers/or';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container'
import { type ActionChinState } from '@cardstack/boxel/components/boxel/action-chin/state'
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator'
import SuccessIcon from '@cardstack/safe-tools-client/components/icons/success';
import FailureIcon from '@cardstack/safe-tools-client/components/icons/failure';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    isOpen: boolean
    onClose: () => void;
    hasEnoughBalance: boolean;
    gasCostDisplay: string;
    onProvisionClick: () => void;
    isProvisioning: boolean;
    isIndexing: boolean;
    isLoadingGasInfo: boolean;
    safeCreated: boolean | undefined;
    comparingBalanceToGasCostErrorMessage: string | undefined;
    provisioningOrIndexingErrorMessage: string | undefined;
  };
}

export default class SetupSafeModal extends Component<Signature> {
  get notEnoughBalance() {
    return !this.args.hasEnoughBalance;
  }

  get state(): ActionChinState {
    return (this.args.isProvisioning || this.args.isIndexing) ? 'in-progress' : 'default'
  }

  <template>
    <BoxelModal
      @size='medium'
      @isOpen={{@isOpen}}
      @onClose={{@onClose}}
      @isOverlayDismissalDisabled={{@isProvisioning}}
      data-test-setup-safe-modal>
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
              <a
                href='https://github.com/cardstack/cardstack-module-scheduled-payment'
                target='_blank'
                rel='external'
              >
                (source code here)
              </a>
              triggers the payments at the appointed time.
            </li>
            <li>Creating the safe and enabling the module requires a one-time gas
               fee.
            </li>
          </ul>
          {{#if @isLoadingGasInfo}}
            <div class='safe-setup-modal__section__section-gas-loading'>
              <BoxelLoadingIndicator /> <p>Calculating estimated gas cost...</p>
            </div>
          {{else}}
            {{#if @comparingBalanceToGasCostErrorMessage}}
              <div class='safe-setup-modal__section-wallet-info'>
                <FailureIcon class='action-chin-info-icon' />
                <p>
                  {{@comparingBalanceToGasCostErrorMessage}}
                </p>
              </div>
            {{else}}
              <b>Estimated gas cost: {{@gasCostDisplay}}</b>
              <div class='safe-setup-modal__section-wallet-info'>
                {{#if this.notEnoughBalance}}
                  <FailureIcon class='action-chin-info-icon' />
                  <p>
                    Your wallet has insufficient funds to cover the estimated gas cost.
                  </p>
                {{else}}
                  <SuccessIcon class='action-chin-info-icon' />
                  <p>
                    Your wallet has sufficient funds to cover the estimated gas cost.
                  </p>
                {{/if}}
              </div>
            {{/if}}
          {{/if}}
        </Section>
        <ActionChin @state={{this.state}}>
          <:default as |ac|>
            {{#if @safeCreated}}
              <ac.ActionButton
                {{on 'click' @onClose}}
                data-test-create-safe-close-button
              >
                Close
              </ac.ActionButton>

              {{#if @provisioningOrIndexingErrorMessage}}
                <ac.InfoArea data-test-safe-error-info>
                  <FailureIcon class='action-chin-info-icon' />
                  {{@provisioningOrIndexingErrorMessage}}
                </ac.InfoArea>
              {{else}}
                <ac.InfoArea data-test-safe-success-info>
                  <SuccessIcon class='action-chin-info-icon' />
                  Your safe has been created and the module has been enabled. You can now schedule payments.
                </ac.InfoArea>
              {{/if}}
            {{else}}
              <ac.ActionButton
                disabled={{or this.notEnoughBalance @isLoadingGasInfo}}
                {{on 'click' @onProvisionClick}}
                data-test-provision-safe-button
              >
                Provision
              </ac.ActionButton>

              <ac.CancelButton {{on 'click' @onClose}}>
                Cancel
              </ac.CancelButton>

              {{#if @provisioningOrIndexingErrorMessage}}
                <ac.InfoArea data-test-safe-error-info>
                  <FailureIcon class='action-chin-info-icon' />
                  {{@provisioningOrIndexingErrorMessage}}
                </ac.InfoArea>
              {{/if}}
            {{/if}}
          </:default>
          <:inProgress as |ip|>
            <ip.ActionButton>
              {{#if @isProvisioning}}
                Provisioning...
              {{else if @isIndexing}}
                Confirming...
              {{/if}}
            </ip.ActionButton>
          </:inProgress>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SetupSafeModal': typeof SetupSafeModal;
  }
}
