import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { race, rawTimeout, task, TaskGenerator } from 'ember-concurrency';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { tracked } from '@glimmer/tracking';
import config from '@cardstack/web-client/config/environment';
import { action } from '@ember/object';

interface CardPayWorkflowHubAuthComponentArgs {
  onComplete: () => void;
  isComplete: boolean;
  frozen: boolean;
}

const A_WHILE = config.environment === 'test' ? 100 : 1000 * 60;

export default class CardPayWorkflowHubAuthComponent extends Component<CardPayWorkflowHubAuthComponentArgs> {
  @service declare hubAuthentication: HubAuthentication;
  @tracked error?: Error;
  @tracked authTaskRunningForAWhile = false;

  @action checkIfAuthenticated() {
    if (this.hubAuthentication.isAuthenticated) {
      this.args.onComplete();
    }
  }

  @task *authenticationTask(): TaskGenerator<void> {
    try {
      this.error = undefined;
      yield race([
        taskFor(this.timerTask).perform(),
        this.hubAuthentication.ensureAuthenticated(),
      ]);
      if (this.hubAuthentication.isAuthenticated) {
        this.args.onComplete();
      } else if (this.authTaskRunningForAWhile) {
        this.error = new Error('AUTH_TIMEOUT');
      }
    } catch (e) {
      console.error(e);
      this.error = e;
    }
  }

  @task *timerTask(): TaskGenerator<void> {
    this.authTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.authTaskRunningForAWhile = true;
  }

  get authState() {
    if (taskFor(this.authenticationTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete || this.hubAuthentication.isAuthenticated) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
}
