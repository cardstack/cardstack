import { getSDK } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { getOwner } from '@ember/application';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class HubAuthenticationService extends Service {
  storage: Storage;
  @service declare wallet: WalletService;
  @service declare network: NetworkService;
  @tracked isAuthenticated: boolean | null = null;

  constructor(parameters?: object | undefined) {
    super(parameters);
    this.storage =
      (getOwner(this).lookup('storage:local') as Storage) ||
      window.localStorage;
  }

  async updateAuthenticationValidity() {
    this.isAuthenticated = await this.hasValidAuthentication();
  }

  async ensureAuthenticated(): Promise<void> {
    if (await this.hasValidAuthentication()) {
      return;
    }

    try {
      const hubAuth = await this.getHubAuth();
      const newAuthToken = await hubAuth.authenticate();
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

  async getHubAuth() {
    const ethersProvider = this.wallet.ethersProvider;
    return await getSDK('HubAuth', ethersProvider, config.hubUrl);
  }

  get authTokenKey() {
    return `authToken-${this.wallet.address}-${this.network.chainId}`;
  }

  get authToken(): string | null {
    return this.storage.getItem(this.authTokenKey);
  }

  set authToken(val: string | null) {
    if (val) {
      this.storage.setItem(this.authTokenKey, val);
    } else {
      this.isAuthenticated = false;
      this.storage.removeItem(this.authTokenKey);
    }
  }

  async hasValidAuthentication() {
    const hubAuth = await this.getHubAuth();
    try {
      const authAddress = this.authToken
        ? await hubAuth.getAddress(this.authToken)
        : null;
      return Boolean(
        this.wallet.isConnected && authAddress === this.wallet.address
      );
    } catch (e) {
      if (e === 'Invalid auth token') {
        return false;
      }
      throw e;
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    hubAuthentication: HubAuthenticationService;
  }
}
