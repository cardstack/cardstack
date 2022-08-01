import { registry, setupHub } from '../helpers/server';
import shortUUID from 'short-uuid';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import assert from 'assert';

class StubAuthenticationUtils {
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

let shouldValidatePurchase = false;
let purchaseValidationProvider: string, purchaseValidationReceipt: any, purchaseValidationResponse: any;

class StubInAppPurchases {
  validate(provider: string, receipt: any) {
    purchaseValidationProvider = provider;
    purchaseValidationReceipt = receipt;

    return { valid: shouldValidatePurchase, response: purchaseValidationResponse };
  }
}

let prisma: ExtendedPrismaClient;

describe('POST /api/profile-purchases', function () {
  setupSentry(this);
  let { getJobIdentifiers, getJobPayloads, getJobSpecs } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('in-app-purchases', StubInAppPurchases);

    shouldValidatePurchase = true;
    purchaseValidationProvider = 'undefined';
    purchaseValidationReceipt = undefined;
    purchaseValidationResponse = {};
  });

  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let container = getContainer();
    prisma = await (await container.lookup('prisma-manager')).getClient();
  });

  it('validates the purchase, persists merchant information, returns a job ticket, and queues a single-attempt CreateProfile task', async function () {
    let merchantId,
      merchantDid,
      jobTicketId: string | undefined = undefined;

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {
            provider: 'a-provider',
            receipt: {
              'a-receipt': 'yes',
            },
          },
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect(function (res) {
        merchantId = res.body.data.id;
        merchantDid = res.body.data.attributes.did;
        jobTicketId = res.body.included.find((included: any) => included.type === 'job-tickets').id;

        expect(res.body).to.deep.equal({
          data: {
            id: merchantId,
            type: 'merchant-infos',
            attributes: {
              name: 'Satoshi Nakamoto',
              did: merchantDid,
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
              'owner-address': stubUserAddress,
            },
          },
          meta: {
            network: 'sokol',
          },
          included: [
            {
              id: jobTicketId,
              type: 'job-tickets',
              attributes: { state: 'pending' },
            },
          ],
        });
      });

    expect(purchaseValidationProvider).to.equal('a-provider');
    expect(purchaseValidationReceipt).to.deep.equal({
      'a-receipt': 'yes',
    });

    let merchantRecord = await prisma.merchantInfo.findUnique({ where: { id: merchantId } });
    assert(!!merchantRecord);
    expect(merchantRecord.name).to.equal('Satoshi Nakamoto');
    expect(merchantRecord.slug).to.equal('satoshi');
    expect(merchantRecord.color).to.equal('ff0000');
    expect(merchantRecord.textColor).to.equal('ffffff');
    expect(merchantRecord.ownerAddress).to.equal(stubUserAddress);

    let cardSpaceRecord = await prisma.cardSpace.findFirst({ where: { merchantId } });
    expect(cardSpaceRecord).to.exist;

    let jobTicketRecord = await prisma.jobTicket.findUnique({ where: { id: jobTicketId! } });
    expect(jobTicketRecord?.state).to.equal('pending');
    expect(jobTicketRecord?.ownerAddress).to.equal(stubUserAddress);
    expect(jobTicketRecord?.payload).to.deep.equal({ 'job-ticket-id': jobTicketId, 'merchant-info-id': merchantId });
    expect(jobTicketRecord?.spec).to.deep.equal({ maxAttempts: 1 });

    expect(getJobIdentifiers()).to.deep.equal(['create-profile']);
    expect(getJobPayloads()).to.deep.equal([{ 'job-ticket-id': jobTicketId, 'merchant-info-id': merchantId }]);
    expect(getJobSpecs()).to.deep.equal([{ maxAttempts: 1 }]);
  });

  it('returns the existing job ticket if the request is a duplicate', async function () {
    let existingJobTicketId = shortUUID.uuid();
    await prisma.jobTicket.create({
      data: {
        id: existingJobTicketId,
        jobType: 'create-profile',
        ownerAddress: stubUserAddress,
        payload: {
          'another-payload': 'okay',
        },
        sourceArguments: {
          provider: 'a-provider',
          receipt: {
            'a-receipt': 'yes',
          },
          somethingelse: 'hmm',
        },
      },
    });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {
            provider: 'a-provider',
            receipt: {
              'a-receipt': 'yes',
            },
          },
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        data: {
          id: existingJobTicketId,
          type: 'job-tickets',
          attributes: { state: 'pending' },
        },
      });

    expect(getJobIdentifiers()).to.be.empty;
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('rejects when the purchase receipt has already been used', async function () {
    await prisma.jobTicket.create({
      data: {
        id: shortUUID.uuid(),
        jobType: 'create-profile',
        ownerAddress: '0xsomeoneelse',
        payload: {
          'another-payload': 'okay',
        },
        sourceArguments: {
          provider: 'a-provider',
          receipt: {
            'a-receipt': 'yes',
          },
        },
      },
    });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {
            provider: 'a-provider',
            receipt: {
              'a-receipt': 'yes',
            },
            extraneous: 'hello',
          },
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid purchase receipt',
            detail: 'Purchase receipt is not valid',
          },
        ],
      });
  });

  it('rejects when the purchase receipt is invalid', async function () {
    shouldValidatePurchase = false;
    purchaseValidationResponse = {
      'a-validation-response': 'yes',
    };

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {
            provider: 'a-provider',
            receipt: {
              'a-receipt': 'yes',
            },
          },
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid purchase receipt',
            detail: 'Purchase receipt is not valid',
            meta: purchaseValidationResponse,
          },
        ],
      });

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'profile-purchases-route',
    });

    expect(sentryReport.error?.message).to.equal(
      `Unable to validate purchase, response: ${JSON.stringify(purchaseValidationResponse)}`
    );
  });

  it('rejects when the merchant information is incomplete', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {
            provider: 'a-provider',
            receipt: {
              'a-receipt': 'yes',
            },
          },
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {},
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing required attribute: name',
            detail: 'Required field name was not provided',
          },
          {
            status: '422',
            title: 'Missing required attribute: slug',
            detail: 'Required field slug was not provided',
          },
          {
            status: '422',
            title: 'Missing required attribute: color',
            detail: 'Required field color was not provided',
          },
          {
            status: '422',
            title: 'Missing required attribute: text-color',
            detail: 'Required field text-color was not provided',
          },
        ],
      });
  });

  it('rejects when the purchase information is incomplete', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
          attributes: {},
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing required attribute: provider',
            detail: 'Required field provider was not provided',
          },
          {
            status: '422',
            title: 'Missing required attribute: receipt',
            detail: 'Required field receipt was not provided',
          },
        ],
      });
  });

  it('rejects a slug with an invalid character', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'sat-oshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid merchant slug',
            detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
          },
        ],
      });
  });

  it('rejects a slug that is too long', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid merchant slug',
            detail: 'Unique ID cannot be more than 50 characters long. It is currently 51 characters long',
          },
        ],
      });
  });

  it('rejects a name that is too long', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'a'.repeat(51),
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid merchant name',
            detail: 'Merchant name cannot exceed 50 characters',
          },
        ],
      });
  });

  it('rejects a slug with a forbidden word', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'cardstack',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid merchant slug',
            detail: 'This ID is not allowed',
          },
        ],
      });
  });

  it('rejects a duplicate slug', async function () {
    await prisma.merchantInfo.create({
      data: {
        id: shortUUID.uuid(),
        name: 'yes',
        slug: 'satoshi',
        color: 'pink',
        textColor: 'black',
        ownerAddress: 'me',
      },
    });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid merchant slug',
            detail: 'This ID is already taken. Please choose another one',
          },
        ],
      });
  });

  it('rejects missing merchant-infos', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '2',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing merchant-infos',
            detail: 'No included merchant-infos with lid 2 was found',
          },
        ],
      });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'what?',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing merchant-infos',
            detail: 'No included merchant-infos with lid 1 was found',
          },
        ],
      });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          what: {
            data: {
              type: 'what',
              lid: '1',
            },
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing merchant-infos',
            detail: 'merchant-info relationship must be included',
          },
        ],
      });
  });
});
