import { setupHub } from '../helpers/server';
import { rest } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';

describe('InAppPurchases', function () {
  let { getContainer } = setupHub(this);

  describe('for Apple provider', function () {
    let mockServer: SetupServerApi;
    let receiptSentToServer: keyof typeof mockResponses;

    this.beforeEach(function () {
      mockServer = setupServer(
        rest.post('https://sandbox.itunes.apple.com/verifyReceipt', (req, res, ctx) => {
          let body = JSON.parse(req.body as string);
          receiptSentToServer = body['receipt-data'];
          return res(ctx.status(200), ctx.json(mockResponses[receiptSentToServer]));
        })
      );

      mockServer.listen();
    });

    this.afterEach(function () {
      mockServer.close();
    });

    it('passes along a successful validation', async function () {
      let subject = await getContainer().lookup('in-app-purchases');
      let validationResponse = await subject.validate('apple', 'VALID_RECEIPT');

      expect(receiptSentToServer).to.equal('VALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: true,
        response: validationResponse,
      });
    });

    it('passes along a failed validation', async function () {
      let subject = await getContainer().lookup('in-app-purchases');
      let validationResponse = await subject.validate('apple', 'INVALID_RECEIPT');

      expect(receiptSentToServer).to.equal('INVALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: false,
        response: validationResponse,
      });
    });
  });
});

const mockResponses = {
  VALID_RECEIPT: {
    receipt: {
      receipt_type: 'ProductionSandbox',
      adam_id: 0,
      app_item_id: 0,
      bundle_id: 'com.cardstack.cardpay',
      application_version: '1',
      download_id: 0,
      version_external_identifier: 0,
      receipt_creation_date: '2022-07-01 12:28:57 Etc/GMT',
      receipt_creation_date_ms: '1656678537000',
      receipt_creation_date_pst: '2022-07-01 05:28:57 America/Los_Angeles',
      request_date: '2022-07-04 16:18:11 Etc/GMT',
      request_date_ms: '1656951491832',
      request_date_pst: '2022-07-04 09:18:11 America/Los_Angeles',
      original_purchase_date: '2013-08-01 07:00:00 Etc/GMT',
      original_purchase_date_ms: '1375340400000',
      original_purchase_date_pst: '2013-08-01 00:00:00 America/Los_Angeles',
      original_application_version: '1.0',
      in_app: [
        {
          quantity: '1',
          product_id: '0001',
          transaction_id: '2000000094963678',
          original_transaction_id: '2000000094963678',
          purchase_date: '2022-07-01 12:28:57 Etc/GMT',
          purchase_date_ms: '1656678537000',
          purchase_date_pst: '2022-07-01 05:28:57 America/Los_Angeles',
          original_purchase_date: '2022-07-01 12:28:57 Etc/GMT',
          original_purchase_date_ms: '1656678537000',
          original_purchase_date_pst: '2022-07-01 05:28:57 America/Los_Angeles',
          is_trial_period: 'false',
          in_app_ownership_type: 'PURCHASED',
        },
      ],
    },
    environment: 'Sandbox',
    status: 0,
  },
  INVALID_RECEIPT: { status: 21003 },
};
