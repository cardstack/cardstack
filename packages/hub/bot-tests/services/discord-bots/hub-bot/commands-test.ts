import { Client as DBClient } from 'pg';
import { it, beforeStart, afterAll, expect } from 'corde';
import { Container } from '@cardstack/di';
import { createRegistry } from '../../../../main';

// The discord test driver lib, corde, is still pretty new so its a bit rough
// around the edges. Some of our challenges are that the `describe()` doesn't
// honor the `beforeStart` and `afterAll` hooks, and it does not seem to deal
// with awaiting different test modules. So all the tests for the bot are in
// this one file.

// WARNING! there is no way to reliably reset the testing state between the tests!!!!

const TIMEOUT = 10 * 1000;

let container: Container;
let db: DBClient;
beforeStart(async () => {
  // warning this is not a mocha hook, so we are making a new container by hand
  let registry = createRegistry();
  container = new Container(registry);
  let bot = await container.lookup('hubBot');
  await bot.start();
}, TIMEOUT);

// Ugh, the corde before each hook doesn't seem to work
async function setupTest() {
  let dbManager = await container.lookup('database-manager');
  db = await dbManager.getClient();
  await db.query(`DELETE FROM dm_channels`);
  await db.query(`DELETE FROM beta_testers`);
}

afterAll(async () => {
  await container.teardown();
}, TIMEOUT);

it(`can respond to a guild command`, async function () {
  await setupTest();
  expect('ping').toReturn('pong');
});
