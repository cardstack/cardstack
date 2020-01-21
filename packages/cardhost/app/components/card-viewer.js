import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

export default class CardViewer extends Component {
  @service router;
  @service cardstackSession;

  resizeable = true;

  get cardJson() {
    if (!this.args.card) {
      return null;
    }
    return JSON.stringify(this.args.card.json, null, 2);
  }
}
