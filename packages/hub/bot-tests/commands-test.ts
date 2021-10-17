import { Client as DBClient } from 'pg';
import { it, beforeStart, afterAll, expect, bot as cordeBot } from 'corde';
import { HubBot } from '../main';
import config from 'config';
import { BetaTestConfig, DiscordConfig } from '@cardstack/cardbot/types';
import { Registry } from '@cardstack/di';

let { cordeBotId, betaTesterRole: betaTesterRoleName } = config.get('discord') as DiscordConfig;
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

let bot: HubBot;
let db: DBClient;
beforeStart(async () => {
  bot = await HubBot.create({
    registryCallback(registry: Registry) {
      registry.register('inventory', StubInventory);
    },
  });
}, TIMEOUT);

async function assumeBetaTesterRole() {
  let member = cordeBot.guildMembers.find((m) => m.id === cordeBotId)!;
  let role = cordeBot.roles.find((r) => r.name === betaTesterRoleName)!;
  await member.roles.add(role);
}

// Ugh, the corde before each hook doesn't seem to work
async function setupTest() {
  await assumeBetaTesterRole();
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

it(`can participate in a conversation`, async function () {
  await setupTest();
  expect('dm-ping').toReturn('Hi');
  expect('blah').toMessageContentContains('pong');
  // the bot stops responding after the conversation is over
  expect('blah').not.toMessageContentContains('pong');
});

it(`does not respond in a non-allowed channel`, async function () {
  await setupTest();
  expect('ping', '898897116913623050').not.toReturn('pong');
});

it(`can start a conversation for a beta tester that has not received an airdrop`, async function () {
  await setupTest();
  expect('card-me').toMessageContentContains(`Connect your Card Wallet app to receive your prepaid card`);
  // arg, corde asserts need to start with a command, since we have entered a DM
  // there there is no way to make any more assertions since the following
  // responses are just text and not commands (since bots can't DM each other
  // corde doesn't current provide any DM support--everything is command
  // centric)
});
