import Service from '@ember/service';

export default class CssModeToggleService extends Service {
  setEditingCss(value) {
    this.editingCss = value;
  }
}
