import { Client as DBClient } from 'pg';

import config from 'config';
import { name as commandName, run as command } from '../../services/discord-bots/hub-bot/commands/guild/card-drop';
import * as JSONAPI from 'jsonapi-typescript';
import {
  MockUser,
  makeTestMessage,
  makeTestChannel,
  makeTestGuild,
  Collection,
  MockRole,
} from '@cardstack/discord-bot';
import { CardDropConfig } from '../../services/discord-bots/hub-bot/types';
import { registry, setupBot } from '../helpers/server';

const { sku } = config.get('cardDrop') as CardDropConfig;

describe('bot command: card-drop', function () {
  let db: DBClient;
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
    registry(this).register('inventory', StubInventoryService);
  });

  let { getContainer, getBot } = setupBot(this, 'beforeAll');

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM dm_channels`);
    await db.query(`DELETE FROM card_drop_recipients`);

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

    await command(getBot(), message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.contain(`Card Wallet app to receive your prepaid card.`);
  });

  it(`does not give prepaid cards to users that already received airdrop`, async function () {
    await db.query(
      `INSERT INTO card_drop_recipients (user_id, user_name, address, airdrop_txn_hash) VALUES ($1, $2, $3, $4)`,
      [user.id, user.username, mockEOA, mockTxnHash]
    );
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

    await command(getBot(), message);
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

    await command(getBot(), message);
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

    await command(getBot(), message);
    expect(channel.responses).to.deep.equal([]);
    expect(dm.lastResponse).to.equal(
      `Sorry, it looks like we don't have any prepaid cards available right now, try asking me again in the future.`
    );
  });
});
