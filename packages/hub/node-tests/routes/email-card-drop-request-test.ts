import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { Clock } from '../../services/clock';
import { registry, setupHub } from '../helpers/server';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import crypto from 'crypto';
import { Job, TaskSpec } from 'graphile-worker';
import config from 'config';
import shortUUID from 'short-uuid';

let claimedEoa: EmailCardDropRequest = {
  id: '2850a954-525d-499a-a5c8-3c89192ad40e',
  ownerAddress: '0xclaimedAddress',
  emailHash: 'claimedhash',
  verificationCode: 'claimedverificationcode',
  claimedAt: new Date(),
  requestedAt: new Date(),
};
let unclaimedEmailForClaimedEoa: EmailCardDropRequest = {
  id: '00000000-525d-499a-a5c8-3c89192ad40e',
  ownerAddress: '0xclaimedAddress',
  emailHash: 'claimedhash',
  verificationCode: 'claimedverificationcode',
  requestedAt: new Date(),
};
let unclaimedEoa: EmailCardDropRequest = {
  id: 'b176521d-6009-41ff-8472-147a413da450',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};

let fakeTime = 1650440847689;
let fakeTimeString = new Date(fakeTime).toISOString();
class FrozenClock implements Clock {
  now() {
    return fakeTime;
  }

  hrNow(): bigint {
    throw new Error('Not implemented');
  }
}

const verificationCodeRegex = /^[~.a-zA-Z0-9_-]{10}$/;
const emailVerificationLinkExpiryMinutes = config.get('cardDrop.email.expiryMinutes') as number;

