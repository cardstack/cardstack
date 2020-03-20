import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import CssModeToggleService from '../services/css-mode-toggle';

export default class CardSizeToggle extends Component {
  @service cssModeToggle!: CssModeToggleService;
}
