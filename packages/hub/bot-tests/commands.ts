import { Client as DBClient } from 'pg';
import { it, beforeStart, beforeEach, afterAll, expect } from 'corde';
import { HubBot } from '../main';

const TIMEOUT = 10 * 1000;

let bot: HubBot;
let db: DBClient;
beforeStart(async () => {
  bot = await HubBot.create();
}, TIMEOUT);

beforeEach(async () => {
  let dbManager = await bot.container.lookup('database-manager');
  db = await dbManager.getClient();
  await db.query(`DELETE FROM dm_channels`);
}, TIMEOUT);

afterAll(async () => {
  await bot.teardown();
}, TIMEOUT);

it('can respond to a guild command', async function () {
  expect('ping').toReturn('pong');
});

it('can participate in DM conversation', async function () {
  expect('dm-ping').toReturn('Hi');
  expect('blah').toMessageContentContains('pong');
  // the bot stops responding after the conversation is over
  expect('blah').not.toMessageContentContains('pong');
});
