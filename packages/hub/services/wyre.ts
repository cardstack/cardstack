import config from 'config';
import fetch from 'node-fetch';

interface WyreConfig {
  accountId: string;
  apiKey: string;
  secretKey: string;
  url: string;
  callbackUrl: string;
}

interface WyreWallet {
  status: string | null;
  callbackUrl: string | null;
  srn: string;
  pusherChannel: string;
  notes: string | null;
  balances: {
    [network: string]: number;
  };
  depositAddresses: {
    [network: string]: string;
  };
  totalBalances: {
    [network: string]: number;
  };
  availableBalances: {
    [network: string]: number;
  };
  savingsReferralSRN: string | null;
  name: string;
  id: string;
  type: 'DEFAULT' | 'ENTERPRISE' | 'SAVINGS';
}

export default class Wyre {
  private get config() {
    return config.get('wyre') as WyreConfig;
  }

  async createCustodialWallet(address: string): Promise<WyreWallet> {
    let { url, secretKey, callbackUrl } = this.config;
    let result = await fetch(`${url}/v2/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${secretKey}`, // eslint-disable-line @typescript-eslint/naming-convention
      },
      body: JSON.stringify({
        name: address,
        callbackUrl,
      }),
    });
    return (await result.json()) as WyreWallet;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    wyre: Wyre;
  }
}
