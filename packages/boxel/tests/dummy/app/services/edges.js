import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { reads, equal } from 'macro-decorators';

export default class EdgesService extends Service {
  @service('router') routerService;
  @tracked displayLeftEdge = false;

  // hides the edges from cardstack.card-pay routes
  @reads('routerService.currentRoute.parent.name') routeName;
  @equal('routeName', 'cardstack.card-pay') disableEdges;

  @action
  updateDisplayLeftEdge(isDisplayed) {
    if (isDisplayed) {
      this.displayLeftEdge = true;
    } else {
      this.displayLeftEdge = false;
    }
  }
}
