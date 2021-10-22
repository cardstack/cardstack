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
    let channelResponse: string | undefined;
    let message = makeTestMessage({
      user,
      content: '!ping',
      channel: makeTestChannel({ onSend: (msg) => (channelResponse = msg) }),
    });

    await pingCommand(bot, message);
    expect(channelResponse).to.equal('pong');
  });
});
