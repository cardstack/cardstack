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

describe('GET /api/notification-preferences', async function () {
  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);

    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
      'merchant_revenue_claimed',
      'enabled',
    ]);
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '2cbe34e4-f41d-41d5-b7d2-ee875dc7c588',
      'merchant_payment',
      'enabled',
    ]);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .get('/api/notification-preferences')
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

  it('returns default preferences when none are defined for an EOA', async function () {
    await request()
      .get('/api/notification-preferences')
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
              'notification-type': 'merchant_revenue_claimed',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'enabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'notification-type': 'merchant_payment',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('returns overriden preference when EOA has a preference saved', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();

    let merchantRevenueClaimedNotificationId = '73994d4b-bb3a-4d73-969f-6fa24da16fb4';

    await db.query(
      'INSERT INTO notification_preferences(owner_address, notification_type_id, status) VALUES($1, $2, $3)',
      [stubUserAddress, merchantRevenueClaimedNotificationId, 'disabled']
    );

    await request()
      .get('/api/notification-preferences')
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
              'notification-type': 'merchant_revenue_claimed',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'notification-type': 'merchant_payment',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'enabled',
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
      'merchant_revenue_claimed',
      'enabled',
    ]);
    await db.query('INSERT INTO notification_types(id, notification_type, default_status) VALUES($1, $2, $3)', [
      '2cbe34e4-f41d-41d5-b7d2-ee875dc7c588',
      'merchant_payment',
      'enabled',
    ]);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .get('/api/notification-preferences')
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
            'notification-type': 'merchant_revenue_claimed',
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
            'notification-type': 'merchant_revenue_claimed',
            'owner-address': stubUserAddress,
            status: 'disabled',
          },
        },
      });

    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    let records = await notificationPreferenceQueries.query({
      ownerAddress: stubUserAddress,
      notificationType: 'merchant_revenue_claimed',
    });

    expect(records.length).to.equal(1);
    expect(records[0].ownerAddress).to.equal(stubUserAddress);
    expect(records[0].notificationType).to.equal('merchant_revenue_claimed');
    expect(records[0].status).to.equal('disabled');

    await request()
      .get('/api/notification-preferences')
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
              'notification-type': 'merchant_revenue_claimed',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'notification-type': 'merchant_payment',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'enabled',
            },
          },
        ],
      });
  });

  it('updates a preference', async function () {
    let notificationPreferenceQueries = await getContainer().lookup('notification-preference-queries');
    await notificationPreferenceQueries.insert({
      ownerAddress: stubUserAddress,
      notificationType: 'merchant_payment',
      status: 'disabled',
    });

    await request()
      .post('/api/notification-preferences')
      .send({
        data: {
          type: 'notification-preference',
          attributes: {
            'notification-type': 'merchant_payment',
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
            'notification-type': 'merchant_payment',
            'owner-address': stubUserAddress,
            status: 'disabled',
          },
        },
      });

    let records = await notificationPreferenceQueries.query({
      ownerAddress: stubUserAddress,
    });

    expect(records.length).to.equal(1);
    expect(records[0].ownerAddress).to.equal(stubUserAddress);
    expect(records[0].notificationType).to.equal('merchant_payment');
    expect(records[0].status).to.equal('disabled');

    await request()
      .get('/api/notification-preferences')
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
              'notification-type': 'merchant_revenue_claimed',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'enabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'notification-type': 'merchant_payment',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
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
            'notification-type': 'merchant_revenue_claimed',
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
            'notification-type': 'merchant_revenue_claimed',
            'owner-address': stubUserAddress,
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
            'notification-type': 'merchant_revenue_claimed',
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
            'notification-type': 'merchant_revenue_claimed',
            'owner-address': stubUserAddress,
            status: 'disabled',
          },
        },
      });

    await request()
      .get('/api/notification-preferences')
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
              'notification-type': 'merchant_revenue_claimed',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              status: 'disabled',
            },
          },
          {
            type: 'notification-preference',
            attributes: {
              'notification-type': 'merchant_payment',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
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
            'notification-type': 'merchant_revenue_claimed',
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
            'notification-type': 'merchant_revenue_claimed',
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
            'notification-type': 'merchant_payment',
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
            'notification-type': 'merchant_payment',
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
    });

    expect(records.length).to.equal(2);
    expect(records[0].ownerAddress).to.equal(stubUserAddress);
    expect(records[0].notificationType).to.equal('merchant_revenue_claimed');
    expect(records[0].status).to.equal('enabled');
    expect(records[1].ownerAddress).to.equal(stubUserAddress);
    expect(records[1].notificationType).to.equal('merchant_payment');
    expect(records[1].status).to.equal('enabled');
  });
});
