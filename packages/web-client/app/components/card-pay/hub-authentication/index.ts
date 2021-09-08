import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { tracked } from '@glimmer/tracking';

interface CardPayWorkflowHubAuthComponentArgs {
  onComplete: () => void;
  isComplete: boolean;
  frozen: boolean;
}

export default class CardPayWorkflowHubAuthComponent extends Component<CardPayWorkflowHubAuthComponentArgs> {
  @service declare hubAuthentication: HubAuthentication;
  @tracked error?: Error;

  @task *authenticationTask(): TaskGenerator<void> {
    try {
      this.error = undefined;
      yield this.hubAuthentication.ensureAuthenticated();
      if (this.hubAuthentication.isAuthenticated) this.args.onComplete();
    } catch (e) {
      console.error(e);
      this.error = e;
    }
  }

  get authState() {
    if (taskFor(this.authenticationTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
}
