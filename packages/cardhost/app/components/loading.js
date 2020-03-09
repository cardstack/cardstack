import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

export default class ThemerToolbarComponent extends Component {
  @service overlays;
}
