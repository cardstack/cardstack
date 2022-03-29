import Service from '@ember/service';
import Layer2Network from './layer2-network';
import { inject as service } from '@ember/service';
import config from '../config/environment';
import { taskFor } from 'ember-concurrency-ts';
import { task, waitForProperty, TaskGenerator } from 'ember-concurrency';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { MockLocalStorage } from '@cardstack/ssr-web/utils/browser-mocks';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import AppContext from '@cardstack/ssr-web/services/app-context';

declare global {
  interface Window {
    TEST__AUTH_TOKEN?: string;
  }
}

export default class HubAuthentication extends Service {
  @service declare appContext: AppContext;
  @service declare layer2Network: Layer2Network;
  @service declare fastboot: Fastboot;

  storage!: Storage | MockLocalStorage;

  @tracked isAuthenticated = false;

  constructor() {
    super(...arguments);
    if (this.fastboot.isFastBoot) {
      return;
    }

    if (config.environment === 'test') {
      this.storage = new MockLocalStorage();
      if (window.TEST__AUTH_TOKEN) {
        this.storage.setItem('authToken', window.TEST__AUTH_TOKEN);
      }
    } else {
      this.storage = window.localStorage;
    }
    taskFor(this.initializeTask).perform();
  }

  @reads('initializeTask.isRunning') declare isInitializing: boolean;

  @task *initializeTask(): TaskGenerator<void> {
    yield waitForProperty(this.layer2Network, 'isInitializing', false);
    if (yield this.hasValidAuthentication()) {
      this.isAuthenticated = true;
    } else {
      this.authToken = null;
    }
  }

  async hasValidAuthentication() {
    return Boolean(
      this.layer2Network.isConnected &&
        this.authToken &&
        (await this.layer2Network.checkHubAuthenticationValid(this.authToken))
    );
  }

  get authToken(): string | null {
    return this.storage.getItem('authToken');
  }

  set authToken(val: string | null) {
    if (val) {
      // we're not setting isAuthenticated to true here because
      // it is possible to mistakenly set authToken to an arbitrary truthy value
      // in an external consumer
      this.storage.setItem('authToken', val);
    } else {
      // we are currently clearing auth tokens externally by doing
      // HubAuthenticationService.authToken = null
      // this should also make isAuthenticated false
      // could consider using a dedicated method instead
      this.isAuthenticated = false;
      this.storage.removeItem('authToken');
    }
  }

  async ensureAuthenticated(): Promise<void> {
    if (await this.hasValidAuthentication()) {
      return;
    }

    try {
      let newAuthToken = await this.layer2Network.authenticate();

      if (newAuthToken) {
        this.authToken = newAuthToken;
        this.isAuthenticated = true;
      } else {
        this.authToken = null;
        throw new Error('Failed to fetch auth token');
      }
    } catch (e) {
      this.authToken = null;
      throw e;
    }
  }

  get showAuth() {
    if (config.environment === 'development') {
      return true;
    }

    return this.appContext.searchParams.has('auth');
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'hub-authentication': HubAuthentication;
  }
}
