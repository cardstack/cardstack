import Service from '@ember/service';
import Layer2Network from './layer2-network';
import { inject as service } from '@ember/service';
import config from '../config/environment';

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
}

export default class HubAuthentication extends Service {
  @service declare layer2Network: Layer2Network;
  storage =
    config.environment === 'test'
      ? new MockLocalStorage()
      : window.localStorage;

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
    }
    return authToken;
  }
}
