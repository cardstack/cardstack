import InAppPurchases from '../../services/in-app-purchases';
import { setupHub } from '../helpers/server';
import { rest } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';
import config from 'config';

describe('InAppPurchases', function () {
  let { getContainer } = setupHub(this);
  let subject: InAppPurchases;

  this.beforeEach(async function () {
    subject = await getContainer().lookup('in-app-purchases');
  });

  describe('for Apple provider', function () {
    let mockServer: SetupServerApi;
    let receiptSentToServer: keyof typeof mockResponses.apple;

    this.beforeEach(function () {
      mockServer = setupServer(
        rest.post(config.get('iap.apple.verificationUrl'), (req, res, ctx) => {
          let body = JSON.parse(req.body as string);
          receiptSentToServer = body['receipt-data'];
          return res(ctx.status(200), ctx.json(mockResponses.apple[receiptSentToServer]));
        })
      );

      mockServer.listen({ onUnhandledRequest: 'error' });
    });

    this.afterEach(function () {
      mockServer.close();
    });

    it('passes along a successful validation', async function () {
      let validationResponse = await subject.validate('apple', 'VALID_RECEIPT');

      expect(receiptSentToServer).to.equal('VALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: true,
        response: mockResponses.apple['VALID_RECEIPT'],
      });
    });

    it('passes along a failed validation', async function () {
      let validationResponse = await subject.validate('apple', 'INVALID_RECEIPT');

      expect(receiptSentToServer).to.equal('INVALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: false,
        response: mockResponses.apple['INVALID_RECEIPT'],
      });
    });
  });

  describe('for Google provider', function () {
    let mockServer: SetupServerApi;
    let receiptSentToServer: keyof typeof mockResponses.google;

    this.beforeEach(function () {
      mockServer = setupServer(
        rest.get(`${config.get('iap.google.verificationUrlBase')}/:token`, (req, res, ctx) => {
          receiptSentToServer = req.params.token as keyof typeof mockResponses.google;
          let response = mockResponses.google[receiptSentToServer];
          return res(ctx.status(response.status), ctx.json(response.json));
        })
      );

      mockServer.listen({ onUnhandledRequest: 'error' });
    });

    this.afterEach(function () {
      mockServer.close();
    });

    it('passes along a successful validation', async function () {
      let validationResponse = await subject.validate('google', 'VALID_RECEIPT');

      expect(receiptSentToServer).to.equal('VALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: true,
        response: mockResponses.google['VALID_RECEIPT'].json,
      });
    });

    it('passes along a failed validation', async function () {
      let validationResponse = await subject.validate('google', 'INVALID_RECEIPT');

      expect(receiptSentToServer).to.equal('INVALID_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: false,
        response: mockResponses.google['INVALID_RECEIPT'].json,
      });
    });

    it('passes along a failed validation for a canceled purchase', async function () {
      let validationResponse = await subject.validate('google', 'CANCELED_RECEIPT');

      expect(validationResponse).to.deep.equal({
        valid: false,
        response: mockResponses.google['CANCELED_RECEIPT'].json,
      });
    });
  });
});

const mockResponses = {
  apple: {
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
  },
  google: {
    VALID_RECEIPT: {
      status: 200,
      json: {
        resource: {
          purchaseTimeMillis: '1630529397125',
          purchaseState: 0,
          consumptionState: 0,
          developerPayload: '',
          orderId: 'GPA.3374-2691-3583-90384',
          acknowledgementState: 1,
          kind: 'androidpublisher#productPurchase',
          regionCode: 'RU',
        },
      },
    },
    INVALID_RECEIPT: {
      status: 400,
      json: {
        error: {
          code: 400,
          message: 'Invalid Value',
          errors: [
            {
              message: 'Invalid Value',
              domain: 'global',
              reason: 'invalid',
            },
          ],
        },
      },
    },
    CANCELED_RECEIPT: {
      status: 200,
      json: {
        resource: {
          purchaseTimeMillis: '1630529397125',
          purchaseState: 1,
          consumptionState: 0,
          developerPayload: '',
          orderId: 'GPA.3374-2691-3583-90384',
          acknowledgementState: 1,
          kind: 'androidpublisher#productPurchase',
          regionCode: 'RU',
        },
      },
    },
  },
};
