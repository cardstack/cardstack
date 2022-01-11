import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelInputTokenAmountUsage extends Component {
  @tracked id = 'boxel-token-amount-input-usage';
  @tracked value = '';
  @tracked helperText = 'Please enter an amount';
  @tracked errorMessage = '';
  @tracked disabled = false;
  @tracked invalid = false;
  @tracked icon = 'card';
  @tracked symbol = 'CARD';
}
