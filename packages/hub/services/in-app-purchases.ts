/* global fetch */
import config from 'config';
import GoogleReceiptVerify from 'google-play-billing-validator';

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
    let verify = new GoogleReceiptVerify({
      email: this.jwt.client_email,
      key: this.jwt.private_key,
    });

    let result = await verify.verifyINAPP({
      packageName: 'com.cardstack.cardpay',
      productId: '0001',
      purchaseToken: token,
    });

    if (result.isSuccessful && result.payload.purchaseState === 0) {
      return { valid: true, response: result.payload };
    } else {
      return { valid: false, response: result.payload };
    }
  }

  private get jwt(): any {
    return config.get('iap.google.serviceAccount');
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'in-app-purchases': InAppPurchases;
  }
}
