import Component from '@glimmer/component';
import { MaxGasDescriptionsState } from "..";
import tokenToUsd from '@cardstack/safe-tools-client/helpers/token-to-usd';
import { ButtonYieldedByToggleButtonGroup } from '@cardstack/boxel/components/boxel/toggle-button-group';
import { titleize } from '@cardstack/safe-tools-client/utils/titleize';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    group: { Button: ButtonYieldedByToggleButtonGroup; };
    name: string;
    maxGasDescriptions?: MaxGasDescriptionsState;
  }
}

export default class MaxGasToggleButton extends Component<Signature> {
  get tokenQuantity(): TokenQuantity | undefined {
    let value = this.args.maxGasDescriptions?.value;
    if (this.args.name === 'normal') return value?.normal;
    else if (this.args.name === 'high') return value?.high;
    else if (this.args.name === 'max') return value?.max;
    else return undefined;
  }

  <template>
    <@group.Button @value={{@name}}>
      <div class="schedule-payment-form-action-card__max-gas-fee-name">
        {{titleize @name}}
      </div>
      <div class="schedule-payment-form-action-card__max-gas-fee-description" data-test-max-gas-fee-description={{@name}}>
        {{#if @maxGasDescriptions.isLoading}}
          Loading gas price...
        {{else if @maxGasDescriptions.error}}
          <span class="schedule-payment-form-action-card-error">Can't estimate gas price</span>
        {{else if this.tokenQuantity}}
          Less than {{this.tokenQuantity.displayable}} (~{{tokenToUsd tokenQuantity=this.tokenQuantity}})
        {{/if}}
      </div>
    </@group.Button>
  </template>
}
