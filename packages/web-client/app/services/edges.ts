import Service from '@ember/service';
import { Registry as Services } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { reads } from 'macro-decorators';

export default class EdgesService extends Service {
  @service router!: Services['router'];
  @tracked displayLeftEdge = false;

  // This originally hides the edges from cardstack.card-pay routes
  // Disabled for now
  @reads('routerService.currentRoute.parent.name') declare routeName: string;
  // @equal('routeName', 'cardstack.card-pay') declare disableEdges: boolean;

  @action
  updateDisplayLeftEdge(isDisplayed: boolean) {
    if (isDisplayed) {
      this.displayLeftEdge = true;
    } else {
      this.displayLeftEdge = false;
    }
  }
}
