import { setupHub } from '../helpers/server';

describe('NotificationPreferenceService', function () {
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
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
    let registrationQueries = await getContainer().lookup('push-notification-registration-queries');
    let preferenceQueries = await getContainer().lookup('notification-preference-queries');

    // 1st device
    await registrationQueries.upsert({
      id: 'f6942dbf-1422-4c3f-baa3-24f0c5b5d475',
      ownerAddress: '0x01',
      pushClientId: '123',
      disabledAt: null,
    });

    // 2nd device
    await registrationQueries.upsert({
      id: '5ffa1144-6a8d-4a43-98bd-ce526f48b7e4',
      ownerAddress: '0x01',
      pushClientId: '124',
      disabledAt: null,
    });

    // 3rd device, disabled
    await registrationQueries.upsert({
      id: 'c7ef64dd-a608-4f0a-8a48-ce58c66e7f20',
      ownerAddress: '0x01',
      pushClientId: '125',
      disabledAt: '2021-12-09T10:28:16.921',
    });

    // device from some other EOA
    await registrationQueries.upsert({
      id: '6ab0df2c-880d-433d-8e37-fb916afaf6ec',
      ownerAddress: '0x02',
      pushClientId: '888',
      disabledAt: null,
    });

    // Preference override for 1st device
    await preferenceQueries.upsert({
      ownerAddress: '0x01',
      pushClientId: '123',
      notificationType: 'customer_payment',
      status: 'disabled',
    });
  });

  it('returns preferences for an EOA', async function () {
    let service = await getContainer().lookup('notification-preference-service');

    let preferences = await service.getPreferences('0x01');

    // 1st device (123) has a preference override for customer_payment
    // 2nd device (124) has default preferences
    expect(preferences).to.deep.equal([
      {
        notificationType: 'merchant_claim',
        ownerAddress: '0x01',
        pushClientId: '123',
        status: 'enabled',
      },
      {
        notificationType: 'customer_payment',
        ownerAddress: '0x01',
        pushClientId: '123',
        status: 'disabled',
      },
      {
        notificationType: 'merchant_claim',
        ownerAddress: '0x01',
        pushClientId: '124',
        status: 'enabled',
      },
      {
        notificationType: 'customer_payment',
        ownerAddress: '0x01',
        pushClientId: '124',
        status: 'enabled',
      },
    ]);
  });

  it('returns which devices should receive a notification for an EOA and notification type', async function () {
    let service = await getContainer().lookup('notification-preference-service');

    expect(await service.getEligiblePushClientIds('0x01', 'customer_payment')).to.deep.equal(['124']);
    expect(await service.getEligiblePushClientIds('0x01', 'merchant_claim')).to.deep.equal(['123', '124']);
  });
});
