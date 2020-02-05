import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class CardRendererHeaderComponent extends Component {
  @service cardstackSession;

  @action
  toggleMenu() {
    this.args.setContextMenu(!this.args.contextMenuOpen);
  }
}
