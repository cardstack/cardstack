import shortUuid from 'short-uuid';
import { registry, setupHub } from '../helpers/server';
import { ExtendedPrismaClient } from '../../services/prisma-manager';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();

class StubAuthenticationUtils {
  generateNonce() {
    return stubNonce;
  }
  buildAuthToken() {
    return stubAuthToken;
  }
  extractVerifiedTimestamp(_nonce: string) {
    return stubTimestamp;
  }

  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('POST /api/push-notification-registrations', async function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });
  let { request, getContainer } = setupHub(this);
  let prisma: ExtendedPrismaClient;

  this.beforeEach(async function () {
    prisma = await (await getContainer().lookup('prisma-manager')).getClient();
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/push-notification-registrations')
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

  it('persists push notification registration', async function () {
    let payload = {
      data: {
        type: 'push-notification-registration',
        attributes: {
          'push-client-id': 'FIREBASE_USER_ID',
        },
      },
    };

    await request()
      .post('/api/push-notification-registrations')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        res.body.data.id = 'id';
      })
      .expect({
        data: {
          id: 'id',
          type: 'push-notification-registration',
          attributes: {
            'owner-address': stubUserAddress,
            'push-client-id': 'FIREBASE_USER_ID',
            'disabled-at': null,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let records = await prisma.push_notification_registrations.findMany({
      where: {
        owner_address: stubUserAddress,
        push_client_id: 'FIREBASE_USER_ID',
      },
    });

    expect(records.length).to.equal(1);
    expect(records[0].owner_address).to.equal(stubUserAddress);
    expect(records[0].push_client_id).to.equal('FIREBASE_USER_ID');
  });

  it('does not fail when registration is already present + it reenables the existing one', async function () {
    await prisma.push_notification_registrations.upsertByOwnerAndPushClient({
      id: shortUuid.uuid(),
      owner_address: stubUserAddress,
      push_client_id: 'FIREBASE_USER_ID',
      disabled_at: new Date(),
    });

    let payload = {
      data: {
        type: 'push-notification-registration',
        attributes: {
          'push-client-id': 'FIREBASE_USER_ID',
        },
      },
    };

    await request()
      .post('/api/push-notification-registrations')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        res.body.data.id = 'id';
      })
      .expect({
        data: {
          id: 'id',
          type: 'push-notification-registration',
          attributes: {
            'owner-address': stubUserAddress,
            'push-client-id': 'FIREBASE_USER_ID',
            'disabled-at': null,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let records = await prisma.push_notification_registrations.findMany({
      where: {
        owner_address: stubUserAddress,
        push_client_id: 'FIREBASE_USER_ID',
      },
    });

    expect(records.length).to.equal(1);
    expect(records[0].owner_address).to.equal(stubUserAddress);
    expect(records[0].push_client_id).to.equal('FIREBASE_USER_ID');
  });
});

describe('DELETE /api/push-notification-registrations', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });
  let { request, getContainer } = setupHub(this);
  let prisma: ExtendedPrismaClient;

  this.beforeEach(async function () {
    prisma = await (await getContainer().lookup('prisma-manager')).getClient();
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/push-notification-registrations')
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

  it('deletes push notification registration', async function () {
    await prisma.push_notification_registrations.upsertByOwnerAndPushClient({
      id: shortUuid.uuid(),
      owner_address: stubUserAddress,
      push_client_id: 'FIREBASE_USER_ID',
      disabled_at: null,
    });

    await request()
      .delete(`/api/push-notification-registrations/FIREBASE_USER_ID`)
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200);

    let records = await prisma.push_notification_registrations.findMany({
      where: {
        owner_address: stubUserAddress,
        push_client_id: 'FIREBASE_USER_ID',
      },
    });

    expect(records.length).to.equal(0);
  });
});
