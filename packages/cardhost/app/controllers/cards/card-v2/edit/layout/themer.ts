import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import EditCardV2Controller from '../../edit';
import { Router } from '@ember/routing';
import { CardstackSession } from '../../../../../services/cardstack-session';
import { ThemeOption } from './index';
import { tracked } from '@glimmer/tracking';

export default class ThemerCardController extends EditCardV2Controller {
  @service router!: Router;
  @service cardstackSession!: CardstackSession;
  @tracked selectedTheme!: ThemeOption;
  resizeable = true;

  @action
  handleThemeChange(val: ThemeOption) {
    this.selectedTheme = val;
    //  TODO
  }
}
