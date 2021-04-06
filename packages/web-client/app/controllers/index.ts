import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { Registry as Services } from '@ember/service';
import { action } from '@ember/object';

import EdgesService from '../services/edges';

class IndexController extends Controller {
  @service router!: Services['router'];
  @service declare edges: EdgesService;

  @action transitionTo(routeName: string) {
    this.router.transitionTo(routeName);
  }

  @action updateEdges() {
    this.edges.updateDisplayLeftEdge(true);
  }
}

export default IndexController;
