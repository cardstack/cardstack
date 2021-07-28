import Service from '@ember/service';
import Layer2Network from './layer2-network';
import { inject as service } from '@ember/service';
import config from '../config/environment';
import { taskFor } from 'ember-concurrency-ts';
import { task, waitForProperty, TaskGenerator } from 'ember-concurrency';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';

declare global {
  interface Window {
    TEST__AUTH_TOKEN?: string;
  }
}

class MockLocalStorage {
  entries = {} as Record<string, string>;
  setItem(key: string, value: string): void {
    this.entries[key] = value;
  }
  getItem(key: string): string | null {
    return this.entries[key];
  }
  removeItem(key: string): void {
    delete this.entries[key];
  }
  get length(): number {
    return Object.keys(this.entries).length;
  }
  clear() {
    this.entries = {};
  }
}

export default class HubAuthentication extends Service {
  @service declare layer2Network: Layer2Network;
  storage!: Storage | MockLocalStorage;

  @tracked isAuthenticated = false;

  constructor() {
    super(...arguments);
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
    if (!this.authToken) return;
    if (!this.layer2Network.isConnected) {
      this.storage.removeItem('authToken');
      return;
    }
    if (!this.authToken) return;
    let isAuthValid = yield this.layer2Network.checkHubAuthenticationValid(
      this.authToken
    );
    if (isAuthValid) {
      this.isAuthenticated = true;
    } else {
      this.storage.removeItem('authToken');
    }
  }

  get authToken(): string | null {
    return this.storage.getItem('authToken');
  }

  set authToken(val: string | null) {
    if (val) {
      this.storage.setItem('authToken', val);
    } else {
      this.storage.removeItem('authToken');
    }
  }

  async ensureAuthenticated(): Promise<string> {
    let { authToken } = this;
    if (!authToken) {
      authToken = await this.layer2Network.authenticate();
      this.authToken = authToken;
      this.isAuthenticated = true;
    }
    return authToken;
  }
}
