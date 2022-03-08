// marked @*! - implementation may be different in ssr-web

import Component from '@glimmer/component';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
// import UA from '@cardstack/web-client/services/ua';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { race, rawTimeout, task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import config from '@cardstack/web-client/config/environment';

const AUTH_STEPS = {
  WALLET_CONNECT: 'WALLET_CONNECT',
  HUB_AUTH: 'HUB_AUTH',
  DONE: 'DONE',
  LOADING: 'LOADING',
};

const A_WHILE = config.environment === 'test' ? 100 : 1000 * 60; //@*!

export default class AuthComponent extends Component {
  @service declare layer2Network: Layer2Network; //@*!
  @service('hub-authentication') declare hubAuthentication: HubAuthentication; //@*!
  // @service declare ua: UA; //@*!
  @tracked hubError: '' | 'AUTH_TIMEOUT' | 'ERROR' = '';

  AUTH_STEPS = AUTH_STEPS;
  authTaskRunningForAWhile: boolean = false;

  get currentStep(): typeof AUTH_STEPS[keyof typeof AUTH_STEPS] {
    if (
      this.layer2Network.isInitializing ||
      this.hubAuthentication.isInitializing
    ) {
      return this.AUTH_STEPS.LOADING;
    } else if (!this.layer2Network.isConnected) {
      return this.AUTH_STEPS.WALLET_CONNECT;
    } else if (!this.hubAuthentication.isAuthenticated) {
      return this.AUTH_STEPS.HUB_AUTH;
    } else {
      return this.AUTH_STEPS.DONE;
    }
  }

  get walletConnectUri() {
    return this.layer2Network.walletConnectUri;
  }

  @task *authenticate(): TaskGenerator<void> {
    try {
      this.hubError = '';
      yield race([
        taskFor(this.timerTask).perform(),
        this.hubAuthentication.ensureAuthenticated(),
      ]);
      if (this.hubAuthentication.isAuthenticated) {
        return;
      } else if (this.authTaskRunningForAWhile) {
        this.hubError = 'AUTH_TIMEOUT';
      }
    } catch (e) {
      console.error(e);
      this.hubError = 'ERROR';
    }
  }

  @task *timerTask(): TaskGenerator<void> {
    this.authTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.authTaskRunningForAWhile = true;
  }

  @action resetHubAuthState() {
    this.hubError = '';
    this.authTaskRunningForAWhile = false;
  }
}
