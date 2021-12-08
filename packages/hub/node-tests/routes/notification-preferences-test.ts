import { registry, setupHub } from '../helpers/server';

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

describe('GET /api/notification-preferences/:push_client_id', async function () {
  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);

    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
      'merchant_claim',
      'enabled',
    ]);
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '2cbe34e4-f41d-41d5-b7d2-ee875dc7c588',
      'customer_payment',
      'enabled',
    ]);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .get('/api/notification-preferences/PUSH_CLIENT_ID')
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

  it('returns default preferences when none are defined for the EOA/device pair', async function () {
    await request()
      .get('/api/notification-preferences/1234567')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'enabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('returns overriden preference when EOA/device pair has a preference saved', async function () {
    let pushClientId = '1234567';

    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    await notificationPreferenceQueries.upsert({
      ownerAddress: stubUserAddress,
      pushClientId,
      notificationType: 'customer_payment',
      status: 'disabled',
    });

    await request()
      .get(`/api/notification-preferences/${pushClientId}`)
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'enabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'disabled',
            },
          },
        ],
      });
  });
});

describe('POST /api/notification-preferences', async function () {
  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);

    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
      'merchant_claim',
      'enabled',
    ]);
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '2cbe34e4-f41d-41d5-b7d2-ee875dc7c588',
      'customer_payment',
      'enabled',
    ]);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .get('/api/notification-preferences/1234567')
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

  it('creates a new preference', async function () {
    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect({
        data: {
          type: 'notification-preference',
          attributes: {
            'owner-address': stubUserAddress,
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      });

    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    let records = await notificationPreferenceQueries.query({
      ownerAddress: stubUserAddress,
      pushClientId: '1234567',
      notificationType: 'merchant_claim',
    });

    expect(records.length).to.equal(1);
    expect(records[0].ownerAddress).to.equal(stubUserAddress);
    expect(records[0].pushClientId).to.equal('1234567');
    expect(records[0].notificationType).to.equal('merchant_claim');
    expect(records[0].status).to.equal('disabled');

    await request()
      .get('/api/notification-preferences/1234567')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('updates a preference', async function () {
    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    await notificationPreferenceQueries.upsert({
      ownerAddress: stubUserAddress,
      pushClientId: '1234567',
      notificationType: 'customer_payment',
      status: 'disabled',
    });

    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'customer_payment',
            status: 'disabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect({
        data: {
          type: 'notification-preference',
          attributes: {
            'owner-address': stubUserAddress,
            'push-client-id': '1234567',
            'notification-type': 'customer_payment',
            status: 'disabled',
          },
        },
      });

    let records = await notificationPreferenceQueries.query({
      ownerAddress: stubUserAddress,
      pushClientId: '1234567',
    });

    expect(records.length).to.equal(1);
    expect(records[0].ownerAddress).to.equal(stubUserAddress);
    expect(records[0].pushClientId).to.equal('1234567');
    expect(records[0].notificationType).to.equal('customer_payment');
    expect(records[0].status).to.equal('disabled');

    await request()
      .get('/api/notification-preferences/1234567')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'enabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'disabled',
            },
          },
        ],
      });
  });

  it('is idempotent when saving a new preference', async function () {
    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect({
        data: {
          type: 'notification-preference',
          attributes: {
            'owner-address': stubUserAddress,
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      });

    // second same request
    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'owner-address': stubUserAddress,
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      });

    await request()
      .get('/api/notification-preferences/1234567')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('does not create duplicates when toggling a couple of times', async function () {
    await request()
      .post('/api/notification-preferences')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .expect(201);

    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'enabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'customer_payment',
            status: 'disabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'customer_payment',
            status: 'enabled',
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    let records = await notificationPreferenceQueries.query({
      ownerAddress: stubUserAddress,
      pushClientId: '1234567',
    });

    expect(records.length).to.equal(2);

    let revenueClaimedPreference = records.find((r) => r.notificationType === 'merchant_claim')!;
    let merchantPaymentPreference = records.find((r) => r.notificationType === 'customer_payment')!;

    expect(revenueClaimedPreference.ownerAddress).to.equal(stubUserAddress);
    expect(revenueClaimedPreference.pushClientId).to.equal('1234567');
    expect(revenueClaimedPreference.notificationType).to.equal('merchant_claim');
    expect(revenueClaimedPreference.status).to.equal('enabled');
    expect(merchantPaymentPreference.ownerAddress).to.equal(stubUserAddress);
    expect(merchantPaymentPreference.pushClientId).to.equal('1234567');
    expect(merchantPaymentPreference.notificationType).to.equal('customer_payment');
    expect(merchantPaymentPreference.status).to.equal('enabled');
  });

  it('allows creating preferences for multiple devices on a single EOA', async function () {
    await request()
      .post('/api/notification-preferences')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '1234567',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .expect(201);

    await request()
      .post('/api/notification-preferences')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'push-client-id': '7654321',
            'notification-type': 'merchant_claim',
            status: 'disabled',
          },
        },
      })
      .expect(201);

    // At this point, an EOA should have two sets of notification preferences, for each device
    await request()
      .get('/api/notification-preferences/1234567')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'merchant_claim',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '1234567',
              'notification-type': 'customer_payment',
              status: 'enabled',
            },
          },
        ],
      });

    await request()
      .get('/api/notification-preferences/7654321')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '7654321',
              'notification-type': 'merchant_claim',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'push-client-id': '7654321',
              'notification-type': 'customer_payment',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('should fail when mandatory attributes are not given', async function () {
    await request()
      .post('/api/notification-preferences')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {},
        },
      })
      .expect(422)
      .expect({
        errors: [
          {
            detail: 'Must be present',
            source: {
              pointer: '/data/attributes/status',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'Must be present',
            source: {
              pointer: '/data/attributes/notification-type',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'Must be present',
            source: {
              pointer: '/data/attributes/push-client-id',
            },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });
});
