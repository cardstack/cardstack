import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { Clock } from '../../services/clock';
import { registry, setupHub } from '../helpers/server';
import crypto from 'crypto';
import { Job, TaskSpec } from 'graphile-worker';
import config from 'config';

let claimedEoa: EmailCardDropRequest = {
  id: '2850a954-525d-499a-a5c8-3c89192ad40e',
  ownerAddress: '0xclaimedAddress',
  emailHash: 'claimedhash',
  verificationCode: 'claimedverificationcode',
  claimedAt: new Date(),
  requestedAt: new Date(),
  transactionHash: '0xclaimedAddressTxnHash',
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

const verificationCodeRegex = /^[~.a-zA-Z0-9_-]{10}$/;

describe('GET /api/email-card-drop-requests', function () {
  let { request, getContainer } = setupHub(this);

  this.beforeAll(function () {
    registry(this).register(
      'clock',
      class FrozenClock implements Clock {
        now() {
          return fakeTime;
        }

        hrNow(): bigint {
          throw new Error('Not implemented');
        }
      }
    );
  });

  this.beforeEach(async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestsQueries.insert(claimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoa);
  });

  it('returns true if a known EOA has a transaction hash recorded for its card drop request', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${claimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal(claimedEoa.ownerAddress);
    expect(response.body.data.attributes.claimed).to.equal(true);
    expect(response.body.data.attributes.timestamp).to.equal(fakeTimeString);
  });

  it('returns false if a known EOA does not have a transaction hash recorded for its card drop request', async function () {
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

describe('POST /api/email-card-drop-requests', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request, getContainer } = setupHub(this);

  this.afterEach(async function () {
    jobIdentifiers = [];
    jobPayloads = [];
  });

  it('persists an email card drop request and triggers jobs', async function () {
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

    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    let emailCardDropRequest = (await emailCardDropRequestsQueries.query({ ownerAddress: stubUserAddress }))[0];

    expect(emailCardDropRequest.ownerAddress).to.equal(stubUserAddress);
    expect(emailCardDropRequest.verificationCode).to.match(verificationCodeRegex);

    let hash = crypto.createHmac('sha256', config.get('authSecret'));
    hash.update(email);
    let emailHash = hash.digest('hex');

    expect(emailCardDropRequest.emailHash).to.equal(emailHash);

    expect(jobIdentifiers).to.deep.equal(['send-email-card-drop-verification', 'subscribe-email']);
    expect(jobPayloads).to.deep.equal([
      { id: resourceId, email },
      { id: resourceId, email },
    ]);
  });

  it('sends another email if a request is present but has not been claimed', async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });

    let email = 'valid@example.com';

    let hash = crypto.createHmac('sha256', config.get('authSecret'));
    hash.update(email);
    let emailHash = hash.digest('hex');

    await emailCardDropRequestsQueries.insert({
      ownerAddress: stubUserAddress,
      emailHash,
      verificationCode: 'xxxxxxyyyy',
      id: '2850a954-525d-499a-a5c8-3c89192ad40e',
      requestedAt: new Date(),
    });

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
      .expect(200)
      .expect(function (res) {
        resourceId = res.body.data.id;
      });

    let emailCardDropRequest = (await emailCardDropRequestsQueries.query({ ownerAddress: stubUserAddress }))[0];

    expect(emailCardDropRequest.verificationCode).to.match(verificationCodeRegex);

    expect(jobIdentifiers).to.deep.equal(['send-email-card-drop-verification']);
    expect(jobPayloads).to.deep.equal([{ id: resourceId, email }]);
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

    let hash = crypto.createHmac('sha256', config.get('authSecret'));
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
