import { HubBotController } from '../../main';
import { name as pingName, run as pingCommand } from '../../services/discord-bots/hub-bot/commands/guild/ping';
import Bot, { MockChannel, MockMessage, MockRole, MockUser, Collection } from '@cardstack/discord-bot';

const unusedDMChannel: MockChannel = {
  type: 'dm',
  id: 'not-used',
  send: () => {
    throw new Error(`unexpected DM sent`);
  },
};

describe('bot command: ping', function () {
  let botController: HubBotController;
  let bot: Bot;

  this.beforeEach(async function () {
    botController = await HubBotController.create();
    bot = botController.bot;
  });

  this.afterEach(async function () {
    await botController.teardown();
  });

  it(`has a command name`, async function () {
    expect(pingName).to.equal('ping');
  });

  it(`can respond to a !ping command`, async function () {
    let author: MockUser = { id: 'userId', bot: false, username: 'Akiko' };
    let channelResponse: string | undefined;
    let message: MockMessage = {
      content: '!ping',
      author,
      member: {
        id: author.id,
        user: author,
        roles: {
          cache: new Collection<string, MockRole>(),
        },
        createDM: () => Promise.resolve(unusedDMChannel),
      },
      channel: {
        id: '1',
        type: 'text',
        send: (msg) => {
          channelResponse = msg;
          return Promise.resolve();
        },
      },
      reply: () => {
        throw new Error(`unexpected reply`);
      },
    };

    await pingCommand(bot, message);
    expect(channelResponse).to.equal('pong');
  });
});
