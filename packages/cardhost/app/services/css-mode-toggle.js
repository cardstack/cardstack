import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class CssModeToggleService extends Service {
  @tracked editingCss;

  setEditingCss(value) {
    this.editingCss = value;
  }
}
