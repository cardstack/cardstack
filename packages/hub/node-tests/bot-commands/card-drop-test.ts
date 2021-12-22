import { Client as DBClient } from 'pg';

import config from 'config';
import { name as commandName, run as command } from '../../services/discord-bots/hub-bot/commands/guild/card-drop';
import * as JSONAPI from 'jsonapi-typescript';
import Bot, {
  MockUser,
  makeTestMessage,
  makeTestChannel,
  makeTestGuild,
  Collection,
  MockRole,
} from '@cardstack/discord-bot';
import { BetaTestConfig } from '../../services/discord-bots/hub-bot/types';
import { HubBotController } from '../../process-controllers/hub-bot-controller';

const { sku } = config.get('betaTesting') as BetaTestConfig;

describe('bot command: card-drop', function () {
  let botController: HubBotController;
  let db: DBClient;
  let bot: Bot;
  let stubInventory: JSONAPI.ResourceObject[];

  let user: MockUser = {
    id: 'userId',
    bot: false,
    username: 'Akiko',
  };
  let mockEOA = '0x123';
  let mockTxnHash = '0x456';
  let roles = new Collection<string, MockRole>();
  let guild = makeTestGuild({ roles });

  class StubInventoryService {
    async getSKUSummaries(): Promise<JSONAPI.ResourceObject[]> {
      return Promise.resolve(stubInventory);
    }
  }

  this.beforeAll(async function () {
    botController = await HubBotController.create({
      registryCallback(registry) {
        registry.register('inventory', StubInventoryService);
      },
    });
    bot = botController.bot;
  });

  this.afterAll(async function () {
    await botController.teardown();
  });

  this.beforeEach(async function () {
    let dbManager = await botController.container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM dm_channels`);
    await db.query(`DELETE FROM beta_testers`);

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
    expect(commandName).to.equal('card-drop');
  });

  it(`starts a conversation with user that has not yet received an airdrop`, async function () {
    let channel = makeTestChannel();
    let dm = makeTestChannel();
    let message = makeTestMessage({
      user,
      guild,
      content: '!card-drop',
      userRoles: roles,
      onCreateDM: () => Promise.resolve(dm),
      channel,
    });

    await command(bot, message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.contain(`Connect your Card Wallet app to receive your prepaid card.`);
  });

  it(`does not give prepaid cards to users that already received airdrop`, async function () {
    await db.query(`INSERT INTO beta_testers (user_id, user_name, address, airdrop_txn_hash) VALUES ($1, $2, $3, $4)`, [
      user.id,
      user.username,
      mockEOA,
      mockTxnHash,
    ]);
    let channel = makeTestChannel();
    let dm = makeTestChannel();
    let message = makeTestMessage({
      user,
      guild,
      content: '!card-drop',
      userRoles: roles,
      onCreateDM: () => Promise.resolve(dm),
      channel,
    });

    await command(bot, message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.equal(
      `You have already been provisioned a prepaid card. If you are having problems accessing it contact an admin for help.`
    );
  });

  it(`does not give prepaid cards when no more inventory exists`, async function () {
    stubInventory = [
      {
        id: sku,
        type: 'inventories',
        attributes: {
          quantity: 0,
        },
      },
    ];

    let channel = makeTestChannel();
    let dm = makeTestChannel();
    let message = makeTestMessage({
      user,
      guild,
      content: '!card-drop',
      userRoles: roles,
      onCreateDM: () => Promise.resolve(dm),
      channel,
    });

    await command(bot, message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.equal(
      `Sorry, it looks like we don't have any prepaid cards available right now, try asking me again in the future.`
    );
  });

  it(`does not give prepaid cards when air drop SKU does not exist`, async function () {
    stubInventory = [];

    let channel = makeTestChannel();
    let dm = makeTestChannel();
    let message = makeTestMessage({
      user,
      guild,
      content: '!card-drop',
      userRoles: roles,
      onCreateDM: () => Promise.resolve(dm),
      channel,
    });

    await command(bot, message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.equal(
      `Sorry, it looks like we don't have any prepaid cards available right now, try asking me again in the future.`
    );
  });
});
