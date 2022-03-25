import { Client as DBClient } from 'pg';
import config from 'config';
import {
  name as commandName,
  run as command,
} from '../../../services/discord-bots/hub-bot/commands/dm/airdrop-prepaidcard/start';
import * as JSONAPI from 'jsonapi-typescript';
import {
  MockUser,
  makeTestMessage,
  makeTestChannel,
  makeTestGuild,
  Collection,
  MockRole,
  MockChannel,
  Message,
} from '@cardstack/discord-bot';
import { CardDropConfig } from '../../../services/discord-bots/hub-bot/types';
import { registry, setupBot } from '../../helpers/server';

const { sku } = config.get('cardDrop') as CardDropConfig;

describe('bot command: airdrop-prepaidcard:start', function () {
  let db: DBClient;
  let dm: MockChannel;
  let stubInventory: JSONAPI.ResourceObject[];
  let walletConnectDeferred: Promise<any>;

  let user: MockUser = {
    id: 'userId',
    bot: false,
    username: 'Akiko',
  };
  let mockEOA = '0x123';
  let mockTxnHash = '0x456';
  let mockPrepaidCardAddress = '0x789';
  let roles = new Collection<string, MockRole>();
  let guild = makeTestGuild({ roles });

  class StubInventoryService {
    async getSKUSummaries(): Promise<JSONAPI.ResourceObject[]> {
      return Promise.resolve(stubInventory);
    }
  }

  class StubWalletConnectService {
    async getWeb3(message: Message): Promise<any> {
      await message.reply('<qr code image>');
      return walletConnectDeferred;
    }
  }

  class StubRelayService {
    async provisionPrepaidCard(userAddress: string, requestedSku: string) {
      expect(userAddress).to.equal(mockEOA);
      expect(requestedSku).to.equal(sku);
      return Promise.resolve(mockTxnHash);
    }
  }

  class StubCardpaySDK {
    getSDK(sdk: string) {
      switch (sdk) {
        case 'PrepaidCardMarket':
          return Promise.resolve({
            getPrepaidCardFromProvisionTxnHash: () =>
              Promise.resolve({
                address: mockPrepaidCardAddress,
              }),
          });
        default:
          throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
      }
    }
  }

  this.beforeAll(async function () {
    registry(this).register('inventory', StubInventoryService);
    registry(this).register('wallet-connect', StubWalletConnectService);
    registry(this).register('relay', StubRelayService, { type: 'service' });
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getContainer, getBot } = setupBot(this, 'beforeAll');

  this.beforeEach(async function () {
    dm = makeTestChannel();
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM dm_channels`);
    await db.query(`DELETE FROM card_drop_recipients`);

    await db.query(`INSERT INTO dm_channels (channel_id, user_id, command) VALUES ($1, $2, $3)`, [
      dm.id,
      user.id,
      'airdrop-prepaidcard:start',
    ]);

    stubInventory = [
      {
        id: sku,
        type: 'inventories',
        attributes: {
          quantity: 1,
        },
      },
    ];
  });

  it(`has a command name`, async function () {
    expect(commandName).to.equal('airdrop-prepaidcard:start');
  });

  it(`can cancel the airdrop conversation`, async function () {
    let message = makeTestMessage({
      user,
      guild,
      content: 'cancel',
      userRoles: roles,
      channel: dm,
    });

    await command(getBot(), message, [dm.id]);
    expect(dm.lastResponse).to.equal(`ok, if you change your mind type \`!card-drop\` in the public channel.`);
  });

  it(`can tell the user it doesn't understand`, async function () {
    let message = makeTestMessage({
      user,
      guild,
      content: 'I eat glue',
      userRoles: roles,
      channel: dm,
    });

    await command(getBot(), message, [dm.id]);
    expect(dm.lastResponse).to.equal(`I didn't catch that--are you ready to continue?`);
  });

  it(`can provision a prepaid card when the user types 'ok'`, async function () {
    let qrCodeScanned: any;
    walletConnectDeferred = new Promise<any>((res) => (qrCodeScanned = res));

    let message = makeTestMessage({
      user,
      guild,
      content: 'ok',
      userRoles: roles,
      channel: dm,
      onReply: async (msg) => {
        if (msg === '<qr code image>') {
          qrCodeScanned({
            eth: {
              getAccounts() {
                return [mockEOA];
              },
            },
          });
        }
      },
    });

    await command(getBot(), message, [dm.id]);
    expect(dm.responses.length).to.equal(4);
    expect(dm.responses[0]).to.equal(`<qr code image>`);
    expect(dm.responses[1]).to.equal(
      `Great! I see your wallet address is ${mockEOA}. I'm sending you a prepaid card, hang on...`
    );
    expect(dm.responses[2]).to.equal(
      `Your prepaid card is on the way, here is the transaction that includes your prepaid card https://blockscout.com/poa/sokoltx/${mockTxnHash}/token-transfers`
    );
    expect(dm.responses[3].type).to.equal('rich');
    expect(dm.responses[3].title).to.equal('Your Prepaid Card is Ready!');
    expect(dm.responses[3].description).to.equal(
      `Your prepaid card address is ${mockPrepaidCardAddress}. You can refresh your Card Wallet app to see your new prepaid card.`
    );
    expect(dm.responses[3].image.url).to.equal(`attachment://${sku}.png`);

    let { rows } = await db.query(`SELECT * FROM card_drop_recipients WHERE user_id = $1`, [user.id]);
    expect(rows.length).to.equal(1);

    let [row] = rows;
    expect(row.user_name).to.equal(user.username);
    expect(row.address).to.equal(mockEOA);
    expect(row.airdrop_txn_hash).to.equal(mockTxnHash);
    expect(row.airdrop_prepaid_card).to.equal(mockPrepaidCardAddress);
  });

  it(`will not prompt for a QR code if the system already has collected the EOA`, async function () {
    await db.query(`INSERT INTO card_drop_recipients (user_id, user_name, address) VALUES ($1, $2, $3)`, [
      user.id,
      user.username,
      mockEOA,
    ]);

    let message = makeTestMessage({
      user,
      guild,
      content: 'ok',
      userRoles: roles,
      channel: dm,
    });

    await command(getBot(), message, [dm.id]);
    expect(dm.responses.length).to.equal(3);
    expect(dm.responses[0]).to.equal(
      `Great! I see your wallet address is ${mockEOA}. I'm sending you a prepaid card, hang on...`
    );
    expect(dm.responses[1]).to.equal(
      `Your prepaid card is on the way, here is the transaction that includes your prepaid card https://blockscout.com/poa/sokoltx/${mockTxnHash}/token-transfers`
    );
    expect(dm.responses[2].description).to.equal(
      `Your prepaid card address is ${mockPrepaidCardAddress}. You can refresh your Card Wallet app to see your new prepaid card.`
    );
  });

  it('will not provision a prepaid card for an EOA which already has an airDropTxnHash', async function () {
    await db.query(
      `INSERT INTO card_drop_recipients (user_id, user_name, address, airdrop_txn_hash) VALUES ($1, $2, $3, $4)`,
      [user.id, user.username, mockEOA, mockTxnHash]
    );
    let message = makeTestMessage({
      user,
      guild,
      content: 'ok',
      userRoles: roles,
      channel: dm,
    });
    await command(getBot(), message, [dm.id]);
    expect(dm.responses.length).to.equal(1);
    expect(dm.responses[0]).to.equal(
      `Sorry, it appears that we have previously dropped a prepaid card to your wallet (address ${mockEOA}). There is a limit of one card per address.`
    );
  });
});
