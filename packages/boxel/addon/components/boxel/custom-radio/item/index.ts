import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';

const DEFAULT_FOCUSED_CLASS = 'boxel-custom-radio__focused-item';
const DEFAULT_CHECKED_CLASS = 'boxel-custom-radio__checked-item';

export default class CustomRadioItem extends Component {
  @reads('args.focusedClass', DEFAULT_FOCUSED_CLASS)
  declare focusedClass: string;
  @reads('args.checkedClass', DEFAULT_CHECKED_CLASS)
  declare checkedClass: string;
  @tracked focused = false;
}
