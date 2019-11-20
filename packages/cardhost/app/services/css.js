import Service from '@ember/service';

export default class CssService extends Service {
  setEditingCss(value) {
    this.editingCss = value;
  }
}
