import { Client as DBClient } from 'pg';
import { it, beforeStart, afterAll, expect } from 'corde';
import config from 'config';
import { Registry } from '@cardstack/di';
import { BetaTestConfig } from '../../../../services/discord-bots/hub-bot/types';
import { HubBotController } from '../../../../process-controllers/hub-bot-controller';

let { sku } = config.get('betaTesting') as BetaTestConfig;

// The discord test driver lib, corde, is still pretty new so its a bit rough
// around the edges. Some of our challenges are that the `describe()` doesn't
// honor the `beforeStart` and `afterAll` hooks, and it does not seem to deal
// with awaiting different test modules. So all the tests for the bot are in
// this one file.

// WARNING! there is no way to reliably reset the testing state between the tests!!!!

const TIMEOUT = 10 * 1000;

class StubInventory {
  getSKUSummaries() {
    return Promise.resolve([
      {
        type: 'inventories',
        id: sku,
        attributes: {
          quantity: 10,
        },
      },
    ]);
  }
}

let bot: HubBotController;
let db: DBClient;
beforeStart(async () => {
  bot = await HubBotController.create({
    registryCallback(registry: Registry) {
      registry.register('inventory', StubInventory);
    },
  });
}, TIMEOUT);

// Ugh, the corde before each hook doesn't seem to work
async function setupTest() {
  let dbManager = await bot.container.lookup('database-manager');
  db = await dbManager.getClient();
  await db.query(`DELETE FROM dm_channels`);
  await db.query(`DELETE FROM beta_testers`);
}

afterAll(async () => {
  await bot.teardown();
}, TIMEOUT);

it(`can respond to a guild command`, async function () {
  await setupTest();
  expect('ping').toReturn('pong');
});
