import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CardsController extends Controller {
  @service cssModeToggle;

  get themerClasses() {
    let editing = this.cssModeToggle.editingCss;
    if (editing && this.cssModeToggle.isResponsive) {
      return 'responsive editing-css';
    } else if (editing && !this.cssModeToggle.isResponsive) {
      return 'full-width editing-css';
    } else {
      return '';
    }
  }
}
