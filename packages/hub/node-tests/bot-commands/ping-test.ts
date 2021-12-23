import { name as pingName, run as pingCommand } from '../../services/discord-bots/hub-bot/commands/guild/ping';
import { MockUser, makeTestMessage, makeTestChannel } from '@cardstack/discord-bot';
import { setupBot } from '../helpers/server';

describe('bot command: ping', function () {
  let user: MockUser = {
    id: 'userId',
    bot: false,
    username: 'Akiko',
  };

  // Based on how your bot command deals with state it may be more desireable to
  // create and teardown the DI container in between each test. Because the
  // !ping command is not stateful, it's not really necessary.
  let { getBot } = setupBot(this, 'beforeAll');

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

    await pingCommand(getBot(), message);
    expect(channel.lastResponse).to.equal('pong');
  });
});
