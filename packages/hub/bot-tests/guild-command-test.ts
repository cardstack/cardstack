import { test, beforeStart, afterAll, expect } from 'corde';
import { HubBot } from '../main';

const TIMEOUT = 10 * 1000;

let bot: HubBot;
beforeStart(async () => {
  bot = await HubBot.create();
}, TIMEOUT);

afterAll(async () => {
  await bot.teardown();
}, TIMEOUT);

test('bot can respond to a guild command', async function () {
  expect('ping').toReturn('pong');
});
