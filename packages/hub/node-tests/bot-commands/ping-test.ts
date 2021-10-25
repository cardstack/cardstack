import { HubBotController } from '../../main';
import { name as pingName, run as pingCommand } from '../../services/discord-bots/hub-bot/commands/guild/ping';
import Bot, { MockUser, makeTestMessage, makeTestChannel } from '@cardstack/discord-bot';

describe('bot command: ping', function () {
  let botController: HubBotController;
  let bot: Bot;
  let user: MockUser = {
    id: 'userId',
    bot: false,
    username: 'Akiko',
  };

  // Based on how your bot command deals with state it may be more desireable to
  // create and teardown the DI container in between each test. Because the
  // !ping command is not stateful, it's not really necessary.
  this.beforeAll(async function () {
    botController = await HubBotController.create();
    bot = botController.bot;
  });

  this.afterAll(async function () {
    await botController.teardown();
  });

  it(`has a command name`, async function () {
    expect(pingName).to.equal('ping');
  });

  it(`can respond to a !ping command`, async function () {
    let channel = makeTestChannel();
    let message = makeTestMessage({
      user,
      content: '!ping',
      channel,
    });

    await pingCommand(bot, message);
    expect(channel.lastResponse).to.equal('pong');
  });
});
