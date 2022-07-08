/* global fetch */
import config from 'config';

interface InAppPurchaseValidationResult {
  valid: boolean;
  response: any;
}

export default class InAppPurchases {
  async validate(provider: 'google' | 'apple', receipt: string): Promise<InAppPurchaseValidationResult> {
    if (provider === 'apple') {
      return this.validateFromApple(receipt);
    }

    if (provider === 'google') {
      return this.validateFromGoogle(receipt);
    }

    throw new Error(`In-app purchase validation is not implemented for provider ${provider}; receipt: ${receipt}`);
  }

  private async validateFromApple(receipt: string): Promise<InAppPurchaseValidationResult> {
    let requestBody = {
      'receipt-data': receipt,
    };

    let response = await fetch(config.get('iap.apple.verificationUrl'), {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    let json = await response.json();

    if (json.status === 0) {
      return { valid: true, response: json };
    } else {
      return { valid: false, response: json };
    }
  }

  private async validateFromGoogle(token: string): Promise<InAppPurchaseValidationResult> {
    // TODO this needs OAuth to truly work, see CS-4199
    let response = await fetch(`${config.get('iap.google.verificationUrlBase')}/${token}`, {
      method: 'GET',
    });

    let json = await response.json();

    if (response.ok && json.resource.purchaseState === 0) {
      return { valid: true, response: json };
    } else {
      return { valid: false, response: json };
    }
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    'in-app-purchases': InAppPurchases;
  }
}
