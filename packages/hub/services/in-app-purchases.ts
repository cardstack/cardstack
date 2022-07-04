import https from 'https';

interface InAppPurchaseValidationResult {
  valid: boolean;
  response: any;
}

export default class InAppPurchases {
  async validate(provider: string, receipt: any): Promise<InAppPurchaseValidationResult> {
    if (provider !== 'apple') {
      console.error(`In-app purchase validation is not implemented for provider ${provider}, receipt is`, receipt);

      return Promise.resolve({ valid: true, response: {} });
    }

    var url = 'sandbox.itunes.apple.com';
    var receiptEnvelope = {
      'receipt-data': receipt,
    };
    var receiptEnvelopeStr = JSON.stringify(receiptEnvelope);
    var options = {
      host: url,
      port: 443,
      path: '/verifyReceipt',
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
}

declare module '@cardstack/di' {
  interface KnownServices {
    'in-app-purchases': InAppPurchases;
  }
}