describe('GET /api/email-card-drop-requests', function () {
  let { request, getContainer } = setupHub(this);

  this.beforeAll(function () {
    registry(this).register('clock', FrozenClock);
  });

  this.beforeEach(async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestsQueries.insert(unclaimedEmailForClaimedEoa);
    await emailCardDropRequestsQueries.insert(claimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoa);
  });

  it('returns true if a known EOA has a claim timestamp for its card drop request', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${claimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal(claimedEoa.ownerAddress);
    expect(response.body.data.attributes['rate-limited']).to.equal(false);
    expect(response.body.data.attributes.claimed).to.equal(true);
    expect(response.body.data.attributes.timestamp).to.equal(fakeTimeString);
  });

  it('reports if the rate limit has been reached', async function () {
    let emailCardDropStateQueries = await getContainer().lookup('email-card-drop-state', { type: 'query' });
    await emailCardDropStateQueries.update(true);

    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${claimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.attributes['rate-limited']).to.equal(true);
  });

  it('returns false if a known EOA does not have a claim timestamp for its card drop request', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${unclaimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal(unclaimedEoa.ownerAddress);
    expect(response.body.data.attributes.claimed).to.equal(false);
    expect(response.body.data.attributes.timestamp).to.equal(fakeTimeString);
  });

  it('returns false if the EOA is not in the db', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=notrecorded`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal('notrecorded');
    expect(response.body.data.attributes.claimed).to.equal(false);
    expect(response.body.data.attributes.timestamp).to.equal(fakeTimeString);
  });

  it('errors if the EOA query parameter is not provided', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(400);
    expect(response.body).to.deep.equal({
      errors: [
        {
          code: '400',
          title: 'Missing required parameter: eoa',
          detail: 'Please provide an ethereum address via the eoa query parameter',
        },
      ],
    });
  });
});

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

let jobIdentifiers: string[] = [];
let jobPayloads: any[] = [];
class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    jobIdentifiers.push(identifier);
    jobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}

let mockPrepaidCardMarketContractPaused = false;
let mockPrepaidCardQuantity = 100;

class StubCardpaySDK {
  getSDK(sdk: string) {
    switch (sdk) {
      case 'PrepaidCardMarketV2':
        return Promise.resolve({
          getQuantity: () => Promise.resolve(mockPrepaidCardQuantity),
          isPaused: () => Promise.resolve(mockPrepaidCardMarketContractPaused),
        });
      default:
        throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
    }
  }
}

describe('POST /api/email-card-drop-requests', function () {
  setupSentry(this);

  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('cardpay', StubCardpaySDK);
    registry(this).register('worker-client', StubWorkerClient);
    registry(this).register('clock', FrozenClock);

    mockPrepaidCardMarketContractPaused = false;
    mockPrepaidCardQuantity = 50;
  });

  let { request, getContainer } = setupHub(this);

  this.afterEach(async function () {
    jobIdentifiers = [];
    jobPayloads = [];
  });

  it('persists an email card drop request and triggers jobs', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    let insertionTimeInMs = Date.now() - emailVerificationLinkExpiryMinutes * 2 * 60 * 1000;

    // Create no-longer-active reservations

    for (let i = 0; i < mockPrepaidCardQuantity + 1; i++) {
      await emailCardDropRequestsQueries.insert({
        ownerAddress: `0xother${i}`,
        emailHash: `other-email-hash-${i}`,
        verificationCode: 'x',
        id: shortUUID.uuid(),
        requestedAt: new Date(insertionTimeInMs),
      });
    }

    let email = 'valid@example.com';

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email,
        },
      },
    };

    let resourceId = null;

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(201)
      .expect(function (res) {
        resourceId = res.body.data.id;
      });

    let emailCardDropRequest = (await emailCardDropRequestsQueries.query({ ownerAddress: stubUserAddress }))[0];

    expect(emailCardDropRequest.ownerAddress).to.equal(stubUserAddress);
    expect(emailCardDropRequest.verificationCode).to.match(verificationCodeRegex);

    let hash = crypto.createHmac('sha256', config.get('emailHashSalt'));
    hash.update(email);
    let emailHash = hash.digest('hex');

    expect(emailCardDropRequest.emailHash).to.equal(emailHash);

    expect(jobIdentifiers).to.deep.equal(['send-email-card-drop-verification', 'subscribe-email']);
    expect(jobPayloads).to.deep.equal([{ id: resourceId, email }, { email }]);
  });

  it('persists a new request for a given EOA and runs jobs if a request is present but has not been claimed', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    let email = 'valid@example.com';
    let email2 = 'second.valid.email@example.com';

    let hash = crypto.createHmac('sha256', config.get('emailHashSalt'));
    hash.update(email);
    let emailHash = hash.digest('hex');
    let emailHash2 = crypto.createHmac('sha256', config.get('emailHashSalt')).update(email2).digest('hex');

    let insertionTimeInMs = fakeTime - 60 * 1000;
    await emailCardDropRequestsQueries.insert({
      ownerAddress: stubUserAddress,
      emailHash,
      verificationCode: 'x',
      id: '2850a954-525d-499a-a5c8-3c89192ad40e',
      requestedAt: new Date(insertionTimeInMs),
    });

    expect((await emailCardDropRequestsQueries.query({ ownerAddress: stubUserAddress })).length).to.equal(1);

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: email2,
        },
      },
    };

    let resourceId = null;

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(201)
      .expect(function (res) {
        resourceId = res.body.data.id;
      });

    let allRequests = await emailCardDropRequestsQueries.query({ ownerAddress: stubUserAddress });
    let latestRequest = await emailCardDropRequestsQueries.latestRequest(stubUserAddress);

    expect(allRequests.length).to.equal(2);
    expect(allRequests.find((v) => v.id === '2850a954-525d-499a-a5c8-3c89192ad40e')).to.not.be.undefined;
    expect(latestRequest.id).to.not.equal('2850a954-525d-499a-a5c8-3c89192ad40e');
    expect(latestRequest.verificationCode).to.match(verificationCodeRegex);
    expect(latestRequest.emailHash).to.equal(emailHash2);
    expect(Number(latestRequest.requestedAt)).to.equal(fakeTime);

    expect(jobIdentifiers).to.deep.equal(['send-email-card-drop-verification', 'subscribe-email']);
    expect(jobPayloads).to.deep.equal([{ id: resourceId, email: email2 }, { email: email2 }]);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/email-card-drop-requests')
      .send({})
      .set('Accept', 'application/vnd.api+json')
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

  it('rejects with 503 when getQuantity is zero', async function () {
    mockPrepaidCardQuantity = 0;

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(503)
      .expect({
        errors: [
          {
            status: '503',
            title: 'There are no prepaid cards available',
          },
        ],
      });
  });

  it('rejects with 503 when getQuantity is less than active reservations', async function () {
    mockPrepaidCardQuantity = 5;

    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    let insertionTimeInMs = Date.now() - (emailVerificationLinkExpiryMinutes / 2) * 60 * 1000;

    for (let i = 0; i < mockPrepaidCardQuantity + 1; i++) {
      await emailCardDropRequestsQueries.insert({
        ownerAddress: `0xother${i}`,
        emailHash: `other-email-hash-${i}`,
        verificationCode: 'x',
        id: `2850a954-525d-499a-a5c8-3c89192ad40${i}`,
        requestedAt: new Date(insertionTimeInMs),
      });
    }

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(503)
      .expect({
        errors: [
          {
            status: '503',
            title: 'There are no prepaid cards available',
          },
        ],
      });
  });

  it('rejects with 503 when the contract is paused', async function () {
    mockPrepaidCardMarketContractPaused = true;

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(503)
      .expect({
        errors: [
          {
            status: '503',
            title: 'The prepaid card market contract is paused',
          },
        ],
      });
  });

  it('rejects if the rate limit has been triggered', async function () {
    let emailCardDropStateQueries = await getContainer().lookup('email-card-drop-state', { type: 'query' });
    await emailCardDropStateQueries.update(true);

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(503)
      .expect({
        errors: [
          {
            status: '503',
            title: 'Rate limit has been triggered',
          },
        ],
      });
  });

  it('rejects and triggers the rate limit if enough drops have happened in the interval', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    let { count, periodMinutes } = config.get('cardDrop.email.rateLimit');

    for (let i = 0; i <= count; i++) {
      let claim = Object.assign({}, claimedEoa);
      claim.claimedAt = new Date(Date.now() - periodMinutes * 60 * 1000);
      claim.id = shortUUID.uuid();
      await emailCardDropRequestsQueries.insert(claim);
    }

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(503)
      .expect({
        errors: [
          {
            status: '503',
            title: 'Rate limit has been triggered',
          },
        ],
      });

    let emailCardDropStateQueries = await getContainer().lookup('email-card-drop-state', { type: 'query' });
    let limited = await emailCardDropStateQueries.read();

    expect(limited).to.equal(true);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      event: 'email-card-drop-rate-limit-reached',
    });

    expect(sentryReport.level).to.equal('fatal');
    expect(sentryReport.error?.message).to.equal('Card drop rate limit has been triggered');
  });

  it('does not trigger the rate limit when the claims are outside the rate limit period', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    let { count, periodMinutes } = config.get('cardDrop.email.rateLimit');

    for (let i = 0; i <= count * 2; i++) {
      let claim = Object.assign({}, claimedEoa);
      claim.claimedAt = new Date(Date.now() - 2 * periodMinutes * 60 * 1000);
      claim.id = shortUUID.uuid();
      await emailCardDropRequestsQueries.insert(claim);
    }

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'valid@example.com',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(201);
  });

  it('rejects an invalid email', async function () {
    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: 'notanemail',
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(422)
      .expect({
        errors: [
          {
            detail: 'Email address is not valid',
            source: { pointer: '/data/attributes/email' },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });

  it('rejects when the owner address has already claimed', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    await emailCardDropRequestsQueries.insert({
      ownerAddress: stubUserAddress,
      emailHash: 'abc123',
      verificationCode: 'I4I.FX8OUx',
      id: '2850a954-525d-499a-a5c8-3c89192ad40e',
      requestedAt: new Date(),
      claimedAt: new Date(),
    });

    let email = 'valid@example.com';

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email,
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(422)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Address has already claimed a prepaid card',
          },
        ],
      });
  });

  it('rejects when the email has already claimed', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    let email = 'example@gmail.com';

    let hash = crypto.createHmac('sha256', config.get('emailHashSalt'));
    hash.update(email);
    let emailHash = hash.digest('hex');

    await emailCardDropRequestsQueries.insert({
      ownerAddress: '0xanother-address',
      emailHash,
      verificationCode: 'I4I.FX8OUx',
      id: '2850a954-525d-499a-a5c8-3c89192ad40e',
      requestedAt: new Date(),
      claimedAt: new Date(),
    });

    const payload = {
      data: {
        type: 'email-card-drop-requests',
        attributes: {
          email: email.replace('@', '+subaddress@'),
        },
      },
    };

    await request()
      .post('/api/email-card-drop-requests')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .send(payload)
      .expect(422)
      .expect({
        errors: [
          {
            status: '422',
            pointer: '/data/attributes/email',
            title: 'Email has already claimed a prepaid card',
          },
        ],
      });
  });
});
