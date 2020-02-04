import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CardRendererHeaderComponent extends Component {
  @service cardstackSession;
  @tracked contextMenuOpened = false;

  @action
  toggleMenu() {
    console.log('toggle')
    this.contextMenuOpened = !this.contextMenuOpened;
  }
}
