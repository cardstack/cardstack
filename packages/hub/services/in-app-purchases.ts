import https from 'https';
import config from 'config';
import fetch from 'node-fetch';

const appleVerificationURL = new URL(config.get('iap.apple.verificationUrl'));

interface InAppPurchaseValidationResult {
  valid: boolean;
  response: any;
}

export default class InAppPurchases {
  async validate(provider: string, receipt: any): Promise<InAppPurchaseValidationResult> {
    if (provider === 'apple') {
      return this.validateFromApple(receipt);
    }

    if (provider === 'google') {
      return this.validateFromGoogle(receipt);
    }

    throw new Error(`In-app purchase validation is not implemented for provider ${provider}; receipt: ${receipt}`);
  }

  private async validateFromApple(receipt: string): Promise<InAppPurchaseValidationResult> {
    var url = appleVerificationURL.hostname;
    var receiptEnvelope = {
      'receipt-data': receipt,
    };
    var receiptEnvelopeStr = JSON.stringify(receiptEnvelope);
    var options = {
      host: url,
      port: 443,
      path: appleVerificationURL.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(receiptEnvelopeStr),
      },
    };

    return new Promise(function (resolve) {
      let chunks: Uint8Array[] = [];
      var req = https.request(options, function (res) {
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
          chunks.push(Buffer.from(chunk));
        });

        res.on('end', function () {
          try {
            let response = JSON.parse(Buffer.concat(chunks).toString());

            if (response.status === 0) {
              resolve({ valid: true, response });
            } else {
              resolve({ valid: false, response });
            }
          } catch (e) {
            resolve({ valid: false, response: e });
          }
        });

        res.on('error', function (error) {
          resolve({ valid: false, response: error });
        });
      });

      req.write(receiptEnvelopeStr);
      req.end();
    });
  }

  private async validateFromGoogle(token: string): Promise<InAppPurchaseValidationResult> {
    // FIXME this requires auth
    let response = await fetch(`${config.get('iap.google.verificationUrlBase')}/${token}`, {
      method: 'GET',
    });

    let json = await response.json();

    if (response.ok && json.purchaseState === 0) {
      return { valid: true, response: json };
    } else {
      return { valid: false, response: json };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'in-app-purchases': InAppPurchases;
  }
}
