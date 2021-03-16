import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class CardSpaceNewController extends Controller {
  @service('edges') edges;
  @service('cardstack-session') cardstackSession;

  @action updateEdges() {
    this.edges.updateDisplayLeftEdge(this.cardstackSession.isAuthenticated);
    this.edges.hasLightTheme();
  }
}
