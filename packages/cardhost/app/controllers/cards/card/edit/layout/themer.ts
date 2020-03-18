import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import EditCardController from '../../edit';
import RouterService from '@ember/routing/router-service';
import { CardstackSession } from '../../../../../services/cardstack-session';
import { ThemeOption } from './index';
import { tracked } from '@glimmer/tracking';

export default class ThemerCardController extends EditCardController {
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;
  @tracked selectedTheme!: ThemeOption;
  resizeable = true;

  @action
  handleThemeChange(val: ThemeOption) {
    this.selectedTheme = val;
    //  TODO
  }
}
