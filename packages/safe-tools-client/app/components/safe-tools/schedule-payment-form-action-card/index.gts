import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import BoxelInput from '@cardstack/boxel/components/boxel/input';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';
import BoxelInputSelectableTokenAmount, { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token-amount';
import BoxelSelect from '@cardstack/boxel/components/boxel/select';
import BoxelToggleButtonGroup from '@cardstack/boxel/components/boxel/toggle-button-group';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { on } from '@ember/modifier';
import './index.css';

interface Signature {
  Element: HTMLElement;
}

export default class SafeToolsSchedulePaymentFormActionCard extends Component<Signature> {

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  @tracked selectedPaymentType: string | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    this.selectedPaymentType = paymentTypeId;
  }

  @tracked recipientAddress = '';
  @tracked isRecipientAddressInvalid = false;
  @tracked recipientAddressErrorMessage = '';

  @tracked paymentAmount: string = '';
  @tracked isPaymentAmountInvalid = false;
  @tracked paymentTokenErrorMessage = '';
  tokens: SelectableToken[] = [
    { name: 'CARD', icon: 'card' },
    { name: 'HI', icon: 'emoji' },
    { name: 'WORLD', icon: 'world' },
  ];
  @tracked paymentToken: SelectableToken = this.tokens[0];

  @action onUpdatePaymentAmount(val: string) {
    this.paymentAmount = val;
  }
  @action onUpdatePaymentToken(val: SelectableToken) {
    this.paymentToken = val;
  }

  gasTokens: SelectableToken[] = [
    { name: 'CARD', icon: 'card' },
    { name: 'HI', icon: 'emoji' },
    { name: 'WORLD', icon: 'world' },
  ];
  @tracked selectedGasToken: SelectableToken = this.tokens[0];
  @action onSelectGasToken(val: SelectableToken) {
    this.selectedGasToken = val;
  }

  @tracked maxGasFee: string | undefined;
  @action onUpdateMaxGasFee(val: string) {
    this.maxGasFee = val;
  }

  @action
  schedulePayment() {
    console.log('TODO...');
  }

  <template>
    <BoxelActionContainer
      class="schedule-payment-form-action-card"
      ...attributes
    as |Section ActionChin|>
      <Section @title="Schedule Payment">
        <BoxelField @label="Frequency">
          <BoxelRadioInput
            @groupDescription="Select a type of scheduled payment"
            @name="payment-type"
            @items={{this.paymentTypeOptions}}
            @checkedId={{this.selectedPaymentType}}
            style={{cssVar
              boxel-radio-input-option-padding="var(boxel-sp-lg)"
            }}
          as |item|>
            <item.component @onChange={{fn this.onSelectPaymentType item.data.id}}>
              {{item.data.text}}
            </item.component>
          </BoxelRadioInput>
        </BoxelField>
        <BoxelField @label="Recipient">
          <BoxelInput
            placeholder="Enter Address"
            @value={{this.recipientAddress}}
            @invalid={{this.isRecipientAddressInvalid}}
            @errorMessage={{this.recipientAddressErrorMessage}}
          />
        </BoxelField>
        <BoxelField @label="Amount">
          <BoxelInputSelectableTokenAmount
            @value={{this.paymentAmount}}
            @onInput={{this.onUpdatePaymentAmount}}
            @invalid={{this.isPaymentAmountInvalid}}
            @errorMessage={{this.paymentTokenErrorMessage}}
            @token={{this.paymentToken}}
            @tokens={{this.tokens}}
            @onChooseToken={{this.onUpdatePaymentToken}}
          />
        </BoxelField>
        <BoxelField @label="Gas">
          <BoxelSelect
            @placeholder="Choose a Gas Token"
            @selected={{this.selectedGasToken}}
            @onChange={{this.onSelectGasToken}}
            @options={{this.gasTokens}}
            as |item itemCssClass|
          >
            <div class={{itemCssClass}}>{{item.name}}</div>
          </BoxelSelect>
        </BoxelField>
        <BoxelField @label="Max Gas Fee">
          <BoxelToggleButtonGroup
            @groupDescription="The maximum gas fee you are willing to spend for this payment"
            @name="max-gas-fee"
            @value={{this.maxGasFee}}
            @onChange={{this.onUpdateMaxGasFee}} as |group|
          >
            <group.Button @value="normal">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Normal
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Less than $0.10 USD
              </div>
            </group.Button>
            <group.Button @value="high">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                High
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Less than $1.00 USD
              </div>
            </group.Button>
            <group.Button @value="max">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Max
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Capped at $10 USD
              </div>
            </group.Button>
          </BoxelToggleButtonGroup>
          <div><!-- empty --></div>
          <div class="schedule-payment-form-action-card--fee-details">
            Cardstack charges $0.25 USD and 0.1% of the transaction as a fee for executing your scheduled payments.
          </div>
        </BoxelField>
      </Section>
        <ActionChin @state='default'>
          <:default as |ac|>
            <ac.ActionButton
              {{on 'click' this.schedulePayment}}
            >
              Schedule Payment
            </ac.ActionButton>
          </:default>
        </ActionChin>
    </BoxelActionContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SafeTools::SchedulePaymentFormActionCard': typeof SafeToolsSchedulePaymentFormActionCard;
  }
}
