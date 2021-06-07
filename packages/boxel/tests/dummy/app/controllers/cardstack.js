import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
export default class CardStackController extends Controller {
  @service('edges') edges;

  @action updateEdges() {
    this.edges.updateDisplayLeftEdge(true);
  }

  @action transitionHome() {
    this.transitionToRoute('cardstack');
  }
}
